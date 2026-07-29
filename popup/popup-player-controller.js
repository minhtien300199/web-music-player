(function(global) {
  'use strict';

  const { Actions } = MusicControlContracts;
  const byId = (id) => document.getElementById(id);
  const request = (action, payload = {}) => chrome.runtime.sendMessage({ action, ...payload });
  let queue = { source: 'native-next', items: [] };
  let seek = null;
  let poll = null;

  function status(text, type = '') {
    const node = byId('statusText');
    if (!node) return;
    node.textContent = text;
    if (node.parentElement) node.parentElement.className = `status ${type}`;
  }
  function queueHelper(value) {
    if (value.source === 'youtube-all') return 'Visible videos from the active YouTube tab. Stored for this browser session.';
    if (value.source === 'native-next' && value.canImport && !value.importEnabled) {
      return 'Enable experimental YouTube All suggestions in Settings to import visible videos.';
    }
    return value.source === 'native-next' ? 'YouTube will choose the next video.' : '';
  }
  function renderQueue(focusIndex = null) {
    byId('queueTitle').textContent = queue.source === 'youtube-all' ? 'Suggestions from YouTube All' : queue.label;
    byId('queueHelper').textContent = queueHelper(queue);
    const importButton = byId('importSuggestionsBtn');
    importButton.hidden = queue.source === 'playlist' || !queue.canImport || !queue.importEnabled;
    importButton.textContent = queue.source === 'youtube-all' ? 'Refresh from YouTube All' : 'Import from YouTube All';
    MusicControlPopupDom.renderQueue(byId('playlist'), queue, playTarget, removeTarget);
    if (focusIndex !== null) {
      const buttons = [...document.querySelectorAll('.playlist-remove')];
      (buttons[Math.min(focusIndex, buttons.length - 1)] || importButton).focus();
    }
  }
  async function refreshMedia() {
    const response = await request(Actions.MEDIA_COMMAND, { command: 'getMediaInfo' });
    const info = response?.data || {};
    byId('trackTitle').textContent = info.found ? info.title || 'Unknown Track' : 'No media detected';
    byId('trackArtist').textContent = info.found ? info.artist || '' : '';
    byId('playPauseIcon').textContent = info.found && !info.paused ? '⏸' : '▶';
    byId('tabInfo').textContent = info.found ? `Controlling: ${info.provider}` : '';
    seek?.updateMedia(info);
    status(info.found ? (info.paused ? 'Paused' : 'Playing') : 'Ready', info.found && !info.paused ? 'success' : '');
  }
  async function refresh() {
    await refreshMedia();
    const response = await request(Actions.GET_QUEUE);
    if (!response?.ok) return status(response?.error?.message || 'Could not load the list.', 'error');
    queue = response.data;
    renderQueue();
  }
  async function playTarget(target) {
    if (target?.kind === 'youtube-video') await request(Actions.PLAY_YOUTUBE_VIDEO, { videoId: target.videoId });
    else await request(Actions.MEDIA_COMMAND, { command: 'playQueueItem', data: { target } });
    setTimeout(refresh, 300);
  }
  async function removeTarget(item, index) {
    const response = await request(Actions.DISMISS_SUGGESTION_ITEM, { videoId: item.videoId });
    if (!response?.ok) {
      renderQueue(index);
      return status(response?.error?.message || 'Could not remove that item.', 'error');
    }
    queue = response.data;
    byId('queueStatus').textContent = `Removed ${item.title} from extension list.`;
    renderQueue(index);
  }
  async function importSuggestions() {
    const button = byId('importSuggestionsBtn');
    button.disabled = true;
    button.textContent = 'Importing…';
    const response = await request(Actions.IMPORT_YOUTUBE_ALL_SUGGESTIONS);
    button.disabled = false;
    if (!response?.ok) {
      renderQueue();
      return status(response?.error?.message || 'Import failed.', 'error');
    }
    queue = response.data;
    byId('queueStatus').textContent = `Imported ${queue.items.length} visible videos.`;
    renderQueue();
    status('YouTube All suggestions imported.', 'success');
  }
  function bindControls() {
    const commands = { playPauseBtn: 'playPause', stopBtn: 'stop', prevBtn: 'previous', nextBtn: 'next', backBtn: 'skip', forwardBtn: 'skip' };
    Object.entries(commands).forEach(([id, command]) => byId(id)?.addEventListener('click', () => request(Actions.MEDIA_COMMAND, {
      command,
      data: command === 'skip' ? { seconds: id === 'backBtn' ? -10 : 10 } : {}
    }).then(refresh)));
    byId('volumeSlider')?.addEventListener('input', (event) => {
      byId('volumeValue').textContent = `${event.target.value}%`;
      request(Actions.MEDIA_COMMAND, { command: 'setVolume', data: { volume: Number(event.target.value) / 100 } });
    });
    byId('toggleMiniBtn')?.addEventListener('click', async () => {
      const state = await request(Actions.GET_PUBLIC_STATE);
      await request(Actions.SET_MINI_PLAYER_ENABLED, { enabled: !state.data.miniPlayerEnabled });
      refresh();
    });
    byId('importSuggestionsBtn')?.addEventListener('click', importSuggestions);
    byId('settingsBtn')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
  }
  function init() {
    bindControls();
    const track = byId('progressBar');
    if (track && global.MusicControlProgressSeek) seek = MusicControlProgressSeek.create({
      track,
      fill: byId('progress'),
      currentTimeLabel: byId('currentTime'),
      durationLabel: byId('duration'),
      commit: async (time) => {
        const response = await request(Actions.MEDIA_COMMAND, { command: 'seekTo', data: { time } });
        if (!response?.ok || response.data?.success !== true) throw new Error('Seek failed');
        await refreshMedia();
      },
      onError: () => status('Could not seek this media.', 'error')
    });
    refresh();
    poll = setInterval(refreshMedia, 1000);
    global.addEventListener?.('pagehide', () => {
      clearInterval(poll);
      seek?.dispose();
    }, { once: true });
  }

  global.MusicControlPopupPlayer = Object.freeze({ init, refresh });
})(globalThis);
