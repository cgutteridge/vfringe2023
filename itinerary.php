<?php

/*********************************************************************************
 ITINERARY
 *********************************************************************************/

add_shortcode('chrisvf_itinerary', 'chrisvf_render_itinerary');
add_shortcode('chrisvf_saved_itinerary', 'chrisvf_render_saved_itinerary');
add_shortcode('chrisvf_itinerary_slug', 'chrisvf_render_itinerary_slug');
add_action( 'tribe_events_single_event_after_the_content', 'chrisvf_print_itinerary_add' );


function chrisvf_add_itinerary_scripts() {
    wp_register_style( 'chrisvf-itinerary', plugins_url('itinerary.css', __FILE__) );
    wp_enqueue_style( 'chrisvf-itinerary' );

    wp_register_script( 'chrisvf-itinerary', plugins_url('itinerary.js', __FILE__), array( 'jquery' ) );
    wp_enqueue_script( 'chrisvf-itinerary' );
}
add_action( 'wp_enqueue_scripts', 'chrisvf_add_itinerary_scripts' );

function chrisvf_print_itinerary_add( $atts = [], $content = null) {
  global $wp_query;
  $code = $wp_query->post->ID."-".tribe_get_start_date( $wp_query->post->ID, false, 'U' );
  print "<div class='vf_itinerary_toggle' data-code='$code'></div>";
  print "<a href='/itinerary' class='vf_itinerary_button'>View itinerary</a>";

  $link = get_permalink( $ep_query->post->ID );
  $title = $wp_query->post->post_title ;
  $dayofweek = tribe_get_start_date( $wp_query->post->ID, false, 'l' );

  $msg = "This $dayofweek, I'm going to see $title at #VFringe17 $link";
  print "<a href='https://twitter.com/intent/tweet?text=".urlencode($msg)."' class='vf_itinerary_button'>Tweet this</a>";
  print "<a href='https://www.facebook.com/sharer/sharer.php?u=".urlencode($link)."' class='vf_itinerary_button'>Share on Facebook</a>";
  print "<script>jQuery(document).ready(vfItineraryInit);</script>";
}

function chrisvf_render_itinerary_slug( $atts = [], $content = null) {
  $itinerary = chrisvf_get_itinerary();
  $size = count($itinerary["codes"]);
  $style = "";
  if( $size == 0 ) {
   # $style = "display:none";
    $it_count = "";
  } elseif( $size == 1 ) {
    $it_count = "1 event in your itinerary.";
  } else {
    $it_count = "$size events in your itinerary.";
  }

#  $cache = cache_get('chrisvf_now_and_next');
#  if( $cache && $cache->expire > chrisvf_time() ) {
#    $nownext = $cache->data;
#  } else {
#    $nownext = chrisvf_now_and_next();
#    cache_set('chrisvf_now_and_next', $nownext, 'cache', chrisvf_time()+60*5); // cache these for 5 minutes
#  }

  $slug = "
<div class='vf_fred'>
  <div class='vf_itinerary_bar'>
    <div class='vf_itinerary_display' style='$style'><div class='vf_itinerary_count'>$it_count</div><a href='/vfringe/itinerary' class='view_itinerary vf_itinerary_button'>View itinerary</a></div>
    <div class='vf_itinerary_bar_links' style='display:inline-block'><a href='/vfringe/map' class='vf_itinerary_button'>Festival Map</a><a href='/vfringe/planner#today' class='vf_itinerary_button'>Festival Planner</a></div>
  </div>
</div>
";
#<div class='vf_badger' style='min-height: 90px'>$nownext</div>
  return $slug;
}


function chrisvf_get_itinerary($ids=null) {

  global $chrisvf_itinerary;

  if( !isset( $chrisvf_itinerary ) ) {
    $chrisvf_itinerary = array();
    if( @$_COOKIE["itinerary"] ) {
      $chrisvf_itinerary["codes"] = preg_split( '/,/', $_COOKIE["itinerary"] );
    } else {
      $chrisvf_itinerary["codes"] = array();
    }
    // get itinerary from cache

    // load events
    $events = chrisvf_get_events();
    $chrisvf_itinerary["events"] = array();
    foreach( $chrisvf_itinerary["codes"] as $code ) {
      $chrisvf_itinerary["events"][$code] = $events[$code];
    }
  }
  return $chrisvf_itinerary;
}

function chrisvf_render_itinerary( $atts = [], $content = null) {
  $itinerary = chrisvf_get_itinerary();

  $h = array();
  $list = array();
  $script = array();
  #$h []= "<h1>Your Ventnor Fringe and Festival Itinerary</h1>";
  $h []= "<p>This list is saved on your browser using a cookie.</p>";
  if( count($itinerary['codes']) ) {
    $h[]= "<p style='display:none' ";
  } else {
    $h[]= "<p ";
  }
  $h []= "class='vf_itinerary_none'>No items in your itinerary. Browse the website and add some.</p>";
  if( count($itinerary['codes']) ) {
    $h []= chrisvf_render_itinerary_table( $itinerary );

    $link = "https://vfringe.co.uk/saved-itinerary?ids=".urlencode( $_COOKIE["itinerary"] );
    $msg = "My #VFringe21 plan: $link";
    $h []= "<div>";
    $h []= "<a href='https://twitter.com/intent/tweet?text=".urlencode($msg)."' class='vf_itinerary_button'>Tweet my Itinerary</a>";
    $h []= "<a href='https://www.facebook.com/sharer/sharer.php?u=".urlencode($link)."' class='vf_itinerary_button'>Post to Facebook</a>";
    $body = "\r\nYour Ventnor Fringe 2022 Itinerary\r\n";
    $body = "\r\n";

    foreach( $itinerary['codes'] as $code ) {
      $event = @$itinerary['events'][$code];
      if( !$event ) {
        $time_t = 0;
      } else {
        $time_t = strtotime($event["DTSTART"]);
      }
      if( @!is_array( $list[$time_t] ) ) { $list[$time_t][]=$code; }
    }
    ksort( $list );
    global $vf_js_id;
    $lastday = "NULL";
    foreach( $list as $start_time=>$codes ) {
      foreach( $codes as $code ) {
        $event = @$itinerary['events'][$code];
        if( !$event ) { continue; }
        $thisday = date( "l jS", $start_time );
        if( $thisday != $lastday ) {
          $body.= "\r\n$thisday\r\n";
          $lastday=$thisday;
        }
        $body.= "".date("H:i",$start_time);
        if( @$event["DTEND"] ) {
          $end_t = strtotime($event["DTEND"]);
          $body.= "-".  date("H:i",$end_t);
        }
        $body .= ' : '.$event["SUMMARY"];
        $body .= ' @ '.$event["LOCATION"];

        if( !empty( $event["URL"] ) ) {
          $body .= ' - '. $event["URL"];
        }
        $body .="\r\n";
      }
    }

    #$body = "\r\n\r\nView online at: ".$link;
    $h []= "<a href='mailto:?subject=Your%20Ventnor%20Fringe%20Itinerary&body=".preg_replace('/\+/','%20',urlencode($body))."' class='vf_itinerary_button'>Send by Email</a>";
    $h []= "</div>";
  }
  return join( "", $h) ;
}

function chrisvf_render_saved_itinerary( $atts = [], $content = null) {
  $itinerary = array();
  $itinerary["codes"] = preg_split( '/,/', $_GET['ids'] );
  $events = chrisvf_get_events();
  $itinerary["events"] = array();
  foreach( $itinerary["codes"] as $code ) {
    $itinerary["events"][$code] = $events[$code];
  }
  $h = "";
  if( !empty( $_GET['title'] ) ) {
    $h .= "<h3>".htmlspecialchars(preg_replace('/\\\\(.)/','$1', $_GET['title'] ))."</h3>";
  }
  $h .= chrisvf_render_itinerary_table( $itinerary, false );
  return $h;
}

function chrisvf_render_itinerary_table( $itinerary, $active = true ) {
  $h = array();
  $h []="<table class='vf_itinerary_table'>";

  $h []="<tr>";
  $h []="<th>Date</th>";
  $h []="<th>Start</th>";
  $h []="<th>End</th>";
  $h []="<th>Event</th>";
  $h []="<th>Venue</th>";
  if( $active ) { $h []="<th>Actions</th>"; }
  $h []="</tr>";

  foreach( $itinerary['codes'] as $code ) {
    $event = @$itinerary['events'][$code];
    if( !$event ) {
      $time_t = 0;
    } else {
      $time_t = strtotime($event["DTSTART"]);
    }
    if( @!is_array( $list[$time_t] ) ) { $list[$time_t][]=$code; }
  }
  ksort( $list );
  global $vf_js_id;
  foreach( $list as $start_time=>$codes ) {
    foreach( $codes as $code ) {
      ++$vf_js_id;
      $event = @$itinerary['events'][$code];
      $h []= "<tr id='${vf_js_id}_row'>";
      if( $event ) {
        $h []= "<td>".date("l jS F",$start_time)."</td>";
        $h []= "<td>".date("H:i",$start_time)."</td>";
        if( @$event["DTEND"] ) {
          $end_t = strtotime($event["DTEND"]);
          $h []= "<td>".date("H:i",$end_t)."</td>";
        } else {
          $h []= "<td></td>";
        }

        if( empty( $event["URL"] ) ) {
          $h []= "<td>".$event["SUMMARY"]."</td>";
        } else {
          $h []= "<td><a href='".$event["URL"]."'>".$event["SUMMARY"]."</a></td>";
        }
        #$venue = $venues[$event->field_venue['und'][0]['tid']];
	$h []= "<td>". $event["LOCATION"]."</td>";
        #$h []= "<td><a href='".url('taxonomy/term/'. $venue->tid)."'>".$venue->name."</a></td>";

      } else {
        $h []= "<td></td>";
        $h []= "<td></td>";
        $h []= "<td></td>";
        $h []= "<td></td>";
        $h []= "<td>Error, event missing (may have been erased or altered. Sorry.)</td>";
      }
      if( $active ) { $h []= "<td><div class='vf_itinerary_button vf_itinerary_remove_button' id='${vf_js_id}_remove'>Remove from itinerary</div>"; }
      $h []= "</tr>";
      $script []= "jQuery( '#${vf_js_id}_remove' ).click(function(){ jQuery( '#${vf_js_id}_row' ).hide(); vfItineraryRemove( '".$code."' ) });\n";
    }
  }
  $h []= "</table>";

  $h []= "<script>jQuery(document).ready(function(){\n".join( "", $script )."});</script>";
  return join( "", $h) ;
}
