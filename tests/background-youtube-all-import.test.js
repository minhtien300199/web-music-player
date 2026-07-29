const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const Actions = {
  MEDIA_CONTEXT_CHANGED: 'MEDIA_CONTEXT_CHANGED', GET_PUBLIC_STATE: 'GET_PUBLIC_STATE',
  UPDATE_PUBLIC_SETTINGS: 'UPDATE_PUBLIC_SETTINGS', SET_MINI_PLAYER_ENABLED: 'SET_MINI_PLAYER_ENABLED',
  MEDIA_COMMAND: 'MEDIA_COMMAND', GET_MEDIA_CONTEXT: 'GET_MEDIA_CONTEXT', GET_QUEUE: 'GET_QUEUE',
  IMPORT_YOUTUBE_ALL_SUGGESTIONS: 'IMPORT_YOUTUBE_ALL_SUGGESTIONS',
  DISMISS_SUGGESTION_ITEM: 'DISMISS_SUGGESTION_ITEM', PLAY_YOUTUBE_VIDEO: 'PLAY_YOUTUBE_VIDEO'
};

function loadBackground({ enabled = true, stale = false } = {}) {
  let listener; const queries = []; const messages = []; const saves = []; const documents = [];
  const tab = { id: 9, url: 'https://www.youtube.com/' };
  const context = {
    URL, importScripts() {},
    MusicControlContracts: {
      Actions,
      boundedText: (value, maximum) => String(value || '').slice(0, maximum),
      validSearchQuery: () => true,
      validVideo: (value) => /^[A-Za-z0-9_-]{11}$/.test(value),
      success: (data) => ({ ok: true, data }),
      failure: (code, message) => ({ ok: false, error: { code, message } })
    },
    MusicControlSenderPolicy: { isExtensionPage: (sender) => !sender.tab, isContentScript: (sender) => Boolean(sender.tab) },
    MusicControlStorage: {
      initializeStorageAccess: async () => {},
      getPublicState: async () => ({ settings: { youtubeAllImportEnabled: enabled } }),
      updateSettings: async () => ({ settings: { youtubeAllImportEnabled: enabled } }),
      broadcast: async () => {}, setMiniPlayerEnabled: async () => ({})
    },
    MusicControlSuggestionQueue: {
      save: async (value) => {
        saves.push(value);
        return { source: 'youtube-all', label: 'Visible on YouTube — All', items: value.items };
      },
      getForTab: async () => null, dismiss: async () => null, markPlayback: async () => false,
      handleNavigation: async () => {}, handleDocument: async (...args) => { documents.push(args); }, clearTab: async () => {}, clearAll: async () => {}
    },
    MusicControlRouter: {
      isYouTubeUrl: (value) => value?.startsWith('https://www.youtube.com/'),
      notify: async () => ({}), resolve: async () => null, send: async () => ({}), playVideo: async () => ({})
    },
    MusicControlCredentials: {}, MusicControlSearchCache: {}, MusicControlYouTubeSearch: {},
    chrome: {
      runtime: {
        onInstalled: { addListener() {} }, onStartup: { addListener() {} },
        onMessage: { addListener: (value) => { listener = value; } }
      },
      tabs: {
        onUpdated: { addListener() {} }, onRemoved: { addListener() {} },
        query: async (query) => { queries.push(query); return [tab]; },
        sendMessage: async (tabId, message) => {
          messages.push({ tabId, message });
          return {
            status: 'ready', documentNonce: 'doc', sourceRevision: 'surface',
            items: [{ videoId: 'AAAAAAAAAAA', title: 'Song' }]
          };
        },
        get: async () => ({ ...tab, url: stale ? 'https://www.youtube.com/watch?v=BBBBBBBBBBB' : tab.url })
      },
      storage: { session: { get: async () => ({}), set: async () => {}, remove: async () => {} } }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8'), context);
  const dispatch = (message, sender = { url: 'chrome-extension://test/popup.html' }) => new Promise((resolve) => listener(message, sender, resolve));
  return { dispatch, queries, messages, saves, documents };
}

test('background rejects import while the experimental flag is off', async () => {
  const app = loadBackground({ enabled: false });
  const result = await app.dispatch({ action: Actions.IMPORT_YOUTUBE_ALL_SUGGESTIONS });
  assert.equal(result.error.code, 'FEATURE_DISABLED');
  assert.equal(app.queries.length, 0);
});

test('imports only from the exact active tab in the current window', async () => {
  const app = loadBackground();
  const result = await app.dispatch({ action: Actions.IMPORT_YOUTUBE_ALL_SUGGESTIONS });
  assert.equal(result.ok, true);
  assert.deepEqual({ ...app.queries[0] }, { active: true, currentWindow: true });
  assert.equal(app.messages[0].tabId, 9);
  assert.equal(app.saves[0].sourceTabId, 9);
});

test('rejects an import when the active tab URL changes before save', async () => {
  const app = loadBackground({ stale: true });
  const result = await app.dispatch({ action: Actions.IMPORT_YOUTUBE_ALL_SUGGESTIONS });
  assert.equal(result.error.code, 'STALE_MEDIA_CONTEXT');
  assert.equal(app.saves.length, 0);
});

test('ignores nonce-less media updates for queue document cleanup', async () => {
  const app = loadBackground();
  const result = await app.dispatch(
    { action: Actions.MEDIA_CONTEXT_CHANGED, context: { found: true, videoId: 'AAAAAAAAAAA' } },
    { tab: { id: 9 }, url: 'https://www.youtube.com/' }
  );
  assert.equal(result.ok, true);
  assert.equal(app.documents.length, 0);
});
