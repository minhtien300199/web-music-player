(function() {
  'use strict';

  const { Actions } = MusicControlContracts;

  function applyState(state) {
    MusicControlMedia.setSettings(state.settings);
    MusicControlYouTubeAllSuggestions.setEnabled(state.settings?.youtubeAllImportEnabled);
    MusicControlMiniPlayer.setState(state);
  }

  async function loadState() {
    const result = await chrome.runtime.sendMessage({ action: Actions.GET_PUBLIC_STATE });
    if (result?.ok) applyState(result.data);
  }

  function respond(command, data) {
    if (command === 'getQueue') return MusicControlQueue.getQueue();
    if (command === 'playQueueItem') return MusicControlQueue.play(data.target);
    if (command === 'getYouTubeAllSuggestions') return MusicControlYouTubeAllSuggestions.extract();
    return MusicControlMedia.command(command, data);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === Actions.CONTENT_MEDIA_COMMAND) {
      sendResponse(respond(message.command, message.data || {}));
      return true;
    }
    if (message.action === Actions.PUBLIC_STATE_UPDATED || message.action === Actions.MINI_PLAYER_STATE_UPDATED) {
      applyState(message.state || message);
      return false;
    }
    return false;
  });

  loadState().then(() => {
    const info = MusicControlMedia.info();
    chrome.runtime.sendMessage({
      action: Actions.MEDIA_CONTEXT_CHANGED,
      context: { ...info, documentNonce: MusicControlYouTubeAllSuggestions.documentNonce }
    }).catch(() => {});
  }).catch(() => {});
})();
