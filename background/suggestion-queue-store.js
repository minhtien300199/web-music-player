(function(global) {
  'use strict';

  const KEY = 'youtubeAllSuggestionQueue';
  const MAX_ITEMS = 20;
  let chain = Promise.resolve();
  const serial = (work) => {
    const next = chain.then(work, work);
    chain = next.catch(() => {});
    return next;
  };
  const read = async () => (await chrome.storage.session.get(KEY))[KEY] || null;
  const write = async (state) => {
    if (state) await chrome.storage.session.set({ [KEY]: state });
    else await chrome.storage.session.remove(KEY);
    return state;
  };
  const validState = (state) => state && state.expiresAt > Date.now();
  const publicValue = (state) => ({
    source: 'youtube-all',
    label: 'Visible on YouTube — All',
    items: state.items.filter((item) => !state.dismissedIds.includes(item.videoId))
  });

  async function getForTab(tabId) {
    return serial(async () => {
      const state = await read();
      if (!validState(state)) { if (state) await write(null); return null; }
      return state.sourceTabId === tabId ? publicValue(state) : null;
    });
  }
  async function save(snapshot) {
    return serial(async () => {
      const previous = await read();
      const sameSurface = validState(previous) && previous.sourceTabId === snapshot.sourceTabId &&
        previous.sourceDocumentNonce === snapshot.sourceDocumentNonce && previous.sourceRevision === snapshot.sourceRevision;
      const dismissedIds = sameSurface ? previous.dismissedIds : [];
      const state = {
        queueId: `${snapshot.sourceTabId}:${Date.now()}`,
        sourceTabId: snapshot.sourceTabId,
        sourceDocumentNonce: snapshot.sourceDocumentNonce,
        sourceRevision: snapshot.sourceRevision,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        dismissedIds,
        pendingNavigationVideoId: null,
        activeDocumentNonce: snapshot.sourceDocumentNonce,
        items: snapshot.items.slice(0, MAX_ITEMS)
      };
      await write(state);
      return publicValue(state);
    });
  }
  async function dismiss(tabId, videoId) {
    return serial(async () => {
      const state = await read();
      if (!validState(state) || state.sourceTabId !== tabId) return null;
      if (!state.dismissedIds.includes(videoId)) state.dismissedIds.push(videoId);
      await write(state);
      return publicValue(state);
    });
  }
  async function markPlayback(tabId, videoId) {
    return serial(async () => {
      const state = await read();
      if (!validState(state) || state.sourceTabId !== tabId || !state.items.some((item) => item.videoId === videoId)) return false;
      state.pendingNavigationVideoId = videoId;
      await write(state);
      return true;
    });
  }
  async function handleNavigation(tabId, url) {
    return serial(async () => {
      const state = await read();
      if (!state || state.sourceTabId !== tabId) return;
      let videoId = null;
      try { videoId = new URL(url || '').searchParams.get('v'); } catch (_) {}
      if (videoId && videoId === state.pendingNavigationVideoId) {
        await write(state);
      } else {
        await write(null);
      }
    });
  }
  async function handleDocument(tabId, documentNonce, videoId) {
    return serial(async () => {
      const state = await read();
      if (!state || state.sourceTabId !== tabId || documentNonce === state.activeDocumentNonce) return;
      if (videoId && videoId === state.pendingNavigationVideoId) {
        state.activeDocumentNonce = documentNonce;
        state.pendingNavigationVideoId = null;
        await write(state);
      } else {
        await write(null);
      }
    });
  }
  async function clearTab(tabId) {
    return serial(async () => {
      const state = await read();
      if (state?.sourceTabId === tabId) await write(null);
    });
  }
  async function clearAll() { return serial(() => write(null)); }

  global.MusicControlSuggestionQueue = Object.freeze({ getForTab, save, dismiss, markPlayback, handleNavigation, handleDocument, clearTab, clearAll });
})(globalThis);
