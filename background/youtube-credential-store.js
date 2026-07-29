(function(global) {
  'use strict';

  const KEY = 'youtubeApiKey';
  const META = 'youtubeCredentialMeta';
  let mutation = Promise.resolve();

  async function status() {
    const meta = (await chrome.storage.local.get(META))[META];
    if (!meta?.activeMode) return { configured: false, persistence: null };
    const values = await chrome.storage[meta.activeMode].get(KEY);
    return { configured: typeof values[KEY] === 'string' && values[KEY].length > 0, persistence: meta.activeMode };
  }

  async function getKey() {
    const meta = (await chrome.storage.local.get(META))[META];
    if (!meta?.activeMode) return null;
    const value = (await chrome.storage[meta.activeMode].get(KEY))[KEY];
    return typeof value === 'string' && value ? value : null;
  }

  function replace(candidate, persistence) {
    mutation = mutation.then(async () => {
      const mode = persistence === 'local' ? 'local' : 'session';
      const current = (await chrome.storage.local.get(META))[META];
      const generation = (current?.generation || 0) + 1;
      await chrome.storage[mode].set({ [KEY]: candidate });
      const verified = (await chrome.storage[mode].get(KEY))[KEY] === candidate;
      if (!verified) throw new Error('Credential storage verification failed.');
      await chrome.storage.local.set({ [META]: { activeMode: mode, generation } });
      const otherMode = mode === 'local' ? 'session' : 'local';
      try { await chrome.storage[otherMode].remove(KEY); } catch (_) {}
      return status();
    });
    return mutation;
  }

  function clear() {
    mutation = mutation.then(async () => {
      await Promise.all([chrome.storage.session.remove(KEY), chrome.storage.local.remove(KEY)]);
      await chrome.storage.local.remove(META);
      return { configured: false, persistence: null };
    });
    return mutation;
  }

  global.MusicControlCredentials = Object.freeze({ status, getKey, replace, clear });
})(globalThis);
