/**
 * Ventnor Fringe mobile programme app (/m).
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

  var STORAGE_TEXT = 'chrisvf_mobile_text_size'
  var STORAGE_SESSION = 'chrisvf_mobile_session'

  var state = {
    data: null,
    eventsByDay: {},
    selectedDay: null,
    search: '',
    filter: 'all',
    expandedUid: null,
    textSize: 'normal'
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
   * Current time as compact ISO in BST (matches grid.js behaviour).
   *
   * @returns {string}
   */
  function getCurrentBstCompact () {
    var now = new Date()
    var utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
    var bstTime = new Date(utcTime + (3600000))
    var y = bstTime.getUTCFullYear()
    var m = String(bstTime.getUTCMonth() + 1).padStart(2, '0')
    var d = String(bstTime.getUTCDate()).padStart(2, '0')
    var h = String(bstTime.getUTCHours()).padStart(2, '0')
    var min = String(bstTime.getUTCMinutes()).padStart(2, '0')
    var sec = String(bstTime.getUTCSeconds()).padStart(2, '0')
    return '' + y + m + d + 'T' + h + min + sec
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
   * Events for the current view after filters applied.
   *
   * @returns {object[]}
   */
  function visibleEvents () {
    var events = state.eventsByDay[state.selectedDay] || []
    var q = state.search.trim().toLowerCase()
    return events.filter(function (event) {
      if (state.filter === 'free' && !event.free) {
        return false
      }
      if (!q) {
        return true
      }
      var haystack = [
        event.summary,
        event.location,
        event.categories,
        event.description
      ].join(' ').toLowerCase()
      return haystack.indexOf(q) !== -1
    })
  }

  /**
   * Badge state for now / up next during festival.
   *
   * @param {object} event Event record.
   * @returns {string|null}
   */
  function liveBadge (event) {
    var now = getCurrentBstCompact()
    var end = event.end || event.start
    if (event.start <= now && end > now) {
      return 'now'
    }
    var nowDt = parseCompactIso(now)
    var startDt = parseCompactIso(event.start)
    if (!nowDt || !startDt) {
      return null
    }
    var diffMs = startDt.getTime() - nowDt.getTime()
    if (diffMs > 0 && diffMs <= 90 * 60 * 1000) {
      return 'next'
    }
    return null
  }

  /**
   * Persist session UI state.
   */
  function saveSession () {
    try {
      sessionStorage.setItem(STORAGE_SESSION, JSON.stringify({
        selectedDay: state.selectedDay,
        search: state.search,
        filter: state.filter
      }))
    } catch (e) { /* ignore */ }
  }

  /**
   * Restore session UI state.
   */
  function loadSession () {
    try {
      var raw = sessionStorage.getItem(STORAGE_SESSION)
      if (!raw) {
        return
      }
      var saved = JSON.parse(raw)
      if (saved.selectedDay && state.data.festivalDays.indexOf(saved.selectedDay) !== -1) {
        state.selectedDay = saved.selectedDay
      }
      if (typeof saved.search === 'string') {
        state.search = saved.search
      }
      if (saved.filter === 'all' || saved.filter === 'free') {
        state.filter = saved.filter
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Load text size preference from localStorage.
   */
  function loadTextSize () {
    try {
      var size = localStorage.getItem(STORAGE_TEXT)
      if (size === 'large' || size === 'xlarge' || size === 'normal') {
        state.textSize = size
      }
    } catch (e) { /* ignore */ }
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
   * Bind UI event handlers after render.
   */
  function bindEvents () {
    root.querySelectorAll('[data-day]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedDay = btn.getAttribute('data-day')
        state.expandedUid = null
        saveSession()
        render()
      })
    })

    root.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.getAttribute('data-filter')
        saveSession()
        render()
      })
    })

    root.querySelectorAll('[data-text-size]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.textSize = btn.getAttribute('data-text-size')
        try {
          localStorage.setItem(STORAGE_TEXT, state.textSize)
        } catch (e) { /* ignore */ }
        render()
      })
    })

    var searchInput = root.querySelector('.chrisvf-mobile-search')
    if (searchInput) {
      var debounceTimer = null
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(function () {
          state.search = searchInput.value
          saveSession()
          render()
          var newInput = root.querySelector('.chrisvf-mobile-search')
          if (newInput) {
            newInput.focus()
            newInput.selectionStart = newInput.selectionEnd = newInput.value.length
          }
        }, 150)
      })
    }

    root.querySelectorAll('.chrisvf-mobile-expand').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var li = btn.closest('.chrisvf-mobile-event')
        var uid = li.getAttribute('data-event-uid')
        state.expandedUid = state.expandedUid === uid ? null : uid
        render()
      })
    })
  }

  /**
   * Render the programme list for the selected day.
   */
  function render () {
    root.className = 'chrisvf-mobile-root chrisvf-mobile-text-' + state.textSize
    var events = visibleEvents()
    var html = ''

    html += '<header class="chrisvf-mobile-header">'
    html += '<h1 class="chrisvf-mobile-title">Ventnor Fringe</h1>'

    html += '<div class="chrisvf-mobile-controls">'
    html += '<label class="chrisvf-mobile-search-label">'
    html += '<span class="screen-reader-text">Search events</span>'
    html += '<input type="search" class="chrisvf-mobile-search" placeholder="Search…" value="' +
      escapeHtml(state.search) + '" autocomplete="off" enterkeyhint="search">'
    html += '</label>'

    html += '<div class="chrisvf-mobile-filters" role="group" aria-label="Quick filters">'
    html += '<button type="button" class="chrisvf-mobile-filter' +
      (state.filter === 'all' ? ' is-active' : '') +
      '" data-filter="all" aria-pressed="' + (state.filter === 'all' ? 'true' : 'false') +
      '">All</button>'
    html += '<button type="button" class="chrisvf-mobile-filter' +
      (state.filter === 'free' ? ' is-active' : '') +
      '" data-filter="free" aria-pressed="' + (state.filter === 'free' ? 'true' : 'false') +
      '">Free</button>'
    html += '</div>'

    html += '<div class="chrisvf-mobile-text-controls" role="group" aria-label="Text size">'
    ;['normal', 'large', 'xlarge'].forEach(function (size) {
      var labels = { normal: 'A', large: 'A+', xlarge: 'A++' }
      html += '<button type="button" class="chrisvf-mobile-text-btn' +
        (state.textSize === size ? ' is-active' : '') +
        '" data-text-size="' + size + '" aria-pressed="' +
        (state.textSize === size ? 'true' : 'false') + '" aria-label="Text size ' +
        labels[size] + '">' + labels[size] + '</button>'
    })
    html += '</div></div>'

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
      html += '<p class="chrisvf-mobile-empty">No events match your filters.</p>'
    } else {
      html += '<ul class="chrisvf-mobile-list">'
      events.forEach(function (event) {
        var badge = liveBadge(event)
        var expanded = state.expandedUid === event.uid
        html += '<li class="chrisvf-mobile-event' + (expanded ? ' is-expanded' : '') +
          '" data-event-uid="' + escapeHtml(event.uid) + '">'
        html += '<div class="chrisvf-mobile-event-row">'
        html += '<span class="chrisvf-mobile-event-time">' + formatTime(event.start) + '</span>'
        html += '<div class="chrisvf-mobile-event-body">'
        html += '<div class="chrisvf-mobile-event-title-row">'
        html += '<span class="chrisvf-mobile-event-title">' + escapeHtml(event.summary) + '</span>'
        if (badge === 'now') {
          html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-now">Now</span>'
        } else if (badge === 'next') {
          html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-next">Up next</span>'
        }
        if (event.free) {
          html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-free">FREE</span>'
        }
        html += '</div>'
        html += '<div class="chrisvf-mobile-event-meta">'
        html += escapeHtml(event.location)
        if (event.categories) {
          html += ' · ' + escapeHtml(event.categories)
        }
        html += '</div></div>'
        html += '<button type="button" class="chrisvf-mobile-expand" aria-expanded="' +
          (expanded ? 'true' : 'false') + '" aria-label="' +
          (expanded ? 'Collapse' : 'Expand') + ' details for ' + escapeHtml(event.summary) +
          '">' + (expanded ? '▾' : '▸') + '</button>'
        html += '</div>'

        if (expanded) {
          html += '<div class="chrisvf-mobile-event-detail">'
          if (event.description) {
            var desc = event.description.length > 400
              ? event.description.substr(0, 400) + '…'
              : event.description
            html += '<p class="chrisvf-mobile-event-desc">' + escapeHtml(desc) + '</p>'
          }
          html += '<div class="chrisvf-mobile-event-actions">'
          if (event.ticketUrl) {
            html += '<a class="chrisvf-mobile-btn chrisvf-mobile-btn-ticket" href="' +
              escapeHtml(event.ticketUrl) + '" target="_blank" rel="noopener">Tickets</a>'
          }
          if (event.siteUrl) {
            html += '<a class="chrisvf-mobile-btn chrisvf-mobile-btn-site" href="' +
              escapeHtml(event.siteUrl) + '">Event page</a>'
          }
          html += '</div></div>'
        }
        html += '</li>'
      })
      html += '</ul>'
    }
    html += '</main>'

    html += '<footer class="chrisvf-mobile-footer">'
    html += '<a href="' + escapeHtml(config.plannerUrl || '/vfringe/planner') + '">Festival planner</a>'
    html += ' · '
    html += '<a href="' + escapeHtml(config.fullMapUrl || '/vfringe/map') + '">Festival map</a>'
    html += '</footer>'

    root.innerHTML = html
    bindEvents()
  }

  /**
   * Boot the application.
   */
  function boot () {
    root.innerHTML = '<p class="chrisvf-mobile-loading">Loading programme…</p>'
    loadTextSize()

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
        loadSession()
        if (!state.selectedDay) {
          state.selectedDay = defaultDay(data.festivalDays)
        }
        render()
        setInterval(function () {
          render()
        }, 60000)
      })
      .catch(function (err) {
        root.innerHTML = '<p class="chrisvf-mobile-error">Could not load programme. ' +
          escapeHtml(err.message) + '</p>'
      })
  }

  boot()
})()
