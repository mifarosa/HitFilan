// Food log and daily calorie balance: type what you ate, an AI estimates the kcal
// (you confirm or edit it), and a surplus is matched to workouts you can start.
import { loadMeals, saveMeals, loadHistory, loadSettings } from './store.js';
import { estimateMeal, commentDay } from './ai.js';
import {
  MEAL_SLOTS, dayBalance, dayOf, periodRange, periodTotals, slotForHour, slotLabel, suggest,
} from './nutrition-core.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const num = (n) => Math.round(n).toLocaleString('tr-TR');
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' });

let hooks = { candidates: () => [], onStart() {}, goto() {} };
let draft = []; // [{ name, kcal }] waiting for the user to confirm
let period = 'day'; // 'day' | 'week' | 'month'
let slot = slotForHour(new Date().getHours()); // slot for the next meals; follows the clock until picked
let slotPicked = false;
const PERIODS = [['day', 'Gün'], ['week', 'Hafta'], ['month', 'Ay']];
const sign = (n) => (n > 0 ? `+${num(n)}` : num(n));

const today = () => dayOf(new Date().toISOString());

function balanceNow() {
  const settings = loadSettings();
  return { settings, ...dayBalance({ meals: loadMeals(), history: loadHistory(), day: today(), settings }) };
}

// Small card for the home screen.
export function todayKcalHTML() {
  const { eaten, target } = balanceNow();
  const line = eaten || target
    ? `<b>${num(eaten)}</b>${target ? ` / ${num(target)}` : ''} kcal`
    : 'Ne yediğini ekle, kalori dengeni gör';
  return `
    <button type="button" class="card today-goals" data-goto="nutrition">
      <div class="program-head"><h3>Bugünkü beslenme</h3><span class="go" aria-hidden="true">›</span></div>
      <p class="meta">${line}</p>
    </button>`;
}

function summaryHTML(b) {
  if (!b.target) {
    return `<p class="meta">Günlük kalori hedefini hesaplamak için boy, yaş ve cinsiyetini gir.</p>
      <button type="button" class="btn ghost full" data-goto="settings">Ayarlar’a git</button>`;
  }
  const left = b.target + b.burned - b.eaten; // what can still be eaten today
  const pct = Math.min(100, Math.round((b.eaten / (b.target + b.burned)) * 100));
  const msg = left >= 0
    ? `Bugün ${num(left)} kcal daha yiyebilirsin.`
    : `Bugün ${num(-left)} kcal fazla aldın.`;
  return `
    <div class="nut-stats">
      <div><b>${num(b.eaten)}</b><small>yenen</small></div>
      <div><b>${num(b.target)}</b><small>günlük ihtiyaç</small></div>
      <div><b>${num(b.burned)}</b><small>spordan</small></div>
    </div>
    <div class="goal-bar ${left < 0 ? 'over' : ''}"><i style="width:${pct}%"></i></div>
    <p class="meta"><b>${msg}</b></p>`;
}

function suggestionHTML(b) {
  if (!b.target) return '';
  const list = suggest(b.balance, hooks.candidates());
  if (!list.length) return '';
  const rows = list.map((c) => `
    <li>
      <span><b>${esc(c.name)}</b><small>${Math.round(c.secs / 60)} dk · ~${num(c.kcal)} kcal${c.partial ? ' (kısmen)' : ''}</small></span>
      <button type="button" class="btn primary" data-start="${esc(c.id)}">Aç</button>
    </li>`).join('');
  return `
    <div class="card">
      <h3>Fazlayı yakmak için</h3>
      <p class="meta">Yaklaşık ${num(Math.min(b.balance, 600))} kcal. Bunlardan biri yeter; aç kalarak telafi etmeye gerek yok.</p>
      <ul class="nut-suggest">${rows}</ul>
    </div>`;
}

function draftHTML() {
  if (!draft.length) return '';
  const rows = draft.map((d, i) => `
    <li>
      <input type="text" value="${esc(d.name)}" data-draft-name="${i}" aria-label="Yiyecek">
      <input type="number" value="${d.kcal}" min="1" max="5000" inputmode="numeric" data-draft-kcal="${i}" aria-label="kcal">
      <button type="button" class="icon-btn" data-draft-del="${i}" aria-label="Çıkar">×</button>
    </li>`).join('');
  return `
    <h4>Tahmin (düzeltebilirsin)</h4>
    <ul class="nut-draft">${rows}</ul>
    <p class="fineprint">Yapay zekâ tahminidir; porsiyona göre değişir.</p>
    <button type="button" class="btn primary full" id="nut-confirm">Günlüğe ekle</button>`;
}

function todayMeals() {
  return loadMeals().filter((m) => dayOf(m.date) === today()).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function listHTML() {
  const meals = todayMeals();
  if (!meals.length) return '<p class="meta">Bugün henüz bir şey eklemedin.</p>';
  return MEAL_SLOTS.map((sl) => {
    const rows = meals.filter((m) => (m.slot || 'snack') === sl.id);
    if (!rows.length) return '';
    return `<h4>${sl.label}</h4><ul class="nut-list">${rows.map((m) => `
      <li><span>${esc(m.name)}<small>${timeFmt.format(new Date(m.date))}</small></span>
        <b>${num(m.kcal)} kcal</b>
        <button type="button" class="icon-btn" data-meal-del="${esc(m.id)}" aria-label="Sil">×</button></li>`).join('')}</ul>`;
  }).join('');
}

function chipsHTML(list, current, attr) {
  return list.map(([id, label]) => `<button type="button" class="chip${id === current ? ' active' : ''}" ${attr}="${id}" aria-pressed="${id === current}">${label}</button>`).join('');
}

// Week / month: one line per day up to today, plus the average of the days that have entries.
function periodHTML(b) {
  if (period === 'day') return '';
  const { from, to } = periodRange(period);
  const t = periodTotals({ meals: loadMeals(), history: loadHistory(), settings: b.settings, from, to });
  const rows = t.days.map((d) => `<li${d.logged ? '' : ' class="muted"'}><span>${d.day.slice(8)}.${d.day.slice(5, 7)}</span>
    <b>${d.logged ? `yenen ${num(d.eaten)} · ${sign(d.balance)}` : 'kayıt yok'}</b></li>`).join('');
  return `
    <div class="nut-stats">
      <div><b>${num(t.eaten)}</b><small>yenen</small></div>
      <div><b>${num(t.target)}</b><small>ihtiyaç</small></div>
      <div><b>${num(t.burned)}</b><small>spordan</small></div>
    </div>
    <p class="meta"><b>Fark ${sign(t.balance)} kcal</b> (+ fazla, − açık). ${t.logged} günde kayıt var${t.logged ? `, günlük ortalama ${num(t.eaten / t.logged)} kcal` : ''}.</p>
    <ul class="nut-list">${rows}</ul>`;
}

export function renderNutrition() {
  const b = balanceNow();
  $('#nut-period').innerHTML = chipsHTML(PERIODS, period, 'data-period');
  $('#nut-slots').innerHTML = chipsHTML(MEAL_SLOTS.map((x) => [x.id, x.label]), slot, 'data-slot');
  $('#nut-summary').innerHTML = period === 'day' ? summaryHTML(b) : '';
  $('#nut-period-days').innerHTML = periodHTML(b);
  const has = todayMeals().length > 0;
  $('#nut-comment').hidden = !has;
  $('#nut-comment-note').hidden = !has;
  $('#nut-suggest').innerHTML = suggestionHTML(b);
  $('#nut-draft').innerHTML = draftHTML();
  $('#nut-list').innerHTML = listHTML();
}

function addMeals(items, mealSlot = slot) {
  const now = Date.now();
  const added = items.map((it, i) => ({
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}${i}`,
    date: new Date(now + i).toISOString(),
    name: it.name,
    kcal: Math.round(it.kcal),
    slot: mealSlot,
  }));
  saveMeals([...added, ...loadMeals()]);
}

function setBusy(on, text = '') {
  $('#nut-ai').disabled = on;
  $('#nut-status').textContent = text;
}

export function initNutrition(h) {
  hooks = { ...hooks, ...h };
  const view = $('#view-nutrition');

  $('#nut-ai').addEventListener('click', async () => {
    const text = $('#nut-text').value.trim();
    if (!text) return;
    if (!slotPicked) slot = slotForHour(new Date().getHours());
    setBusy(true, 'Hesaplanıyor…');
    try {
      const items = await estimateMeal(text);
      if (!items.length) throw new Error('empty');
      draft = items;
      $('#nut-text').value = '';
      setBusy(false);
    } catch (err) {
      console.error(err);
      setBusy(false, 'Hesaplanamadı. Aşağıdan kalorisini kendin yazıp ekleyebilirsin.');
    }
    renderNutrition();
  });

  // Manual entry: "name, kcal" fields.
  $('#nut-manual').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#nut-m-name').value.trim();
    const kcal = +$('#nut-m-kcal').value;
    if (!name || !(kcal > 0)) return;
    addMeals([{ name, kcal }]);
    e.target.reset();
    renderNutrition();
  });

  view.addEventListener('input', (e) => {
    const n = e.target.dataset.draftName;
    const k = e.target.dataset.draftKcal;
    if (n !== undefined) draft[+n].name = e.target.value;
    if (k !== undefined) draft[+k].kcal = +e.target.value;
  });

  view.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.start) hooks.onStart(t.dataset.start);
    else if (t.dataset.period) {
      period = t.dataset.period;
      renderNutrition();
    } else if (t.dataset.slot) {
      slot = t.dataset.slot;
      slotPicked = true;
      renderNutrition();
    } else if (t.id === 'nut-comment') {
      commentToday();
    }
    else if (t.dataset.goto) hooks.goto(t.dataset.goto);
    else if (t.dataset.draftDel !== undefined) {
      draft.splice(+t.dataset.draftDel, 1);
      renderNutrition();
    } else if (t.id === 'nut-confirm') {
      const ok = draft.filter((d) => d.name.trim() && d.kcal > 0);
      if (ok.length) addMeals(ok);
      draft = [];
      slotPicked = false;
      $('#nut-status').textContent = '';
      renderNutrition();
    } else if (t.dataset.mealDel) {
      saveMeals(loadMeals().filter((m) => m.id !== t.dataset.mealDel));
      renderNutrition();
    }
  });
}

async function commentToday() {
  const out = $('#nut-comment-out');
  const btn = $('#nut-comment');
  btn.disabled = true;
  out.textContent = 'Yorumlanıyor…';
  try {
    const b = balanceNow();
    out.textContent = await commentDay({ meals: todayMeals(), burned: b.burned, need: b.target });
  } catch (err) {
    console.error(err);
    out.textContent = 'Yorum alınamadı. Biraz sonra tekrar dene.';
  }
  btn.disabled = false;
}
