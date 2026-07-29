(function(global) {
  'use strict';

  let context = null;
  const isYouTubeUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com'));
    } catch (_) { return false; }
  };

  async function notify(tabId, supplied) {
    const tab = await chrome.tabs.get(tabId);
    context = { ...supplied, tabId, urlRevision: tab.url || '', provider: supplied.provider || 'other' };
    return context;
  }

  async function resolve() {
    if (context?.tabId) {
      try {
        const tab = await chrome.tabs.get(context.tabId);
        if (tab.url === context.urlRevision) return context;
      } catch (_) {}
    }
    const audible = await chrome.tabs.query({ audible: true });
    const tab = audible[0] || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!tab?.id) return null;
    return { tabId: tab.id, urlRevision: tab.url || '', provider: isYouTubeUrl(tab.url) ? 'youtube' : 'other' };
  }

  async function send(command, data = {}) {
    const active = await resolve();
    if (!active) return { found: false, error: 'No media tab found' };
    try {
      return await chrome.tabs.sendMessage(active.tabId, { action: 'CONTENT_MEDIA_COMMAND', command, data });
    } catch (_) {
      context = null;
      return { found: false, error: 'No media tab found' };
    }
  }

  async function playVideo(videoId, preferredTabId = null) {
    let target = null;
    if (preferredTabId) {
      try {
        const preferred = await chrome.tabs.get(preferredTabId);
        if (isYouTubeUrl(preferred.url)) target = { tabId: preferred.id, urlRevision: preferred.url, provider: 'youtube' };
      } catch (_) {}
    }
    if (!target) target = await resolve();
    if (!target || !isYouTubeUrl(target.urlRevision)) {
      const tabs = await chrome.tabs.query({ url: ['https://*.youtube.com/*', 'https://youtube.com/*'] });
      target = tabs[0] ? { tabId: tabs[0].id, urlRevision: tabs[0].url, provider: 'youtube' } : null;
    }
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    const tab = target ? await chrome.tabs.update(target.tabId, { url, active: true }) : await chrome.tabs.create({ url, active: true });
    context = { tabId: tab.id, urlRevision: url, provider: 'youtube', videoId };
    return { videoId, tabId: tab.id };
  }

  global.MusicControlRouter = Object.freeze({ notify, resolve, send, playVideo, isYouTubeUrl });
})(globalThis);
