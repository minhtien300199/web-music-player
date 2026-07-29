---
phase: 1
title: "Personalized YouTube Feed Queue"
status: completed
progress: 100
priority: P1
effort: "2 days"
dependencies: []
---

# Phase 1: Personalized YouTube Feed Queue

## Overview

Add a default-off YouTube-only adapter that extracts a bounded snapshot from the active tab's currently rendered Home grid or watch recommendation rail when the selected chip is **All**. Extraction is explicit, local, fail-closed, and isolated from generic provider playlist parsing.

## Context Links

- [Feed feasibility research](./research/researcher-01-youtube-personalized-feed.md)
- [Scout report](./reports/scout-report.md)
- `content/provider-queue-adapter.js`
- `content-script.js`
- `shared/message-contracts.js`

## Key Insights

- Official YouTube Data API exposes no personalized Home/Up-next endpoint.
- DOM renderer names/selectors are private and may change by locale/experiment.
- “Visible on YouTube — All” is truthful; “personalized” or “Up next” is not guaranteed.

## Requirements

- User-triggered import only; require a recognized YouTube Home/watch surface and selected All chip.
- Parse visible watch anchors into validated 11-character `videoId`, bounded title/channel text, DOM order, source kind, document nonce, route/chip/root fingerprint, and timestamp. Omit thumbnails in MVP.
- Exclude current video, ads/promoted rows, Shorts, mixes/playlists, hidden/skeleton nodes, malformed entries, and duplicates; cap at 20.
- Never auto-click chip, auto-scroll, inspect cookies/account identity/page globals, intercept traffic, or read `ytInitialData`.
- The feature is disabled by default and enforced in popup, background, and content layers.
- Unsupported/loading/empty/non-All/stale-document states return distinct safe status and preserve existing playback.

## Architecture

`popup explicit action -> background resolves active tab in current window -> exact-tab content command -> content adapter -> normalized snapshot -> background validation`.

Create one selector ladder per recognized surface. Use semantic `/watch?v=` URL parsing and visible attributes. The content script assigns a per-document nonce and reads route, selected chip, root identity, and visible-card fingerprint before and after extraction; any change rejects the result. No persistent observer/history collector is needed for MVP.

## Related Code Files

- Create: `content/youtube-all-suggestions-adapter.js`
- Create: `tests/youtube-all-suggestions-adapter.test.js`
- Modify: `manifest.json`, `content-script.js`, `shared/message-contracts.js`, `background.js`, `popup/popup-player-controller.js`, `options/options.js`
- Read/reuse: `content/provider-media-controller.js`, `background/media-tab-router.js`, `background/storage-broker.js`

## Implementation Steps

1. Write sanitized Home/watch DOM fixtures covering valid cards, duplicate/current IDs, ads, Shorts, missing fields, non-All chip, loading, and unsupported renderer.
2. Define normalized snapshot/source/status contracts, bounded payload rules, and contracted content command/action names.
3. Add a default-off experimental preference and enforce it at popup, background, and content boundaries.
4. Resolve `active: true, currentWindow: true`; send the command to that exact tab instead of using the cached/audible media router.
5. Implement host guard, recognized roots, selected-chip verification without localized “All” text as the sole signal, visibility checks, normalization, dedupe, and cap.
6. Load the adapter before `content-script.js`; expose only the explicit content command.
7. Reject extraction unless document nonce and before/after route/chip/root/card fingerprints match.
8. Verify no account/cookie/internal endpoint, thumbnail, or unbounded DOM data enters messages or storage.

## Todo List

- [x] Add failing extraction/normalization fixtures.
- [x] Add message contracts and manifest load order.
- [x] Implement adapter and explicit content command.
- [x] Add and enforce default-off preference.
- [x] Bind import to the exact active tab/document and reject stale scans.
- [x] Add loading/empty/unsupported/non-All states.
- [x] Verify current video/ads/Shorts/duplicates are excluded.

## Success Criteria

- [x] Fixtures prove stable order, safe minimum fields, cap, dedupe, and fail-closed behavior.
- [x] Adapter sends no request and performs no page mutation.
- [x] A tab/document/route/chip/root/card change cannot return the previous surface snapshot as current.
- [x] Existing explicit YouTube/Spotify playlist extraction remains unchanged.

## Risk Assessment

- High: selector churn. Isolate adapter, return `unsupported`, feature-flag it, retain native fallback.
- High: scraping/policy exposure. Explicit action and local-only minimum data reduce surprise but do not replace policy approval.
- Medium: lazy DOM appears empty. Distinguish loading from settled empty; manual refresh rather than auto-scroll.

## Security Considerations

- Treat all DOM text/URLs as untrusted; rebuild canonical watch URLs and render with `textContent`.
- Bound every text field and aggregate payload; omit remote thumbnail URLs.
- Never collect identity, cookies, history pages, tracking parameters, hidden raw state, or transmit suggestion metadata externally.

## Next Steps

- Phase 2 stores the validated snapshot as the authoritative removable extension queue.
