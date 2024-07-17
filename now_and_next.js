jQuery(document).ready(function () {
  jQuery('.chrisvf_slides').each(initChrisvfSlides)

  function initChrisvfSlides () {
    //rotation speed and timer
    const slidesOuter = jQuery(this)
    const speed = 3000
    let run

    // double up the slides, lazy but prevents glitches
    const container = slidesOuter.find('ul')
    container.html(container.html() + container.html())

    const slides = container.find('.chrisvf_slide')

    startAnimation()


    const elm = container.find(':first-child').prop('tagName')
    const item_height = container.find(':first-child').height();
    //slides.width(item_height) // set the slides to the correct pixel width
    //container.parent().width(item_width)
    //container.width((slides.length + 1) * item_height) //set the slides container to the correct total width
    container.find(elm + ':first').before(container.find(elm + ':last'))
    resetSlides()


    /*
    if (e.target.id == previous) {
      container.stop().animate({
        'left': 0
      }, 1500, function () {
        container.find(elm + ':first').before(container.find(elm + ':last'))
        resetSlides()
      })
    }
     */

    //if mouse hover, pause the auto rotation, otherwise rotate it
    slidesOuter.parent()
      .mouseenter(stopAnimation)
      .mouseleave(startAnimation)


    function startAnimation () {
      if (slides.length > 3) {
        run = setInterval(rotate, speed)
      }
    }

    function stopAnimation () {
      clearInterval(run)
    }

    function resetSlides () {
      //and adjust the container so current is in the frame
      container.css({
        'top': -1 * item_height
      })
    }

    function rotate () {
      container.stop().animate({
        'top': item_height * -2,
        'easing': 'linear'
      }, 500, function () {
        container.find(elm + ':last').after(container.find(elm + ':first'))
        resetSlides()
      })
    }

  }

})

//a simple function to click next link
//a timer will call this function, and the rotation will begin

