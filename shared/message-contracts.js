(function(global) {
  'use strict';

  const Actions = Object.freeze({
    GET_PUBLIC_STATE: 'GET_PUBLIC_STATE',
    UPDATE_PUBLIC_SETTINGS: 'UPDATE_PUBLIC_SETTINGS',
    SET_MINI_PLAYER_ENABLED: 'SET_MINI_PLAYER_ENABLED',
    GET_YOUTUBE_KEY_STATUS: 'GET_YOUTUBE_KEY_STATUS',
    TEST_YOUTUBE_KEY: 'TEST_YOUTUBE_KEY',
    SET_YOUTUBE_KEY: 'SET_YOUTUBE_KEY',
    CLEAR_YOUTUBE_KEY: 'CLEAR_YOUTUBE_KEY',
    CLEAR_SEARCH_DATA: 'CLEAR_SEARCH_DATA',
    SAVE_PENDING_SEARCH: 'SAVE_PENDING_SEARCH',
    GET_PENDING_SEARCH: 'GET_PENDING_SEARCH',
    YOUTUBE_SEARCH: 'YOUTUBE_SEARCH',
    GET_QUEUE: 'GET_QUEUE',
    IMPORT_YOUTUBE_ALL_SUGGESTIONS: 'IMPORT_YOUTUBE_ALL_SUGGESTIONS',
    DISMISS_SUGGESTION_ITEM: 'DISMISS_SUGGESTION_ITEM',
    PLAY_YOUTUBE_VIDEO: 'PLAY_YOUTUBE_VIDEO',
    GET_MEDIA_CONTEXT: 'GET_MEDIA_CONTEXT',
    MEDIA_COMMAND: 'MEDIA_COMMAND',
    CONTENT_MEDIA_COMMAND: 'CONTENT_MEDIA_COMMAND',
    MEDIA_CONTEXT_CHANGED: 'MEDIA_CONTEXT_CHANGED',
    PUBLIC_STATE_UPDATED: 'PUBLIC_STATE_UPDATED',
    MINI_PLAYER_STATE_UPDATED: 'MINI_PLAYER_STATE_UPDATED'
  });

  const validVideoId = /^[A-Za-z0-9_-]{11}$/;
  const validSearchQuery = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 160;
  const validVideo = (value) => typeof value === 'string' && validVideoId.test(value);
  const boundedText = (value, maximum) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
  const success = (data) => ({ ok: true, data });
  const failure = (code, message, retryable = false) => ({ ok: false, error: { code, message, retryable } });

  global.MusicControlContracts = Object.freeze({
    Actions,
    validSearchQuery,
    validVideo,
    boundedText,
    success,
    failure
  });
})(globalThis);
