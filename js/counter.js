// Free counter: four blank counters that only count. The user decides what each
// one is (an optional name) and, if they want, a target dose. Device-only state.
import { unlockAudio, beeps, vibrate } from './audio.js';

const KEY = 'hitfilan.counters';
const SLOTS = 4;

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const blank = () => ({ name: '', count: 0, target: 0 });
let counters = load();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw)) {
      return Array.from({ length: SLOTS }, (_, i) => ({ ...blank(), ...(raw[i] || {}) }));
    }
  } catch { /* storage unavailable or corrupt */ }
  return Array.from({ length: SLOTS }, blank);
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(counters));
  } catch { /* storage unavailable */ }
}

// Small card for the home screen.
export function counterCardHTML() {
  const used = counters.filter((c) => c.count > 0).length;
  return `
    <button type="button" class="card today-goals" data-goto="counter">
      <div class="program-head"><h3>Serbest sayaç</h3><span class="go" aria-hidden="true">›</span></div>
      <p class="meta">${used ? `${used} sayaç devam ediyor` : 'Ne yapacağına sen karar ver, sadece say'}</p>
    </button>`;
}

function cellHTML(c, i) {
  const done = c.target > 0 && c.count >= c.target;
  const pct = c.target > 0 ? Math.min(100, Math.round((c.count / c.target) * 100)) : 0;
  return `
    <div class="counter ${done ? 'done' : ''}" data-i="${i}">
      <input type="text" class="counter-name" value="${esc(c.name)}" placeholder="Hareket ${i + 1}" maxlength="24" aria-label="Sayaç ${i + 1} adı">
      <button type="button" class="counter-tap" data-act="inc" aria-label="Bir artır">
        <b>${c.count}</b>
        <small>${c.target > 0 ? `/ ${c.target}` : 'dokun ve say'}</small>
      </button>
      ${c.target > 0 ? `<div class="goal-bar thin"><i style="width:${pct}%"></i></div>` : ''}
      <div class="counter-actions">
        <button type="button" class="btn ghost" data-act="dec" aria-label="Bir azalt">−1</button>
        <button type="button" class="btn ghost" data-act="target">Doz</button>
        <button type="button" class="btn ghost" data-act="reset">Sıfırla</button>
      </div>
    </div>`;
}

export function renderCounter() {
  $('#counter-grid').innerHTML = counters.map(cellHTML).join('');
}

// Updates one counter's card in place (keeps the name field focused while typing).
function refresh(i) {
  const old = $(`#counter-grid [data-i="${i}"]`);
  const tmp = document.createElement('div');
  tmp.innerHTML = cellHTML(counters[i], i);
  old.replaceWith(tmp.firstElementChild);
}

export function initCounter({ goto }) {
  const grid = $('#counter-grid');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const i = +btn.closest('[data-i]').dataset.i;
    const c = counters[i];
    const act = btn.dataset.act;
    if (act === 'inc') {
      unlockAudio();
      c.count += 1;
      if (c.target > 0 && c.count === c.target) {
        beeps.finish();
        vibrate([200, 80, 200]);
      } else {
        vibrate(15);
      }
    } else if (act === 'dec') {
      c.count = Math.max(0, c.count - 1);
    } else if (act === 'reset') {
      c.count = 0;
    } else if (act === 'target') {
      const v = prompt('Kaça kadar sayacaksın? (boş bırak ya da 0 yaz: hedefsiz)', c.target || '');
      if (v === null) return;
      c.target = Math.max(0, Math.min(9999, Math.round(+v) || 0));
    }
    save();
    refresh(i);
  });

  grid.addEventListener('change', (e) => {
    if (!e.target.classList.contains('counter-name')) return;
    counters[+e.target.closest('[data-i]').dataset.i].name = e.target.value.trim();
    save();
  });

  $('#counter-reset-all').addEventListener('click', () => {
    if (!counters.some((c) => c.count > 0)) return;
    if (!confirm('Tüm sayaçlar sıfırlansın mı?')) return;
    counters.forEach((c) => { c.count = 0; });
    save();
    renderCounter();
  });

  $('#view-counter').addEventListener('click', (e) => {
    const g = e.target.closest('[data-goto]');
    if (g) goto(g.dataset.goto);
  });
}
