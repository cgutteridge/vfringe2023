/**
 * Ventnor Fringe mobile programme app (/m) — Milestone 2.
 *
 * @package ChrisVF
 */
(function () {
  'use strict'

  var config = window.chrisvfMobileConfig || {}
  var root = document.getElementById('chrisvf-mobile-root')
  if (!root) {
    return
  }

  var state = {
    data: null,
    eventsByDay: {},
    selectedDay: null
  }

  /**
   * Parse compact ISO datetime (20260718T193000).
   *
   * @param {string} iso Compact datetime string.
   * @returns {Date|null}
   */
  function parseCompactIso (iso) {
    if (!iso || iso.length < 15) {
      return null
    }
    return new Date(
      parseInt(iso.substr(0, 4), 10),
      parseInt(iso.substr(4, 2), 10) - 1,
      parseInt(iso.substr(6, 2), 10),
      parseInt(iso.substr(9, 2), 10),
      parseInt(iso.substr(11, 2), 10),
      parseInt(iso.substr(13, 2), 10) || 0
    )
  }

  /**
   * Format compact ISO to display time (e.g. 7:30pm).
   *
   * @param {string} iso Compact datetime string.
   * @returns {string}
   */
  function formatTime (iso) {
    var dt = parseCompactIso(iso)
    if (!dt) {
      return ''
    }
    var h = dt.getHours()
    var min = dt.getMinutes()
    var ampm = h >= 12 ? 'pm' : 'am'
    if (h >= 13) {
      h -= 12
    }
    if (h === 0) {
      h = 12
    }
    return h + (min === 0 ? '' : ':' + String(min).padStart(2, '0')) + ampm
  }

  /**
   * Festival day window start/end timestamps for a Y-m-d day key.
   *
   * @param {string} dayKey Date in Y-m-d form.
   * @returns {{start: number, end: number}}
   */
  function getDayWindow (dayKey) {
    var parts = dayKey.split('-')
    var y = parseInt(parts[0], 10)
    var m = parseInt(parts[1], 10) - 1
    var d = parseInt(parts[2], 10)
    var start = new Date(y, m, d, 8, 0, 0).getTime()
    var endDate = new Date(y, m, d + 1, 2, 0, 0)
    return { start: start, end: endDate.getTime() }
  }

  /**
   * Assign an event to a festival day key using the 08:00–02:00 window.
   *
   * @param {object} event Normalized event record.
   * @param {string[]} festivalDays Ordered festival day keys.
   * @returns {string|null}
   */
  function eventFestivalDay (event, festivalDays) {
    var startDt = parseCompactIso(event.start)
    if (!startDt) {
      return null
    }
    var startT = startDt.getTime()
    for (var i = 0; i < festivalDays.length; i++) {
      var window = getDayWindow(festivalDays[i])
      if (startT >= window.start && startT <= window.end) {
        return festivalDays[i]
      }
    }
    return null
  }

  /**
   * Build day index from fetched payload.
   *
   * @param {object} data JSON payload.
   */
  function buildIndexes (data) {
    state.eventsByDay = {}
    data.festivalDays.forEach(function (day) {
      state.eventsByDay[day] = []
    })
    data.events.forEach(function (event) {
      var day = eventFestivalDay(event, data.festivalDays)
      if (day && state.eventsByDay[day]) {
        state.eventsByDay[day].push(event)
      }
    })
    Object.keys(state.eventsByDay).forEach(function (day) {
      state.eventsByDay[day].sort(function (a, b) {
        return a.start < b.start ? -1 : a.start > b.start ? 1 : 0
      })
    })
  }

  /**
   * Pick default festival day: today if in range, else first day.
   *
   * @param {string[]} festivalDays Festival day keys.
   * @returns {string|null}
   */
  function defaultDay (festivalDays) {
    if (!festivalDays.length) {
      return null
    }
    var today = new Date()
    var todayKey = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0')
    if (festivalDays.indexOf(todayKey) !== -1) {
      return todayKey
    }
    return festivalDays[0]
  }

  /**
   * Short day label for picker (e.g. Fri 17).
   *
   * @param {string} dayKey Y-m-d date.
   * @returns {string}
   */
  function dayLabel (dayKey) {
    var parts = dayKey.split('-')
    var dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days[dt.getDay()] + ' ' + parseInt(parts[2], 10)
  }

  /**
   * Escape HTML for safe text insertion.
   *
   * @param {string} str Raw string.
   * @returns {string}
   */
  function escapeHtml (str) {
    var div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  /**
   * Render the programme list for the selected day.
   */
  function render () {
    var events = state.eventsByDay[state.selectedDay] || []
    var html = ''

    html += '<header class="chrisvf-mobile-header">'
    html += '<h1 class="chrisvf-mobile-title">Ventnor Fringe</h1>'
    html += '<nav class="chrisvf-mobile-days" aria-label="Festival days">'
    state.data.festivalDays.forEach(function (day) {
      html += '<button type="button" class="chrisvf-mobile-day' +
        (day === state.selectedDay ? ' is-active' : '') +
        '" data-day="' + day + '" aria-pressed="' +
        (day === state.selectedDay ? 'true' : 'false') + '">' +
        dayLabel(day) + '</button>'
    })
    html += '</nav></header>'

    html += '<main class="chrisvf-mobile-main">'
    if (events.length === 0) {
      html += '<p class="chrisvf-mobile-empty">No events on this day.</p>'
    } else {
      html += '<ul class="chrisvf-mobile-list">'
      events.forEach(function (event) {
        html += '<li class="chrisvf-mobile-event">'
        html += '<span class="chrisvf-mobile-event-time">' + formatTime(event.start) + '</span>'
        html += '<div class="chrisvf-mobile-event-body">'
        html += '<div class="chrisvf-mobile-event-title">' + escapeHtml(event.summary) + '</div>'
        html += '<div class="chrisvf-mobile-event-meta">'
        html += escapeHtml(event.location)
        if (event.categories) {
          html += ' · ' + escapeHtml(event.categories)
        }
        if (event.free) {
          html += ' <span class="chrisvf-mobile-badge chrisvf-mobile-badge-free">FREE</span>'
        }
        html += '</div></div></li>'
      })
      html += '</ul>'
    }
    html += '</main>'

    root.innerHTML = html

    root.querySelectorAll('[data-day]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedDay = btn.getAttribute('data-day')
        render()
      })
    })
  }

  /**
   * Boot the application.
   */
  function boot () {
    root.innerHTML = '<p class="chrisvf-mobile-loading">Loading programme…</p>'

    fetch(config.jsonUrl || '/m/json')
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Failed to load programme data')
        }
        return res.json()
      })
      .then(function (data) {
        state.data = data
        buildIndexes(data)
        state.selectedDay = defaultDay(data.festivalDays)
        render()
      })
      .catch(function (err) {
        root.innerHTML = '<p class="chrisvf-mobile-error">Could not load programme. ' +
          escapeHtml(err.message) + '</p>'
      })
  }

  boot()
})()
