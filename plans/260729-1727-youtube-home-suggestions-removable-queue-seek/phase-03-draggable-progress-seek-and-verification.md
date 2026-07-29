---
phase: 3
title: "Draggable Progress Seek and Verification"
status: in_progress
progress: 45
priority: P1
effort: "1-3 days"
dependencies: [1, 2]
---

# Phase 3: Draggable Progress Seek and Verification

## Overview

Replace click-only popup seeking with a pointer/keyboard slider, then complete automated, live Chrome, privacy/policy, documentation, and rollback validation for the full feature.

## Context Links

- [Queue/seek research](./research/researcher-02-queue-removal-progress-seek.md)
- `popup/popup-player-controller.js`
- `content/provider-media-controller.js`
- `tests/popup-player-controller.test.js`
- `docs/manual-chrome-validation.md`

## Requirements

- Pointer down/move previews fill and current time locally; pointer capture keeps drag active outside track.
- Pointer up commits exactly one clamped `seekTo`; cancel/lost capture/pagehide commits nothing.
- Ignore non-primary pointers and missing/zero/NaN/Infinity duration or zero-width track.
- Slider keyboard: arrows ±5s, Page ±30s, Home 0, End duration; update ARIA values/text and disabled state.
- Polling may update duration during drag but must not overwrite preview; dispose interval/listeners on popup close.
- No change to media provider seek contract beyond stricter finite/clamp validation.

## Architecture

Create `popup/progress-seek-controller.js` with `create({track, fill, currentTimeLabel, commit})`, `updateMedia(info)`, and `dispose()`. Load before player controller. Popup controller supplies the existing `MEDIA_COMMAND/seekTo` commit and refreshes authoritative media after completion.

## Related Code Files

- Create: `popup/progress-seek-controller.js`, `tests/progress-seek-controller.test.js`
- Modify: `popup.html`, `popup.css`, `popup/popup-player-controller.js`, `content/provider-media-controller.js`, `tests/popup-player-controller.test.js`
- Modify docs: `README.md`, `docs/system-architecture.md`, `docs/development-roadmap.md`, `docs/project-changelog.md`, `docs/manual-chrome-validation.md`

## Implementation Steps

1. Add pointer, keyboard, cancellation, finite-duration, clamping, polling-during-drag, one-commit, and disposal tests.
2. Change progress markup to focusable ARIA slider; add large hit area, pointer cursor, dragging state, `touch-action:none`, and reduced-motion-safe styling.
3. Implement preview/commit controller with pointer capture and commit versioning.
4. Integrate popup polling/lifecycle; harden provider `seekTo` validation without regressing mini-player click seek.
5. Run full Node tests, JS syntax, manifest/load-order, file-size, diff, secret, and unsafe DOM sink checks.
6. Run unpacked Chrome matrix: mouse/touch/stylus, keyboard, release outside, popup close mid-drag, live/no-duration media, multi-tab, worker suspension.
7. Validate exact-active-tab behavior and YouTube All on signed-in/out Home/watch, non-All chip, SPA navigation, lazy loading, ads/Shorts, locale/layout variants, account switch, selector failure, and feature kill switch.
8. Add a versioned release checklist requiring policy/disclosure approval and evidence that the default-off flag is enforced.
9. Update disclosure/docs: local visible-card snapshot, session retention, neutral labels, removal semantics, unsupported DOM/policy caveat, and rollback instructions.

## Todo List

- [x] Add failing seek and lifecycle tests.
- [x] Implement slider module/markup/styles/integration.
- [x] Run automated/static gates and file-size check.
- [ ] Complete live Chrome/YouTube matrix.
- [ ] Complete policy/privacy review and docs before public release.
- [ ] Record signed release-checklist evidence; otherwise keep the feature disabled.

## Success Criteria

- [x] Pointer drag sends one exact clamped seek; cancel/close sends none.
- [x] Keyboard slider and screen-reader values follow WAI-ARIA behavior.
- [x] Full automated suite and static checks pass with no real key/network request.
- [ ] Live queue/removal/seek matrix passes across SPA, multi-tab, worker restart, and failure states.
- [ ] Public release is blocked unless the versioned policy/disclosure checklist passes; disabling the flag removes all import entry points while preserving native playback.

## Risk Assessment

- High: YouTube DOM/policy change. Feature flag, isolated adapter, neutral fallback, documented rollback.
- Medium: popup closes mid-drag. Preview has no side effect; commit only on pointerup.
- Medium: stale polling/async commits. Suppress preview overwrite and version completion.

## Security Considerations

- No external transmission of feed metadata; no credential/API key involvement in import.
- Safe DOM rendering only; validate canonical video IDs and URLs at every boundary.
- Manual evidence must never record account identity, history, cookies, or API keys.

## Next Steps

- After all gates pass, sync this plan into the blocked prior plan’s Phase 4/5 validation and run `/ck:cook` only with explicit policy acknowledgment.
