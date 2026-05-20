const { execFileSync } = require('child_process')
const cheerio = require('cheerio')
const fs = require('fs/promises')
const path = require('path')

const SOURCE_URL = 'https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json'
const OUTPUT_PATH = path.join(__dirname, '../boxoffice-events.tsv')
const WEBSITE_LISTING = 'VFringe'
const HEADER = ['Venue', 'Date', 'Start', 'End', 'Title', 'Event', 'Tags', 'Event Type', 'Is On Sale', 'Is Sold Out', 'Description']

function fetchEvents () {
  const raw = execFileSync('curl', ['-s', '-L', SOURCE_URL], { encoding: 'utf8' })
  const parsed = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('Expected eventsView.json to return an array')
  }

  return parsed
}

function sanitizeField (value) {
  return String(value ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlToText (html) {
  const $ = cheerio.load(html || '')
  $('br').replaceWith('\n')
  return $.root().text().replace(/\r/g, '\n')
}

function extractVenue (htmlDescription) {
  const text = htmlToText(htmlDescription)
  const match = text.match(/Venue:\s*([\s\S]*?)(?:\n\s*\n|\n(?:Tickets:|Age Rating:|Duration:|Accessibility:|Wheelchair Spaces:)|$)/i)
  return sanitizeField(match ? match[1] : '')
}

function getInstanceDateTimes (event) {
  if (Array.isArray(event.availableInstanceDates) && event.availableInstanceDates.length > 0) {
    return event.availableInstanceDates
  }

  if (event.firstInstanceDateTime) {
    return [event.firstInstanceDateTime]
  }

  return []
}

function parseLocalDateTime (value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)

  if (!match) {
    return null
  }

  const [, year, month, day, hour, minute] = match
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))
}

function formatDate (value) {
  return String(value).split('T')[0] || ''
}

function formatTime (value) {
  const match = String(value).match(/T(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

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

function toRecord (event, instanceDateTime) {
  return [
    extractVenue(event.htmlDescription),
    formatDate(instanceDateTime),
    formatTime(instanceDateTime),
    formatEndTime(instanceDateTime, event.duration),
    sanitizeField(event.name),
    sanitizeField(event.id),
    '',
    sanitizeField(event.attribute_EventType),
    String(Boolean(event.isOnSale)),
    String(Boolean(event.isSoldOut)),
    sanitizeField(event.description)
  ]
}

function buildRecords (events) {
  const filteredEvents = events.filter(event => event.attribute_WebsiteListing === WEBSITE_LISTING)
  const records = []

  for (const event of filteredEvents) {
    for (const instanceDateTime of getInstanceDateTimes(event)) {
      records.push({
        sortKey: instanceDateTime,
        row: toRecord(event, instanceDateTime)
      })
    }
  }

  records.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  return records.map(record => record.row)
}

async function writeTsv (records) {
  const lines = [HEADER, ...records].map(row => row.join('\t'))
  await fs.writeFile(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
}

async function main () {
  const events = fetchEvents()
  const records = buildRecords(events)

  if (records.length === 0) {
    throw new Error(`No rows generated for website listing "${WEBSITE_LISTING}"`)
  }

  await writeTsv(records)

  console.log(`Fetched ${events.length} events from Spektrix`)
  console.log(`Wrote ${records.length} TSV rows to ${OUTPUT_PATH}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
