const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadStorage() {
  const local = {};
  const context = {
    chrome: {
      storage: { local: {
        get: async (keys) => Object.fromEntries(keys.filter((key) => key in local).map((key) => [key, local[key]])),
        set: async (value) => Object.assign(local, value),
        setAccessLevel: async () => {}
      }, session: { setAccessLevel: async () => {} } },
      tabs: { query: async () => [], sendMessage: async () => {} }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background', 'storage-broker.js'), 'utf8'), context);
  return context.MusicControlStorage;
}

test('YouTube All import is default-off and only accepts explicit true', async () => {
  const storage = loadStorage();
  assert.equal((await storage.getPublicState()).settings.youtubeAllImportEnabled, false);
  assert.equal((await storage.updateSettings({ sources: { youtube: true }, youtubeAllImportEnabled: 'true' })).settings.youtubeAllImportEnabled, false);
  assert.equal((await storage.updateSettings({ sources: { youtube: true }, youtubeAllImportEnabled: true })).settings.youtubeAllImportEnabled, true);
});
