(function(global) {
  'use strict';

  const { failure, success } = MusicControlContracts;
  const timeoutFetch = async (url, options) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timeout); }
  };

  function cacheKey(query, locale) { return `${MusicControlSearchRanking.normalize(query)}:${locale || 'en'}`; }

  async function search(query, locale = 'en') {
    const key = cacheKey(query, locale);
    const cached = await MusicControlSearchCache.get(key);
    if (cached) return success({ results: cached, cached: true });
    const credential = await MusicControlCredentials.getKey();
    if (!credential) return failure('KEY_NOT_CONFIGURED', 'Set up a YouTube API key in Settings.');
    const params = new URLSearchParams({ part: 'snippet', type: 'video', order: 'relevance', maxResults: '10', q: query, relevanceLanguage: locale });
    try {
      const response = await timeoutFetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { headers: { 'x-goog-api-key': credential } });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const [code, message] = MusicControlSafeError.safeMessage(response.status, body?.error?.errors?.[0]?.reason);
        return failure(code, message, response.status >= 500);
      }
      const body = await response.json();
      const rows = (body.items || []).map((item) => ({
        videoId: item.id?.videoId,
        title: String(item.snippet?.title || '').slice(0, 200),
        channelTitle: String(item.snippet?.channelTitle || '').slice(0, 120),
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        publishedAt: item.snippet?.publishedAt || ''
      })).filter((item) => MusicControlContracts.validVideo(item.videoId));
      const results = MusicControlSearchRanking.rank(query, rows);
      await MusicControlSearchCache.set(key, results);
      return success({ results, cached: false });
    } catch (error) {
      return failure(error.name === 'AbortError' ? 'YOUTUBE_TIMEOUT' : 'YOUTUBE_NETWORK', 'YouTube search is unavailable right now.', true);
    }
  }

  async function test(candidate) {
    const response = await timeoutFetch('https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ', { headers: { 'x-goog-api-key': candidate } });
    if (response.ok) return success({ valid: true });
    const body = await response.json().catch(() => ({}));
    const [code, message] = MusicControlSafeError.safeMessage(response.status, body?.error?.errors?.[0]?.reason);
    return failure(code, message);
  }

  global.MusicControlYouTubeSearch = Object.freeze({ search, test });
})(globalThis);
