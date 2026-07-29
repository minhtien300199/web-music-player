---
phase: 2
title: "Secure API Key Storage"
status: implemented
effort: "1-2 days"
---

# Phase 2: Secure API Key Storage

## Context Links

- [Secure-key research](../reports/researcher-260729-1512-secure-youtube-api-key.md)
- [Scout report](../reports/scout-260729-1512-search-key-recommendations.md)
- Existing options storage: `options.html:15-70`, `options.js:20-49`
- Existing permissions: `manifest.json:6-7`, `manifest.json:27`
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Google API key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)
- [Google API key restrictions](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys)
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)

## Overview

- Priority: P1
- Status: Implemented; live key/restriction lifecycle validation remains part of Phase 5.
- Effort: 1-2 days

Add a user-owned-key setup flow in Options. Store the key in `chrome.storage.session` by default; offer an explicitly less-secure “Remember on this device” mode in trusted-only `chrome.storage.local`. The UI must state that browser storage reduces accidental leakage but is not encrypted or truly secret.

## Implementation Sync — 2026-07-29

- Implemented the background credential store, status-only reads, session-default/local-opt-in replacement and clear flow, safe error mapping, and masked Options controls.
- The API client uses the fixed Google endpoint and `x-goog-api-key` header. No raw key is returned in normal responses; recorded scans found no key-like value or unsafe executable sink.
- `<all_urls>` already covers the fixed Google API origin; no redundant host permission was added. Live Google Cloud restrictions and real restart behavior remain unverified.

## Key Insights

- Any key a browser extension can use is recoverable by a determined local user, malware, DevTools, or compromised extension code.
- `storage.session` is in-memory and trusted-context-only by default, but is cleared by browser restart, extension reload/update, disable, or uninstall.
- `storage.local` persists but can be inspected in the Chrome profile/DevTools. It is acceptable only as disclosed convenience after Phase 1 removes content-script access.
- An arbitrary path or ignored plaintext file adds friction without stronger protection. Native Messaging with an OS keychain or a backend proxy is a separate distribution architecture.

## Requirements

### Functional

- Options actions: use for this session, remember on this device, test, replace, and forget.
- Never read a saved raw key back into an input; expose only `{configured, persistence}` status.
- Replace a key with an idempotent credential state machine; never describe independent cross-area writes as atomic.
- Clear the input immediately after use and preserve no candidate in UI state after Options closes.
- Persist a bounded, expiring pending query in `chrome.storage.session` before opening Options; restore it for explicit resubmission after setup.

### Non-functional

- No key in URLs, logs, runtime responses, content scripts, DOM attributes, query cache keys, tests, screenshots, or committed files.
- Background sends the key in the `x-goog-api-key` request header over HTTPS.
- Distinguish missing, invalid/restricted, API-disabled, quota, timeout, and network errors with safe codes.
- Keep service and UI modules under 200 lines.

## Architecture

Credential state:

1. Trusted local metadata stores `{activeMode: "session"|"local", generation}` without key material.
2. Resolver reads only the active mode's key; it never falls back to an inactive stale key.
3. Session mode with a missing session key after restart returns `KEY_NOT_CONFIGURED`.
4. Replacement serializes mutations, writes/verifies the candidate and generation, flips active metadata, then cleans stale material with explicit partial-failure recovery.

Trusted actions:

- `GET_YOUTUBE_KEY_STATUS` -> status only
- `TEST_YOUTUBE_KEY` -> consumes the candidate transiently, returns a safe result
- `SET_YOUTUBE_KEY` -> `{key, persistence: "session"|"local"}` from Options only
- `CLEAR_YOUTUBE_KEY` -> clears both areas and in-memory request state

The background credential service resolves the key immediately before each API request. Search modules receive a request function or header factory, not a globally exported key. Error redaction strips `key`, `apiKey`, `x-goog-api-key`, and `AIza...`-shaped values. Popup/options can technically access trusted storage, so broker-only access is enforced by code review, CSP, safe rendering, and tests rather than claimed as Chrome-enforced isolation.

## Related Code Files

### Modify

- `options.html` — credential field, disclosure, persistence choice, actions, status.
- `options.css` — compact warning/status styling.
- `options.js` — bootstrap existing settings and key controller.
- `background.js` — register trusted credential actions.
- `manifest.json` — verify the fixed Google API origin remains covered by the existing `<all_urls>` product scope; do not add a redundant host pattern.
- `.gitignore` — verify existing `.env`, `.env.*`, and key-file coverage; add exact patterns only if a developer-only local fixture is documented.

### Create

- `options/options-api-key-controller.js` — masked entry/status/test/replace/forget flow.
- `background/youtube-credential-store.js` — active-mode/generation state machine and status-only reads.
- `background/safe-error.js` — central reason mapping and credential redaction.
- `tests/youtube-credential-store.test.js` — fake storage areas and trusted-sender cases.

### Delete

- None. Do not add a real `.env`, secret JSON, key text file, or example containing a key-like value.

## Implementation Steps

1. Add credential-store tests for empty state, session default, remembered opt-in, mode/generation replacement, clear-both, reload semantics, and storage failures.
2. Implement background-only storage access using Phase 1's trusted-context initialization. Keep the raw key in a local function scope for each request.
3. Validate trusted sender, type, trimmed non-empty length bound, and persistence enum. Treat Google prefix/length patterns as hints, not authorization.
4. Implement safe key testing through one explicit low-cost `videos.list` request for a fixed public ID so Test does not consume the scarce Search Queries bucket; disclose that it still consumes API quota.
5. Build the Options UI with `type="password"`, no browser autocomplete, clear disclosures, and no saved-value echo. Return focus and keyboard status accessibly.
6. Send credentials with `x-goog-api-key`, never `?key=`, and centralize safe error mapping/redaction.
7. Implement the serialized generation/mode state machine. Test write-success/delete-failure, mode-flip failure, worker restart, concurrent request, rollback/partial failure, and stale inactive key behavior.
8. Implement Forget to clear both key stores, active metadata, pending search, session cache, and selection/history state, then update all open extension views with status only.
9. Add help text for restricting the Google key to YouTube Data API v3, monitoring quota, rotating/revoking old keys, and the unverified nature of `chrome-extension://` referrer restrictions.
10. Verify Git/package contents contain no live secret; document that `.gitignore` is not encryption and does not control Chrome packaging.

## Todo List

- [x] Add credential-store and trusted-sender fixture coverage.
- [x] Implement session-first, local-opt-in key storage.
- [x] Add safe header construction and error redaction.
- [x] Build accessible Options credential controls and disclosure.
- [x] Implement generation/mode test/replace/forget behavior.
- [x] Add missing/invalid/quota/network status mapping.
- [x] Verify recorded source/fixture scans contain no secret.

## Success Criteria

- [ ] Default session mode requires re-entry after a real Chrome/extension restart.
- [ ] Persistent mode behavior and its “not encrypted” disclosure pass in unpacked Chrome.
- [x] Content scripts cannot access either storage area or receive the key through the reviewed message paths.
- [x] Status endpoints do not return key material, suffixes, fingerprints, headers, or storage snapshots.
- [x] YouTube requests construct `x-goog-api-key` headers and omit key material from URLs/error text.
- [ ] Replace/cleanup partial failures and Forget must still be exercised across a real worker/browser restart.
- [ ] Inspect the actual unpacked/package inputs as part of the release audit; source/fixture scans currently pass.

## Risk Assessment

- High: users may interpret “local” as secure encryption. Use explicit threat-model copy next to the persistence option.
- High: restricting `storage.local` breaks old content-script state access if Phase 1 is incomplete. Make Phase 1 a hard gate.
- Medium: a test request consumes quota or fails because the API is disabled/restricted. Surface the exact safe category and do not overwrite the prior key.
- Medium: extension-ID referrer restrictions may not work with Google APIs. Require a live manual verification before recommending that restriction.

## Security Considerations

- Browser storage is a leakage boundary, not a vault. Do not implement reversible client-side “encryption” with a bundled key.
- Reject arbitrary file paths and plaintext secret files as the primary product path.
- Defer Native Messaging/Windows Credential Manager and authenticated backend proxy until distribution/security needs justify installation and operations cost.
- Recommend BYOK API restriction, quota alerts, rotation, and revocation; never ship a shared production key in the extension.

## Next Steps

- Phase 3 consumes only the credential service's request boundary and status codes.
- A future public zero-setup release requires a separate backend design with authentication, rate limits, caching, abuse controls, and budget limits.
