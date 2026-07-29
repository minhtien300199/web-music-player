(function(global) {
  'use strict';

  let settings = { miniPlayerAllPages: true };
  let enabled = false;
  let pinnedHere = false;
  let element = null;
  let interval = null;
  let removeDrag = null;
  let expanded = false;
  const make = (tag, className, value) => { const node = document.createElement(tag); node.className = className; if (value) node.textContent = value; return node; };
  const format = (seconds) => !Number.isFinite(seconds) || seconds < 0 ? '0:00' : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  function setState(state) { settings = state.settings || settings; enabled = state.miniPlayerEnabled === true; sync(); }
  async function media(command, data) { const response = await chrome.runtime.sendMessage({ action: MusicControlContracts.Actions.MEDIA_COMMAND, command, data }); return response?.ok ? response.data : null; }
  async function setEnabled(next) { await chrome.runtime.sendMessage({ action: MusicControlContracts.Actions.SET_MINI_PLAYER_ENABLED, enabled: next }); }
  function button(className, label, text) { const node = make('button', className, text); node.type = 'button'; node.setAttribute('aria-label', label); return node; }

  function create() {
    if (element) return;
    const root = make('aside', 'music-control-mini-player'); root.id = 'music-control-mini-player'; root.setAttribute('aria-label', 'Music Control mini player');
    const header = make('div', 'mini-player-header'); const title = make('span', 'mini-player-title', 'Music Control'); const expand = button('mini-player-expand', 'Show playlist', '⌄'); const close = button('mini-player-close', 'Close mini player', '×');
    header.append(make('span', 'mini-player-drag', '⋮⋮'), title, expand, close);
    const content = make('div', 'mini-player-content'); const track = make('div', 'mini-player-track'); const trackTitle = make('div', 'mini-player-track-title', 'No media'); const trackTime = make('div', 'mini-player-track-time', '0:00 / 0:00'); track.append(trackTitle, trackTime);
    const controls = make('div', 'mini-player-controls'); const prev = button('mini-btn mini-prev', 'Previous track', '⏮'); const play = button('mini-btn mini-play-pause', 'Play or pause', '▶'); const next = button('mini-btn mini-next', 'Next track', '⏭'); controls.append(prev, play, next);
    const progress = make('button', 'mini-player-progress'); progress.type = 'button'; progress.setAttribute('aria-label', 'Seek playback'); const progressBar = make('span', 'mini-player-progress-bar'); progress.append(progressBar); content.append(track, controls, progress);
    const playlist = make('section', 'mini-player-playlist'); playlist.hidden = true; const playlistItems = make('div', 'mini-playlist-items'); playlist.append(make('div', 'mini-playlist-header', 'Playlist'), playlistItems); root.append(header, content, playlist); document.body.appendChild(root); element = root;
    close.addEventListener('click', () => setEnabled(false));
    play.addEventListener('click', () => media('playPause').then(() => refresh()));
    prev.addEventListener('click', () => media('previous').then(() => refresh()));
    next.addEventListener('click', () => media('next').then(() => refresh()));
    progress.addEventListener('click', async (event) => { const rect = progress.getBoundingClientRect(); const info = await media('getMediaInfo'); if (info?.found && info.duration) media('seekTo', { time: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * info.duration }); });
    expand.addEventListener('click', () => { expanded = !expanded; playlist.hidden = !expanded; expand.classList.toggle('expanded', expanded); if (expanded) refreshPlaylist(); });
    removeDrag = draggable(root, header); interval = setInterval(refresh, 1000); refresh();
  }

  async function refresh() {
    if (!element) return;
    const info = await media('getMediaInfo'); if (!element) return;
    const title = element.querySelector('.mini-player-track-title'); const time = element.querySelector('.mini-player-track-time'); const play = element.querySelector('.mini-play-pause'); const bar = element.querySelector('.mini-player-progress-bar');
    title.textContent = info?.found ? info.title || 'Unknown Track' : 'No media detected'; time.textContent = info?.found ? `${format(info.currentTime)} / ${format(info.duration)}` : '0:00 / 0:00'; play.textContent = info?.found && !info.paused ? '⏸' : '▶'; bar.style.width = info?.duration ? `${(info.currentTime / info.duration) * 100}%` : '0%';
  }
  async function refreshPlaylist() {
    if (!element || !expanded) return;
    const queue = await media('getQueue'); const target = element.querySelector('.mini-playlist-items'); target.replaceChildren();
    (queue?.items || []).forEach((item, index) => { const row = button(`mini-playlist-item${item.active ? ' active' : ''}`, `Play ${item.title}`, ''); row.append(make('span', 'mini-playlist-item-index', String(index + 1)), make('span', 'mini-playlist-item-title', item.title)); row.addEventListener('click', () => media('playQueueItem', { target: item.playTarget }).then(() => refresh())); target.appendChild(row); });
    if (!target.children.length) target.appendChild(make('div', 'mini-playlist-empty', 'No playlist found'));
  }
  function draggable(root, header) {
    let dragging = false; let offsetX = 0; let offsetY = 0;
    const down = (event) => { if (event.target.closest('button')) return; dragging = true; offsetX = event.clientX - (parseInt(root.style.left, 10) || root.getBoundingClientRect().left); offsetY = event.clientY - (parseInt(root.style.top, 10) || root.getBoundingClientRect().top); };
    const move = (event) => { if (!dragging) return; const rect = root.getBoundingClientRect(); root.style.left = `${Math.max(0, Math.min(event.clientX - offsetX, window.innerWidth - rect.width))}px`; root.style.top = `${Math.max(0, Math.min(event.clientY - offsetY, window.innerHeight - rect.height))}px`; root.style.right = 'auto'; root.style.bottom = 'auto'; };
    const up = () => { dragging = false; }; header.addEventListener('mousedown', down); document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); return () => { header.removeEventListener('mousedown', down); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
  }
  function sync() { if (enabled && (settings.miniPlayerAllPages || pinnedHere)) create(); else remove(); }
  function remove() { if (interval) clearInterval(interval); interval = null; removeDrag?.(); removeDrag = null; element?.remove(); element = null; expanded = false; }
  function toggleHere() { pinnedHere = !enabled; setEnabled(!enabled); return { enabled: !enabled }; }
  global.MusicControlMiniPlayer = Object.freeze({ setState, toggleHere, status: () => ({ enabled }) });
})(globalThis);
