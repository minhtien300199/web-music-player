const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPolicy() {
  const context = { globalThis: {}, chrome: { runtime: { id: 'test-extension', getURL: (path = '') => `chrome-extension://test-extension/${path}` } } };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'background', 'message-sender-policy.js'), 'utf8'), context);
  return context.MusicControlSenderPolicy;
}

test('accepts extension pages, including Options opened in a tab', () => {
  const policy = loadPolicy();

  assert.equal(policy.isExtensionPage({ id: 'test-extension', url: 'chrome-extension://test-extension/popup.html' }), true);
  assert.equal(policy.isExtensionPage({ id: 'test-extension', url: 'chrome-extension://test-extension/options.html', tab: { id: 5 } }), true);
  assert.equal(policy.isExtensionPage({ id: 'test-extension', url: 'https://www.youtube.com/watch?v=test', tab: { id: 5 } }), false);
  assert.equal(policy.isExtensionPage({ id: 'other-extension' }), false);
});
