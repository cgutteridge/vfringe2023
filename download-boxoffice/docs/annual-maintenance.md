# Annual Maintenance

Use this checklist at the start of each festival cycle.

## 1. Verify the source site still matches assumptions

Check these first:

- `eventsView.json` still works
- festival events are still marked with `attribute_WebsiteListing === "VFringe"`
- `availableInstanceDates` still contains the dates that should be exported
- `htmlDescription` still contains extractable venue text

If any of these fail, inspect the live payload and update parsing logic before changing anything else.

## 2. Confirm scope for the current year

Decide:

- which `attribute_WebsiteListing` values should be included
- whether only available instances should be exported
- whether one row per instance is still the right shape
- whether output columns have changed
- whether the output location is still `../boxoffice-events.tsv`

## 3. Check field assumptions

The current script depends on these fields:

- `attribute_WebsiteListing`
- `availableInstanceDates`
- `duration`
- `htmlDescription`
- `description`
- `name`
- `id`

If any become optional or are renamed, update the export mapping and rerun a sample.

## 4. Run a small test scrape

Before trusting a full export:

1. download the JSON feed once
2. inspect a few `VFringe` records
3. inspect one generated TSV row manually
4. confirm description and venue text have not broken the TSV structure

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
