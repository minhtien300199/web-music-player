# Code standards

## Scope and style

- Keep JavaScript modules focused and normally below 200 lines. Split by responsibility rather than making a general utility module.
- Use descriptive kebab-case file names for JavaScript and Markdown.
- Use plain JavaScript, strict mode and small functions. Prefer early validation and explicit result objects over implicit cross-context behaviour.
- Keep implementation YAGNI/KISS/DRY: do not add filesystem access, native messaging, backend accounts or an abstraction without an active requirement.

## Extension boundaries

- Define cross-context action names and input validation in `shared/message-contracts.js`.
- Treat popup, options, background and content scripts as separate contexts. Do not rely on shared in-memory state across them.
- Put privileged work (credentials, external fetches, tab creation/navigation) in the background service worker.
- Content scripts must not receive a saved API key or make YouTube API calls.
- Validate sender/action before storage mutation or search. Handle MV3 service-worker restart and stale tab/URL state.

## Secrets and privacy

- Never add actual keys, OAuth tokens, passwords or credential-bearing fixtures to the repository, issue text, logs, screenshots or package artifact.
- `.env` files are ignored but are not a safe runtime configuration or packaging guarantee; inspect the actual unpacked/packed inputs before release.
- Default to `chrome.storage.session` for user-provided API keys. If persistent `chrome.storage.local` is offered, label it clearly as not encrypted and provide a clear/forget action.
- Do not put a key in a query string. Keep it out of DOM text, error messages and normal runtime responses.
- Do not claim browser storage, a local file path or `.gitignore` provides true secrecy. OS credential vault support requires a separately reviewed native-messaging design.

## UI and provider data

- Treat titles, channels, thumbnails and scraped DOM values as untrusted input.
- Render user/provider text with `textContent` and DOM creation; do not use `innerHTML` for search/queue result data.
- Make network work explicit: Search fetches only on form submit. YouTube All import is an explicit DOM snapshot and must not trigger network fetching from popup open, typing, polling or tab switches.
- Policy-sensitive DOM integrations must be default-off, explicitly user-triggered, bounded and isolated behind an adapter/kill switch.
- For YouTube All, accept only verified English `All` and Vietnamese `Tất cả` labels in the selected first chip. Unknown locales/labels fail closed; never infer All from position alone.
- Imported snapshots must remain in `chrome.storage.session`, omit thumbnails, cap item count/text lengths and bind to active tab/document/surface revision.
- Remove means dismiss from extension state only. Do not imply mutation of provider recommendations, history, playlists or account data.
- Imported queues must not intercept or redefine native Next/Previous.

## Seek controls

- Pointer seek previews during drag and commits exactly once on successful release; cancel/lost capture restores authoritative time without a commit.
- Keyboard slider controls use ±5 seconds for Arrow keys, ±30 seconds for Page keys, and media bounds for Home/End.
- Clamp every seek to finite media duration. Disable/no-op when duration is missing, infinite or non-positive.
- Keep ARIA value/disabled state synchronized and dispose listeners/polling on popup lifecycle end.

## Testing and release checks

- Add deterministic Node tests for validation, ranking, storage lifecycle, cache/TTL, routing and regressions. Fake Chrome/fetch dependencies; no live API key or quota use in tests.
- Run `node --test tests/*.test.js` and syntax/manifest checks after changes.
- Manually verify Chrome lifecycle, multiple tabs, explicit playlist, YouTube All import/remove, native Next/Previous, popup seek and key mode reset using [manual-chrome-validation.md](manual-chrome-validation.md).
- Keep experimental YouTube All default-off until the versioned release checklist records policy/disclosure approval and a passed live Chrome matrix.
- Fix failing product behaviour rather than weakening tests or bypassing checks.
