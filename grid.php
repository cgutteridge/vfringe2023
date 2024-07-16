<?php

/*********************************************************************************
 GRID
 *********************************************************************************/

add_shortcode('chrisvf_grid', 'chrisvf_render_grid_day');

add_action( 'wp_enqueue_scripts', 'chrisvf_add_grid_scripts' );
function chrisvf_add_grid_scripts() {
    wp_register_style( 'chrisvf-grid-css', plugins_url('grid.css', __FILE__) );
    wp_enqueue_style( 'chrisvf-grid-css' );
    wp_register_script( 'chrisvf-grid-js', plugins_url('grid.js', __FILE__), array( 'jquery' ) );
    wp_enqueue_script( 'chrisvf-grid-js' );
}


// get the time_t for start and end of this event
function chrisvf_event_time($event, $min_t=null, $max_t=null) {
  $allTimes = array();

  if( strlen($event["DTSTART"]) == 8 ) { return $allTimes; } # all day events look kak in the grid

  # no loop, one time per event!
  #foreach( $event->field_date["und"] as $date ) {
    $times = array();
    $times['start'] = strtotime( $event["DTSTART"] );

    if( @$event["DTEND"] && $event["DTEND"]!=$event["DTSTART"]) {
      $times['end'] = strtotime($event["DTEND"]);
      $times['est'] = false;
    } else {
      $times['end'] = $times['start']+3600; // guess an hour
      $times['est'] = true;
    }

  return $times;

}

# is this even needed????
function chrisvf_render_grid_list() {
  $h = array();

  // load events
  $events = chrisvf_get_events(); // add day filter etc.
  $lists = [];
  foreach( $events as $event ) {
    $date = substr( $event["DTSTART"], 0, 8 );
    $time = substr( $event["DTSTART"], 9, 4 );
    $time2 = substr( $event["DTEND"], 9, 4 );
    $loc = $event["LOCATION"];
    if( !array_key_exists($date,$lists) ) { $lists[$date] = []; }
    if( !array_key_exists($time,$lists[$date]) ) { $lists[$date][$time] = []; }
    if( !array_key_exists($loc, $lists[$date][$time]) ) { $lists[$date][$time][$loc] = []; }
    $note = "";
    if( preg_match( '/Free Fringe/', $event["CATEGORIES"] ) ) { $note = " (Free)"; }
    $lists[$date][$time][$loc] []= "<div>".substr( $time,0,2).":".substr( $time,2,2)." to ".substr( $time2,0,2).":".substr( $time2,2,2)." - $loc - ".$event["SUMMARY"].$note."</div>\n";
  }
  $h []= "<div style='background-color:#fff;padding:1em'>";
  ksort( $lists );
  foreach( $lists as $date=>$daylist ) {
    $h []= "<div style='margin-bottom: 3em;    page-break-before: always;'>";
    $time_t = strtotime( $date );
    $h []= "<h2 style='margin-bottom:1em'>".date( "l jS F", $time_t ). "</h2>";
    ksort( $daylist );
    foreach( $daylist as $time => $timelist ) {
      if( substr( $time, 2,2) == "00" ) { $h []= "<div>&nbsp;</div>"; }
      ksort( $timelist );
      foreach( $timelist as $loc=>$list3 ) { 
        $h []= join( "", $list3 );
      }
    }
    $h []= "</div>";
  }
  $h []= "</div>";
  return join( "", $h );
}




function chrisvf_render_grid_day( $attr ) {

  $date = $attr["date"];

  $day_start = "08:00:00 BST";
  $day_end = "02:00:00 BST";

  $start_t = strtotime( "$date $day_start" );
  $end_t = strtotime( "$date $day_end" )+60*60*24;

  $start = gmdate("Y-m-d H:i", $start_t );
  $end = gmdate("Y-m-d H:i", $end_t );

  // load events
  $events = chrisvf_get_events(); // add day filter etc.
  if( !$events ) {
    return "<p>No events</p>";
  }

  // work out timeslots
  $times = array();
  foreach( $events as $event ) {
    if( @$event["ALLDAY"] ) { continue; }
    $ev_time = chrisvf_event_time($event);
    if( $ev_time['start'] >= $end_t ) { continue; } // starts after our window
    if( $ev_time['end'] <= $start_t ) { continue; } // ends before our window
    if( $ev_time['start'] < $start_t ) { $ev_time['start'] = $start_t; }
    if( $ev_time['end']>$end_t ) { $ev_time['end'] = $end_t; }
    $times[$ev_time['start']] = true;
    $times[$ev_time['end']] = true;
  }

  # assumes start_t is on the hour!?!
  for( $t=$start_t; $t<=$end_t; $t+=3600 ) {
    $times[$t] = true;
  }

  ksort($times);
  $times = array_keys( $times );

  $timeslots = array();
  $timemap = array();
  for($i=0;$i<sizeof($times);++$i) {
    if( $i<sizeof($times)-1 ) {
      # the last time isn't a timeslot but it still has an index
      $timeslots []= array( "start"=>$times[$i], "end"=>$times[$i+1] );
    }
    $timemap[ $times[$i] ] = $i;
  }

  $venues = array();
  // build up grid
  $grid = array(); # venue=>list of columns for venu
  foreach( $events as $event ) {
    if( @$event["ALLDAY"] ) { continue; }
    $ev_time =chrisvf_event_time($event);


      if( $ev_time['start'] >= $end_t ) { continue; } // starts after our window
      if( $ev_time['end'] <= $start_t ) { continue; } // ends before our window
      if( $ev_time['start'] < $start_t ) { $ev_time['start'] = $start_t; }
      if( $ev_time['end']>$end_t ) { $ev_time['end'] = $end_t; }

      $venue_id = $event["LOCATION"];
      $venues[$event["SORTCODE"]] = $venue_id;

      $start_i = $timemap[$ev_time['start']];
      $end_i = $timemap[$ev_time['end']];

      $column_id = null;
      if( !@$grid[$venue_id] ) {
        # no columns. Leave column_id null and init a place to put columns
        $grid[$venue_id] = array();
      } else {
        # find a column with space, if any
        for( $c=0;$c<sizeof($grid[$venue_id]);++$c ) {
          // check all the slots this event needs
          for($p=$start_i;$p<$end_i;++$p ) {
            if( $grid[$venue_id][$c][$p]['used'] ) {
              continue(2); // skip to next column
            }
          }
          // ok looks like this column is clear!
          $column_id = $c;
          break;
        }
      }
      if( $column_id === null ) {
        $col = array();
        for($p=0;$p<sizeof($timeslots);++$p) {
          $col[$p] = array( "used"=>false );
        }
        $grid[$venue_id][] = $col;
        $column_id = sizeof($grid[$venue_id])-1;
      }

      // ok. column_id is now a real column and has space
      // fill out the things as used
      for( $p=$start_i; $p<$end_i; ++$p ) {
        $grid[$venue_id][$column_id][$p]["used"] = true;
      }
      // then put this event in the top one.
      $grid[$venue_id][$column_id][$start_i]["event"] = $event;
      $grid[$venue_id][$column_id][$start_i]["start_i"] = $start_i;
      $grid[$venue_id][$column_id][$start_i]["end_i"] = $end_i;
      $grid[$venue_id][$column_id][$start_i]["width"] = 1;
      $grid[$venue_id][$column_id][$start_i]["est"] = $ev_time['est'];
      $grid[$venue_id][$column_id][$start_i]["code"] = preg_replace( '/@.*/', '',  $event["UID"] );
  } // end of events loop

  // venue ids. Could/should sort this later
  ksort( $venues );

  // see if we can expand any events to fill the space available.
  foreach( $venues as $venue_id ) {
    $cols = $grid[$venue_id];
    // look at columns except the last one...
    for( $c1=0;$c1<sizeof($cols)-1;++$c1 ) {
      for( $slot1=0;$slot1<sizeof($cols[$c1]);++$slot1 ) {

        // only try to expand actual events
        if( !@$cols[$c1][$slot1]['event'] ) { continue; }

        // try to add this event to additional columns
        for($c2=$c1+1;$c2<sizeof($cols);++$c2) {  // loop of remaining columns
          for( $slot2=$slot1;$slot2<$cols[$c1][$slot1]['end_i'];$slot2++ ) {
            if( $cols[$c2][$slot2]["used"] ) { break(2); }
          }
          // OK, this column gap is free. set it to used and widen the event
          for( $slot2=$slot1;$slot2<$cols[$c1][$slot1]['end_i'];$slot2++ ) {
            $grid[$venue_id][$c2][$slot2]["used"]=true;
          }
          $grid[$venue_id][$c1][$slot1]['width']++;
          // ok.. loop back to try any remaining columns

        } // break(2) exits here go to next event
      }
    }
  }

  $itinerary = chrisvf_get_itinerary();

  $h = array();
  $h[]= "<div class='vf_grid_outer'>";
  $h[]= "<table class='vf_grid'>";

  // Venue headings
  $h[]= "<tr>";
  $h[]= "<th></th>";
  foreach( $venues as $venue_id ) {
    $cols = $grid[$venue_id];
    $h[]= "<th class='vf_grid_venue' colspan='".sizeof( $cols )."'>";
    $h[]= $venue_id;
    $h[]= "</th>\n";
  }
  $h[]= "<th></th>";
  $h[]= "</tr>\n";

  $odd_row = true;
  foreach( $timeslots as $p=>$slot ) {
    $hour = date("H",$slot["start"]);
    $row_classes = "";
    if( $odd_row ) {
      $row_classes.= " vf_grid_row_odd";
    } else {
      $row_classes.= " vf_grid_row_even";
    }
    if( $hour % 2 ) {
      $row_classes.= " vf_grid_row_hour_odd";
    } else {
      $row_classes.= " vf_grid_row_hour_even";
    }
    $h[]= "<tr class='$row_classes'>";
    $odd_row = !$odd_row;
    $h[]= "<th class='vf_grid_timeslot'>".date("H:i",$slot["start"])."</th>";
    #$h[]= "<th class='vf_grid_timeslot'>".date("d H:i",$slot["end"])."</th>";
    $odd_col = true;
    foreach( $venues as $venue_id ) {

      for( $col_id=0; $col_id<sizeof($grid[$venue_id]); ++$col_id ) {
        $col = $grid[$venue_id][$col_id];
        $cell = $col[$p];

        if( $odd_col ) {
          $classes = "vf_grid_col_odd";
        } else {
          $classes = "vf_grid_col_even";
        }
        if( $col_id==sizeof($grid[$venue_id])-1 ) {
          $classes .= " vf_grid_col_vlast"; // last column for this venue
        }
        $classes .= " vf_grid_venue_".preg_replace( "/[^a-z0-9]/i", "", strtolower($venue_id) );

        if( @$cell['event'] ) {
          $h []= render_event($cell,$classes,$itinerary);
        } else if( $cell["used"] ) {
          $h []= "";
        } else {
          foreach( $itinerary['events'] as $code=>$i_event ) {
            $t2 = chrisvf_event_time($i_event );
            if( $slot['start']<$t2['end'] && $slot['end']>$t2['start'] ) {
              $classes .= " vf_grid_busy";
            }
          }
          $h[]= "<td class='$classes vf_grid_freecell'></td>";
        }
      }
      $odd_col = !$odd_col;
    }
    $h[]= "<th class='vf_grid_timeslot'>".date("H:i",$slot["start"])."</th>";
    $h[]= "</tr>\n";
  }

  // Venue headings
  $h[]= "<tr>";
  $h[]= "<th></th>";
  foreach( $venues as $venue_id ) {
    $cols = $grid[$venue_id];
    $h[]= "<th class='vf_grid_venue' colspan='".sizeof( $cols )."'>";
    $h[]= $venue_id;
    $h[]= "</th>\n";
  }
  $h[]= "<th></th>";
  $h[]= "</tr>\n";

  $h[]= "</table>";
  $h[]= "</div>";
  return join( "", $h );
}

function render_event($cell, $classes, $itinerary) {
  $h = [];
  $url= $cell["event"]["URL"];
  $height = $cell['end_i'] - $cell['start_i'];
  $classes.= ' vf_grid_event';

  if( @$itinerary['events'][$cell['code']] ) {
    $classes .= " vf_grid_it";
  }

  if( $cell['est'] ) {
    $classes.=' vf_grid_event_noend';
  }
  $id = "g".preg_replace( '/-/','_',$cell['event']['UID'] );
  $h[]= "<td id='$id' data-code='".$cell['event']['UID']."' class='$classes' colspan='".$cell['width']."' rowspan='$height' ".(empty($url)?"":"data-url='".$url."'").">";
  $h[]= "<div class='vf_grid_it_control'>";
  $h[]= "<div class='vf_grid_it_toggle vf_grid_it_add'>SAVE</div>";
  $h[]= "<div class='vf_grid_it_toggle vf_grid_it_remove'>FORGET</div>";
  $h[]= "</div>";

  if( !empty($url) ) { $h[]="<a href='$url'>"; }

  $h[]= "<div class='vf_grid_event_middle'>";
  $h[]= "<div class='vf_grid_inner'>";

  $h[]= "<div class='vf_grid_cell_title'>". $cell['event']["SUMMARY"]."</div>";
  $h[]= "<div class='vf_grid_cell_desc' style='display:none'>". $cell['event']["DESCRIPTION"]."</div>";

  if( $cell['est'] ) {
    $h[]= "<div>[End time not yet known]</div>";
  }
  $h[]= "</div>"; # event inner
  $h[]= "</div>"; # event middle
  if( !empty($url) ) { $h[]="</a>"; }
  $h[]= "</td>";
  return join( "", $h );
}



