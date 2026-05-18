# ChrisVF WordPress Plugin

This repository is a WordPress plugin for the Ventnor Fringe site. It is not just the `download-boxoffice/` helper directory.

The plugin assembles festival event data from WordPress event posts and two tab-separated data files, then exposes that merged dataset through shortcodes used on the site.

## Repository layout

- `chrisvf.php`: plugin bootstrap plus shared event-loading and merge logic
- `itinerary.php`: itinerary UI, cookie storage, saved itinerary pages
- `map.php`: Leaflet-based festival map using `places.json`, `outlines.json`, `lines.json`, and `icons/`
- `grid.php`: timetable/grid view for a single day
- `ff.php`: Free Fringe listings
- `byday.php`: simplified day view
- `now_and_next.php`: upcoming and current-event widget
- `roulette.php`: random event picker
- `search.php`: simple event search
- `montydump.php`: JSON dump shortcode
- `boxoffice-events.tsv`: imported box office events that can overwrite matching WordPress events
- `extras.tsv`: extra manual events layered on top
- `download-boxoffice/`: separate Node utility that produces `boxoffice-events.tsv`

## How the plugin gets event data

The runtime event list is built in `chrisvf_get_info()` and `chrisvf_wp_events()` in `chrisvf.php`.

1. Load published WordPress `ajde_events` posts.
2. Read key metadata such as start/end timestamps and repeat intervals.
3. Pull venue terms from `event_location` and categories from `event_type`.
4. Expand repeating events into one record per occurrence.
5. Merge in rows from `boxoffice-events.tsv` and `extras.tsv`.
6. Let `boxoffice-events.tsv` replace a WordPress event when venue/date/start collide.

That merged array is the main contract used by all shortcodes.

## WordPress/plugin assumptions

This code assumes the site has:

- an `ajde_events` custom post type
- `event_location` and `event_type` taxonomies
- `evo_tax_meta` option data for venue coordinates
- The Events Calendar functions/hooks in at least the itinerary flow, including `tribe_events_single_event_after_the_content` and `tribe_get_start_date()`

This is festival code with year-specific assumptions. Avoid “generalizing” it unless the site actually needs that.

## Docs for maintainers

- [AGENTS.md](AGENTS.md)
- [docs/ai-context.md](docs/ai-context.md)
- [docs/maintenance.md](docs/maintenance.md)
- [download-boxoffice/docs/README.md](download-boxoffice/docs/README.md)

