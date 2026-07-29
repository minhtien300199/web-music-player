(function(global) {
  'use strict';

  function safeMessage(status, reason) {
    if (status === 400 || reason === 'keyInvalid') return ['YOUTUBE_KEY_INVALID', 'The YouTube API key is invalid or restricted.'];
    if (status === 403 && reason === 'accessNotConfigured') return ['YOUTUBE_API_DISABLED', 'Enable YouTube Data API v3 for this key.'];
    if (status === 403 || status === 429 || reason === 'quotaExceeded') return ['YOUTUBE_QUOTA_EXHAUSTED', 'YouTube search quota is exhausted. Try again later.'];
    if (status === 408) return ['YOUTUBE_TIMEOUT', 'The YouTube request timed out.'];
    return ['YOUTUBE_REQUEST_FAILED', 'YouTube search is unavailable right now.'];
  }

  global.MusicControlSafeError = Object.freeze({ safeMessage });
})(globalThis);
