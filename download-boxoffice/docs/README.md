# Download Box Office Docs

This repository is a small seasonal utility used to reconcile Spektrix festival
events into a local TSV that retains sold-out and cancelled performances.

It is not currently a conventional WordPress plugin with PHP entry points, hooks, admin UI, or deployable plugin structure. The Node.js script fetches a Spektrix JSON feed, filters the festival listing, reconciles against the existing TSV, and writes `boxoffice-events.tsv` plus an append-only change log one directory above this folder.

## Current shape

- Main script: `download.js`
- Tests: `reconcile.test.js` (`node --test`)
- Package metadata: `package.json`
- Lockfile: `package-lock.json`
- Output files: `../boxoffice-events.tsv`, `../boxoffice-changes.log`
- Venue overrides: `venue-mappings.json`

## What the script does

1. Downloads `https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json`.
2. Filters to records where `attribute_WebsiteListing === "VFringe"`.
3. Reads the existing `boxoffice-events.tsv` (the memory of every performance).
4. Reconciles by `EventId + Date + Start`:
   - new buyable instances → add
   - missing buyable instances for a still-live future event → sold out (keep row)
   - event object absent from the feed before performance start → cancelled (keep row, `CANCELLED - ` title prefix)
   - rows that disappear after their performance has started → ignored (Spektrix drops past slots)
   - overlapping rows with different metadata → change metadata
5. Appends transitions to `boxoffice-changes.log` and prints them.
6. Writes a header-first, date/time-sorted TSV with these columns:
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

## Why this needs annual review

This code is intentionally short-lived and pragmatic. It is updated progressively each year as:

- the Spektrix feed schema changes
- event metadata moves between plain fields and `htmlDescription`
- the festival listing name changes
- required output columns change
- the festival-specific workflow changes

The repository should be treated as a yearly utility, not a long-lived product with a stable API.

## Documents in this folder

- `ai-context.md`: fast orientation for future AI or human maintainers
- `annual-maintenance.md`: checklist for updating the scraper each year
- `review-notes.md`: code review findings and risks in the current implementation
