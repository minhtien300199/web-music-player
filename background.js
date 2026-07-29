importScripts(
  'shared/message-contracts.js',
  'shared/youtube-search-ranking.js',
  'background/safe-error.js',
  'background/storage-broker.js',
  'background/message-sender-policy.js',
  'background/youtube-credential-store.js',
  'background/youtube-search-cache.js',
  'background/suggestion-queue-store.js',
  'background/media-tab-router.js',
  'background/youtube-search-service.js'
);

const { Actions, boundedText, validSearchQuery, validVideo, success, failure } = MusicControlContracts;
const { isExtensionPage, isContentScript } = MusicControlSenderPolicy;
const send = (sendResponse, value) => { sendResponse(value); };

async function broadcastState(action) {
  const state = await MusicControlStorage.getPublicState();
  await MusicControlStorage.broadcast(action, { state });
}

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0] || null;
}

async function queueForActiveTab() {
  const tab = await activeTab();
  const isYouTube = MusicControlRouter.isYouTubeUrl(tab?.url);
  const publicState = await MusicControlStorage.getPublicState();
  const metadata = { canImport: isYouTube, importEnabled: publicState.settings.youtubeAllImportEnabled };
  if (!tab?.id) return success({ source: 'native-next', label: 'No queue', items: [], ...metadata });
  try {
    const explicit = await chrome.tabs.sendMessage(tab.id, { action: Actions.CONTENT_MEDIA_COMMAND, command: 'getQueue', data: {} });
    if (explicit?.source === 'playlist' && explicit.items?.length) return success({ ...explicit, ...metadata });
  } catch (_) {}
  if (metadata.importEnabled) {
    const suggestions = await MusicControlSuggestionQueue.getForTab(tab.id);
    if (suggestions) return success({ ...suggestions, ...metadata });
  }
  return success({ source: 'native-next', label: 'No queue', items: [], ...metadata });
}

function normalizeSuggestion(item) {
  const videoId = item?.videoId;
  const title = boundedText(item?.title, 160);
  if (!validVideo(videoId) || !title) return null;
  return {
    id: videoId,
    videoId,
    source: 'youtube-all',
    title,
    artist: boundedText(item?.artist, 100),
    active: false,
    playTarget: { kind: 'youtube-video', videoId }
  };
}

async function importYouTubeAll() {
  const state = await MusicControlStorage.getPublicState();
  if (!state.settings.youtubeAllImportEnabled) return failure('FEATURE_DISABLED', 'Enable YouTube All suggestions in Settings first.');
  const tab = await activeTab();
  if (!tab?.id || !MusicControlRouter.isYouTubeUrl(tab.url)) return failure('UNSUPPORTED_TAB', 'Open YouTube Home or a watch page in the active tab.');
  let snapshot;
  try {
    snapshot = await chrome.tabs.sendMessage(tab.id, {
      action: Actions.CONTENT_MEDIA_COMMAND,
      command: 'getYouTubeAllSuggestions',
      data: {}
    });
  } catch (_) {
    return failure('CONTENT_UNAVAILABLE', 'Reload the YouTube tab, then try again.');
  }
  const statusMessages = {
    disabled: 'Enable YouTube All suggestions in Settings first.',
    loading: 'YouTube is still loading. Try again shortly.',
    unsupported: 'This YouTube page does not expose a supported suggestions surface.',
    'non-all': 'Select the All chip on YouTube, then import again.',
    stale: 'YouTube changed while importing. Try again.',
    empty: 'No supported visible videos were found in YouTube All.'
  };
  if (snapshot?.status !== 'ready') return failure(`IMPORT_${String(snapshot?.status || 'FAILED').toUpperCase().replace('-', '_')}`, statusMessages[snapshot?.status] || 'Could not import YouTube suggestions.');
  const items = snapshot.items.map(normalizeSuggestion).filter(Boolean).slice(0, 20);
  if (!items.length) return failure('IMPORT_EMPTY', statusMessages.empty);
  const current = await chrome.tabs.get(tab.id);
  if (current.url !== tab.url) return failure('STALE_MEDIA_CONTEXT', 'The active YouTube page changed. Try again.');
  const value = await MusicControlSuggestionQueue.save({
    sourceTabId: tab.id,
    sourceDocumentNonce: boundedText(snapshot.documentNonce, 100),
    sourceRevision: boundedText(snapshot.sourceRevision, 4000),
    items
  });
  return success({ ...value, canImport: true, importEnabled: true });
}

chrome.runtime.onInstalled.addListener(() => MusicControlStorage.initializeStorageAccess().catch(() => {}));
chrome.runtime.onStartup.addListener(() => MusicControlStorage.initializeStorageAccess().catch(() => {}));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) MusicControlSuggestionQueue.handleNavigation(tabId, changeInfo.url).catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => MusicControlSuggestionQueue.clearTab(tabId).catch(() => {}));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const action = message?.action;
    if (action === Actions.MEDIA_CONTEXT_CHANGED && isContentScript(sender)) {
      const supplied = message.context || {};
      if (typeof supplied.documentNonce === 'string' && supplied.documentNonce) {
        await MusicControlSuggestionQueue.handleDocument(sender.tab.id, supplied.documentNonce, supplied.videoId);
      }
      return success(await MusicControlRouter.notify(sender.tab.id, supplied));
    }
    if (action === Actions.GET_PUBLIC_STATE && (isExtensionPage(sender) || isContentScript(sender))) return success(await MusicControlStorage.getPublicState());
    if (action === Actions.UPDATE_PUBLIC_SETTINGS && isExtensionPage(sender)) {
      const state = await MusicControlStorage.updateSettings(message.settings);
      if (!state.settings.youtubeAllImportEnabled) await MusicControlSuggestionQueue.clearAll();
      await broadcastState(Actions.PUBLIC_STATE_UPDATED); return success(state);
    }
    if (action === Actions.SET_MINI_PLAYER_ENABLED && (isExtensionPage(sender) || isContentScript(sender))) {
      const state = await MusicControlStorage.setMiniPlayerEnabled(message.enabled); await broadcastState(Actions.MINI_PLAYER_STATE_UPDATED); return success(state);
    }
    if (action === Actions.MEDIA_COMMAND && (isExtensionPage(sender) || isContentScript(sender))) return success(await MusicControlRouter.send(message.command, message.data || {}));
    if (action === Actions.GET_MEDIA_CONTEXT && isExtensionPage(sender)) return success(await MusicControlRouter.resolve());
    if (action === Actions.GET_QUEUE && isExtensionPage(sender)) return queueForActiveTab();
    if (action === Actions.IMPORT_YOUTUBE_ALL_SUGGESTIONS && isExtensionPage(sender)) return importYouTubeAll();
    if (action === Actions.DISMISS_SUGGESTION_ITEM && isExtensionPage(sender)) {
      if (!validVideo(message.videoId)) return failure('INVALID_VIDEO', 'Invalid YouTube video.');
      const tab = await activeTab();
      const value = tab?.id ? await MusicControlSuggestionQueue.dismiss(tab.id, message.videoId) : null;
      return value ? success({ ...value, canImport: true, importEnabled: true }) : failure('STALE_QUEUE', 'The suggestion list is no longer available.');
    }
    if (action === Actions.PLAY_YOUTUBE_VIDEO && isExtensionPage(sender)) {
      if (!validVideo(message.videoId)) return failure('INVALID_VIDEO', 'Invalid YouTube video.');
      const tab = await activeTab();
      const marked = tab?.id ? await MusicControlSuggestionQueue.markPlayback(tab.id, message.videoId) : false;
      return success(await MusicControlRouter.playVideo(message.videoId, marked ? tab.id : null));
    }
    if (action === Actions.GET_YOUTUBE_KEY_STATUS && isExtensionPage(sender)) return success(await MusicControlCredentials.status());
    if (action === Actions.TEST_YOUTUBE_KEY && isExtensionPage(sender)) return validSearchQuery(message.key) ? MusicControlYouTubeSearch.test(message.key.trim()) : failure('INVALID_KEY', 'Enter an API key first.');
    if (action === Actions.SET_YOUTUBE_KEY && isExtensionPage(sender)) {
      if (!validSearchQuery(message.key)) return failure('INVALID_KEY', 'Enter an API key first.');
      const tested = await MusicControlYouTubeSearch.test(message.key.trim()); if (!tested.ok) return tested;
      return success(await MusicControlCredentials.replace(message.key.trim(), message.persistence));
    }
    if (action === Actions.CLEAR_YOUTUBE_KEY && isExtensionPage(sender)) {
      await MusicControlCredentials.clear(); await MusicControlSearchCache.clear(); await chrome.storage.session.remove(['youtubePendingSearch', 'youtubeSelectionHistory']); return success({ cleared: true });
    }
    if (action === Actions.CLEAR_SEARCH_DATA && isExtensionPage(sender)) {
      await MusicControlSearchCache.clear(); await chrome.storage.session.remove(['youtubePendingSearch', 'youtubeSelectionHistory']); return success({ cleared: true });
    }
    if (action === Actions.SAVE_PENDING_SEARCH && isExtensionPage(sender)) {
      const pending = validSearchQuery(message.query) ? { query: message.query.trim(), expiresAt: Date.now() + 10 * 60 * 1000 } : null;
      if (pending) await chrome.storage.session.set({ youtubePendingSearch: pending });
      return success({ saved: Boolean(pending) });
    }
    if (action === Actions.GET_PENDING_SEARCH && isExtensionPage(sender)) {
      const pending = (await chrome.storage.session.get('youtubePendingSearch')).youtubePendingSearch;
      return success(pending?.expiresAt > Date.now() ? pending : null);
    }
    if (action === Actions.YOUTUBE_SEARCH && isExtensionPage(sender)) return validSearchQuery(message.query) ? MusicControlYouTubeSearch.search(message.query.trim(), message.locale || 'en') : failure('INVALID_QUERY', 'Enter a song title or artist.');
    return failure('UNAUTHORIZED', 'This action is not available here.');
  })().then((value) => send(sendResponse, value)).catch(() => send(sendResponse, failure('REQUEST_FAILED', 'The extension could not complete that request.')));
  return true;
});
