# Download Box Office Docs

This repository is a small seasonal scraper used to export event data from Spektrix into a TSV file for festival use.

It is not currently a conventional WordPress plugin with PHP entry points, hooks, admin UI, or deployable plugin structure. The repository contains a Node.js script that fetches a Spektrix JSON feed, filters the festival listing, expands event instances into TSV rows, and writes a `boxoffice-events.tsv` file one directory above this repository.

## Current shape

- Main script: `download.js`
- Package metadata: `package.json`
- Lockfile: `package-lock.json`
- Output file: `../boxoffice-events.tsv`

## What the script does

1. Downloads `https://app.spektrix-link.com/clients/ventnorexchange/eventsView.json`.
2. Filters to records where `attribute_WebsiteListing === "VFringe"`.
3. Expands each event into one row per available instance date/time.
4. Extracts venue text from `htmlDescription`.
5. Writes a tab-separated export with these columns:
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
