const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const popupMarkup = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
const ids = [...popupMarkup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const makeNode = () => ({ addEventListener() {}, style: {}, parentElement: { className: '' }, textContent: '', hidden: false });

test('initializes controls using the popup IDs declared in popup.html', () => {
  const nodes = Object.fromEntries(ids.map((id) => [id, makeNode()]));
  const context = {
    chrome: { runtime: { sendMessage: async () => ({ ok: true, data: { found: false } }), openOptionsPage() {} } },
    document: { getElementById: (id) => nodes[id] || null },
    MusicControlContracts: { Actions: { MEDIA_COMMAND: 'MEDIA_COMMAND', GET_PUBLIC_STATE: 'GET_PUBLIC_STATE', SET_MINI_PLAYER_ENABLED: 'SET_MINI_PLAYER_ENABLED', YOUTUBE_SIMILAR: 'YOUTUBE_SIMILAR', PLAY_YOUTUBE_VIDEO: 'PLAY_YOUTUBE_VIDEO' } },
    MusicControlPopupDom: { renderQueue() {} }, setInterval() {}, setTimeout() {}
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup-player-controller.js'), 'utf8'), context);

  assert.doesNotThrow(() => context.MusicControlPopupPlayer.init());
});

test('keeps the popup usable when one optional control is absent', () => {
  const nodes = Object.fromEntries(ids.filter((id) => id !== 'playPauseBtn').map((id) => [id, makeNode()]));
  const context = {
    chrome: { runtime: { sendMessage: async () => ({ ok: true, data: { found: false } }), openOptionsPage() {} } },
    document: { getElementById: (id) => nodes[id] || null },
    MusicControlContracts: { Actions: { MEDIA_COMMAND: 'MEDIA_COMMAND', GET_PUBLIC_STATE: 'GET_PUBLIC_STATE', SET_MINI_PLAYER_ENABLED: 'SET_MINI_PLAYER_ENABLED', YOUTUBE_SIMILAR: 'YOUTUBE_SIMILAR', PLAY_YOUTUBE_VIDEO: 'PLAY_YOUTUBE_VIDEO' } },
    MusicControlPopupDom: { renderQueue() {} }, setInterval() {}, setTimeout() {}
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup-player-controller.js'), 'utf8'), context);

  assert.doesNotThrow(() => context.MusicControlPopupPlayer.init());
});
