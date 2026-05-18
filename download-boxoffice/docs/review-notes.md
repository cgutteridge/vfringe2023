# Review Notes

This file captures the main technical risks in the current implementation.

## Findings

### High

1. The TSV export can be structurally corrupted by event descriptions.

`download.js` only removes tab characters from `desc`, but does not remove or escape newline characters before joining rows with `\n`. A multi-line description will split one logical row across several TSV lines and break downstream import assumptions.

Relevant code:

- `download.js:67`
- `download.js:91`

2. Several required fields are dereferenced without guards, so minor source markup changes can crash event extraction.

The script assumes `div#vue[data-page]` exists, assumes the JSON parses, assumes `props.event.description` is present, and then calls `replace()` on it. It also assumes `location.name` and `startDate` exist when building rows.

Relevant code:

- `download.js:64`
- `download.js:65`
- `download.js:67`
- `download.js:80`
- `download.js:81`

### Medium

3. Event times are converted using the local machine timezone rather than the source timezone.

`formatTime()` creates a JavaScript `Date` and reads local hours/minutes. If the source timestamps include timezone information, the exported values will vary depending on where the script is run.

Relevant code:

- `download.js:102`
- `download.js:103`
- `download.js:104`

4. The scraper has a hard-coded browse page range and will silently miss events if the festival grows beyond that range.

The script loops from `1` to `24` inclusive by using `i < 25`. This is a yearly maintenance trap because page count is operational data, not code logic.

Relevant code:

- `download.js:2`
- `download.js:3`

5. Dependency metadata is inaccurate and likely stale.

`package.json` declares `pupeteer`, which appears to be a typo for `puppeteer`, and the script does not use it at all. It also declares `path`, even though Node already provides that module. This increases noise for future maintainers and makes the repository look less trustworthy than it needs to.

Relevant code:

- `package.json:5`
- `package.json:6`

### Low

6. Duplicate event URLs are not removed before detail-page scraping.

If the browse pages repeat the same event link, the script will fetch and export it multiple times.

Relevant code:

- `download.js:21`
- `download.js:33`
- `download.js:119`

7. Error handling is log-only, so failed scrapes may still produce a misleadingly successful output.

The script logs request and parsing failures, but the overall run still completes with `done`, even if most pages fail or zero records are exported.

Relevant code:

- `download.js:37`
- `download.js:57`
- `download.js:70`
- `download.js:127`

## Suggested next hardening steps

If you want to improve the script without turning it into a larger project, the best next steps are:

1. sanitize `Description` for both tabs and newlines
2. add null checks around `vueRaw`, `desc`, `location`, and `startDate`
3. deduplicate URLs with a `Set`
4. surface a final summary with counts and fail clearly when zero events are exported
5. move yearly settings into named constants
