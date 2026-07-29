---
phase: 3
title: "Search Experience"
status: implemented
effort: "2-3 days"
---

# Phase 3: Search Experience

## Context Links

- [Search/recommendations research](../reports/researcher-260729-1512-youtube-search-recommendations.md)
- [Scout report](../reports/scout-260729-1512-search-key-recommendations.md)
- Popup selection/routing: `popup.js:38-99`, initialization at `popup.js:262-266`
- Unsafe playlist rendering: `popup.js:134-156`
- Background dispatcher: `background.js:64-84`
- [YouTube `search.list`](https://developers.google.com/youtube/v3/docs/search/list)
- [YouTube quota and compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube revision history](https://developers.google.com/youtube/v3/revision_history)
- [Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)

## Overview

- Priority: P1
- Status: Implemented; live API, keyboard, and tab-routing checks remain part of Phase 5.
- Effort: 2-3 days

Add `Control` and `Search` tabs to the popup. Search uses official `search.list` only on submit, caches normalized results for 24 hours, ranks exact-song candidates locally, and always requires the user to select a result. The service worker owns API traffic and tab navigation.

## Implementation Sync — 2026-07-29

- Implemented popup Control/Search controllers and safe DOM rendering, submit-only background search, normalized ranking, a bounded session cache, credential-backed API requests, and stable `videoId` routing.
- Recorded fixture coverage includes credential mode replacement and ranking normalization/ranking; the tester recorded 6 passing Node tests and static syntax/manifest/security checks.
- Cache expiry, live API responses, keyboard navigation, and real multi-tab routing have no browser integration evidence yet and remain release-gate work.

## Key Insights

- As of July 2026, `search.list` uses a dedicated default bucket of 100 calls/day/project and charges one call per request. Keystroke search and automatic pagination are unsuitable for MVP.
- API relevance is useful but not guaranteed to identify the intended recording. Local normalization/modifier rules improve order, but the user remains the final chooser.
- Search results are untrusted metadata. Existing `innerHTML` patterns must not be reused.
- Selecting by `videoId` is stable; relying on a result's DOM index or arbitrary returned URL is not.

## Requirements

### Functional

- Popup tabs are keyboard accessible and keep Control functional while Search is loading/erroring.
- Search occurs only on form submit/Enter; ignore empty queries and suppress duplicate in-flight submits.
- Request `part=snippet`, `type=video`, `order=relevance`, `maxResults=10`; return 5-10 normalized results without pagination.
- Rank locally using normalized title/channel/query tokens and explicit modifiers; label any promoted result `App suggestion`.
- Preserve a bounded pending query and selected popup tab in `chrome.storage.session` when opening Options; restore for explicit resubmission, not automatic quota use.
- Clicking/pressing Enter on a result sends its validated `videoId`; never silently autoplay result one.

### Non-functional

- 24-hour cache keyed by normalized query + region/language; LRU maximum 30 entries in `chrome.storage.session` by default.
- Network timeout, bounded response size/fields, safe YouTube error mapping, and one retry only when explicitly user-initiated.
- Do not call `videos.list` in MVP unless duration is later accepted as a requirement.
- Keep popup/search/service/cache/ranking modules under 200 lines.

## Architecture

Flow:

`Search form -> YOUTUBE_SEARCH -> background search service -> credential request -> cache/API -> normalized/ranked SearchResult[]`

`Selected result -> PLAY_YOUTUBE_VIDEO(videoId, mediaContextRevision?) -> media-tab router -> validate current context -> tabs.update/create -> focus`

Search service responsibilities:

- Normalize query (Unicode, case, whitespace, punctuation, diacritics for comparison only).
- Read/write a trusted non-secret 24-hour LRU cache.
- Call only official `https://www.googleapis.com/youtube/v3/search`.
- Normalize thumbnails/text and discard entries without a valid video ID.
- Map `keyInvalid`, `accessNotConfigured`, `quotaExceeded`, timeout, network, and malformed-response states.

Ranking responsibilities:

- Preserve API order as a base score.
- Boost exact/complete query title tokens, artist/channel tokens, and bounded previous user selection for the same normalized query.
- Penalize `live`, `cover`, `remix`, `nightcore`, `karaoke`, or `lyrics` only when the query did not include that modifier.
- Never expose a synthetic numeric score as YouTube-provided data.

## Related Code Files

### Modify

- `popup.html` — `Control`/`Search` tablist, form, states, results, setup link.
- `popup.css` — shared shell/tab styling kept below 200 lines.
- `popup.js` — bootstrap controllers and retain current selected-tab context.
- `background.js` — register search/play actions.
- `manifest.json` — preserve verified coverage of the fixed Google API origin through the existing `<all_urls>` product scope; do not add a redundant host pattern.

### Create

- `popup/popup-search-controller.js` — form state, tab persistence, keyboard selection.
- `popup/popup-search-view.js` — safe node creation with `textContent`.
- `background/youtube-search-service.js` — official request/normalization/error boundary.
- `background/youtube-search-cache.js` — 24-hour, 30-entry LRU and selected-result preference.
- `shared/youtube-search-ranking.js` — pure query normalization and ranking.
- `tests/youtube-search-service.test.js`, `tests/youtube-search-ranking.test.js`, `tests/popup-search.test.js`, `tests/youtube-video-router.test.js`.

### Delete

- None.

## Implementation Steps

1. Add pure tests for normalization, diacritics/punctuation, modifier penalties, stable API-order ties, learned-choice boost, invalid IDs, and malicious metadata.
2. Implement a bounded cache with injected clock: normalized query + region/language key, 24-hour TTL, 30-entry LRU, deterministic eviction, no API key/request headers.
3. Implement `youtube-search-service` using encoded URL parameters and the Phase 2 header broker. Fetch only after explicit action; validate HTTP/JSON shape and cap returned fields/items.
4. Add safe error codes and cached fallback: on quota/network errors return a still-fresh cache hit with `cached: true`; otherwise retain the query and show an actionable status.
5. Build the popup tab shell with ARIA tab roles, focus management, Enter/Space behavior, and independent Control/Search state. Persist only the pending query/tab/expiry needed for the Options round-trip.
6. Implement Search states: missing key with Options link, idle, loading, results, empty, cached, invalid/restricted key, API disabled, quota exhausted, timeout/network, and unavailable playback.
7. Render results using `createElement`, `textContent`, validated HTTPS thumbnails, and YouTube attribution; never insert API strings through `innerHTML`.
8. Implement local ranking and record only the bounded `normalizedQuery -> selectedVideoId` preference after a deliberate selection.
9. Implement `PLAY_YOUTUBE_VIDEO`: validate the exact ID, exact HTTPS YouTube host, and current `MediaContext` revision; reuse the current YouTube media tab when valid, otherwise an active exact-host YouTube tab, otherwise create a watch URL; focus the target.
10. Add Clear Search Data; Forget also clears session cache, pending query, and learned selection state.
11. Prevent double-submit, omit infinite scroll/pagination, and add a visible quota-conscious note without exposing internal credentials.
12. Run unit/regression tests and manually verify mouse/keyboard selection, Options round-trip, tab switching, multiple YouTube tabs, and search failure without disrupting Control.

## Todo List

- [ ] Complete cache/service/router integration fixtures (ranking coverage is implemented).
- [x] Implement 24-hour, 30-entry LRU cache.
- [x] Implement submit-only official search service.
- [x] Add accessible Control/Search popup tabs.
- [x] Render result/error states with safe DOM APIs.
- [x] Add local exact-match ranking and bounded selection preference.
- [x] Navigate only by validated user-selected `videoId`.
- [ ] Pass manual keyboard, live API, and multi-tab checks.

## Success Criteria

- [ ] Confirm API call counts and cache behavior with a live restricted key.
- [ ] Confirm cache reuse/expiry in the unpacked extension.
- [ ] Confirm 5-10 safe selectable results and no auto-play in Chrome.
- [x] Exact/modifier-aware ranking is deterministic local logic in recorded fixtures.
- [ ] Confirm the selected `videoId` opens in the intended live YouTube tab or a new tab.
- [x] Code exposes distinct safe missing-key/error states without raw API error output.
- [ ] Confirm search failures leave Control/media actions usable in live Chrome.

## Risk Assessment

- High: project quota can be exhausted quickly. Enforce submit-only, no pagination, TTL/LRU caching, and duplicate-submit suppression.
- Medium: local ranking can over-promote an unintended variant. Keep API order as base and require user selection.
- Medium: multi-tab reuse may navigate the wrong playback context. Validate preferred tab/provider and focus the final target.
- Medium: result thumbnails/text can be malicious or malformed. Allow only validated fields/HTTPS URLs and render text safely.

## Security Considerations

- Fetch only the fixed Google APIs origin; do not accept a caller-provided endpoint or headers.
- Validate query length, locale enums, response count, video IDs, and target tab URLs.
- Treat queries as sensitive listening history: keep them session-scoped by default, bound TTL/size, implement Clear Search Data now, and never combine them with key storage responses.
- Never log fetch options, request headers, raw Google error payloads, or extension storage snapshots.

## Next Steps

- Phase 4 reuses this service and ranking/cache boundary for explicitly requested `Similar on YouTube` results.
- Duration enrichment and pagination remain deferred until evidence shows the extra quota/UI is needed.
