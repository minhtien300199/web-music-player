const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const visible = (values = {}) => ({
  hidden: false, textContent: '', getAttribute: () => null, getClientRects: () => [1], ...values
});

function loadAdapter({ chipIndex = 0, chipText = null, hiddenHome = false } = {}) {
  const title = visible({ textContent: 'Song title' });
  const channel = visible({ textContent: 'Artist name' });
  const row = visible({ querySelector: (selector) => selector.includes('video-title') ? title : channel });
  const anchor = (videoId, { short = false, promoted = false } = {}) => visible({
    href: short ? `https://www.youtube.com/shorts/${videoId}` : `https://www.youtube.com/watch?v=${videoId}`,
    title: '',
    closest: (selector) => selector.startsWith('ytd-ad') ? (promoted ? row : null) : row
  });
  const anchors = [
    anchor('AAAAAAAAAAA'), anchor('AAAAAAAAAAA'), anchor('BBBBBBBBBBB'),
    anchor('CCCCCCCCCCC', { short: true }), anchor('DDDDDDDDDDD', { promoted: true }), anchor('EEEEEEEEEEE')
  ];
  const root = visible({
    tagName: 'DIV', id: 'contents', className: 'grid',
    querySelectorAll: () => anchors
  });
  const siblings = [visible(), visible()];
  const chip = visible({ textContent: chipText || (chipIndex === 0 ? 'All' : 'Music') });
  siblings[chipIndex] = chip; chip.parentElement = { children: siblings };
  const scope = visible({
    hidden: hiddenHome,
    querySelector: (selector) => selector.includes('chip-cloud') ? chip : root
  });
  const location = { hostname: 'www.youtube.com', href: 'https://www.youtube.com/watch?v=EEEEEEEEEEE', pathname: '/watch', search: '?v=EEEEEEEEEEE' };
  const context = {
    URL, location, crypto: { randomUUID: () => 'document-1' },
    document: {
      readyState: 'complete',
      querySelector: (selector) => selector.includes('ytd-browse') ? scope : null
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source('shared/message-contracts.js'), context);
  vm.runInContext(source('content/youtube-all-suggestions-adapter.js'), context);
  return context.MusicControlYouTubeAllSuggestions;
}

test('ignores a hidden Home surface left behind by SPA navigation', () => {
  const adapter = loadAdapter({ hiddenHome: true });
  adapter.setEnabled(true);
  assert.equal(adapter.extract().status, 'unsupported');
});

test('is disabled by default and imports bounded visible All videos when enabled', () => {
  const adapter = loadAdapter();
  assert.equal(adapter.extract().status, 'disabled');
  adapter.setEnabled(true);
  const result = adapter.extract();
  assert.equal(result.status, 'ready');
  assert.deepEqual([...result.items.map((item) => item.videoId)], ['AAAAAAAAAAA', 'BBBBBBBBBBB']);
  assert.equal('thumbnailUrl' in result.items[0], false);
});

test('fails closed when the selected chip is not All', () => {
  const adapter = loadAdapter({ chipIndex: 1 });
  adapter.setEnabled(true);
  assert.equal(adapter.extract().status, 'non-all');
});

test('rejects an ambiguous first selected chip that is not labeled All', () => {
  const adapter = loadAdapter({ chipText: 'Music' });
  adapter.setEnabled(true);
  assert.equal(adapter.extract().status, 'non-all');
});
