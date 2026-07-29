(function(global) {
  'use strict';

  let settings = { sources: { youtube: true, spotify: false, soundcloud: false, other: false }, miniPlayerAllPages: true };
  let lastSignature = '';

  const host = () => window.location.hostname;
  const isHost = (name) => host() === name || host().endsWith(`.${name}`);
  const provider = () => isHost('youtube.com') ? 'youtube' : isHost('spotify.com') ? 'spotify' : isHost('soundcloud.com') ? 'soundcloud' : 'other';
  const isEnabled = () => settings.sources?.[provider()] === true;
  const getVideoId = () => {
    if (!isHost('youtube.com')) return null;
    try { return new URL(window.location.href).searchParams.get('v'); } catch (_) { return null; }
  };

  function setSettings(next) { settings = next || settings; }
  function media() {
    if (!isEnabled()) return null;
    const elements = [...document.querySelectorAll('video'), ...document.querySelectorAll('audio')];
    return elements.find((item) => !item.paused || item.currentTime > 0) || elements[0] || null;
  }
  function info() {
    const element = media();
    if (!element) return { found: false };
    let title = document.title;
    let artist = '';
    if (navigator.mediaSession?.metadata) {
      title = navigator.mediaSession.metadata.title || title;
      artist = navigator.mediaSession.metadata.artist || '';
    }
    if (isHost('youtube.com')) {
      title = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title')?.textContent?.trim() || title;
      artist = document.querySelector('#channel-name a, .ytd-channel-name a')?.textContent?.trim() || artist;
    }
    const value = { found: true, provider: provider(), videoId: getVideoId(), title, artist, currentTime: element.currentTime, duration: element.duration, paused: element.paused, volume: element.volume };
    const signature = `${value.provider}:${value.videoId || value.title}:${value.paused}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      chrome.runtime.sendMessage({
        action: MusicControlContracts.Actions.MEDIA_CONTEXT_CHANGED,
        context: { ...value, documentNonce: global.MusicControlYouTubeAllSuggestions?.documentNonce }
      }).catch(() => {});
    }
    return value;
  }
  function click(selector) { const button = document.querySelector(selector); if (button) { button.click(); return { success: true }; } return { success: false }; }
  function next() { return isHost('youtube.com') ? click('.ytp-next-button, a.ytp-next-button') : isHost('spotify.com') ? click('[data-testid="control-button-skip-forward"], button[aria-label="Next"]') : isHost('soundcloud.com') ? click('.skipControl__next, button[aria-label="Next"]') : { success: false }; }
  function previous() {
    if (isHost('youtube.com')) return click('.ytp-prev-button, a.ytp-prev-button');
    if (isHost('spotify.com')) return click('[data-testid="control-button-skip-back"], button[aria-label="Previous"]');
    if (isHost('soundcloud.com')) return click('.skipControl__previous, button[aria-label="Previous"]');
    const element = media(); if (element) { element.currentTime = 0; return { success: true }; } return { success: false };
  }
  function bounded(value, limit) { return Math.max(0, Math.min(limit || Infinity, Number(value) || 0)); }
  function command(name, data = {}) {
    const element = media();
    if (name === 'getMediaInfo') return info();
    if (name === 'next') return next();
    if (name === 'previous') return previous();
    if (!element) return { success: false, found: false };
    if (name === 'playPause') { element.paused ? element.play() : element.pause(); return { success: true, paused: element.paused }; }
    if (name === 'stop') { element.pause(); element.currentTime = 0; return { success: true }; }
    if (name === 'skip') { element.currentTime = bounded(element.currentTime + Number(data.seconds || 0), element.duration); return { success: true }; }
    if (name === 'seekTo') {
      if (!Number.isFinite(Number(data.time)) || !Number.isFinite(element.duration) || element.duration <= 0) return { success: false };
      element.currentTime = bounded(data.time, element.duration); return { success: true };
    }
    if (name === 'setVolume') { element.volume = Math.max(0, Math.min(1, Number(data.volume))); return { success: true, volume: element.volume }; }
    return { success: false, error: 'Unknown media command' };
  }
  global.MusicControlMedia = Object.freeze({ setSettings, info, command, provider, getVideoId, isEnabled });
})(globalThis);
