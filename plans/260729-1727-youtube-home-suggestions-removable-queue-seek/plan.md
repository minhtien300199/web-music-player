---
title: "YouTube Personalized Feed Queue and Draggable Seek"
description: "Replace generic Similar search with an explicit local snapshot of YouTube's visible All recommendations, add removable queue items, and make popup seeking draggable."
status: in_progress
progress: 82
priority: P1
effort: "5-7 days"
branch: "main"
tags: [feature, frontend, chrome-extension, youtube, experimental]
blockedBy: []
blocks: [260729-1512-youtube-search-and-recommendations]
created: "2026-07-29T10:34:07.193Z"
createdBy: "ck:plan"
source: skill
---

# YouTube Personalized Feed Queue and Draggable Seek

## Overview

Replace the misleading API-derived `Similar on YouTube` queue with suggestions visibly rendered by YouTube for the current profile/session. The user opens a supported YouTube Home or watch page with the **All** chip selected, then explicitly imports/refreshes a bounded local snapshot. The extension never auto-clicks chips, auto-scrolls, reads account identity/cookies, or calls undocumented endpoints.

Explicit provider playlists remain highest priority. Imported suggestions are a popup-only browse/remove list, keyed by stable `videoId` and scoped to the browser session. They do not replace YouTube's native Next/Previous behavior. The popup progress control gains pointer drag and accessible keyboard seek with one media commit per completed drag.

This DOM integration is unsupported and policy-sensitive. Public distribution requires YouTube/Chrome policy review; implementation must have selector isolation, neutral labeling, a feature flag/kill switch, and a manual Chrome release gate.

## Scope

- In: default-off visible All import, extension-list removal, session persistence, draggable/keyboard popup seek, fixtures/manual validation.
- Out: hidden API/Innertube access, auto-scroll, account detection, YouTube history/playlist mutation, cloud sync, Undo, mini-player suggestion removal.

## Cross-Plan Dependencies

| Relationship | Plan | Reason |
| --- | --- | --- |
| Blocks | `260729-1512-youtube-search-and-recommendations` | Replaces its Similar semantics and changes pending release validation. |

## Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | [Personalized YouTube Feed Queue](./phase-01-personalized-youtube-feed-queue.md) | Completed — automated/static evidence | 100% |
| 2 | [Removable Suggestions and Queue State](./phase-02-removable-suggestions-and-queue-state.md) | Completed — implementation verified | 100% |
| 3 | [Draggable Progress Seek and Verification](./phase-03-draggable-progress-seek-and-verification.md) | In progress — automated gates pass; live/policy gates pending | 45% |

## Dependencies

- Current message contracts, media router, stable `videoId` playback, session storage, and safe DOM renderer.
- User must explicitly select **All** on a supported visible YouTube surface before import.
- Policy approval is required before public distribution; local technical implementation does not imply policy clearance.

## Success Criteria

- Imported cards match the visible All surface order, exclude invalid/current/duplicate videos, and never claim guaranteed personalization.
- Removed items stay absent across popup reopen and worker suspension for the same context, then reset on navigation/session end.
- Dragging previews locally and commits one clamped `seekTo`; keyboard and no-duration states are accessible.
- Automated fixtures pass; live signed-in/out, SPA, selector-failure, multi-tab, pointer, and keyboard matrix is recorded.

## Planning Inputs

- [YouTube feed feasibility](./research/researcher-01-youtube-personalized-feed.md)
- [Queue removal and seek design](./research/researcher-02-queue-removal-progress-seek.md)
- [Codebase scout](./reports/scout-report.md)

## Red Team Review

| Finding | Resolution |
| --- | --- |
| Imported queue could incorrectly imply control of Next/Previous | Define it as a browse/remove list; native YouTube transport remains unchanged. |
| Cached/audible routing can import from the wrong tab | Import only from the active tab in the current window and bind the result to its exact document. |
| SPA/chip changes can return stale cards | Use a document nonce plus route/chip/root fingerprints before and after extraction. |
| Playing an imported item could clear the list immediately | Mark extension-initiated navigation and preserve the list for that transition. |
| A kill switch without enforcement is not a release gate | Add a default-off setting enforced in popup, background, and content code, plus a versioned release checklist. |
| Remote thumbnails and loose metadata expand privacy/storage risk | Omit thumbnails in MVP; validate lengths and cap item count/message size. |
| Tab/document/account context can drift | Never infer account identity; reject mismatched tab, document nonce, route, or surface revision. |

## Validation Log

- Mode/defaults: Standard adversarial validation; 20-item cap; session-only removal; no Undo; arrows 5s, Page 30s, Home/End bounds.
- Implementation sync (2026-07-29): 29/29 tests, 35/35 syntax checks, manifest/diff/security scans, and code review (9/10, no critical findings) pass. Live Chrome bootstrap was unavailable; policy/disclosure approval and signed release evidence remain absent, so the feature stays default-off.
