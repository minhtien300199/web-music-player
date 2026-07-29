---
phase: 2
title: "Removable Suggestions and Queue State"
status: completed
progress: 100
priority: P1
effort: "2 days"
dependencies: [1]
---

# Phase 2: Removable Suggestions and Queue State

## Overview

Replace popup `Find similar` with `Import/Refresh from YouTube All`, persist the imported browse list in background session state, and let users remove extension-owned items without modifying YouTube.

## Context Links

- [Queue/seek research](./research/researcher-02-queue-removal-progress-seek.md)
- [Scout report](./reports/scout-report.md)
- `background.js`
- `background/youtube-similar-service.js`
- `popup/popup-dom.js`
- `popup/popup-player-controller.js`

## Key Insights

- Current Similar state is split between an in-memory map and `storage.session`; mutation must be serialized to avoid resurrecting dismissed items.
- The popup row is currently one button; removal requires sibling Play/Remove buttons, never nested buttons.
- Explicit provider playlists are page-owned and must not be removable.

## Requirements

- Display priority: explicit playlist > same-context imported YouTube-All list. Next/Previous always retain native YouTube behavior.
- Replace default Similar CTA/label with truthful `Import/Refresh from YouTube All`; do not silently fall back to generic search.
- Background owns `{queueId, sourceTabId, sourceDocumentNonce, sourceRevision, expiresAt, dismissedIds, pendingNavigationVideoId, items}`.
- Dismiss by validated stable `videoId`; idempotent; preserve across popup reopen/worker suspension and repeated refresh for same context.
- Preserve the list when the user opens one of its items; mark that extension-initiated transition before navigation.
- Reset on source-tab close, unrelated source-document/context replacement, expiry, explicit refresh to a new surface, or browser session end.
- Removal affects imported suggestions only; no YouTube playlist/history mutation and no Undo in MVP.

## Architecture

Create `background/suggestion-queue-store.js` with serialized `get/save/dismiss/markPlayback/clear`. Background resolves tab/document context itself and rejects client-supplied tab/URL state. `GET_QUEUE`, import, dismiss, and clear become shared contracted actions. Rendering always uses the authoritative response; transport controls do not consume this list.

## Related Code Files

- Create: `background/suggestion-queue-store.js`
- Create: `tests/suggestion-queue-store.test.js`, `tests/popup-dom.test.js`
- Modify: `background.js`, `shared/message-contracts.js`, `popup/popup-player-controller.js`, `popup/popup-dom.js`, `popup.html`, `popup.css`
- Delete after migration: `background/youtube-similar-service.js` if no remaining caller

## Implementation Steps

1. Add tests for display priority, context/expiry validation, dedupe, worker reload, refresh-after-dismiss, idempotent removal, concurrency, self-navigation preservation, unrelated navigation cleanup, and empty list.
2. Extract current queue memory/session logic into a focused serialized store; remove stale memory and session together.
3. Contract `GET_QUEUE`, `IMPORT_YOUTUBE_ALL_SUGGESTIONS`, `DISMISS_SUGGESTION_ITEM`, and optional clear action.
4. Implement privileged import: request Phase 1 snapshot from resolved YouTube tab, validate again, save, return authoritative queue.
5. Replace Similar popup copy/action; preserve Search as generic manual search and keep native Next/Previous unchanged.
6. Render imported rows as wrapper + sibling Play/Remove buttons with safe text, disabled pending state, focus preservation, status announcement, and source-specific empty copy.
7. Remove dead generic Similar queue code only after tests prove no call path remains.

## Todo List

- [x] Add queue-state and popup-DOM failing tests.
- [x] Implement serialized background store and actions.
- [x] Wire explicit import/refresh and remove UI.
- [x] Preserve explicit playlist display and native Next/Previous behavior.
- [x] Preserve the imported list after opening one of its items.
- [x] Remove dead Similar service/state without affecting Search.

## Success Criteria

- [x] Removed IDs never reappear for the same context after popup reopen, worker suspension, or refresh.
- [x] Navigation/session reset permits a fresh snapshot.
- [x] Playlist rows expose no Remove control; imported rows have accessible Play/Remove controls.
- [x] Empty imported list does not alter or block native transport.

## Risk Assessment

- High: concurrent import/dismiss can resurrect items. Serialize mutations and merge `dismissedIds`.
- Medium: wrong-tab mutation. Resolve context in background and compare exact route/video revisions.
- Medium: user interprets removal as YouTube feedback. UI must say “Remove from extension list”.

## Security Considerations

- Extension-page sender authorization only for queue mutation.
- Validate item IDs/source server-side; never trust popup queue arrays or indices.
- Store normalized minimum metadata in `storage.session`, not local/sync.

## Next Steps

- Phase 3 adds draggable seek and validates both queue behavior and DOM compatibility.
