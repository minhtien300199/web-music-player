# Runtime Audit — YouTube Search Follow-up

## Executive Summary

- **Scope:** Read-only audit of response-envelope unwrapping, Similar queue persistence, stale-context handling, and the claimed Google host-permission blocker.
- **Status:** Envelope fix and Google-permission claim are **resolved**. Similar persistence and stale handling are **not resolved to the specified context-identity contract**: they work across normal service-worker suspension and URL-changing navigation, but omit required `videoId` validation.
- **Network:** No API key or network request used.

## Findings

### Resolved — mini-player response-envelope unwrapping

- `content/mini-player-controller.js:15` returns `response.data` only for a successful `{ ok: true }` envelope.
- Its consumers now correctly receive the media DTO: seek uses `info?.found` at `:32`; rendering uses `info?.found`, duration, and paused state at `:39-42`; playlist rendering consumes `queue?.items` at `:45-47`.
- The background still envelopes routed calls at `background.js:54`, so the unwrapping boundary matches the live message path.
- **Verdict: RESOLVED.**

### Not resolved — Similar queue lacks full context validation

- A completed Similar result is stored in `chrome.storage.session` with a 24-hour expiry at `background.js:87-88` and restored after an in-memory-map loss at `:31-33`.
- Tab loading/removal clear both memory and session state at `:40-41`; expired or revision-mismatched state is removed at `:33-34`.
- **Gap:** The saved state contains `videoId` (`:87`) but restore validation compares only `urlRevision` and expiry (`:33`). The state is therefore not validated by the documented `{ tabId, videoId, urlRevision }` identity.
- **Verdict: NOT RESOLVED.** Normal worker suspension is covered, but the required exact context identity is not.

### Not resolved — stale Similar guard lacks video-ID comparison

- The handler resolves context before the awaited Similar lookup, re-resolves afterward, and rejects a changed tab or URL revision at `background.js:82-85`. Stale successes are not persisted because persistence starts only after this check (`:86-89`).
- **Gap:** The guard does not compare `current.videoId` with `context.videoId`. `MusicControlRouter.notify()` can replace the cached context, including `videoId`, at `background/media-tab-router.js:12-15`, while `resolve()` returns it when its tab URL is unchanged (`:18-23`). A changed media context on the same URL revision can therefore pass both the stale-result check and stored-queue restore check.
- **Verdict: NOT RESOLVED.** URL-changing YouTube navigation is guarded, but the explicit video-ID invariant is not.

### Resolved — no missing Google host permission

- `manifest.json:7` declares `"host_permissions": ["<all_urls>"]`.
- `<all_urls>` covers the fixed HTTPS Google API request used at `background/youtube-search-service.js:21` and `:44` (`https://www.googleapis.com/...`).
- Deterministic manifest assertion passed: `https://www.googleapis.com/youtube/v3/search is covered by host_permissions`.
- **Verdict: RESOLVED.** The tester's claimed missing-Google-host blocker is not supported by the manifest. Adding a separate Google pattern would be redundant while `<all_urls>` remains the product scope.

## Local Verification

- `node --test tests/content-script-mini-player.test.js tests/youtube-credential-store.test.js tests/youtube-search-ranking.test.js` — **6 passed, 0 failed**.
- Parsed `manifest.json` and asserted Google API-origin coverage — **passed**.
- Parsed target JavaScript (`background.js`, router, Similar service, content script, mini-player, popup controller) — **passed**.
- Note: existing tests do not exercise a positive mini-player envelope, service-worker restart/session restore, or a same-URL `videoId` change; the two not-resolved verdicts are static, deterministic findings.

## Recommendation

- Add `stored.videoId === context.videoId` to `queueForCurrentTab()` and `current.videoId === context.videoId` to the post-await Similar guard in `background.js`; add narrow regression tests for both paths.

## Follow-up Verification

- **Resolved:** `background.js:33` now requires the persisted queue `videoId` to match the current context (with consistent `null` normalization), in addition to tab-specific lookup, URL revision, and TTL.
- **Resolved:** `background.js:85` now rejects a post-await Similar response when its `videoId` differs, alongside tab and URL-revision checks; stale results still cannot be persisted because this guard precedes `:86-88`.
- `node --check background.js` passed. No network or API-key operation was performed.
