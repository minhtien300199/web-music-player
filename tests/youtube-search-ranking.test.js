const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function ranking() { const context = {}; vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'shared/youtube-search-ranking.js'), 'utf8'), context); return context.MusicControlSearchRanking; }
test('normalizes punctuation and diacritics', () => { assert.equal(ranking().normalize('Beyoncé — Halo!'), 'beyonce halo'); });
test('keeps an exact title above an unrequested remix', () => { const rows = ranking().rank('Halo', [{ title: 'Halo (Remix)', videoId: 'aaaaaaaaaaa' }, { title: 'Halo', videoId: 'bbbbbbbbbbb' }]); assert.equal(rows[0].title, 'Halo'); });
