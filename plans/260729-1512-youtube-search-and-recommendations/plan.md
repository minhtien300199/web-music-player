---
title: "YouTube Search, Secure API Key, and Recommendations"
description: "Add BYOK YouTube search and compliant freeplay suggestions without exposing credentials or replacing native playlist behavior."
status: in_progress
priority: P1
branch: "main"
tags: [chrome-extension, youtube-data-api, security, search]
blockedBy: [260729-1727-youtube-home-suggestions-removable-queue-seek]
blocks: []
created: "2026-07-29T08:24:23.388Z"
createdBy: "ck:plan"
source: skill
---

# YouTube Search, Secure API Key, and Recommendations

## Overview

This plan's search and credential work is implemented. Its original generic `Similar on YouTube` freeplay behavior has been superseded by the blocked plan `260729-1727-youtube-home-suggestions-removable-queue-seek`, whose implementation is present but still awaits cleanup plus live Chrome and policy release gates. The remaining combined release gate is the documented live Chrome/Google API validation.

The browser client cannot make an API key truly secret. The default is session-only storage; persistent local storage is an opt-in convenience after content scripts use a service-worker broker and the storage area is restricted to trusted extension contexts. This is an audited convention, not isolation from a compromised popup/options page.

YouTube Data API no longer exposes personalized related videos. Preserve explicit playlists and native Next; freeplay suggestions are clearly labeled keyword-search results fetched only after user action. DOM scraping and undocumented endpoints are excluded from the public MVP.

## Goals

- Keep raw credentials inside trusted extension contexts and out of page/content-script data paths.
- Search only on explicit submit, rank locally, and let the user select a stable `videoId`.
- Render a source-aware queue: `Playlist`, `Similar on YouTube`, or native Next fallback.
- Keep each touched JavaScript/CSS module under 200 lines while preserving existing generic-site media controls and the current `<all_urls>` product scope.

## Non-goals

- Hiding a client-side key from a local administrator, malware, or DevTools.
- Arbitrary plaintext secret paths, Native Messaging/OS keychains, or a hosted proxy.
- Scraping `#related`, calling internal YouTube endpoints, autoplaying the first result, or mutating a real playlist.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Foundation and Contracts](./phase-01-foundation-and-contracts.md) | Implemented — automated/static verification recorded |
| 2 | [Secure API Key Storage](./phase-02-secure-api-key-storage.md) | Implemented — live key lifecycle still pending |
| 3 | [Search Experience](./phase-03-search-experience.md) | Implemented — live API and browser routing still pending |
| 4 | [Freeplay Recommendations](./phase-04-freeplay-recommendations.md) | Implemented — live provider/freeplay matrix still pending |
| 5 | [Integration and Documentation](./phase-05-integration-and-documentation.md) | In progress — manual Chrome/API release gate pending |

## Dependencies

- Phase 2 depends on Phase 1's trusted-context storage broker and message validation.
- Phases 3 and 4 share the search client, cache, ranking, and stable-video routing contracts.
- Phase 5 completes the release gate for the implemented phases before the plan is marked complete.
- External behavior depends on YouTube Data API availability/quota and YouTube page controls.

## Red Team Review

### Session - 2026-07-29
**Findings:** 15 accepted after deduplicating 21 evidence-backed findings.

| # | Finding | Severity | Applied To |
|---|---------|----------|------------|
| 1-4 | Foundation, load graph, target, media context | High | Phases 1, 3, 4 |
| 5-8 | Popup/queue lifecycle and trust boundaries | High | Phases 1-5 |
| 9-12 | Quota authorization, hosts, key state machine | High | Phases 1-4 |
| 13-15 | History deletion, storage migration, cold routing | High/Medium | Phases 1-5 |

## Validation Log

### Verification Results - 2026-07-29
- **Tier:** Full; **claims checked:** 21; **verified:** 21; **failed:** 0; **unverified:** 0 after corrections.
- Code paths checked: storage keys, popup teardown, MV3 tab state, message senders, queue ownership, provider host checks, and script load entry points.
- Assumed decisions: public/open-source posture, session-first key, popup-only Similar, and preservation of existing `<all_urls>` generic-site support.

## Verification

### Implementation Sync — 2026-07-29

- Implemented modules cover the trusted storage broker, credential lifecycle, submit-only search/cache/ranking, stable video routing, popup Control/Search UI, explicit-playlist priority, and popup-only Similar queue.
- Recorded automated/static evidence: `node --test tests/*.test.js` reported 6 passed/0 failed; all 23 JavaScript files passed syntax checks; the MV3 manifest parsed; `git diff --check` and the key/unsafe-sink scan passed. The later context-identity correction passed `node --check background.js`.
- Code-review and runtime-audit follow-ups resolved the mini-player response-envelope mismatch, persisted Similar queue recovery, and stale-context guards including `videoId` comparison.
- The tester's Google-host warning was superseded by the runtime audit: the existing `<all_urls>` host permission covers the fixed Google API origin and remains required for the extension's generic-site media controls.

### Remaining Release Gate

- Complete the blocking YouTube-All plan's cleanup, live Chrome matrix, and policy/disclosure gate; its experimental import must remain default-off until then.
- Run the unpacked Chrome matrix in [`docs/manual-chrome-validation.md`](../../docs/manual-chrome-validation.md) with a restricted, user-owned key. Do not record the key.
- Confirm live session/local lifecycle, Google API restriction/error behavior, submit/cache call counts, playback routing, freeplay/playlist priority, native Next/Previous, mini-player lifecycle, and multi-tab behavior.
- Re-run the full automated suite after any release-gate correction; the current fixture suite does not replace Chrome integration coverage.
