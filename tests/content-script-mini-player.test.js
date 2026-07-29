const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.classList = { add() {}, contains() { return false; }, remove() {} };
    this.dataset = {};
    this.listeners = new Map();
    this.queryResults = new Map();
    this.style = {};
    this.textContent = '';
  }

  addEventListener(eventName, listener) {
    this.listeners.set(eventName, listener);
  }

  removeEventListener() {}

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  getBoundingClientRect() {
    return { height: 0, width: 1 };
  }

  querySelector(selector) {
    if (!this.queryResults.has(selector)) {
      this.queryResults.set(selector, new FakeElement('child'));
    }
    return this.queryResults.get(selector);
  }

  querySelectorAll() {
    return [];
  }

  remove() {
    this.removed = true;
  }

  trigger(eventName, event = {}) {
    return this.listeners.get(eventName)?.(event);
  }
}

function createContentScriptContext({
  hostname = 'example.com',
  media = null,
  settings = { miniPlayerAllPages: true, sources: { other: false } },
} = {}) {
  const body = new FakeElement('body');
  const head = new FakeElement('head');
  let storageChangeListener;
  let messageListener;
  let clearedIntervals = 0;
  const runtimeMessages = [];

  const document = {
    body,
    head,
    title: 'Test page',
    addEventListener() {},
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    getElementById(id) {
      return [...head.children, ...body.children].find((element) => element.id === id && !element.removed) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (media && (selector === 'video' || selector === 'audio')) {
        return [media];
      }
      return [];
    },
    removeEventListener() {},
  };

  const context = {
    chrome: {
      runtime: {
        onMessage: { addListener(listener) { messageListener = listener; } },
        sendMessage(message) {
          runtimeMessages.push(message);
          return Promise.resolve({ found: false });
        },
      },
      storage: {
        local: {
          get(keys, callback) {
            callback({
              musicControlSettings: settings,
              musicControlMiniPlayerEnabled: false,
            });
          },
          set() {},
        },
        onChanged: { addListener(listener) { storageChangeListener = listener; } },
      },
    },
    clearInterval() { clearedIntervals += 1; },
    console,
    document,
    navigator: {},
    setInterval() { return 1; },
    setTimeout() {},
    URL,
    window: { innerHeight: 1000, innerWidth: 1000, location: { hostname } },
  };

  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'content-script.js'), 'utf8'), context);

  return {
    getMiniPlayer: () => document.getElementById('music-control-mini-player'),
    get runtimeMessages() { return runtimeMessages; },
    sendMessage: (action) => messageListener({ action }, null, () => {}),
    storageChange: (changes) => storageChangeListener(changes, 'local'),
    waitForMicrotasks: () => new Promise((resolve) => setImmediate(resolve)),
    get clearedIntervals() { return clearedIntervals; },
  };
}

test('updates an already-open tab when the global pin state changes', async () => {
  const page = createContentScriptContext();
  await page.waitForMicrotasks();

  assert.equal(page.getMiniPlayer(), null);

  page.storageChange({ musicControlMiniPlayerEnabled: { newValue: true } });
  assert.ok(page.getMiniPlayer());

  page.storageChange({ musicControlMiniPlayerEnabled: { newValue: false } });
  assert.equal(page.getMiniPlayer(), null);
  assert.equal(page.clearedIntervals, 1);
});

test('respects a live change to the show-on-all-pages setting', async () => {
  const page = createContentScriptContext();
  await page.waitForMicrotasks();

  page.storageChange({ musicControlMiniPlayerEnabled: { newValue: true } });
  assert.ok(page.getMiniPlayer());

  page.storageChange({
    musicControlSettings: {
      newValue: { miniPlayerAllPages: false, sources: { other: false } },
    },
  });
  assert.equal(page.getMiniPlayer(), null);
});

test('keeps the player visible in the tab where it was pinned when all-pages is disabled', async () => {
  const page = createContentScriptContext();
  await page.waitForMicrotasks();

  page.storageChange({
    musicControlSettings: {
      newValue: { miniPlayerAllPages: false, sources: { other: false } },
    },
  });
  page.sendMessage('toggleMiniPlayer');

  assert.ok(page.getMiniPlayer());
});

test('normalizes remote mini-player next and previous commands for the media tab', async () => {
  const page = createContentScriptContext({
    hostname: 'www.youtube.com',
    settings: { miniPlayerAllPages: true, sources: { youtube: true } },
  });
  await page.waitForMicrotasks();
  page.storageChange({ musicControlMiniPlayerEnabled: { newValue: true } });
  await page.waitForMicrotasks();

  const player = page.getMiniPlayer();
  page.runtimeMessages.length = 0;
  await player.querySelector('.mini-prev').trigger('click');
  await player.querySelector('.mini-next').trigger('click');

  assert.deepEqual(page.runtimeMessages.map((message) => message.command), ['previous', 'next']);
});

test('keeps next and previous local when the current source tab has media', async () => {
  const page = createContentScriptContext({
    hostname: 'www.youtube.com',
    media: { currentTime: 30, duration: 120, paused: true, volume: 1 },
    settings: { miniPlayerAllPages: true, sources: { youtube: true } },
  });
  await page.waitForMicrotasks();
  page.storageChange({ musicControlMiniPlayerEnabled: { newValue: true } });
  await page.waitForMicrotasks();

  const player = page.getMiniPlayer();
  page.runtimeMessages.length = 0;
  await player.querySelector('.mini-prev').trigger('click');
  await player.querySelector('.mini-next').trigger('click');

  assert.deepEqual(page.runtimeMessages, []);
});
