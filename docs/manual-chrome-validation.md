# Manual Chrome validation

## Purpose

This is a reproducible manual validation matrix for an unpacked Music Control extension. It is a checklist, not a record that live API, DOM import or Google Cloud restrictions passed. Chrome automation bootstrap was unavailable in the latest validation run, so every live row below remains pending.

## Safety before testing

1. Use a disposable, user-owned Google Cloud project/key with YouTube Data API v3 enabled and API restrictions configured.
2. Do not paste the key into this document, console logs, screenshots, recordings, issue trackers or test fixtures.
3. Close/reload the extension and rotate the key if it was accidentally exposed.
4. Record Chrome version, account state and expected/actual result, but never credential values.

## Setup

1. Open `chrome://extensions/`, enable Developer mode, and **Load unpacked** the project directory.
2. Open extension Settings. Verify the API-key field is masked and the initial status is “Not configured”.
3. Load a normal web page, YouTube watch page, Spotify Web and SoundCloud as applicable. Do not expect controls on `chrome://` or other restricted Chrome pages.

## Matrix

| Area | Scenario | Expected result | Result |
| --- | --- | --- | --- |
| Session key | Save key with “Use for this session”; search | Search works; UI does not reveal key | Pending |
| Session key | Restart Chrome or reload extension | Key status becomes not configured; search asks for setup | Pending |
| Local key | Save with “Remember on this device” | UI explicitly says not encrypted; current profile can search after restart | Pending |
| Forget | Click “Forget key & search data” | Key, cached results and pending query clear | Pending |
| Search traffic | Open popup, switch to Search, type only | No search request occurs | Pending |
| Search traffic | Submit once, submit same query again | First cache miss calls API; same normalized query may use current-session cache | Pending |
| Search errors | Missing key, invalid/restricted key, network/quota error | Clear safe error; no credential value in UI | Pending |
| Search playback | Click a result | Exact video opens in reusable YouTube tab or a new YouTube tab | Pending |
| Explicit playlist | YouTube/Spotify page with visible playlist | Playlist renders and takes queue priority | Pending |
| Feature gate | Fresh profile/extension load | YouTube All import setting is off and popup does not expose Import | Pending |
| English All | Enable feature; active Home/watch page with first selected `All` chip | Up to 20 visible valid videos import in page order | Pending |
| Vietnamese All | Enable feature; active Home/watch page with first selected `Tất cả` chip | Same bounded import behavior | Pending |
| Other locale | First selected chip has any unverified label | Import fails closed with no snapshot | Pending |
| Visibility/filtering | Page includes hidden, duplicate, current, Shorts or promoted cards | Unsupported cards excluded; imported rows have no thumbnails | Pending |
| Active-tab binding | Audible YouTube differs from current active tab | Import uses exact active tab/current window only | Pending |
| Browse/play | Open imported item | Exact selected video opens; approved navigation preserves list | Pending |
| Remove | Remove one imported row, reopen popup/refresh same surface | Row remains hidden only in extension; YouTube page/account/history/playlist unchanged | Pending |
| Session lifecycle | Restart Chrome/reload extension after import | Imported videos, dismissal IDs and surface metadata are cleared | Pending |
| Stale lifecycle | Navigate unrelated URL/document or change surface during import | Snapshot rejects/clears instead of crossing context | Pending |
| Native controls | Imported list present or absent; click Next/Previous | Provider-native controls run unchanged; imported list is not transport queue | Pending |
| Pointer seek | Drag progress across multiple moves, then release | Local preview follows pointer; exactly one clamped seek commits on release | Pending |
| Pointer cancel | Cancel pointer or lose capture during drag | Preview restores authoritative time; no seek commits | Pending |
| Keyboard seek | Use arrows, Page Up/Down, Home/End | ±5s, ±30s and bounds work with synchronized ARIA values | Pending |
| No duration | Live/infinite/unknown-duration media | Slider reports disabled and commits no seek | Pending |
| Multi-tab | Audible tab and active non-media tab; run controls/search | Router chooses expected media/YouTube tab without stale results | Pending |
| Mini-player | Pin, drag, unpin, navigate tab | Player follows saved setting without listener/interval leak symptoms | Pending |
| Generic sites | HTML5 media, Spotify, SoundCloud | Existing media control behaves; `<all_urls>` remains necessary | Pending |

## Release audit

- Run `node --test tests/*.test.js` without credentials or live network access.
- Parse `manifest.json` and check JavaScript syntax for all loaded scripts.
- Inspect `manifest.json` permissions/CSP and confirm `<all_urls>` has not been removed accidentally.
- Scan tracked, untracked and package/unpacked inputs for Google key patterns, `.env`, logs, test fixtures and copied credential files.
- Check that popup/options do not echo a saved key and content scripts cannot request one.
- Confirm YouTube All is default-off in fresh storage and cannot import when disabled.
- Confirm All/Tất cả support, fail-closed unknown locale, no thumbnails and session-only imported metadata.
- Confirm Remove affects extension state only and native Next/Previous remain unchanged.
- Complete [release checklist v1.0.0](release-checklist-v1-0-0.md) before changing the feature default.

## Latest automated evidence

- 29/29 Node tests passed.
- 35/35 JavaScript syntax checks passed.
- Manifest, diff and security checks passed.
- Code review: 9/10, 0 critical.
- Live Chrome: pending because Chrome automation bootstrap was unavailable.

## Record template

```text
Date:
Chrome version:
Extension version/commit:
Google Cloud project/key: [not recorded]
Scenario:
Expected:
Actual:
Network/API call count (no headers or URLs with secrets):
Result: pass | fail | blocked
Notes:
```

## References

- [Chrome extension storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [YouTube Data API quota](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
