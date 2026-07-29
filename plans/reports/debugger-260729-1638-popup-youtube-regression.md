# Popup and YouTube Control Regression - Investigation Report

## Executive Summary

- **Issue:** Popup Settings and player controls are non-responsive after the modular refactor; consequently YouTube playback/control requests are never issued from the popup.
- **Impact:** All popup controls, including the Settings button and Search tab, are inert. Content/background media control flow itself is reachable but not invoked by the broken popup.
- **Confirmed root cause:** `popup/popup-player-controller.js:12` binds the play/pause listener to a non-existent `#playPause` element instead of `#playPauseBtn`.
- **Status:** Diagnosed; source unchanged.
- **Minimal fix:** Change the first command-map key from `playPause` to `playPauseBtn` and add a popup-init regression test.

## Evidence and Trace

### 1. Popup failure occurs before every handler is registered

`popup/popup-player-controller.js:12-18` initializes listeners in order:

```js
const commands = { playPause: 'playPause', stopBtn: 'stop', ... };
Object.entries(commands).forEach(([id, command]) => byId(id).addEventListener(...));
// settingsBtn and refresh setup occur only after this loop
```

- `popup.html:19` declares the actual control as `<button ... id="playPauseBtn">`; there is no `id="playPause"` anywhere in the popup.
- Thus the first loop iteration evaluates `byId('playPause').addEventListener(...)`, producing `TypeError: Cannot read properties of null (reading 'addEventListener')`.
- The exception exits `MusicControlPopupPlayer.init()` before it reaches Settings binding at `popup/popup-player-controller.js:17`, initial refresh at line 18, or any remaining control binding.
- `popup.js:1-4` then also never reaches `MusicControlPopupSearch.init()` at line 3. This explains the entire popup being static, including its Settings and Search UI.

### 2. Intended YouTube media message route is intact but unreachable from the popup

```text
popup click
  -> popup/popup-player-controller.js MEDIA_COMMAND (line 13)
  -> background.js listener (lines 43-54)
  -> MusicControlRouter.send (background/media-tab-router.js:31-40)
  -> chrome.tabs.sendMessage(CONTENT_MEDIA_COMMAND)
  -> content-script.js listener (lines 17-20)
  -> MusicControlMedia.command (content/provider-media-controller.js:52-63)
  -> selected <video> element / YouTube next/previous button
```

- Background accepts extension-page `MEDIA_COMMAND` at `background.js:54` and returns asynchronously correctly (`background.js:93-94`).
- The router envelopes the command consistently at `background/media-tab-router.js:35`; the content listener accepts exactly that action at `content-script.js:18-20`.
- The content controller supports `playPause`, `stop`, `skip`, `seekTo`, `setVolume`, `next`, and `previous` at `content/provider-media-controller.js:54-63`.
- Content script ordering is correct: `manifest.json:29-34` loads contracts, media controller, queue adapter, mini-player controller, then dispatcher. The required globals exist before `content-script.js` executes.

### 3. Options page script order/message route is not the observed blocker

- `options.html:90-92` loads contracts, API-key controller, then `options.js`; `options.js` waits for `DOMContentLoaded` before using those globals.
- Settings uses `GET_PUBLIC_STATE` then `UPDATE_PUBLIC_SETTINGS` (`options.js:5-11`), accepted by background at `background.js:47-50`, and stored by `background/storage-broker.js:16-26`.
- No missing script/dependency or click-blocking CSS rule was found in the options page. The reported “Settings UI” failure is explained by the popup Settings button never receiving its listener.
- Hardening opportunity: `options.js:5-6` assumes a successful response (`response.data.settings`). A service-worker/request failure would throw before the Save listener is installed; this is separate from the confirmed popup regression.

## Minimal Repair

### Immediate (P0)

1. In `popup/popup-player-controller.js:12`, rename the mapping key `playPause` to `playPauseBtn`.
2. Reload the unpacked extension and verify: Settings opens, Play/Pause emits `MEDIA_COMMAND`, and a YouTube watch tab receives `CONTENT_MEDIA_COMMAND`.

### Short-term (P1)

1. Add a popup controller initialization test with the real popup IDs; assert every expected element receives a listener. This test would have caught the ID mismatch.
2. Wrap popup/options startup message requests in `try/catch` and display an actionable status instead of allowing unhandled initialization errors to leave a UI inert.

## Verification Performed

- `node --test tests/content-script-mini-player.test.js tests/youtube-credential-store.test.js tests/youtube-search-ranking.test.js`: 6 passed, 0 failed.
- `node --check` across all 23 repository JavaScript files: passed.
- `manifest.json` parsed successfully in Node.
- Static DOM-to-controller comparison found the `playPause` / `playPauseBtn` mismatch above. Existing tests cover ordered content modules but not popup initialization.

## Unresolved Questions

- Live Chrome manual validation is still needed after the one-line correction, especially a paused YouTube video where browser autoplay/user-activation policy may affect `HTMLMediaElement.play()`.
