# System architecture

## Overview

Music Control is a Manifest V3 extension. The background service worker owns sensitive API-key access and external YouTube API calls. Popup/options are extension pages; content scripts control visible media and read provider playlist DOM only.

```text
Popup / Options
    | runtime messages (key candidate, search intent, media command)
    v
Background service worker
    |-- credential store: session by default; local only when opted in
    |-- search cache + YouTube Data API request
    |-- active-tab All snapshot + session queue
    v
Content script on a permitted web page
    |-- media commands and current media context
    |-- explicit YouTube/Spotify playlist extraction
    v
Website media controls / YouTube navigation
```

## Responsibilities

| Area | Responsibility | Sensitive data rule |
| --- | --- | --- |
| `background/` | Validates sender/action, stores key, calls YouTube API, caches results, routes selected videos | Key stays in background storage/request header; it is never returned in a normal UI response. |
| `popup/` | Control/Search views, safe text rendering, explicit user actions | Sends a candidate key only for Test/Save; does not display a saved key. |
| `options/` | Source settings and key lifecycle UI | Clears input after Test/Save; shows storage mode, not key value. |
| `content/` | Provider media controls, explicit playlist scraping, default-off YouTube All adapter, mini-player | Does not receive or call with API key. |
| `shared/` | Message action names, input validation, ranking | Keeps message shapes consistent across extension contexts. |

## Data flows

### API key lifecycle

1. User enters a key in Options and explicitly tests/saves it.
2. Background tests the candidate, then stores it in `chrome.storage.session` by default or `chrome.storage.local` only after explicit choice.
3. A small local metadata record stores the active mode; it is not the key.
4. Search retrieves the key only inside the service worker and sends it as an `x-goog-api-key` request header.
5. Forget clears key storage, cache, pending search and selection history.

`chrome.storage.local` is persistent browser storage, not encrypted secret storage. No arbitrary filesystem path or plaintext config file is used.

### Search and playback

1. Popup submits a non-empty query (maximum 160 characters).
2. Background checks a normalized session cache; a cache miss calls YouTube `search` for videos, normalizes and ranks the result.
3. Popup renders the returned metadata with DOM APIs and a result click requests `PLAY_YOUTUBE_VIDEO`.
4. Router reuses a YouTube tab when possible or creates one, then navigates to the exact video ID.

Search does not run from popup open, tab activation or input events. Cache TTL is 24 hours but session storage may disappear earlier on browser/extension restart.

### Visible YouTube All import and queue

1. A visible explicit provider playlist is the first queue source.
2. If absent and the experimental flag is enabled, popup may explicitly import from the active YouTube Home/watch surface.
3. Content accepts only a visible, selected, first-position chip labelled English `All` or Vietnamese `Tất cả`; any other locale/label fails closed.
4. The adapter reads up to 20 visible `/watch` items, excludes current/duplicate/Shorts/promoted/hidden cards, and returns no thumbnails.
5. Background revalidates the active tab, normalizes bounded metadata, then stores video IDs, labels, dismissal IDs, document nonce and surface revision in `chrome.storage.session`.
6. Play is allowed by stable video ID. Remove only filters the extension snapshot; it never mutates YouTube data.
7. If no explicit/imported queue exists, the popup shows no queue. Next/Previous always call website-native controls whether an imported list exists or not.

Imported metadata is session-only and scoped to one source tab/document/surface. Exact extension-initiated navigation may preserve the queue; unrelated tab navigation or document replacement clears it. The persisted feature setting does not make snapshot metadata persistent.

### Popup progress seek

`popup/progress-seek-controller.js` owns an ARIA slider independent of media polling. Pointer drag previews locally and commits one clamped `seekTo` on release; cancel/lost capture restores authoritative media time. Arrow keys seek 5 seconds, Page keys 30 seconds, and Home/End seek bounds. A missing/non-finite duration disables commits.

## Permissions and trust boundary

- `tabs`, `activeTab`, `scripting` and `storage` support routing, injection and user settings/key lifecycle.
- `<all_urls>` is intentionally retained because generic-site media control is an existing feature; it also permits existing YouTube/Spotify/SoundCloud and HTML5 media behaviour. It does not make Chrome internal URLs scriptable.
- Background accepts privileged key/search mutations only from extension pages. Content scripts can report media state and send media commands but cannot request a key.
- API and page metadata are untrusted. UI uses `textContent`/DOM construction instead of injecting provider text as HTML.

## Operational limitations

- MV3 service workers can stop between events; durable user choices are storage-backed, but session key/cache/Similar data are intentionally ephemeral.
- Provider DOM selectors may change. YouTube All import fails closed and native controls remain unchanged.
- YouTube Data API quota and key restrictions are controlled by the user's Google Cloud project.
- The experimental All adapter remains default-off until YouTube/Chrome policy, disclosure and live manual validation gates pass.

## References

- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [YouTube quota guidance](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [Code standards](code-standards.md)
- [Release checklist v1.0.0](release-checklist-v1-0-0.md)
