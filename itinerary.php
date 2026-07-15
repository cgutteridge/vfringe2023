<?php

/*********************************************************************************
 * ITINERARY
 **************************************************************************/

add_shortcode('chrisvf_itinerary', 'chrisvf_render_itinerary');
add_shortcode('chrisvf_saved_itinerary', 'chrisvf_render_saved_itinerary');
add_shortcode('chrisvf_itinerary_slug', 'chrisvf_render_itinerary_slug');
add_action('tribe_events_single_event_after_the_content', 'chrisvf_print_itinerary_add');


function chrisvf_add_itinerary_scripts()
{
    wp_register_style('chrisvf-itinerary', plugins_url('itinerary.css', __FILE__));
    wp_enqueue_style('chrisvf-itinerary');

    wp_register_script('chrisvf-itinerary', plugins_url('itinerary.js', __FILE__), array('jquery'), '1.0.39');
    wp_enqueue_script('chrisvf-itinerary');
    wp_localize_script('chrisvf-itinerary', 'chrisvfItineraryConfig', array(
        // Query-string form always reaches WordPress (no rewrite flush; no .ics extension block).
        'icsUrl' => home_url('/?chrisvf_itinerary_ics=1'),
    ));
}

add_action('wp_enqueue_scripts', 'chrisvf_add_itinerary_scripts');

/**
 * Print add/remove itinerary controls after single-event content.
 *
 * @param array       $atts    Unused shortcode-style attrs.
 * @param string|null $content Unused.
 * @return void
 */
function chrisvf_print_itinerary_add($atts = [], $content = null)
{
    global $wp_query;
    $code = $wp_query->post->ID . "-" . tribe_get_start_date($wp_query->post->ID, false, 'U');
    print "<div class='vf_itinerary_toggle' data-code='$code'></div>";
    print "<a href='/itinerary' class='vf_itinerary_button'>View itinerary</a>";
    print "<script>jQuery(document).ready(vfItineraryInit);</script>";
}

function chrisvf_render_itinerary_slug($atts = [], $content = null)
{
    $itinerary = chrisvf_get_itinerary();
    $size = count($itinerary["codes"]);
    $style = "";
    if ($size == 0) {
        # $style = "display:none";
        $it_count = "";
    } elseif ($size == 1) {
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


function chrisvf_get_itinerary($ids = null)
{

    global $chrisvf_itinerary;

    if (!isset($chrisvf_itinerary)) {
        $chrisvf_itinerary = array();
        if (@$_COOKIE["itinerary2025"]) {
            $chrisvf_itinerary["codes"] = preg_split('/\|/', $_COOKIE["itinerary2025"]);
        } else {
            $chrisvf_itinerary["codes"] = array();
        }
        // get itinerary from cache

        // load events
        $events = chrisvf_get_events();
        $chrisvf_itinerary["events"] = array();
        foreach ($chrisvf_itinerary["codes"] as $code) {
            $chrisvf_itinerary["events"][$code] = $events[$code];
        }
    }
    return $chrisvf_itinerary;
}

/**
 * Build a chronologically sorted normalized export payload for itinerary JS.
 *
 * @param array $itinerary Itinerary from chrisvf_get_itinerary() (codes + events).
 * @return array<int, array{start: string, end: string, summary: string, location: string, url: string}>
 */
function chrisvf_itinerary_export_events(array $itinerary)
{
    $byStart = array();
    foreach ($itinerary['codes'] as $code) {
        $event = @$itinerary['events'][$code];
        if (!$event || empty($event['DTSTART'])) {
            continue;
        }
        $timeT = strtotime($event['DTSTART']);
        if ($timeT === false) {
            $timeT = 0;
        }
        if (!isset($byStart[$timeT]) || !is_array($byStart[$timeT])) {
            $byStart[$timeT] = array();
        }
        $byStart[$timeT][] = $event;
    }
    ksort($byStart);

    $normalized = array();
    foreach ($byStart as $eventsAtTime) {
        foreach ($eventsAtTime as $event) {
            $normalized[] = array(
                'start' => (string) $event['DTSTART'],
                'end' => !empty($event['DTEND']) ? (string) $event['DTEND'] : '',
                'summary' => !empty($event['SUMMARY']) ? (string) $event['SUMMARY'] : '',
                'location' => !empty($event['LOCATION']) ? (string) $event['LOCATION'] : '',
                'url' => !empty($event['URL']) ? (string) $event['URL'] : '',
            );
        }
    }

    return $normalized;
}

/**
 * Render the desktop itinerary shortcode: table plus email/copy export actions.
 *
 * @param array       $atts    Unused.
 * @param string|null $content Unused.
 * @return string
 */
function chrisvf_render_itinerary($atts = [], $content = null)
{
    $itinerary = chrisvf_get_itinerary();

    $h = array();
    #$h []= "<h1>Your Ventnor Fringe and Festival Itinerary</h1>";
    $h [] = "<p>This list is saved on your browser using a cookie.</p>";
    if (count($itinerary['codes'])) {
        $h[] = "<p style='display:none' ";
    } else {
        $h[] = "<p ";
    }
    $h [] = "class='vf_itinerary_none'>No items in your itinerary. Browse the website and add some.</p>";
    if (count($itinerary['codes'])) {
        $h [] = chrisvf_render_itinerary_table($itinerary);

        $exportEvents = chrisvf_itinerary_export_events($itinerary);
        $h [] = '<script type="application/json" id="vf-itinerary-export-data">'
            . wp_json_encode($exportEvents, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT)
            . '</script>';
        $h [] = '<div class="vf_itinerary_export">';
        $h [] = '<button type="button" class="vf_itinerary_button" data-itin-export="email">Send by Email</button>';
        $h [] = '<button type="button" class="vf_itinerary_button" data-itin-export="copy">Copy</button>';
        $h [] = '<button type="button" class="vf_itinerary_button" data-itin-export="calendar">Download calendar</button>';
        $h [] = '</div>';
        $h [] = '<script>jQuery(document).ready(vfItineraryExportInit);</script>';
    }
    return join("", $h);
}

function chrisvf_render_saved_itinerary($atts = [], $content = null)
{
    $itinerary = array();
    $itinerary["codes"] = preg_split('/\|/', $_GET['ids']);
    $events = chrisvf_get_events();
    $itinerary["events"] = array();
    foreach ($itinerary["codes"] as $code) {
        $itinerary["events"][$code] = $events[$code];
    }
    $h = "";
    if (!empty($_GET['title'])) {
        $h .= "<h3>" . htmlspecialchars(preg_replace('/\\\\(.)/', '$1', $_GET['title'])) . "</h3>";
    }
    $h .= chrisvf_render_itinerary_table($itinerary, false);
    return $h;
}

function chrisvf_render_itinerary_table($itinerary, $active = true)
{
    $h = array();
    $h [] = "<table class='vf_itinerary_table'>";

    $h [] = "<tr>";
    $h [] = "<th>Date</th>";
    $h [] = "<th>Start</th>";
    $h [] = "<th>End</th>";
    $h [] = "<th>Event</th>";
    $h [] = "<th>Venue</th>";
    if ($active) {
        $h [] = "<th>Actions</th>";
    }
    $h [] = "</tr>";

    foreach ($itinerary['codes'] as $code) {
        $event = @$itinerary['events'][$code];
        if (!$event) {
            $time_t = 0;
        } else {
            $time_t = strtotime($event["DTSTART"]);
        }
        if (@!is_array($list[$time_t])) {
            $list[$time_t][] = $code;
        }
    }
    #print "<pre>". htmlspecialchars(print_r($itinerary,1 )). "</pre>";
    #print "<pre>". htmlspecialchars(print_r($list,1 )). "</pre>";
    ksort($list);
    global $vf_js_id;
    foreach ($list as $start_time => $codes) {
        foreach ($codes as $code) {
            ++$vf_js_id;
            $event = @$itinerary['events'][$code];
            $h [] = "<tr id='{$vf_js_id}_row'>";
            if ($event) {
                $h [] = "<td>" . date("l jS F", $start_time) . "</td>";
                $h [] = "<td>" . date("H:i", $start_time) . "</td>";
                if (@$event["DTEND"]) {
                    $end_t = strtotime($event["DTEND"]);
                    $h [] = "<td>" . date("H:i", $end_t) . "</td>";
                } else {
                    $h [] = "<td></td>";
                }

                if (empty($event["URL"])) {
                    $h [] = "<td>" . $event["SUMMARY"] . "</td>";
                } else {
                    $h [] = "<td><a href='" . $event["URL"] . "'>" . $event["SUMMARY"] . "</a></td>";
                }
                #$venue = $venues[$event->field_venue['und'][0]['tid']];
                $h [] = "<td>" . $event["LOCATION"] . "</td>";
                #$h []= "<td><a href='".url('taxonomy/term/'. $venue->tid)."'>".$venue->name."</a></td>";

            } else {
                $h [] = "<td></td>";
                $h [] = "<td></td>";
                $h [] = "<td></td>";
                $h [] = "<td></td>";
                $h [] = "<td>Error, event missing (may have been erased or altered. Sorry. $code)</td>";
            }
            if ($active) {
                $h [] = "<td><div class='vf_itinerary_button vf_itinerary_remove_button' id='{$vf_js_id}_remove'>Remove from itinerary</div>";
            }
            $h [] = "</tr>";
            $script [] = "jQuery( '#{$vf_js_id}_remove' ).click(function(){ jQuery( '#{$vf_js_id}_row' ).hide(); vfItineraryRemove( '" . $code . "' ) });\n";
        }
    }
    $h [] = "</table>";

    $h [] = "<script>jQuery(document).ready(function(){\n" . join("", $script) . "});</script>";
    return join("", $h);
}
