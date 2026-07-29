(function(global) {
  'use strict';

  const clamp = (value, maximum) => Math.max(0, Math.min(maximum, Number(value) || 0));
  const format = (value) => !Number.isFinite(value) || value < 0
    ? '0:00'
    : `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

  function create({ track, fill, currentTimeLabel, durationLabel, commit, onError }) {
    let duration = 0;
    let currentTime = 0;
    let authoritativeTime = 0;
    let dragging = false;
    let pointerId = null;
    let disposed = false;
    const enabled = () => Number.isFinite(duration) && duration > 0;
    const timeAt = (event) => {
      const rect = track.getBoundingClientRect();
      if (!rect.width) return null;
      return clamp(((event.clientX - rect.left) / rect.width) * duration, duration);
    };
    const render = (time) => {
      const value = enabled() ? clamp(time, duration) : 0;
      fill.style.width = enabled() ? `${(value / duration) * 100}%` : '0%';
      currentTimeLabel.textContent = format(value);
      durationLabel.textContent = format(duration);
      track.setAttribute('aria-valuemax', String(Math.floor(duration)));
      track.setAttribute('aria-valuenow', String(Math.floor(value)));
      track.setAttribute('aria-valuetext', `${format(value)} of ${format(duration)}`);
      track.setAttribute('aria-disabled', String(!enabled()));
    };
    const preview = (event) => {
      const value = timeAt(event);
      if (value === null) return null;
      currentTime = value; render(value); return value;
    };
    const cancel = () => {
      if (!dragging) return;
      dragging = false; pointerId = null; track.classList.remove('dragging');
      currentTime = authoritativeTime; render(currentTime);
    };
    const onPointerDown = (event) => {
      if (disposed || !enabled() || event.isPrimary === false || event.button !== 0 || timeAt(event) === null) return;
      event.preventDefault(); dragging = true; pointerId = event.pointerId; track.classList.add('dragging');
      track.setPointerCapture?.(pointerId); preview(event);
    };
    const onPointerMove = (event) => {
      if (dragging && event.pointerId === pointerId) preview(event);
    };
    const onPointerUp = async (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const value = preview(event);
      const releasedId = pointerId;
      dragging = false; pointerId = null; track.classList.remove('dragging');
      track.releasePointerCapture?.(releasedId);
      if (value === null) return render(authoritativeTime);
      try { await commit(value); } catch (_) { currentTime = authoritativeTime; render(currentTime); onError?.(); }
    };
    const onPointerCancel = (event) => {
      if (event.pointerId === pointerId) cancel();
    };
    const onLostCapture = (event) => {
      if (event.pointerId === pointerId) cancel();
    };
    const onKeyDown = async (event) => {
      if (!enabled()) return;
      const changes = {
        ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5,
        PageDown: -30, PageUp: 30, Home: -Infinity, End: Infinity
      };
      if (!(event.key in changes)) return;
      event.preventDefault();
      const change = changes[event.key];
      const value = change === -Infinity ? 0 : change === Infinity ? duration : clamp(currentTime + change, duration);
      currentTime = value; render(value);
      try { await commit(value); } catch (_) { currentTime = authoritativeTime; render(currentTime); onError?.(); }
    };
    const listeners = [
      ['pointerdown', onPointerDown], ['pointermove', onPointerMove], ['pointerup', onPointerUp],
      ['pointercancel', onPointerCancel], ['lostpointercapture', onLostCapture], ['keydown', onKeyDown]
    ];
    listeners.forEach(([name, handler]) => track.addEventListener(name, handler));

    function updateMedia(info) {
      duration = Number.isFinite(info?.duration) && info.duration > 0 ? info.duration : 0;
      authoritativeTime = duration ? clamp(info?.currentTime, duration) : 0;
      if (dragging && !enabled()) return cancel();
      if (!dragging) { currentTime = authoritativeTime; render(currentTime); }
      else {
        durationLabel.textContent = format(duration);
        track.setAttribute('aria-valuemax', String(Math.floor(duration)));
        track.setAttribute('aria-disabled', 'false');
      }
    }
    function dispose() {
      disposed = true; cancel();
      listeners.forEach(([name, handler]) => track.removeEventListener(name, handler));
    }
    render(0);
    return Object.freeze({ updateMedia, dispose });
  }

  global.MusicControlProgressSeek = Object.freeze({ create });
})(globalThis);
