# Code Review: YouTube Search Implementation

## Scope

Reviewed the current uncommitted Chrome MV3 implementation against `plans/260729-1512-youtube-search-and-recommendations/`. Static review plus the existing Node fixtures; no files were edited outside this report.

## Findings

### [High] Mini-player reads the background response envelope as media data

- **Location:** `content/mini-player-controller.js:32`, `content/mini-player-controller.js:39-47`
- **Evidence:** `media()` sends `MEDIA_COMMAND` to `background.js`. The dispatcher wraps every routed content response in `success(...)` at `background.js:51`, so the mini-player receives `{ ok: true, data: { found, ... } }` (or `{ ok: true, data: QueueState }`). The mini-player checks `info?.found`, `info.duration`, and `queue?.items` directly instead of `info.data?.found`, `info.data?.duration`, and `queue.data?.items`.
- **Impact / reproduction:** Enable Pin player on a real media tab. The controls may send their side effects, but the pinned UI always renders “No media detected”, the progress seek guard never passes, and the expanded playlist always renders empty. This breaks the pinned-player behavior in scope and hides freeplay/playlist state from it.
- **Fix:** Unwrap and validate the standard response envelope once inside the mini-player request helper (return `response.data` only when `response.ok`), then use that normalized value for refresh, seek, and queue rendering. Add a regression fixture that returns `{ok: true, data: {found: true}}` and verifies title/progress/queue rendering.
- **Verdict:** Accept — direct deterministic runtime mismatch.

### [High] Similar-result queue disappears whenever the MV3 service worker is suspended

- **Location:** `background.js:14`, `background.js:30-31`, `background.js:78-80`
- **Evidence:** `similarQueues` is an in-memory `Map`. MV3 service-worker globals are discarded on suspension. The map is the only place a completed Similar queue is retained; the session cache stores raw search results but has no context-keyed queue record. On the next popup open after worker wake, `queueForCurrentTab()` returns `native-next` unless the current page has an explicit playlist.
- **Impact / reproduction:** Select **Find similar**, close the popup, wait for the service worker to stop, then reopen the popup on the same unchanged YouTube video. The recommendations vanish even though the tab/context and cached API response remain valid. This violates the planned background-owned, cold-worker-safe queue state and makes freeplay appear unreliable.
- **Fix:** Persist a bounded, expiring `SimilarQueueState` in `chrome.storage.session`, keyed and validated by `{tabId, videoId, urlRevision}`. On read and before returning the async Similar response, re-resolve the tab/context and reject/delete stale state. Keep the in-memory map only as an optional fast path.
- **Verdict:** Accept — normal MV3 lifecycle, not an edge condition.

### [Medium] A slow Similar request can render recommendations for a video the user already left

- **Location:** `background.js:78-80`, `popup/popup-player-controller.js:29`
- **Evidence:** The handler resolves one `context`, awaits the network-backed `MusicControlSimilar.similar(context)`, and immediately returns that result. It never checks that `tabId`, `videoId`, or `urlRevision` still match after the await. The popup renders any successful response directly. `queueForCurrentTab()` has a later revision comparison, but that does not protect the already-returned response.
- **Impact / reproduction:** Click **Find similar**, navigate the same YouTube tab to another video while the request is in flight, and let the original request resolve. The popup displays candidates based on the prior video; a click navigates to an unrelated selected result. It also contravenes the plan’s stale-response requirement.
- **Fix:** Include/retain a context revision on the request, re-resolve after the search completes, and return a safe stale-context failure when it differs. The popup should preserve its native-next view rather than render stale items.
- **Verdict:** Accept — asynchronous tab navigation is ordinary on YouTube.

## Review Notes

- No Critical finding found in the reviewed message authorization/key-response paths: key actions are restricted to extension-origin senders, responses expose only credential status, requests use a header rather than a query parameter, and text rendering uses DOM/textContent APIs.
- The existing mini-player fixture only returns `{ok: true, data: {found: false}}` and never exercises the positive data path, so it cannot catch the first issue.

## Unresolved Questions

- Should the “Similar” queue survive an extension reload, or only normal service-worker suspension? The recommended `storage.session` design survives worker suspension but intentionally resets on browser/extension restart.

## Re-review Addendum — 2026-07-29

All three reported findings are resolved by the reviewed patch.

- **Resolved — mini-player envelope mismatch:** `content/mini-player-controller.js:15` now unwraps a successful `{ok, data}` response before all callers consume it. The existing `info?.found` and `queue?.items` usages at lines 32 and 39-46 therefore receive the expected DTOs.
- **Resolved — worker-suspension queue loss:** `background.js:15`, `31-35`, and `86-89` add a bounded 24-hour `chrome.storage.session` copy of the context-specific Similar queue, use it after an in-memory-map loss, and remove it on tab navigation/removal at lines 40-41.
- **Resolved — stale Similar response:** `background.js:81-90` re-resolves after the awaited request and returns `STALE_MEDIA_CONTEXT` unless the target tab and URL revision are unchanged; stale results are not persisted or returned to the popup.

No unresolved Critical, High, or Medium item remains from this review set.
