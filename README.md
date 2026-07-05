# LeetTrack

Local-only Chrome extension that tracks new vs re-solved LeetCode problems,
starting from install day. No backend, no account, no scraping of your past
submission history (that data isn't available without LeetCode's private
API, and this deliberately doesn't try to work around that).

## Install (unpacked, for now)

1. `chrome://extensions`
2. Enable "Developer mode" (top right)
3. "Load unpacked" -> select this `leettrack/` folder
4. Open any `https://leetcode.com/problems/<slug>/` page and submit a solution

## How detection actually works

LeetCode's frontend polls `POST/GET https://leetcode.com/submissions/detail/<id>/check/`
after you submit, until it gets back `state: "SUCCESS"`. `inject.js` patches
`fetch` and `XMLHttpRequest` **in the page's own context** to watch for that
response. When `status_msg === "Accepted"`, it fires a `CustomEvent` that
`content.js` picks up, pulls the problem title/difficulty off the DOM, and
sends it to the background worker, which does the actual dedupe + write.

## Known fragility (being straight with you)

- This is not a documented/public API. LeetCode can change the endpoint
  path, response shape, or DOM structure for title/difficulty at any time
  without notice, and this will silently stop detecting solves until the
  selectors/regex in `content/content.js` and `content/inject.js` are
  updated. There's no way around this without LeetCode publishing a stable
  API - scraping/reverse-engineering always carries this risk.
- If LeetCode ships a full page reload during submission (unlikely given
  their current SPA architecture, but not impossible), an in-flight
  submission could be missed. Test this yourself before trusting it for
  months of unattended tracking.
- Difficulty/title extraction has fallback selectors but if all of them
  fail, difficulty shows as "Unknown" rather than silently guessing wrong.

## Data storage

Everything lives in `chrome.storage.local` on your machine (`unlimitedStorage`
permission requested so normal usage never hits a quota wall). Nothing is
sent anywhere. Uninregistering the extension deletes the data - export first
if you want to keep it (Settings tab -> Export CSV/JSON).

## Extending it

- All storage reads/writes go through `storage/storage.js` - that's the one
  file to touch if you change the data schema.
- All date/streak math lives in `utils/date.js`, independent of storage or
  DOM, so it's easy to unit test in isolation.
- Detection logic (the part most likely to need future patches) is isolated
  to `content/inject.js` (network interception) and the metadata-extraction
  function in `content/content.js` (DOM selectors).
