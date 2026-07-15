# AI Maintenance Notes

## Scope

This repository root is the real WordPress plugin. Do not confuse it with `download-boxoffice/`, which is only a helper utility for producing `boxoffice-events.tsv`.

## Git workflow

This is a one-person project. There is no peer review and no pull-request process.

- New features and non-trivial fixes go on a branch.
- Test on the branch until the change is good enough to ship.
- Merge to `main`, then push `main` to the remote.

Do not assume a second reviewer, approval gates, or open PRs waiting for merge.

## First places to read

1. `README.md`
2. `chrisvf.php`
3. The specific shortcode file you are changing
4. `docs/maintenance.md`

## Architecture summary

- `chrisvf.php` is the central data layer.
- Most other PHP files register one or more shortcodes and render views from the shared event array.
- `mobile.php` is not a shortcode: it owns `/m` and `/m/json`, plus the minimal template in `templates/page-mobile.php`.
- Event data is hybrid:
  - WordPress event posts are the base dataset.
  - `boxoffice-events.tsv` can replace matching WordPress rows by venue/date/start.
  - `extras.tsv` adds manual rows.
- Map output also depends on curated JSON and image assets in this repository.
- The `/m` Map tab reuses `chrisvf_render_map()` with `layout=embedded` and `mobile=1` (modal hooks). Do not add a second Leaflet map implementation for `/m`.

## Important invariants

- Event records are associative arrays keyed by `UID`.
- Main fields expected by renderers include `UID`, `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `URL`, `LOCATION`, `SORTCODE`, and `CATEGORIES`.
- Many renderers call `strtotime()` on `DTSTART` and `DTEND`, so keep them in the existing compact ISO-like format such as `20260518T193000`.
- `boxoffice-events.tsv` is authoritative when it collides with a WordPress event at the same venue/date/start time.
- Venue naming must stay consistent across:
  - WordPress `event_location` terms
  - `boxoffice-events.tsv`
  - `extras.tsv`
  - `places.json`
  - `chrisvf_location_sortcode()`

## High-risk areas

- `chrisvf_wp_events()` in `chrisvf.php`: shared event contract, repeat handling, TSV merge logic
- `places.json` and `map.php`: venue name mismatches cause silent map omissions plus HTML comment warnings
- `itinerary.php`: year-specific cookie names and hard-coded paths
- `mobile.php` / `mobile.js`: rewrite routes, normalized JSON field names (`ticketUrl` / `siteUrl` / `free`), and map `mobile` mode — keep cookie + map shortcode behaviour compatible with the rest of the site
- Any changes to shortcode names: pages on the live site likely depend on them directly

## Seasonal assumptions to preserve unless intentionally updating them

- Festival branding and year strings may be hard-coded.
- Some URLs are absolute and point to site paths such as `/vfringe/map` or `/quick-search/`.
- The plugin contains pragmatic year-by-year fixes rather than a formal abstraction layer.

## Safe change pattern

1. Identify whether the change affects shared event data, one renderer, or imported TSV content.
2. Keep the event field contract stable unless you also update every consumer.
3. Preserve shortcode names and script/style handles unless there is a deliberate migration.
4. If changing venue labels, update all dependent files together.
5. If changing imported TSV columns, update both the downloader docs and TSV parsing in `chrisvf.php`.

## When working on the downloader

If the task is specifically about generating `boxoffice-events.tsv`, also read:

- `download-boxoffice/docs/README.md`
- `download-boxoffice/docs/ai-context.md`

