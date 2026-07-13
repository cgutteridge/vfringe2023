<?php
/**
 * Template Name: Mobile Programme
 *
 * Minimal standalone shell for the /m mobile programme app.
 * The Map tab shows the shared chrisvf_render_map() output (embedded layout).
 *
 * @package ChrisVF
 */

$map_html = isset($GLOBALS['chrisvf_mobile_map_html']) ? $GLOBALS['chrisvf_mobile_map_html'] : '';
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php wp_title('|', true, 'right'); ?></title>
    <?php wp_head(); ?>
</head>
<body <?php body_class('chrisvf-mobile-page'); ?>>
<div id="chrisvf-mobile-root" class="chrisvf-mobile-root" role="application" aria-label="Ventnor Fringe mobile programme"></div>
<div id="chrisvf-mobile-map-host" class="chrisvf-mobile-map-host" hidden aria-hidden="true">
    <?php echo $map_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- map markup from chrisvf_render_map() ?>
</div>
<?php wp_footer(); ?>
</body>
</html>
