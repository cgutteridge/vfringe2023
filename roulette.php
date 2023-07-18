<?php

add_shortcode('chrisvf_random', 'chrisvf_render_random');

/*********************************************************************************
 ROULETTE
 *********************************************************************************/
function chrisvf_render_random( $atts = [], $content = null) {
  $events = chrisvf_get_events();
  shuffle( $events );
  $h = "";
  $r=0;
  $h.= "<div style='margin-top:1em;text-align:center'><button id='rbutton'>STOP</button></div>";
  $h.= "<div style='height:500px; padding: 1em; text-align:centre'>";
  foreach( $events as $event ) {
   $time_t = strtotime($event["DTSTART"]);
   if( $time_t < chrisvf_time() ) { continue; } # skip done events
   ++$r;
   $h .="<div class='rcell' id='r$r' style='".($r==1?"":"display:none;")." text-align:center;'>";
   $h .= "<div style='font-size:150%'>";
   $h .=$event["SUMMARY"];
   $h .= " @ ";
   $h .=$event["LOCATION"];
   $h .= " <br/> ";
   $time_t = strtotime($event["DTSTART"]);
   $h .= date("l jS",$time_t);
   $h .= " - ";
   $h .= date("H:i",$time_t);
   $h .="</div>";
   $code = $event["UID"];
   if( !empty( $event["URL"] ) ) {
     $h .= "<a href='".$event["URL"]."' class='vf_itinerary_button'>More information</a>";
   }
   $h.= "<div class='vf_itinerary_toggle' data-code='$code'></div>";
   $h .="</div>";
  }
  $h .="</div>";

  $h .= "<script>
jQuery(document).ready( function() {
  var maxr=$r;
  var r = 1;
  var rrunning = true;
  setInterval( nextr, 50 );
  function nextr() {
    if( !rrunning ) { return; }
    r++;
    if( r>maxr ) { r=1; }
    jQuery( '.rcell' ).hide();
    jQuery( '#r'+r ).show();
  }
  jQuery( '#rbutton' ).click( function() {
    if( rrunning ) {
      jQuery( '#rbutton' ).text( 'START' );
      rrunning = false;
    } else {
      jQuery( '#rbutton' ).text( 'STOP' );
      rrunning = true;
    }
  });
});
jQuery(document).ready(vfItineraryInit);
</script>
<style>
</style>
";
   //print_r( $events );
  return $h;
}
/*********************************************************************************
 end of ROULETTE
 *********************************************************************************/

