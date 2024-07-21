<?php

/*********************************************************************************
 * GRID
 *********************************************************************************/

add_shortcode('chrisvf_grid', 'chrisvf_render_grid_day');

add_action('wp_enqueue_scripts', 'chrisvf_add_grid_scripts');
function chrisvf_add_grid_scripts()
{
    wp_register_style('chrisvf-grid-css', plugins_url('grid.css', __FILE__), [], "1.001");
    wp_enqueue_style('chrisvf-grid-css');
    wp_register_script('chrisvf-grid-js', plugins_url('grid.js', __FILE__), array('jquery'), [], "1.001");
    wp_enqueue_script('chrisvf-grid-js');
}


// get the time_t for start and end of this event
function chrisvf_event_time($event, $min_t = null, $max_t = null)
{
    $allTimes = array();

    if (strlen($event["DTSTART"]) == 8) {
        return $allTimes;
    } # all day events look kak in the grid

    # no loop, one time per event!
    #foreach( $event->field_date["und"] as $date ) {
    $times = array();
    $times['start'] = strtotime($event["DTSTART"]);

    if (@$event["DTEND"] && $event["DTEND"] != $event["DTSTART"]) {
        $times['end'] = strtotime($event["DTEND"]);
        $times['est'] = false;
    } else {
        $times['end'] = $times['start'] + 3600; // guess an hour
        $times['est'] = true;
    }

    return $times;
}

function chrisvf_render_grid_day($attr)
{

    $date = $attr["date"];

    $day_start = "08:00:00 BST";
    $day_end = "02:00:00 BST";

    $timeWindowStartT = strtotime("$date $day_start");
    $timeWindowEndT = strtotime("$date $day_end") + 60 * 60 * 24;

    $start = gmdate("Y-m-d H:i", $timeWindowStartT);
    $end = gmdate("Y-m-d H:i", $timeWindowEndT);

    // load events
    $events = chrisvf_get_events(); // add day filter etc.
    if (!$events) {
        return "<p>No events</p>";
    }

    // work out timeslots
    $times = array();
    foreach ($events as $event) {
        if (@$event["ALLDAY"]) {
            continue;
        }
        $gridTimeRangeT = chrisvf_event_time($event);
        if ($gridTimeRangeT['start'] >= $timeWindowEndT) {
            continue;
        } // starts after our window
        if ($gridTimeRangeT['end'] <= $timeWindowStartT) {
            continue;
        } // ends before our window
        if ($gridTimeRangeT['start'] < $timeWindowStartT) {
            $gridTimeRangeT['start'] = $timeWindowStartT;
        }
        if ($gridTimeRangeT['end'] > $timeWindowEndT) {
            $gridTimeRangeT['end'] = $timeWindowEndT;
        }
        $times[$gridTimeRangeT['start']] = true;
        $times[$gridTimeRangeT['end']] = true;
    }

    # assumes timeWindowEndT is on the hour!?!
    for ($t = $timeWindowStartT; $t <= $timeWindowEndT; $t += 3600) {
        $times[$t] = true;
    }

    ksort($times);
    $times = array_keys($times);

    $timeslots = array();
    $timemap = array();
    for ($i = 0; $i < sizeof($times); ++$i) {
        if ($i < sizeof($times) - 1) {
            # the last time isn't a timeslot but it still has an index
            $timeslots [] = array("start" => $times[$i], "end" => $times[$i + 1]);
        }
        $timemap[$times[$i]] = $i;
    }

    list($venues, $grid) = buildUpGrid($events, $timeWindowEndT, $timeWindowStartT, $gridTimeRangeT, $timemap, $timeslots);

    // venue ids. Could/should sort this later
    ksort($venues);

    // see if we can expand any events to fill the space available.
    $grid = seeIfWeCanExpandAnyEventsToFillTheSpaceAvailable($venues, $grid);

    $itinerary = chrisvf_get_itinerary();

    $h = array();
    $h[] = "<div class='vf_grid_outer'>";
    $h[] = "<table class='vf_grid'>";

    // Venue headings
    $h[] = renderVenueHeadings($venues, $grid);

    $odd_row = true;
    foreach ($timeslots as $timeslotId => $slot) {
        $hour = date("H", $slot["start"]);
        $row_classes = "vf_grid_row_" . ($odd_row ? "odd" : "even") . " " .
            "vf_grid_row_hour_" . ($hour % 2 ? "odd" : "even");
        $odd_row = !$odd_row;

        $h [] = renderGridRow($row_classes, $slot, $venues, $grid, $timeslotId, $itinerary);
    }

    // Venue headings
    $h[] = renderVenueHeadings($venues, $grid);

    $h[] = "</table>";
    $h[] = "</div>";
    return join("", $h);
}

/**
 * @param $events
 * @param $timeWindowEndT
 * @param $timeWindowStartT
 * @param array $gridTimeRangeT
 * @param array $timemap
 * @param array $timeslots
 * @return array[]
 */
function buildUpGrid($events, $timeWindowEndT, $timeWindowStartT, array $gridTimeRangeT, array $timemap, array $timeslots)
{
    $venues = array();
    // build up grid
    $grid = array(); # venue=>list of columns for venu
    foreach ($events as $event) {
        if (@$event["ALLDAY"]) {
            continue;
        }
        $gridTimeRangeT = chrisvf_event_time($event);


        if ($gridTimeRangeT['start'] >= $timeWindowEndT) {
            continue;
        } // starts after our window
        if ($gridTimeRangeT['end'] <= $timeWindowStartT) {
            continue;
        } // ends before our window
        if ($gridTimeRangeT['start'] < $timeWindowStartT) {
            $gridTimeRangeT['start'] = $timeWindowStartT;
        }
        if ($gridTimeRangeT['end'] > $timeWindowEndT) {
            $gridTimeRangeT['end'] = $timeWindowEndT;
        }

        $venue_id = $event["LOCATION"];
        $venues[$event["SORTCODE"]] = $venue_id;

        $start_i = $timemap[$gridTimeRangeT['start']];
        $end_i = $timemap[$gridTimeRangeT['end']];

        $column_id = null;
        if (!@$grid[$venue_id]) {
            # no columns. Leave column_id null and init a place to put columns
            $grid[$venue_id] = array();
        } else {
            # find a column with space, if any
            for ($c = 0; $c < sizeof($grid[$venue_id]); ++$c) {
                // check all the slots this event needs
                for ($p = $start_i; $p < $end_i; ++$p) {
                    if ($grid[$venue_id][$c][$p]['used']) {
                        continue(2); // skip to next column
                    }
                }
                // ok looks like this column is clear!
                $column_id = $c;
                break;
            }
        }
        if ($column_id === null) {
            $col = array();
            for ($p = 0; $p < sizeof($timeslots); ++$p) {
                $col[$p] = array("used" => false);
            }
            $grid[$venue_id][] = $col;
            $column_id = sizeof($grid[$venue_id]) - 1;
        }

        // ok. column_id is now a real column and has space
        // fill out the things as used
        for ($p = $start_i; $p < $end_i; ++$p) {
            $grid[$venue_id][$column_id][$p]["used"] = true;
        }
        // then put this event in the top one.
        $grid[$venue_id][$column_id][$start_i]["event"] = $event;
        $grid[$venue_id][$column_id][$start_i]["start_i"] = $start_i;
        $grid[$venue_id][$column_id][$start_i]["end_i"] = $end_i;
        $grid[$venue_id][$column_id][$start_i]["width"] = 1;
        $grid[$venue_id][$column_id][$start_i]["est"] = $gridTimeRangeT['est'];
        $grid[$venue_id][$column_id][$start_i]["code"] = preg_replace('/@.*/', '', $event["UID"]);
    }
    return array($venues, $grid); // end of events loop
}

/**
 * @param array $venues
 * @param array $grid
 * @return array
 */
function seeIfWeCanExpandAnyEventsToFillTheSpaceAvailable(array $venues, array $grid)
{
    foreach ($venues as $venue_id) {
        $cols = $grid[$venue_id];
        // look at columns except the last one...
        for ($c1 = 0; $c1 < sizeof($cols) - 1; ++$c1) {
            for ($slot1 = 0; $slot1 < sizeof($cols[$c1]); ++$slot1) {

                // only try to expand actual events
                if (!@$cols[$c1][$slot1]['event']) {
                    continue;
                }

                // try to add this event to additional columns
                for ($c2 = $c1 + 1; $c2 < sizeof($cols); ++$c2) {  // loop of remaining columns
                    for ($slot2 = $slot1; $slot2 < $cols[$c1][$slot1]['end_i']; $slot2++) {
                        if ($cols[$c2][$slot2]["used"]) {
                            break(2);
                        }
                    }
                    // OK, this column gap is free. set it to used and widen the event
                    for ($slot2 = $slot1; $slot2 < $cols[$c1][$slot1]['end_i']; $slot2++) {
                        $grid[$venue_id][$c2][$slot2]["used"] = true;
                    }
                    $grid[$venue_id][$c1][$slot1]['width']++;
                    // ok.. loop back to try any remaining columns

                } // break(2) exits here go to next event
            }
        }
    }
    return $grid;
}

/**
 * @param $row_classes
 * @param $slot
 * @param array $venues
 * @param array $grid
 * @param $timeslotId
 * @param array $itinerary
 * @return string
 */
function renderGridRow($row_classes, $slot, array $venues, array $grid, $timeslotId, array $itinerary)
{
    // same date format as used in ICAL
    $start = date('Ymd\THis', $slot["start"]);
    $end = date('Ymd\THis', $slot["end"]);
    $h = [];
    $h[] = "<tr class='$row_classes'>";
    $h[] = "<th class='vf_grid_timeslot'>" . date("H:i", $slot["start"]) . "</th>";
    $odd_col = true;
    foreach ($venues as $venue_id) {
        for ($col_id = 0; $col_id < sizeof($grid[$venue_id]); ++$col_id) {
            $col = $grid[$venue_id][$col_id];
            $cell = $col[$timeslotId];

            if ($odd_col) {
                $classes = "vf_grid_col_odd";
            } else {
                $classes = "vf_grid_col_even";
            }
            if ($col_id == sizeof($grid[$venue_id]) - 1) {
                $classes .= " vf_grid_col_vlast"; // last column for this venue
            }
            $classes .= " vf_grid_venue_" . preg_replace("/[^a-z0-9]/i", "", strtolower($venue_id));

            if (@$cell['event']) {
                $h [] = render_event($cell, $classes, $itinerary);
            } elseif ($cell["used"]) {
                $h [] = "";
            } else {
                $h[] = "<td class='$classes vf_grid_freecell' data-start='$start' data-end='$end'></td>";
            }
        }
        $odd_col = !$odd_col;
    }
    $h[] = "<th class='vf_grid_timeslot'>" . date("H:i", $slot["start"]) . "</th>";
    $h[] = "</tr>\n";
    return join('', $h);
}

/**
 * @param array $venues
 * @param array $grid
 * @return array
 */
function renderVenueHeadings(array $venues, array $grid)
{
    $h = [];
    $h[] = "<tr>";
    $h[] = "<th></th>";
    foreach ($venues as $venue_id) {
        $cols = $grid[$venue_id];
        $h[] = "<th class='vf_grid_venue' colspan='" . sizeof($cols) . "'>";
        $h[] = $venue_id;
        $h[] = "</th>\n";
    }
    $h[] = "<th></th>";
    $h[] = "</tr>\n";
    return join('', $h);
}

function render_event($cell, $classes, $itinerary)
{
    $h = [];

    $start = $cell['event']['DTSTART'];
    $end = $cell['event']['DTEND'];

    $url = $cell["event"]["URL"];
    $height = $cell['end_i'] - $cell['start_i'];

    $classes .= ' vf_grid_event';

    if (@$itinerary['events'][$cell['code']]) {
        $classes .= " vf_grid_it";
    }

    if ($cell['est']) {
        $classes .= ' vf_grid_event_noend';
    }
    $id = "g" . preg_replace('/-/', '_', $cell['event']['UID']);
    $h[] = "<td id='$id' data-code='" . $cell['event']['UID'] . "' class='$classes' colspan='" . $cell['width'] . "' rowspan='$height' " . (empty($url) ? "" : "data-url='" . $url . "'") . "  data-start='$start' data-end='$end'>";

    $h[] = "<div class='vf_grid_it_control'>";
    $h[] = "<div class='vf_grid_it_toggle vf_grid_it_add'>SAVE</div>";
    $h[] = "<div class='vf_grid_it_toggle vf_grid_it_remove'>FORGET</div>";
    $h[] = "</div>";

    if (!empty($url)) {
        $h[] = "<a href='$url'>";
    }

    $h[] = "<div class='vf_grid_event_middle'>";
    $h[] = "<div class='vf_grid_inner'>";

    $h[] = "<div class='vf_grid_cell_title'>" . $cell['event']["SUMMARY"] . "</div>";
    $categories = explode(",", $cell['event']['CATEGORIES']);
    if (in_array('Free Fringe', $categories)) {
        $h[] = "<div class='vf_grid_cell_tag'>FREE</div>";
    }
    $h[] = "<div class='vf_grid_cell_desc' style='display:none'>" . $cell['event']["DESCRIPTION"] . "</div>";

    if ($cell['est']) {
        $h[] = "<div>[End time not yet known]</div>";
    }
    $h[] = "</div>"; # event inner
    $h[] = "</div>"; # event middle
    if (!empty($url)) {
        $h[] = "</a>";
    }
    $h[] = "</td>";
    return join("", $h);
}



