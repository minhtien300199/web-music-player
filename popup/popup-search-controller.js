(function(global) {
  'use strict';

  const { Actions } = MusicControlContracts;
  const byId = (id) => document.getElementById(id);
  const request = (action, value = {}) => chrome.runtime.sendMessage({ action, ...value });
  const setStatus = (text, error = false) => { const node = byId('searchStatus'); node.textContent = text; node.className = error ? 'search-status search-error' : 'search-status'; };
  function activate(tab) { const control = tab === 'control'; byId('controlTab').setAttribute('aria-selected', String(control)); byId('searchTab').setAttribute('aria-selected', String(!control)); byId('controlTab').tabIndex = control ? 0 : -1; byId('searchTab').tabIndex = control ? -1 : 0; byId('controlPanel').hidden = !control; byId('searchPanel').hidden = control; if (!control) setStatus('Search YouTube by title, artist, or video.'); }
  async function restorePending() { const result = await request(Actions.GET_PENDING_SEARCH); if (result.data?.query) { byId('youtubeSearchQuery').value = result.data.query; activate('search'); setStatus('Your search is ready to submit.'); } }
  function init() {
    byId('controlTab').addEventListener('click', () => activate('control')); byId('searchTab').addEventListener('click', () => activate('search'));
    [byId('controlTab'), byId('searchTab')].forEach((tab, index, tabs) => tab.addEventListener('keydown', (event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; tabs[next].focus(); activate(next ? 'search' : 'control'); }));
    byId('youtubeSearchForm').addEventListener('submit', search); byId('clearSearchBtn').addEventListener('click', async () => { await request(Actions.CLEAR_SEARCH_DATA); byId('searchResults').replaceChildren(); setStatus('Search data cleared.'); });
    restorePending();
  }
  async function search(event) {
    event.preventDefault(); const query = byId('youtubeSearchQuery').value.trim(); if (!query) return setStatus('Enter a song title or artist.', true);
    const submit = byId('searchSubmit'); submit.disabled = true; setStatus('Searching YouTube…'); const response = await request(Actions.YOUTUBE_SEARCH, { query }); submit.disabled = false;
    if (!response.ok) { if (response.error.code === 'KEY_NOT_CONFIGURED') await request(Actions.SAVE_PENDING_SEARCH, { query }); setStatus(response.error.message, true); return; }
    setStatus(response.data.cached ? 'Showing cached results from this session.' : `${response.data.results.length} results.`); MusicControlPopupDom.renderResults(byId('searchResults'), response.data.results, play);
  }
  async function play(videoId) { const response = await request(Actions.PLAY_YOUTUBE_VIDEO, { videoId }); setStatus(response.ok ? 'Opening video…' : response.error.message, !response.ok); }
  global.MusicControlPopupSearch = Object.freeze({ init });
})(globalThis);
