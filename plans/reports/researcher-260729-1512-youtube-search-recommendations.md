# Research: YouTube search and freeplay recommendations

Date: 2026-07-29  
Scope: Chrome MV3 extension; no code changes

## Executive recommendation

- Build exact-song search with the official YouTube Data API in the extension service worker.
- Add `Control` and `Search` tabs to the popup. Keep API calls out of content scripts.
- When a real YouTube playlist exists, continue showing it. In freeplay, do **not** label API search results as YouTube `Up next`: the official related-video endpoint no longer exists.
- Safe freeplay UX: show a `Similar on YouTube` list created from the current title/artist plus a `Play YouTube's next` action that uses the native Next control.
- Do not ship DOM-extracted personalized recommendations in a public/API-backed extension without YouTube's written approval. It is technically possible but fragile and conflicts with the API policy against scraping YouTube applications.

## Verified API facts (July 2026)

- `search.list` supports keyword search (`q`), `type=video`, `order=relevance`, locale/safety filters, and up to 50 results per call. One explicit query can return the top 5–10 candidates.
- Since June 2026, `search.list` has its own granular bucket: default 100 calls/day/project, 1 call charged per request. Other endpoints share the default 10,000-unit/day bucket.
- `videos.list` can enrich a batch of selected IDs with `contentDetails` (duration) and `status`; this is optional for MVP.
- `search.list.relatedToVideoId` was removed on 2023-08-07. There is currently no official Data API endpoint for YouTube's personalized `Up next`/recommendation sequence.
- The Data API's search relevance is not the same as the signed-in user's personalized recommendations on the watch page.

Sources:

- [YouTube `search.list` reference](https://developers.google.com/youtube/v3/docs/search/list)
- [2026 quota allocation and audit guide](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [Revision history: granular quota and removal of `relatedToVideoId`](https://developers.google.com/youtube/v3/revision_history)
- [YouTube API developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [Chrome cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chrome storage access levels](https://developer.chrome.com/docs/extensions/reference/api/storage)

## Current-code findings

- `content-script.js:218 getPlaylist()` only reads explicit playlist rows (`ytd-playlist-panel-video-renderer` / playlist page rows). A freeplay watch page therefore returns `[]`.
- `content-script.js:149 nextTrack()` clicks YouTube's native next button, so YouTube can choose/play the next item even though the extension cannot name the upcoming items.
- `content-script.js:260 playFromPlaylist(index)` is index-based and tied to the current DOM order. Search/similar items need stable `videoId`/URL navigation instead.
- `popup.js:134 updatePlaylist()` renders page-derived titles with `innerHTML`. Search work should replace this with DOM nodes + `textContent`; API/page metadata is untrusted input.
- `background.js` already owns cross-tab routing and is the natural home for `youtubeSearch` and `playYoutubeVideo` message handlers.
- `manifest.json` already has `tabs`, `storage`, and broad `<all_urls>` permission. Prefer adding/narrowing explicit API access to `https://www.googleapis.com/*` when permissions are cleaned up.

## Proposed search architecture

1. Popup `Search` tab sends `{action: "youtubeSearch", query, locale}` to the service worker only on submit/Enter.
2. Service worker loads the user's key, calls:
   `GET /youtube/v3/search?part=snippet&type=video&order=relevance&maxResults=10&q=...`.
3. Optional one-call enrichment: `videos.list(part=contentDetails,status&id=id1,id2,...)` for duration/availability.
4. Return normalized items:
   `{videoId, title, channelTitle, thumbnailUrl, duration?, publishedAt}`.
5. Render five results with `textContent`; preserve YouTube attribution and original thumbnail/title.
6. Click/Enter sends `playYoutubeVideo(videoId)`. Validate the ID, then update an existing YouTube media tab or create `https://www.youtube.com/watch?v=<id>` and focus it.
7. Save the user's chosen `query -> videoId` mapping locally to improve repeated exact-song selection.

### Exact-result selection

- Keep YouTube API relevance as the base order.
- Normalize case, whitespace, punctuation, and diacritics for comparison.
- Boost exact title/channel token matches and a previously user-selected result.
- Penalize `live`, `cover`, `remix`, `nightcore`, `karaoke`, or `lyrics` only when the query did not request them.
- Never display a numeric “YouTube score.” If highlighting a match, label it `App suggestion`, because the extra ranking is local product logic.
- Always let the user choose among results; do not silently autoplay the first result.

### Quota/cache behavior

- Search only on submit; no request per keystroke. Debounce only prevents double-submit.
- Cache by normalized query + region/language for 24 hours; LRU cap around 30 queries.
- YouTube permits limited non-authorized API data caching for at most 30 days and expects freshness; a 24-hour TTL is conservative.
- A second page consumes another search call; omit pagination from MVP.
- On `quotaExceeded`, serve a still-fresh cache entry if present and explain the limit. Search failure must not disable media controls.

## Freeplay recommendation options

| Option | Fidelity | Stability/compliance | Recommendation |
|---|---|---|---|
| Official API “Similar” search from cleaned current title + artist | Generic, not personalized | Stable; consumes one search call; must label as `Similar`, not `Up next` | Ship |
| Native Next button only | Exactly follows YouTube's next decision, but exposes no list | Already implemented; low maintenance | Keep |
| Read visible `#related`/watch-next DOM | Personalized list matching the page | Selectors/lazy rendering/SPA change often; YouTube API policy prohibits scraping YouTube applications | Do not ship publicly without approval |
| Undocumented YouTube internal endpoints | Potentially personalized | Reverse engineering/undocumented service; expressly disallowed by API policy | Reject |

If a private/local-only experimental DOM adapter is accepted despite the risk:

- Scope extraction to the visible related-results region, then collect deduplicated `/watch?v=` anchors; never call internal YouTube endpoints.
- Prefer semantic region + watch links over CSS class names; exclude the current video ID.
- Refresh on YouTube SPA navigation and a bounded `MutationObserver`; disconnect observers on teardown.
- Return stable `{videoId, href, title, channelTitle}` items and navigate by video ID, not list index.
- Gracefully fall back to native Next when the panel is absent, consent-gated, lazy, or changed.

## Queue/UI contract

- Replace the ambiguous `Playlist` heading with a source-aware queue:
  - `Playlist` for explicit YouTube/Spotify playlist rows.
  - `Similar on YouTube` for API-derived freeplay results.
  - `No queue — YouTube will choose the next video` when only native Next is available.
- Use one item contract: `{id, source, kind, title, artist, thumbnailUrl?, active, playTarget}`.
- Provider priority: explicit playlist > user search selection/history > similar search > native Next fallback.
- Search results should not silently mutate an existing playlist. “Add to queue” can be a later feature.

## Security and policy notes

- A key bundled in a public extension is extractable. Per-user keys avoid sharing one quota, but local persistence is risk reduction, not a hardware-backed secret.
- Never pass the key to a content script, page DOM, logs, error text, or query history.
- `chrome.storage.local` is exposed to content scripts by default. Restricting the whole area would also break current content-script settings access; either move the key to service-worker-owned IndexedDB or refactor non-secret settings delivery before using `setAccessLevel("TRUSTED_CONTEXTS")`.
- Perform Google API fetches in the service worker over HTTPS with an explicit Google APIs host permission.
- DOM scraping plus Data API usage is the major release-policy risk. A public Chrome Web Store build should use the compliant `Similar` approach or obtain written YouTube approval.

## Graceful failure states

- Missing key: show `Set up YouTube API key` linking to Options.
- Invalid/restricted key: distinguish configuration error from network failure.
- Quota exhausted: show reset/limit guidance and cached results if fresh.
- No results: retain query and suggest adding artist/title.
- Unavailable/deleted video: keep results list and mark the failed item.
- No existing YouTube tab: create one; if an existing media tab exists, update/focus it.

## Testing strategy

- Unit: query normalization, local ranking, requested-modifier penalties, LRU/TTL, response normalization, error mapping.
- Security: malicious titles/HTML entities render as text; key never appears in messages/logs/snapshots.
- Service worker: mock `fetch`, `chrome.storage`/IndexedDB, `tabs.query/update/create`; verify exact selected `videoId` navigation.
- Popup: keyboard navigation, empty/loading/error/cached states, Control/Search tab state.
- Queue: explicit playlist wins; freeplay uses Similar/native fallback; stable ID click replaces fragile index click.
- If DOM adapter exists: fixture tests for at least two markup shapes, duplicate/current filtering, SPA refresh, observer teardown.
- Manual unpacked-extension checks: signed-in/out YouTube, freeplay, explicit playlist, autoplay on/off, locale, Shorts, unavailable/age-restricted content.
- CI must use fixtures and fake API responses, never a real key or live quota.

## Unresolved questions

1. Is this extension personal/private, or intended for Chrome Web Store distribution? This determines whether any DOM recommendation experiment is acceptable.
2. Should Search always play on `youtube.com`, or optionally target `music.youtube.com` despite less predictable availability?
3. Should “Similar” consume quota automatically when opening the popup, or only after an explicit user click? Recommend explicit click.
4. Is duration required in MVP? Omitting `videos.list` keeps implementation/UI simpler.

