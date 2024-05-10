jQuery(document).ready(function() {
	/*
  jQuery('.vf_grid_event[data-url]').click( function() {
    var d = jQuery( this );
    window.open( d.attr( 'data-url' ), '_self' );
  }).css( 'cursor','pointer' );
	*/

  jQuery('.vf_grid_itinerary .vf_grid_star').text( '★' );
  jQuery('.vf_grid_event').mouseenter( function() {
    var ev = jQuery( this );
    if( ev.hasClass( 'vf_grid_itinerary' ) ) {
      // no action
    } else {
      jQuery( '.vf_grid_star', this ).text( '☆' );
    }
  });
  jQuery('.vf_grid_event').mouseleave( function() {
    var ev = jQuery( this );
    if( ev.hasClass( 'vf_grid_itinerary' ) ) {
      // no action
    } else {
      jQuery( '.vf_grid_star', this ).text( '' );
    }
  });
  jQuery('.vf_grid_star').mouseenter( function() {
    var stars = jQuery(this);
    if( stars.parent().parent().hasClass( 'vf_grid_itinerary' ) ) {
      stars.text( '☆' );
    } else {
      stars.text( '★' );
    }
  } );
  jQuery('.vf_grid_star').mouseleave( function() {
    var stars = jQuery(this);
    if( stars.parent().parent().hasClass( 'vf_grid_itinerary' ) ) {
      stars.text( '★' );
    } else {
      stars.text( '☆' );
    }
  } );
  jQuery('.vf_grid_star').click( function() {
    var stars = jQuery(this);
    var code = stars.parent().parent().attr( 'data-code' );
    if( stars.parent().parent().hasClass( 'vf_grid_itinerary' ) ) {
      stars.parent().parent().removeClass( 'vf_grid_itinerary' );
      vfItineraryRemove( code );
    } else {
      stars.parent().parent().addClass( 'vf_grid_itinerary' );
      vfItineraryAdd( code );
    }
    return false;
  } );

  jQuery( '.vf_grid_event' ).on( 'mouseenter', (e) => {
     var ratio_down_page = e.clientY/jQuery(window).height();
     var pos_class = ratio_down_page<0.5 ? 'vf_grid_infobox_bottom' : 'vf_grid_infobox_top';
     var desc = jQuery( e.target ).find( '.vf_grid_cell_desc' );
     var infobox = jQuery( '<div class=\"vf_grid_infobox '+pos_class+'\"></div>' ).html( desc.html() );
     jQuery( 'body' ).append( infobox );
  });
  jQuery( '.vf_grid_event' ).on( 'mouseleave', (e) => {
     jQuery( '.vf_grid_infobox' ).remove();
  } );
  
});
