<?php

/*********************************************************************************
 * DATA DUMP FOR MONTY
 *********************************************************************************/


add_shortcode('chrisvf_montydump', 'chrisvf_montydump');

function chrisvf_montydump()
{
    $events = chrisvf_get_events();
    return json_encode($events);
}


/*********************************************************************************
 * end of DATA DUMP FOR MONTY
 *********************************************************************************/
