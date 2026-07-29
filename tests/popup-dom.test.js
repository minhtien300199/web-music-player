const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.attributes = {}; this.className = ''; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, handler) { this.listeners[name] = handler; }
  setAttribute(name, value) { this.attributes[name] = value; }
}

function load() {
  const context = { document: { createElement: (tag) => new Element(tag) } };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup-dom.js'), 'utf8'), context);
  return context.MusicControlPopupDom;
}

const item = { title: 'Song', artist: 'Artist', videoId: 'AAAAAAAAAAA', playTarget: { kind: 'youtube-video', videoId: 'AAAAAAAAAAA' } };

test('renders imported suggestions with sibling Play and Remove buttons', () => {
  const container = new Element('div');
  load().renderQueue(container, { source: 'youtube-all', items: [item] }, () => {}, () => {});
  assert.equal(container.children[0].tag, 'div');
  assert.deepEqual(container.children[0].children.map((child) => child.tag), ['button', 'button']);
  assert.match(container.children[0].children[1].attributes['aria-label'], /Remove Song/);
});

test('does not expose Remove for provider playlists', () => {
  const container = new Element('div');
  load().renderQueue(container, { source: 'playlist', items: [item] }, () => {}, () => {});
  assert.deepEqual(container.children.map((child) => child.tag), ['button']);
});
