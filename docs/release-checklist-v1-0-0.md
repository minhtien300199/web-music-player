# Release checklist v1.0.0

## Status

Release candidate gate for Music Control 1.0.0. The experimental YouTube All feature **must remain default-off** while any policy, disclosure or live Chrome item below is incomplete. Automated success alone cannot authorize a default change.

| Gate | Status | Evidence |
| --- | --- | --- |
| Node tests | Pass | 29/29 |
| JavaScript syntax | Pass | 35/35 |
| Manifest/diff/security checks | Pass | Recorded by implementation validation |
| Code review | Pass | 9/10; 0 critical |
| Chrome live matrix | Pending | Automation bootstrap unavailable |
| YouTube/Chrome policy review | Pending | Approval not recorded |
| User disclosure/privacy review | Pending | Approval not recorded |
| Default-on approval | Blocked | Requires every pending gate to pass |

## Required feature defaults

- [x] `youtubeAllImportEnabled` defaults to `false`.
- [x] Popup/background/content each enforce the setting; disabling clears imported session queue.
- [x] Imported metadata uses session storage only and contains no thumbnails.
- [x] English `All` and Vietnamese `Tất cả` are the only accepted labels; other locales fail closed.
- [x] Import is explicit, active-tab-only and bounded to 20 visible supported videos.
- [x] Remove affects extension state only; native Next/Previous remain provider-controlled.
- [ ] Confirm the same behavior in a clean unpacked Chrome profile.

## Policy and disclosure gate

- [ ] Review current YouTube Terms/API policies for reading user-visible DOM cards.
- [ ] Review Chrome Web Store policy and permission disclosure, including retained `<all_urls>`.
- [ ] Confirm product copy does not promise personalization or imply account/recommendation mutation.
- [ ] Confirm Settings explains default-off, DOM fragility, session-only storage and Remove semantics.
- [ ] Record reviewer, date, policy versions/links and approval decision without account identifiers.

## Live Chrome gate

- [ ] Complete every applicable row in [manual Chrome validation](manual-chrome-validation.md).
- [ ] Validate signed-in and signed-out YouTube Home/watch surfaces.
- [ ] Validate English `All`, Vietnamese `Tất cả`, and at least one unknown locale failing closed.
- [ ] Validate SPA navigation, stale surface, active-vs-audible multi-tab and session restart.
- [ ] Validate browse/play/remove with no thumbnail request/storage and no YouTube-side mutation.
- [ ] Validate native Next/Previous unchanged with imported list present.
- [ ] Validate pointer drag/release/cancel/lost-capture and keyboard seek on finite/no-duration media.
- [ ] Record Chrome/extension versions and expected/actual results; never record credentials/cookies.

## Default-on decision

The feature may be considered for default-on only when all checklist items pass and named policy/disclosure owners approve. Record:

```text
Commit/version:
Chrome versions:
Policy reviewer/date:
Disclosure reviewer/date:
Manual matrix result:
Decision: remain off | approve default-on
Notes:
```

Until this record is complete, ship or test the feature only behind the existing explicit opt-in. If selectors or policy expectations change, turn the setting off, clear session snapshots and repeat the gate.

## References

- [Manual Chrome validation](manual-chrome-validation.md)
- [System architecture](system-architecture.md)
- [YouTube API policies](https://developers.google.com/youtube/terms/developer-policies)
- [Chrome Web Store program policies](https://developer.chrome.com/docs/webstore/program-policies/)
