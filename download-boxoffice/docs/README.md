# Download Box Office Docs

This repository is a small seasonal scraper used to export event data from Little Box Office into a TSV file for festival use.

It is not currently a conventional WordPress plugin with PHP entry points, hooks, admin UI, or deployable plugin structure. The repository contains a Node.js script that fetches event listing pages, discovers event URLs, extracts event metadata, and writes a `boxoffice-events.tsv` file one directory above this repository.

## Current shape

- Main script: `download.js`
- Package metadata: `package.json`
- Lockfile: `package-lock.json`
- Output file: `../boxoffice-events.tsv`

## What the script does

1. Builds a fixed list of Little Box Office browse URLs for pages `1..24`.
2. Scrapes each browse page for links matching `a.block`.
3. Visits each discovered event URL.
4. Extracts JSON-LD from `script[type="application/ld+json"]`.
5. Extracts the richer event description from `div#vue[data-page]`.
6. Writes a tab-separated export with these columns:
   - `Venue`
   - `Date`
   - `Start`
   - `End`
   - `Title`
   - `Event`
   - `Tags`
   - `Description`

## Why this needs annual review

This code is intentionally short-lived and pragmatic. It is updated progressively each year as:

- the box office site markup changes
- event metadata moves between JSON-LD and Vue payloads
- the number of browse pages changes
- required output columns change
- the festival-specific workflow changes

The repository should be treated as a yearly utility, not a long-lived product with a stable API.

## Documents in this folder

- `ai-context.md`: fast orientation for future AI or human maintainers
- `annual-maintenance.md`: checklist for updating the scraper each year
- `review-notes.md`: code review findings and risks in the current implementation
