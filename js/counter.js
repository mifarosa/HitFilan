// Free counter: one giant counter that only counts. Tap anywhere on the number to
// add one; −1, reset and an optional target (dose) sit below. Device-only state.
import { unlockAudio, beeps, vibrate } from './audio.js';

const KEY = 'hitfilan.counter';

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

export function renderCounter() {
  const { count, target } = state;
  const done = target > 0 && count >= target;
  const tap = $('#counter-tap');
  tap.classList.toggle('done', done);
  $('#counter-num').textContent = count;
  $('#counter-sub').textContent = target > 0 ? `/ ${target}` : 'dokun ve say';
  // Long numbers shrink so they always fit the screen width.
  $('#counter-num').dataset.len = String(count).length;
  $('#counter-target').textContent = target > 0 ? `Doz: ${target}` : 'Doz koy';
}

export function initCounter({ goto }) {
  $('#counter-tap').addEventListener('click', () => {
    unlockAudio();
    state.count += 1;
    if (state.target > 0 && state.count === state.target) {
      beeps.finish();
      vibrate([200, 80, 200]);
    } else {
      vibrate(15);
    }
    save();
    renderCounter();
  });

  $('#counter-dec').addEventListener('click', () => {
    state.count = Math.max(0, state.count - 1);
    save();
    renderCounter();
  });

  $('#counter-reset').addEventListener('click', () => {
    state.count = 0;
    save();
    renderCounter();
  });

  $('#counter-target').addEventListener('click', () => {
    const v = prompt('Kaça kadar sayacaksın? (boş bırak ya da 0 yaz: hedefsiz)', state.target || '');
    if (v === null) return;
    state.target = Math.max(0, Math.min(9999, Math.round(+v) || 0));
    save();
    renderCounter();
  });

  $('#counter-back').addEventListener('click', () => goto('home'));
}
