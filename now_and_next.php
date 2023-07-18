<?php

/*********************************************************************************
 NOW AND NEXT SLUG
 *********************************************************************************/

add_shortcode('chrisvf_now_and_next', 'chrisvf_now_and_next');

function chrisvf_now_and_next() {

  // load events
#  $query = new EntityFieldQuery();
#  $entities = $query->entityCondition('entity_type', 'node')
#                 ->addTag('efq_debug')
#                 ->entityCondition('bundle','event' )
#                 ->propertyCondition( 'status', 1 )
#                 ->fieldCondition( 'field_event_classification', 'value', array( 'vFringe','Festival' ) ,"IN" )
#                 ->fieldCondition('field_date','value2',date( "Y-m-d" ),'>=' )
#                 ->execute();
#  @$events = entity_load('node',array_keys($entities['node']));

  $entities = array();


  $list = array();
  foreach( $events as $event ) {
    foreach( $event->field_date['und'] as $date ) {

      $start = $date["value"]." ".$date["timezone_db"];
      $time_t = strtotime( $start );
      $end = $date["value2"]." ".$date["timezone_db"];
      $end_t = strtotime( $end );
      if( $end_t < chrisvf_time() ) { continue; } # skip done events

      $tid = $event->field_venue['und'][0]['tid'];

      $free = false;
      if( @$event->field_promo['und'] ) {
        foreach( $event->field_promo['und'] as $value ) {
          if( $value['tid'] == 17 || $value['tid'] == 212 ) { $free = true; }
        }
      }

      $venue = $venues[$event->field_venue['und'][0]['tid']];
      if( $time_t>chrisvf_time() && $time_t<chrisvf_time()+90*60 ) {
        #starts in the next 90 minutes
        $list[]= "<div>".date( "ga",$time_t)." - <strong><a href='".url('node/'. $event->nid)."'>". htmlspecialchars( $event->title, ENT_QUOTES ) ."</strong></a> - <a href='".url('taxonomy/term/'. $venue->tid)."'>".$venue->name."</a></a></div>";
      }
      if( $time_t<chrisvf_time() && $end_t>chrisvf_time()+10*60 && $free ) {  # free,
        #starts in the next 90 minutes
        $list[]= "<div>Now - <strong><a href='".url('node/'. $event->nid)."'>". htmlspecialchars( $event->title, ENT_QUOTES )."</strong></a> - <a href='".url('taxonomy/term/'. $venue->tid)."'>".$venue->name."</a></div>" ;
      }
    }
  }
  $h = "";
  $slides = array(array());
  $PER_SLIDE = 3;
  foreach( $list as $text ) {
    if( sizeof( $slides[sizeof($slides)-1] ) >= $PER_SLIDE ) {
      array_push( $slides, array() );
    }
    $slides[sizeof($slides)-1] []= $text;
  }
  $path = drupal_get_path('module', 'chrisvf_extras');


  $h= "<div class='cycleslideshow' style='font-size:70%'>";
  foreach( $slides as $slide ) {
    $h .= "<div class='nownext_slide'>".join( "", $slide )."</div>";
  }
  $h .= "</div>";
  $h .= '<script src="/'.$path.'/jquery.cycle.lite.js"></script>';
  $h .= "<script>
jQuery(document).ready(function(){
  jQuery('.cycleslideshow').cycle({ fx:    'fade', speed:  300, timeout: 3500 });
});
</script>";
  return $h;
}

/*********************************************************************************
 end of NOW AND NEXT SLUG
 *********************************************************************************/
