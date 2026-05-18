# Annual Maintenance

Use this checklist at the start of each festival cycle.

## 1. Verify the source site still matches assumptions

Check these first:

- browse URL still works
- browse pages still use `a.block` for event links
- event pages still include `script[type="application/ld+json"]`
- event pages still expose the long description in `div#vue[data-page]`

If any of these fail, inspect the live HTML and update selectors or parsing logic before changing anything else.

## 2. Confirm scope for the current year

Decide:

- which venue or domain should be scraped
- whether past events must be excluded
- whether unavailable events should be hidden
- whether output columns have changed
- whether the output location is still `../boxoffice-events.tsv`

## 3. Check page-count assumptions

The current script requests pages `1..24`.

Update this when:

- there are fewer pages and requests become wasteful
- there are more pages and events would otherwise be missed

Prefer dynamic pagination if this script starts surviving across multiple seasons.

## 4. Run a small test scrape

Before trusting a full export:

1. run the script against one browse page
2. inspect a few discovered event URLs
3. inspect one generated TSV row manually
4. confirm description text has not broken the TSV structure

## 5. Validate output shape

Review:

- date format
- time format
- description cleanliness
- missing venue/title fields
- duplicate rows

## 6. Record this year’s changes

At minimum, note:

- which selectors changed
- which fields moved source
- whether extra cleanup rules were added
- whether this year introduced one-off hacks that should not be carried forward blindly

## 7. End-of-season expectation

This repository does not need to be treated as a permanent system. If the festival workflow changes after the season, it is acceptable to leave the code in a pragmatic state as long as:

- the docs explain the current assumptions
- the next maintainer can see where to update it
- obvious runtime traps are called out
