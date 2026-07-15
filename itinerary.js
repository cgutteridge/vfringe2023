var vfNotification

/**
 * Show an itinerary notification. Mobile /m can override via window.chrisvfNotifyHandler.
 *
 * @param {string} msg Message to display.
 */
function vfNotify (msg) {
  if (typeof window.chrisvfNotifyHandler === 'function') {
    window.chrisvfNotifyHandler(msg)
    return
  }
  if (!vfNotification) {
    vfNotification = jQuery('<div class=\'vf_notification\'></div>')
    jQuery('body').append(vfNotification)
  }
  vfNotification.text(msg)
  vfNotification.show()
  vfNotification.css('opacity', 0.8)
  setTimeout(function () {
    vfNotification.animate({ opacity: 0 }, function () {
      jQuery(this).hide()
    })
  }, 500)
}

/**
 * Add an event uid to the itinerary cookie.
 *
 * @param {string} nid Event uid / code.
 */
function vfItineraryAdd (nid) {
  var list = vfGetItinerary()

  list.push(nid) // code
  vfSetItinerary(list)
  vfUpdateItineraryCount(list.length)
  vfNotify('Event added to itinerary')
}

/**
 * Remove an event uid from the itinerary cookie.
 *
 * @param {string} nid Event uid / code.
 */
function vfItineraryRemove (nid) {
  var list = vfGetItinerary()
  var newlist = []
  for (var i = 0; i < list.length; ++i) {
    if (list[i] != nid) { newlist.push(list[i]) }
  }
  vfSetItinerary(newlist)
  vfUpdateItineraryCount(newlist.length)
  vfNotify('Event removed from itinerary')
}

/**
 * Update visible itinerary count UI on the desktop bar.
 *
 * @param {number} n Number of saved events.
 */
function vfUpdateItineraryCount (n) {

  if (n == 0) {
    jQuery('.vf_itinerary_display').hide()
    jQuery('.vf_itinerary_none').show()
  } else if (n == 1) {
    jQuery('.vf_itinerary_display').show()
    jQuery('.vf_itinerary_count').text('1 item in your itinerary.')
    jQuery('.vf_itinerary_none').hide()
  } else {
    jQuery('.vf_itinerary_display').show()
    jQuery('.vf_itinerary_count').text(n + ' items in your itinerary.')
    jQuery('.vf_itinerary_none').hide()
  }
}

/**
 * Persist itinerary uids in a year-scoped cookie.
 *
 * @param {string[]} list Event uid list.
 */
function vfSetItinerary (list) {
  var name = 'itinerary2025'
  var value = list.join('|')
  var days = 100
  if (days) {
    var date = new Date()
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
    expires = '; expires=' + date.toGMTString()
  } else {
    expires = ''
  }
  document.cookie = name + '=' + value + expires + '; path=/'
}

/**
 * Read itinerary uids from the year-scoped cookie.
 *
 * @returns {string[]}
 */
function vfGetItinerary () {
  var c_name = 'itinerary2025'
  if (document.cookie.length > 0) {
    c_start = document.cookie.indexOf(c_name + '=')
    if (c_start != -1) {
      c_start = c_start + c_name.length + 1
      c_end = document.cookie.indexOf(';', c_start)
      if (c_end == -1) {
        c_end = document.cookie.length
      }
      var v = unescape(document.cookie.substring(c_start, c_end))
      var list = []
      if (v != '') { list = v.split(/\|/) }
      return list
    }
  }
  return []
}

/**
 * Parse a compact festival timestamp (YYYYMMDDTHHMMSS) into a Date.
 *
 * @param {string} compact Compact ISO-like stamp.
 * @returns {Date|null}
 */
function vfItineraryParseCompact (compact) {
  if (!compact || typeof compact !== 'string' || compact.length < 15) {
    return null
  }
  var y = parseInt(compact.slice(0, 4), 10)
  var m = parseInt(compact.slice(4, 6), 10) - 1
  var d = parseInt(compact.slice(6, 8), 10)
  var hh = parseInt(compact.slice(9, 11), 10)
  var mm = parseInt(compact.slice(11, 13), 10)
  var ss = parseInt(compact.slice(13, 15) || '0', 10)
  if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(hh) || isNaN(mm)) {
    return null
  }
  return new Date(y, m, d, hh, mm, isNaN(ss) ? 0 : ss)
}

/**
 * English ordinal day number (1st, 2nd, …).
 *
 * @param {number} n Day of month.
 * @returns {string}
 */
function vfItineraryOrdinal (n) {
  var v = n % 100
  if (v >= 11 && v <= 13) {
    return n + 'th'
  }
  switch (n % 10) {
    case 1: return n + 'st'
    case 2: return n + 'nd'
    case 3: return n + 'rd'
    default: return n + 'th'
  }
}

/**
 * Format HH:mm from a compact stamp.
 *
 * @param {string} compact Compact ISO-like stamp.
 * @returns {string}
 */
function vfItineraryFormatTime (compact) {
  var dt = vfItineraryParseCompact(compact)
  if (!dt) {
    return ''
  }
  return String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0')
}

/**
 * Day heading matching the historic email body (`Friday 18th`).
 *
 * @param {string} compact Compact ISO-like stamp.
 * @returns {string}
 */
function vfItineraryDayHeading (compact) {
  var dt = vfItineraryParseCompact(compact)
  if (!dt) {
    return ''
  }
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dt.getDay()] + ' ' + vfItineraryOrdinal(dt.getDate())
}

/**
 * Escape text for use inside HTML.
 *
 * @param {string} value Raw text.
 * @returns {string}
 */
function vfItineraryEscapeHtml (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Sort normalized itinerary events by start time.
 *
 * @param {object[]} events Normalized events.
 * @returns {object[]}
 */
function vfItinerarySorted (events) {
  return (events || []).slice().sort(function (a, b) {
    var as = a && a.start ? a.start : ''
    var bs = b && b.start ? b.start : ''
    return as < bs ? -1 : as > bs ? 1 : 0
  })
}

/**
 * Build a day-grouped plain-text itinerary (email / clipboard text/plain).
 *
 * @param {object[]} events Normalized list of { start, end, summary, location, url }.
 * @returns {string}
 */
function vfItineraryFormatPlain (events) {
  var sorted = vfItinerarySorted(events)
  var body = '\r\n'
  var lastDay = null
  for (var i = 0; i < sorted.length; i++) {
    var event = sorted[i]
    if (!event || !event.start) {
      continue
    }
    var thisDay = vfItineraryDayHeading(event.start)
    if (thisDay !== lastDay) {
      body += '\r\n' + thisDay + '\r\n'
      lastDay = thisDay
    }
    body += vfItineraryFormatTime(event.start)
    if (event.end) {
      body += '-' + vfItineraryFormatTime(event.end)
    }
    body += ' : ' + (event.summary || '')
    body += ' @ ' + (event.location || '')
    if (event.url) {
      body += ' - ' + event.url
    }
    body += '\r\n'
  }
  return body
}

/**
 * Build simple semantic HTML for text/html clipboard paste.
 *
 * @param {object[]} events Normalized list of { start, end, summary, location, url }.
 * @returns {string}
 */
function vfItineraryFormatHtml (events) {
  var sorted = vfItinerarySorted(events)
  var html = ''
  var lastDay = null
  var listOpen = false
  for (var i = 0; i < sorted.length; i++) {
    var event = sorted[i]
    if (!event || !event.start) {
      continue
    }
    var thisDay = vfItineraryDayHeading(event.start)
    if (thisDay !== lastDay) {
      if (listOpen) {
        html += '</ul>'
        listOpen = false
      }
      html += '<h2>' + vfItineraryEscapeHtml(thisDay) + '</h2><ul>'
      listOpen = true
      lastDay = thisDay
    }
    var time = vfItineraryFormatTime(event.start)
    if (event.end) {
      time += '–' + vfItineraryFormatTime(event.end)
    }
    var title = vfItineraryEscapeHtml(event.summary || '')
    if (event.url) {
      title = '<a href="' + vfItineraryEscapeHtml(event.url) + '">' + title + '</a>'
    }
    html += '<li><strong>' + vfItineraryEscapeHtml(time) + '</strong> — ' + title
    if (event.location) {
      html += ' @ ' + vfItineraryEscapeHtml(event.location)
    }
    html += '</li>'
  }
  if (listOpen) {
    html += '</ul>'
  }
  return html
}

/**
 * Build a mailto: URL for the itinerary (subject + body).
 *
 * @param {string} plain Plain-text body from vfItineraryFormatPlain.
 * @returns {string}
 */
function vfItineraryMailtoHref (plain) {
  var subject = 'Your Ventnor Fringe Itinerary'
  var body = plain == null ? '' : String(plain)
  return 'mailto:?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body).replace(/\+/g, '%20')
}

/**
 * Copy plain + HTML itinerary to the clipboard when the browser allows it.
 *
 * Prefers ClipboardItem with text/plain and text/html; falls back to plain text.
 *
 * @param {string} plain Plain-text body.
 * @param {string} html HTML body.
 * @returns {Promise<boolean>} Resolves true when something was written.
 */
function vfItineraryCopy (plain, html) {
  var plainText = plain == null ? '' : String(plain)
  var htmlText = html == null ? '' : String(html)

  function fallbackPlain () {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(plainText).then(function () {
        return true
      })
    }
    try {
      var ta = document.createElement('textarea')
      ta.value = plainText
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      var ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return Promise.resolve(!!ok)
    } catch (e) {
      return Promise.resolve(false)
    }
  }

  if (typeof ClipboardItem !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function') {
    try {
      var item = new ClipboardItem({
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
        'text/html': new Blob([htmlText], { type: 'text/html' })
      })
      return navigator.clipboard.write([item]).then(function () {
        return true
      }).catch(function () {
        return fallbackPlain()
      })
    } catch (e) {
      return fallbackPlain()
    }
  }

  return fallbackPlain()
}

/**
 * Build the download URL for an itinerary .ics file.
 *
 * @param {string[]} [ids] Event uids; defaults to the cookie list.
 * @returns {string}
 */
function vfItineraryIcsUrl (ids) {
  var list = ids
  if (!list || !list.length) {
    list = vfGetItinerary()
  }
  var base = (typeof window.chrisvfItineraryConfig === 'object' &&
    window.chrisvfItineraryConfig.icsUrl)
    ? window.chrisvfItineraryConfig.icsUrl
    : '/?chrisvf_itinerary_ics=1'
  var sep = base.indexOf('?') === -1 ? '?' : '&'
  return base + sep + 'ids=' + encodeURIComponent(list.join('|'))
}

/**
 * Events still present in the itinerary cookie (desktop page payload is static).
 *
 * @param {object[]} events Normalized export events (may include uid).
 * @returns {object[]}
 */
function vfItineraryLiveExportEvents (events) {
  var saved = vfGetItinerary()
  var savedSet = {}
  for (var i = 0; i < saved.length; i++) {
    savedSet[saved[i]] = true
  }
  return (events || []).filter(function (event) {
    if (!event || !event.uid) {
      return false
    }
    return !!savedSet[event.uid]
  })
}

/**
 * Bind desktop itinerary export buttons (email / copy / calendar).
 *
 * Expects `#vf-itinerary-export-data` JSON and `.vf_itinerary_export [data-itin-export]`.
 * Filters against the live cookie so removals on this page are reflected without reload.
 */
function vfItineraryExportInit () {
  var dataEl = document.getElementById('vf-itinerary-export-data')
  if (!dataEl) {
    return
  }
  var events
  try {
    events = JSON.parse(dataEl.textContent || '[]')
  } catch (e) {
    events = []
  }
  if (!events.length) {
    return
  }

  var root = document.querySelector('.vf_itinerary_export')
  if (!root) {
    return
  }

  root.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-itin-export]')
    if (!btn || !root.contains(btn)) {
      return
    }
    var live = vfItineraryLiveExportEvents(events)
    if (!live.length) {
      vfNotify('No events in your itinerary')
      return
    }
    var action = btn.getAttribute('data-itin-export')
    if (action === 'email') {
      window.location.href = vfItineraryMailtoHref(vfItineraryFormatPlain(live))
      return
    }
    if (action === 'copy') {
      vfItineraryCopy(vfItineraryFormatPlain(live), vfItineraryFormatHtml(live)).then(function (ok) {
        if (ok) {
          vfNotify('Copied to clipboard')
        } else {
          vfNotify('Could not copy — try selecting the list')
        }
      })
      return
    }
    if (action === 'calendar') {
      window.location.href = vfItineraryIcsUrl()
    }
  })
}

var vfItineraryDoneInit = false

/**
 * Wire add/remove controls on `.vf_itinerary_toggle` blocks.
 */
function vfItineraryInit () {
  if (vfItineraryDoneInit) { return }
  var vfItineraryDoneInit = true
  //$itin = vfringe_extras_get_itinerary();
  jQuery('.vf_itinerary_toggle').each(function () {
    var div = jQuery(this)
    var itin = vfGetItinerary()
    var code = div.attr('data-code')
    var in_itin = false
    for (i = 0; i < itin.length; i++) { if (itin[i] == code) { in_itin = true } }
    // if item is in itinerary
    var add_button = jQuery('<div class=\'vf_itinerary_button_add vf_itinerary_button\'>Add to itinerary</div>')
    var remove_button = jQuery('<div class=\'vf_itinerary_button_remove vf_itinerary_button\'>Remove from itinerary</div>')

    if (in_itin) {
      add_button.hide()
    } else {
      remove_button.hide()
    }
    div.append(add_button)
    div.append(remove_button)

    add_button.click(function () {
      var div = jQuery(this).parent()
      var code = div.attr('data-code')
      div.find('.vf_itinerary_button_add').hide()
      div.find('.vf_itinerary_button_remove').css('display', 'inline-block')
      vfItineraryAdd(code)
    })

    remove_button.click(function () {
      var div = jQuery(this).parent()
      var code = div.attr('data-code')
      div.find('.vf_itinerary_button_add').css('display', 'inline-block')
      div.find('.vf_itinerary_button_remove').hide()
      vfItineraryRemove(code)
    })

  })

}
