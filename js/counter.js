// Free counter: one giant counter that only counts. Tap anywhere on the number to
// add one; −1, reset and an optional target (dose) sit below. Device-only state.
import { unlockAudio, beeps, vibrate } from './audio.js';
import { loadSettings } from './store.js';

const KEY = 'hitfilan.counter';
const RING_LEN = 2 * Math.PI * 54;

const $ = (sel, root = document) => root.querySelector(sel);

let state = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return { count: raw.count | 0, target: raw.target | 0 };
  } catch { /* storage unavailable or corrupt */ }
  return { count: 0, target: 0 };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}

// Small card for the home screen.
export function counterCardHTML() {
  return `
    <button type="button" class="card today-goals" data-goto="counter">
      <div class="program-head"><h3>Serbest sayaç</h3><span class="go" aria-hidden="true">›</span></div>
      <p class="meta">${state.count ? `Kaldığın yer: ${state.count}` : 'Ne yapacağına sen karar ver, sadece say'}</p>
    </button>`;
}

let vibrateOn = true;
let saveTimer = null;
let shown = { count: -1, target: -1, len: 0 };

// One write per burst of taps; flushed when the page is hidden.
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

function flushSave() {
  if (saveTimer === null) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  save();
}

// Cheap per-tap update: only touches what changed, no forced layout.
function paint(pop = false) {
  const { count, target } = state;
  const num = $('#counter-num');
  if (shown.count !== count) {
    num.textContent = count;
    const len = String(count).length;
    if (len !== shown.len) num.dataset.len = len;
    shown.len = len;
    if (pop) num.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' });
  }
  if (shown.count !== count || shown.target !== target) {
    const done = target > 0 && count >= target;
    $('#counter-tap').classList.toggle('done', done);
    const ring = $('#counter-ring-fg');
    ring.style.strokeDashoffset = target > 0 ? RING_LEN * (1 - Math.min(1, count / target)) : 0;
    ring.classList.toggle('free', target === 0);
  }
  if (shown.target !== target) {
    $('#counter-sub').textContent = target > 0 ? `/ ${target}` : 'dokun ve say';
    $('#counter-target').textContent = target > 0 ? `Doz: ${target}` : 'Doz koy';
  }
  shown.count = count;
  shown.target = target;
}

// Full refresh when the view opens.
export function renderCounter() {
  vibrateOn = loadSettings().vibrate;
  $('#counter-ring-fg').style.strokeDasharray = RING_LEN;
  shown = { count: -1, target: -1, len: 0 };
  paint();
}

export function initCounter({ goto }) {
  const tap = $('#counter-tap');
  const inc = () => {
    unlockAudio();
    state.count += 1;
    if (state.target > 0 && state.count === state.target) {
      beeps.finish();
      if (vibrateOn) vibrate([200, 80, 200]);
    } else if (vibrateOn) {
      vibrate(15);
    }
    scheduleSave();
    paint(true);
  };
  // pointerdown answers instantly; the click that follows a touch or mouse press
  // is ignored (detail > 0), a keyboard activation (detail 0) still counts.
  tap.addEventListener('pointerdown', (e) => {
    if (e.button === 0 || e.pointerType === 'touch') inc();
  });
  tap.addEventListener('click', (e) => { if (e.detail === 0) inc(); });

  $('#counter-dec').addEventListener('click', () => {
    state.count = Math.max(0, state.count - 1);
    scheduleSave();
    paint();
  });

  $('#counter-reset').addEventListener('click', () => {
    state.count = 0;
    scheduleSave();
    paint();
  });

  $('#counter-target').addEventListener('click', () => {
    const v = prompt('Kaça kadar sayacaksın? (boş bırak ya da 0 yaz: hedefsiz)', state.target || '');
    if (v === null) return;
    state.target = Math.max(0, Math.min(9999, Math.round(+v) || 0));
    scheduleSave();
    paint();
  });

  $('#counter-back').addEventListener('click', () => goto('home'));

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  window.addEventListener('pagehide', flushSave);
}
