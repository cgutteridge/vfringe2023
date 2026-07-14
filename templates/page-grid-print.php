<?php
/**
 * Minimal standalone shell for the /grid-print/ day grid page.
 *
 * @package ChrisVF
 */

$date = isset($GLOBALS['chrisvf_grid_print_date']) ? (string) $GLOBALS['chrisvf_grid_print_date'] : date('Y-m-d');
$grid_html = isset($GLOBALS['chrisvf_grid_print_html']) ? (string) $GLOBALS['chrisvf_grid_print_html'] : '';
$display_date = date('j F Y', strtotime($date . ' 12:00:00'));
$asset_ref = dirname(__DIR__) . '/grid-print.php';
$grid_css = plugins_url('grid.css', $asset_ref);
$print_css = plugins_url('grid-print.css', $asset_ref);
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ventnor Fringe — Grid — <?php echo htmlspecialchars($display_date, ENT_QUOTES, 'UTF-8'); ?></title>
    <link rel="stylesheet" href="<?php echo esc_url($grid_css); ?>?v=1.002">
    <link rel="stylesheet" href="<?php echo esc_url($print_css); ?>?v=1.002">
</head>
<body class="chrisvf-grid-print">
<header class="chrisvf-grid-print-header">
    <h1>Ventnor Fringe</h1>
    <p class="chrisvf-grid-print-date"><?php echo htmlspecialchars($display_date, ENT_QUOTES, 'UTF-8'); ?></p>
</header>
<?php
// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- grid markup from chrisvf_render_grid_day()
echo $grid_html;
?>
</body>
</html>
