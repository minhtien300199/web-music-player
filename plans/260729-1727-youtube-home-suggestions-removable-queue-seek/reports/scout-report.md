---
title: "Scout Report: YouTube Home Suggestions, Removable Queue, and Seek"
date: "2026-07-29T17:27:00+07:00"
status: complete
scope: "Read-only codebase map"
---

# Scout Report

## Summary

The current MV3 extension already has reusable media routing, normalized queue items, safe popup DOM rendering, stable YouTube `videoId` playback, session-backed Similar state, and click-to-seek in both popup and mini-player. It does **not** extract YouTube Home/watch-page suggestions, expose a queue-item removal action, persist per-item dismissals, or test queue state/rendering/seek behavior. Queue work should extend the existing contracts and background ownership rather than add another independent popup-only array.

The worktree is already materially dirty from the unfinished `260729-1512-youtube-search-and-recommendations` implementation. Preserve those modified/untracked files; the new plan overlaps the same queue, popup, background, content, tests, and docs surfaces.

## Runtime Flow and Dependencies

1. `manifest.json:22-36` loads `background.js` as the service worker and content modules in this order: contracts -> media controller -> queue adapter -> mini-player -> content entry.
2. `content/provider-media-controller.js:22-41` reports media metadata; `content-script.js:34-37` sends the initial context and later media polling can notify changes.
3. `background/media-tab-router.js:12-29` owns the last `MediaContext`; `send()` at `31-40` forwards media/queue commands to the resolved tab.
4. `background.js:25-35` resolves the queue: explicit provider playlist first, then valid persisted Similar queue, then native-next.
5. `popup/popup-player-controller.js:24-32` polls media, requests `GET_QUEUE`, renders it, and routes item playback.
6. `popup/popup-dom.js:5-12` safely creates queue rows with `textContent`; `content/mini-player-controller.js:43-47` independently renders the page mini-player playlist.
7. Media commands travel popup/mini-player -> `MEDIA_COMMAND` -> `background.js:53` -> router -> `content-script.js:16-19` -> provider controller/queue adapter.

## Exact File and Function Map

### YouTube Similar and prospective Home suggestions

- `background/youtube-similar-service.js` (19 lines)
  - `clean()` at line 4 strips brackets/parentheses and “official video” noise.
  - `similar(mediaContext)` at lines 6-17 reuses `MusicControlYouTubeSearch.search()`, excludes the current ID, caps at 10, and creates normalized `{id, source, title, artist, thumbnailUrl, active, playTarget}` items.
  - Reusable normalization shape; no YouTube Home DOM or recommendation endpoint support exists.
- `background/youtube-search-service.js` (52 lines)
  - `search()` at lines 13-41 supplies API-backed generic results through credential, cache, safe-error, and ranking dependencies.
  - Useful only if “Home suggestions” means generic API search; it cannot reproduce personalized YouTube Home.
- `background/youtube-search-cache.js` (23 lines)
  - `get()`, `set()`, `clear()` use `chrome.storage.session`, 24-hour TTL, 30-entry cap.
- `background.js` (94 lines)
  - `similarQueues`/`similarQueueKey()` at lines 15-16 store per-tab Similar state.
  - `queueForCurrentTab()` at lines 25-35 applies explicit-playlist priority and validates `{urlRevision, videoId, expiresAt}`.
  - `YOUTUBE_SIMILAR` dispatch at lines 80-89 rejects stale late responses and persists the queue.
  - `tabs.onUpdated/onRemoved` at lines 39-40 clear both memory and session state on navigation/tab close.
  - Gap: invalid/expired state removes session storage at line 33 but leaves the stale entry in `similarQueues`; new mutation helpers should update/delete both stores consistently.
- `content/provider-queue-adapter.js` (31 lines)
  - `youtubeItems()` at lines 7-11 extracts only explicit playlist panels.
  - `getQueue()` at lines 15-18 returns `playlist` or `native-next`; there is no Home feed (`ytd-rich-item-renderer`) or watch-page related (`#related`) extraction.
  - `play(target)` at lines 19-29 uses stable YouTube `videoId` anchor matching and provider-index fallback.
- `shared/message-contracts.js` (39 lines)
  - `Actions` at lines 4-24 has `YOUTUBE_SIMILAR`, `PLAY_YOUTUBE_VIDEO`, and media actions, but `GET_QUEUE` is still an uncontracted string and there is no remove/dismiss action.
  - `validVideo()` at lines 26-28 is reusable for item removal/playback identifiers.

### Queue rendering, state, playback, and removal insertion points

- `popup/popup-player-controller.js` (34 lines)
  - Module state `queue`/`currentProvider` at lines 8-9 is ephemeral.
  - `refresh()` line 30 requests `GET_QUEUE`, selects labels/helper text, controls Find Similar visibility, and calls `renderQueue`.
  - `playTarget()` line 31 routes `youtube-video` through background navigation and provider indices through media commands.
  - `findSimilar()` line 32 directly re-renders the returned queue.
  - Best controller insertion point for popup removal requests, but the dense one-line functions should be split before adding behavior.
- `popup/popup-dom.js` (23 lines)
  - `renderQueue(container, queue, onPlay)` lines 5-12 currently makes the entire row one play button.
  - Best reusable safe renderer, but removable rows require a row/container plus separate Play and Remove buttons; avoid nested buttons.
  - `renderResults()` lines 13-20 is unrelated Search rendering but demonstrates disabled-during-async behavior.
- `popup.html:20` contains heading, Find Similar, helper, and `#playlist`; removal status can use the existing live/footer status only if announcements remain unambiguous.
- `popup.css` (1 physical line) defines `.playlist-item`, active/hover state, and queue layout. It is under the 200-line physical limit but is minified and difficult to patch safely; queue-action styles are an obvious extraction/formatting pressure point.
- `content/mini-player-controller.js` (59 lines)
  - `refreshPlaylist()` lines 43-47 requests only the content tab’s explicit playlist via `media('getQueue')`, not background `GET_QUEUE`; therefore it never displays persisted Similar.
  - If “removable queue” is popup-only, leave this unchanged. If it must appear in the mini-player, the command path/authorization and renderer must be redesigned to use authoritative background queue state.
- `content-script.js` (38 lines)
  - `respond()` lines 16-19 dispatches `getQueue`, `playQueueItem`, then general media commands.
- `background/media-tab-router.js` (55 lines)
  - `resolve()` lines 18-29 chooses remembered, audible, then active tab.
  - `send()` lines 31-40 forwards commands.
  - `playVideo()` lines 42-51 reuses/focuses a YouTube tab or creates one and updates context.

No queue removal code exists anywhere. The clean ownership model is a background action such as `REMOVE_QUEUE_ITEM` validated by queue context plus stable item ID/video ID, mutating the authoritative per-tab stored queue. Explicit provider playlists are page-owned and should not be presented as persistently removable unless “dismiss from extension view only” is explicitly defined.

### Popup progress seek and media commands

- `popup.html:18` implements the progress track as `button#progressBar` with `span#progress`.
- `popup/popup-player-controller.js:18` fetches fresh media info, converts click X-position to a ratio, and sends `seekTo`.
- `popup/popup-player-controller.js:24-29` polls once per second and updates elapsed/duration/progress width.
- `content/mini-player-controller.js:26,32,37-41` duplicates click-to-seek and polling for the in-page mini-player.
- `content/provider-media-controller.js`
  - `bounded()` line 51 clamps values.
  - `command()` lines 52-64 supports `getMediaInfo`, `next`, `previous`, `playPause`, `stop`, relative `skip`, absolute `seekTo`, and `setVolume`.
- Seek edge cases currently uncovered:
  - Popup seeks when `found` is true even if duration is zero/non-finite; mini-player requires a truthy duration.
  - Keyboard activation of the progress `button` has no meaningful X coordinate and can jump to the beginning.
  - Neither handler guards a zero-width rectangle.
  - Rendered percent is not clamped to `[0, 100]`.
  - Media controller coerces malformed/NaN time to zero rather than rejecting invalid input.

## Persistence and State Reuse

- `chrome.storage.session`
  - `youtubeSimilarQueue:<tabId>`: background Similar queue wrapper, 24-hour expiry (`background.js:16,31-33,86-87`).
  - `youtubeSearchCache`: search results (`background/youtube-search-cache.js:4-21`).
  - `youtubePendingSearch` and `youtubeSelectionHistory`: cleared by background key/search-data actions (`background.js:64-78`).
- `chrome.storage.local`
  - Public settings and pinned mini-player state via `background/storage-broker.js:4-32`.
- `background/storage-broker.js` (49 lines) is reusable for public settings/broadcasts, but queue mutation should remain a dedicated queue-state service rather than expanding the public-settings broker.
- Existing Similar state survives service-worker suspension because of session storage, but not browser/extension session loss by design. A removable queue needs an explicit decision: removal lasts for the current queue/tab revision, the Chrome session, or durable local history.

## Existing Tests and Missing Coverage

Current run: `node --test tests/*.test.js` -> **10 passed, 0 failed**.

- `tests/content-script-mini-player.test.js` (57 lines): load order, brokered mini-player creation, and source settings only. One assertion checks empty queue source; no playlist extraction/playback/rendering/seek.
- `tests/popup-player-controller.test.js` (37 lines): only verifies initialization against popup IDs and tolerance of one missing optional control; DOM callbacks and messages are inert.
- `tests/youtube-search-ranking.test.js` (10 lines): two ranking checks only.
- `tests/youtube-credential-store.test.js` (12 lines) and `tests/message-sender-policy.test.js`: unrelated security regressions.

Missing tests required by this feature:

1. YouTube Home suggestion fixture extraction: stable IDs, order, duplicates, Shorts/non-watch URLs, missing title/channel/thumbnail, lazy/changed DOM, bounded item count.
2. Queue priority and state: explicit playlist > suggestions/Similar > native-next; tab/video/URL isolation; expiry; worker restart recovery; navigation and tab-close cleanup.
3. Removal: first/middle/last item, unknown/malformed ID, current item, repeated removal, empty-state fallback, concurrent remove/refresh, persistence and stale-context rejection.
4. Popup DOM: separate play/remove controls, safe text rendering, accessible labels/focus, event propagation, queue rerender and status announcement.
5. Playback: exact `videoId`, provider-index fingerprint validation, correct tab reuse/create behavior.
6. Seek: left/middle/right click, clamping, zero width, missing/non-finite duration, keyboard behavior, and content command validation.
7. Browser/manual: actual YouTube Home selectors/lazy loading, SPA navigation, popup close/reopen, MV3 worker restart, multiple tabs, real progress seek.

## Overlap With Unfinished Plan `260729-1512`

- The old plan remains `status: in_progress`; Phase 5/manual Chrome/API release gates are incomplete.
- Direct reuse/overlap:
  - Phase 1 contracts/router/provider adapters/popup extraction are the foundation for all new work.
  - Phase 4 implemented explicit-playlist priority, session-backed Similar, stable-ID playback, and native fallback in the exact files this plan must modify.
  - Phase 5 already requires queue-priority, routing, popup, worker-restart, and manual browser tests; those should be completed/extended, not duplicated.
- Still-open old-plan items that block confident extension:
  - Dedicated queue-priority and Similar-query fixtures (`phase-04:122`).
  - Live explicit playlist/freeplay/native-control/provider validation (`phase-04:129,133-139`).
  - Cache/service/router fixtures and live multi-tab routing (`phase-03:124,131-141`).
  - Package audit and unpacked Chrome/restart/multi-tab matrix (`phase-05:118-129`).
- Semantic conflict:
  - Old plan explicitly excludes `#related`/DOM recommendation scraping and claims no personalized Up Next (`plan.md:23,36`; `phase-04:81-103,140`).
  - Extracting visible YouTube **Home** recommendations is a new page-DOM adapter with selector fragility and likely signed-in personalization semantics. The new plan must explicitly supersede/narrow those non-goals, label the source truthfully, and update policy/risk documentation. It should not silently call Home items “Similar” or “Up next.”
- The old plan’s original line references to monolithic `popup.js`/`content-script.js` are stale after extraction; use the current module/line map above.

## Line-Count Constraints

All relevant JavaScript modules are currently below the repository’s 200-line ceiling: `background.js` 94; router 55; Similar 19; search 52; cache 23; content entry 38; media controller 66; queue adapter 31; mini-player 59; popup player 34; popup DOM 23; contracts 39. `popup.css` and `popup/search.css` are each one minified physical line. Prefer focused additions: a Home suggestion adapter, a background queue-state service, and focused tests rather than growing `background.js` or the dense popup controller.

## Recommended Boundaries

- Keep provider DOM extraction in `content/`; do not fetch or persist there.
- Make one background queue-state service authoritative for generated/suggested queues, including remove and expiry operations.
- Add all queue actions to `shared/message-contracts.js`; stop using raw `'GET_QUEUE'`.
- Keep stable `videoId` as the removal/playback identity; include tab/video/URL revision in mutation requests or resolve it server-side and reject stale operations.
- Reuse `popup/popup-dom.js` for safe row construction, but pass separate play/remove callbacks.
- Extract one shared pure seek-ratio/clamp helper if popup and mini-player must retain identical behavior; otherwise tests will need to cover two duplicated implementations.

## Unresolved Questions

- Does “YouTube Home suggestions” mean DOM-visible personalized Home feed, watch-page related videos, or non-personalized API search results?
- Are explicit provider playlist rows removable, or only extension-owned suggestions/Similar rows?
- Should removal survive popup reopen, worker suspension, browser restart, or only the current tab/video revision?
- Is removable authoritative queue required in the mini-player, or popup only?
- What keyboard seek behavior is expected: Home/End, arrow increments, or only pointer seeking with a non-button semantic?

**Status:** DONE
**Summary:** Mapped all current recommendation, queue, playback, seek, persistence, test, and documentation surfaces; identified reusable modules, missing coverage, state hazards, and direct conflict/overlap with the unfinished 15:12 plan.
**Concerns/Blockers:** Product semantics and persistence scope for Home suggestions/removal remain undefined; old plan’s manual release gates and queue fixtures are still incomplete.
