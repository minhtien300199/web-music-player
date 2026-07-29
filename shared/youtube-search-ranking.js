(function(global) {
  'use strict';

  const modifiers = ['live', 'cover', 'remix', 'nightcore', 'karaoke', 'lyrics'];
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function rank(query, results) {
    const normalizedQuery = normalize(query);
    return [...results].map((item, index) => {
      const title = normalize(item.title);
      let score = -index;
      if (title === normalizedQuery) score += 100;
      if (title.includes(normalizedQuery)) score += 25;
      modifiers.forEach((modifier) => { if (!normalizedQuery.includes(modifier) && title.includes(modifier)) score -= 5; });
      return { ...item, appSuggested: score > -index, _score: score };
    }).sort((a, b) => b._score - a._score).map(({ _score, ...item }) => item);
  }

  global.MusicControlSearchRanking = Object.freeze({ normalize, rank });
})(globalThis);
