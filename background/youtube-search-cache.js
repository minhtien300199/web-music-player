(function(global) {
  'use strict';

  const KEY = 'youtubeSearchCache';
  const TTL = 24 * 60 * 60 * 1000;
  const MAX = 30;

  async function get(cacheKey) {
    const entries = (await chrome.storage.session.get(KEY))[KEY] || [];
    const match = entries.find((entry) => entry.key === cacheKey && Date.now() - entry.at < TTL);
    return match?.value || null;
  }

  async function set(cacheKey, value) {
    const entries = (await chrome.storage.session.get(KEY))[KEY] || [];
    const filtered = entries.filter((entry) => entry.key !== cacheKey && Date.now() - entry.at < TTL);
    filtered.unshift({ key: cacheKey, value, at: Date.now() });
    await chrome.storage.session.set({ [KEY]: filtered.slice(0, MAX) });
  }

  async function clear() { await chrome.storage.session.remove(KEY); }
  global.MusicControlSearchCache = Object.freeze({ get, set, clear });
})(globalThis);
