<?php

/*********************************************************************************
 * FREE FRINGE
 *********************************************************************************/

add_action('wp_enqueue_scripts', 'chrisvf_add_ff_scripts');
function chrisvf_add_ff_scripts()
{
    // Respects SSL, Style.css is relative to the current file
    wp_register_style('chrisvf-ff', plugins_url('ff.css', __FILE__));
    wp_enqueue_style('chrisvf-ff');
}

add_shortcode('chrisvf_ff_alpha', 'chrisvf_render_ff_alpha');
add_shortcode('chrisvf_ff_cat', 'chrisvf_render_ff_cat');
add_shortcode('chrisvf_ff_day', 'chrisvf_render_ff_day');


function chrisvf_get_ff_events()
{
    $events = chrisvf_get_events();
    $ff_events = ['all' => [], 'cat' => [], 'day' => []];
    // I'm going to assume that one event can't start twice at exactly the same dtstart
    foreach ($events as $event) {
        // only free fringe
        if (!preg_match('/Free Fringe/', $event["CATEGORIES"])) {
            continue;
        }
        // no ended events
        if (@strtotime($event["DTEND"]) < chrisvf_time()) {
            continue;
        }

        $ff_events['all'][$event["SUMMARY"]][$event["LOCATION"]][$event["DTSTART"]] = $event;
        $cats = $event["CATEGORIES"];
        if ($cats == "Free Fringe") {
            $cats = "Free Fringe,Uncategorised";
        }
        $cat_array = preg_split("/,/", $cats);
        foreach ($cat_array as $cat) {
            if ($cat != "Free Fringe") {
                $ff_events['cat'][$cat][$event["SUMMARY"]][$event["LOCATION"]][$event["DTSTART"]] = $event;
            }
        }
        $ff_events['day'][substr($event["DTSTART"], 0, 8)][$event["SUMMARY"]] [$event["LOCATION"]][$event["DTSTART"]] = $event;
    }
    return $ff_events;
}

// render the free fringe things in alphabetic order
// nb. they are keyed on NAME(SUMMARY) so events in 2 locations with the same name are merged.
function chrisvf_render_ff_alpha($atts = [], $content = null)
{
    $ff_events = chrisvf_get_ff_events();
    $h = "";
    if (@$_GET['debug'] == "ICAL") {
        $h .= "<pre>" . htmlspecialchars(print_r(chrisvf_get_info(), true)) . "</pre>";
    }
    $h .= chrisvf_render_ff_list($ff_events["all"]);
    return $h;
}

// free fringe events by category
function chrisvf_render_ff_cat($atts = [], $content = null)
{
    $ff_events = chrisvf_get_ff_events();
    $jumps = [];
    $h = "";
    ksort($ff_events["cat"]);
    foreach ($ff_events["cat"] as $cat => $list) {
        $h .= "<h3 id='$cat'>$cat</h3>";
        $jumps [] = "<a href='#$cat'>$cat</a>";
        $h .= chrisvf_render_ff_list($list);
    }
    return "<div>Jump to: " . join(" | ", $jumps) . "</div>" . $h;
}


// free fringe events by day
function chrisvf_render_ff_day($atts = [], $content = null)
{
    $ff_events = chrisvf_get_ff_events();
    $jumps = [];
    $h = "";
    ksort($ff_events["day"]);
    foreach ($ff_events["day"] as $day => $list) {
        $label = date('l jS', strtotime($day));
        $h .= "<h3 id='$day'>$label</h3>";
        $jumps [] = "<a href='#$day'>$label</a>";
        $h .= chrisvf_render_ff_list($list);
    }
    return "<div>Jump to: " . join(" | ", $jumps) . "</div>" . $h;
}

// render an array of fringe 
function chrisvf_render_ff_list($list)
{
    ksort($list);
    $h = "";
    $h .= "<ul class='fflist'>";
    foreach ($list as $name => $eventsbyloc) {
        ksort($eventsbyloc);
        foreach ($eventsbyloc as $events) {
            ksort($events);
            $days = [];
            $loc = "";
            $url = "";
            foreach ($events as $event) {
                $day = date('j', strtotime($event["DTSTART"]));
                $days[$day] = $day;
                $loc = $event["LOCATION"];
            }
            ksort($days);
            $h .= "<li class='ffitem'";
            if (@$event["IMAGE"]) {
                $h .= " style='background-image: url(" . $event["IMAGE"] . ")'";
            }
            $h .= ">";
            $h .= "<a href='" . $event["URL"] . "'>";
            $h .= "<div class='fftint'>";
            $h .= "<div class='ffdays'>" . join(", ", $days) . "</div>";
            $h .= "<div class='ffname'>" . htmlspecialchars($name) . "</div>";
            $h .= "<div class='fflocs'>" . htmlspecialchars($loc) . "</div>";
            $h .= "</div></a></li>";
        }
    }
    $h .= "</ul>";
    return $h;
}


/*********************************************************************************
 * end of FREE FRINGE
 *********************************************************************************/





