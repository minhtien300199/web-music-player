document.addEventListener('DOMContentLoaded', () => {
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseIcon = document.getElementById('playPauseIcon');
  const stopBtn = document.getElementById('stopBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const backBtn = document.getElementById('backBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const trackTitle = document.getElementById('trackTitle');
  const trackArtist = document.getElementById('trackArtist');
  const currentTimeEl = document.getElementById('currentTime');
  const durationEl = document.getElementById('duration');
  const progressEl = document.getElementById('progress');
  const playlistEl = document.getElementById('playlist');
  const statusText = document.getElementById('statusText');
  const tabInfo = document.getElementById('tabInfo');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  const volumeIcon = document.getElementById('volumeIcon');
  const toggleMiniBtn = document.getElementById('toggleMiniBtn');
  const progressBar = document.getElementById('progressBar');

  let currentTabId = null;
  let mediaTabId = null;

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function setStatus(message, type = '') {
    statusText.textContent = message;
    statusText.parentElement.className = `status ${type}`;
  }

  async function getTargetTab() {
    if (mediaTabId) {
      try {
        const tab = await chrome.tabs.get(mediaTabId);
        if (tab) return tab;
      } catch (e) {
        mediaTabId = null;
      }
    }

    const audibleTabs = await chrome.tabs.query({ audible: true });
    if (audibleTabs.length > 0) {
      mediaTabId = audibleTabs[0].id;
      return audibleTabs[0];
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      currentTabId = activeTab.id;
      return activeTab;
    }

    return null;
  }

  async function sendCommand(action, data = {}, retryCount = 0) {
    try {
      const tab = await getTargetTab();
      if (!tab) {
        setStatus('No tab found', 'error');
        tabInfo.textContent = '';
        return null;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });

      if (response && response.found) {
        mediaTabId = tab.id;
        updateTabInfo(tab);
      } else if (response && response.found === false) {
        if (mediaTabId === tab.id) {
          mediaTabId = null;
        }
        tabInfo.textContent = '';
      }

      return response;
    } catch (error) {
      console.error('Error sending command:', error);

      if (retryCount < 2) {
        mediaTabId = null;
        await new Promise(resolve => setTimeout(resolve, 200));
        return sendCommand(action, data, retryCount + 1);
      }

      mediaTabId = null;
      setStatus('No media found', 'error');
      tabInfo.textContent = '';
      return null;
    }
  }

  function updateTabInfo(tab) {
    if (tab) {
      const url = new URL(tab.url);
      const isAudible = tab.audible ? '🔊 ' : '';
      tabInfo.textContent = `${isAudible}Controlling: ${url.hostname}`;
      tabInfo.className = tab.audible ? 'tab-info active' : 'tab-info';
    }
  }

  async function updateMediaInfo() {
    const info = await sendCommand('getMediaInfo');
    if (info && info.found) {
      trackTitle.textContent = info.title || 'Unknown Track';
      trackArtist.textContent = info.artist || '';
      currentTimeEl.textContent = formatTime(info.currentTime);
      durationEl.textContent = formatTime(info.duration);

      const progress = info.duration > 0 ? (info.currentTime / info.duration) * 100 : 0;
      progressEl.style.width = `${progress}%`;

      playPauseIcon.textContent = info.paused ? '▶' : '⏸';
      setStatus(info.paused ? 'Paused' : 'Playing', 'success');
    } else {
      trackTitle.textContent = 'No media detected';
      trackArtist.textContent = '';
      currentTimeEl.textContent = '0:00';
      durationEl.textContent = '0:00';
      progressEl.style.width = '0%';
      playPauseIcon.textContent = '▶';
      setStatus('Ready');
    }
  }

  async function updatePlaylist() {
    const result = await sendCommand('getPlaylist');
    if (result && result.playlist && result.playlist.length > 0) {
      playlistEl.innerHTML = result.playlist.map((item, index) => `
        <div class="playlist-item ${item.active ? 'active' : ''}" data-index="${index}">
          <span class="playlist-item-index">${index + 1}</span>
          <div class="playlist-item-info">
            <div class="playlist-item-title">${item.title}</div>
            ${item.artist ? `<div class="playlist-item-artist">${item.artist}</div>` : ''}
          </div>
        </div>
      `).join('');

      playlistEl.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', () => {
          const index = parseInt(item.dataset.index);
          sendCommand('playFromPlaylist', { index });
        });
      });
    } else {
      playlistEl.innerHTML = '<div class="playlist-empty">No playlist detected</div>';
    }
  }

  playPauseBtn.addEventListener('click', async () => {
    await sendCommand('playPause');
    setTimeout(updateMediaInfo, 100);
  });

  stopBtn.addEventListener('click', async () => {
    await sendCommand('stop');
    setTimeout(updateMediaInfo, 100);
  });

  prevBtn.addEventListener('click', async () => {
    await sendCommand('previous');
    setTimeout(() => {
      updateMediaInfo();
      updatePlaylist();
    }, 300);
  });

  nextBtn.addEventListener('click', async () => {
    await sendCommand('next');
    setTimeout(() => {
      updateMediaInfo();
      updatePlaylist();
    }, 300);
  });

  backBtn.addEventListener('click', async () => {
    await sendCommand('skip', { seconds: -10 });
    setTimeout(updateMediaInfo, 100);
  });

  forwardBtn.addEventListener('click', async () => {
    await sendCommand('skip', { seconds: 10 });
    setTimeout(updateMediaInfo, 100);
  });

  volumeSlider.addEventListener('input', async (e) => {
    const volume = e.target.value;
    volumeValue.textContent = `${volume}%`;
    await sendCommand('setVolume', { volume: volume / 100 });

    if (volume == 0) {
      volumeIcon.textContent = '🔇';
    } else if (volume < 50) {
      volumeIcon.textContent = '🔉';
    } else {
      volumeIcon.textContent = '🔊';
    }
  });

  volumeIcon.addEventListener('click', async () => {
    const currentVolume = parseInt(volumeSlider.value);
    if (currentVolume > 0) {
      volumeSlider.dataset.lastVolume = currentVolume;
      volumeSlider.value = 0;
      volumeValue.textContent = '0%';
      volumeIcon.textContent = '🔇';
      await sendCommand('setVolume', { volume: 0 });
    } else {
      const lastVolume = volumeSlider.dataset.lastVolume || 100;
      volumeSlider.value = lastVolume;
      volumeValue.textContent = `${lastVolume}%`;
      volumeIcon.textContent = '🔊';
      await sendCommand('setVolume', { volume: lastVolume / 100 });
    }
  });

  toggleMiniBtn.addEventListener('click', async () => {
    const result = await sendCommand('toggleMiniPlayer');
    if (result && result.enabled) {
      toggleMiniBtn.classList.add('active');
      setStatus('Mini player enabled', 'success');
    } else {
      toggleMiniBtn.classList.remove('active');
      setStatus('Mini player disabled');
    }
  });

  async function checkMiniPlayerStatus() {
    const result = await sendCommand('getMiniPlayerStatus');
    if (result && result.enabled) {
      toggleMiniBtn.classList.add('active');
    } else {
      toggleMiniBtn.classList.remove('active');
    }
  }

  progressBar.addEventListener('click', async (e) => {
    const rect = progressBar.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const info = await sendCommand('getMediaInfo');
    if (info && info.found && info.duration) {
      const seekTime = percent * info.duration;
      progressEl.style.width = (percent * 100) + '%';
      currentTimeEl.textContent = formatTime(seekTime);
      await sendCommand('seekTo', { time: seekTime });
      setTimeout(updateMediaInfo, 100);
    }
  });

  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  updateMediaInfo();
  updatePlaylist();
  checkMiniPlayerStatus();

  setInterval(updateMediaInfo, 1000);
});
