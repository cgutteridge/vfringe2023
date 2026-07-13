# Maintenance Guide

## Typical update tasks

### Seasonal rollover

- Search for hard-coded year strings such as `2025`.
- Check cookie names in `itinerary.php` (and keep `/m` on the same cookie via `itinerary.js`).
- Check social/share text and saved itinerary URLs.
- Verify absolute paths such as `/vfringe/map`, `/vfringe/planner`, `/itinerary`, `/m`, and `/quick-search/`.
- After deploy, flush permalinks once if `/m` or `/m/json` 404s.

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

### Mobile programme (`/m`)

- Keep routes and templates in sync: `mobile.php`, `mobile.js`, `mobile.css`, `templates/page-mobile.php`.
- Map tab behaviour is owned by `map.php` (`layout=embedded`, `mobile=1`); do not fork a second map for `/m`.
- After deploy, flush permalinks once if `/m` or `/m/json` 404s.

### Rolling back 2026 `/m` style branding

The gentle festival styling and related filter/search UX on `/m` landed as three commits on top of the working programme UI (parent tip: *Point the /m footer at the full website home.*):

1. *Give /m gentle 2026 VFringe branding without redesigning the UI.* — fonts, paper/gold tokens in `mobile.css`, Google Fonts enqueue in `mobile.php`
2. *Polish /m search and closed filter summary copy.* — clear-search control, weekday ordinals, hide `· All` in the summary
3. *Keep the selected /m day chip visible on narrow screens.* — `scrollSelectedDayIntoView()` in `mobile.js`

**Files involved:** `mobile.css`, `mobile.js`, `mobile.php` only.

**Unpick style/UX polish only** (keep `/m` working, restore the pre-branding mobile UI):

```bash
# From the plugin repo root, after these commits are on main:
git revert --no-commit 2d2214b 84ec9df ade51be
git commit -m "Revert 2026 /m style branding and related filter UX polish."
```

If those SHAs are no longer in history (rebase/squash), find them with:

```bash
git log --oneline --grep='gentle 2026 VFringe branding'
git log --oneline -- mobile.css mobile.js mobile.php
```

Or reset just those three files to the pre-branding `/m` tip (the parent of the branding commit), bump the asset versions in `mobile.php`, and commit:

```bash
git checkout <pre-branding-sha> -- mobile.css mobile.js mobile.php
# then increment the chrisvf-mobile style/script versions so browsers drop the cached CSS/JS
```

**Unpick the whole `/m` feature merge** (remove routes/UI/JSON as well as style):

```bash
# Prefer reverting the merge commit rather than a hard reset on a shared main:
git revert -m 1 <merge-commit-sha>
```

Then flush permalinks after deploy if rewrite rules were added with `/m`.

## Practical edit boundaries

Change only one layer at a time unless the task clearly spans layers:

- shared event contract: `chrisvf.php`
- map: `map.php` plus JSON/icon assets
- itinerary: `itinerary.php`, `itinerary.js`, `itinerary.css`
- mobile programme: `mobile.php`, `mobile.js`, `mobile.css`, `templates/page-mobile.php` (map via `map.php` with `layout`/`mobile` attrs)
- schedule/grid: `grid.php`, `grid.js`, `grid.css`, `byday.php`, `byday.css`
- curated data: `boxoffice-events.tsv`, `extras.tsv`, `places.json`, `outlines.json`, `lines.json`
- downloader: `download-boxoffice/`

## Files an AI should inspect before editing

- `chrisvf.php`
- the target shortcode file
- this document
- `AGENTS.md`

If a task touches imported ticketed data, also inspect `download-boxoffice/docs/`.

