const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Node {
  constructor() {
    this.listeners = new Map(); this.style = {}; this.attributes = {};
    this.classList = { add: () => {}, remove: () => {} }; this.textContent = '';
  }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  removeEventListener(name) { this.listeners.delete(name); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return { left: 0, width: 100 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  trigger(name, event) { return this.listeners.get(name)?.(event); }
}

function load() {
  const context = {}; context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'popup', 'progress-seek-controller.js'), 'utf8'), context);
  return context.MusicControlProgressSeek;
}

test('pointer drag previews and commits exactly once on release', async () => {
  const track = new Node(); const fill = new Node(); const current = new Node(); const duration = new Node();
  const commits = [];
  const controller = load().create({ track, fill, currentTimeLabel: current, durationLabel: duration, commit: async (value) => commits.push(value) });
  controller.updateMedia({ currentTime: 10, duration: 100 });
  const base = { pointerId: 1, isPrimary: true, button: 0, preventDefault() {} };
  track.trigger('pointerdown', { ...base, clientX: 20 });
  track.trigger('pointermove', { ...base, clientX: 60 });
  await track.trigger('pointerup', { ...base, clientX: 75 });
  assert.deepEqual(commits, [75]);
  assert.equal(fill.style.width, '75%');
});

test('cancel commits nothing and keyboard seek is clamped', async () => {
  const track = new Node(); const commits = [];
  const controller = load().create({
    track, fill: new Node(), currentTimeLabel: new Node(), durationLabel: new Node(),
    commit: async (value) => commits.push(value)
  });
  controller.updateMedia({ currentTime: 98, duration: 100 });
  const pointer = { pointerId: 2, isPrimary: true, button: 0, clientX: 50, preventDefault() {} };
  track.trigger('pointerdown', pointer); track.trigger('pointercancel', pointer);
  await track.trigger('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.deepEqual(commits, [100]);
});

test('supports Page and boundary keys while no-duration media is inert', async () => {
  const track = new Node(); const commits = [];
  const controller = load().create({
    track, fill: new Node(), currentTimeLabel: new Node(), durationLabel: new Node(),
    commit: async (value) => commits.push(value)
  });
  controller.updateMedia({ currentTime: 50, duration: 120 });
  for (const key of ['PageUp', 'PageDown', 'Home', 'End']) {
    await track.trigger('keydown', { key, preventDefault() {} });
  }
  assert.deepEqual(commits, [80, 50, 0, 120]);
  controller.updateMedia({ currentTime: 0, duration: Infinity });
  await track.trigger('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.deepEqual(commits, [80, 50, 0, 120]);
});
