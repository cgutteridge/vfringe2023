/**
 * Live Now / soon tooltip refresh for chrisvf Leaflet maps.
 *
 * Shared by [chrisvf_map] and the /m embedded map. Recomputes permanent
 * marker tooltips on five-minute Europe/London clock boundaries.
 *
 * Expects window.chrisvfMapLiveLabelEntries to be an array of:
 *   { marker, events: [{ start, end, summary, free }], tipOpts }
 * populated by map.php while creating markers.
 *
 * @package ChrisVF
 */
(function (window) {
  'use strict'

  /** @type {number|null} */
  var refreshTimeout = null

  /**
   * Optional seconds offset (e.g. ?TIMESHIFT=) applied before reading London time.
   *
   * @returns {number}
   */
  function getTimeShiftSeconds () {
    var shift = window.chrisvfMapTimeShift
    return typeof shift === 'number' && !isNaN(shift) ? shift : 0
  }

  /**
   * Current Europe/London wall-clock parts (handles GMT/BST via Intl).
   *
   * @returns {{y: number, m: number, d: number, h: number, min: number, sec: number, ms: number}}
   */
  function getLondonNowParts () {
    var parts = {}
    var when = new Date(Date.now() + getTimeShiftSeconds() * 1000)
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
    dtf.formatToParts(when).forEach(function (part) {
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
      ms: when.getMilliseconds()
    }
  }

  /**
   * Current time as compact ISO in Europe/London (YYYYMMDDTHHMMSS).
   *
   * @returns {string}
   */
  function getCurrentLondonCompact () {
    var t = getLondonNowParts()
    return '' + t.y +
      String(t.m).padStart(2, '0') +
      String(t.d).padStart(2, '0') +
      'T' +
      String(t.h).padStart(2, '0') +
      String(t.min).padStart(2, '0') +
      String(t.sec).padStart(2, '0')
  }

  /**
   * Parse compact ISO datetime (20260718T193000) as a local Date for diffs.
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
   * Format compact ISO as a short display time (e.g. 3pm, 3:30pm).
   *
   * @param {string} iso Compact datetime string.
   * @returns {string}
   */
  function formatLiveTime (iso) {
    if (!iso || iso.length < 15) {
      return ''
    }
    var h = parseInt(iso.substr(9, 2), 10)
    var min = parseInt(iso.substr(11, 2), 10)
    var ampm = h >= 12 ? 'pm' : 'am'
    var h12 = h % 12
    if (h12 === 0) {
      h12 = 12
    }
    if (min === 0) {
      return h12 + ampm
    }
    return h12 + ':' + String(min).padStart(2, '0') + ampm
  }

  /**
   * Escape text for HTML tooltip content.
   *
   * @param {string} text Raw text.
   * @returns {string}
   */
  function escapeHtml (text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  /**
   * Build permanent tooltip HTML for a place from live event records.
   * Matches map.php semantics: Now (free, >10 min left) then soon (next 90 min).
   *
   * @param {Array<{start: string, end: string, summary: string, free: boolean}>} events Live events.
   * @returns {string} HTML or empty string when no live label.
   */
  function buildLiveLabelHtml (events) {
    if (!events || !events.length) {
      return ''
    }
    var now = getCurrentLondonCompact()
    var nowDt = parseCompactIso(now)
    if (!nowDt) {
      return ''
    }
    var nowMs = nowDt.getTime()
    var soonParts = []
    var nowParts = []
    var i
    for (i = 0; i < events.length; i++) {
      var event = events[i]
      var start = event.start
      var end = event.end || event.start
      if (!start) {
        continue
      }
      if (end < now) {
        continue
      }
      if (start < now && end > now && event.free) {
        var endDt = parseCompactIso(end)
        if (endDt && endDt.getTime() > nowMs + 10 * 60 * 1000) {
          nowParts.push(
            '<div><strong>Now - ' + escapeHtml(event.summary) + '</strong></div>'
          )
        }
      } else if (start > now) {
        var startDt = parseCompactIso(start)
        if (!startDt) {
          continue
        }
        var diffMs = startDt.getTime() - nowMs
        if (diffMs > 0 && diffMs <= 90 * 60 * 1000) {
          soonParts.push(
            '<div><strong>' + formatLiveTime(start) + ' - ' +
              escapeHtml(event.summary) + '</strong></div>'
          )
        }
      }
    }
    return nowParts.join('') + soonParts.join('')
  }

  /**
   * Apply current live-label HTML to a marker tooltip.
   *
   * @param {{marker: object, events: Array, tipOpts: object}} entry Registry entry.
   */
  function updateMarkerLiveLabel (entry) {
    if (!entry || !entry.marker) {
      return
    }
    var html = buildLiveLabelHtml(entry.events)
    var marker = entry.marker
    var tipOpts = entry.tipOpts || { permanent: true, direction: 'left' }
    if (html) {
      if (typeof marker.getTooltip === 'function' && marker.getTooltip()) {
        marker.setTooltipContent(html)
      } else if (typeof marker.bindTooltip === 'function') {
        marker.bindTooltip(html, tipOpts)
      }
    } else if (typeof marker.unbindTooltip === 'function') {
      marker.unbindTooltip()
    }
  }

  /**
   * Refresh live labels for every registered map marker.
   */
  function refreshMapLiveLabels () {
    var entries = window.chrisvfMapLiveLabelEntries
    if (!entries || !entries.length) {
      return
    }
    var i
    for (i = 0; i < entries.length; i++) {
      updateMarkerLiveLabel(entries[i])
    }
  }

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
   * Refresh live labels now, then again at each upcoming five-minute London boundary.
   * Immediate refresh corrects labels if PHP render time was skewed vs Europe/London.
   */
  function scheduleMapLiveLabelRefresh () {
    refreshMapLiveLabels()
    if (refreshTimeout !== null) {
      clearTimeout(refreshTimeout)
    }
    refreshTimeout = setTimeout(function () {
      scheduleMapLiveLabelRefresh()
    }, msUntilNextFiveMinuteBoundary())
  }

  window.chrisvfRefreshMapLiveLabels = refreshMapLiveLabels
  window.chrisvfScheduleMapLiveLabelRefresh = scheduleMapLiveLabelRefresh
})(window)
