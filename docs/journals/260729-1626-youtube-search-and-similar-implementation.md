---
title: "YouTube Search and Similar Implementation"
date: 2026-07-29
tags: [chrome-extension, youtube, search, credentials]
---

# YouTube Search and Similar Implementation

## Context

Completed the YouTube API-key, popup search, and explicit Similar-on-YouTube work for the MV3 extension.

## What happened

- Added session-first, user-supplied API-key storage with an opt-in local mode and clear/replace lifecycle.
- Kept credential access behind the extension-context background broker; content scripts only receive public state.
- Added submit-only popup search with session caching, local ranking, stable `videoId` routing, and safe error handling.
- Added a generic Similar queue derived from a user-triggered YouTube search; explicit playlists retain priority and native Next remains the fallback.
- Hardened Similar state for service-worker suspension and stale tab/media contexts, including `videoId` validation.

## Decisions

- A browser extension cannot make a client-side key secret; session storage is the default and local persistence is explicit convenience.
- Recommendations are keyword-search results, not scraped or personalized related-video data.
- Queue state is background-owned and session-persisted with a bounded lifetime so it survives normal MV3 worker suspension.

## Next

Run the documented manual Chrome/API matrix with a restricted user-owned key. Verify credential lifecycle, live API failures, submit/cache behavior, playback routing, queue priority, mini-player behavior, and multi-tab scenarios.
