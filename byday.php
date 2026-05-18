<?php

/*********************************************************************************
 * BY DAY SLUG
 *********************************************************************************/

add_shortcode('chrisvf_by_day', 'chrisvf_by_day');
add_action('wp_enqueue_scripts', 'chrisvf_add_by_day_scripts');
function chrisvf_add_by_day_scripts()
{
    # register them here, but only enqueue if we need them
#    wp_register_script('chrisvf-now-and-next-js', plugins_url('by_day.js', __FILE__));
#    wp_enqueue_script('chrisvf-now-and-next-js');

    wp_register_style('chrisvf-by-day', plugins_url('byday.css', __FILE__));
    wp_enqueue_style('chrisvf-by-day');
}

// Define the comparison function
function chrisvf_byday_compareByFirst($a, $b)
{
    $dateA = strtotime($a['first']);
    $dateB = strtotime($b['first']);
    return $dateA - $dateB;
}

function chrisvf_byday_isoToNicetime( $iso ) {
    $hour = substr($iso,9,2)+0;
    $min = substr($iso,11,2)+0;
    $ampm = "am";
    if( $hour >= 12) {
        $ampm = "pm";
    }
    if( $hour >= 13 ) {
        $hour -= 12;
    }
    return $hour.($min==0?"":":$min").$ampm;
}



function chrisvf_by_day($attr)
{

    $date = $attr["date"];
    if( $date == "today") {
        $date = date('Y-m-d');
    }

    $day_start = "08:00:00 BST";
    $day_end = "02:00:00 BST";

    $timeWindowStartT = strtotime("$date $day_start");
    $timeWindowEndT = strtotime("$date $day_end") + 60 * 60 * 24;

    $window_start = gmdate("Y-m-d H:i", $timeWindowStartT);
    $window_end = gmdate("Y-m-d H:i", $timeWindowEndT);

    // load events
    $events = chrisvf_get_events(); // add day filter etc.
    if (!$events) {
        return "<p>No events</p>";
    }

    $thisDayEvents = [];
    foreach ($events as $event) {
        $start_t = strtotime($event["DTSTART"]);
        $end_t = strtotime($event["DTEND"]);
        if ($start_t >= $timeWindowStartT && $start_t <= $timeWindowEndT) {
            $thisDayEvents [] = $event;
        }
    }

    // only include the first instance of each event
    $eventsByNameAndLocation = [];
    foreach ($thisDayEvents as $event) {
        $code = $event["LOCATION"] . ":" . $event["SUMMARY"];
        if (!array_key_exists($code, $eventsByNameAndLocation)) {
            $eventsByNameAndLocation[$code] = [
                "event" => $event,
                "times" => [],
                "first" => $event["DTSTART"]
            ];
        }
        $eventsByNameAndLocation[$code]["times"] [] = $event["DTSTART"];
        $eventsByNameAndLocation[$code]["first"] = min(
            $event["DTSTART"],
            $eventsByNameAndLocation[$code]["first"]
        );
    }

    usort($eventsByNameAndLocation, "chrisvf_byday_compareByFirst");

    $h = "";
    $h.= "<table class='chrisvf-byday-table'>";
    foreach($eventsByNameAndLocation as $eventSet) {
        $categories = explode(",", $eventSet["event"]['CATEGORIES']);
        $free = in_array('Free Fringe', $categories) ? " - FREE" : "";
        $h.= "<tr>";
        $h.= "<td>". chrisvf_byday_isoToNicetime($eventSet["first"]) ."</td>";
        if( $eventSet["event"]["URL"] != '' ) {
            $h.= "<td><a href='".$eventSet['event']['URL']."'>". htmlspecialchars($eventSet["event"]["SUMMARY"]) ."</a>$free</td>";

        } else {
            $h.= "<td>". htmlspecialchars($eventSet["event"]["SUMMARY"]) .$free."</td>";
        }
        $h.= "<td>". $eventSet["event"]["LOCATION"] ."</td>";
        $niceTimes = [];
        $otherTimes = $eventSet["times"];
        array_shift($otherTimes);
        foreach( $otherTimes as $time) {
            $niceTimes []= chrisvf_byday_isoToNicetime($time) ;
        }
        $h.= "<td>";
        if( count($niceTimes) > 0 ) {
            $h.="Also at ".join( ", ", $niceTimes);
        }
        $h.="</td>";

        $h.= "</tr>";
    }
    $h.= "</table>";
    return $h;
}

/*********************************************************************************
 * end of BY DAY SLUG
 *********************************************************************************/
