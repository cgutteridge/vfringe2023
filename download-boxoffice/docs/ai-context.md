# AI Context

## Purpose

Produce a TSV export of current festival events from the Ventnor Exchange Little Box Office site.

## Repository reality

- Despite the path under `wp-content/plugins/`, this is currently a Node.js scraping utility.
- There is no WordPress runtime code in the repository at present.
- The script is optimized for speed of seasonal adaptation rather than reuse.

## Entry point

- `download.js`

## External dependency assumptions

- The browse listing pages live at `https://ventnorexchange.littleboxoffice.com/browse`.
- Event cards are linked via `a.block`.
- Event detail pages expose machine-readable event data in `script[type="application/ld+json"]`.
- The full event description is also present inside `div#vue[data-page]`.

If any of those assumptions change, the script will still run but may return partial or empty data.

## Output contract

The script writes `../boxoffice-events.tsv` relative to this repository.

Current columns:

- `Venue`
- `Date`
- `Start`
- `End`
- `Title`
- `Event`
- `Tags`
- `Description`

## Main data flow

### 1. Page list construction

The script hard-codes browse pages `1` through `24` using a `for` loop.

### 2. Browse page scraping

For each browse page:

- fetch HTML with `axios`
- parse it with `cheerio`
- collect each `href` from `a.block`
- strip query strings from event URLs

### 3. Event page scraping

For each event page:

- fetch HTML
- parse JSON-LD blocks
- attach the current page URL
- parse the Vue `data-page` payload
- copy `props.event.description` into `desc`

### 4. TSV generation

The script maps each event record into one tab-separated line and writes the file with `fs.writeFile`.

## Known fragility points

- Browse page count is fixed rather than discovered dynamically.
- Duplicate event URLs are not removed before detail-page fetches.
- Missing `description`, `location`, `startDate`, or `data-page` payloads can throw runtime errors.
- Description text is not sanitized for newline characters, so TSV row shape can break.
- Time formatting depends on the local machine timezone.
- Errors are logged but do not fail the overall run.

## Expected yearly edits

- target domain or browse URL filters
- number of browse pages
- CSS selectors used for listing links
- location of detailed description data
- TSV column list
- throttling and retry behavior

## Safe improvement direction

If the script needs another year or two of use, the highest-value hardening would be:

1. move configuration into constants at the top of the file
2. deduplicate discovered URLs
3. guard optional fields before dereferencing
4. sanitize tabs and newlines before TSV export
5. fail with a clear summary if zero events are scraped
