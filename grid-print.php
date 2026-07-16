<?php

/**
 * Standalone print-friendly day grid at /grid-print/.
 *
 * `/grid-print/` with no date lists festival days; `?date=YYYY-MM-DD` (or `today`)
 * renders that day's print grid.
 *
 * @package ChrisVF
 */

define('CHRISVF_GRID_PRINT_QUERY_VAR', 'chrisvf_grid_print');
define('CHRISVF_GRID_PRINT_REWRITE_VERSION', '1');

/**
 * Register rewrite rules and query vars for the print grid endpoint.
 *
 * @return void
 */
function chrisvf_grid_print_register_routes()
{
    add_rewrite_rule('^grid-print/?$', 'index.php?' . CHRISVF_GRID_PRINT_QUERY_VAR . '=1', 'top');
    add_rewrite_tag('%' . CHRISVF_GRID_PRINT_QUERY_VAR . '%', '([^&]+)');
}

add_action('init', 'chrisvf_grid_print_register_routes');

/**
 * Register the print-grid query var with WordPress.
 *
 * @param array<int, string> $vars Existing query vars.
 * @return array<int, string>
 */
function chrisvf_grid_print_query_vars($vars)
{
    $vars[] = CHRISVF_GRID_PRINT_QUERY_VAR;
    return $vars;
}

add_filter('query_vars', 'chrisvf_grid_print_query_vars');

/**
 * Flush rewrite rules once when print-grid routes are new or changed.
 *
 * @return void
 */
function chrisvf_grid_print_maybe_flush_rewrites()
{
    if (get_option('chrisvf_grid_print_rewrite_version') === CHRISVF_GRID_PRINT_REWRITE_VERSION) {
        return;
    }

    flush_rewrite_rules(false);
    update_option('chrisvf_grid_print_rewrite_version', CHRISVF_GRID_PRINT_REWRITE_VERSION);
}

add_action('init', 'chrisvf_grid_print_maybe_flush_rewrites', 20);

/**
 * Whether the current request targets the print-friendly grid page.
 *
 * @return bool
 */
function chrisvf_grid_print_is_request()
{
    if (get_query_var(CHRISVF_GRID_PRINT_QUERY_VAR)) {
        return true;
    }

    return chrisvf_mobile_normalise_request_path() === 'grid-print';
}

/**
 * Prevent canonical redirects from breaking /grid-print requests.
 *
 * @param string|false $redirect_url Canonical redirect target.
 * @param string       $requested_url Original request URL.
 * @return string|false
 */
function chrisvf_grid_print_disable_canonical_redirect($redirect_url, $requested_url)
{
    if (chrisvf_mobile_normalise_request_path($requested_url) === 'grid-print') {
        return false;
    }

    return $redirect_url;
}

add_filter('redirect_canonical', 'chrisvf_grid_print_disable_canonical_redirect', 10, 2);

/**
 * Ensure WordPress treats /grid-print as a plugin route, not a theme page.
 *
 * @param WP $wp WordPress environment instance.
 * @return void
 */
function chrisvf_grid_print_parse_request($wp)
{
    if (chrisvf_mobile_normalise_request_path() !== 'grid-print') {
        return;
    }

    $wp->query_vars = [
        CHRISVF_GRID_PRINT_QUERY_VAR => '1',
    ];
}

add_action('parse_request', 'chrisvf_grid_print_parse_request', 0);

/**
 * Collect festival day keys (Y-m-d) that have timed programme events.
 *
 * @return string[] Sorted unique dates.
 */
function chrisvf_grid_print_festival_days()
{
    $daySet = [];
    foreach (chrisvf_get_events() as $event) {
        if (!empty($event['ALLDAY']) || empty($event['DTSTART'])) {
            continue;
        }
        $startT = strtotime($event['DTSTART']);
        if ($startT === false) {
            continue;
        }
        $daySet[date('Y-m-d', $startT)] = true;
    }
    $days = array_keys($daySet);
    sort($days);
    return $days;
}

/**
 * Whether the request includes an explicit date CGI parameter.
 *
 * @return bool
 */
function chrisvf_grid_print_has_date_param()
{
    return isset($_GET['date']) && trim(wp_unslash((string) $_GET['date'])) !== '';
}

/**
 * Resolve the calendar date for the print page from the request.
 *
 * Accepts ?date=YYYY-MM-DD or ?date=today. Invalid values fall back to today.
 * Callers that want the index page should check chrisvf_grid_print_has_date_param() first.
 *
 * @return string Date in Y-m-d form.
 */
function chrisvf_grid_print_resolve_date()
{
    $raw = isset($_GET['date']) ? wp_unslash((string) $_GET['date']) : '';
    $raw = trim($raw);

    if ($raw === '' || strtolower($raw) === 'today') {
        return date('Y-m-d');
    }

    $dt = DateTime::createFromFormat('Y-m-d', $raw);
    if ($dt instanceof DateTime && $dt->format('Y-m-d') === $raw) {
        return $raw;
    }

    return date('Y-m-d');
}

/**
 * Build a simple HTML index of links to each festival day's print grid.
 *
 * @param string[] $days Festival day keys (Y-m-d).
 * @return string
 */
function chrisvf_grid_print_index_html(array $days)
{
    if (!$days) {
        return '<p class="chrisvf-grid-print-index-empty">No festival days found.</p>';
    }

    $h = [];
    $h[] = '<ul class="chrisvf-grid-print-index">';
    foreach ($days as $day) {
        $label = date('l j F Y', strtotime($day . ' 12:00:00'));
        $url = home_url('/grid-print/?date=' . rawurlencode($day));
        $h[] = '<li><a href="' . esc_url($url) . '">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a></li>';
    }
    $h[] = '</ul>';
    return implode("\n", $h);
}

/**
 * Serve the standalone print grid shell at /grid-print/.
 *
 * With no ?date= parameter, lists links to each festival day's print grid.
 * With ?date=YYYY-MM-DD or ?date=today, renders that day's print grid.
 *
 * @return void
 */
function chrisvf_grid_print_maybe_serve()
{
    if (!chrisvf_grid_print_is_request()) {
        return;
    }

    if (!chrisvf_grid_print_has_date_param()) {
        $GLOBALS['chrisvf_grid_print_mode'] = 'index';
        $GLOBALS['chrisvf_grid_print_date'] = '';
        $GLOBALS['chrisvf_grid_print_html'] = chrisvf_grid_print_index_html(chrisvf_grid_print_festival_days());
    } else {
        $date = chrisvf_grid_print_resolve_date();
        $GLOBALS['chrisvf_grid_print_mode'] = 'day';
        $GLOBALS['chrisvf_grid_print_date'] = $date;
        $GLOBALS['chrisvf_grid_print_html'] = chrisvf_render_grid_day([
            'date' => $date,
            'print' => '1',
        ]);
    }

    $template = __DIR__ . '/templates/page-grid-print.php';
    if (!file_exists($template)) {
        status_header(500);
        header('Content-Type: text/html; charset=utf-8');
        echo 'Grid print template missing';
        exit;
    }

    status_header(200);
    header('Content-Type: text/html; charset=utf-8');
    include $template;
    exit;
}

add_action('template_redirect', 'chrisvf_grid_print_maybe_serve', 1);
