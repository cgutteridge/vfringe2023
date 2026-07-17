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
    filtersOpen: false,
    /** @type {{ lat: number, lng: number, zoom: number }|null} */
    pendingMapFocus: null
  }

  var userLocation = {
    /** @type {number|null} */
    watchId: null,
    /** @type {{lat: number, lng: number}|null} */
    latlng: null,
    marker: null,
    control: null,
    pendingRecentre: false
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
   * Current Europe/London wall-clock parts (handles GMT/BST via Intl).
   *
   * The old getTimezoneOffset()+3600000 trick is an hour behind on machines
   * already in British Summer Time, which made past 2pm events look "Up next".
   *
   * @returns {{y: number, m: number, d: number, h: number, min: number, sec: number, ms: number}}
   */
  function getLondonNowParts () {
    var parts = {}
    var dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    })
    dtf.formatToParts(new Date()).forEach(function (part) {
      if (part.type !== 'literal') {
        parts[part.type] = part.value
      }
    })
    return {
      y: parseInt(parts.year, 10),
      m: parseInt(parts.month, 10),
      d: parseInt(parts.day, 10),
      h: parseInt(parts.hour, 10),
      min: parseInt(parts.minute, 10),
      sec: parseInt(parts.second, 10),
      ms: new Date().getMilliseconds()
    }
  }

  /**
   * Current time as compact ISO in Europe/London (festival wall-clock).
   *
   * @returns {string}
   */
  function getCurrentBstCompact () {
    var t = getLondonNowParts()
    var y = String(t.y)
    var m = String(t.m).padStart(2, '0')
    var d = String(t.d).padStart(2, '0')
    var h = String(t.h).padStart(2, '0')
    var min = String(t.min).padStart(2, '0')
    var sec = String(t.sec).padStart(2, '0')
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
   * English ordinal suffix for a day of month (1 → st, 2 → nd, …).
   *
   * @param {number} day Day of month (1–31).
   * @returns {string}
   */
  function dayOrdinal (day) {
    var mod100 = day % 100
    if (mod100 >= 11 && mod100 <= 13) {
      return 'th'
    }
    switch (day % 10) {
      case 1:
        return 'st'
      case 2:
        return 'nd'
      case 3:
        return 'rd'
      default:
        return 'th'
    }
  }

  /**
   * Full weekday + ordinal for the closed filter summary (e.g. Monday 12th).
   *
   * @param {string} dayKey Y-m-d date.
   * @returns {string}
   */
  function daySummaryLabel (dayKey) {
    var parts = dayKey.split('-')
    var dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    var dayNum = parseInt(parts[2], 10)
    return days[dt.getDay()] + ' ' + dayNum + dayOrdinal(dayNum)
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
   * Resolve map coordinates for an event location name.
   *
   * Prefers places.json GEO (same pins as the Leaflet markers), then falls back
   * to WordPress venue lat/lon from the JSON payload.
   *
   * @param {string} location Event location / venue name.
   * @returns {[number, number]|null} `[lat, lng]` or null when unknown.
   */
  function venueLatLng (location) {
    if (!location || !state.data) {
      return null
    }

    var places = state.data.places || []
    for (var i = 0; i < places.length; i++) {
      var place = places[i]
      var venues = place.VENUES || []
      var matches = venues.some(function (venue) {
        var name = typeof venue === 'string' ? venue : (venue && venue.name)
        return name === location
      })
      if (matches && Array.isArray(place.GEO) && place.GEO.length >= 2) {
        return [Number(place.GEO[0]), Number(place.GEO[1])]
      }
    }

    var venue = state.data.venues ? state.data.venues[location] : null
    if (venue && venue.lat != null && venue.lon != null) {
      return [Number(venue.lat), Number(venue.lon)]
    }

    return null
  }

  /**
   * Switch to the map tab, close the modal, and centre on the event venue.
   *
   * Does not open a marker popup.
   *
   * @param {string} uid Event UID.
   */
  function showEventVenueOnMap (uid) {
    var event = state.eventsByUid[uid]
    var latLng = event ? venueLatLng(event.location) : null
    if (!latLng) {
      return
    }

    state.pendingMapFocus = {
      lat: latLng[0],
      lng: latLng[1],
      zoom: 18
    }
    state.activeTab = 'map'
    state.selectedUid = null
    saveSession()
    render()

    // Keep pending through the 50ms/250ms map-repair refreshes, then clear.
    setTimeout(function () {
      state.pendingMapFocus = null
    }, 300)
  }

  /**
   * After the map host is visible, fix Leaflet size and re-fit if init ran while hidden.
   *
   * Leaflet fitBounds during a zero-size (hidden) container leaves the map at world zoom.
   * When a venue focus is pending (from "View on map"), apply setView after any repair.
   */
  function refreshVisibleMap () {
    syncMapHostLayout()
    var map = window.chrisvfMobileLeafletMap
    if (!map || typeof map.invalidateSize !== 'function') {
      return
    }
    ensureUserLocationControl()
    map.invalidateSize()
    var bounds = window.chrisvfMobileLeafletBounds
    if (!bounds || typeof map.fitBounds !== 'function') {
      return
    }
    // Hidden init leaves zoom at ~0; re-fit once we have a real container size.
    if (typeof map.getZoom === 'function' && map.getZoom() < 10) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })
    }

    if (state.pendingMapFocus) {
      var focus = state.pendingMapFocus
      if (typeof map.closePopup === 'function') {
        map.closePopup()
      }
      if (typeof map.setView === 'function') {
        map.setView([focus.lat, focus.lng], focus.zoom, { animate: true })
      }
    }
  }

  /**
   * Centre the mobile map on the latest user location.
   */
  function centreOnUserLocation () {
    var map = window.chrisvfMobileLeafletMap
    if (!map || !userLocation.latlng || typeof map.setView !== 'function') {
      return
    }
    var zoom = 16
    if (typeof map.getZoom === 'function') {
      var currentZoom = map.getZoom()
      if (typeof currentZoom === 'number' && isFinite(currentZoom)) {
        zoom = Math.max(currentZoom, zoom)
      }
    }
    if (typeof map.closePopup === 'function') {
      map.closePopup()
    }
    map.setView(
      [userLocation.latlng.lat, userLocation.latlng.lng],
      zoom,
      { animate: true }
    )
  }

  /**
   * Create or move the user-location marker on the mobile map.
   *
   * @param {{lat: number, lng: number}} latlng User coordinates.
   */
  function upsertUserLocationMarker (latlng) {
    var map = window.chrisvfMobileLeafletMap
    var leaflet = window.L
    if (!map || !leaflet || typeof leaflet.circleMarker !== 'function') {
      return
    }
    var point = [latlng.lat, latlng.lng]
    if (userLocation.marker && typeof userLocation.marker.setLatLng === 'function') {
      userLocation.marker.setLatLng(point)
      return
    }
    userLocation.marker = leaflet.circleMarker(point, {
      radius: 9,
      color: '#fff',
      weight: 3,
      fillColor: '#0066cc',
      fillOpacity: 1,
      interactive: false
    }).addTo(map)
  }

  /**
   * Report a geolocation error and stop the failed watch.
   *
   * @param {GeolocationPositionError|Error} error Browser location error.
   */
  function handleUserLocationError (error) {
    if (userLocation.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(userLocation.watchId)
    }
    userLocation.watchId = null
    userLocation.pendingRecentre = false

    if (error && error.code === 1) {
      showMobileToast('Location access was not allowed')
    } else if (error && error.code === 3) {
      showMobileToast('Location request timed out')
    } else {
      showMobileToast('Could not find your location')
    }
  }

  /**
   * Start watching the user's location for this page load.
   */
  function startUserLocationWatch () {
    if (userLocation.watchId !== null) {
      return
    }
    if (!navigator.geolocation ||
        typeof navigator.geolocation.watchPosition !== 'function') {
      userLocation.pendingRecentre = false
      showMobileToast('Location is not available on this device')
      return
    }
    try {
      userLocation.watchId = navigator.geolocation.watchPosition(
        function (position) {
          userLocation.latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          upsertUserLocationMarker(userLocation.latlng)
          if (userLocation.pendingRecentre) {
            userLocation.pendingRecentre = false
            centreOnUserLocation()
          }
        },
        handleUserLocationError,
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000
        }
      )
    } catch (error) {
      handleUserLocationError(error)
    }
  }

  /**
   * Start location tracking if needed and centre on the latest fix.
   */
  function onLocateButtonClick () {
    state.pendingMapFocus = null
    if (userLocation.latlng) {
      centreOnUserLocation()
      startUserLocationWatch()
      return
    }
    userLocation.pendingRecentre = true
    startUserLocationWatch()
  }

  /**
   * Add the locate button beneath Leaflet's zoom control.
   */
  function ensureUserLocationControl () {
    if (userLocation.control) {
      return
    }
    var map = window.chrisvfMobileLeafletMap
    var leaflet = window.L
    if (!map || !leaflet || !leaflet.Control || !leaflet.DomUtil || !leaflet.DomEvent) {
      return
    }

    var UserLocationControl = leaflet.Control.extend({
      options: { position: 'topleft' },
      /**
       * Build the Leaflet control element.
       *
       * @returns {HTMLElement}
       */
      onAdd: function () {
        var container = leaflet.DomUtil.create(
          'div',
          'leaflet-bar chrisvf-mobile-locate-control'
        )
        var button = leaflet.DomUtil.create(
          'button',
          'chrisvf-mobile-locate',
          container
        )
        button.type = 'button'
        button.setAttribute('aria-label', 'Centre map on my location')
        button.setAttribute('title', 'Locate me')
        button.innerHTML =
          '<span class="chrisvf-mobile-locate-icon" aria-hidden="true"></span>' +
          '<span class="screen-reader-text">Locate me</span>'
        button.addEventListener('click', function (event) {
          event.preventDefault()
          event.stopPropagation()
          onLocateButtonClick()
        })
        leaflet.DomEvent.disableClickPropagation(container)
        leaflet.DomEvent.disableScrollPropagation(container)
        return container
      }
    })

    userLocation.control = new UserLocationControl()
    userLocation.control.addTo(map)
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
   * HTML for the live Now / Up next badge, if any.
   *
   * @param {object} event Event record.
   * @returns {string}
   */
  function liveBadgeHtml (event) {
    var badge = liveBadge(event)
    if (badge === 'now') {
      return '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-now">Now</span>'
    }
    if (badge === 'next') {
      return '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-next">Up next</span>'
    }
    return ''
  }

  /** @type {number|null} */
  var liveBadgeRefreshTimeout = null

  /**
   * Milliseconds until the next five-minute London boundary (:00, :05, …), plus a small buffer.
   *
   * @returns {number}
   */
  function msUntilNextFiveMinuteBoundary () {
    var t = getLondonNowParts()
    var totalMsInHour = (t.h * 3600 + t.min * 60 + t.sec) * 1000 + t.ms
    var blockMs = 5 * 60 * 1000
    var remainderMs = totalMsInHour % blockMs
    var bufferMs = 100
    if (remainderMs === 0) {
      return bufferMs
    }
    return blockMs - remainderMs + bufferMs
  }

  /**
   * Re-render programme list and/or open modal so Now / Up next badges reflect current time.
   */
  function refreshLiveBadges () {
    if (!state.data) {
      return
    }
    if (state.activeTab === 'programme' || state.selectedUid) {
      render()
    }
  }

  /**
   * Schedule the next live-badge refresh at the upcoming five-minute BST boundary.
   */
  function scheduleLiveBadgeRefresh () {
    if (liveBadgeRefreshTimeout !== null) {
      clearTimeout(liveBadgeRefreshTimeout)
    }
    liveBadgeRefreshTimeout = setTimeout(function () {
      refreshLiveBadges()
      scheduleLiveBadgeRefresh()
    }, msUntilNextFiveMinuteBoundary())
  }

  /**
   * Map /m programme events into the shared itinerary export shape.
   *
   * @param {object[]} events Visible programme events.
   * @returns {object[]}
   */
  function exportEventsFromMobile (events) {
    return (events || []).map(function (event) {
      return {
        start: event.start || '',
        end: event.end || '',
        summary: event.summary || '',
        location: event.location || '',
        url: event.ticketUrl || event.siteUrl || ''
      }
    })
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
      scope = state.selectedDay ? daySummaryLabel(state.selectedDay) : 'Programme'
    }
    if (state.filter === 'all') {
      return scope
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
    html += liveBadgeHtml(event)
    if (event.free) {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-free">FREE</span>'
    }
    if (event.cancelled) {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-cancelled">' +
        (event.cancelledOtherDates ? 'CANCELLED (OTHER DATES)' : 'CANCELLED') + '</span>'
    } else if (event.soldOut) {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-soldout">' +
        (event.soldOutOtherDates ? 'SOLD OUT (OTHER DATES)' : 'SOLD OUT') + '</span>'
    }
    if (saved) {
      html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-saved" aria-label="In your itinerary">★ Saved</span>'
    }
    html += '</div>'
    html += '<p class="chrisvf-mobile-modal-meta">'
    if (venueLatLng(event.location)) {
      html += '<button type="button" class="chrisvf-mobile-venue-lozenge" data-view-map="' +
        escapeHtml(event.uid) + '" aria-label="View ' + escapeHtml(event.location) + ' on map">' +
        escapeHtml(event.location) + '</button>'
    } else {
      html += '<strong>' + escapeHtml(event.location) + '</strong>'
    }
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
    if (event.uid && typeof vfItineraryIcsUrl === 'function') {
      html += '<button type="button" class="chrisvf-mobile-btn chrisvf-mobile-btn-calendar" data-calendar-add="' +
        escapeHtml(event.uid) + '">Save to phone calendar</button>'
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
   * Horizontally scroll the festival-day strip so the selected day is on-screen.
   * When the selected day is not the first, leave a small peek of the previous
   * day visible so users can see they can scroll back.
   */
  function scrollSelectedDayIntoView () {
    var nav = root.querySelector('.chrisvf-mobile-days')
    if (!nav || !state.selectedDay) {
      return
    }
    var active = nav.querySelector('[data-day="' + state.selectedDay + '"]')
    if (!active) {
      return
    }

    var prev = active.previousElementSibling
    while (prev && !prev.classList.contains('chrisvf-mobile-day')) {
      prev = prev.previousElementSibling
    }

    if (!prev) {
      nav.scrollLeft = 0
      return
    }

    var navRect = nav.getBoundingClientRect()
    var activeLeft = active.getBoundingClientRect().left - navRect.left + nav.scrollLeft
    var activeWidth = active.offsetWidth
    var peek = Math.min(36, Math.max(28, Math.round(prev.offsetWidth * 0.4)))
    var maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth)
    var target = Math.max(0, activeLeft - peek)
    var activeRight = activeLeft + activeWidth
    if (activeRight - target > nav.clientWidth) {
      target = activeRight - nav.clientWidth
    }
    nav.scrollLeft = Math.min(maxScroll, Math.max(0, target))
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

    root.querySelectorAll('[data-search-clear]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.search = ''
        state.filtersOpen = true
        saveSession()
        render({ focusSearch: true, resetScroll: true })
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

    root.querySelectorAll('[data-view-map]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showEventVenueOnMap(btn.getAttribute('data-view-map'))
      })
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

    root.querySelectorAll('[data-calendar-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var uid = btn.getAttribute('data-calendar-add')
        if (!uid || typeof vfItineraryIcsUrl !== 'function') {
          return
        }
        window.location.href = vfItineraryIcsUrl([uid])
      })
    })

    root.querySelectorAll('[data-itin-export]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-itin-export')
        var exportEvents = exportEventsFromMobile(visibleEvents())
        if (!exportEvents.length) {
          return
        }
        if (action === 'email') {
          window.location.href = vfItineraryMailtoHref(vfItineraryFormatPlain(exportEvents))
          return
        }
        if (action === 'copy') {
          vfItineraryCopy(
            vfItineraryFormatPlain(exportEvents),
            vfItineraryFormatHtml(exportEvents)
          ).then(function (ok) {
            if (ok) {
              showMobileToast('Copied to clipboard')
            } else {
              showMobileToast('Could not copy')
            }
          })
          return
        }
        if (action === 'calendar') {
          window.location.href = vfItineraryIcsUrl()
        }
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
        if (state.search.trim().length > 0) {
          html += '<button type="button" class="chrisvf-mobile-search-clear" data-search-clear aria-label="Clear search">×</button>'
        }
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
        if (state.filter === 'itinerary') {
          html += '<div class="chrisvf-mobile-export" role="group" aria-label="Export itinerary">'
          html += '<button type="button" class="chrisvf-mobile-export-btn" data-itin-export="email">Email</button>'
          html += '<button type="button" class="chrisvf-mobile-export-btn" data-itin-export="copy">Copy</button>'
          html += '<button type="button" class="chrisvf-mobile-export-btn" data-itin-export="calendar">Download calendar</button>'
          html += '</div>'
        }
        html += '<ul class="chrisvf-mobile-list">'
        events.forEach(function (event) {
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
          html += liveBadgeHtml(event)
          if (event.free) {
            html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-free">FREE</span>'
          }
          if (event.cancelled) {
            html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-cancelled">' +
              (event.cancelledOtherDates ? 'CANCELLED (OTHER DATES)' : 'CANCELLED') + '</span>'
          } else if (event.soldOut) {
            html += '<span class="chrisvf-mobile-badge chrisvf-mobile-badge-soldout">' +
              (event.soldOutOtherDates ? 'SOLD OUT (OTHER DATES)' : 'SOLD OUT') + '</span>'
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

    if (state.filtersOpen && state.activeTab === 'programme') {
      requestAnimationFrame(function () {
        scrollSelectedDayIntoView()
      })
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
        scheduleLiveBadgeRefresh()
        window.addEventListener('resize', function () {
          if (state.activeTab === 'map') {
            refreshVisibleMap()
          }
        })

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
