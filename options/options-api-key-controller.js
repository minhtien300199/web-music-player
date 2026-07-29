(function(global) {
  'use strict';
  const { Actions } = MusicControlContracts;
  const byId = (id) => document.getElementById(id);
  const request = (action, value = {}) => chrome.runtime.sendMessage({ action, ...value });
  function setStatus(text, error = false) { const node = byId('keyStatus'); node.textContent = text; node.className = error ? 'description error' : 'description'; }
  function candidate() { return byId('youtubeApiKey').value.trim(); }
  function persistence() { return document.querySelector('input[name="keyPersistence"]:checked').value; }
  async function refresh() { const result = await request(Actions.GET_YOUTUBE_KEY_STATUS); const value = result.data; setStatus(value.configured ? (value.persistence === 'local' ? 'Remembered on this device — not encrypted' : 'Configured for this session') : 'Not configured'); }
  async function test() { const key = candidate(); if (!key) return setStatus('Enter an API key first.', true); const button = byId('testKeyBtn'); button.disabled = true; setStatus('Testing key…'); const result = await request(Actions.TEST_YOUTUBE_KEY, { key }); byId('youtubeApiKey').value = ''; button.disabled = false; setStatus(result.ok ? 'Key works.' : result.error.message, !result.ok); button.focus(); }
  async function save() { const key = candidate(); if (!key) return setStatus('Enter an API key first.', true); const button = byId('saveKeyBtn'); button.disabled = true; const result = await request(Actions.SET_YOUTUBE_KEY, { key, persistence: persistence() }); byId('youtubeApiKey').value = ''; button.disabled = false; setStatus(result.ok ? (result.data.persistence === 'local' ? 'Remembered on this device — not encrypted' : 'Configured for this session') : result.error.message, !result.ok); }
  async function forget() { if (!confirm('Forget the API key and clear search data? This cannot be undone.')) return; const result = await request(Actions.CLEAR_YOUTUBE_KEY); setStatus(result.ok ? 'Key and search data cleared.' : result.error.message, !result.ok); }
  function init() { byId('testKeyBtn').addEventListener('click', test); byId('saveKeyBtn').addEventListener('click', save); byId('forgetKeyBtn').addEventListener('click', forget); refresh(); }
  global.MusicControlOptionsApiKey = Object.freeze({ init });
})(globalThis);
