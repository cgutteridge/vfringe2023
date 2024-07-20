<?php

/*********************************************************************************
 * NOW AND NEXT SLUG
 *********************************************************************************/

add_shortcode('chrisvf_now_and_next', 'chrisvf_now_and_next');
add_action('wp_enqueue_scripts', 'chrisvf_add_now_and_next_scripts');

function chrisvf_add_now_and_next_scripts()
{
    # register them here, but only enqueue if we need them
    wp_register_script('chrisvf-now-and-next-js', plugins_url('now_and_next.js', __FILE__));
    wp_enqueue_script('chrisvf-now-and-next-js');

    wp_register_style('chrisvf-now-and-next', plugins_url('now_and_next.css', __FILE__));
    wp_enqueue_style('chrisvf-now-and-next');
}

function chrisvf_now_and_next()
{
    $events = chrisvf_get_events();

    // Define the comparison function
    function compareByDTSTART($a, $b)
    {
        $dateA = strtotime($a['DTSTART']);
        $dateB = strtotime($b['DTSTART']);
        return $dateA - $dateB;
    }

// Sort the events
    usort($events, 'compareByDTSTART');

    $list = array();
    foreach ($events as $event) {
        $start_t = strtotime($event["DTSTART"]);
        $end_t = strtotime($event["DTEND"]);

        if ($end_t < chrisvf_time()) {
            continue;
        } # skip done events

        $categories = explode(",", $event['CATEGORIES']);
        $free = in_array('Free Fringe', $categories);

        if (date('i', $start_t) == 0) {
            $startTimeStr = date("ga", $start_t);
        } else {
            $startTimeStr = date("g:ia", $start_t);
        }
        if (date('i', $end_t) == 0) {
            $endTimeStr = date("ga", $end_t);
        } else {
            $endTimeStr = date("g:ia", $end_t);
        }

        if ($start_t > chrisvf_time() && $start_t < chrisvf_time() + 90 * 60) {
            #starts in the next 90 minutes
            $list[] = sprintf("%s - <strong><a href='%s'>%s</strong></a> - %s%s",
                $startTimeStr,
                $event["URL"],
                htmlspecialchars($event["SUMMARY"], ENT_QUOTES),
                $event["LOCATION"],
                $free ? " - FREE" : ""
            );
        }
        if ($start_t < chrisvf_time() && $end_t > chrisvf_time() + 10 * 60 && $free) {  # free,
            $list[] = sprintf("NOW (ends %s) - <strong><a href='%s'>%s</strong></a> - %s%s",
                $endTimeStr,
                $event["URL"],
                htmlspecialchars($event["SUMMARY"], ENT_QUOTES),
                $event["LOCATION"],
                $free ? " - FREE" : ""
            );
        }
    }
    $h = "";
    $slides = [[]];

    $PER_SLIDE = 1;
    foreach ($list as $text) {
        if (sizeof($slides[sizeof($slides) - 1]) >= $PER_SLIDE) {
            $slides [] = [];
        }
        $slides[sizeof($slides) - 1] [] = $text;
    }

    $h = "";
    $h .= "<div class='chrisvf_now_and_next'>";
    $h .= "<div class='chrisvf_slides'><ul>";
    foreach ($slides as $slide) {
        $h .= "<li class='chrisvf_slide'>" . join("", $slide) . "</li>";
    }
    $h .= "</ul></div></div>";

    return $h;
}

/*********************************************************************************
 * end of NOW AND NEXT SLUG
 *********************************************************************************/
