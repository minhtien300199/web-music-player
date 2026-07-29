# Scout Report: YouTube Search, Local Key, Recommendations

---
date: 2026-07-29
scope: read-only codebase scout
branch: main
baseline: 3bfa457
---

## Summary

- Feasible without backend for personal use: Options captures a user-owned YouTube API key, background owns API calls, popup gets normalized search results.
- Safest simple key mode: session-only via `chrome.storage.session`; it clears on browser restart and is not exposed to content scripts by default.
- Persistent `chrome.storage.local` is convenient but not encrypted and content scripts can currently access that storage area. Do not claim it is secret storage.
- Freeplay is empty because YouTube extraction only queries playlist-panel renderers. Add a YouTube queue adapter that falls back to watch-page recommendations and identifies items by `videoId`, not unstable DOM index.
- Modularization is required: `content-script.js` is 877 lines, `popup.js` 267, and `popup.css` 368.

## Current Data Flows

### Popup and media control

- `popup.html:16-68` has one player/playlist view; no tabs or search UI.
- `popup.js:38-60` selects cached media tab, then audible tab, then active tab.
- `popup.js:63-99` sends commands directly with `chrome.tabs.sendMessage`; it does not route normal controls through background.
- `popup.js:110-132` refreshes media info; `popup.js:134-156` renders playlist.
- `popup.js:262-266` initializes media/playlist and polls media every second.

### Background

- `background.js:23-47` independently tracks/falls back to an audible media tab.
- `background.js:49-62` forwards messages to that tab.
- `background.js:64-84` only handles active-media lookup, media notification, and remote mini-player commands.
- Search/key actions fit here because the service worker can keep the raw key out of popup/content-script responses.

### Settings and storage

- `options.html:15-70` contains source and mini-player settings only.
- `options.js:20-49` reads/writes `musicControlSettings` directly in `chrome.storage.local`.
- `content-script.js:14-23` also reads those settings directly.
- `content-script.js:304-350` reads/writes/listens for global mini-player state in the same storage area.
- `manifest.json:6-7` already grants `storage` and HTTP(S) host access through `<all_urls>`; no new Chrome permission is required for a Google API fetch, though an explicit Google API host is clearer if permissions are later narrowed.

### Playlist/freeplay

- `content-script.js:218-258` implements `getPlaylist()`.
- YouTube only queries `ytd-playlist-panel-video-renderer` and `#playlist-items ytd-playlist-video-renderer` at `content-script.js:221-236`.
- Spotify uses track-list rows at `content-script.js:239-255`.
- `content-script.js:260-282` plays by the current DOM index.
- `content-script.js:829-875` exposes `getPlaylist` and `playFromPlaylist` through the content-script message switch.
- Therefore a normal `/watch?v=...` page without an explicit playlist returns `[]`; YouTube recommendations are not inspected.

## Reusable Selectors and Contracts

- Current YouTube media title/channel: `h1.ytd-video-primary-info-renderer, h1.title` and `#channel-name a, .ytd-channel-name a` (`content-script.js:80-85`).
- Current playlist item/title/channel/active selectors are at `content-script.js:222-226`.
- Current playlist click anchors are at `content-script.js:261-265`.
- Proposed freeplay fallback selectors: `#related ytd-compact-video-renderer`; title `#video-title`; channel `#channel-name`; URL `a#thumbnail[href*="/watch"], a#video-title[href*="/watch"]`.
- Normalize every row to `{ videoId, title, artist, url, active, queueType }`, where `queueType` is `playlist` or `recommendation`.
- Replace index-only playback with `playYouTubeQueueItem(videoId)`: re-query and match the anchor `v` parameter before click/navigation.
- Prepend the current video from `getMediaInfo()`/`location.href` when showing recommendations so the user sees the active track followed by upcoming choices.

## Proposed Feature Flow

1. Options sends `setYouTubeApiKey`, `testYouTubeApiKey`, `clearYouTubeApiKey` runtime messages; it never reads the stored key back.
2. Background stores the key, returns only `{ configured: boolean }`, and performs YouTube search with bounded results, submit-only requests, cache, timeout, and normalized errors.
3. Popup adds `Player` and `Search` tabs. Search sends `searchYouTube(query)` to background and renders results using DOM nodes plus `textContent`.
4. Selecting a result reuses a suitable YouTube tab with `chrome.tabs.update`, otherwise creates one; URL must be built from a validated video ID.
5. Content script returns explicit playlist items when present; otherwise returns bounded related recommendations.
6. Popup and mini-player use a shared queue contract and refresh after navigation/Next.

## Secret Storage Decision

- Recommended default: keep the key in `chrome.storage.session`; require re-entry after browser restart. Set session access to trusted extension contexts only.
- Optional convenience mode: `chrome.storage.local`, clearly labeled “Remember on this device — not encrypted”; never sync, log, return, or interpolate the key.
- A user-selected filesystem path is not a good product path: extensions cannot silently read arbitrary files, retained file handles add permission/UX complexity, and plaintext files are not safer.
- A local ignored config file can support developer-only unpacked installs, but it is still plaintext and must never be required for normal users.
- A truly persistent secret needs a backend or OS-keychain/native-messaging helper. That is outside this extension’s current KISS/YAGNI scope.
- Ask users to restrict their Google key to YouTube Data API v3 and set quota limits; client-side keys remain extractable by a determined local user.

## Files to Modify

- `manifest.json`: load split content scripts/background modules if chosen; document/narrow Google API host.
- `background.js`: route key/search/open-video messages; retain media-tab behavior.
- `popup.html`, `popup.css`, `popup.js`: tabs, search state, result selection, shared queue rendering.
- `options.html`, `options.css`, `options.js`: masked key input, session/remember choice, test/clear status.
- `content-script.js`: delegate YouTube queue extraction/playback and return normalized queue contract.
- `README.md`, `docs/project-changelog.md`: setup, quota/security caveats, freeplay behavior.

## Files to Create / Modular Boundaries

- `youtube-search-service.js` (<180): API URL, fetch, validation, normalization, cache; imported by service worker.
- `youtube-queue-adapter.js` (<180): playlist/recommendation extraction and videoId-based activation; loaded before `content-script.js`.
- `popup-search.js` (<180): Search tab state/events/rendering.
- `popup-player.js` (<200): move current player polling/control/queue UI out of `popup.js`.
- `options-api-key.js` (<150): key setup/test/clear; keep source settings in `options.js`.
- Split CSS into `popup-player.css`, `popup-search.css`, and shared `popup.css`, each under 200 lines.
- Tests: `youtube-queue-adapter.test.js`, `youtube-search-service.test.js`, `popup-search.test.js`, plus keep existing mini-player regression file.

## Test Harness and Validation Gaps

- Only `tests/content-script-mini-player.test.js` exists; it executes `content-script.js` in a Node VM with a minimal fake DOM (`:54-129`).
- Current tests cover pin lifecycle and Next/Previous only (`:134-210`); no popup, options, background, fetch, real YouTube DOM, navigation, or CSP coverage.
- Baseline passes 5/5 via `node --test tests/content-script-mini-player.test.js`.
- No `package.json`, lint script, bundler, DOM test library, browser E2E, or CI config exists.
- Add pure adapter/service unit tests and a manual unpacked-extension Chrome checklist; a real YouTube fixture/E2E is needed before claiming selectors stable.

## Risks

- Existing popup and mini-player interpolate scraped titles into `innerHTML` (`popup.js:137-145`, `content-script.js:683-690`); API/DOM text must use `textContent` to avoid markup injection.
- YouTube watch-next DOM is lazy-loaded and changes frequently; cap/re-query results and degrade to “No recommendations available.”
- Search quota is project-wide; debounce alone is insufficient if searching per keystroke. Submit-only plus cache/rate limiting is safer.
- Multiple YouTube tabs require an explicit reuse policy; current “audible first” selection may navigate the wrong tab.
- Region/age/private/deleted video restrictions can make a valid search result unplayable.
- Root `plan.md` describes popup → background → content flow (`:153-163`), but current popup bypasses background; new plan/docs should reflect actual split routing.
- Working tree was clean before report generation; `plans/` is currently untracked plan/report work.

## Unresolved Questions

- Should the default key mode be session-only, or is the user accepting plaintext local persistence for convenience?
- On search result selection, reuse active YouTube tab, reuse media tab, or always create a new tab?
- In freeplay, show only YouTube’s visible related list or also include search API suggestions?
- Should explicit playlist and recommendations be separate labeled sections or one normalized queue?
