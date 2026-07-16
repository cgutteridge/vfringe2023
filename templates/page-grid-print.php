<?php
/**
 * Minimal standalone shell for the /grid-print/ day grid page.
 *
 * @package ChrisVF
 */

$mode = isset($GLOBALS['chrisvf_grid_print_mode']) ? (string) $GLOBALS['chrisvf_grid_print_mode'] : 'day';
$date = isset($GLOBALS['chrisvf_grid_print_date']) ? (string) $GLOBALS['chrisvf_grid_print_date'] : date('Y-m-d');
$grid_html = isset($GLOBALS['chrisvf_grid_print_html']) ? (string) $GLOBALS['chrisvf_grid_print_html'] : '';
$is_index = ($mode === 'index');
$display_date = $is_index
    ? 'Choose a day'
    : date('l j F Y', strtotime($date . ' 12:00:00'));
$page_title = $is_index
    ? 'Ventnor Fringe — Grid print days'
    : 'Ventnor Fringe — Grid — ' . $display_date;
$asset_ref = dirname(__DIR__) . '/grid-print.php';
$grid_css = plugins_url('grid.css', $asset_ref);
$print_css = plugins_url('grid-print.css', $asset_ref);
?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8'); ?></title>
    <link rel="stylesheet" href="<?php echo esc_url($grid_css); ?>?v=1.002">
    <link rel="stylesheet" href="<?php echo esc_url($print_css); ?>?v=1.013">
</head>
<body class="chrisvf-grid-print<?php echo $is_index ? ' chrisvf-grid-print-index-page' : ''; ?>">
<header class="chrisvf-grid-print-header">
    <h1>Ventnor Fringe</h1>
    <p class="chrisvf-grid-print-date"><?php echo htmlspecialchars($display_date, ENT_QUOTES, 'UTF-8'); ?></p>
</header>
<?php
// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- grid/index markup from chrisvf_grid_print_* helpers
echo $grid_html;
?>
</body>
</html>
