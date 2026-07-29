---
phase: 5
title: "Integration and Documentation"
status: in_progress
effort: "2 days"
---

# Phase 5: Integration and Documentation

## Context Links

- [Scout report](../reports/scout-260729-1512-search-key-recommendations.md)
- [Secure-key research](../reports/researcher-260729-1512-secure-youtube-api-key.md)
- [Search/recommendations research](../reports/researcher-260729-1512-youtube-search-recommendations.md)
- Existing test harness: `tests/content-script-mini-player.test.js:54-210`
- Existing docs: `README.md`; `docs/project-changelog.md`
- [YouTube quota/compliance guide](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube API developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

## Overview

- Priority: P1
- Status: In progress — automated/static evidence and documentation are complete; live Chrome/API release validation is pending.
- Effort: 2 days

Validate the entire extension in unit tests and a real unpacked Chrome profile, audit key/quota/policy boundaries, and update user/developer documentation. Do not mark the feature complete while regression, secret scanning, or manual provider checks fail.

## Implementation Sync — 2026-07-29

- Completed recorded automated/static checks: `node --test tests/*.test.js` reported 6 passed/0 failed, all 23 JavaScript files passed syntax checks, `manifest.json` parsed, `git diff --check` passed, and the source/fixture scan found no Google key pattern or unsafe executable DOM sink.
- Completed documentation updates: roadmap, changelog, architecture, code standards, and the manual Chrome validation matrix accurately describe the feature and remaining caveats.
- Code-review and runtime-audit follow-ups resolved the reported mini-player envelope, persisted Similar queue, and stale `videoId` context issues. A final full-suite rerun is still required if any live-gate correction is made.
- Not complete: no live API key, Google Cloud restriction, unpacked Chrome, provider, restart, or multi-tab test has been recorded.

## Key Insights

- Current coverage is five Node VM tests focused on mini-player lifecycle and Next/Previous; there is no popup, options, background-fetch, navigation, CSP, or live DOM coverage.
- Live YouTube/API tests are nondeterministic and could leak/consume a key. CI must use fixtures/fake fetch and manual validation must use a user-owned restricted key.
- Chrome storage lifecycle, MV3 service-worker suspension, tab reuse, and YouTube SPA navigation require browser-level checks.
- Required project docs may not yet live under `docs/`; documentation creation belongs here, after verified behavior is known.

## Requirements

### Functional

- Cover key lifecycle, search, quota/cache, ranking, selected-video routing, queue priority, native fallback, and existing media controls.
- Validate signed-in/out YouTube, freeplay, explicit playlist, Spotify, autoplay on/off, Shorts/unavailable content, keyboard UX, and multiple tabs.
- Verify session key disappearance after browser restart/extension reload and opt-in local persistence disclosure/forget.
- Confirm no automatic search/similar calls on popup open or polling.

### Non-functional

- CI/unit tests contain no real credentials and perform no live Google/YouTube requests.
- All touched JavaScript/CSS files stay below 200 lines; manifest JSON parses and every script passes syntax checks.
- Permissions are justified; preserve existing `<all_urls>` because generic-site control is current scope, and add no redundant Google host, `nativeMessaging`, filesystem, identity, or broader permission.
- Documentation matches actual UI, quota behavior, threat model, and recommendation semantics.

## Architecture

Verification layers:

1. Pure unit tests: validation, normalization, ranking, LRU/TTL, title cleanup, queue resolution, safe rendering.
2. Component/service tests: fake Chrome storage/runtime/tabs/fetch; MV3 suspension/restart simulations.
3. Existing VM regressions: content script and mini-player controls.
4. Manual unpacked Chrome matrix: real extension pages, provider tabs, API errors, navigation, restart.
5. Security/release audit: secret scan, permissions, CSP, package contents, documentation truthfulness.

Documentation sources of truth:

- `README.md`: install, BYOK setup, session/local warning, search and Similar behavior, quota troubleshooting.
- `docs/project-changelog.md`: implemented feature/fix record.
- `docs/development-roadmap.md`: phase completion and deferred backend/native/DOM experiment.
- `docs/system-architecture.md`: trusted/background/content data flow and contracts.
- `docs/code-standards.md`: secret handling, safe rendering, module size, tests.

Update those `docs/*` files when present; create missing required files only in this documentation phase after reading any existing root equivalents. Do not duplicate contradictory changelogs.

## Related Code Files

### Modify

- `manifest.json` and all touched entry/modules — integration corrections only.
- `tests/content-script-mini-player.test.js` — maintain current regression coverage.
- `README.md` — verified setup/security/quota/behavior guide.
- Existing `docs/project-changelog.md`, `docs/development-roadmap.md`, `docs/system-architecture.md`, `docs/code-standards.md` when present.
- Root `project-changelog.md` only if it is the repository's canonical current changelog.

### Create

- Missing focused tests from Phases 1-4.
- Missing required `docs/*.md` files only after reconciling current documentation conventions.
- `docs/manual-chrome-validation.md` — reproducible unpacked-extension matrix with placeholder-only key instructions.

### Delete

- Obsolete duplicate documentation only if a canonical replacement and references are verified; otherwise delete nothing.

## Implementation Steps

1. Run baseline and full Node tests; fix product code rather than weakening assertions, skipping failures, or using live services.
2. Add background integration tests with fake `chrome.runtime`, storage, tabs, and fetch. Simulate service-worker restart/suspension, storage failures, timeout, quota, malformed payload, and concurrent submits.
3. Add popup/options tests for keyboard tabs/results, status announcements, query preservation, no key echo, explicit Similar action, and safe `textContent` rendering.
4. Add routing/queue regressions for explicit playlist priority, native fallback, exact selected `videoId`, multiple target tabs, navigation refresh, and existing Next/Previous.
5. Run JSON parsing and `node --check`/equivalent syntax validation over every script; assert touched JS/CSS file-size policy and every context's declared load order.
6. Run a secret scan across tracked/untracked package inputs for Google key patterns, credential headers, `.env`, secret JSON/text, logs, and fixtures. Inspect the packed/unpacked artifact separately from `.gitignore`.
7. Review manifest permissions/CSP and prove the fixed Google API origin works under existing `<all_urls>`. Record optional-host redesign as separate product work rather than partially narrowing the current any-site feature.
8. Execute the manual unpacked Chrome matrix with a user-owned restricted key; record browser/version, expected/actual, API call counts, and failures without recording the key.
9. Verify Google Cloud restrictions and quota/error messages. Do not state that extension-referrer restriction works until the live check succeeds.
10. Update README and canonical project docs from verified results. Explicitly document session loss, non-encrypted persistence, BYOK restriction/rotation, submit-only quota, Similar-vs-Up-next, and deferred paths.
11. Run a final code review focused on secret leakage, exact-origin sender authorization (including tab-hosted Options), exact provider hosts, unsafe DOM sinks, cold-worker routing, stale queue responses, quota amplification, and policy wording.
12. Re-run all automated/manual critical checks; update phase/roadmap/changelog status only when no required failure remains.

## Todo List

- [x] Record passing unit/regression fixtures without live API traffic.
- [x] Validate syntax, manifest, CSP/host coverage, and focused-module policy.
- [ ] Complete package-input inspection in addition to the completed source/fixture and permission audits.
- [ ] Complete the unpacked Chrome/provider/restart/multi-tab matrix.
- [ ] Verify live quota/error behavior and key-restriction guidance.
- [x] Update canonical required docs and manual validation guide.
- [x] Complete code review/runtime-audit follow-ups; re-run the full suite after any release-gate change.

## Success Criteria

- [x] Recorded fixtures/fake-fetch checks pass without a real credential or live quota.
- [ ] Manual Chrome checks pass for key lifecycle, Control/Search, freeplay, playlists, native controls, and multiple tabs.
- [ ] Confirm live request counts match submit/cache and Find similar behavior.
- [ ] Inspect package artifacts and complete the final secret scan; source/fixture scan currently passes.
- [x] Permissions/CSP/host coverage are reviewed, and focused touched modules comply with the 200-line policy.
- [x] `<all_urls>` remains explicitly justified; no redundant Google host permission is presented as hardening.
- [x] README and canonical docs distinguish secure handling from true secrecy and Similar from personalized Up next.
- [x] Deferred Native Messaging/backend/DOM scraping work is recorded without partial shipment.

## Risk Assessment

- High: manual tests can accidentally expose a key. Use a restricted disposable user key, never screenshots/log capture of credentials, then rotate if needed.
- High: live YouTube layout/account state makes validation flaky. Separate deterministic tests from a recorded manual compatibility matrix.
- Medium: permission narrowing can regress Spotify/other sites. Test all existing providers before changing `<all_urls>`.
- Medium: duplicate root/docs changelogs can diverge. Establish one canonical location and cross-link or migrate deliberately.

## Security Considerations

- Verify sender trust at every secret/search mutation entry, not only in UI.
- Audit all DOM sinks and constructed URLs; API/page text remains untrusted after normalization.
- Inspect Chrome package inputs because `.gitignore` does not prevent packaging.
- Never add a fake/hardcoded key to make tests pass; any manual key belongs only in the user's running profile and should be restricted/rotated.

## Next Steps

- If approved, implement with `/ck:cook` from this plan and stop at any failed security/regression gate.
- After stable personal/BYOK use, decide separately between a public authenticated backend or continued per-user setup.
- Treat a private DOM-recommendation experiment as a new policy-reviewed plan, not a hidden extension of this MVP.
