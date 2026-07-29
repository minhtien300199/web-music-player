# Secure local handling of a YouTube Data API key

## Conclusion

A Manifest V3 extension cannot make a long-lived API key truly secret on the client. A user, malware with profile access, DevTools, or compromised extension code can eventually recover any key the extension itself can use. The realistic goal is to prevent accidental Git/log/sync/page leakage and reduce damage if the key is copied.

For this personal unpacked extension, use a BYOK design:

1. Default to `chrome.storage.session`; user enters the key once per browser session.
2. Offer an explicit **Remember on this device (less secure)** option backed by `chrome.storage.local`, accessible only to trusted extension contexts.
3. Make all YouTube API calls in the service worker. Never send the key to a content script, popup DOM, page script, or tab message.
4. Restrict the key to **YouTube Data API v3**, monitor quota, and rotate it.
5. For a public release with one shared project key, put the key behind an authenticated, rate-limited backend; do not ship it in the extension.

## Threat model

Protected against:

- accidental commit/package inclusion;
- Chrome Sync copying the key to other devices;
- hostile web pages reading a key through content-script code or messages;
- routine logs, screenshots, and URL/history leakage.

Not protected against:

- local administrator/malware or theft of the Chrome profile;
- a compromised extension update or malicious trusted extension page;
- a user intentionally inspecting the running extension;
- abuse after an attacker has copied the bearer key.

Client-side encryption with a hardcoded/decryptable key does not improve this model. Passphrase encryption only helps at rest and requires the passphrase again after restart. OS-backed protection requires native code.

## Option comparison

| Option | Persistence | Security/UX assessment | Verdict |
|---|---|---|---|
| `chrome.storage.session` | Cleared on browser restart, extension reload/update/disable | In-memory; not exposed to content scripts by default. Best browser-only boundary, but user re-enters key | **Default** |
| `chrome.storage.local` | Until extension uninstall | Convenient, but inspectable through DevTools/profile access. It is exposed to content scripts by default unless `setAccessLevel()` is used | **Optional convenience** |
| Ignored file inside unpacked extension | Until file deletion | `.gitignore` prevents Git commits only. File remains plaintext and can be accidentally included when packing/copying the extension | **Do not recommend** |
| Arbitrary path/file picker | File persists; permission may not | Browser cannot silently read a path such as `%LOCALAPPDATA%\WebMusicPlayer\key.txt`. File System Access requires a user gesture and a granted handle; plaintext file adds awkward UX without a stronger runtime boundary | **No benefit over session storage** |
| Native Messaging + OS keychain | Persistent | Host can use Windows Credential Manager/macOS Keychain/Secret Service. Safest if host proxies API calls so the key never enters JS, but requires installer, native host manifest/registry setup, and `nativeMessaging` | **Only for higher-security local distribution** |

Chrome explicitly recommends `storage.session` for sensitive data. It also documents that `storage.local` is exposed to content scripts by default and that storage can be inspected/edited in DevTools: [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

The file picker requires a secure context and user gesture: [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access). Native Messaging is only callable from extension pages/service workers and requires a registered host: [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).

## Important implication for this repository

`manifest.json` injects `content-script.js` on `<all_urls>`, and that script currently reads general settings from `chrome.storage.local`. Adding the API key to the same area without changing its access level would expose it to every content-script context.

If persistent local storage is implemented, first call:

```js
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
```

Then deliver only non-secret settings to content scripts through narrowly validated service-worker messages, or migrate those settings to a separate non-secret storage area. Access level applies to the storage area, not an individual key.

`chrome.storage.session` already defaults to trusted contexts, so it avoids that migration for the recommended default.

## Proposed user experience

- Put credential setup in Options, not the popup Search tab.
- Input type `password`; never render the full saved value after Save.
- Actions: **Use for this browser session**, **Remember on this device**, **Test key**, **Replace**, and **Forget**.
- Display only `Configured ••••ABCD` or a short SHA-256 fingerprint.
- Explain that “Remember” is local convenience, not encryption.
- On missing/invalid key, Search links directly to Options and preserves the user's query.
- Validate by trimming whitespace and making one low-cost metadata request. Treat prefix/length checks as hints only; accept Google format changes.
- Distinguish invalid key, API disabled, quota exhausted, and network errors without exposing response URLs containing credentials.

## Request and key hardening

- Send the key using the `x-goog-api-key` header, not a query parameter, to
  prevent URL/log/history leakage. Google recommends this:
  [API key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices).
- Restrict the key to YouTube Data API v3. Google recommends both API and client
  restrictions:
  [API key restrictions](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys).
- Official browser restrictions are defined in terms of HTTP referrers. An exact
  `chrome-extension://<stable-extension-id>/*` restriction should be tested
  end-to-end before relying on it; official documentation does not guarantee
  that scheme for every Google API/request context.
- Keep the request in the service worker and grant only the Google API host
  needed by search. Do not proxy the key through YouTube page content scripts.
- Validate every message from content scripts; Chrome treats them as less
  trustworthy:
  [Chrome messaging security](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#security-considerations).

## Rotation and logging

- Options should support atomic replacement: test new key, save it, then forget
  the old local/session value.
- Tell the user to revoke/delete the old key in Google Cloud after replacement.
- Recommend periodic rotation and quota alerts; Google explicitly recommends
  monitoring, isolation, and rotation.
- Never log the key, request headers, full request URL, storage objects, or raw
  fetch configuration.
- Centralize redaction for `key`, `apiKey`, `x-goog-api-key`, and `AIza...`
  patterns. Production errors should contain status, reason code, and request ID
  only.

## `.gitignore` requirements

Current `.gitignore` already ignores `.env`, `.env.*`, and `*.pem`. Add patterns
only if a local-file fallback is deliberately supported, for example:

```gitignore
secrets/
*.secret.json
youtube-api-key.txt
```

Keep a committed `.env.example` with placeholders only. Also exclude local
secret files from extension packaging; `.gitignore` does not control what Chrome
packs.

## Public-release path

Choose one:

1. **BYOK:** each user supplies a restricted YouTube key; keep the session/local
   UX and disclosure above. Simple and no shared quota, but setup friction.
2. **Backend proxy:** backend owns the shared key; extension authenticates users
   and sends search queries only. Backend adds credentials, caches normalized
   queries, enforces per-user/IP/device rate limits, daily budgets, abuse
   detection, and response-size limits. This is the correct path when users
   should not manage keys.

Do not trust CORS or the extension ID alone as backend authentication; requests
can be replayed outside Chrome. Do not replace the YouTube API key with a
long-lived shared “backend secret” embedded in the extension.

## Unresolved questions

- Should the product optimize for zero setup (backend) or remain personal/BYOK?
- Is re-entering the key after every Chrome restart acceptable as the default?
- Will the extension keep its current broad `<all_urls>` permission, or narrow
  host access as part of the search work?
- Does the exact stable extension ID work with Google browser-key restrictions
  for the chosen YouTube API endpoint in a live test?
