(function(global) {
  'use strict';

  const { boundedText, validVideo } = MusicControlContracts;
  const MAX_ITEMS = 20;
  const ALL_LABELS = new Set(['all', 'tất cả']);
  const documentNonce = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let enabled = false;
  const youtube = () => location.hostname === 'youtube.com' || location.hostname.endsWith('.youtube.com');
  const visible = (node) => Boolean(node) && !node.hidden && node.getAttribute?.('aria-hidden') !== 'true' &&
    (!node.getClientRects || node.getClientRects().length > 0);
  const watchId = (href) => {
    try {
      const url = new URL(href, location.href);
      return url.pathname === '/watch' && validVideo(url.searchParams.get('v')) ? url.searchParams.get('v') : null;
    } catch (_) { return null; }
  };
  const surface = () => {
    const homeScope = document.querySelector('ytd-browse[page-subtype="home"]');
    const home = homeScope?.querySelector?.('ytd-rich-grid-renderer #contents, #contents');
    if (visible(homeScope) && visible(home)) return { kind: 'home', root: home, scope: homeScope };
    const watchScope = document.querySelector('#secondary');
    const watch = watchScope?.querySelector?.('ytd-watch-next-secondary-results-renderer #items, #related');
    return visible(watchScope) && visible(watch) ? { kind: 'watch', root: watch, scope: watchScope } : null;
  };
  const selectedChip = (scope) => {
    const selected = scope?.querySelector?.(
      'yt-chip-cloud-chip-renderer[aria-selected="true"], yt-chip-cloud-chip-renderer[selected], #chips button[aria-pressed="true"]'
    );
    return selected?.closest?.('yt-chip-cloud-chip-renderer') || selected;
  };
  const chipIdentity = (chip) => {
    const parent = chip?.parentElement;
    const siblings = parent ? [...parent.children].filter((node) => visible(node) && node.tagName === chip.tagName) : [];
    return { index: siblings.indexOf(chip), text: boundedText(chip?.textContent || '', 40) };
  };
  const isAllChip = (identity) => identity.index === 0 && ALL_LABELS.has(identity.text.toLocaleLowerCase());
  const rootIdentity = (value) => boundedText(`${value?.tagName || ''}#${value?.id || ''}.${value?.className || ''}`, 160);
  const fingerprint = (root) => [...root.querySelectorAll('a[href*="/watch?v="]')]
    .filter(visible).slice(0, 24).map((anchor) => watchId(anchor.href)).filter(Boolean).join(',');
  const snapshot = (value, chip) => ({
    route: `${location.pathname}${location.search}`,
    root: rootIdentity(value.root),
    chip: chipIdentity(chip),
    cards: fingerprint(value.root)
  });
  const sameSnapshot = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const excluded = (anchor) => Boolean(anchor.closest?.(
    'ytd-ad-slot-renderer, ytd-promoted-video-renderer, ytd-reel-item-renderer, [is-shorts], [hidden]'
  ));
  const itemFrom = (anchor) => {
    const videoId = watchId(anchor.href);
    if (!videoId || excluded(anchor)) return null;
    const row = anchor.closest?.('ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-video-renderer') || anchor.parentElement;
    const title = boundedText(
      row?.querySelector?.('#video-title, #video-title-link, a#video-title-link')?.textContent || anchor.title || anchor.textContent || '',
      160
    );
    if (!title) return null;
    const artist = boundedText(row?.querySelector?.('#channel-name a, ytd-channel-name a, .ytd-channel-name')?.textContent || '', 100);
    return { id: videoId, videoId, source: 'youtube-all', title, artist, active: false, playTarget: { kind: 'youtube-video', videoId } };
  };

  function extract() {
    if (!enabled) return { status: 'disabled', documentNonce, items: [] };
    if (!youtube()) return { status: 'unsupported', documentNonce, items: [] };
    const value = surface();
    if (!value) return { status: document.readyState === 'loading' ? 'loading' : 'unsupported', documentNonce, items: [] };
    const chip = selectedChip(value.scope);
    const chipState = chipIdentity(chip);
    if (!chip || !isAllChip(chipState)) return { status: 'non-all', documentNonce, items: [] };
    const before = snapshot(value, chip);
    const currentVideoId = watchId(location.href);
    const seen = new Set();
    const items = [];
    for (const anchor of value.root.querySelectorAll('a[href*="/watch?v="]')) {
      if (!visible(anchor)) continue;
      const item = itemFrom(anchor);
      if (!item || item.videoId === currentVideoId || seen.has(item.videoId)) continue;
      seen.add(item.videoId); items.push(item);
      if (items.length === MAX_ITEMS) break;
    }
    const after = snapshot(value, selectedChip(value.scope));
    if (!sameSnapshot(before, after)) return { status: 'stale', documentNonce, items: [] };
    return {
      status: items.length ? 'ready' : 'empty',
      documentNonce,
      sourceRevision: JSON.stringify(before),
      surface: value.kind,
      items
    };
  }

  function setEnabled(value) { enabled = value === true; }

  global.MusicControlYouTubeAllSuggestions = Object.freeze({ documentNonce, setEnabled, extract });
})(globalThis);
