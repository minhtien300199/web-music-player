(function(global) {
  'use strict';

  const element = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; };
  const playButton = (item, index, onPlay) => {
    const button = element('button', `playlist-item playlist-play${item.active ? ' active' : ''}`);
    button.type = 'button'; button.setAttribute('aria-label', `Play ${item.title}`);
    if (item.active) button.setAttribute('aria-current', 'true');
    button.append(element('span', 'playlist-index', String(index + 1)));
    const meta = element('span', 'playlist-meta');
    const title = element('span', 'playlist-title', item.title); title.title = item.title;
    meta.append(title); if (item.artist) meta.append(element('span', 'playlist-artist', item.artist));
    button.append(meta); button.addEventListener('click', () => onPlay(item.playTarget));
    return button;
  };
  function renderQueue(container, queue, onPlay, onRemove) {
    container.replaceChildren();
    (queue.items || []).forEach((item, index) => {
      const play = playButton(item, index, onPlay);
      if (queue.source !== 'youtube-all') return container.append(play);
      const row = element('div', 'playlist-row'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', item.title);
      const remove = element('button', 'playlist-remove', '×'); remove.type = 'button';
      remove.setAttribute('aria-label', `Remove ${item.title} from extension list`);
      remove.addEventListener('click', async () => {
        row.setAttribute('aria-busy', 'true'); play.disabled = true; remove.disabled = true;
        await onRemove(item, index);
      });
      row.append(play, remove); container.append(row);
    });
    if (!container.children.length) container.append(element('p', 'search-empty', queue.source === 'native-next' ? 'YouTube will choose the next video.' : 'No suggestions available'));
  }
  function renderResults(container, results, onPlay) {
    container.replaceChildren();
    results.forEach((result) => {
      const row = element('button', 'search-result'); row.type = 'button'; row.setAttribute('aria-label', `Play ${result.title}`);
      if (result.thumbnailUrl?.startsWith('https://')) { const image = document.createElement('img'); image.src = result.thumbnailUrl; image.alt = ''; row.append(image); }
      const meta = element('span', 'search-result-meta'); const title = element('span', 'search-result-title'); title.append(element('span', '', result.title)); if (result.appSuggested) title.append(element('span', 'suggestion', 'App suggestion')); meta.append(title, element('span', 'search-result-channel', result.channelTitle)); row.append(meta);
      row.addEventListener('click', async () => { row.disabled = true; try { await onPlay(result.videoId); } finally { row.disabled = false; } }); container.append(row);
    });
  }
  global.MusicControlPopupDom = Object.freeze({ renderQueue, renderResults });
})(globalThis);
