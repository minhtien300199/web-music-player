const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadStore() {
  const values = {};
  const context = {
    URL,
    chrome: { storage: { session: {
      get: async (key) => ({ [key]: values[key] }),
      set: async (next) => Object.assign(values, next),
      remove: async (key) => { delete values[key]; }
    } } }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background', 'suggestion-queue-store.js'), 'utf8'), context);
  return context.MusicControlSuggestionQueue;
}

const items = [
  { videoId: 'AAAAAAAAAAA', title: 'First' },
  { videoId: 'BBBBBBBBBBB', title: 'Second' }
];
const snapshot = { sourceTabId: 7, sourceDocumentNonce: 'doc', sourceRevision: 'surface', items };

test('dismissal survives a same-surface refresh', async () => {
  const store = loadStore();
  await store.save(snapshot);
  await store.dismiss(7, 'AAAAAAAAAAA');
  await store.save(snapshot);
  const queue = await store.getForTab(7);
  assert.deepEqual([...queue.items.map((item) => item.videoId)], ['BBBBBBBBBBB']);
});

test('preserves selected-item navigation and clears unrelated navigation', async () => {
  const store = loadStore();
  await store.save(snapshot);
  assert.equal(await store.markPlayback(7, 'BBBBBBBBBBB'), true);
  await store.handleNavigation(7, 'https://www.youtube.com/watch?v=BBBBBBBBBBB');
  await store.handleNavigation(7, 'https://www.youtube.com/watch?v=BBBBBBBBBBB&feature=share');
  assert.ok(await store.getForTab(7));
  await store.handleDocument(7, 'next-doc', 'BBBBBBBBBBB');
  assert.ok(await store.getForTab(7));
  await store.handleNavigation(7, 'https://www.youtube.com/watch?v=CCCCCCCCCCC');
  assert.equal(await store.getForTab(7), null);
});

test('clears stale suggestions on an unapproved document replacement', async () => {
  const store = loadStore();
  await store.save(snapshot);
  await store.handleDocument(7, 'replacement-doc', null);
  assert.equal(await store.getForTab(7), null);
});

test('does not treat repeated media state from the active document as replacement', async () => {
  const store = loadStore();
  await store.save(snapshot);
  await store.handleDocument(7, 'doc', 'AAAAAAAAAAA');
  await store.handleDocument(7, 'doc', 'AAAAAAAAAAA');
  assert.ok(await store.getForTab(7));
});
