const { execFileSync } = require('child_process')
const cheerio = require('cheerio')
const fs = require('fs/promises')
const path = require('path')
const VENUE_MAPPINGS = require('./venue-mappings.json')

const SOURCE_URL = 'https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json'
const OUTPUT_PATH = path.join(__dirname, '../boxoffice-events.tsv')
const CHANGE_LOG_PATH = path.join(__dirname, '../boxoffice-changes.log')
const WEBSITE_LISTING = 'VFringe'
const EVENT_URL_PREFIX = 'https://purchase.vfringe.co.uk/EventAvailability?EventId='
const CANCELLED_PREFIX = 'CANCELLED - '
const HEADER = ['Venue', 'Date', 'Start', 'End', 'Title', 'Event', 'Tags', 'Event Type', 'Is On Sale', 'Is Sold Out', 'Description']

const COL = {
  Venue: 0,
  Date: 1,
  Start: 2,
  End: 3,
  Title: 4,
  Event: 5,
  Tags: 6,
  EventType: 7,
  IsOnSale: 8,
  IsSoldOut: 9,
  Description: 10
}

/**
 * Fetches the Spektrix eventsView JSON feed.
 *
 * @returns {Array<object>} Parsed event records from Spektrix.
 */
function fetchEvents () {
  const raw = execFileSync('curl', ['-s', '-L', SOURCE_URL], { encoding: 'utf8' })
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('Expected eventsView.json to return an array')
  }

  return parsed
}

/**
 * Sanitizes a TSV field by collapsing whitespace and stripping tabs/newlines.
 *
 * @param {unknown} value Raw field value.
 * @returns {string} Safe single-line TSV cell text.
 */
function sanitizeField (value) {
  return String(value ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Converts Spektrix HTML description markup to plain text.
 *
 * @param {string} html HTML fragment from Spektrix.
 * @returns {string} Plain text with newlines preserved for venue parsing.
 */
function htmlToText (html) {
  const $ = cheerio.load(html || '')
  $('br').replaceWith('\n')
  return $.root().text().replace(/\r/g, '\n')
}

/**
 * Extracts the venue label from a Spektrix HTML description.
 *
 * @param {string} htmlDescription Spektrix `htmlDescription` field.
 * @returns {string} Raw venue text, or empty string when missing.
 */
function extractVenue (htmlDescription) {
  const text = htmlToText(htmlDescription)
  const match = text.match(/Venue:\s*([\s\S]*?)(?:\n\s*\n|\n(?:Tickets:|Age Rating:|Duration:|Accessibility:|Wheelchair Spaces:)|$)/i)
  return sanitizeField(match ? match[1] : '')
}

/**
 * Builds candidate Spektrix / numeric event IDs for venue overrides.
 *
 * @param {object} event Spektrix event record.
 * @returns {string[]} Candidate IDs, numeric first when present.
 */
function getEventIdCandidates (event) {
  const fullId = sanitizeField(event.id)
  const numericIdMatch = fullId.match(/^\d+/)
  const ids = [fullId]

  if (numericIdMatch && numericIdMatch[0] !== fullId) {
    ids.unshift(numericIdMatch[0])
  }

  return ids.filter(Boolean)
}

/**
 * Returns the numeric Spektrix event ID used in ticket URLs.
 *
 * @param {object} event Spektrix event record.
 * @returns {string} Numeric event ID, or empty string when unavailable.
 */
function getNumericEventId (event) {
  const [numericId] = getEventIdCandidates(event)
  return numericId && /^\d+$/.test(numericId) ? numericId : ''
}

/**
 * Builds the public EventAvailability URL for a Spektrix event.
 *
 * @param {object} event Spektrix event record.
 * @returns {string} Ticket URL, or empty string when the event ID is missing.
 */
function getEventUrl (event) {
  const eventId = getNumericEventId(event)
  return eventId ? `${EVENT_URL_PREFIX}${eventId}` : ''
}

/**
 * Extracts the numeric EventId from a ticket URL or Event column value.
 *
 * @param {string} eventUrl Event column value.
 * @returns {string} Numeric event ID, or empty string when not found.
 */
function extractEventIdFromUrl (eventUrl) {
  const match = String(eventUrl || '').match(/EventId=(\d+)/)
  return match ? match[1] : ''
}

/**
 * Maps a raw venue string through festival-specific overrides.
 *
 * @param {object} event Spektrix event record.
 * @param {string} instanceDateTime ISO-ish instance datetime.
 * @param {string} rawVenue Venue text extracted from HTML.
 * @returns {string} Normalized venue label.
 */
function mapVenue (event, instanceDateTime, rawVenue) {
  const normalizedVenue = sanitizeField(rawVenue)
  const instanceDate = formatDate(instanceDateTime)

  for (const eventId of getEventIdCandidates(event)) {
    const dateOverrides = VENUE_MAPPINGS.eventIdDateVenueOverrides[eventId]
    if (dateOverrides && dateOverrides[instanceDate]) {
      return dateOverrides[instanceDate]
    }
  }

  for (const eventId of getEventIdCandidates(event)) {
    if (VENUE_MAPPINGS.eventIdVenueOverrides[eventId]) {
      return VENUE_MAPPINGS.eventIdVenueOverrides[eventId]
    }
  }

  return VENUE_MAPPINGS.exactVenueMappings[normalizedVenue] || normalizedVenue
}

/**
 * Returns buyable instance datetimes for an event.
 *
 * Does not fall back to `firstInstanceDateTime` when the available list is
 * empty: that path is handled separately for first-time sold-out capture.
 *
 * @param {object} event Spektrix event record.
 * @returns {string[]} Buyable instance datetime strings.
 */
function getAvailableInstanceDateTimes (event) {
  if (Array.isArray(event.availableInstanceDates) && event.availableInstanceDates.length > 0) {
    return event.availableInstanceDates
  }

  return []
}

/**
 * Parses a Spektrix local datetime string into a Date.
 *
 * @param {string} value Spektrix datetime (e.g. `2026-07-17T19:00:00`).
 * @returns {Date|null} Local Date, or null when parsing fails.
 */
function parseLocalDateTime (value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
}

/**
 * Formats the date portion of a Spektrix datetime.
 *
 * @param {string} value Spektrix datetime.
 * @returns {string} `YYYY-MM-DD`.
 */
function formatDate (value) {
  return String(value).split('T')[0] || ''
}

/**
 * Formats the time portion of a Spektrix datetime.
 *
 * @param {string} value Spektrix datetime.
 * @returns {string} `HH:MM`.
 */
function formatTime (value) {
  const match = String(value).match(/T(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

/**
 * Computes an end time from a start datetime and duration in minutes.
 *
 * @param {string} value Spektrix start datetime.
 * @param {number} durationMinutes Event duration in minutes.
 * @returns {string} `HH:MM` end time, or empty string when inputs are invalid.
 */
function formatEndTime (value, durationMinutes) {
  if (!durationMinutes && durationMinutes !== 0) {
    return ''
  }

  const start = parseLocalDateTime(value)
  if (!start) {
    return ''
  }

  const end = new Date(start.getTime() + Number(durationMinutes) * 60 * 1000)
  const hours = String(end.getHours()).padStart(2, '0')
  const minutes = String(end.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Builds a performance identity key from event ID, date, and start time.
 *
 * @param {string} eventId Numeric Spektrix event ID.
 * @param {string} date `YYYY-MM-DD`.
 * @param {string} start `HH:MM`.
 * @returns {string} Stable performance key.
 */
function performanceKey (eventId, date, start) {
  return `${eventId}|${date}|${start}`
}

/**
 * Builds a performance key for a Spektrix instance datetime.
 *
 * @param {string} eventId Numeric Spektrix event ID.
 * @param {string} instanceDateTime Spektrix datetime.
 * @returns {string} Stable performance key.
 */
function performanceKeyFromInstance (eventId, instanceDateTime) {
  return performanceKey(eventId, formatDate(instanceDateTime), formatTime(instanceDateTime))
}

/**
 * Strips a leading cancelled title prefix if present.
 *
 * @param {string} title Event title from the TSV.
 * @returns {{ cancelled: boolean, baseTitle: string }} Cancellation state and bare title.
 */
function stripCancelledPrefix (title) {
  const value = sanitizeField(title)

  if (value.startsWith(CANCELLED_PREFIX)) {
    return {
      cancelled: true,
      baseTitle: value.slice(CANCELLED_PREFIX.length).trim()
    }
  }

  return { cancelled: false, baseTitle: value }
}

/**
 * Applies the cancelled title prefix idempotently.
 *
 * @param {string} title Bare or already-prefixed title.
 * @returns {string} Title with a single `CANCELLED - ` prefix.
 */
function applyCancelledPrefix (title) {
  const { baseTitle } = stripCancelledPrefix(title)
  return `${CANCELLED_PREFIX}${baseTitle}`
}

/**
 * Builds one TSV row array from a Spektrix event and instance datetime.
 *
 * @param {object} event Spektrix event record.
 * @param {string} instanceDateTime Spektrix instance datetime.
 * @param {{ soldOut?: boolean, cancelled?: boolean }} [options] Override flags.
 * @returns {string[]} TSV row cells in HEADER order.
 */
function toRecord (event, instanceDateTime, options = {}) {
  const venue = mapVenue(event, instanceDateTime, extractVenue(event.htmlDescription))
  const soldOut = options.soldOut !== undefined
    ? Boolean(options.soldOut)
    : Boolean(event.isSoldOut)
  const title = options.cancelled
    ? applyCancelledPrefix(sanitizeField(event.name))
    : sanitizeField(event.name)

  return [
    venue,
    formatDate(instanceDateTime),
    formatTime(instanceDateTime),
    formatEndTime(instanceDateTime, event.duration),
    title,
    getEventUrl(event),
    '',
    sanitizeField(event.attribute_EventType),
    String(Boolean(event.isOnSale)),
    String(soldOut),
    sanitizeField(event.description)
  ]
}

/**
 * Clones a TSV row array.
 *
 * @param {string[]} row Source row.
 * @returns {string[]} Independent copy.
 */
function cloneRow (row) {
  return [...row]
}

/**
 * Reads a performance key from an existing TSV row.
 *
 * @param {string[]} row TSV row cells.
 * @returns {string} Performance key, or empty string when EventId is missing.
 */
function rowPerformanceKey (row) {
  const eventId = extractEventIdFromUrl(row[COL.Event])
  if (!eventId) {
    return ''
  }

  return performanceKey(eventId, row[COL.Date], row[COL.Start])
}

/**
 * Returns whether two rows differ in metadata fields managed by the feed.
 *
 * Sold-out and cancelled state are excluded; those are handled separately.
 *
 * @param {string[]} existingRow Current TSV row.
 * @param {string[]} feedRow Row freshly built from the feed.
 * @returns {boolean} True when venue/title/description/etc. differ.
 */
function metadataChanged (existingRow, feedRow) {
  const existingTitle = stripCancelledPrefix(existingRow[COL.Title]).baseTitle
  const feedTitle = stripCancelledPrefix(feedRow[COL.Title]).baseTitle
  const fields = [COL.Venue, COL.End, COL.Event, COL.Tags, COL.EventType, COL.IsOnSale, COL.Description]

  if (existingTitle !== feedTitle) {
    return true
  }

  return fields.some(index => sanitizeField(existingRow[index]) !== sanitizeField(feedRow[index]))
}

/**
 * Applies feed metadata onto an existing row while preserving schedule identity.
 *
 * @param {string[]} existingRow Current TSV row.
 * @param {string[]} feedRow Row freshly built from the feed.
 * @returns {string[]} Updated row.
 */
function applyFeedMetadata (existingRow, feedRow) {
  const next = cloneRow(existingRow)
  next[COL.Venue] = feedRow[COL.Venue]
  next[COL.End] = feedRow[COL.End]
  next[COL.Title] = feedRow[COL.Title]
  next[COL.Event] = feedRow[COL.Event]
  next[COL.Tags] = feedRow[COL.Tags]
  next[COL.EventType] = feedRow[COL.EventType]
  next[COL.IsOnSale] = feedRow[COL.IsOnSale]
  next[COL.Description] = feedRow[COL.Description]
  return next
}

/**
 * Builds a change-log entry for a row transition.
 *
 * @param {string} changeType One of add|sold out|cancelled|change metadata|reinstated.
 * @param {string[]} row Affected TSV row.
 * @returns {{ changeType: string, venue: string, date: string, start: string, name: string }}
 */
function changeFromRow (changeType, row) {
  return {
    changeType,
    venue: row[COL.Venue],
    date: row[COL.Date],
    start: row[COL.Start],
    name: stripCancelledPrefix(row[COL.Title]).baseTitle
  }
}

/**
 * Sorts TSV rows by date, start, venue, then title.
 *
 * @param {string[]} a Left row.
 * @param {string[]} b Right row.
 * @returns {number} Comparator result.
 */
function compareRows (a, b) {
  return [
    a[COL.Date].localeCompare(b[COL.Date]),
    a[COL.Start].localeCompare(b[COL.Start]),
    a[COL.Venue].localeCompare(b[COL.Venue]),
    stripCancelledPrefix(a[COL.Title]).baseTitle.localeCompare(stripCancelledPrefix(b[COL.Title]).baseTitle)
  ].find(value => value !== 0) || 0
}

/**
 * Parses a boxoffice TSV document into row arrays.
 *
 * @param {string} text Full TSV file contents.
 * @returns {string[][]} Data rows (header excluded). Empty when the file is blank.
 */
function parseTsv (text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter(line => line.length > 0)

  if (lines.length === 0) {
    return []
  }

  const header = lines[0].split('\t')
  if (header[0] !== 'Venue') {
    throw new Error('Unexpected TSV header; expected Venue as first column')
  }

  return lines.slice(1).map(line => {
    const cells = line.split('\t')
    while (cells.length < HEADER.length) {
      cells.push('')
    }
    return cells.slice(0, HEADER.length)
  })
}

/**
 * Serializes TSV rows with a stable header-first ordering.
 *
 * @param {string[][]} records Data rows.
 * @returns {string} Complete TSV document ending in a trailing newline.
 */
function serializeTsv (records) {
  const sorted = [...records].sort(compareRows)
  const lines = [HEADER, ...sorted].map(row => row.join('\t'))
  return `${lines.join('\n')}\n`
}

/**
 * Formats change-log entries as TSV lines for append + console output.
 *
 * @param {Array<{ changeType: string, venue: string, date: string, start: string, name: string }>} changes Change entries.
 * @param {string|Date} [timestamp] Shared timestamp for the batch (defaults to now).
 * @returns {string[]} Log lines without trailing newlines.
 */
function formatChangeLogLines (changes, timestamp = new Date()) {
  const stamp = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp)

  return changes.map(change => [
    stamp,
    change.changeType,
    sanitizeField(change.venue),
    sanitizeField(change.date),
    sanitizeField(change.start),
    sanitizeField(change.name)
  ].join('\t'))
}

/**
 * Builds maps of Spektrix feed events and buyable performances keyed for reconcile.
 *
 * @param {Array<object>} feedEvents Spektrix events (already filtered to the festival listing when possible).
 * @returns {{ eventsById: Map<string, object>, buyableByKey: Map<string, { event: object, instanceDateTime: string }> }}
 */
function indexFeed (feedEvents) {
  const eventsById = new Map()
  const buyableByKey = new Map()

  for (const event of feedEvents) {
    if (event.attribute_WebsiteListing !== WEBSITE_LISTING) {
      continue
    }

    const eventId = getNumericEventId(event)
    if (!eventId) {
      continue
    }

    eventsById.set(eventId, event)

    for (const instanceDateTime of getAvailableInstanceDateTimes(event)) {
      buyableByKey.set(performanceKeyFromInstance(eventId, instanceDateTime), {
        event,
        instanceDateTime
      })
    }
  }

  return { eventsById, buyableByKey }
}

/**
 * Captures a brand-new sold-out event that has no buyable instance dates left.
 *
 * Spektrix clears `availableInstanceDates` for fully sold-out shows, so a first
 * capture can only seed from `firstInstanceDateTime`.
 *
 * @param {object} event Spektrix event record.
 * @returns {string|null} Instance datetime to seed, or null when none is available.
 */
function seedInstanceForNewSoldOutEvent (event) {
  if (getAvailableInstanceDateTimes(event).length > 0) {
    return null
  }

  if (event.firstInstanceDateTime) {
    return event.firstInstanceDateTime
  }

  return null
}

/**
 * Reconciles existing TSV rows against the live Spektrix feed without deleting rows.
 *
 * Classification rules:
 * - event absent from feed → cancelled (prefix title, keep row)
 * - event present but instance not buyable → sold out (keep row, Is Sold Out=true)
 * - existing row already marked CANCELLED stays cancelled even if the event remains
 *   in the feed (manual single-performance cancellation); reinstate only if buyable again
 * - buyable instance not in TSV → add
 * - buyable instance present with different metadata → change metadata
 * - previously cancelled/sold-out instance back on sale → reinstated
 *
 * @param {string[][]} existingRows Current TSV data rows.
 * @param {Array<object>} feedEvents Raw Spektrix event list.
 * @returns {{ rows: string[][], changes: Array<{ changeType: string, venue: string, date: string, start: string, name: string }> }}
 */
function reconcile (existingRows, feedEvents) {
  const { eventsById, buyableByKey } = indexFeed(feedEvents)
  const changes = []
  const nextRows = []
  const seenKeys = new Set()

  for (const existingRow of existingRows) {
    const key = rowPerformanceKey(existingRow)
    const eventId = extractEventIdFromUrl(existingRow[COL.Event])
    const { cancelled: wasCancelled, baseTitle } = stripCancelledPrefix(existingRow[COL.Title])
    const wasSoldOut = existingRow[COL.IsSoldOut] === 'true'

    if (!key || !eventId) {
      nextRows.push(cloneRow(existingRow))
      continue
    }

    seenKeys.add(key)
    const feedEvent = eventsById.get(eventId)

    if (!feedEvent) {
      const next = cloneRow(existingRow)
      next[COL.Title] = applyCancelledPrefix(baseTitle || existingRow[COL.Title])

      if (!wasCancelled) {
        changes.push(changeFromRow('cancelled', next))
      }

      nextRows.push(next)
      continue
    }

    const buyable = buyableByKey.get(key)

    if (!buyable) {
      const next = cloneRow(existingRow)
      // Preserve a manual CANCELLED prefix (single-performance cancellations).
      // Otherwise treat a vanished buyable slot as sold out.
      if (wasCancelled) {
        next[COL.Title] = applyCancelledPrefix(baseTitle)
        next[COL.IsOnSale] = String(Boolean(feedEvent.isOnSale))
        nextRows.push(next)
        continue
      }

      next[COL.Title] = baseTitle
      next[COL.IsSoldOut] = 'true'
      next[COL.IsOnSale] = String(Boolean(feedEvent.isOnSale))

      if (!wasSoldOut) {
        changes.push(changeFromRow('sold out', next))
      }

      nextRows.push(next)
      continue
    }

    const feedRow = toRecord(buyable.event, buyable.instanceDateTime, { soldOut: false })
    let next = applyFeedMetadata(existingRow, feedRow)
    next[COL.Date] = existingRow[COL.Date]
    next[COL.Start] = existingRow[COL.Start]
    next[COL.IsSoldOut] = 'false'

    if (wasCancelled || wasSoldOut) {
      changes.push(changeFromRow('reinstated', next))
    } else if (metadataChanged(existingRow, feedRow)) {
      changes.push(changeFromRow('change metadata', next))
    }

    nextRows.push(next)
  }

  for (const [key, buyable] of buyableByKey.entries()) {
    if (seenKeys.has(key)) {
      continue
    }

    const row = toRecord(buyable.event, buyable.instanceDateTime, { soldOut: false })
    changes.push(changeFromRow('add', row))
    nextRows.push(row)
    seenKeys.add(key)
  }

  for (const [eventId, event] of eventsById.entries()) {
    const alreadyKnown = nextRows.some(row => extractEventIdFromUrl(row[COL.Event]) === eventId)
    if (alreadyKnown) {
      continue
    }

    const seed = seedInstanceForNewSoldOutEvent(event)
    if (!seed) {
      continue
    }

    const key = performanceKeyFromInstance(eventId, seed)
    if (seenKeys.has(key)) {
      continue
    }

    const row = toRecord(event, seed, { soldOut: true })
    changes.push(changeFromRow('add', row))
    nextRows.push(row)
    seenKeys.add(key)
  }

  nextRows.sort(compareRows)

  return { rows: nextRows, changes }
}

/**
 * Appends change-log lines and mirrors them to stdout.
 *
 * @param {Array<{ changeType: string, venue: string, date: string, start: string, name: string }>} changes Change entries.
 * @param {string} logPath Destination log file path.
 * @returns {Promise<string[]>} Written log lines (empty when there were no changes).
 */
async function appendChangeLog (changes, logPath = CHANGE_LOG_PATH) {
  if (changes.length === 0) {
    console.log('No changes')
    return []
  }

  const lines = formatChangeLogLines(changes)
  const payload = `${lines.join('\n')}\n`

  await fs.appendFile(logPath, payload, 'utf8')

  for (const line of lines) {
    console.log(line)
  }

  return lines
}

/**
 * Writes the reconciled TSV document.
 *
 * @param {string[][]} records Data rows.
 * @param {string} [outputPath] Destination path.
 * @returns {Promise<void>}
 */
async function writeTsv (records, outputPath = OUTPUT_PATH) {
  await fs.writeFile(outputPath, serializeTsv(records), 'utf8')
}

/**
 * Reads existing TSV rows, returning an empty list when the file is missing.
 *
 * @param {string} [tsvPath] Path to `boxoffice-events.tsv`.
 * @returns {Promise<string[][]>} Existing data rows.
 */
async function readExistingRows (tsvPath = OUTPUT_PATH) {
  try {
    const text = await fs.readFile(tsvPath, 'utf8')
    return parseTsv(text)
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }
}

/**
 * Downloads Spektrix events, reconciles them into the local TSV, and appends a change log.
 *
 * @returns {Promise<void>}
 */
async function main () {
  const events = fetchEvents()
  const existingRows = await readExistingRows()
  const { rows, changes } = reconcile(existingRows, events)

  if (rows.length === 0) {
    throw new Error(`No rows generated for website listing "${WEBSITE_LISTING}"`)
  }

  await writeTsv(rows)
  await appendChangeLog(changes)

  console.log(`Fetched ${events.length} events from Spektrix`)
  console.log(`Wrote ${rows.length} TSV rows to ${OUTPUT_PATH}`)
  console.log(`Recorded ${changes.length} change(s) in ${CHANGE_LOG_PATH}`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}

module.exports = {
  HEADER,
  CANCELLED_PREFIX,
  CHANGE_LOG_PATH,
  OUTPUT_PATH,
  COL,
  parseTsv,
  serializeTsv,
  formatChangeLogLines,
  reconcile,
  toRecord,
  stripCancelledPrefix,
  applyCancelledPrefix,
  performanceKey,
  extractEventIdFromUrl,
  getNumericEventId,
  getAvailableInstanceDateTimes,
  compareRows
}
