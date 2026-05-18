# AI Context

## Purpose

Produce a TSV export of current festival events from the Ventnor Exchange Spektrix feed.

## Repository reality

- Despite the path under `wp-content/plugins/`, this is currently a Node.js scraping utility.
- There is no WordPress runtime code in the repository at present.
- The script is optimized for speed of seasonal adaptation rather than reuse.

## Entry point

- `download.js`

## External dependency assumptions

- The source feed lives at `https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json`.
- Festival events can be identified with `attribute_WebsiteListing === "VFringe"`.
- Event dates are supplied in `availableInstanceDates`.
- Venue text is embedded inside `htmlDescription`.

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
- `Event Type`
- `Is On Sale`
- `Is Sold Out`
- `Description`

## Main data flow

### 1. Feed download

The script downloads one JSON array from Spektrix.

### 2. Festival filtering

It keeps only records with `attribute_WebsiteListing === "VFringe"`.

### 3. Instance expansion

Each event is expanded into one TSV row per `availableInstanceDates` entry.

### 4. TSV generation

The script maps each event record into one tab-separated line and writes the file with `fs.writeFile`.

## Known fragility points

- The `VFringe` listing label is hard-coded.
- Venue parsing depends on the text layout inside `htmlDescription`.
- If `availableInstanceDates` disappears, fallback behavior is only to use `firstInstanceDateTime`.
- The `Event` column currently uses the Spektrix event `id`, not a public URL.
- Runtime fetching uses `curl`, so the host environment needs that binary available.

## Expected yearly edits

- source feed URL
- festival listing filter
- location and format of venue text
- whether each instance should still become its own row
- TSV column list
- fetch and retry behavior

## Safe improvement direction

If the script needs another year or two of use, the highest-value hardening would be:

1. move configuration into constants at the top of the file
2. deduplicate discovered URLs
3. guard optional fields before dereferencing
4. sanitize tabs and newlines before TSV export
5. fail with a clear summary if zero events are scraped
