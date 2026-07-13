<?php
/**
 * Template Name: Mobile Programme
 *
 * Minimal standalone shell for the /m mobile programme app.
 *
 * @package ChrisVF
 */
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
<?php wp_footer(); ?>
</body>
</html>
