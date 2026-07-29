# UI/UX Review — Popup Search & API Key Controls

## Scope and design direction

Keep the existing dark, compact player shell. Add one top-level `Control | Search` tab strip below the current header; do not duplicate or re-layout the player controls. The Control panel retains the current now-playing, transport, volume, queue, and status regions. Search owns its own form/status/results region so failures never displace or disable playback.

References: `popup.html:11-73`, `popup.css:7-17`, `popup.js:110-130`, `phase-03-search-experience.md:41-46`, `phase-04-freeplay-recommendations.md:41-46`.

## Recommended popup DOM and interaction contract

```html
<div class="popup-tabs" role="tablist" aria-label="Music Control views">
  <button id="control-tab" role="tab" aria-selected="true"
          aria-controls="control-panel" tabindex="0">Control</button>
  <button id="search-tab" role="tab" aria-selected="false"
          aria-controls="search-panel" tabindex="-1">Search</button>
</div>

<section id="control-panel" role="tabpanel" aria-labelledby="control-tab">
  <!-- retain existing player/queue markup -->
</section>
<section id="search-panel" role="tabpanel" aria-labelledby="search-tab" hidden>
  <form id="youtube-search-form" novalidate>
    <label for="youtube-search-query">Search YouTube</label>
    <div class="search-field-row">
      <input id="youtube-search-query" name="youtube-search-query" type="search"
             autocomplete="off" spellcheck="false" maxlength="…">
      <button type="submit">Search</button>
    </div>
    <p id="search-quota-note">Search runs only when you select Search; cached results may be reused for up to 24 hours.</p>
  </form>
  <p id="search-status" role="status" aria-live="polite"></p>
  <div id="search-results" aria-describedby="search-status"></div>
</section>
```

- Tab behavior: arrow Left/Right (and Home/End) moves tab focus; Enter/Space activates; activate updates `aria-selected`, `tabindex`, panel `hidden`, and the session-restored selected tab. On mouse activation, leave focus on the clicked tab. Do not autofocus the search field merely because the popup opened; focus it only after the user activates Search with the keyboard. This meets the planned keyboard requirement without stealing focus from Control. `phase-03-search-experience.md:41-46,107-108`.
- Keep the popup at its current 320 px minimum/maximum width; use an 8 px gap, 12 px panel padding, and result rows that can wrap text. Give results a bounded vertical area (about 260 px) with one scroll container; do not create nested scrolling inside an individual result. `popup.css:7-17,250-269`.
- Results should be native `<button type="button" class="search-result">` elements (not clickable `div`s). Each button contains a decorative thumbnail (`alt=""`), title, channel, and optional visible `App suggestion` badge. Make the whole row one target and keep 44 px minimum height. Long title/channel content must use `min-width: 0` plus two-line clamp/ellipsis rather than pushing the popup wide. `popup.js:134-152`, `phase-03-search-experience.md:44,109`.
- On result activation, retain visible selection/focus until navigation confirms or fails. Disable only the selected row while routing; do not disable every Control button. A failed route restores its enabled state and announces a recovery message. `phase-03-search-experience.md:46,111`.

## Search state labels and safe recovery

Use text, icon, and semantic status—not color alone. Put the status immediately above results; `role="status" aria-live="polite"` for normal/loading/cache transitions and `role="alert"` only for an actionable blocking form error. Do not put the main playback footer status inside Search; it currently represents media state. `popup.html:70-73`, `popup.js:33-36,110-130`.

| State | Visible label and action | Control impact |
|---|---|---|
| No key | “Add a YouTube API key to search.” + `Open settings` button/link | None |
| Idle | “Search YouTube by title, artist, or video.” | None |
| Loading | “Searching YouTube…”; submit button disabled with “Searching…” | None |
| Cached | “Showing cached results from this session.” | None |
| No results | “No videos found. Try a different title or artist.” | None |
| Invalid/restricted | “This API key cannot use YouTube search. Check key restrictions, then test or replace it.” + `Open settings` | None |
| API disabled | “Enable YouTube Data API v3 for this key, then try again.” + `Open settings` | None |
| Quota | “Search quota is unavailable right now. Try again later or use cached results.” | None |
| Timeout/network | “Couldn’t reach YouTube. Check your connection and try again.” + `Try again` | None |
| Playback unavailable | “This video could not be opened. Choose another result or open YouTube directly.” | None |

Never preserve raw API error text, key fragments, request URLs, or a candidate key in a status. Retain the typed query after a recoverable Search error, but clear it after navigation only if that matches the product decision; a popup close naturally ends in-memory UI state. `phase-02-secure-api-key-storage.md:48-50,69`, `phase-03-search-experience.md:106,148-149`.

## Queue/freeplay wording

- When an explicit provider playlist exists: heading `Playlist`; preserve the original rows and active item unchanged.
- When no explicit list exists: heading `No queue`; text `YouTube will choose the next video.` Keep the existing `Next` control available; call it `Next`, never `Up next`.
- Offer `Find similar` only when usable current YouTube metadata exists. Secondary helper: `Searches YouTube once; results are not personalized.`
- After an explicit request: heading `Similar on YouTube`; helper: `Suggestions based on this video — not personalized Up next.` Do not use “recommended”, “Up next”, or a highlighted first item that implies automatic playback.
- If Similar cannot run/fails: restore the `No queue`/native Next presentation and show the error adjacent to the `Find similar` control. Do not replace or hide Next.

This wording implements the source distinction in `phase-04-freeplay-recommendations.md:28,41-46,60-76,127-133` while preserving the existing playlist/player surface in `popup.html:30-68`.

## Options API-key controls

Add a separate `YouTube Search` settings section before the generic Save Settings row, using a `<fieldset>`/`<legend>` so the credential controls remain semantically grouped. Do not merge credential persistence into existing media-source checkboxes. `options.html:15-75`, `phase-02-secure-api-key-storage.md:40-45,73-77`.

Recommended structure:

```html
<fieldset class="settings-section credential-section">
  <legend>YouTube Search API key</legend>
  <p id="key-status" role="status" aria-live="polite">Not configured</p>
  <label for="youtube-api-key">API key</label>
  <input id="youtube-api-key" type="password" name="youtube-api-key"
         autocomplete="off" spellcheck="false" aria-describedby="key-storage-note key-status">
  <p id="key-storage-note">For this session only by default. It is cleared when Chrome or the extension restarts.</p>
  <label class="persistence-choice"><input type="radio" name="key-persistence" value="session" checked> Use for this session</label>
  <label class="persistence-choice"><input type="radio" name="key-persistence" value="local"> Remember on this device — not encrypted</label>
  <p class="warning">Browser storage reduces accidental exposure; it is not a secret vault.</p>
  <div class="credential-actions">
    <button type="button" id="test-key">Test key</button>
    <button type="button" id="save-key">Save API key</button>
    <button type="button" id="forget-key">Forget key & search data</button>
  </div>
</fieldset>
```

- Entry rules: `type="password"`, `autocomplete="off"`, `spellcheck="false"`; never refill, reveal, suffix, fingerprint, or describe a stored key. Clear the field immediately after Test/Save regardless of outcome. `phase-02-secure-api-key-storage.md:40-45,99-100,119-123`.
- Status vocabulary: `Not configured`; `Configured for this session`; `Remembered on this device — not encrypted`; `Testing key…`; `Key works`; plus the safe distinct error categories from Phase 2. All save/test errors belong beneath the field; on submit failure move focus to the field, not a transient toast. `phase-02-secure-api-key-storage.md:50,98-104`.
- Make “Use for this session” the checked default and visually primary. On selecting local mode, reveal/retain the inline warning directly under the radio group; do not hide it behind a tooltip. The user must read the browser restart consequence next to the session option and the unencrypted disclosure next to local. `phase-02-secure-api-key-storage.md:27,116-120,126-138`.
- “Test key” must say `Tests access and uses a small amount of API quota.` Disable it only after an async test begins, show `Testing key…`, then restore focus to the triggering button when complete. Keep `Save API key` separate from Test: an invalid test must not replace an already working configuration. `phase-02-secure-api-key-storage.md:98,130-131`.
- `Forget key & search data` is destructive: use danger styling, a confirmation dialog that names both effects, then announce `Key and search data cleared.` Its label must not promise recovery. `phase-02-secure-api-key-storage.md:66-67,102,123`.

## Baseline accessibility remediation to preserve

- Current icon-only transport/settings controls have `title` but no accessible names; new work should establish an `aria-label` pattern for all of them and mark decorative icon spans `aria-hidden="true"`. `popup.html:32-46,72`.
- Replace/avoid `outline: none` on the range input; add a high-contrast `:focus-visible` indicator to tabs, buttons, radio/checkbox labels, range input, search input, and result buttons. Existing controls use `transition: all`; limit transitions to `transform`, `background-color`, `box-shadow`, and `opacity`, and disable/reduce them under `prefers-reduced-motion`. `popup.css:125-142,210-218`, `options.css:64,82,137`.
- Do not make the progress bar, volume icon, or playlist rows the keyboard model for new UI: they are click-only `div`/`span` surfaces today. Search results and new actions must use real buttons; this keeps the change scoped and avoids destabilizing the player while setting the correct pattern. `popup.html:23-25,49-50,65-67`, `popup.js:137-152,208-223,245-256`.
- Existing custom checkboxes are `display:none`, removing keyboard focus. For API persistence radios, visually hide only with a focusable clip technique or use native controls; ensure the visible choice gets a `:focus-within` outline. `options.css:72-105`.

## Unresolved questions

1. Should the existing generic `Save Settings` button remain separate from API-key actions (recommended), or is a single explicit settings save desired? The plan describes credential actions as independent state operations.
2. Is `Clear Search Data` exposed in Search, Options, or both? Keep it separate from `Forget key & search data` if users should clear history/cache without deleting a key.
3. Should Search thumbnails ship in the compact popup? If yes, reserve a fixed small box and use `alt=""`; if no, text-only rows give more space and avoid visual loading noise.
