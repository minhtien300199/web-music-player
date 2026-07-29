# Research: Removable Similar Queue and Popup Seek

---
date: 2026-07-29T17:27:00+07:00
scope: Chrome MV3 vanilla JavaScript extension
status: complete
---

## Summary

Keep both features background/popup scoped. Similar queue state already belongs to the service worker and survives popup destruction through `chrome.storage.session`; extend that state with `dismissedIds`, unique by YouTube `videoId`. Do not persist removal state in the popup or content script.

Replace the popup's click-only seek handler with one focused `popup/progress-seek-controller.js`. It owns pointer capture, preview state, slider ARIA/keyboard behavior, and teardown. Dragging updates only popup UI; `seekTo` is sent once on `pointerup`. Cancellation or popup destruction discards the preview.

## Existing Seams

- `background.js`: owns `similarQueues`, `youtubeSimilarQueue:${tabId}`, TTL/context checks, session persistence, and privileged messages.
- `background/youtube-similar-service.js`: produces Similar items with stable `id`/`videoId`.
- `popup/popup-dom.js`: safely renders queue metadata with DOM APIs.
- `popup/popup-player-controller.js`: fetches media once per second and currently seeks on progress-bar click.
- `content/provider-media-controller.js`: already clamps `seekTo` to `[0, duration]`.
- `tests/*.test.js`: deterministic `node:test` + `vm` fakes; no DOM library or live Chrome required.

The current `popup.css` and controller files are compact, but seeking is independent stateful behavior. A separate seek module is the cleanest way to stay below 200 lines and test without inflating `popup-player-controller.js`.

## 1. Removable Similar Suggestions

### State shape and invariants

Use the current session key and context envelope:

```js
{
  urlRevision,
  videoId,
  expiresAt,
  dismissedIds: ["youtubeVideoId"],
  value: { source: "similar", label, items: [...] }
}
```

Invariants:

1. Queue identity is `videoId`, not array index or title.
2. `value.items` is unique by valid `videoId`.
3. Current video and `dismissedIds` never appear in `value.items`.
4. Dismissals apply only to the same tab + `urlRevision` + current `videoId`.
5. Navigation/tab close/expiry clears queue and dismissals together, matching current lifecycle.
6. Removing the same ID twice is idempotent (`removed: false` on repeat), not an error.
7. A repeated **Find similar** for the same context merges existing `dismissedIds`, so dismissed results do not reappear during that browser session.

### Minimal architecture

Extract the current queue memory/storage logic from `background.js` into `background/similar-queue-store.js` (target 70–100 lines) and import it after `storage-broker.js`.

Recommended API:

```js
MusicControlSimilarQueue.get(context)
MusicControlSimilarQueue.save(context, queue)
MusicControlSimilarQueue.dismiss(context, videoId)
MusicControlSimilarQueue.clear(tabId)
```

- `get`: load memory first, then session; validate TTL and exact context; clear stale state.
- `save`: serialize mutation, load same-context state, preserve `dismissedIds`, deduplicate/filter results, then write memory and session.
- `dismiss`: serialize mutation, validate current state/source, append ID once, filter items, persist, and return `{ queue, removed }`.
- `clear`: delete memory and the tab-scoped session key.
- Use a small promise chain around `save`/`dismiss`. Otherwise a slow Similar request can interleave with dismissal and resurrect an item.

Add `Actions.DISMISS_SIMILAR_ITEM` and reuse `validVideo(message.videoId)`. The background handler must accept extension-page senders only and resolve tab/context itself; never trust a client-supplied `tabId`, URL, index, queue, or source. Return the authoritative filtered queue.

`background/youtube-similar-service.js` should still deduplicate its output by `videoId` before `slice(0, 10)`. Store-level normalization remains the final invariant because cached/API inputs are untrusted.

### Popup DOM

Change `renderQueue(container, queue, onPlay, onDismiss)`:

- For normal playlists, preserve current behavior and show no removal control.
- For `queue.source === "similar"`, render a non-interactive row wrapper containing sibling **Play** and **Remove** buttons. Do not nest a remove button inside the current play `<button>`.
- Remove label: `Remove ${item.title} from suggestions`.
- Disable only the selected remove button during the request.
- On success, re-render from the queue returned by background; do not splice popup-local state first.
- Empty Similar copy: `No suggestions left.` Playlist/native empty copy remains source-specific.

This needs small selector changes in `popup.css`: row layout, a flexing play button, and a minimum 32–36 px remove target with existing focus-visible treatment.

### Queue tests

Add `tests/similar-queue-store.test.js`:

1. `save` removes duplicate/current/invalid IDs.
2. `dismiss` persists filtered items and `dismissedIds` to session.
3. Reload module with the same fake session store; dismissed item remains absent.
4. Re-saving Similar results for the same context does not resurrect dismissed IDs.
5. New URL/video context does not inherit dismissals.
6. Repeated dismissal is idempotent.
7. Concurrent `save` and `dismiss` preserve the dismissal.
8. Expiry and `clear(tabId)` remove memory/session state.

Add `tests/popup-dom.test.js`:

- Similar rows expose separate play/remove buttons and correct accessible labels.
- Playlist rows do not expose remove.
- Remove activation calls only `onDismiss`; play activation calls only `onPlay`.
- Provider text remains assigned through `textContent`.

## 2. Draggable Popup Progress Seek

### Markup and module

Change `#progressBar` from a button to a focusable slider element:

```html
<div id="progressBar" class="progress-bar"
  role="slider" tabindex="0" aria-label="Seek playback"
  aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"
  aria-valuetext="0:00 of 0:00">
  <span id="progress"></span>
</div>
```

Create `popup/progress-seek-controller.js` (target 90–130 lines), loaded before `popup-player-controller.js`. Suggested API:

```js
const seek = MusicControlProgressSeek.create({
  track,
  fill,
  currentTimeLabel,
  commit: (time) => request(MEDIA_COMMAND, {
    command: "seekTo",
    data: { time }
  })
});

seek.updateMedia(info);
seek.dispose();
```

Internal state: `duration`, `mediaTime`, `previewTime`, `pointerId`, `disposed`, and optionally `commitVersion`.

### Pointer preview/commit semantics

1. `pointerdown`: accept primary pointer only and finite duration `> 0`; focus track, `preventDefault`, call `setPointerCapture(pointerId)`, enter preview, calculate clamped time.
2. `pointermove`: only active pointer; update fill, visible current-time label, `aria-valuenow`, and `aria-valuetext`. Do not send a media command.
3. `pointerup`: calculate final time, clear active pointer before releasing capture, render optimistic final value, and invoke exactly one `commit(finalTime)`.
4. `pointercancel`/unexpected `lostpointercapture`: cancel preview and restore latest polled media time; do not seek.
5. Clamp using `rect.width > 0` and `(clientX - rect.left) / rect.width`.
6. While previewing, `updateMedia` may refresh duration but must not overwrite the previewed value.
7. After commit settles, `popup-player-controller.js` should call `refreshMedia()` once. Use a version/token if overlapping commits could let an older completion overwrite a newer preview.

CSS: add `touch-action:none`, a larger transparent hit area (about 20–24 px high while the visible rail stays 8 px), and `cursor:grab`/`grabbing`. Do not add animation; reduced-motion rule already exists.

### Keyboard behavior

Implement the WAI slider keys:

- Left/Down: `-5s`
- Right/Up: `+5s`
- Page Down/Page Up: `-30s`/`+30s` (optional but useful)
- Home: `0`
- End: `duration`

Prevent default only for handled keys. Each keyboard action can commit immediately; this is the simplest predictable behavior and native key repeat remains useful. Update `aria-valuemax`, `aria-valuenow`, and human-readable `aria-valuetext` (`"1:23 of 4:05"`). Set `aria-disabled="true"` and ignore pointer/keyboard input when media/duration is unavailable.

### Popup lifecycle

Chrome action popups automatically close when focus moves outside them. A close during drag may prevent `pointerup`; therefore preview must be side-effect free. On `pagehide`:

- clear the one-second refresh interval;
- call `seek.dispose()` to remove listeners/release capture when possible;
- cancel preview without committing.

Do not attempt an async seek from `unload`/`pagehide`; delivery is not reliable. Normal pointer release commits before closure. Reopening the popup reads authoritative media state again.

### Seek tests

Add `tests/progress-seek-controller.test.js` with a small fake element:

1. Pointer down/move updates preview and ARIA but sends no commit.
2. Pointer up outside bounds commits once at 0/duration due to pointer capture and clamping.
3. Unrelated pointer IDs are ignored.
4. Cancel/lost capture restores polled value without commit.
5. Poll updates during drag do not overwrite preview.
6. Arrow/Page/Home/End keys prevent default, clamp, and commit expected seconds.
7. Missing, zero, infinite, or `NaN` duration disables seeking.
8. `dispose` removes listeners/cancels state; later events do nothing.

Extend `tests/popup-player-controller.test.js` to verify seek module creation, `updateMedia(info)`, and pagehide disposal/interval cleanup. Manual Chrome checks: mouse/touch/stylus, release outside rail, rapid reopen, close mid-drag, no-media/live-stream duration, and keyboard focus ring.

## File Change Matrix

| File | Change |
| --- | --- |
| `shared/message-contracts.js` | Add `DISMISS_SIMILAR_ITEM`; reuse video-ID validation. |
| `background/similar-queue-store.js` | New focused session store with context validation, dismissals, dedupe, serialized writes. |
| `background.js` | Import/use store for get/save/clear/dismiss; remove direct map/key logic. |
| `background/youtube-similar-service.js` | Stable dedupe before queue limit. |
| `popup/popup-dom.js` | Separate play/remove buttons for Similar only. |
| `popup/popup-player-controller.js` | Wire dismissal and seek module; own interval/pagehide cleanup. |
| `popup/progress-seek-controller.js` | New pointer/keyboard/ARIA preview-commit controller. |
| `popup.html` | Slider markup and seek script order. |
| `popup.css` | Queue action layout and seek hit-area/drag states. |
| `tests/*.test.js` | Store, DOM, seek, and lifecycle regressions above. |

All proposed JavaScript files can remain below 200 lines. No framework, dependency, database, sync storage, undo stack, drag tooltip, or cross-video dismissal history is needed.

## Assumptions / Open UX Choices

- Assumption: “session persistence” means popup reopen/service-worker suspension and repeated Similar fetches for the same video, not browser restart.
- Assumption: removal applies only to app-generated Similar suggestions, never provider playlists.
- Assumption: dismissal resets on tab navigation/current-video change, consistent with existing queue invalidation.
- Assumption: drag preview changes fill/current-time text but not actual playback until release.
- Open choice: an Undo affordance is not included (YAGNI). Add only if product explicitly requires recovery.
- Open choice: keyboard step is recommended at 5 seconds and Page step at 30 seconds; product may choose 1/10 seconds.

## References

- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — `storage.session` survives service-worker runs but clears on browser restart/extension reload and is trusted-context-only by default.
- [Chrome action popup lifecycle](https://developer.chrome.com/docs/extensions/develop/ui/add-popup) — popup closes when focus moves outside; it cannot be forced to remain open.
- [MDN `setPointerCapture`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) — keeps pointer events targeted to the slider through release outside its bounds.
- [WAI-ARIA slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) — keyboard interactions and required slider value properties.

## Unresolved Questions

- Should dismissed suggestions remain hidden if the same video is revisited later in the same tab after navigating away? Recommendation: no; current URL-revision invalidation is clearer and simpler.

**Status:** DONE  
**Summary:** Concrete background-owned dismissal/dedupe design and testable popup pointer/keyboard seek architecture documented.  
**Concerns/Blockers:** Only the explicitly listed UX assumptions need product confirmation; none block a minimal implementation.
