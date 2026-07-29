# Development roadmap

## Overview

Roadmap cho Music Control sau BYOK Search, default-off YouTube All import và draggable popup seek. “Implemented” chỉ nói về code/automated checks; không thay thế manual Chrome validation.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Message contracts, provider queue và tab routing | Implemented |
| 2 | BYOK API key, session/local storage và key lifecycle | Implemented |
| 3 | Popup Search, ranking và cache | Implemented |
| 4 | Default-off visible YouTube All browse/play/remove queue | Implemented; release-gated |
| 5 | Draggable pointer + keyboard popup seek | Implemented |
| 6 | Automated/security review and live Chrome/policy/disclosure release gate | In progress — live/policy review pending |

## Current release gate

Automated evidence: 29/29 tests, 35/35 syntax checks, manifest/diff/security checks pass; review score 9/10 with 0 critical. Live Chrome automation could not start because browser bootstrap was unavailable, so the manual matrix remains pending.

The YouTube All feature stays default-off until [release checklist v1.0.0](release-checklist-v1-0-0.md) confirms YouTube/Chrome policy and disclosure review plus the manual Chrome matrix. Do not record an API key in validation output.

The popup Settings/YouTube-control regression is fixed: popup handler IDs are aligned and background authorization accepts trusted extension pages while rejecting untrusted senders.

## Deferred work

- Public multi-user product: authenticated backend/proxy with rate limiting and policy review, rather than shipping a shared extension key.
- True persistent OS-protected secret storage: native messaging helper plus OS credential vault. This needs installer, platform support and a new security review.
- Broader locale support for YouTube's All chip after fixture/live validation; current adapter accepts English and Vietnamese only and fails closed otherwise.
- Any future claim of personalization/account context. Current import only snapshots visible cards and does not inspect identity/cookies.
- More resilient provider adapters and DOM compatibility monitoring for future YouTube/Spotify layout changes.
- Permission narrowing only after generic media-control support has an alternative design; `<all_urls>` is retained for current scope.

## References

- [Implementation plan](../plans/260729-1512-youtube-search-and-recommendations/plan.md)
- [System architecture](system-architecture.md)
- [Manual Chrome validation](manual-chrome-validation.md)
- [Release checklist v1.0.0](release-checklist-v1-0-0.md)
