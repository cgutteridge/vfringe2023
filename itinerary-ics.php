<?php

/**
 * Downloadable itinerary calendar (.ics) at /itinerary-ics?ids=...
 *
 * Uses an extension-free path so Apache/nginx always pass the request to
 * WordPress (literal `/itinerary.ics` often 404s before PHP runs).
 *
 * @package ChrisVF
 */

define('CHRISVF_ITINERARY_ICS_QUERY_VAR', 'chrisvf_itinerary_ics');
define('CHRISVF_ITINERARY_ICS_REWRITE_VERSION', '2');
define('CHRISVF_ITINERARY_ICS_PATH', 'itinerary-ics');

/**
 * Register rewrite rules and query vars for the itinerary .ics endpoint.
 *
 * @return void
 */
function chrisvf_itinerary_ics_register_routes()
{
    add_rewrite_rule(
        '^' . CHRISVF_ITINERARY_ICS_PATH . '/?$',
        'index.php?' . CHRISVF_ITINERARY_ICS_QUERY_VAR . '=1',
        'top'
    );
    add_rewrite_tag('%' . CHRISVF_ITINERARY_ICS_QUERY_VAR . '%', '([^&]+)');
}

add_action('init', 'chrisvf_itinerary_ics_register_routes');

/**
 * Register the itinerary .ics query var with WordPress.
 *
 * @param array<int, string> $vars Existing query vars.
 * @return array<int, string>
 */
function chrisvf_itinerary_ics_query_vars($vars)
{
    $vars[] = CHRISVF_ITINERARY_ICS_QUERY_VAR;
    return $vars;
}

add_filter('query_vars', 'chrisvf_itinerary_ics_query_vars');

/**
 * Flush rewrite rules once when itinerary .ics routes are new or changed.
 *
 * @return void
 */
function chrisvf_itinerary_ics_maybe_flush_rewrites()
{
    if (get_option('chrisvf_itinerary_ics_rewrite_version') === CHRISVF_ITINERARY_ICS_REWRITE_VERSION) {
        return;
    }

    flush_rewrite_rules(false);
    update_option('chrisvf_itinerary_ics_rewrite_version', CHRISVF_ITINERARY_ICS_REWRITE_VERSION);
}

add_action('init', 'chrisvf_itinerary_ics_maybe_flush_rewrites', 20);

/**
 * Whether the current request targets the itinerary .ics download.
 *
 * @return bool
 */
function chrisvf_itinerary_ics_is_request()
{
    if (get_query_var(CHRISVF_ITINERARY_ICS_QUERY_VAR)) {
        return true;
    }

    if (!empty($_GET[CHRISVF_ITINERARY_ICS_QUERY_VAR])) {
        return true;
    }

    return chrisvf_mobile_normalise_request_path() === CHRISVF_ITINERARY_ICS_PATH;
}

/**
 * Prevent canonical redirects from breaking itinerary calendar downloads.
 *
 * @param string|false $redirect_url Canonical redirect target.
 * @param string       $requested_url Original request URL.
 * @return string|false
 */
function chrisvf_itinerary_ics_disable_canonical_redirect($redirect_url, $requested_url)
{
    if (chrisvf_itinerary_ics_is_request()) {
        return false;
    }

    if (chrisvf_mobile_normalise_request_path($requested_url) === CHRISVF_ITINERARY_ICS_PATH) {
        return false;
    }

    return $redirect_url;
}

add_filter('redirect_canonical', 'chrisvf_itinerary_ics_disable_canonical_redirect', 10, 2);

/**
 * Ensure WordPress treats /itinerary-ics as a plugin route, not a theme page.
 *
 * @param WP $wp WordPress environment instance.
 * @return void
 */
function chrisvf_itinerary_ics_parse_request($wp)
{
    if (chrisvf_mobile_normalise_request_path() !== CHRISVF_ITINERARY_ICS_PATH) {
        return;
    }

    $wp->query_vars = [
        CHRISVF_ITINERARY_ICS_QUERY_VAR => '1',
    ];
}

add_action('parse_request', 'chrisvf_itinerary_ics_parse_request', 0);

/**
 * Escape a text value for an iCalendar property line.
 *
 * @param string $value Raw text.
 * @return string
 */
function chrisvf_itinerary_ics_escape_text($value)
{
    $value = str_replace(["\\", ";", ",", "\r\n", "\n", "\r"], ["\\\\", "\\;", "\\,", "\\n", "\\n", "\\n"], (string) $value);
    return $value;
}

/**
 * Fold a long iCalendar content line at 75 octets.
 *
 * @param string $line Full property line.
 * @return string
 */
function chrisvf_itinerary_ics_fold_line($line)
{
    $out = '';
    while (strlen($line) > 75) {
        $out .= substr($line, 0, 75) . "\r\n ";
        $line = substr($line, 75);
    }
    return $out . $line;
}

/**
 * Build VCALENDAR body for the given event codes.
 *
 * @param string[] $codes Pipe-split itinerary uids.
 * @return string
 */
function chrisvf_itinerary_ics_build(array $codes)
{
    $events = chrisvf_get_events();
    $lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Ventnor Fringe//Itinerary//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Ventnor Fringe Itinerary',
    ];

    $byStart = [];
    foreach ($codes as $code) {
        $code = trim((string) $code);
        if ($code === '' || empty($events[$code])) {
            continue;
        }
        $event = $events[$code];
        if (empty($event['DTSTART'])) {
            continue;
        }
        $timeT = strtotime($event['DTSTART']);
        if ($timeT === false) {
            $timeT = 0;
        }
        if (!isset($byStart[$timeT]) || !is_array($byStart[$timeT])) {
            $byStart[$timeT] = [];
        }
        $byStart[$timeT][] = $event;
    }
    ksort($byStart);

    $stamp = gmdate('Ymd\THis\Z');

    foreach ($byStart as $eventsAtTime) {
        foreach ($eventsAtTime as $event) {
            $uid = !empty($event['UID']) ? (string) $event['UID'] : (string) $event['DTSTART'];
            $dtStart = preg_replace('/[^0-9T]/', '', (string) $event['DTSTART']);
            $dtEnd = !empty($event['DTEND'])
                ? preg_replace('/[^0-9T]/', '', (string) $event['DTEND'])
                : $dtStart;
            $summary = !empty($event['SUMMARY']) ? (string) $event['SUMMARY'] : 'Event';
            $location = !empty($event['LOCATION']) ? (string) $event['LOCATION'] : '';
            $url = !empty($event['URL']) ? (string) $event['URL'] : '';
            $description = !empty($event['DESCRIPTION'])
                ? wp_strip_all_tags((string) $event['DESCRIPTION'])
                : '';
            $description = trim(preg_replace('/\s+/', ' ', $description));

            $lines[] = 'BEGIN:VEVENT';
            $lines[] = chrisvf_itinerary_ics_fold_line('UID:' . chrisvf_itinerary_ics_escape_text($uid . '@vfringe.co.uk'));
            $lines[] = 'DTSTAMP:' . $stamp;
            $lines[] = 'DTSTART:' . $dtStart;
            $lines[] = 'DTEND:' . $dtEnd;
            $lines[] = chrisvf_itinerary_ics_fold_line('SUMMARY:' . chrisvf_itinerary_ics_escape_text($summary));
            if ($location !== '') {
                $lines[] = chrisvf_itinerary_ics_fold_line('LOCATION:' . chrisvf_itinerary_ics_escape_text($location));
            }
            if ($description !== '') {
                $lines[] = chrisvf_itinerary_ics_fold_line('DESCRIPTION:' . chrisvf_itinerary_ics_escape_text($description));
            }
            if ($url !== '') {
                $lines[] = chrisvf_itinerary_ics_fold_line('URL:' . $url);
            }
            $lines[] = 'END:VEVENT';
        }
    }

    $lines[] = 'END:VCALENDAR';
    return implode("\r\n", $lines) . "\r\n";
}

/**
 * Serve the itinerary .ics download when requested.
 *
 * @return void
 */
function chrisvf_itinerary_ics_maybe_serve()
{
    if (!chrisvf_itinerary_ics_is_request()) {
        return;
    }

    $raw = isset($_GET['ids']) ? wp_unslash((string) $_GET['ids']) : '';
    $codes = $raw !== '' ? preg_split('/\|/', $raw) : [];
    if (!is_array($codes)) {
        $codes = [];
    }

    $body = chrisvf_itinerary_ics_build($codes);

    status_header(200);
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="vfringe-itinerary.ics"');
    header('Cache-Control: private, no-cache');
    echo $body;
    exit;
}

add_action('template_redirect', 'chrisvf_itinerary_ics_maybe_serve', 1);
