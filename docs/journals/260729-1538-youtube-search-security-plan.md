---
title: YouTube search and security planning
date: 2026-07-29
status: completed
---

# Journal: YouTube Search and Security Plan

## Context

The user wanted a plan for exact-song YouTube search, user-owned API credentials, and useful freeplay recommendations without weakening the existing extension controls.

## What Happened

- Planned session-first BYOK, with optional local persistence only after a clear warning. Browser storage is risk reduction, not a true vault.
- Kept the raw key behind a service-worker broker and sent it in the `x-goog-api-key` header. The broker is an audited convention, not a security boundary against compromised trusted extension pages.
- Added a popup `Search` tab using the official `search.list` API only on explicit submit, with bounded 24-hour caching and duplicate-submit controls to conserve quota.
- Confirmed there is no official personalized related-video endpoint. `Similar on YouTube` is popup-only, explicitly requested generic search; YouTube's native Next remains the fallback.
- Deferred recommendation DOM scraping and undocumented endpoints because of policy and page-stability risk.

## Reflection

The red-team pass corrected underspecified trust and lifecycle assumptions: exact `chrome-extension://<runtime-id>` sender origin, a per-action authorization matrix, background-owned versioned `MediaContext` and queue state, a serialized credential generation/mode state machine, and explicit search-history/cache deletion.

Browser-only credential handling can reduce accidental exposure, but cannot honestly promise secrecy from DevTools, malware, administrators, or a compromised popup/options context.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Session-first credentials; warned local opt-in | Minimize persistence without overstating browser storage | Re-entry after restart by default |
| Background broker plus exact-origin/action checks | Keep secrets and quota-bearing actions out of page/content paths | Central authorization and status-only responses |
| Official submit-only search with cache | Stable API contract and quota control | No search-as-you-type or automatic Similar calls |
| Popup-only Similar plus native Next | No official personalized recommendation API | Clear generic suggestions; native personalization remains intact |
| Delete search history with credential cleanup controls | Queries are sensitive listening history | Clear pending queries, cache, and learned selection state |

## Validation and Next

- Plan: [`plans/260729-1512-youtube-search-and-recommendations/plan.md`](../../plans/260729-1512-youtube-search-and-recommendations/plan.md).
- Strict/full validation passed after corrections: 21 claims checked, 21 verified, 0 failed, 0 unverified.
- The active-plan script warned that `CK_SESSION_ID` was absent, so it could not record session-bound active-plan state.
- Next: implement the five pending phases and run the planned unit, security, regression, and manual Chrome checks before advancing documentation status.
