---
title: YouTube personalized feed extraction feasibility
role: researcher-01
status: complete
researched_at: 2026-07-29T17:27:00+07:00
scope: Chrome MV3 extension, signed-in YouTube Home and watch-page recommendations
---

# Research: YouTube personalized feed extraction

## Contents

- [Executive recommendation](#executive-recommendation)
- [Official API versus rendered UI](#official-api-versus-rendered-ui)
- [Technical feasibility](#technical-feasibility)
- [Candidate DOM contract](#candidate-dom-contract)
- [Refresh and state behavior](#refresh-and-state-behavior)
- [Privacy and policy risk](#privacy-and-policy-risk)
- [Recommended fallback contract](#recommended-fallback-contract)
- [Implementation guardrails](#implementation-guardrails)
- [Validation matrix](#validation-matrix)
- [Sources](#sources)
- [Unresolved questions](#unresolved-questions)

## Executive recommendation

Reading already-rendered Home or watch-page cards from a YouTube content script is technically feasible. It can often reproduce the suggestions visible to the current browser session, including signed-in personalization, without OAuth or a YouTube API key.

Do **not** treat this as a stable or officially supported integration. YouTube exposes no current Data API endpoint for an authenticated user's Home feed or related-video rail. The old `activities.list?home=true` path is deprecated and reports that user Home data is unavailable; `search.list.relatedToVideoId` stopped working in 2023. DOM extraction therefore has no supported equivalent or compatibility contract.

For a public Chrome Web Store build, recommendation: keep the existing official-API `Similar` search as the production fallback and do not ship automatic YouTube DOM extraction without legal/policy review or YouTube's written permission. YouTube's general Terms prohibit automated access by scrapers except specified exceptions, and the YouTube API Developer Policies explicitly prohibit scraping YouTube Applications. Chrome Web Store policy also classifies clipped/scraped site content and browsing activity as user data even when handled locally.

Risk summary:

| Dimension | Assessment | Reason |
|---|---|---|
| Technical proof of concept | Feasible | MV3 content scripts can read the rendered DOM |
| Correct personalization | Best effort only | Visible cards reflect current session, experiments, locale, history and selected chip |
| DOM stability | Low | Private custom elements, layouts and attributes change without notice |
| Data completeness | Low to medium | Lazy loading, Shorts/shelves/ads, skeletons and infinite scroll |
| Official API substitute | No | Home and related recommendation endpoints unavailable |
| Public distribution policy | High risk | YouTube anti-scraping terms/policy; Chrome disclosure obligations |
| Private/local experiment | Lower operational exposure, not policy clearance | No external transmission reduces privacy risk but does not create permission to scrape |

## Official API versus rendered UI

### Official YouTube Data API

- Structured, documented JSON resources with API key/OAuth, quotas and policy obligations.
- Supports keyword search, video metadata, channels, playlists and subscriptions.
- Does **not** return the signed-in website's personalized Home feed.
- `activities.list.home` is deprecated. Current documentation says requests may fail with `homeParameterDeprecated` because user Home page activity data is unavailable.
- `search.list.relatedToVideoId` was removed on 2023-08-07.
- API search relevance or a query derived from the current title is generic search, not the watch page's personalized `Up next`.

Therefore the product must label existing API-derived results `Similar` or `Search results`, never `YouTube Home`, `For you`, or `Up next`.

### Rendered YouTube UI

- A content script operates as the user browses `youtube.com` and reads cards that YouTube already rendered.
- It inherits session context indirectly: account state, watch history, locale, experiments, parental/restricted settings, and the currently selected chip affect the DOM.
- It should not read cookies, credentials, page JavaScript objects, internal Innertube requests, `ytInitialData`, continuation tokens, or tracking parameters.
- The result is an observation of a transient page, not a supported API response and not guaranteed to remain personalized after collection.

**Inference:** reading a small visible snapshot is less invasive than calling undocumented internal endpoints, but it is still automated extraction under the broad wording of YouTube/Chrome policies.

## Technical feasibility

Recommended data flow if policy approval permits an experiment:

```text
YouTube tab DOM
  -> YouTube-only isolated content script
  -> normalize visible cards to minimum fields
  -> runtime message
  -> popup queue (prefer memory/session storage)
```

Chrome officially permits a content script to read and modify page DOM while its JavaScript environment remains isolated from the page. A continuous passive collector needs a YouTube match pattern such as `https://www.youtube.com/*`; `activeTab` is a lower-permission option only when extraction follows an explicit extension action/shortcut.

Prefer the user-triggered `activeTab` model for a policy experiment:

1. User opens Home or a watch page.
2. User clicks `Import visible YouTube suggestions`.
3. Extension reads only currently rendered cards.
4. Popup identifies the source as `Visible on this YouTube page`.
5. No background browsing, hidden tab, auto-scroll, chip click, or internal endpoint call.

This reduces permission and surprise, but does not resolve YouTube's anti-scraping terms.

## Candidate DOM contract

All selectors below are **observational candidates, not official interfaces**. They must be isolated behind a provider adapter, probed in order, and covered by fixture/manual tests.

### Home feed / selected `All` chip

Candidate roots:

```css
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer
ytd-browse[page-subtype="home"] #contents
```

Candidate card families:

```css
ytd-rich-item-renderer
ytd-rich-grid-media
ytd-video-renderer
yt-lockup-view-model
```

Candidate watch anchors:

```css
a#thumbnail[href*="/watch"]
a#video-title-link[href*="/watch"]
a[href^="/watch?v="]
```

Candidate chip state:

```css
yt-chip-cloud-chip-renderer[aria-selected="true"]
yt-chip-cloud-chip-renderer[selected]
```

Do not select `All` only by visible text: it is localized and may be renamed or absent. Do not click it automatically. Import the currently selected chip and preserve its visible label as optional display text. If product requirements strictly require `All`, ask the user to select it first and show a non-blocking instruction when another chip is selected.

### Watch-page recommendation rail

Candidate roots and cards:

```css
ytd-watch-next-secondary-results-renderer #items
#related ytd-watch-next-secondary-results-renderer
ytd-compact-video-renderer
yt-lockup-view-model
```

Use only anchors inside a recognized watch-next root. A page-wide `/watch?v=` query will also capture the current video, playlist, end-screen, comments and navigation links.

### Minimum normalized fields

| Field | Extraction | Notes |
|---|---|---|
| `videoId` | `new URL(anchor.href).searchParams.get("v")` | Validate `^[A-Za-z0-9_-]{11}$`; required |
| `watchUrl` | Rebuild `https://www.youtube.com/watch?v=<id>` | Drop tracking, playlist and continuation parameters unless explicitly needed |
| `title` | `#video-title`, `#video-title-link`, `title`, `aria-label`, text | Normalize whitespace; required |
| `channelName` | `ytd-channel-name a`, `#channel-name a`, nearby metadata | Optional; plain display text |
| `channelUrl` | Channel anchor | Optional; allow only YouTube channel/handle paths |
| `thumbnailUrl` | `img` current source | Optional; do not persist signed URLs longer than needed |
| `durationText` | thumbnail overlay text | Optional; raw localized display value |
| `metadataText` | visible metadata line | Optional; do not parse localized counts unless needed |
| `badges` | visible badges/overlays | Mark live, premiere, Shorts when identifiable |
| `sourceKind` | `youtube-home-visible` or `youtube-watch-next-visible` | Required provenance |
| `sourceUrl` | Page origin/path or current video ID | Avoid full tracking query |
| `observedAt` | local timestamp | Supports staleness display/expiry |
| `position` | visible DOM order | Stable only within the snapshot |

Exclude:

- ads/promoted cards, playlists/mixes unless the queue supports them explicitly;
- Shorts unless a Shorts playback contract exists;
- the currently playing video;
- duplicates by `videoId`;
- hidden, skeleton, continuation and zero-size nodes;
- account name, avatar/account menu, cookies, history lists, tracking IDs and raw page state.

**Inference:** renderer names and field selectors above reflect common YouTube web layouts; newer experiment cohorts can replace them at any time. The parser should fail closed when `videoId` or title is missing.

## Refresh and state behavior

YouTube is a single-page application. A content script loaded once may remain alive across Home -> watch -> next-video transitions. `DOMContentLoaded` alone is insufficient.

Recommended observer behavior:

- Scan at `document_idle`.
- Track `location.href` changes with a lightweight route observer; `popstate` alone misses all SPA transitions.
- Observe only the active recognized root with `MutationObserver({childList: true, subtree: true})`.
- Debounce scans 300-500 ms and coalesce bursts.
- Use a monotonically increasing page generation token so late scans cannot overwrite a newer route.
- Stop observing the old root when the route/root changes.
- Cap collection, e.g. first 20 valid visible items. Never auto-scroll to harvest more.
- Treat a chip change as a new snapshot after the DOM settles.
- For infinite scroll, append only newly visible unique IDs if the popup is open or after explicit refresh; avoid continuous background history collection.

Transient empty behavior:

1. Skeleton or root missing: report `loading`, preserve the last snapshot for a short grace period.
2. Two settled scans or 3-5 seconds with no valid cards: report `empty`.
3. Unsupported renderer/selector miss: report `unavailable`, not `empty`.
4. Route change: immediately mark old data stale, then replace on a successful scan.
5. Tab close/navigation away: discard session snapshot.

Do not silently mix suggestions from different source URLs, selected chips or account sessions.

## Signed-out, disabled-history and empty states

Avoid scraping account identity merely to decide whether the user is signed in. Infer only what the cards support:

| Observed state | UI label | Behavior |
|---|---|---|
| Valid Home cards | `Visible on YouTube Home` | Import; do not claim personalization |
| Valid watch rail | `Visible next to this video` | Import; do not claim authenticated `Up next` |
| Signed-out generic cards | Same neutral label | Allow import; results are session/region generic |
| Home prompt/no cards | `No visible Home suggestions` | Offer Search/Similar fallback |
| Watch rail loading | `Loading YouTube suggestions…` | Grace period, then fallback |
| Consent/age/restricted page | `Suggestions unavailable on this page` | Do not bypass |
| DOM shape unsupported | `YouTube page layout not supported` | Telemetry only with opt-in; fallback |
| User selects non-All chip | Include visible chip label | Import current chip or ask user to select All |

If a signed-in guarantee is a hard requirement, this technique is unsuitable: detecting account state reliably would require more unstable/private UI inspection, while personalized cards can also be absent when watch history is disabled.

## Privacy and policy risk

### YouTube

- YouTube's Terms prohibit accessing the service using automated means such as scrapers, except public-search-engine robots.txt access, prior written permission, or applicable-law permission.
- YouTube API Developer Policies separately say API clients must not directly or indirectly scrape YouTube Applications or obtain scraped YouTube data/content.
- If this extension also uses the Data API, combining API-backed features with scraped recommendations increases compliance exposure; source provenance must remain clear.

This is a product/legal decision, not merely an engineering warning. The lowest-risk public design is to omit DOM extraction unless YouTube grants permission.

### Chrome Web Store

- Website content, URLs/browsing activity and clipped/scraped content are user data.
- Local-only processing still requires accurate disclosure.
- Collection/use must be necessary for a prominently described, user-facing single purpose.
- Data use, transfer and retention must be limited to that purpose; personalized advertising or sale is prohibited.
- Host access should be limited. This feature needs YouTube access, not `<all_urls>`.

Practical minimum if approved:

- clear pre-use disclosure and affirmative user action;
- privacy policy covering visible YouTube card data, local storage and retention;
- no server transmission/analytics payload containing titles, channels, video IDs or source URLs by default;
- session-only storage where practical; explicit `Clear imported suggestions`;
- no identity, cookies, authentication data or hidden browsing-history collection;
- store listing and in-product wording that match actual behavior.

Chrome notes `storage.local`/`storage.sync` are not encrypted for confidential data; `storage.session` is memory-backed and better suited to a transient imported queue.

## Recommended fallback contract

Production priority:

1. Explicit real playlist queue, when present.
2. User-created/removable local queue.
3. Official Data API `Similar` results derived from the current title/channel, clearly labeled generic.
4. Recent explicit user search/selection history, if already consented and locally stored.
5. Native YouTube next action or an empty-state prompt.

Experimental DOM provider, only after approval/opt-in:

```text
visible DOM snapshot valid
  -> show "Visible on this YouTube page"
DOM loading
  -> brief grace period
DOM empty/unsupported/policy-disabled
  -> retain removable local queue
  -> then official "Similar"
  -> then native Next / empty prompt
```

Never block playback because suggestions failed. Never replace a non-empty user queue automatically. A DOM provider failure must not clear the current queue; it should expose a source-status message and a manual `Refresh from page` action.

## Implementation guardrails

- Hide all DOM knowledge behind one YouTube page-suggestions adapter.
- Use a selector ladder and parser per renderer family; no one giant page query.
- Prefer semantic URL parsing and visible attributes over class names.
- Restrict manifest match/host permission to `https://www.youtube.com/*` if continuous access is approved; otherwise use `activeTab` + `scripting`.
- Remain in the isolated world. Do not inject page-world code or intercept Innertube traffic.
- Rate-limit runtime messages and send normalized minimum fields only.
- Validate every URL/video ID before queue insertion.
- Add source, route generation and observed timestamp to each snapshot.
- Make all imported items removable and preserve user ordering.
- Provide a feature flag/kill switch because a YouTube rollout can break extraction instantly.
- Do not call the source `personalized` unless the application can substantiate that claim; neutral provenance is safer and more accurate.

## Validation matrix

Manual validation must cover:

- signed-in Home with `All`, another chip, infinite scroll and history disabled;
- signed-out Home with generic cards and with no feed;
- standard watch page, playlist watch page, live/premiere, Shorts, age/consent/restricted pages;
- SPA navigation Home -> watch -> next watch without full reload;
- slow network/skeletons and rail continuation loading;
- ad/promoted card exclusion;
- duplicate/current-video exclusion;
- locale other than English;
- compact/wide theater layouts and at least one alternate renderer experiment;
- extension reload/update, tab close and account switch;
- DOM failure preserving the user's existing queue and activating `Similar`.

Fixture tests should use small sanitized DOM fragments and verify normalization, exclusion, deduplication, source tagging and fail-closed behavior. They cannot prove live selector compatibility; retain a short manual Chrome test.

## Sources

Official sources consulted 2026-07-29:

- [YouTube Data API reference](https://developers.google.com/youtube/v3/docs)
- [`activities.list`: deprecated Home parameter and errors](https://developers.google.com/youtube/v3/docs/activities/list)
- [YouTube Data API revision history: related-video removal and Home/watch-history limitations](https://developers.google.com/youtube/v3/revision_history)
- [`search.list` reference](https://developers.google.com/youtube/v3/docs/search/list)
- [YouTube API Services Developer Policies, including scraping prohibition](https://developers.google.com/youtube/terms/developer-policies)
- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome `activeTab` permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome extension permission declarations](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Chrome Web Store disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)
- [Chrome Web Store Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [Chrome Web Store user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

Research method: current official documentation first; prior project research cross-check; technical DOM details clearly marked as inference because YouTube publishes no DOM contract.

## Unresolved questions

1. Is distribution private/internal or public Chrome Web Store? This changes exposure, not the underlying YouTube terms.
2. Has the project obtained YouTube's written permission for rendered-page extraction?
3. Must import be automatic, or can it require a user click using `activeTab`?
4. Is `All` mandatory, or may the extension import whichever Home chip the user selected?
5. May imported suggestion metadata persist across browser sessions, or should it remain session-only?

**Status:** DONE
**Summary:** DOM extraction can observe visible session-tailored YouTube suggestions, but it has no official API/DOM contract and carries high public-distribution policy risk. Recommend neutral labeling, explicit user-triggered import only if approved, and official `Similar` search/native Next fallbacks.
**Concerns/Blockers:** YouTube's current Terms and API Developer Policies prohibit scraping absent an exception or prior written permission; legal/policy approval is required before shipping this provider publicly.
