---
title: "YouTube All Suggestions Planning"
date: "2026-07-29"
type: planning
status: completed
---

# YouTube All Suggestions Planning

## Context

The existing API-derived Similar behavior did not match the desired YouTube experience. The requested direction is to surface suggestions already visible in YouTube's selected **All** view, allow removal from the extension list, and make the popup progress bar draggable.

## What Happened

A three-phase implementation plan was prepared for visible-surface extraction, removable session state, and pointer/keyboard seeking. No application code was implemented in this session.

Adversarial review corrected several unsafe assumptions: imports must target the exact active tab and document, stale SPA/chip surfaces must be rejected, opening an imported item must not immediately erase the list, and the experimental entry points need an enforceable default-off switch.

## Reflection

YouTube does not provide an official personalized Home or Up-next API for this use case. Reading visible DOM cards can approximate what the user currently sees, but it is unsupported, selector-fragile, and policy-sensitive. Therefore the design stays explicit, bounded, local, and fail-closed.

## Decisions

- Treat imported **All** suggestions as a session-scoped browse/play/remove list, not a replacement playback queue.
- Keep YouTube's native Next and Previous behavior unchanged.
- Require a user-triggered import from the exact active tab; bind results to tab, document nonce, route, selected chip, root, and card fingerprints.
- Store only bounded text and canonical video IDs; omit thumbnails and account identity.
- Enable the feature only through a default-off experimental flag pending policy and release review.
- Implement progress dragging as local preview followed by one clamped seek commit on pointer release; cancellation commits nothing.

## Next

Execute the plan only after acknowledging the DOM and distribution-policy caveat. Implementation should proceed phase-by-phase with fixtures, Chrome validation, and a versioned release checklist before public enablement.
