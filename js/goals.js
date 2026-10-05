// 30-day rep/hold challenges and custom monthly totals ("1000 crunches in a month").
import { loadGoals, saveGoals } from './store.js';
import { beeps, unlockAudio } from './audio.js';

export const GOAL_DAYS = 30;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const num = (n) => n.toLocaleString('tr-TR');

// Builds a 30-day plan ramping linearly from `from` to `to`, rounded to `step`.
// `restEvery` = n makes every n-th day a rest day (0 in the plan).
function ramp(from, to, step, restEvery) {
  const isRest = (d) => restEvery && (d + 1) % restEvery === 0;
  const trainDays = [...Array(GOAL_DAYS).keys()].filter((d) => !isRest(d));
  const plan = Array(GOAL_DAYS).fill(0);
  trainDays.forEach((d, i) => {
    const v = from + ((to - from) * i) / (trainDays.length - 1);
    plan[d] = Math.round(v / step) * step;
  });
  return plan;
}

// Presets based on common 30-day challenge formats.
export const PRESETS = [
  {
    id: 'squat',
    name: '30 Gün Squat',
    noun: 'squat',
    unit: 'rep',
    desc: 'Klasik meydan okuma: 50’den 250’ye. Gün içine bölebilirsin.',
    plan: ramp(50, 250, 5, 4),
  },
  {
    id: 'pushup',
    name: '30 Gün Şınav',
    noun: 'şınav',
    unit: 'rep',
    desc: '10’dan 40’a. Gerekirse dizüstü şınav, setlere bölerek.',
    plan: ramp(10, 40, 1, 4),
  },
  {
    id: 'crunch',
    name: '30 Gün Mekik',
    noun: 'mekik',
    unit: 'rep',
    desc: '20’den 100’e. Bel yerde, boyundan çekme.',
    plan: ramp(20, 100, 5, 4),
  },
  {
    id: 'plank',
    name: '30 Gün Plank',
    noun: 'plank',
    unit: 'sec',
    desc: '20 sn’den 3 dk’ya. Toplamı setlere bölebilirsin.',
    plan: ramp(20, 180, 5, 7),
  },
];

// Exercises offered for custom monthly totals.
export const CUSTOM_EXERCISES = [
  { noun: 'mekik', unit: 'rep', suggest: 1000 },
  { noun: 'şınav', unit: 'rep', suggest: 600 },
  { noun: 'squat', unit: 'rep', suggest: 3000 },
  { noun: 'burpee', unit: 'rep', suggest: 500 },
  { noun: 'lunge', unit: 'rep', suggest: 1000 },
  { noun: 'dumbbell swing', unit: 'rep', suggest: 1500 },
  { noun: 'jumping jack', unit: 'rep', suggest: 3000 },
  { noun: 'plank', unit: 'sec', suggest: 3600 },
];

/* ---------- Dates ---------- */

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function dayIndex(goal, date = new Date()) {
  const start = parseDay(goal.start);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today - start) / 86400000);
}

/* ---------- Amounts ---------- */

export function formatAmount(n, unit) {
  if (unit !== 'sec') return num(n);
  if (n < 60) return `${n} sn`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (m >= 60) return `${Math.floor(m / 60)} sa ${m % 60} dk`;
  return s ? `${m} dk ${s} sn` : `${m} dk`;
}

/* ---------- Goal math ---------- */

function doneOn(goal, key) {
  return goal.log[key] || 0;
}

function doneTotal(goal) {
  return Object.values(goal.log).reduce((a, b) => a + b, 0);
}

function goalTotal(goal) {
  return goal.plan ? goal.plan.reduce((a, b) => a + b, 0) : goal.total;
}

function doneBefore(goal, idx) {
  let sum = 0;
  for (let i = 0; i < idx; i++) sum += doneOn(goal, dayKey(addDays(parseDay(goal.start), i)));
  return sum;
}

// Target for day `idx`. Custom goals spread what's left over the days left,
// so missing a day raises the following days instead of failing the goal.
function targetFor(goal, idx) {
  if (idx < 0 || idx >= GOAL_DAYS) return 0;
  if (goal.plan) return goal.plan[idx];
  const left = Math.max(0, goal.total - doneBefore(goal, idx));
  return Math.ceil(left / (GOAL_DAYS - idx));
}

function expectedThrough(goal, idx) {
  if (goal.plan) return goal.plan.slice(0, idx + 1).reduce((a, b) => a + b, 0);
  return Math.round((goal.total * (idx + 1)) / GOAL_DAYS);
}

export function goalStatus(goal, date = new Date()) {
  const idx = dayIndex(goal, date);
  const key = dayKey(date);
  const total = goalTotal(goal);
  const done = doneTotal(goal);
  const todayTarget = targetFor(goal, idx);
  const todayDone = doneOn(goal, key);
  return { idx, key, total, done, todayTarget, todayDone };
}

function paceText(goal, st) {
  if (st.done >= st.total) return 'Hedef tamamlandı!';
  const todayLeft = Math.max(0, st.todayTarget - st.todayDone);
  const diff = st.done - expectedThrough(goal, Math.min(st.idx, GOAL_DAYS - 1));
  if (diff >= 0) return `Plandan ${formatAmount(diff, goal.unit)} öndesin`;
  if (-diff <= todayLeft) return st.todayTarget ? `Plandasın · bugün ${formatAmount(todayLeft, goal.unit)} kaldı` : 'Plandasın';
  return `Plandan ${formatAmount(-diff - todayLeft, goal.unit)} geridesin`;
}

/* ---------- Persistence ---------- */

function update(id, fn) {
  const goals = loadGoals().map((g) => (g.id === id ? fn({ ...g, log: { ...g.log } }) : g));
  saveGoals(goals);
}

function addToDay(id, key, amount) {
  update(id, (g) => {
    g.log[key] = Math.max(0, (g.log[key] || 0) + amount);
    if (!g.log[key]) delete g.log[key];
    return g;
  });
}

function setDay(id, key, amount) {
  update(id, (g) => {
    if (amount > 0) g.log[key] = amount;
    else delete g.log[key];
    return g;
  });
}

function startGoal(goal) {
  const goals = loadGoals();
  goals.unshift({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    start: dayKey(new Date()),
    log: {},
    ...goal,
  });
  saveGoals(goals);
}

/* ---------- Rendering ---------- */

function stripHTML(goal, st) {
  let html = '';
  for (let i = 0; i < GOAL_DAYS; i++) {
    const key = dayKey(addDays(parseDay(goal.start), i));
    const target = goal.plan ? goal.plan[i] : Math.ceil(goal.total / GOAL_DAYS);
    const done = doneOn(goal, key);
    let cls = 'future';
    if (i <= st.idx) {
      if (goal.plan && target === 0) cls = done ? 'full' : 'rest';
      else if (done >= target) cls = 'full';
      else if (done > 0) cls = 'part';
      else cls = i < st.idx ? 'miss' : 'todo';
    } else if (goal.plan && target === 0) cls = 'rest future';
    if (i === st.idx) cls += ' today';
    const title = `Gün ${i + 1}: ${formatAmount(done, goal.unit)}${target ? ` / ${formatAmount(target, goal.unit)}` : ' (dinlenme)'}`;
    html += `<button type="button" class="g-day ${cls}" data-day="${key}" data-i="${i}" title="${title}" aria-label="${title}"></button>`;
  }
  return html;
}

function quickButtons(goal) {
  const steps = goal.unit === 'sec' ? [10, 30, 60] : [1, 5, 10];
  return steps.map((n) => `<button type="button" class="g-add" data-add="${n}">+${goal.unit === 'sec' ? `${n} sn` : n}</button>`).join('');
}

function goalCardHTML(goal) {
  const st = goalStatus(goal);
  const pct = Math.min(100, (st.done / st.total) * 100);
  const reached = st.done >= st.total;
  const isRest = reached || (goal.plan && st.todayTarget === 0);
  const todayPct = st.todayTarget ? Math.min(100, (st.todayDone / st.todayTarget) * 100) : 100;
  let todayLine = `<b>Dinlenme günü</b><small>İstersen yine de ekleyebilirsin</small>`;
  if (reached) todayLine = `<b>Hedef tamam!</b><small>Bugün yaptıklarını eklemeye devam edebilirsin</small>`;
  else if (!isRest) todayLine = `<b>${formatAmount(st.todayDone, goal.unit)}<span> / ${formatAmount(st.todayTarget, goal.unit)}</span></b>`;
  return `
    <article class="card goal" data-goal="${goal.id}">
      <header class="goal-head">
        <div>
          <h3>${esc(goal.name)}</h3>
          <p class="meta">Gün ${Math.min(st.idx + 1, GOAL_DAYS)}/${GOAL_DAYS}</p>
        </div>
        <button type="button" class="icon-btn small" data-act="remove" aria-label="Hedefi sil">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>

      <div class="goal-big">
        <b>${formatAmount(st.done, goal.unit)}</b>
        <span>/ ${formatAmount(st.total, goal.unit)} ${esc(goal.noun)}</span>
      </div>
      <div class="goal-bar"><i style="width:${pct}%"></i></div>
      <p class="goal-pace">%${Math.floor(pct)} · ${paceText(goal, st)}</p>

      <div class="goal-today ${st.todayDone >= st.todayTarget && st.todayTarget ? 'done' : ''}">
        <div class="goal-today-text">
          <small>Bugün</small>
          ${todayLine}
          ${isRest ? '' : `<div class="goal-bar thin"><i style="width:${todayPct}%"></i></div>`}
        </div>
        <div class="goal-actions">
          ${quickButtons(goal)}
          ${goal.unit === 'sec' ? '<button type="button" class="g-watch" data-act="watch">Kronometre</button>' : ''}
          ${!isRest && st.todayDone < st.todayTarget ? '<button type="button" class="g-fill" data-act="fill">Tamamla</button>' : ''}
          <button type="button" class="g-edit" data-act="edit">Düzelt</button>
        </div>
      </div>

      <div class="g-strip">${stripHTML(goal, st)}</div>
      <p class="g-legend"><i class="full"></i>Tamam <i class="part"></i>Yarım <i class="miss"></i>Kaçtı <i class="rest"></i>Dinlenme · Bir güne dokunup düzeltebilirsin</p>
    </article>`;
}

function finishedCardHTML(goal) {
  const st = goalStatus(goal);
  const ok = st.done >= st.total;
  return `
    <div class="card goal-done ${ok ? 'ok' : ''}" data-goal="${goal.id}">
      <div>
        <h3>${esc(goal.name)}</h3>
        <p class="meta">${goal.start.split('-').reverse().join('.')} başlangıç · ${formatAmount(st.done, goal.unit)} / ${formatAmount(st.total, goal.unit)} ${esc(goal.noun)}</p>
      </div>
      <span class="badge ${ok ? 'ok' : 'partial'}">${ok ? 'Başarıldı' : `%${Math.floor((st.done / st.total) * 100)}`}</span>
      <button type="button" class="icon-btn small" data-act="remove" aria-label="Kaydı sil">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>`;
}

function presetHTML(p) {
  const total = p.plan.reduce((a, b) => a + b, 0);
  const firstDay = p.plan.find((v) => v > 0);
  const lastDay = p.plan[GOAL_DAYS - 1] || p.plan[GOAL_DAYS - 2];
  return `
    <button type="button" class="card preset" data-preset="${p.id}">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.desc)}</p>
      <div class="meta">${formatAmount(firstDay, p.unit)} → ${formatAmount(lastDay, p.unit)} · toplam ${formatAmount(total, p.unit)}</div>
    </button>`;
}

let watch = null; // { id, startedAt, interval }

export function renderGoals() {
  const goals = loadGoals();
  const active = goals.filter((g) => dayIndex(g) < GOAL_DAYS);
  const done = goals.filter((g) => !active.includes(g));
  const activeNouns = new Set(active.map((g) => g.presetId).filter(Boolean));

  $('#goals-active').innerHTML = active.length
    ? active.map(goalCardHTML).join('')
    : '<p class="empty">Aktif hedefin yok. Aşağıdan bir meydan okuma seç ya da kendi hedefini koy.</p>';
  $('#goals-presets').innerHTML = PRESETS.filter((p) => !activeNouns.has(p.id)).map(presetHTML).join('');
  $('#goals-done-wrap').hidden = !done.length;
  $('#goals-done').innerHTML = done.map(finishedCardHTML).join('');

  bindGoalCards();
}

function bindGoalCards() {
  $$('[data-goal]').forEach((card) => {
    const id = card.dataset.goal;
    const goal = loadGoals().find((g) => g.id === id);
    if (!goal) return;
    const st = goalStatus(goal);

    $$('[data-add]', card).forEach((b) => b.addEventListener('click', () => {
      addToDay(id, st.key, +b.dataset.add);
      const after = goalStatus(loadGoals().find((g) => g.id === id));
      if (st.todayDone < st.todayTarget && after.todayDone >= after.todayTarget) celebrate();
      renderGoals();
    }));

    card.querySelector('[data-act="fill"]')?.addEventListener('click', () => {
      setDay(id, st.key, st.todayTarget);
      celebrate();
      renderGoals();
    });

    card.querySelector('[data-act="edit"]')?.addEventListener('click', () => editDay(goal, st.key, 'Bugün'));

    card.querySelector('[data-act="remove"]')?.addEventListener('click', () => {
      if (!confirm(`“${goal.name}” silinsin mi?`)) return;
      saveGoals(loadGoals().filter((g) => g.id !== id));
      renderGoals();
    });

    card.querySelector('[data-act="watch"]')?.addEventListener('click', (e) => toggleWatch(goal, st, e.currentTarget));

    $$('.g-day', card).forEach((d) => d.addEventListener('click', () => {
      if (+d.dataset.i > st.idx) return;
      editDay(goal, d.dataset.day, `Gün ${+d.dataset.i + 1}`);
    }));
  });
}

function editDay(goal, key, label) {
  const unitLabel = goal.unit === 'sec' ? 'saniye' : goal.noun;
  const raw = prompt(`${label} kaç ${unitLabel} yaptın?`, String(doneOn(goal, key)));
  if (raw === null) return;
  const n = Math.round(Number(raw.replace(',', '.')));
  if (!Number.isFinite(n) || n < 0) return;
  setDay(goal.id, key, n);
  renderGoals();
}

function celebrate() {
  try {
    unlockAudio();
    beeps.finish();
  } catch { /* audio unavailable */ }
  navigator.vibrate?.([120, 60, 200]);
}

// Simple stopwatch for hold challenges: the time is added when it stops.
function toggleWatch(goal, st, btn) {
  unlockAudio();
  if (watch?.id === goal.id) {
    const secs = Math.round((Date.now() - watch.startedAt) / 1000);
    clearInterval(watch.interval);
    watch = null;
    if (secs > 0) addToDay(goal.id, st.key, secs);
    const after = goalStatus(loadGoals().find((g) => g.id === goal.id));
    if (st.todayDone < st.todayTarget && after.todayDone >= after.todayTarget) celebrate();
    renderGoals();
    return;
  }
  if (watch) return; // one stopwatch at a time
  const remaining = Math.max(0, st.todayTarget - st.todayDone);
  watch = { id: goal.id, startedAt: Date.now() };
  btn.classList.add('running');
  let beeped = false;
  const tick = () => {
    const secs = Math.floor((Date.now() - watch.startedAt) / 1000);
    btn.textContent = `Durdur · ${formatAmount(secs, 'sec')}`;
    if (!beeped && remaining && secs >= remaining) {
      beeped = true;
      celebrate();
    }
  };
  tick();
  watch.interval = setInterval(tick, 250);
}

// Small summary for the home screen.
export function todayGoalsHTML() {
  const goals = loadGoals().filter((g) => dayIndex(g) < GOAL_DAYS);
  if (!goals.length) return '';
  const rows = goals.map((g) => {
    const st = goalStatus(g);
    const ok = st.todayTarget === 0 || st.todayDone >= st.todayTarget;
    const text = st.todayTarget === 0
      ? 'dinlenme'
      : `${formatAmount(st.todayDone, g.unit)} / ${formatAmount(st.todayTarget, g.unit)}`;
    return `<li class="${ok ? 'ok' : ''}"><span>${esc(g.noun)}</span><b>${text}</b></li>`;
  }).join('');
  return `
    <button type="button" class="card today-goals" data-goto="goals">
      <div class="program-head"><h3>Bugünkü hedefler</h3><span class="go" aria-hidden="true">›</span></div>
      <ul>${rows}</ul>
    </button>`;
}

/* ---------- New goals ---------- */

export function initGoals() {
  $('#goals-presets').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const p = PRESETS.find((x) => x.id === btn.dataset.preset);
    if (!confirm(`${p.name} bugün başlasın mı?`)) return;
    startGoal({ presetId: p.id, name: p.name, noun: p.noun, unit: p.unit, plan: p.plan });
    renderGoals();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const form = $('#custom-goal');
  const sel = form.elements.exercise;
  sel.innerHTML = CUSTOM_EXERCISES.map((x, i) => `<option value="${i}">${esc(x.noun)}${x.unit === 'sec' ? ' (saniye)' : ''}</option>`).join('');
  const syncSuggest = () => {
    const x = CUSTOM_EXERCISES[+sel.value];
    form.elements.total.value = x.suggest;
    $('#custom-unit').textContent = x.unit === 'sec' ? 'saniye' : x.noun;
    updateCustomHint();
  };
  const updateCustomHint = () => {
    const x = CUSTOM_EXERCISES[+sel.value];
    const total = Math.max(0, Math.round(+form.elements.total.value || 0));
    $('#custom-hint').textContent = total
      ? `Günde ortalama ${formatAmount(Math.ceil(total / GOAL_DAYS), x.unit)}. Kaçırdığın gün sonraki günlere paylaştırılır.`
      : '';
  };
  sel.addEventListener('change', syncSuggest);
  form.elements.total.addEventListener('input', updateCustomHint);
  syncSuggest();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const x = CUSTOM_EXERCISES[+sel.value];
    const total = Math.round(+form.elements.total.value);
    if (!total || total < 1) return;
    const name = x.unit === 'sec'
      ? `1 ayda ${formatAmount(total, 'sec')} ${x.noun}`
      : `1 ayda ${num(total)} ${x.noun}`;
    startGoal({ name, noun: x.noun, unit: x.unit, total, plan: null });
    renderGoals();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
