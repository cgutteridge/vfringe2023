jQuery(document).ready(function() {
	/*
  jQuery('.vf_grid_event[data-url]').click( function() {
    var d = jQuery( this );
    window.open( d.attr( 'data-url' ), '_self' );
  }).css( 'cursor','pointer' );
	*/

  jQuery('.vf_grid_event[data-url]').each( (index,element)=> {
    const event = jQuery(element);
    const code = event.attr( 'data-code' );
    const add = event.find( ".vf_grid_it_add" );
    const remove = event.find( ".vf_grid_it_remove" );
    add.click( ()=>{
      vfItineraryAdd( code );
      event.addClass('vf_grid_it');
    });
    remove.click( ()=>{
      vfItineraryRemove( code );
      event.removeClass('vf_grid_it');
    });
  
  });

  jQuery( '.vf_grid_event' ).on( 'mouseenter', (e) => {
     var ratio_down_page = e.clientY/jQuery(window).height();
     var pos_class = ratio_down_page<0.5 ? 'vf_grid_infobox_bottom' : 'vf_grid_infobox_top';
     var desc = jQuery( e.target ).find( '.vf_grid_cell_desc' );
     if( desc.text().trim() != "" ) {
       var infobox = jQuery( '<div class=\"vf_grid_infobox '+pos_class+'\"></div>' ).html( desc.html() );
       jQuery( 'body' ).append( infobox );
     }
  });
  jQuery( '.vf_grid_event' ).on( 'mouseleave', (e) => {
     jQuery( '.vf_grid_infobox' ).remove();
  } );
  
});
