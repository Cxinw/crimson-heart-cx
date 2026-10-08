// The reference's particle motion, isolated and recolored red.
export function startHeart(video) {
  let destroyed = false;
  let requestedPlay = true;
  const tryPlay = () => {
    if (destroyed || !requestedPlay) return;
    const attempt = video.play();
    if (attempt) attempt.catch(() => { /* Some low-power modes require a touch. */ });
  };
  const unlock = () => { if (requestedPlay && video.paused) tryPlay(); };
  video.muted = true;
  video.defaultMuted = true;
  video.addEventListener('canplay', tryPlay);
  document.addEventListener('pointerdown', unlock);
  const api = {
    pause() { requestedPlay = false; video.pause(); },
    resume() { requestedPlay = true; tryPlay(); },
    reset() { video.currentTime = 0; if (requestedPlay) tryPlay(); },
    setTime(seconds) { api.pause(); video.currentTime = Math.max(0, Number(seconds) || 0); },
    get time() { return video.currentTime; },
    get duration() { return video.duration || 10.89; },
    get renderer() { return 'reference-motion'; },
    destroy() {
      destroyed = true; api.pause();
      video.removeEventListener('canplay', tryPlay);
      document.removeEventListener('pointerdown', unlock);
    }
  };
  tryPlay();
  return api;
}
