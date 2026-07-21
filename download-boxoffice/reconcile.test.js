const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  HEADER,
  CANCELLED_PREFIX,
  COL,
  parseTsv,
  serializeTsv,
  formatChangeLogLines,
  reconcile,
  stripCancelledPrefix,
  applyCancelledPrefix
} = require('./download.js')

/**
 * Builds a minimal Spektrix event for reconcile fixtures.
 *
 * @param {object} overrides Field overrides.
 * @returns {object} Spektrix-shaped event.
 */
function makeEvent (overrides = {}) {
  const id = overrides.id || '10001'
  const name = overrides.name || 'Test Show'
  const venue = overrides.venue || 'Test Venue'
  const htmlDescription = overrides.htmlDescription ||
    `<div>Venue: ${venue}<br/><br/>Tickets: online</div>`

  return {
    id,
    name,
    description: overrides.description || 'A description',
    htmlDescription,
    duration: overrides.duration ?? 60,
    isOnSale: overrides.isOnSale !== undefined ? overrides.isOnSale : true,
    isSoldOut: overrides.isSoldOut !== undefined ? overrides.isSoldOut : false,
    attribute_WebsiteListing: overrides.attribute_WebsiteListing || 'VFringe',
    attribute_EventType: overrides.attribute_EventType || 'Comedy & Cabaret',
    availableInstanceDates: overrides.availableInstanceDates || [],
    firstInstanceDateTime: overrides.firstInstanceDateTime,
    ...overrides
  }
}

/**
 * Builds a TSV row array matching HEADER order.
 *
 * @param {object} fields Named cell overrides.
 * @returns {string[]} TSV row.
 */
function makeRow (fields = {}) {
  return [
    fields.venue || 'Test Venue',
    fields.date || '2026-07-18',
    fields.start || '19:00',
    fields.end || '20:00',
    fields.title || 'Test Show',
    fields.event || 'https://purchase.vfringe.co.uk/EventAvailability?EventId=10001',
    fields.tags || '',
    fields.eventType || 'Comedy & Cabaret',
    fields.isOnSale !== undefined ? String(fields.isOnSale) : 'true',
    fields.isSoldOut !== undefined ? String(fields.isSoldOut) : 'false',
    fields.description || 'A description'
  ]
}

/**
 * Collects change types in order for a reconcile result.
 *
 * @param {{ changes: Array<{ changeType: string }> }} result Reconcile result.
 * @returns {string[]} Change type labels.
 */
function changeTypes (result) {
  return result.changes.map(change => change.changeType)
}

describe('stripCancelledPrefix / applyCancelledPrefix', () => {
  it('applies the cancelled prefix idempotently', () => {
    assert.equal(applyCancelledPrefix('Foo'), `${CANCELLED_PREFIX}Foo`)
    assert.equal(applyCancelledPrefix(`${CANCELLED_PREFIX}Foo`), `${CANCELLED_PREFIX}Foo`)
  })

  it('strips a cancelled prefix', () => {
    assert.deepEqual(stripCancelledPrefix(`${CANCELLED_PREFIX}Foo`), {
      cancelled: true,
      baseTitle: 'Foo'
    })
  })
})

describe('parseTsv / serializeTsv', () => {
  it('round-trips rows with a stable header-first order', () => {
    const rows = [
      makeRow({ date: '2026-07-19', start: '20:00', title: 'Later' }),
      makeRow({ date: '2026-07-18', start: '19:00', title: 'Earlier' })
    ]
    const text = serializeTsv(rows)
    const lines = text.trimEnd().split('\n')

    assert.equal(lines[0], HEADER.join('\t'))
    assert.match(lines[1], /^Test Venue\t2026-07-18\t19:00/)
    assert.deepEqual(parseTsv(text), [
      makeRow({ date: '2026-07-18', start: '19:00', title: 'Earlier' }),
      makeRow({ date: '2026-07-19', start: '20:00', title: 'Later' })
    ])
  })
})

describe('formatChangeLogLines', () => {
  it('formats timestamped tab-separated change lines', () => {
    const lines = formatChangeLogLines([
      {
        changeType: 'sold out',
        venue: 'Ingrams Yard',
        date: '2026-07-17',
        start: '19:00',
        name: 'Pierre Novellie: Work In Progress'
      }
    ], new Date('2026-07-14T17:00:00.000Z'))

    assert.deepEqual(lines, [
      '2026-07-14T17:00:00.000Z\tsold out\tIngrams Yard\t2026-07-17\t19:00\tPierre Novellie: Work In Progress'
    ])
  })
})

describe('reconcile', () => {
  it('adds a new buyable performance', () => {
    const feed = [
      makeEvent({
        id: '10001',
        availableInstanceDates: ['2026-07-18T19:00:00']
      })
    ]
    const result = reconcile([], feed)

    assert.equal(result.rows.length, 1)
    assert.deepEqual(changeTypes(result), ['add'])
    assert.equal(result.rows[0][COL.Title], 'Test Show')
    assert.equal(result.rows[0][COL.IsSoldOut], 'false')
  })

  it('marks a single disappeared performance as sold out and keeps the row', () => {
    const existing = [
      makeRow({ date: '2026-07-18', start: '19:00' }),
      makeRow({ date: '2026-07-19', start: '19:00', end: '20:00' })
    ]
    const feed = [
      makeEvent({
        id: '10001',
        availableInstanceDates: ['2026-07-19T19:00:00']
      })
    ]
    const result = reconcile(existing, feed, { runStartedAt: '2026-07-18T18:00:00' })

    assert.equal(result.rows.length, 2)
    assert.deepEqual(changeTypes(result), ['sold out'])

    const soldOut = result.rows.find(row => row[COL.Date] === '2026-07-18')
    const stillOn = result.rows.find(row => row[COL.Date] === '2026-07-19')

    assert.equal(soldOut[COL.IsSoldOut], 'true')
    assert.equal(stillOn[COL.IsSoldOut], 'false')
  })

  it('marks every retained row sold out when the whole show is sold out in the feed', () => {
    const existing = [
      makeRow({
        title: 'Pierre Novellie: Work In Progress',
        date: '2026-07-17',
        start: '19:00',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=54401',
        venue: 'Ingrams Yard'
      })
    ]
    const feed = [
      makeEvent({
        id: '54401',
        name: 'Pierre Novellie: Work In Progress',
        venue: 'Ingrams Yard',
        isSoldOut: true,
        availableInstanceDates: [],
        firstInstanceDateTime: '2026-07-17T19:00:00'
      })
    ]
    const result = reconcile(existing, feed, { runStartedAt: '2026-07-17T18:00:00' })

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0][COL.IsSoldOut], 'true')
    assert.equal(result.rows[0][COL.Title], 'Pierre Novellie: Work In Progress')
    assert.deepEqual(changeTypes(result), ['sold out'])
  })

  it('prefixes cancelled titles when the whole event leaves the feed', () => {
    const existing = [
      makeRow({
        title: 'Lawrence Dodd: This Can\'t Be It',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=40201',
        venue: 'Bijou',
        date: '2026-07-18',
        start: '18:15'
      })
    ]
    const result = reconcile(existing, [], { runStartedAt: '2026-07-18T17:00:00' })

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0][COL.Title], `${CANCELLED_PREFIX}Lawrence Dodd: This Can't Be It`)
    assert.deepEqual(changeTypes(result), ['cancelled'])
  })

  it('does not re-log cancelled on an idempotent rerun', () => {
    const existing = [
      makeRow({
        title: `${CANCELLED_PREFIX}Lawrence Dodd: This Can't Be It`,
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=40201',
        venue: 'Bijou',
        date: '2026-07-18',
        start: '18:15'
      })
    ]
    const result = reconcile(existing, [])

    assert.equal(result.rows[0][COL.Title], `${CANCELLED_PREFIX}Lawrence Dodd: This Can't Be It`)
    assert.deepEqual(changeTypes(result), [])
  })

  it('updates changed metadata in place', () => {
    const existing = [
      makeRow({
        description: 'Old description',
        venue: 'Old Venue'
      })
    ]
    const feed = [
      makeEvent({
        id: '10001',
        venue: 'New Venue',
        description: 'New description',
        availableInstanceDates: ['2026-07-18T19:00:00']
      })
    ]
    const result = reconcile(existing, feed, { runStartedAt: '2026-07-21T20:00:00' })

    assert.equal(result.rows[0][COL.Venue], 'New Venue')
    assert.equal(result.rows[0][COL.Description], 'New description')
    assert.deepEqual(changeTypes(result), ['change metadata'])
  })

  it('treats a reschedule as sold out plus add', () => {
    const existing = [
      makeRow({
        date: '2026-07-21',
        start: '21:30',
        end: '22:30',
        title: 'Ahir Shah: Golden (Work in Progress)',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=47801',
        venue: 'Bosco Theatre'
      })
    ]
    const feed = [
      makeEvent({
        id: '47801',
        name: 'Ahir Shah: Golden (Work in Progress)',
        venue: 'Ingrams Yard',
        availableInstanceDates: ['2026-07-25T19:00:00']
      })
    ]
    const result = reconcile(existing, feed, { runStartedAt: '2026-07-21T17:00:00' })

    assert.equal(result.rows.length, 2)
    assert.deepEqual(changeTypes(result).sort(), ['add', 'sold out'])

    const oldSlot = result.rows.find(row => row[COL.Date] === '2026-07-21')
    const newSlot = result.rows.find(row => row[COL.Date] === '2026-07-25')

    assert.equal(oldSlot[COL.IsSoldOut], 'true')
    assert.equal(newSlot[COL.IsSoldOut], 'false')
    assert.equal(newSlot[COL.Venue], 'Ingrams Yard')
  })

  it('reinstates a sold-out performance that returns to sale', () => {
    const existing = [
      makeRow({
        isSoldOut: true,
        date: '2026-07-18',
        start: '19:00'
      })
    ]
    const feed = [
      makeEvent({
        id: '10001',
        availableInstanceDates: ['2026-07-18T19:00:00']
      })
    ]
    const result = reconcile(existing, feed)

    assert.equal(result.rows[0][COL.IsSoldOut], 'false')
    assert.deepEqual(changeTypes(result), ['reinstated'])
  })

  it('reinstates a cancelled show that returns to the feed', () => {
    const existing = [
      makeRow({
        title: `${CANCELLED_PREFIX}Test Show`,
        date: '2026-07-18',
        start: '19:00'
      })
    ]
    const feed = [
      makeEvent({
        id: '10001',
        availableInstanceDates: ['2026-07-18T19:00:00']
      })
    ]
    const result = reconcile(existing, feed)

    assert.equal(result.rows[0][COL.Title], 'Test Show')
    assert.equal(result.rows[0][COL.IsSoldOut], 'false')
    assert.deepEqual(changeTypes(result), ['reinstated'])
  })

  it('is idempotent when the feed matches the reconciled TSV', () => {
    const feed = [
      makeEvent({
        id: '10001',
        availableInstanceDates: ['2026-07-18T19:00:00', '2026-07-19T19:00:00']
      })
    ]
    const first = reconcile([], feed)
    const second = reconcile(first.rows, feed)

    assert.deepEqual(changeTypes(first).sort(), ['add', 'add'])
    assert.deepEqual(changeTypes(second), [])
    assert.deepEqual(second.rows, first.rows)
  })

  it('seeds a brand-new fully sold-out show from firstInstanceDateTime', () => {
    const feed = [
      makeEvent({
        id: '54401',
        name: 'Pierre Novellie: Work In Progress',
        venue: 'Ingrams Yard',
        isSoldOut: true,
        availableInstanceDates: [],
        firstInstanceDateTime: '2026-07-17T19:00:00'
      })
    ]
    const result = reconcile([], feed)

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0][COL.IsSoldOut], 'true')
    assert.equal(result.rows[0][COL.Date], '2026-07-17')
    assert.deepEqual(changeTypes(result), ['add'])
  })

  it('preserves a manual CANCELLED prefix when the event is still live but that slot is gone', () => {
    const existing = [
      makeRow({
        title: `${CANCELLED_PREFIX}Circus Trail`,
        date: '2026-07-21',
        start: '18:00',
        end: '20:00',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=37601',
        venue: 'Ventnor Botanic Garden'
      }),
      makeRow({
        title: 'Circus Trail',
        date: '2026-07-22',
        start: '18:00',
        end: '20:00',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=37601',
        venue: 'Ventnor Botanic Garden'
      })
    ]
    const feed = [
      makeEvent({
        id: '37601',
        name: 'Circus Trail',
        venue: 'Ventnor Botanic Garden',
        duration: 120,
        availableInstanceDates: ['2026-07-22T18:00:00']
      })
    ]
    const result = reconcile(existing, feed)

    const tue = result.rows.find(row => row[COL.Date] === '2026-07-21')
    const wed = result.rows.find(row => row[COL.Date] === '2026-07-22')

    assert.equal(tue[COL.Title], `${CANCELLED_PREFIX}Circus Trail`)
    assert.equal(wed[COL.Title], 'Circus Trail')
    assert.equal(wed[COL.IsSoldOut], 'false')
    assert.deepEqual(changeTypes(result), [])
  })

  it('reinstates a cancelled performance only when it becomes buyable again', () => {
    const existing = [
      makeRow({
        title: `${CANCELLED_PREFIX}Circus Trail`,
        date: '2026-07-21',
        start: '18:00',
        end: '20:00',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=37601',
        venue: 'Ventnor Botanic Garden'
      })
    ]
    const feed = [
      makeEvent({
        id: '37601',
        name: 'Circus Trail',
        venue: 'Ventnor Botanic Garden',
        availableInstanceDates: ['2026-07-21T18:00:00']
      })
    ]
    const result = reconcile(existing, feed)

    assert.equal(result.rows[0][COL.Title], 'Circus Trail')
    assert.equal(result.rows[0][COL.IsSoldOut], 'false')
    assert.deepEqual(changeTypes(result), ['reinstated'])
  })

  it('ignores a disappeared performance when the script runs after it started', () => {
    const existing = [
      makeRow({ date: '2026-07-18', start: '19:00' }),
      makeRow({ date: '2026-07-19', start: '19:00' })
    ]
    const feed = [
      makeEvent({
        id: '10001',
        availableInstanceDates: ['2026-07-19T19:00:00']
      })
    ]
    const result = reconcile(existing, feed, { runStartedAt: '2026-07-18T19:01:00' })

    const pastSlot = result.rows.find(row => row[COL.Date] === '2026-07-18')
    const futureSlot = result.rows.find(row => row[COL.Date] === '2026-07-19')

    assert.equal(pastSlot[COL.IsSoldOut], 'false')
    assert.equal(pastSlot[COL.Title], 'Test Show')
    assert.equal(futureSlot[COL.IsSoldOut], 'false')
    assert.deepEqual(changeTypes(result), [])
  })

  it('does not mark a whole event cancelled when it disappears after performance start', () => {
    const existing = [
      makeRow({
        title: 'Late Show',
        event: 'https://purchase.vfringe.co.uk/EventAvailability?EventId=40201',
        venue: 'Bijou',
        date: '2026-07-18',
        start: '18:15'
      })
    ]
    const result = reconcile(existing, [], { runStartedAt: '2026-07-18T18:16:00' })

    assert.equal(result.rows.length, 1)
    assert.equal(result.rows[0][COL.Title], 'Late Show')
    assert.equal(result.rows[0][COL.IsSoldOut], 'false')
    assert.deepEqual(changeTypes(result), [])
  })
})
