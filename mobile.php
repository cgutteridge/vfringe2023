<?php

/**
 * Mobile programme at /m and JSON feed at /m/json.
 *
 * @package ChrisVF
 */

define('CHRISVF_MOBILE_QUERY_VAR', 'chrisvf_mobile_json');
define('CHRISVF_MOBILE_APP_VAR', 'chrisvf_mobile_app');
define('CHRISVF_MOBILE_REWRITE_VERSION', '3');
define('CHRISVF_MOBILE_TEMPLATE', 'chrisvf-mobile-programme.php');

/**
 * Register rewrite rules and query vars for the mobile app and JSON endpoint.
 */
function chrisvf_mobile_register_routes()
{
    add_rewrite_rule('^m/json/?$', 'index.php?' . CHRISVF_MOBILE_QUERY_VAR . '=1', 'top');
    add_rewrite_rule('^m/?$', 'index.php?' . CHRISVF_MOBILE_APP_VAR . '=1', 'top');
    add_rewrite_tag('%' . CHRISVF_MOBILE_QUERY_VAR . '%', '([^&]+)');
    add_rewrite_tag('%' . CHRISVF_MOBILE_APP_VAR . '%', '([^&]+)');
}

add_action('init', 'chrisvf_mobile_register_routes');

/**
 * Register the mobile JSON query var with WordPress.
 *
 * @param array<string> $vars Existing query vars.
 * @return array<string>
 */
function chrisvf_mobile_query_vars($vars)
{
    $vars[] = CHRISVF_MOBILE_QUERY_VAR;
    $vars[] = CHRISVF_MOBILE_APP_VAR;
    return $vars;
}

add_filter('query_vars', 'chrisvf_mobile_query_vars');

/**
 * Flush rewrite rules once when routes are new or changed (covers deploys without reactivation).
 */
function chrisvf_mobile_maybe_flush_rewrites()
{
    if (get_option('chrisvf_mobile_rewrite_version') === CHRISVF_MOBILE_REWRITE_VERSION) {
        return;
    }

    flush_rewrite_rules(false);
    update_option('chrisvf_mobile_rewrite_version', CHRISVF_MOBILE_REWRITE_VERSION);
}

add_action('init', 'chrisvf_mobile_maybe_flush_rewrites', 20);

/**
 * Flush rewrite rules when the plugin is activated.
 */
function chrisvf_mobile_activate()
{
    chrisvf_mobile_register_routes();
    flush_rewrite_rules();
    update_option('chrisvf_mobile_rewrite_version', CHRISVF_MOBILE_REWRITE_VERSION);
}

register_activation_hook(__DIR__ . '/chrisvf.php', 'chrisvf_mobile_activate');

/**
 * Normalise a URL or request path to a site-relative slug (e.g. "m/json").
 *
 * @param string|null $url Full URL or path; uses current request when null.
 * @return string
 */
function chrisvf_mobile_normalise_request_path($url = null)
{
    if ($url === null) {
        $url = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    }

    $path = parse_url($url, PHP_URL_PATH);
    if (!is_string($path)) {
        return '';
    }

    $path = trim($path, '/');
    $homePath = trim((string) parse_url(home_url('/'), PHP_URL_PATH), '/');

    if ($homePath !== '' && strpos($path, $homePath . '/') === 0) {
        $path = substr($path, strlen($homePath) + 1);
    } elseif ($path === $homePath) {
        $path = '';
    }

    return trim($path, '/');
}

/**
 * Whether the current request targets the mobile JSON endpoint.
 *
 * @return bool
 */
function chrisvf_mobile_is_json_request()
{
    if (get_query_var(CHRISVF_MOBILE_QUERY_VAR)) {
        return true;
    }

    return chrisvf_mobile_normalise_request_path() === 'm/json';
}

/**
 * Whether the current request targets the mobile programme app at /m.
 *
 * @return bool
 */
function chrisvf_mobile_is_app_request()
{
    if (get_query_var(CHRISVF_MOBILE_APP_VAR)) {
        return true;
    }

    return chrisvf_mobile_normalise_request_path() === 'm';
}

/**
 * Prevent canonical redirects from breaking /m and /m/json requests.
 *
 * @param string|false $redirect_url Canonical redirect target.
 * @param string       $requested_url Original request URL.
 * @return string|false
 */
function chrisvf_mobile_disable_canonical_redirect($redirect_url, $requested_url)
{
    $path = chrisvf_mobile_normalise_request_path($requested_url);
    if ($path === 'm/json' || $path === 'm') {
        return false;
    }

    return $redirect_url;
}

add_filter('redirect_canonical', 'chrisvf_mobile_disable_canonical_redirect', 10, 2);

/**
 * Ensure WordPress treats /m and /m/json as plugin routes, not theme pages.
 *
 * @param WP $wp WordPress environment instance.
 */
function chrisvf_mobile_parse_request($wp)
{
    $path = chrisvf_mobile_normalise_request_path();

    if ($path === 'm/json') {
        $wp->query_vars = [
            CHRISVF_MOBILE_QUERY_VAR => '1',
        ];
        return;
    }

    if ($path === 'm') {
        $wp->query_vars = [
            CHRISVF_MOBILE_APP_VAR => '1',
        ];
    }
}

add_action('parse_request', 'chrisvf_mobile_parse_request', 0);

/**
 * Output the JSON response and terminate the request.
 */
function chrisvf_mobile_send_json()
{
    $payload = chrisvf_mobile_json_payload();

    status_header(200);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=1800');
    echo wp_json_encode($payload);
    exit;
}

/**
 * Serve JSON when /m/json is requested.
 */
function chrisvf_mobile_maybe_serve_json()
{
    if (!chrisvf_mobile_is_json_request()) {
        return;
    }

    chrisvf_mobile_send_json();
}

add_action('template_redirect', 'chrisvf_mobile_maybe_serve_json', 0);

/**
 * Serve the standalone mobile app shell at /m.
 */
function chrisvf_mobile_maybe_serve_app()
{
    if (!chrisvf_mobile_is_app_request()) {
        return;
    }

    chrisvf_mobile_do_enqueue_assets();

    // Render the shared festival map before wp_head so Leaflet assets are enqueued.
    $GLOBALS['chrisvf_mobile_map_html'] = chrisvf_render_map([
        'layout' => 'embedded',
        'mobile' => '1',
    ]);

    $template = __DIR__ . '/templates/page-mobile.php';
    if (!file_exists($template)) {
        status_header(500);
        echo 'Mobile template missing';
        exit;
    }

    include $template;
    exit;
}

add_action('template_redirect', 'chrisvf_mobile_maybe_serve_app', 1);

/**
 * Build the normalized mobile programme JSON payload.
 *
 * @return array<string, mixed>
 */
function chrisvf_mobile_json_payload()
{
    $info = chrisvf_get_info();
    $events = [];
    $daySet = [];

    foreach ($info['events'] as $event) {
        if (!empty($event['ALLDAY'])) {
            continue;
        }

        $start = $event['DTSTART'];
        $end = !empty($event['DTEND']) ? $event['DTEND'] : $start;
        $startT = strtotime($start);
        if ($startT === false) {
            continue;
        }

        $daySet[date('Y-m-d', $startT)] = true;

        $categories = !empty($event['CATEGORIES']) ? $event['CATEGORIES'] : '';
        $free = stripos($categories, 'Free Fringe') !== false;
        $location = !empty($event['LOCATION']) ? $event['LOCATION'] : '';
        $url = !empty($event['URL']) ? $event['URL'] : '';

        $ticketUrl = null;
        $siteUrl = null;
        if (stripos($url, 'purchase.vfringe.co.uk') !== false) {
            $ticketUrl = $url;
        } elseif ($url !== '') {
            $siteUrl = $url;
        }

        $description = !empty($event['DESCRIPTION']) ? wp_strip_all_tags($event['DESCRIPTION']) : '';
        $description = trim(preg_replace('/\s+/', ' ', $description));

        $events[] = [
            'uid' => $event['UID'],
            'start' => $start,
            'end' => $end,
            'summary' => chrisvf_title_without_cancelled_prefix($event['SUMMARY']),
            'description' => $description,
            'location' => $location,
            'categories' => $categories,
            'tags' => !empty($event['TAGS']) ? $event['TAGS'] : '',
            'sortcode' => !empty($event['SORTCODE']) ? $event['SORTCODE'] : '',
            'zone' => $location !== '' ? chrisvf_location_zone($location) : null,
            'ticketUrl' => $ticketUrl,
            'siteUrl' => $siteUrl,
            'free' => $free,
            'soldOut' => !empty($event['SOLDOUT']),
            'soldOutOtherDates' => !empty($event['SOLDOUT_OTHER_DATES']),
            'cancelled' => !empty($event['CANCELLED']),
            'cancelledOtherDates' => !empty($event['CANCELLED_OTHER_DATES']),
            'allDay' => false,
        ];
    }

    $festivalDays = array_keys($daySet);
    sort($festivalDays);

    $venues = [];
    foreach ($info['venues'] as $name => $venue) {
        $venues[$name] = [
            'lat' => isset($venue['lat']) ? (float) $venue['lat'] : null,
            'lon' => isset($venue['lon']) ? (float) $venue['lon'] : null,
            'sortcode' => !empty($venue['sortcode']) ? $venue['sortcode'] : '',
            'zone' => chrisvf_location_zone($name),
        ];
    }

    return [
        'generated' => chrisvf_time(),
        'festivalDays' => $festivalDays,
        'events' => $events,
        'venues' => $venues,
        'places' => chrisvf_places(),
    ];
}

/**
 * Register the plugin-owned Mobile Programme page template.
 *
 * @param array<string, string> $templates Existing templates.
 * @return array<string, string>
 */
function chrisvf_mobile_register_page_template($templates)
{
    $templates[CHRISVF_MOBILE_TEMPLATE] = 'Mobile Programme';
    return $templates;
}

add_filter('theme_page_templates', 'chrisvf_mobile_register_page_template');

/**
 * Load the mobile page template from the plugin when selected.
 *
 * @param string $template Current template path.
 * @return string
 */
function chrisvf_mobile_load_page_template($template)
{
    if (!is_page()) {
        return $template;
    }

    $slug = get_page_template_slug(get_queried_object_id());
    if ($slug !== CHRISVF_MOBILE_TEMPLATE) {
        return $template;
    }

    $pluginTemplate = __DIR__ . '/templates/page-mobile.php';
    if (file_exists($pluginTemplate)) {
        if (empty($GLOBALS['chrisvf_mobile_map_html'])) {
            $GLOBALS['chrisvf_mobile_map_html'] = chrisvf_render_map([
                'layout' => 'embedded',
                'mobile' => '1',
            ]);
        }
        return $pluginTemplate;
    }

    return $template;
}

add_filter('template_include', 'chrisvf_mobile_load_page_template');

/**
 * Whether the current request is the mobile programme page.
 *
 * @return bool
 */
function chrisvf_mobile_is_page()
{
    if (!is_page()) {
        return false;
    }

    return get_page_template_slug(get_queried_object_id()) === CHRISVF_MOBILE_TEMPLATE;
}

/**
 * Whether the current request should load mobile programme assets.
 *
 * @return bool
 */
function chrisvf_mobile_should_load_assets()
{
    return chrisvf_mobile_is_app_request() || chrisvf_mobile_is_page();
}

/**
 * Register and enqueue mobile programme CSS/JS.
 */
function chrisvf_mobile_do_enqueue_assets()
{
    wp_register_style(
        'chrisvf-mobile-fonts',
        'https://fonts.googleapis.com/css2?family=Suez+One&family=Work+Sans:wght@400;600;700&display=swap',
        [],
        null
    );
    wp_enqueue_style('chrisvf-mobile-fonts');

    wp_register_style(
        'chrisvf-mobile',
        plugins_url('mobile.css', __FILE__),
        ['chrisvf-mobile-fonts'],
        '1.0.41'
    );
    wp_enqueue_style('chrisvf-mobile');

    wp_register_script(
        'chrisvf-itinerary',
        plugins_url('itinerary.js', __FILE__),
        ['jquery'],
        '1.0.41',
        true
    );

    wp_register_script(
        'chrisvf-mobile',
        plugins_url('mobile.js', __FILE__),
        ['chrisvf-itinerary'],
        '1.0.41',
        true
    );
    wp_enqueue_script('chrisvf-mobile');

    wp_localize_script('chrisvf-mobile', 'chrisvfMobileConfig', [
        'jsonUrl' => home_url('/m/json'),
        'mainSiteUrl' => home_url('/'),
    ]);
    wp_localize_script('chrisvf-itinerary', 'chrisvfItineraryConfig', [
        // Query-string form always reaches WordPress (no rewrite flush; no .ics extension block).
        'icsUrl' => home_url('/?chrisvf_itinerary_ics=1'),
    ]);
}

/**
 * Enqueue mobile programme assets when the app or mobile page template is active.
 */
function chrisvf_mobile_enqueue_assets()
{
    if (!chrisvf_mobile_should_load_assets()) {
        return;
    }

    chrisvf_mobile_do_enqueue_assets();
}

add_action('wp_enqueue_scripts', 'chrisvf_mobile_enqueue_assets');
