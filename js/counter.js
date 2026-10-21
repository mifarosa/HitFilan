// Free counter: one giant counter that only counts. Tap the big card to add one.
// With a dose (target) set, reaching it signals "set done", adds to a set tally and
// the counter starts over by itself. Device-only state.
import { unlockAudio, beeps, vibrate } from './audio.js';
import { loadSettings } from './store.js';

const KEY = 'hitfilan.counter';
const RING_LEN = 2 * Math.PI * 54;
const PRESETS = [3, 4, 5, 6, 8, 10, 12, 15, 20];
const FLASH_MS = 1100;

const $ = (sel, root = document) => root.querySelector(sel);

let state = load();
let flashTimer = null; // set while the "set done" banner shows
let beepOn = true;
let vibrateOn = true;
let saveTimer = null;
let shown = null; // last painted values, so only changes touch the DOM

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') return { count: raw.count | 0, target: raw.target | 0, sets: raw.sets | 0 };
  } catch { /* storage unavailable or corrupt */ }
  return { count: 0, target: 0, sets: 0 };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage unavailable */ }
}

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

// Small card for the home screen.
export function counterCardHTML() {
  const line = state.sets || state.count
    ? `${state.sets ? `Set ${state.sets} · ` : ''}${state.count} tekrar`
    : 'Ne yapacağına sen karar ver, sadece say';
  return `
    <button type="button" class="card today-goals" data-goto="counter">
      <div class="program-head"><h3>Serbest sayaç</h3><span class="go" aria-hidden="true">›</span></div>
      <p class="meta">${line}</p>
    </button>`;
}

function dosesHTML() {
  const t = state.target;
  const custom = t > 0 && !PRESETS.includes(t) ? [t] : [];
  const chip = (v, label, active) => `<button type="button" class="counter-chip ${active ? 'active' : ''}" data-dose="${v}" aria-pressed="${active}">${label}</button>`;
  return [
    chip(0, 'Doz yok', t === 0),
    ...[...PRESETS, ...custom].sort((a, b) => a - b).map((v) => chip(v, v, v === t)),
    '<button type="button" class="counter-chip" data-dose="custom" aria-label="Başka bir doz yaz">+</button>',
  ].join('');
}

// Cheap update: only touches what changed, no forced layout.
function paint(pop = false) {
  const { count, target, sets } = state;
  const flashing = flashTimer !== null;
  const num = $('#counter-num');
  if (!shown || shown.count !== count) {
    num.textContent = count;
    num.dataset.len = String(count).length;
    if (pop) num.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' });
  }
  if (!shown || shown.count !== count || shown.target !== target) {
    const ring = $('#counter-ring-fg');
    ring.style.strokeDashoffset = target > 0 ? RING_LEN * (1 - Math.min(1, count / target)) : 0;
    ring.classList.toggle('free', target === 0);
  }
  if (!shown || shown.target !== target) {
    $('#counter-sub').textContent = target > 0 ? `/ ${target}` : 'dokun ve say';
    $('#counter-doses').innerHTML = dosesHTML();
  }
  if (!shown || shown.sets !== sets) $('#counter-sets').textContent = `SET ${sets}`;
  if (!shown || shown.flashing !== flashing) {
    $('#counter-tap').classList.toggle('done', flashing);
    $('#counter-done').hidden = !flashing;
  }
  shown = { count, target, sets, flashing };
}

// Full refresh when the view opens.
export function renderCounter() {
  const s = loadSettings();
  vibrateOn = s.vibrate;
  beepOn = s.beeps;
  $('#counter-ring-fg').style.strokeDasharray = RING_LEN;
  shown = null;
  paint();
}

function stopFlash() {
  clearTimeout(flashTimer);
  flashTimer = null;
}

// Dose reached: signal, count the set, and start over after a short flash.
// Taps during the flash are kept: they carry over into the next set.
function completeSet() {
  state.sets += 1;
  if (beepOn) beeps.finish();
  if (vibrateOn) vibrate([200, 80, 200]);
  flashTimer = setTimeout(() => {
    flashTimer = null;
    state.count = Math.max(0, state.count - state.target);
    scheduleSave();
    paint();
  }, FLASH_MS);
}

function setDose(v) {
  stopFlash();
  state.target = Math.max(0, Math.min(999, Math.round(v) || 0));
  scheduleSave();
  paint();
}

export function initCounter({ goto }) {
  const tap = $('#counter-tap');
  const inc = () => {
    unlockAudio();
    state.count += 1;
    if (state.target > 0 && state.count === state.target && flashTimer === null) completeSet();
    else if (vibrateOn) vibrate(15);
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
    stopFlash();
    state.count = 0;
    state.sets = 0;
    scheduleSave();
    paint();
  });

  const dialog = $('#counter-dose-dialog');
  $('#counter-doses').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-dose]');
    if (!chip) return;
    if (chip.dataset.dose === 'custom') {
      $('#counter-dose-input').value = state.target || '';
      dialog.showModal();
      $('#counter-dose-input').focus();
      return;
    }
    setDose(+chip.dataset.dose);
  });
  $('#counter-dose-form').addEventListener('submit', () => {
    const v = +$('#counter-dose-input').value;
    if (v > 0) setDose(v);
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  $('#counter-back').addEventListener('click', () => goto('home'));

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
  window.addEventListener('pagehide', flushSave);
}
