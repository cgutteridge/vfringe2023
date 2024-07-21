jQuery(document).ready(function () {

  // hack for mobile
  jQuery( 'meta[name="viewport"]').attr( 'content',"width=device-width, initial-scale=1, maximum-scale=100, user-scalable=yes" )

  const it_control = jQuery('<a href="/itinerary" class="vf_it_control"></a>')
  jQuery('body').append(it_control)

  updateNow()
  setInterval(updateNow, 60000)

  function updateNow () {
    const now = getCurrentBSTTime()
    jQuery('.vf_grid_now').each((i, el) => { jQuery(el).remove() } )
    jQuery('.vf_grid_freecell').each((i, el) => {
      const cell = jQuery(el)
      const cellStart = cell.attr('data-start')
      const cellEnd = cell.attr('data-end')
      if( cellStart<=now && cellEnd>=now ) {
        cell.prepend( '<div class="vf_grid_now">NOW</div>')
      }
    })
  }

  jQuery('.vf_grid_event[data-url]').each((index, element) => {
    const event = jQuery(element)
    const code = event.attr('data-code')
    const add = event.find('.vf_grid_it_add')
    const remove = event.find('.vf_grid_it_remove')
    add.click(() => {
      vfItineraryAdd(code)
      event.addClass('vf_grid_it')
      updateGrid()
    })
    remove.click(() => {
      vfItineraryRemove(code)
      event.removeClass('vf_grid_it')
      updateGrid()
    })
  })

  updateGrid()

  function updateGrid () {
    // show or hide the control if there's events selected or not
    const count = jQuery('.vf_grid_it').length
    if (count) {
      it_control.text(count + ' event' + (count > 1 ? 's' : '') + ' in your itinerary')
      it_control.show()
    } else {
      it_control.hide()
    }

    // remove all busy and clash classes
    // empty cells entirely inside a time get made busy
    // non-picked events entirely inside a time get made busy
    // picked events overlapping the time get made clash
    // non-picked events overlapping the time get made soft-clash
    jQuery('.vf_grid_hard_clash').removeClass('vf_grid_hard_clash')
    jQuery('.vf_grid_soft_clash').removeClass('vf_grid_soft_clash')
    jQuery('.vf_grid_it').each((i, el) => {
      const pickedEvent = jQuery(el)
      const eventStart = pickedEvent.attr('data-start')
      const eventEnd = pickedEvent.attr('data-end')
      jQuery('.vf_grid td').each((i, el) => {
        const cell = jQuery(el)
        // don't set clashes on selected items
        if (cell.hasClass('vf_grid_it')) {
          return
        }
        const cellStart = cell.attr('data-start')
        const cellEnd = cell.attr('data-end')
        const hardClash = cellStart <= eventStart && cellEnd >= eventEnd
        const softClash = (cellStart >= eventStart && cellStart < eventEnd)
          || (cellEnd > eventStart && cellEnd <= eventEnd)
        if (hardClash) {
          cell.addClass('vf_grid_hard_clash')
        } else if (softClash) {
          cell.addClass('vf_grid_soft_clash')
        }
      })
    })
  }

  jQuery('.vf_grid_event').on('mouseenter', (e) => {
    const desc = jQuery(e.target).find('.vf_grid_cell_desc')
    if (desc.text().trim() != '') {
      const ratio_down_page = e.clientY / jQuery(window).height()
      const pos_class = ratio_down_page < 0.5 ? 'vf_grid_infobox_bottom' : 'vf_grid_infobox_top'
      const infobox = jQuery(`<div class="vf_grid_infobox ${pos_class}"></div>`).html(desc.html())
      jQuery('body').append(infobox)
    }
  })
  jQuery('.vf_grid_event').on('mouseleave', (e) => {
    jQuery('.vf_grid_infobox').remove()
  })

  function getCurrentBSTTime () {
    // Create a new Date object for the current date and time
    const now = new Date()

    // Get the current time zone offset in minutes
    const timezoneOffset = 1

    // Convert the current time to UTC by adding the offset in milliseconds
    const utcTime = now.getTime() + (timezoneOffset * 60 * 1000)

    // BST is UTC+1, so add 1 hour in milliseconds to the UTC time
    const bstTime = new Date(utcTime + (60 * 60 * 1000))

    // Format the date and time components
    const year = bstTime.getUTCFullYear()
    const month = String(bstTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(bstTime.getUTCDate()).padStart(2, '0')
    const hours = String(bstTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bstTime.getUTCMinutes()).padStart(2, '0')
    const seconds = String(bstTime.getUTCSeconds()).padStart(2, '0')

    // Construct the formatted string
    const formattedBSTTime = `${year}${month}${day}T${hours}${minutes}${seconds}`

    return formattedBSTTime
  }

})
