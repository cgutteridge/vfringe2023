<?php

/*********************************************************************************
 * EVENT SEARCH
 *********************************************************************************/


add_shortcode('chrisvf_search', 'chrisvf_search');

function chrisvf_search()
{
    $events = chrisvf_get_events();

    $form = "<form action='/quick-search/'><input type=\"\" name=\"q\" id=\"q\" value=\"" . $_GET['q'] . "\" placeholder=\"Search...\">&nbsp;<input style='padding:0 1em 0 1em !important' value='Search' type='submit' /></form>";
    if (@$_GET['q']) {

        $q = $_GET['q'];
        // filter events
        $matches = [];
        foreach ($events as $event) {
            $end_t = strtotime($event["DTEND"]);

            if ($end_t < chrisvf_time()) {
                continue;
            } # skip done events

            if (preg_match("/$q/i", $event['SUMMARY']) ||
                preg_match("/$q/i", $event['DESCRIPTION'])) {
                $matches[] = $event;
            }
        }


        // Define the comparison function
        function compareByDTSTART2($a, $b)
        {
            $dateA = strtotime($a['DTSTART']);
            $dateB = strtotime($b['DTSTART']);
            return $dateA - $dateB;
        }

        // Sort the events
        usort($matches, 'compareByDTSTART2');
        if( count($matches)>0) {
            $form.="<br />";
        }
        else {
            $form.="<div>No matches</div>";
        }
        foreach ($matches as $match) {
            $start_t = strtotime($match['DTSTART']);
            $startTimeStr = date("D jS - ", $start_t);
            if (date('i', $start_t) == 0) {
                $startTimeStr .= date("ga", $start_t);
            } else {
                $startTimeStr .= date("g:ia", $start_t);
            }
            $form .= "<div>";
            $form .= $startTimeStr;
            $form .= " - ";
            if (!empty(@$match['URL'])) {
                $form .= '<a href="' . $match['URL'] . '">' . $match['SUMMARY'] . '</a>';
            } else {
                $form .= $match['SUMMARY'];
            }
            $form .= "  - ";
            $form .= $match['LOCATION'];
            $form .= "</div>";
        }
    }
    return $form;
}


/*********************************************************************************
 * end of DATA DUMP FOR MONTY
 *********************************************************************************/
