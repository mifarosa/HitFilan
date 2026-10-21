// A small YouTube player docked in the workout screen. Loaded lazily: nothing is
// downloaded or created until the user adds a video.
import { parseYouTube, watchUrl, thumbUrl, playerErrorText, embedVerdict } from './video-core.js';

const KEY = 'hitfilan.videos';
const MAX_RECENT = 6;

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

let apiPromise = null;
let player = null;
let current = null; // { kind, id, title }
let collapsed = false;
let runnerEl = null;

function loadRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveRecent(entry) {
  const list = [entry, ...loadRecent().filter((v) => !(v.kind === entry.kind && v.id === entry.id))].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage unavailable */ }
}

function loadApi() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      if (window.YT?.Player) return resolve(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => reject(new Error('api'));
      document.head.append(s);
    }).catch((err) => {
      apiPromise = null;
      throw err;
    });
  }
  return apiPromise;
}

// Asks YouTube whether the video can be embedded; network or CORS trouble means "unknown".
async function checkEmbeddable(v) {
  if (v.kind !== 'video') return { verdict: 'ok', title: '' };
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(v))}`);
    const verdict = embedVerdict(res.status);
    const title = res.ok ? (await res.json()).title || '' : '';
    return { verdict, title };
  } catch {
    return { verdict: 'unknown', title: '' };
  }
}

/* ---------- Dock ---------- */

function dock() {
  return $('#video-dock');
}

// One place decides which layout the workout screen uses.
function syncMode() {
  runnerEl.classList.toggle('has-video', !!current);
  runnerEl.classList.toggle('video-on', !!current && !collapsed);
  runnerEl.classList.toggle('video-mini', !!current && collapsed);
}

function setCollapsed(on) {
  collapsed = on;
  dock().classList.toggle('collapsed', on);
  syncMode();
  const btn = $('[data-vact="size"]', dock());
  btn.textContent = on ? '⌃' : '⌄';
  btn.setAttribute('aria-label', on ? 'Büyüt' : 'Küçült');
}

function showError(text) {
  const box = $('.video-msg', dock());
  box.hidden = !text;
  dock().classList.toggle('err', !!text); // no point showing a broken player
  if (text) {
    box.innerHTML = `${esc(text)} <a href="${watchUrl(current)}" target="_blank" rel="noopener">YouTube’da aç</a>`;
    setCollapsed(false);
  }
}

async function mountPlayer() {
  const YT = await loadApi();
  player?.destroy?.();
  const holder = $('.video-frame', dock());
  holder.innerHTML = '<div id="video-player"></div>';
  const vars = { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 1 };
  const cfg = {
    host: 'https://www.youtube-nocookie.com',
    playerVars: current.kind === 'playlist' ? { ...vars, listType: 'playlist', list: current.id } : vars,
    events: {
      onError: (e) => showError(playerErrorText(e.data)),
      onStateChange: (e) => {
        const playing = e.data === 1;
        const btn = $('[data-vact="play"]', dock());
        btn.textContent = playing ? '❚❚' : '▶';
        btn.setAttribute('aria-label', playing ? 'Duraklat' : 'Oynat');
      },
    },
  };
  if (current.kind === 'video') cfg.videoId = current.id;
  player = new YT.Player('video-player', cfg);
}

async function openVideo(v, title = '') {
  current = { ...v, title };
  const d = dock();
  d.hidden = false;
  $('.video-title b', d).textContent = title || (v.kind === 'playlist' ? 'Çalma listesi' : 'YouTube videosu');
  showError('');
  setCollapsed(false);
  try {
    await mountPlayer();
  } catch {
    showError('YouTube’a bağlanılamadı. İnternet bağlantını kontrol et.');
  }
}

export function closeVideo() {
  player?.destroy?.();
  player = null;
  current = null;
  collapsed = false;
  const d = dock();
  if (!d) return;
  d.hidden = true;
  $('.video-frame', d).innerHTML = '';
  syncMode();
}

export function pauseVideo() {
  try { player?.pauseVideo?.(); } catch { /* player not ready */ }
}

/* ---------- Add-video sheet ---------- */

function recentHTML() {
  const list = loadRecent();
  if (!list.length) return '<p class="meta">Henüz video yok. Bir YouTube bağlantısı yapıştır.</p>';
  return `<ul class="video-recent">${list.map((v, i) => `
    <li><button type="button" data-recent="${i}">
      ${thumbUrl(v) ? `<img src="${thumbUrl(v)}" alt="" loading="lazy">` : '<span class="video-thumb-none">▶</span>'}
      <b>${esc(v.title || (v.kind === 'playlist' ? 'Çalma listesi' : 'YouTube videosu'))}</b>
    </button></li>`).join('')}</ul>`;
}

function openSheet() {
  const dlg = $('#video-sheet');
  $('#video-input').value = '';
  $('#video-sheet-msg').textContent = '';
  $('#video-recent').innerHTML = recentHTML();
  dlg.showModal();
}

async function submitLink() {
  const msg = $('#video-sheet-msg');
  const v = parseYouTube($('#video-input').value);
  if (!v) {
    msg.textContent = 'Bu bir YouTube bağlantısı gibi görünmüyor.';
    return;
  }
  msg.textContent = 'Kontrol ediliyor…';
  const { verdict, title } = await checkEmbeddable(v);
  if (verdict === 'blocked') {
    msg.innerHTML = `Video sahibi bu videonun uygulamada oynatılmasına izin vermemiş. <a href="${watchUrl(v)}" target="_blank" rel="noopener">YouTube’da aç</a>`;
    return;
  }
  if (verdict === 'missing') {
    msg.textContent = 'Video bulunamadı ya da gizli.';
    return;
  }
  saveRecent({ ...v, title });
  $('#video-sheet').close();
  openVideo(v, title);
}

export function initVideo({ runner }) {
  runnerEl = runner;
  $('#runner-video').addEventListener('click', () => {
    if (current && collapsed) setCollapsed(false);
    else openSheet();
  });
  $('#video-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitLink();
  });
  $('#video-recent').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recent]');
    if (!b) return;
    const v = loadRecent()[+b.dataset.recent];
    $('#video-sheet').close();
    openVideo(v, v.title);
  });
  $('#video-close').addEventListener('click', () => $('#video-sheet').close());
  $('#video-sheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  dock().addEventListener('click', (e) => {
    const act = e.target.closest('[data-vact]')?.dataset.vact || (e.target.closest('.video-title') ? 'size' : null);
    if (act === 'play') {
      try { player?.getPlayerState?.() === 1 ? player.pauseVideo() : player?.playVideo?.(); } catch { /* not ready */ }
    } else if (act === 'size') setCollapsed(!collapsed);
    else if (act === 'swap') openSheet();
    else if (act === 'close') closeVideo();
  });
}
