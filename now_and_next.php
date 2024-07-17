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

    $list = array();
    foreach ($events as $event) {
        $start_t = strtotime($event["DTSTART"]);
        $end_t = strtotime($event["DTEND"]);

        if ($end_t < chrisvf_time()) {
            continue;
        } # skip done events

        $free = false;
        // TODO : detect free events

        if ($start_t > chrisvf_time() && $start_t < chrisvf_time() + 90 * 60) {
            #starts in the next 90 minutes
            $list[] = sprintf("<div>%s - <strong><a href='%s'>%s</strong></a> - %s</div>",
                date("ga", $start_t),
                $event["URL"],
                htmlspecialchars($event["SUMMARY"], ENT_QUOTES),
                $event["LOCATION"]
            );
        }
        if ($start_t < chrisvf_time() && $end_t > chrisvf_time() + 10 * 60 && $free) {  # free,
            $list[] = sprintf("<div>NOW - <strong><a href='%s'>%s</strong></a> - %s</div>",
                $event["URL"],
                htmlspecialchars($event["SUMMARY"], ENT_QUOTES),
                $event["LOCATION"]
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

    $h .= print_r($slides, true);
    $h = "<div class='chrisvf_slides'><ul>";
    foreach ($slides as $slide) {
        $h .= "<li class='chrisvf_slide'>" . join("", $slide) . "</li>";
    }
    $h .= "</ul></div>";

    return $h;
}

/*********************************************************************************
 * end of NOW AND NEXT SLUG
 *********************************************************************************/
