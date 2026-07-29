const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('media context notifications carry the active document nonce', () => {
  const messages = [];
  const media = { paused: false, currentTime: 10, duration: 100, volume: 1 };
  const context = {
    URL,
    window: { location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/watch?v=AAAAAAAAAAA' } },
    document: {
      title: 'Song',
      querySelectorAll: (selector) => selector === 'video' ? [media] : [],
      querySelector: () => null
    },
    navigator: {},
    chrome: { runtime: { sendMessage: (message) => { messages.push(message); return Promise.resolve(); } } },
    MusicControlContracts: { Actions: { MEDIA_CONTEXT_CHANGED: 'MEDIA_CONTEXT_CHANGED' } },
    MusicControlYouTubeAllSuggestions: { documentNonce: 'document-123' }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'content', 'provider-media-controller.js'), 'utf8'), context);
  context.MusicControlMedia.setSettings({ sources: { youtube: true } });
  context.MusicControlMedia.info();
  assert.equal(messages[0].context.documentNonce, 'document-123');
});
