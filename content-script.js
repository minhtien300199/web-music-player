(function() {
  'use strict';

  let settings = {
    sources: {
      youtube: true,
      spotify: false,
      soundcloud: false,
      other: false
    },
    miniPlayerAllPages: true
  };

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['musicControlSettings'], (result) => {
        if (result.musicControlSettings) {
          settings = result.musicControlSettings;
        }
        resolve(settings);
      });
    });
  }

  function isSourceEnabled() {
    const hostname = window.location.hostname;

    if (hostname.includes('youtube.com')) {
      return settings.sources.youtube;
    }
    if (hostname.includes('spotify.com')) {
      return settings.sources.spotify;
    }
    if (hostname.includes('soundcloud.com')) {
      return settings.sources.soundcloud;
    }
    return settings.sources.other;
  }

  function getMediaElement() {
    if (!isSourceEnabled()) {
      return null;
    }

    const videos = document.querySelectorAll('video');
    const audios = document.querySelectorAll('audio');

    for (const video of videos) {
      if (!video.paused || video.currentTime > 0) {
        return video;
      }
    }
    for (const audio of audios) {
      if (!audio.paused || audio.currentTime > 0) {
        return audio;
      }
    }

    return videos[0] || audios[0] || null;
  }

  let lastMediaState = null;

  function getMediaInfo() {
    const media = getMediaElement();
    if (!media) {
      lastMediaState = null;
      return { found: false };
    }

    let title = document.title;
    let artist = '';

    if (navigator.mediaSession && navigator.mediaSession.metadata) {
      const metadata = navigator.mediaSession.metadata;
      title = metadata.title || title;
      artist = metadata.artist || '';
    }

    if (window.location.hostname.includes('youtube.com')) {
      const titleEl = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title');
      if (titleEl) title = titleEl.textContent.trim();
      const channelEl = document.querySelector('#channel-name a, .ytd-channel-name a');
      if (channelEl) artist = channelEl.textContent.trim();
    }

    const currentState = {
      found: true,
      title,
      artist,
      currentTime: media.currentTime,
      duration: media.duration,
      paused: media.paused,
      volume: media.volume
    };

    if (!lastMediaState || lastMediaState.title !== title) {
      try {
        chrome.runtime.sendMessage({ action: 'notifyMediaFound' });
      } catch (e) {}
      lastMediaState = currentState;
    }

    return currentState;
  }

  function playPause() {
    const media = getMediaElement();
    if (media) {
      if (media.paused) {
        media.play();
      } else {
        media.pause();
      }
      return { success: true, paused: media.paused };
    }
    return { success: false };
  }

  function stop() {
    const media = getMediaElement();
    if (media) {
      media.pause();
      media.currentTime = 0;
      return { success: true };
    }
    return { success: false };
  }

  function skip(seconds) {
    const media = getMediaElement();
    if (media) {
      const newTime = media.currentTime + seconds;
      media.currentTime = Math.max(0, Math.min(media.duration || Infinity, newTime));
      return { success: true, currentTime: media.currentTime };
    }
    return { success: false };
  }

  function seekTo(time) {
    const media = getMediaElement();
    if (media) {
      media.currentTime = Math.max(0, Math.min(media.duration || Infinity, time));
      return { success: true, currentTime: media.currentTime };
    }
    return { success: false };
  }

  function nextTrack() {
    if (navigator.mediaSession && navigator.mediaSession.setActionHandler) {
      try {
        const event = new KeyboardEvent('keydown', { key: 'N', shiftKey: true });
        document.dispatchEvent(event);
      } catch (e) {}
    }

    if (window.location.hostname.includes('youtube.com')) {
      const nextBtn = document.querySelector('.ytp-next-button, a.ytp-next-button');
      if (nextBtn) {
        nextBtn.click();
        return { success: true };
      }
    }

    if (window.location.hostname.includes('spotify.com')) {
      const nextBtn = document.querySelector('[data-testid="control-button-skip-forward"], button[aria-label="Next"]');
      if (nextBtn) {
        nextBtn.click();
        return { success: true };
      }
    }

    if (window.location.hostname.includes('soundcloud.com')) {
      const nextBtn = document.querySelector('.skipControl__next, button[aria-label="Next"]');
      if (nextBtn) {
        nextBtn.click();
        return { success: true };
      }
    }

    return { success: false };
  }

  function previousTrack() {
    if (window.location.hostname.includes('youtube.com')) {
      const prevBtn = document.querySelector('.ytp-prev-button, a.ytp-prev-button');
      if (prevBtn && prevBtn.style.display !== 'none') {
        prevBtn.click();
        return { success: true };
      }
    }

    if (window.location.hostname.includes('spotify.com')) {
      const prevBtn = document.querySelector('[data-testid="control-button-skip-back"], button[aria-label="Previous"]');
      if (prevBtn) {
        prevBtn.click();
        return { success: true };
      }
    }

    if (window.location.hostname.includes('soundcloud.com')) {
      const prevBtn = document.querySelector('.skipControl__previous, button[aria-label="Previous"]');
      if (prevBtn) {
        prevBtn.click();
        return { success: true };
      }
    }

    const media = getMediaElement();
    if (media) {
      media.currentTime = 0;
      return { success: true };
    }

    return { success: false };
  }

  function getPlaylist() {
    const playlist = [];

    if (window.location.hostname.includes('youtube.com')) {
      const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer, #playlist-items ytd-playlist-video-renderer');
      playlistItems.forEach((item, index) => {
        const titleEl = item.querySelector('#video-title');
        const channelEl = item.querySelector('#byline, .ytd-channel-name');
        const isPlaying = item.hasAttribute('selected') || item.classList.contains('ytd-playlist-panel-video-renderer--playing');

        if (titleEl) {
          playlist.push({
            index,
            title: titleEl.textContent.trim(),
            artist: channelEl ? channelEl.textContent.trim() : '',
            active: isPlaying
          });
        }
      });
    }

    if (window.location.hostname.includes('spotify.com')) {
      const trackRows = document.querySelectorAll('[data-testid="tracklist-row"]');
      trackRows.forEach((row, index) => {
        const titleEl = row.querySelector('[data-testid="internal-track-link"] div');
        const artistEl = row.querySelector('a[href*="/artist/"]');
        const isPlaying = row.querySelector('[aria-label="Now playing"]') !== null;

        if (titleEl) {
          playlist.push({
            index,
            title: titleEl.textContent.trim(),
            artist: artistEl ? artistEl.textContent.trim() : '',
            active: isPlaying
          });
        }
      });
    }

    return { playlist };
  }

  function playFromPlaylist(index) {
    if (window.location.hostname.includes('youtube.com')) {
      const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer a#wc-endpoint, #playlist-items ytd-playlist-video-renderer a');
      if (playlistItems[index]) {
        playlistItems[index].click();
        return { success: true };
      }
    }

    if (window.location.hostname.includes('spotify.com')) {
      const trackRows = document.querySelectorAll('[data-testid="tracklist-row"]');
      if (trackRows[index]) {
        const playBtn = trackRows[index].querySelector('button[data-testid="play-button"]');
        if (playBtn) {
          playBtn.click();
          return { success: true };
        }
        trackRows[index].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        return { success: true };
      }
    }

    return { success: false };
  }

  function setVolume(volume) {
    const media = getMediaElement();
    if (media) {
      media.volume = Math.max(0, Math.min(1, volume));
      return { success: true, volume: media.volume };
    }
    return { success: false };
  }

  let miniPlayerEnabled = false;
  let miniPlayerPinnedLocally = false;
  let miniPlayerElement = null;
  let miniPlayerUpdateInterval = null;
  let removeMiniPlayerDragHandlers = null;
  let playlistExpanded = false;

  function loadMiniPlayerState() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['musicControlMiniPlayerEnabled'], (result) => {
          resolve(result.musicControlMiniPlayerEnabled === true);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  function saveMiniPlayerState(enabled) {
    try {
      chrome.storage.local.set({ musicControlMiniPlayerEnabled: enabled });
    } catch (e) {}
  }

  let settingsLoaded = false;

  loadSettings().then(() => {
    settingsLoaded = true;
    loadMiniPlayerState().then((enabled) => {
      miniPlayerEnabled = enabled;
      syncMiniPlayerVisibility();
    });

    if (isSourceEnabled()) {
      setTimeout(() => {
        const info = getMediaInfo();
        if (info.found) {
          try {
            chrome.runtime.sendMessage({ action: 'notifyMediaFound' });
          } catch (e) {}
        }
      }, 500);
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    if (changes.musicControlSettings) {
      settings = changes.musicControlSettings.newValue;
    }

    if (changes.musicControlMiniPlayerEnabled) {
      miniPlayerEnabled = changes.musicControlMiniPlayerEnabled.newValue === true;
      if (!miniPlayerEnabled) {
        miniPlayerPinnedLocally = false;
      }
    }

    if (settingsLoaded && (changes.musicControlSettings || changes.musicControlMiniPlayerEnabled)) {
      syncMiniPlayerVisibility();
    }
  });

  function createMiniPlayer() {
    if (miniPlayerElement) return;

    const container = document.createElement('div');
    container.id = 'music-control-mini-player';
    container.innerHTML = `
      <div class="mini-player-header">
        <span class="mini-player-drag">⋮⋮</span>
        <span class="mini-player-title">Music Control</span>
        <button class="mini-player-expand" title="Show Playlist">▼</button>
        <button class="mini-player-close">×</button>
      </div>
      <div class="mini-player-content">
        <div class="mini-player-track">
          <div class="mini-player-track-title">No media</div>
          <div class="mini-player-track-time">0:00 / 0:00</div>
        </div>
        <div class="mini-player-controls">
          <button class="mini-btn mini-prev" title="Previous">⏮</button>
          <button class="mini-btn mini-play-pause" title="Play/Pause">▶</button>
          <button class="mini-btn mini-next" title="Next">⏭</button>
        </div>
        <div class="mini-player-progress">
          <div class="mini-player-progress-bar"></div>
        </div>
      </div>
      <div class="mini-player-playlist" style="display: none;">
        <div class="mini-playlist-header">Playlist</div>
        <div class="mini-playlist-items"></div>
      </div>
    `;

    let style = document.getElementById('music-control-mini-player-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'music-control-mini-player-style';
      style.textContent = `
      #music-control-mini-player {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 280px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #fff;
        user-select: none;
        backdrop-filter: blur(10px);
      }
      .mini-player-header {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: rgba(233, 69, 96, 0.2);
        border-radius: 12px 12px 0 0;
        cursor: move;
        gap: 8px;
      }
      .mini-player-drag {
        color: #666;
        cursor: grab;
        font-size: 14px;
      }
      .mini-player-drag:active {
        cursor: grabbing;
      }
      .mini-player-title {
        flex: 1;
        font-size: 12px;
        font-weight: 600;
        color: #e94560;
      }
      .mini-player-close {
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        line-height: 1;
      }
      .mini-player-close:hover {
        color: #e94560;
      }
      .mini-player-content {
        padding: 12px;
      }
      .mini-player-track {
        margin-bottom: 12px;
      }
      .mini-player-track-title {
        font-size: 13px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
      }
      .mini-player-track-time {
        font-size: 11px;
        color: #888;
      }
      .mini-player-controls {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .mini-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        color: #fff;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mini-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }
      .mini-btn:active {
        transform: scale(0.95);
      }
      .mini-play-pause {
        background: linear-gradient(135deg, #e94560, #ff6b6b);
        width: 44px;
        height: 44px;
        font-size: 16px;
      }
      .mini-player-progress {
        height: 3px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
        cursor: pointer;
        padding: 4px 0;
        margin: 0 -4px;
      }
      .mini-player-progress:hover {
        height: 5px;
      }
      .mini-player-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #e94560, #ff6b6b);
        width: 0%;
        transition: width 0.1s ease;
      }
      .mini-player-expand {
        background: none;
        border: none;
        color: #888;
        font-size: 12px;
        cursor: pointer;
        padding: 0 4px;
        transition: transform 0.2s;
      }
      .mini-player-expand:hover {
        color: #fff;
      }
      .mini-player-expand.expanded {
        transform: rotate(180deg);
      }
      .mini-player-playlist {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        max-height: 200px;
        overflow-y: auto;
      }
      .mini-playlist-header {
        font-size: 10px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
        padding: 8px 12px 4px;
      }
      .mini-playlist-items {
        padding: 0 8px 8px;
      }
      .mini-playlist-item {
        display: flex;
        align-items: center;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        gap: 8px;
        transition: background 0.2s;
      }
      .mini-playlist-item:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .mini-playlist-item.active {
        background: rgba(233, 69, 96, 0.2);
      }
      .mini-playlist-item-index {
        font-size: 10px;
        color: #666;
        width: 20px;
      }
      .mini-playlist-item-title {
        flex: 1;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mini-playlist-item.active .mini-playlist-item-title {
        color: #e94560;
      }
      .mini-player-playlist::-webkit-scrollbar {
        width: 4px;
      }
      .mini-player-playlist::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
      }
      .mini-player-playlist::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
      }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(container);
    miniPlayerElement = container;

    removeMiniPlayerDragHandlers = makeDraggable(container);

    container.querySelector('.mini-player-close').addEventListener('click', () => {
      toggleMiniPlayer();
    });

    container.querySelector('.mini-play-pause').addEventListener('click', async () => {
      await sendMiniPlayerCommand('playPause');
      setTimeout(updateMiniPlayer, 100);
    });

    container.querySelector('.mini-prev').addEventListener('click', async () => {
      await sendMiniPlayerCommand('previousTrack');
      setTimeout(updateMiniPlayer, 500);
    });

    container.querySelector('.mini-next').addEventListener('click', async () => {
      await sendMiniPlayerCommand('nextTrack');
      setTimeout(updateMiniPlayer, 500);
    });

    const progressContainer = container.querySelector('.mini-player-progress');
    const progressBar = container.querySelector('.mini-player-progress-bar');
    progressContainer.addEventListener('click', async (e) => {
      const rect = progressContainer.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      progressBar.style.width = (percent * 100) + '%';

      const info = await sendMiniPlayerCommand('getMediaInfo');
      if (info && info.found && info.duration) {
        const seekTime = percent * info.duration;
        await sendMiniPlayerCommand('seekTo', { time: seekTime });
        setTimeout(updateMiniPlayer, 100);
      }
    });

    const expandBtn = container.querySelector('.mini-player-expand');
    const playlistSection = container.querySelector('.mini-player-playlist');
    expandBtn.addEventListener('click', () => {
      playlistExpanded = !playlistExpanded;
      if (playlistExpanded) {
        expandBtn.classList.add('expanded');
        playlistSection.style.display = 'block';
        updateMiniPlaylist();
      } else {
        expandBtn.classList.remove('expanded');
        playlistSection.style.display = 'none';
      }
    });

    miniPlayerUpdateInterval = setInterval(updateMiniPlayer, 1000);
    updateMiniPlayer();
  }

  async function sendMiniPlayerCommand(command, data = {}) {
    if (getMediaElement()) {
      if (command === 'getMediaInfo') return getMediaInfo();
      if (command === 'playPause') return playPause();
      if (command === 'previousTrack') return previousTrack();
      if (command === 'nextTrack') return nextTrack();
      if (command === 'seekTo') return seekTo(data.time);
      if (command === 'getPlaylist') return getPlaylist();
      if (command === 'playFromPlaylist') return playFromPlaylist(data.index);
    }

    const mediaAction = command === 'previousTrack'
      ? 'previous'
      : command === 'nextTrack'
        ? 'next'
        : command;

    try {
      // The service worker owns media-tab selection, including when this page is an inactive source tab.
      return await chrome.runtime.sendMessage({
        action: 'miniPlayerCommand',
        command: mediaAction,
        data
      });
    } catch (e) {
      console.error('Mini player command error:', e);
      return null;
    }
  }

  async function updateMiniPlaylist() {
    if (!miniPlayerElement) return;
    const playlistItems = miniPlayerElement.querySelector('.mini-playlist-items');
    const playlist = await sendMiniPlayerCommand('getPlaylist');

    if (playlist && playlist.playlist && playlist.playlist.length > 0) {
      playlistItems.innerHTML = playlist.playlist.map((item, index) => `
        <div class="mini-playlist-item ${item.active ? 'active' : ''}" data-index="${index}">
          <span class="mini-playlist-item-index">${index + 1}</span>
          <span class="mini-playlist-item-title">${item.title}</span>
        </div>
      `).join('');

      playlistItems.querySelectorAll('.mini-playlist-item').forEach(item => {
        item.addEventListener('click', async () => {
          const index = parseInt(item.dataset.index);
          await sendMiniPlayerCommand('playFromPlaylist', { index });
          setTimeout(() => {
            updateMiniPlayer();
            updateMiniPlaylist();
          }, 500);
        });
      });
    } else {
      playlistItems.innerHTML = '<div style="font-size: 11px; color: #666; padding: 8px; text-align: center;">No playlist found</div>';
    }
  }

  function makeDraggable(element) {
    const header = element.querySelector('.mini-player-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    const handleMouseDown = (e) => {
      if (e.target.classList.contains('mini-player-close') || e.target.classList.contains('mini-player-expand')) return;
      isDragging = true;
      initialX = e.clientX - (parseInt(element.style.left) || 0);
      initialY = e.clientY - (parseInt(element.style.top) || 0);
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();

      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      const rect = element.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      currentX = Math.max(0, Math.min(currentX, maxX));
      currentY = Math.max(0, Math.min(currentY, maxY));

      element.style.left = currentX + 'px';
      element.style.top = currentY + 'px';
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    header.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      header.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }

  async function updateMiniPlayer() {
    const player = miniPlayerElement;
    if (!player) return;

    const info = await sendMiniPlayerCommand('getMediaInfo');
    if (player !== miniPlayerElement) return;

    const titleEl = player.querySelector('.mini-player-track-title');
    const timeEl = player.querySelector('.mini-player-track-time');
    const playPauseBtn = player.querySelector('.mini-play-pause');
    const progressBar = player.querySelector('.mini-player-progress-bar');

    if (info && info.found) {
      titleEl.textContent = info.title || 'Unknown Track';
      timeEl.textContent = `${formatTime(info.currentTime)} / ${formatTime(info.duration)}`;
      playPauseBtn.textContent = info.paused ? '▶' : '⏸';
      const progress = info.duration > 0 ? (info.currentTime / info.duration) * 100 : 0;
      progressBar.style.width = progress + '%';
    } else {
      titleEl.textContent = 'No media detected';
      timeEl.textContent = '0:00 / 0:00';
      playPauseBtn.textContent = '▶';
      progressBar.style.width = '0%';
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function toggleMiniPlayer() {
    miniPlayerEnabled = !miniPlayerEnabled;
    miniPlayerPinnedLocally = miniPlayerEnabled;
    saveMiniPlayerState(miniPlayerEnabled);
    syncMiniPlayerVisibility();
    return { enabled: miniPlayerEnabled };
  }

  function syncMiniPlayerVisibility() {
    if (miniPlayerEnabled && (settings.miniPlayerAllPages || miniPlayerPinnedLocally)) {
      createMiniPlayer();
      return;
    }

    removeMiniPlayer();
  }

  function removeMiniPlayer() {
    if (miniPlayerUpdateInterval) {
      clearInterval(miniPlayerUpdateInterval);
      miniPlayerUpdateInterval = null;
    }

    if (removeMiniPlayerDragHandlers) {
      removeMiniPlayerDragHandlers();
      removeMiniPlayerDragHandlers = null;
    }

    if (miniPlayerElement) {
      miniPlayerElement.remove();
      miniPlayerElement = null;
    }

    playlistExpanded = false;
  }

  function getMiniPlayerStatus() {
    return { enabled: miniPlayerEnabled };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let response;

    switch (message.action) {
      case 'getMediaInfo':
        response = getMediaInfo();
        break;
      case 'playPause':
        response = playPause();
        break;
      case 'stop':
        response = stop();
        break;
      case 'skip':
        response = skip(message.seconds || 0);
        break;
      case 'next':
        response = nextTrack();
        break;
      case 'previous':
        response = previousTrack();
        break;
      case 'getPlaylist':
        response = getPlaylist();
        break;
      case 'playFromPlaylist':
        response = playFromPlaylist(message.index);
        break;
      case 'setVolume':
        response = setVolume(message.volume);
        break;
      case 'seekTo':
        response = seekTo(message.time);
        break;
      case 'toggleMiniPlayer':
        response = toggleMiniPlayer();
        break;
      case 'getMiniPlayerStatus':
        response = getMiniPlayerStatus();
        break;
      default:
        response = { error: 'Unknown action' };
    }

    sendResponse(response);
    return true;
  });

})();
