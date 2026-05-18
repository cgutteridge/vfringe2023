# Maintenance Guide

## Typical update tasks

### Seasonal rollover

- Search for hard-coded year strings such as `2025`.
- Check cookie names in `itinerary.php`.
- Check social/share text and saved itinerary URLs.
- Verify absolute paths such as `/vfringe/map`, `/vfringe/planner`, `/itinerary`, and `/quick-search/`.

### Box office import refresh

- Regenerate `boxoffice-events.tsv` from `download-boxoffice/` if needed.
- Confirm TSV headings still match the parser in `chrisvf.php`.
- Check for venue labels that no longer match WordPress taxonomy terms or `places.json`.
- Review overwrite warnings produced when TSV rows replace WordPress events.

### Map updates

- Keep `places.json` venue labels aligned with event `LOCATION` values.
- Add or adjust icons in `icons/` when new POI types are introduced.
- Update `outlines.json` and `lines.json` when geography changes.
- Use page output comments or debug mode to catch unmapped venues.

### Renderer updates

- Keep shortcode names stable unless pages are migrated at the same time.
- Expect most renderers to depend on `SUMMARY`, `LOCATION`, `DTSTART`, `DTEND`, `URL`, and `CATEGORIES`.
- Treat all-day events carefully; some views intentionally skip them.

## Practical edit boundaries

Change only one layer at a time unless the task clearly spans layers:

- shared event contract: `chrisvf.php`
- map: `map.php` plus JSON/icon assets
- itinerary: `itinerary.php`, `itinerary.js`, `itinerary.css`
- schedule/grid: `grid.php`, `grid.js`, `grid.css`, `byday.php`, `byday.css`
- curated data: `boxoffice-events.tsv`, `extras.tsv`, `places.json`, `outlines.json`, `lines.json`
- downloader: `download-boxoffice/`

## Files an AI should inspect before editing

- `chrisvf.php`
- the target shortcode file
- this document
- `AGENTS.md`

If a task touches imported ticketed data, also inspect `download-boxoffice/docs/`.

