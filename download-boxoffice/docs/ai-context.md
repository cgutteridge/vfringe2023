# AI Context

## Purpose

Reconcile festival events from the Ventnor Exchange Spektrix feed into a local
TSV that retains every performance ever seen (sold-out and cancelled included).

## Repository reality

- Despite the path under `wp-content/plugins/`, this is currently a Node.js scraping utility.
- There is no WordPress runtime code in the repository at present.
- The script is optimized for speed of seasonal adaptation rather than reuse.

## Entry point

- `download.js` — network fetch + reconcile + write
- `reconcile.test.js` — `node --test` coverage of the pure reconcile logic
- `venue-mappings.json`

## External dependency assumptions

- The source feed lives at `https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json`.
- Festival events can be identified with `attribute_WebsiteListing === "VFringe"`.
- Buyable dates are supplied in `availableInstanceDates`.
- `instanceDates` is only a human-readable range string and cannot reconstruct the schedule.
- Venue text is embedded inside `htmlDescription`.

If any of those assumptions change, the script will still run but may return partial or empty data.

## Output contract

The script writes:

- `../boxoffice-events.tsv` — reconciled performance list
- `../boxoffice-changes.log` — appended change log (one line per real transition)

Current TSV columns:

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

Cancelled shows keep their rows and prefix `Title` with `CANCELLED - `.
Sold-out performances keep their rows and set `Is Sold Out` to `true`.

## Main data flow

### 1. Feed download

The script downloads one JSON array from Spektrix.

### 2. Festival filtering

It keeps only records with `attribute_WebsiteListing === "VFringe"`.

### 3. Read existing TSV

The local TSV is the memory of every performance. Rows are never deleted by
reconcile.

### 4. Reconcile (key = EventId + Date + Start)

| Feed signal | Action |
|-------------|--------|
| Buyable instance not in TSV | **add** |
| Existing instance still buyable, metadata differs | **change metadata** |
| Event present, future instance no longer buyable (or whole show `isSoldOut`) | **sold out** |
| Future event object absent from feed | **cancelled** (`CANCELLED - ` title prefix) |
| Row disappears after its performance start time | **ignore**; Spektrix drops past slots |
| Previously cancelled/sold-out instance back on sale | **reinstated** |

A reschedule (old date leaves, new date appears) logs as **sold out** + **add**.
If a vanished performance was actually a cancellation rather than a sell-out,
edit the TSV manually.

### 5. Venue normalization

The raw venue text is extracted from `htmlDescription` and then normalized via
`venue-mappings.json`.

### 6. Change log

Each genuine transition appends:

```text
<ISO timestamp>	<add|sold out|cancelled|change metadata|reinstated>	<venue>	<date>	<start>	<name>
```

The same lines are printed to the console. An idempotent rerun prints `No changes`.

## Known fragility points

- The `VFringe` listing label is hard-coded.
- Venue parsing depends on the text layout inside `htmlDescription`.
- Venue normalization depends on `venue-mappings.json` staying aligned with the current Spektrix wording.
- A brand-new show that is already fully sold out can only seed from `firstInstanceDateTime` (one row), so run the downloader regularly before shows sell out.
- Runtime fetching uses `curl`, so the host environment needs that binary available.

## Expected yearly edits

- source feed URL
- festival listing filter
- location and format of venue text
- TSV column list
- fetch and retry behavior

## Tests

```bash
cd download-boxoffice
node --test reconcile.test.js
```
