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

  var STORAGE_TEXT = 'chrisvf_mobile_text_size_v2'
  var STORAGE_SESSION = 'chrisvf_mobile_session'
  var TEXT_SIZES = ['normal', 'large', 'xlarge']
  var mapHost = document.getElementById('chrisvf-mobile-map-host')

  var state = {
    data: null,
    eventsByDay: {},
    eventsByUid: {},
    selectedDay: null,
    search: '',
    filter: 'all',
    selectedUid: null,
    textSize: TEXT_SIZES[0],
    activeTab: 'programme',
    filtersOpen: false
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
    state.eventsByUid = {}
    data.festivalDays.forEach(function (day) {
      state.eventsByDay[day] = []
    })
    data.events.forEach(function (event) {
      state.eventsByUid[event.uid] = event
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
   * Accessible long day label for the day picker.
   *
   * @param {string} dayKey Y-m-d date.
   * @returns {string}
   */
  function dayAriaLabel (dayKey) {
    var parts = dayKey.split('-')
    var dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    var months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    return days[dt.getDay()] + ' ' + parseInt(parts[2], 10) + ' ' + months[dt.getMonth()]
  }

  /**
   * Whether an event is in the saved itinerary cookie.
   *
   * @param {string} uid Event UID.
   * @returns {boolean}
   */
  function isInItinerary (uid) {
    if (typeof vfGetItinerary !== 'function') {
      return false
    }
    return vfGetItinerary().indexOf(uid) !== -1
  }

  /**
   * Show a small mobile toast on document.body so re-renders do not wipe it.
   *
   * @param {string} msg Message text.
   */
  function showMobileToast (msg) {
    var existing = document.querySelector('.chrisvf-mobile-toast')
    if (existing) {
      existing.remove()
    }
    var toast = document.createElement('div')
    toast.className = 'chrisvf-mobile-toast'
    toast.setAttribute('role', 'status')
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(function () {
      if (toast.parentNode) {
        toast.classList.add('is-hiding')
      }
    }, 2200)
    setTimeout(function () {
      if (toast.parentNode) {
        toast.remove()
      }
    }, 2800)
  }

  /**
   * Route itinerary.js notifications through the mobile toast.
   *
   * @param {string} msg Message from vfNotify.
   */
  function handleMobileNotify (msg) {
    if (/added/i.test(msg)) {
      showMobileToast('Added. Find your itinerary in the filters.')
      return
    }
    if (/removed/i.test(msg)) {
      showMobileToast('Removed from itinerary')
      return
    }
    showMobileToast(msg)
  }

  window.chrisvfNotifyHandler = handleMobileNotify

  /**
   * Position the server-rendered map between the sticky header and footer.
   */
  function syncMapHostLayout () {
    if (!mapHost) {
      return
    }
    var header = root.querySelector('.chrisvf-mobile-header')
    var footer = root.querySelector('.chrisvf-mobile-footer')
    if (!header || !footer) {
      return
    }
    var headerBottom = header.getBoundingClientRect().bottom
    var footerTop = footer.getBoundingClientRect().top
    mapHost.style.top = Math.round(headerBottom) + 'px'
    mapHost.style.bottom = Math.round(window.innerHeight - footerTop) + 'px'
  }

  /**
   * After the map host is visible, fix Leaflet size and re-fit if init ran while hidden.
   *
   * Leaflet fitBounds during a zero-size (hidden) container leaves the map at world zoom.
   */
  function refreshVisibleMap () {
    syncMapHostLayout()
    var map = window.chrisvfMobileLeafletMap
    if (!map || typeof map.invalidateSize !== 'function') {
      return
    }
    map.invalidateSize()
    var bounds = window.chrisvfMobileLeafletBounds
    if (!bounds || typeof map.fitBounds !== 'function') {
      return
    }
    // Hidden init leaves zoom at ~0; re-fit once we have a real container size.
    if (typeof map.getZoom === 'function' && map.getZoom() < 10) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })
    }
  }

  /**
   * Show or hide the embedded festival map and refresh Leaflet size when shown.
   *
   * @param {boolean} visible Whether the map tab is active.
   */
  function setMapVisible (visible) {
    if (!mapHost) {
      return
    }
    mapHost.hidden = !visible
    mapHost.setAttribute('aria-hidden', visible ? 'false' : 'true')
    mapHost.classList.toggle('is-visible', visible)
    document.body.classList.toggle('chrisvf-mobile-map-open', visible)
    if (!visible) {
      return
    }
    syncMapHostLayout()
    setTimeout(refreshVisibleMap, 50)
    setTimeout(refreshVisibleMap, 250)
  }

  /**
   * Whether the list ignores the day picker and spans the whole festival.
   *
   * @returns {boolean}
   */
  function showingAllDays () {
    return state.search.trim().length > 0 || state.filter === 'itinerary'
  }

  /**
   * Gather every indexed event, sorted by start time.
   *
   * @returns {object[]}
   */
  function allIndexedEvents () {
    var events = []
    Object.keys(state.eventsByDay).forEach(function (day) {
      events = events.concat(state.eventsByDay[day] || [])
    })
    events.sort(function (a, b) {
      return a.start < b.start ? -1 : a.start > b.start ? 1 : 0
    })
    return events
  }

  /**
   * Events for the current view after filters applied.
   *
   * Search text and the itinerary filter both span all festival days (day picker ignored).
   *
   * @returns {object[]}
   */
  function visibleEvents () {
    var q = state.search.trim().toLowerCase()
    var events = showingAllDays()
      ? allIndexedEvents()
      : (state.eventsByDay[state.selectedDay] || [])

    return events.filter(function (event) {
      if (state.filter === 'free' && !event.free) {
        return false
      }
      if (state.filter === 'itinerary' && !isInItinerary(event.uid)) {
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
   * Festival day key for a normalized event (08:00–02:00 window).
   *
   * @param {object} event Event record.
   * @returns {string}
   */
  function eventDayKey (event) {
    if (!state.data || !state.data.festivalDays) {
      return ''
    }
    return eventFestivalDay(event, state.data.festivalDays) || ''
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
   * Label for the active quick filter.
   *
   * @returns {string}
   */
  function filterModeLabel () {
    if (state.filter === 'free') {
      return 'Free'
    }
    if (state.filter === 'itinerary') {
      return 'Itinerary'
    }
    return 'All'
  }

  /**
   * One-line summary of the active programme filters.
   *
   * @returns {string}
   */
  function filterSummaryText () {
    var scope
    if (state.search.trim()) {
      scope = '"' + state.search.trim() + '"'
    } else if (state.filter === 'itinerary') {
      scope = 'All days'
    } else {
      scope = state.selectedDay ? dayLabel(state.selectedDay) : 'Programme'
    }
    return scope + ' · ' + filterModeLabel()
  }

  /**
   * Persist session UI state.
   */
  function saveSession () {
    try {
      sessionStorage.setItem(STORAGE_SESSION, JSON.stringify({
        selectedDay: state.selectedDay,
        search: state.search,
        filter: state.filter,
        activeTab: state.activeTab
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
      if (saved.filter === 'all' || saved.filter === 'free' || saved.filter === 'itinerary') {
        state.filter = saved.filter
      }
      if (saved.activeTab === 'programme' || saved.activeTab === 'map') {
        state.activeTab = saved.activeTab
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * Step text size up or down within the available sizes.
   *
   * @param {number} delta +1 to enlarge, -1 to shrink.
   */
  function stepTextSize (delta) {
    var index = TEXT_SIZES.indexOf(state.textSize)
    if (index < 0) {
      index = 0
    }
    var next = index + delta
    if (next < 0 || next >= TEXT_SIZES.length) {
      return
    }
    state.textSize = TEXT_SIZES[next]
    try {
      localStorage.setItem(STORAGE_TEXT, state.textSize)
    } catch (e) { /* ignore */ }
    render()
  }

  /**
   * Load text size preference from localStorage.
   */
  function loadTextSize () {
    try {
      var size = localStorage.getItem(STORAGE_TEXT)
      if (TEXT_SIZES.indexOf(size) !== -1) {
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
   * Close the event detail modal if open.
   */
  function closeModal () {
    if (!state.selectedUid) {
      return
    }
    state.selectedUid = null
    render()
  }

  /**
   * Open the event detail modal for a UID.
   *
   * @param {string} uid Event UID.
   */
  function openModal (uid) {
    if (!uid || !state.eventsByUid[uid]) {
      return
    }
    state.selectedUid = uid
    if (window.chrisvfMobileLeafletMap &&
        typeof window.chrisvfMobileLeafletMap.closePopup === 'function') {
      window.chrisvfMobileLeafletMap.closePopup()
    }
    render()
  }

  /**
   * Bind map popup event links (data-chrisvf-mobile-event) to the SPA modal.
   * Uses event delegation on the server-rendered map host.
   */
  function bindMapEventHooks () {
    if (!mapHost || mapHost.getAttribute('data-chrisvf-mobile-bound') === '1') {
      return
    }
    mapHost.setAttribute('data-chrisvf-mobile-bound', '1')
    mapHost.addEventListener('click', function (e) {
      var target = e.target.closest('[data-chrisvf-mobile-event]')
      if (!target || !mapHost.contains(target)) {
        return
      }
      e.preventDefault()
      openModal(target.getAttribute('data-chrisvf-mobile-event'))
    })
  }

  /**
   * Build modal HTML for the selected event.
   *
   * @returns {string}
   */
  function renderModalHtml () {
    var event = state.eventsByUid[state.selectedUid]
    if (!event) {
      return ''
    }

    var badge = liveBadge(event)
    var saved = isInItinerary(event.uid)
    var html = ''
    html += '<div class="chrisvf-mobile-modal" role="dialog" aria-modal="true" aria-labelledby="chrisvf-mobile-modal-title">'
    html += '<div class="chrisvf-mobile-modal-panel">'
    html += '<header class="chrisvf-mobile-modal-header">'
    html += '<button type="button" class="chrisvf-mobile-modal-close" data-modal-close aria-label="Close">Close</button>'
    html += '</header>'
    html += '<div class="chrisvf-mobile-modal-body">'
    html += '<p class="chrisvf-mobile-modal-time">' + escapeHtml(formatTime(event.start))
    if (event.end && event.end !== event.start) {
      html += ' – ' + escapeHtml(formatTime(event.end))
    }
    html += '</p>'
    html += '<h2 id="chrisvf-mobile-modal-title" class="chrisvf-mobile-modal-title">' +
      escapeHtml(event.summary) + '</h2>'
    html += '<div class="chrisvf-mobile-modal-badges">'
    if (badge === 'now') {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-now">Now</span>'
    } else if (badge === 'next') {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-next">Up next</span>'
    }
    if (event.free) {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-free">FREE</span>'
    }
    if (saved) {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-saved" aria-label="In your itinerary">★ Saved</span>'
    }
    html += '</div>'
    html += '<p class="chrisvf-mobile-modal-meta"><strong>' + escapeHtml(event.location) + '</strong>'
    if (event.categories) {
      html += '<br>' + escapeHtml(event.categories)
    }
    html += '</p>'
    if (event.description) {
      html += '<p class="chrisvf-mobile-modal-desc">' + escapeHtml(event.description) + '</p>'
    }
    html += '</div>'
    html += '<footer class="chrisvf-mobile-modal-actions">'
    if (typeof vfItineraryAdd === 'function') {
      if (saved) {
        html += '<button type="button" class="chrisvf-mobile-btn chrisvf-mobile-btn-itin-remove" data-itin-remove="' +
          escapeHtml(event.uid) + '">Remove from itinerary</button>'
      } else {
        html += '<button type="button" class="chrisvf-mobile-btn chrisvf-mobile-btn-itin-add" data-itin-add="' +
          escapeHtml(event.uid) + '">Add to itinerary</button>'
      }
    }
    if (event.ticketUrl) {
      html += '<a class="chrisvf-mobile-btn chrisvf-mobile-btn-ticket" href="' +
        escapeHtml(event.ticketUrl) + '" target="_blank" rel="noopener">Tickets</a>'
    }
    if (event.siteUrl) {
      html += '<a class="chrisvf-mobile-btn chrisvf-mobile-btn-site" href="' +
        escapeHtml(event.siteUrl) + '">Event page</a>'
    }
    html += '</footer></div></div>'
    return html
  }

  /**
   * Bind UI event handlers after render.
   */
  function bindEvents () {
    root.querySelectorAll('[data-day]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedDay = btn.getAttribute('data-day')
        state.selectedUid = null
        saveSession()
        render({ resetScroll: true })
      })
    })

    root.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.getAttribute('data-filter')
        saveSession()
        render({ resetScroll: true })
      })
    })

    root.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeTab = btn.getAttribute('data-tab')
        state.selectedUid = null
        if (state.activeTab === 'programme') {
          state.filtersOpen = false
        }
        saveSession()
        render({ resetScroll: state.activeTab === 'programme' })
      })
    })

    root.querySelectorAll('[data-filters-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filtersOpen = true
        saveSession()
        render({ focusSearch: true })
      })
    })

    root.querySelectorAll('[data-filters-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filtersOpen = false
        saveSession()
        render({ focusSummary: true })
      })
    })

    root.querySelectorAll('[data-text-step]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        stepTextSize(parseInt(btn.getAttribute('data-text-step'), 10))
      })
    })

    var searchInput = root.querySelector('.chrisvf-mobile-search')
    if (searchInput) {
      var debounceTimer = null
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(function () {
          state.search = searchInput.value
          state.filtersOpen = true
          saveSession()
          render({ focusSearch: true })
          var newInput = root.querySelector('.chrisvf-mobile-search')
          if (newInput) {
            newInput.focus()
            newInput.selectionStart = newInput.selectionEnd = newInput.value.length
          }
        }, 150)
      })
    }

    root.querySelectorAll('.chrisvf-mobile-event-row').forEach(function (row) {
      row.addEventListener('click', function () {
        openModal(row.closest('.chrisvf-mobile-event').getAttribute('data-event-uid'))
      })
      row.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') {
          return
        }
        e.preventDefault()
        openModal(row.closest('.chrisvf-mobile-event').getAttribute('data-event-uid'))
      })
    })

    root.querySelectorAll('[data-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeModal)
    })

    root.querySelectorAll('[data-itin-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        vfItineraryAdd(btn.getAttribute('data-itin-add'))
        render()
      })
    })

    root.querySelectorAll('[data-itin-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        vfItineraryRemove(btn.getAttribute('data-itin-remove'))
        render()
      })
    })

    var modal = root.querySelector('.chrisvf-mobile-modal')
    if (modal) {
      var chrome = root.querySelectorAll('.chrisvf-mobile-header, .chrisvf-mobile-main, .chrisvf-mobile-footer')
      chrome.forEach(function (el) {
        el.setAttribute('aria-hidden', 'true')
      })

      modal.addEventListener('click', function (e) {
        if (e.target === modal) {
          closeModal()
        }
      })

      var focusables = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      var first = focusables[0]
      var last = focusables[focusables.length - 1]
      modal.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab' || focusables.length === 0) {
          return
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      })

      var closeBtn = modal.querySelector('.chrisvf-mobile-modal-close')
      if (closeBtn) {
        closeBtn.focus()
      }
    }
  }

  /**
   * Render the programme list for the selected day.
   *
   * @param {{resetScroll?: boolean, focusSearch?: boolean, focusSummary?: boolean, keepFiltersOpen?: boolean}|undefined} options Render options.
   */
  function render (options) {
    options = options || {}
    var previousMain = root.querySelector('.chrisvf-mobile-main')
    var scrollTop = options.resetScroll ? 0 : (previousMain ? previousMain.scrollTop : 0)

    if (options.keepFiltersOpen) {
      state.filtersOpen = true
    }

    root.className = 'chrisvf-mobile-root chrisvf-mobile-text-' + state.textSize +
      (state.selectedUid ? ' has-modal' : '') +
      (state.activeTab === 'map' ? ' is-map-tab' : '') +
      (showingAllDays() ? ' is-searching' : '') +
      (state.filtersOpen ? ' is-filters-open' : '')
    var events = visibleEvents()
    var allDays = showingAllDays()
    var searching = state.search.trim().length > 0
    var html = ''

    html += '<header class="chrisvf-mobile-header">'
    html += '<h1 class="chrisvf-mobile-title">Ventnor Fringe</h1>'

    html += '<div class="chrisvf-mobile-tabs" role="tablist" aria-label="Programme views">'
    html += '<button type="button" role="tab" id="chrisvf-tab-programme" class="chrisvf-mobile-tab' +
      (state.activeTab === 'programme' ? ' is-active' : '') +
      '" data-tab="programme" aria-controls="chrisvf-mobile-programme" aria-selected="' +
      (state.activeTab === 'programme' ? 'true' : 'false') +
      '" tabindex="' + (state.activeTab === 'programme' ? '0' : '-1') +
      '">Programme</button>'
    html += '<button type="button" role="tab" id="chrisvf-tab-map" class="chrisvf-mobile-tab' +
      (state.activeTab === 'map' ? ' is-active' : '') +
      '" data-tab="map" aria-controls="chrisvf-mobile-map-panel" aria-selected="' +
      (state.activeTab === 'map' ? 'true' : 'false') +
      '" tabindex="' + (state.activeTab === 'map' ? '0' : '-1') +
      '">Map</button>'
    html += '</div>'

    if (state.activeTab === 'programme') {
      if (!state.filtersOpen) {
        html += '<button type="button" class="chrisvf-mobile-filter-summary" data-filters-open aria-expanded="false" aria-controls="chrisvf-mobile-filter-panel">'
        html += '<span class="chrisvf-mobile-filter-summary-text">' + escapeHtml(filterSummaryText()) + '</span>'
        html += '<span class="chrisvf-mobile-filter-summary-toggle" aria-hidden="true">▾</span>'
        html += '<span class="screen-reader-text">Open filters</span>'
        html += '</button>'
      } else {
        html += '<div class="chrisvf-mobile-filter-panel" id="chrisvf-mobile-filter-panel">'
        html += '<div class="chrisvf-mobile-controls">'
        html += '<div class="chrisvf-mobile-search-row">'
        html += '<label class="chrisvf-mobile-search-label">'
        html += '<span class="screen-reader-text">Search events</span>'
        html += '<input type="search" class="chrisvf-mobile-search" placeholder="Search…" value="' +
          escapeHtml(state.search) + '" autocomplete="off" enterkeyhint="search">'
        html += '</label>'
        html += '<button type="button" class="chrisvf-mobile-filter-close" data-filters-close aria-expanded="true" aria-controls="chrisvf-mobile-filter-panel" aria-label="Close filters">▴</button>'
        html += '</div>'

        html += '<div class="chrisvf-mobile-filters" role="group" aria-label="Quick filters and text size">'
        html += '<div class="chrisvf-mobile-filter-group" role="group" aria-label="Quick filters">'
        html += '<button type="button" class="chrisvf-mobile-filter' +
          (state.filter === 'all' ? ' is-active' : '') +
          '" data-filter="all" aria-pressed="' + (state.filter === 'all' ? 'true' : 'false') +
          '">All</button>'
        html += '<button type="button" class="chrisvf-mobile-filter' +
          (state.filter === 'free' ? ' is-active' : '') +
          '" data-filter="free" aria-pressed="' + (state.filter === 'free' ? 'true' : 'false') +
          '">Free</button>'
        html += '<button type="button" class="chrisvf-mobile-filter' +
          (state.filter === 'itinerary' ? ' is-active' : '') +
          '" data-filter="itinerary" aria-pressed="' + (state.filter === 'itinerary' ? 'true' : 'false') +
          '">Itinerary</button>'
        html += '</div>'
        html += '<div class="chrisvf-mobile-text-group" role="group" aria-label="Text size">'
        html += '<button type="button" class="chrisvf-mobile-text-btn" data-text-step="-1" aria-label="Decrease text size"' +
          (state.textSize === TEXT_SIZES[0] ? ' disabled' : '') + '">−A</button>'
        html += '<button type="button" class="chrisvf-mobile-text-btn" data-text-step="1" aria-label="Increase text size"' +
          (state.textSize === TEXT_SIZES[TEXT_SIZES.length - 1] ? ' disabled' : '') + '">+A</button>'
        html += '</div></div></div>'

        html += '<nav class="chrisvf-mobile-days' + (allDays ? ' is-disabled' : '') +
          '" aria-label="Festival days"' +
          (allDays ? ' aria-disabled="true"' : '') + '>'
        if (allDays) {
          html += '<p class="chrisvf-mobile-search-scope">' +
            (searching ? 'Searching all days' : 'Itinerary · all days') + '</p>'
        }
        state.data.festivalDays.forEach(function (day) {
          html += '<button type="button" class="chrisvf-mobile-day' +
            (!allDays && day === state.selectedDay ? ' is-active' : '') +
            '" data-day="' + day + '" aria-pressed="' +
            (!allDays && day === state.selectedDay ? 'true' : 'false') +
            '" aria-label="' + escapeHtml(dayAriaLabel(day)) + '"' +
            (allDays ? ' disabled' : '') + '>' +
            dayLabel(day) + '</button>'
        })
        html += '</nav>'
        html += '</div>'
      }
    }
    html += '</header>'

    if (state.activeTab === 'programme') {
      html += '<main class="chrisvf-mobile-main" id="chrisvf-mobile-programme" role="tabpanel" aria-labelledby="chrisvf-tab-programme">'
      if (events.length === 0) {
        html += '<p class="chrisvf-mobile-empty">' +
          (searching
            ? 'No events match your search.'
            : (state.filter === 'itinerary'
              ? 'No saved itinerary events.'
              : 'No events match your filters.')) +
          '</p>'
      } else {
        html += '<ul class="chrisvf-mobile-list">'
        events.forEach(function (event) {
          var badge = liveBadge(event)
          var saved = isInItinerary(event.uid)
          var dayKey = allDays ? eventDayKey(event) : ''
          html += '<li class="chrisvf-mobile-event' + (saved ? ' is-saved' : '') +
            '" data-event-uid="' + escapeHtml(event.uid) + '">'
          html += '<div class="chrisvf-mobile-event-row" role="button" tabindex="0" aria-haspopup="dialog" aria-label="Open details for ' +
            escapeHtml(event.summary) + '">'
          html += '<span class="chrisvf-mobile-event-time">'
          if (dayKey) {
            html += '<span class="chrisvf-mobile-event-day">' + escapeHtml(dayLabel(dayKey)) + '</span>'
          }
          html += escapeHtml(formatTime(event.start)) + '</span>'
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
          if (saved) {
            html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-saved" aria-label="In your itinerary">★ Saved</span>'
          }
          html += '</div>'
          html += '<div class="chrisvf-mobile-event-meta">'
          html += escapeHtml(event.location)
          if (event.categories) {
            html += ' · ' + escapeHtml(event.categories)
          }
          html += '</div></div>'
          html += '<span class="chrisvf-mobile-open" aria-hidden="true">›</span>'
          html += '</div></li>'
        })
        html += '</ul>'
      }
      html += '</main>'
    } else {
      html += '<main class="chrisvf-mobile-main chrisvf-mobile-main-map" id="chrisvf-mobile-map-panel" role="tabpanel" aria-labelledby="chrisvf-tab-map" aria-label="Festival map"></main>'
    }

    html += '<footer class="chrisvf-mobile-footer">'
    html += '<a href="' + escapeHtml(config.mainSiteUrl || '/') + '">Full website</a>'
    html += '</footer>'

    if (state.selectedUid) {
      html += renderModalHtml()
    }

    root.innerHTML = html
    bindEvents()

    var main = root.querySelector('.chrisvf-mobile-main')
    if (main && state.activeTab === 'programme') {
      main.scrollTop = scrollTop
    }

    if (options.focusSearch) {
      var searchEl = root.querySelector('.chrisvf-mobile-search')
      if (searchEl) {
        searchEl.focus()
        searchEl.selectionStart = searchEl.selectionEnd = searchEl.value.length
      }
    } else if (options.focusSummary) {
      var summaryEl = root.querySelector('[data-filters-open]')
      if (summaryEl) {
        summaryEl.focus()
      }
    }

    setMapVisible(state.activeTab === 'map')
  }

  /**
   * Boot the application.
   */
  function boot () {
    root.innerHTML = '<p class="chrisvf-mobile-loading">Loading programme…</p>'
    loadTextSize()
    bindMapEventHooks()

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
        state.filtersOpen = false
        render()
        window.addEventListener('resize', function () {
          if (state.activeTab === 'map') {
            refreshVisibleMap()
          }
        })
        setInterval(function () {
          if (state.activeTab === 'programme') {
            render()
          }
        }, 60000)

        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            closeModal()
          }
        })
      })
      .catch(function (err) {
        root.innerHTML = '<p class="chrisvf-mobile-error">Could not load programme. ' +
          escapeHtml(err.message) + '</p>'
      })
  }

  boot()
})()
