# ChrisVF WordPress Plugin

This repository is a WordPress plugin for the Ventnor Fringe site. It is not just the `download-boxoffice/` helper directory.

The plugin assembles festival event data from WordPress event posts and two tab-separated data files, then exposes that merged dataset through shortcodes used on the site.

## Repository layout

- `chrisvf.php`: plugin bootstrap plus shared event-loading and merge logic
- `itinerary.php`: itinerary UI, cookie storage, saved itinerary pages
- `itinerary-ics.php`: downloadable itinerary calendar at `/itinerary-ics?ids=...`
- `map.php`: Leaflet-based festival map using `places.json`, `outlines.json`, `lines.json`, and `icons/`
- `grid.php`: timetable/grid view for a single day
- `ff.php`: Free Fringe listings
- `byday.php`: simplified day view
- `now_and_next.php`: upcoming and current-event widget
- `roulette.php`: random event picker
- `search.php`: simple event search
- `montydump.php`: JSON dump shortcode
- `mobile.php`: standalone mobile programme at `/m` plus JSON feed at `/m/json`
- `boxoffice-events.tsv`: imported box office events that can overwrite matching WordPress events
- `extras.tsv`: extra manual events layered on top
- `download-boxoffice/`: separate Node utility that produces `boxoffice-events.tsv`

## Mobile programme (`/m`)

A plugin-owned standalone app for phones. No theme header/nav.

| URL | Purpose |
|-----|---------|
| `/m` | Programme UI (day list, search/filters, itinerary, embedded festival map) |
| `/m/json` | Normalized programme JSON consumed by the UI |
| `/itinerary-ics` | Pretty URL for calendar download (also `/?chrisvf_itinerary_ics=1&ids=…`) |

### Setup

1. Ensure the `chrisvf` plugin is active (loads `mobile.php`).
2. Visit **Settings → Permalinks** and Save once after deploy if `/m`, `/m/json`, or `/itinerary-ics` 404s (rewrite flush).
3. Optional: create a WordPress page with slug `m` and the **Mobile Programme** template — mainly for editor convenience. The plugin also serves `/m` directly via `template_redirect`.

### Behaviour notes

- Festival days come from event data in `/m/json` (not hard-coded dates in JS).
- Day window matches other programme views: roughly 08:00 → 02:00 next calendar morning.
- Itinerary uses the shared cookie helpers in `itinerary.js` (`itinerary2025` today — keep in sync with the grid when rolling the year).
- Desktop `/itinerary` and `/m` itinerary filter share export helpers in `itinerary.js` (email, copy plain+HTML, download calendar via `/itinerary-ics`).
- Map tab embeds `chrisvf_render_map(['layout' => 'embedded', 'mobile' => '1'])`. Popup event links open the same `/m` modal; the normal `/vfringe/map` slug still navigates to event pages.
- Text size preference is stored in `localStorage`; mobile view state persists in `sessionStorage` and is mirrored to the URL hash for in-app Back/Forward navigation.
- 2026 style branding is deliberately light (Work Sans / Suez One, warm paper, gold active chrome). How to roll it back without removing `/m`: see **Rolling back 2026 `/m` style branding** in [`docs/maintenance.md`](docs/maintenance.md).

### Acceptance checklist

- [ ] `/m` loads without theme chrome; `/m/json` returns valid JSON with `Cache-Control`
- [ ] Default day is today during festival dates, otherwise first festival day
- [ ] Search, All/Free/My itinerary filters, and text size work together
- [ ] Event modal: tickets / site / add-remove itinerary as expected; syncs with grid cookie
- [ ] Itinerary filter shows Email / Copy / Download calendar; calendar file opens with times and venues
- [ ] Map tab shows the shared Leaflet map; tapping an event opens the modal
- [ ] Usable on a ~375px viewport; keyboard can reach tabs, filters, list rows, and modal Close
- [ ] Documented permalink flush and cookie year noted for next season

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

## Git workflow

One maintainer; no peer review. Branch for new features, test on the branch, merge to `main`, push.

## Docs for maintainers

- [AGENTS.md](AGENTS.md)
- [docs/ai-context.md](docs/ai-context.md)
- [docs/maintenance.md](docs/maintenance.md)
- [download-boxoffice/docs/README.md](download-boxoffice/docs/README.md)
