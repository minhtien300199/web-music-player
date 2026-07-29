(function(global) {
  'use strict';

  const youtube = () => window.location.hostname === 'youtube.com' || window.location.hostname.endsWith('.youtube.com');
  const spotify = () => window.location.hostname === 'open.spotify.com' || window.location.hostname.endsWith('.spotify.com');
  const text = (element) => element?.textContent?.trim() || '';
  const youtubeItems = () => [...document.querySelectorAll('ytd-playlist-panel-video-renderer, #playlist-items ytd-playlist-video-renderer')].map((row, index) => {
    const anchor = row.querySelector('a#wc-endpoint, a[href*="watch?v="]');
    let videoId = null; try { videoId = new URL(anchor?.href || '', window.location.href).searchParams.get('v'); } catch (_) {}
    return { id: videoId || `youtube-${index}`, source: 'playlist', title: text(row.querySelector('#video-title')), artist: text(row.querySelector('#byline, .ytd-channel-name')), active: row.hasAttribute('selected') || row.classList.contains('ytd-playlist-panel-video-renderer--playing'), playTarget: videoId ? { kind: 'youtube-video', videoId } : { kind: 'provider-index', provider: 'youtube', index, playlistFingerprint: window.location.href } };
  }).filter((item) => item.title);
  const spotifyItems = () => [...document.querySelectorAll('[data-testid="tracklist-row"]')].map((row, index) => ({
    id: `spotify-${index}`, source: 'playlist', title: text(row.querySelector('[data-testid="internal-track-link"] div')), artist: text(row.querySelector('a[href*="/artist/"]')), active: Boolean(row.querySelector('[aria-label="Now playing"]')), playTarget: { kind: 'provider-index', provider: 'spotify', index, playlistFingerprint: window.location.href }
  })).filter((item) => item.title);
  function getQueue() {
    const items = youtube() ? youtubeItems() : spotify() ? spotifyItems() : [];
    return items.length ? { source: 'playlist', label: 'Playlist', items, currentVideoId: MusicControlMedia.getVideoId() } : { source: 'native-next', label: 'No queue', items: [], currentVideoId: MusicControlMedia.getVideoId() };
  }
  function play(target) {
    if (target?.kind === 'youtube-video') {
      const anchor = [...document.querySelectorAll('a[href*="watch?v="]')].find((item) => new URL(item.href, location.href).searchParams.get('v') === target.videoId);
      if (anchor) { anchor.click(); return { success: true }; }
    }
    if (target?.kind === 'provider-index') {
      const rows = target.provider === 'spotify' ? document.querySelectorAll('[data-testid="tracklist-row"]') : document.querySelectorAll('ytd-playlist-panel-video-renderer a#wc-endpoint, #playlist-items ytd-playlist-video-renderer a');
      const row = rows[target.index]; if (row) { (row.querySelector?.('button[data-testid="play-button"]') || row).click(); return { success: true }; }
    }
    return { success: false };
  }
  global.MusicControlQueue = Object.freeze({ getQueue, play });
})(globalThis);
