const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function store() {
  const local = {}; const session = {}; const area = (data) => ({ get: async (key) => typeof key === 'string' ? { [key]: data[key] } : data, set: async (value) => Object.assign(data, value), remove: async (key) => (Array.isArray(key) ? key : [key]).forEach((item) => delete data[item]) });
  const context = { chrome: { storage: { local: area(local), session: area(session) } } }; vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'background/youtube-credential-store.js'), 'utf8'), context); return { api: context.MusicControlCredentials, local, session };
}
test('defaults to no credential then stores a session key', async () => { const value = store(); const before = await value.api.status(); assert.equal(before.configured, false); assert.equal(before.persistence, null); await value.api.replace('key-one', 'session'); const after = await value.api.status(); assert.equal(after.configured, true); assert.equal(after.persistence, 'session'); assert.equal(value.session.youtubeApiKey, 'key-one'); });
test('does not resurrect a local key after session mode is selected', async () => { const value = store(); await value.api.replace('local-key', 'local'); await value.api.replace('session-key', 'session'); delete value.session.youtubeApiKey; assert.equal(await value.api.getKey(), null); });
