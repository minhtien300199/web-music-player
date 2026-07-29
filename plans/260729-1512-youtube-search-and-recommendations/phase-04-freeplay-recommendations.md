---
phase: 4
title: "Freeplay Recommendations"
status: implemented
effort: "1-2 days"
---

# Phase 4: Freeplay Recommendations

## Context Links

- [Search/recommendations research](../reports/researcher-260729-1512-youtube-search-recommendations.md)
- [Scout report](../reports/scout-260729-1512-search-key-recommendations.md)
- Explicit playlist extraction: `content-script.js:218-258`
- Index-based playback: `content-script.js:260-282`
- Native YouTube Next: `content-script.js:149`
- Queue rendering: `popup.js:134-156`, mini-player at `content-script.js:681-702`
- [YouTube revision history](https://developers.google.com/youtube/v3/revision_history)
- [YouTube API developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [YouTube `search.list`](https://developers.google.com/youtube/v3/docs/search/list)

## Overview

- Priority: P1
- Status: Implemented; live provider/freeplay validation remains part of Phase 5.
- Effort: 1-2 days

Make freeplay useful without pretending generic API search is YouTube's personalized Up next. Keep explicit YouTube/Spotify playlists unchanged. When no explicit playlist exists, offer an explicit `Find similar` action that searches from the current title/artist and labels results `Similar on YouTube`; keep native Next as the fidelity fallback.

## Implementation Sync — 2026-07-29

- Implemented source-aware queue resolution: explicit playlists win, freeplay falls back to native Next, and Similar runs only from an extension page after an explicit action.
- Similar state is persisted in `chrome.storage.session` with a 24-hour bound and is checked against `tabId`, `videoId`, and `urlRevision`. The late-response guard now validates the same identity.
- The mini-player response-envelope bug and worker-suspension/stale-context review findings were corrected. Real YouTube/Spotify, cold-worker, and autoplay behavior are still pending manual validation.

## Key Insights

- `search.list.relatedToVideoId` was removed in 2023. The official Data API has no current personalized recommendation/Up next endpoint.
- Current freeplay is empty because `getPlaylist()` inspects explicit playlist rows only.
- YouTube's native Next already follows YouTube's own decision even though the extension cannot list upcoming titles.
- Reading `#related` can approximate the signed-in watch page, but selectors/lazy loading are fragile and scraping a YouTube application creates public-release policy risk.

## Requirements

### Functional

- Explicit playlist has highest priority and retains its provider order/label/activation.
- The popup freeplay view initially shows `No queue — YouTube will choose the next video`, native Next, and `Find similar` when a current YouTube title is available.
- `Find similar` is a deliberate click/keyboard action; never fetch when the popup opens, polls media, or changes to Search.
- Build a sanitized query from current title + artist/channel, fetch through Phase 3, exclude the current video, and deduplicate stable IDs.
- Label results `Similar on YouTube` with a short “not personalized Up next” explanation.
- Result selection navigates by `videoId`; it does not add to or rewrite an explicit playlist.

### Non-functional

- Reuse Phase 3's quota/error/cache/ranking pipeline and request limit; no second recommendation-specific API client.
- Background owns source-aware queue state keyed by `{tabId, videoId, urlRevision}`; popup requests/subscribes to it and stale results are rejected.
- Gracefully retain native Next when key/search/quota/network/current-metadata is unavailable.
- No auto-advance logic beyond current provider/native controls.
- Similar is popup-only. The page-injected mini-player keeps explicit playlist/native controls and cannot trigger quota-bearing search.

## Architecture

Queue resolution:

1. `getExplicitPlaylist()` returns items -> `{source: "playlist", label: "Playlist", items}`
2. No explicit playlist and no user request -> `{source: "native-next", label: "No queue", items: []}`
3. User requests similar in the popup -> background derives/searches query -> `{source: "similar", label: "Similar on YouTube", items}`
4. Similar failure/empty -> preserve native-next state and safe error detail

Similar request contract:

- Popup sends only the current `MediaContext` revision; background re-resolves `{tabId, videoId, title, artist, urlRevision}` and rejects stale context before search.
- Background removes common presentation noise (`official video`, bracket suffixes) with conservative pure rules, then searches once.
- Normalize to the shared `QueueItem`, exclude current ID, deduplicate, cap at 10, and mark no item `active`.
- Playback uses `PLAY_YOUTUBE_VIDEO`; native Next remains `nextTrack` on the existing media tab.
- Content scripts provide explicit-playlist snapshots and playback execution only; background is the authoritative queue resolver.

Policy boundary:

- Public MVP: official API Similar + native Next only.
- Out of scope: visible `#related` extraction, MutationObserver adapters, internal YouTube RPCs/endpoints, and claims of personalization.

## Related Code Files

### Modify

- `content/provider-queue-adapter.js` — explicit playlist detection and normalized source-aware response.
- `popup/popup-player-controller.js` — queue priority and explicit Similar action.
- `popup/popup-dom.js` — source labels, explanation, fallback/error states.
- `background.js` — register similar-search action using the existing service.
- `shared/message-contracts.js` — similar request/queue validation.
- Existing mini-player queue view — preserve explicit playlist/native behavior; do not add Similar actions.

### Create

- `shared/similar-query.js` — conservative current-title/artist cleanup and deduplication helpers.
- `background/youtube-similar-service.js` — thin composition over Phase 3 search; no direct fetch.
- `tests/youtube-queue-state.test.js`, `tests/youtube-similar-service.test.js`.

### Delete

- None. Do not add a `#related` DOM adapter or undocumented-network client.

## Implementation Steps

1. Add queue-priority tests: explicit YouTube/Spotify playlist wins; freeplay starts as native-next; Similar appears only after user action; failure falls back without hiding Next.
2. Refactor `getPlaylist()` into explicit provider adapters returning the shared `QueueState`, preserving current playlist order and active item.
3. Add conservative pure query cleanup for current YouTube title/artist. If metadata is missing/too short, disable Similar with an explanation rather than guessing.
4. Add `YOUTUBE_SIMILAR` as a thin call to Phase 3 search/cache/ranking. Exclude current ID, deduplicate IDs, cap 5-10 items, and attach `source: "similar"`.
5. Implement the authoritative background queue resolver keyed by `{tabId, videoId, urlRevision}`. Reset on navigation/media-context change and reject late responses for an old revision.
6. Update the popup queue UI to display `Playlist`, `Similar on YouTube`, or native-next fallback. Render all labels/items with safe DOM APIs.
7. Require a visible popup-only `Find similar` click/Enter action. Guard against double-submit and show that the action consumes a search call unless cached.
8. Route Similar selection by stable `videoId`, focus the target tab, then reset/refresh source state after YouTube navigation.
9. Route mini-player Next/Previous/playlist actions through the background router, while keeping Similar unavailable from content-script UI.
10. Keep existing Next/Previous behavior as the only way to follow YouTube's personalized/native autoplay decision.
11. Add explicit no-key/quota/network/no-results states that leave playlist/native controls usable.
12. Verify freeplay, explicit playlist, Spotify playlist, autoplay on/off, Shorts/unavailable pages, cold-worker wake, and multiple tabs in unpacked Chrome.

## Todo List

- [ ] Add dedicated queue-priority and similar-query fixtures.
- [x] Normalize explicit playlist responses.
- [x] Implement conservative title/artist query cleanup.
- [x] Compose Similar from the existing search service.
- [x] Add background-owned context-keyed queue state and popup-only Find similar.
- [x] Exclude current/duplicate IDs and navigate by stable ID.
- [x] Preserve native Next and explicit playlist fallback paths in implementation.
- [ ] Complete manual freeplay/provider validation.

## Success Criteria

- [ ] Confirm a real playlist is unchanged and never silently replaced by Similar.
- [ ] Confirm freeplay/native Next and explicit Find similar behavior in Chrome.
- [ ] Confirm popup opening/polling produces zero Similar calls in live traffic.
- [x] Content scripts/mini-player cannot invoke privileged Similar/search actions through the reviewed authorization boundary.
- [x] Similar is labeled generic, not personalized `Up next`, in the implemented UI/docs.
- [x] Similar logic excludes current/duplicate IDs and routes by stable ID.
- [ ] Confirm failures leave native provider controls working on supported pages.
- [x] No `#related` scraping or undocumented YouTube endpoint is included.

## Risk Assessment

- High: misleading users about personalization. Enforce source-specific labels in contracts and tests.
- High: DOM scraping can violate policy and break on YouTube SPA changes. Keep it excluded from public implementation.
- Medium: title cleanup may remove meaningful modifiers. Keep transformations conservative and let users use the full Search tab.
- Medium: Similar consumes scarce search calls. Require explicit action and reuse the same TTL/LRU cache.

## Security Considerations

- Treat current-page title/artist as untrusted; bound length, strip control characters, and encode only through URL parameter APIs.
- Do not send API keys or raw storage state to the content script while deriving current metadata.
- Do not call caller-supplied URLs or YouTube internal endpoints.
- Keep provider DOM extraction limited to the already required explicit playlist/media-control surface.

## Next Steps

- Phase 5 verifies the combined queue/source behavior and documents the API/policy distinction.
- A private experimental `#related` adapter requires a separate opt-in plan, fixture maintenance, policy review, and no public-release assumption.
