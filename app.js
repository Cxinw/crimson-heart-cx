import { startHeart } from './heart.js?v=8';
import { startHeart as startVideo } from './video-player.js';

let scene;
const playback = document.getElementById('playback');
const canvas = document.getElementById('heart');
const fallback = document.getElementById('heart-fallback');
function useVideoFallback() {
  if (scene?.renderer === 'reference-motion') return;
  if (scene) scene.destroy();
  canvas.hidden = true;
  fallback.hidden = false;
  fallback.src = fallback.dataset.src;
  scene = startVideo(fallback);
  window.heartScene = scene;
}
try {
  scene = startHeart(canvas);
  if (scene.renderer === 'canvas2d') useVideoFallback();
  window.heartScene = scene;
} catch (error) {
  console.warn('Using compatible animation playback:', error.message);
  useVideoFallback();
}
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  useVideoFallback();
});
fallback.addEventListener('error', () => {
  if (!fallback.hidden) document.getElementById('render-error').hidden = false;
});
let paused = false;
playback.addEventListener('click', () => {
  if (!scene) return;
  paused = !paused;
  if (paused) scene.pause(); else scene.resume();
  document.getElementById('pause-icon').hidden = paused;
  document.getElementById('play-icon').hidden = !paused;
  const label = paused ? '播放动画' : '暂停动画';
  playback.setAttribute('aria-label', label);
  playback.title = label;
});

const audio = document.getElementById('bgm');
const music = document.getElementById('music-toggle');
const status = document.getElementById('music-status');
const hint = document.getElementById('hint');
let userPausedMusic = false;
let musicAvailable = false;
let attempting = false;

function updateMusicState(playing) {
  music.dataset.playing = String(playing);
  music.setAttribute('aria-pressed', String(playing));
  music.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
  music.querySelector('.music-play').innerHTML = playing
    ? '<path d="M9 6v12M15 6v12"/>' : '<path d="m9 6 9 6-9 6Z"/>';
}
async function playMusic() {
  if (!musicAvailable || attempting) return;
  attempting = true;
  try {
    await audio.play();
    status.textContent = '礼越 · 正在播放';
    hint.textContent = '';
    updateMusicState(true);
  } catch (error) {
    updateMusicState(false);
    if (error.name === 'NotAllowedError') {
      status.textContent = '轻触开启音乐';
      hint.textContent = '轻触屏幕，让心动有声音';
    } else {
      status.textContent = '音乐暂未加载';
      hint.textContent = '轻触音乐按钮重试';
    }
  } finally { attempting = false; }
}
audio.addEventListener('playing', () => {
  updateMusicState(true);
  status.textContent = '礼越 · 正在播放';
  hint.textContent = '';
});
audio.addEventListener('pause', () => {
  updateMusicState(false);
  if (musicAvailable && !audio.error) status.textContent = '礼越 · 已暂停';
});
audio.addEventListener('error', () => {
  updateMusicState(false);
  status.textContent = '音乐暂未加载';
  hint.textContent = '轻触音乐按钮重试';
});
music.addEventListener('click', () => {
  if (!musicAvailable) {
    hint.textContent = '等待添加《静音恋人》的音频文件';
    return;
  }
  if (audio.paused) {
    userPausedMusic = false;
    if (audio.error) audio.load();
    playMusic();
  } else {
    userPausedMusic = true;
    audio.pause();
    hint.textContent = '';
  }
});
function unlockMusic(event) {
  if (event.target.closest('button') || userPausedMusic || !audio.paused) return;
  playMusic();
}
document.addEventListener('pointerdown', unlockMusic);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') unlockMusic(event);
});

try {
  const config = await fetch('./music.json', { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error('Music configuration unavailable');
    return response.json();
  });
  if (config.src) {
    musicAvailable = true;
    audio.src = config.src;
    audio.volume = 0.7;
    await playMusic();
  } else {
    status.textContent = '音乐待添加';
    music.setAttribute('aria-label', '背景音乐尚未添加');
  }
} catch {
  status.textContent = '音乐暂未加载';
  hint.textContent = '刷新网页重试';
}
