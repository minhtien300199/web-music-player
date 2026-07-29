---
phase: 1
title: "Foundation and Contracts"
status: implemented
effort: "2-3 days"
---

# Phase 1: Foundation and Contracts

## Context Links

- [Scout report](../reports/scout-260729-1512-search-key-recommendations.md)
- [Secure-key research](../reports/researcher-260729-1512-secure-youtube-api-key.md)
- [Search/recommendations research](../reports/researcher-260729-1512-youtube-search-recommendations.md)
- Existing routing: `background.js:23-84`, `popup.js:38-99`
- Existing queue: `content-script.js:218-282`, `content-script.js:829-875`
- Existing storage coupling: `options.js:20-49`, `content-script.js:14-23`, `content-script.js:304-350`
- [Chrome messaging security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#security-considerations)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

## Overview

- Priority: P1
- Status: Implemented; live Chrome regression remains part of Phase 5.
- Effort: 2-3 days

Establish the minimum security boundary before adding secrets or API traffic: validated contracts, a storage broker, deterministic tab routing, and safe rendering. Mechanical module extraction continues incrementally, but only the broker/contracts/router are hard gates for Phase 2.

## Implementation Sync — 2026-07-29

- Implemented the ordered MV3 load graph, shared message contracts, trusted storage broker, media-tab router, provider queue/media controllers, popup controllers, and mini-player controller.
- Storage areas are initialized for trusted contexts; privileged key/search actions require an exact extension-page origin, while content scripts remain limited to media/public-state paths.
- The review follow-up fixed mini-player response-envelope unwrapping. The 6-test fixture suite and static syntax/security scans are recorded as passing; provider behavior still needs the manual Chrome matrix.

## Key Insights

- The popup currently bypasses `background.js` for normal commands, while background separately tracks a media tab. Search/open-video must have one deterministic routing owner.
- `chrome.storage.local.setAccessLevel()` applies to the entire area, not one key. Current content-script reads/writes would break unless brokered first.
- Queue playback is index-based; API results and cross-navigation need stable `videoId` targets.
- `content-script.js`, `popup.js`, and `popup.css` exceed the project 200-line limit. Extract by responsibility without changing observable behavior.

## Requirements

### Functional

- Preserve current media detection, pin lifecycle, playlist playback, Next/Previous, and options behavior.
- Define versioned actions for public settings/state, API-key operations, search, similar search, and video navigation.
- Normalize search and queue items; reject malformed messages before side effects.
- Route secret/search/navigation actions only from trusted extension pages by validating `sender.id` and the exact `chrome-extension://<runtime-id>` origin. Do not use absence of `sender.tab`: Options may run inside a tab.
- Maintain a per-action authorization matrix covering every legacy and new action, allowed sender class, input schema, side effect, and minimal response DTO.

### Non-functional

- No touched JavaScript/CSS module over 200 lines at feature completion; do not block the credential/search slice on unrelated provider rewrites.
- Classic MV3 scripts remain build-free: use ordered manifest/script loading or `importScripts`.
- Message handlers always return serializable success/error envelopes and never throw across runtime boundaries.
- Keep changes KISS/DRY: one validator, one video-ID parser, one normalized error shape.

## Architecture

Trusted routing:

`Popup/Options -> runtime message -> background broker -> storage/API/tabs`

Page routing:

`Popup/mini-player -> background media-tab resolver -> content script -> provider adapter`

Normalized contracts:

- `SearchResult`: `{videoId, title, channelTitle, thumbnailUrl, publishedAt}`
- `QueueItem`: `{id, source, title, artist, thumbnailUrl?, active, playTarget}`
- `playTarget`: `{kind: "youtube-video", videoId}` or `{kind: "provider-index", provider, index, playlistFingerprint}`
- `QueueState`: `{source: "playlist"|"similar"|"native-next", label, items, currentVideoId?}`
- `MediaContext`: `{tabId, provider, videoId?, urlRevision, title, artist}` owned and re-resolved by the background router
- Response: `{ok: true, data}` or `{ok: false, error: {code, message, retryable}}`

Storage separation:

- Trusted `chrome.storage.local`: public settings, the live `musicControlMiniPlayerEnabled` value, optional remembered key, and credential mode metadata.
- Trusted `chrome.storage.session`: default API key, transient search/cache state, and popup round-trip state.
- Content scripts: obtain/update an allowlisted public DTO through background messages; never receive key storage objects.

The broker is a reviewed code boundary, not a Chrome capability boundary: popup/options remain trusted extension contexts with extension-wide `storage` permission. CSP, safe DOM sinks, no remote code, and review checks are required.

Load graph:

- Service worker: `background.js` calls ordered `importScripts()` for shared contracts, storage, router, credential, cache, and search services.
- Content scripts: `manifest.json` lists shared contracts and content controllers in dependency order before `content-script.js`.
- Popup/Options: HTML loads shared/view/controller scripts before their bootstrap entry.
- Node tests: fixtures execute the same dependency order explicitly.

## Related Code Files

### Modify

- `manifest.json` — ordered scripts while preserving `<all_urls>` because generic-site control is existing product scope.
- `background.js` — thin dispatcher/media-tab resolver.
- `content-script.js` — thin provider/mini-player orchestrator.
- `popup.js` — thin popup bootstrap.
- `options.js` — settings UI using the public-settings broker.
- `tests/content-script-mini-player.test.js` — preserve regressions after extraction.

### Create

- `shared/message-contracts.js` — action names, envelope helpers, ID/message validation.
- `background/storage-broker.js` — trusted access to public settings and mini-player state.
- `background/media-tab-router.js` — deterministic content command and video-tab targeting.
- `content/provider-media-controller.js` — existing provider media operations.
- `content/provider-queue-adapter.js` — explicit playlist normalization and stable playback targets.
- `content/mini-player-controller.js` — extracted pin UI/state.
- `popup/popup-player-controller.js` and `popup/popup-dom.js` — current player/queue behavior.
- Focused Node tests under `tests/`; no live Chrome profile or key.

### Delete

- None. Move behavior incrementally, then keep entry files as small composition roots.

## Implementation Steps

1. Capture the current regression baseline with `node --test tests/content-script-mini-player.test.js`; document expected message actions and media-tab selection.
2. Add shared constants, `isValidVideoId`, provider URL parsing, sender classification, and response-envelope helpers with pure unit tests.
3. Introduce the service-worker storage broker. Inventory and move the exact live keys `musicControlSettings` and `musicControlMiniPlayerEnabled` behind allowlisted messages and broadcasts; preserve old stored values without a destructive migration.
4. Add startup initialization that sets `chrome.storage.local` and `chrome.storage.session` access to `TRUSTED_CONTEXTS`; verify content scripts function only through the broker.
5. Add the complete action authorization/response matrix and exact URL parsing tests. Approved providers must use HTTPS and exact hostname/subdomain boundaries, never substring matching.
6. Extract background media-tab routing and a versioned `MediaContext`. Route every mini-player action through background; re-resolve after worker wake and reject stale `{tabId, urlRevision}` responses.
7. Implement the per-context load graph and matching Node fixture load order before referencing any extracted global/module.
8. Extract only touched storage, queue, mini-player, popup-player, and DOM responsibilities until touched JavaScript/CSS modules are below 200 lines; preserve provider behavior mechanically.
9. Change queue activation to the discriminated `playTarget`; require stable YouTube IDs and a playlist fingerprint for provider-index fallback.
10. Replace playlist/mini-player title interpolation with element creation and `textContent`; add an injection-regression test.
11. Run syntax checks plus the full Node suite. Phase 2 is gated only by the tested broker, authorization matrix, router, and safe request boundary.

## Todo List

- [x] Record the mini-player baseline and post-change fixture coverage.
- [x] Add normalized contracts and validators.
- [x] Add the action authorization/response matrix and exact-host validation.
- [x] Broker content-script local/session state access.
- [x] Restrict both storage areas to trusted contexts.
- [x] Centralize media-tab actions with a versioned `MediaContext`.
- [x] Define the MV3/popup/options script load order.
- [x] Split touched entry files by responsibility.
- [x] Remove unsafe HTML rendering paths in executable extension code.
- [x] Pass recorded regression, syntax, and security-rendering checks.

## Success Criteria

- [ ] Existing player, pin, playlist, Next, and Previous behavior remains functional in unpacked Chrome.
- [x] No content script directly reads/writes `chrome.storage.local` or `chrome.storage.session`.
- [x] Secret/search/navigation actions accept extension pages and reject content/page origins for privileged work.
- [x] Queue/search contracts use stable IDs and return normalized envelopes.
- [x] Spotify/provider-index queue items retain a discriminated playback target without weakening YouTube ID validation.
- [x] Touched modules are focused, below 200 lines, and have an explicit MV3 load order.
- [x] Recorded baseline/new foundation fixture and static checks pass.

## Risk Assessment

- High: storage restriction can silently break mini-player coordination. Mitigate with broker tests before calling `setAccessLevel`.
- High: a cold MV3 worker can forget a paused media tab. Re-resolve a validated last-known context and test paused-media wake behavior.
- Medium: extraction can change event lifecycles. Move one responsibility at a time and rerun regression tests after each move.
- Medium: multiple YouTube tabs can be navigated incorrectly. Require a preferred tab ID and validate URL/provider before reuse.
- Low: classic scripts can collide in the global scope. Export one namespaced frozen API per module.

## Security Considerations

- Treat content-script input, DOM metadata, tab URLs, and API payloads as untrusted.
- Allowlist action fields and lengths; validate `videoId` before constructing a YouTube URL.
- Never expose storage objects wholesale. Return a minimal public-settings DTO.
- Preserve `<all_urls>` for the existing generic-site product in this MVP. Treat optional-host redesign as separate consent/product work rather than claiming the redundant Google host narrows access.

## Next Steps

- Phase 2 uses the trusted broker to implement session-first BYOK storage.
- Phase 3 builds search on the validated message and routing contracts.
