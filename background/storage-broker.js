(function(global) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    sources: { youtube: true, spotify: false, soundcloud: false, other: false },
    miniPlayerAllPages: true,
    youtubeAllImportEnabled: false
  });
  const SETTINGS_KEY = 'musicControlSettings';
  const MINI_KEY = 'musicControlMiniPlayerEnabled';

  async function initializeStorageAccess() {
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  }

  async function getPublicState() {
    const values = await chrome.storage.local.get([SETTINGS_KEY, MINI_KEY]);
    const saved = values[SETTINGS_KEY] || {};
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...saved,
        sources: { ...DEFAULT_SETTINGS.sources, ...(saved.sources || {}) },
        youtubeAllImportEnabled: saved.youtubeAllImportEnabled === true
      },
      miniPlayerEnabled: values[MINI_KEY] === true
    };
  }

  async function updateSettings(settings) {
    const current = (await getPublicState()).settings;
    const safe = {
      sources: { ...current.sources, ...(settings?.sources || {}) },
      miniPlayerAllPages: settings?.miniPlayerAllPages === true,
      youtubeAllImportEnabled: settings?.youtubeAllImportEnabled === true
    };
    await chrome.storage.local.set({ [SETTINGS_KEY]: safe });
    return getPublicState();
  }

  async function setMiniPlayerEnabled(enabled) {
    await chrome.storage.local.set({ [MINI_KEY]: enabled === true });
    return getPublicState();
  }

  async function broadcast(action, data) {
    const tabs = await chrome.tabs.query({});
    await Promise.all(tabs.filter((tab) => tab.id).map(async (tab) => {
      try { await chrome.tabs.sendMessage(tab.id, { action, ...data }); } catch (_) {}
    }));
  }

  global.MusicControlStorage = Object.freeze({
    DEFAULT_SETTINGS,
    initializeStorageAccess,
    getPublicState,
    updateSettings,
    setMiniPlayerEnabled,
    broadcast
  });
})(globalThis);
