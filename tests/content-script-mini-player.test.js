const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeElement {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.listeners = new Map(); this.dataset = {}; this.style = {}; this.hidden = false; this.textContent = ''; this.className = ''; this.classList = { contains: () => false, add() {}, remove() {}, toggle() {} }; }
  append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  removeEventListener() {}
  setAttribute() {}
  querySelector(selector) { if (!this.nodes) this.nodes = new Map(); if (!this.nodes.has(selector)) this.nodes.set(selector, new FakeElement()); return this.nodes.get(selector); }
  querySelectorAll() { return []; }
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, width: 100, height: 40 }; }
  remove() { this.removed = true; }
  trigger(name, event = {}) { return this.listeners.get(name)?.(event); }
}

function loadPage() {
  const body = new FakeElement('body'); let listener; const messages = [];
  const context = {
    AbortController, URL, console, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    window: { location: { hostname: 'www.youtube.com', href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, innerWidth: 1000, innerHeight: 700 },
    document: { title: 'Test video', body, createElement: (tag) => new FakeElement(tag), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
    navigator: {},
    chrome: { runtime: { onMessage: { addListener: (next) => { listener = next; } }, sendMessage: (message) => { messages.push(message); if (message.action === 'GET_PUBLIC_STATE') return Promise.resolve({ ok: true, data: { settings: { sources: { youtube: true }, miniPlayerAllPages: true }, miniPlayerEnabled: false } }); return Promise.resolve({ ok: true, data: { found: false } }); } } }
  };
  vm.createContext(context);
  ['shared/message-contracts.js', 'content/provider-media-controller.js', 'content/provider-queue-adapter.js', 'content/youtube-all-suggestions-adapter.js', 'content/mini-player-controller.js', 'content-script.js'].forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context));
  return { context, messages, dispatch: (message) => new Promise((resolve) => listener(message, {}, resolve)), receive: (message) => listener(message, {}, () => {}) };
}

test('loads ordered content modules without direct storage access', async () => {
  const page = loadPage();
  await new Promise((resolve) => setImmediate(resolve));
  const queue = await page.dispatch({ action: 'CONTENT_MEDIA_COMMAND', command: 'getQueue' });
  assert.equal(queue.source, 'native-next');
  assert.equal(page.messages.some((message) => message.action === 'GET_PUBLIC_STATE'), true);
});

test('creates the mini-player from a brokered state update', async () => {
  const page = loadPage();
  page.receive({ action: 'MINI_PLAYER_STATE_UPDATED', state: { settings: { sources: { youtube: true }, miniPlayerAllPages: true }, miniPlayerEnabled: true } });
  const player = page.context.document.body.children.find((node) => node.id === 'music-control-mini-player');
  assert.ok(player);
});

test('applies brokered source settings to the media controller', () => {
  const page = loadPage();
  page.receive({ action: 'PUBLIC_STATE_UPDATED', state: { settings: { sources: { youtube: false }, miniPlayerAllPages: true }, miniPlayerEnabled: false } });

  assert.equal(page.context.MusicControlMedia.isEnabled(), false);
});
