import { EXERCISES, LEVELS, PROGRAMS, BIKE_MINUTES, getProgram } from './data.js';
import {
  buildSteps, totalSeconds, estimateKcal, formatTime, programInfo,
} from './steps.js';
import { SequenceTimer } from './timer.js';
import { renderGoals, initGoals, todayGoalsHTML } from './goals.js';
import {
  initPlans, openEditor, deletePlan, duplicatePlan, planFromProgram, planRowsHTML,
} from './plans.js';
import { unlockAudio, beeps, speak, vibrate } from './audio.js';
import {
  loadSettings, loadPlans, saveSettings, loadHistory, addHistory, updateHistory, removeHistory, clearHistory,
  saveActive, loadActive, clearActive,
} from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let settings = loadSettings();

const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Effort rank decides whether a transition beep goes "up" or "down".
const RANK = { prep: 0, easy: 1, rest: 1, moderate: 2, work: 3, hard: 3 };

// Resistance (from settings) and cadence targets for bike levels.
const RES_KEY = { easy: 'resEasy', moderate: 'resModerate', hard: 'resHard' };

function bikeTarget(level) {
  if (!RES_KEY[level]) return null;
  return { res: settings[RES_KEY[level]], rpm: LEVELS[level].rpm };
}

const RPE_LABELS = { 1: 'Çok kolay', 2: 'Rahat', 3: 'Zorladı', 4: 'Çok zor' };

/* ---------- Navigation ---------- */

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'history') renderHistory();
  if (name === 'goals') renderGoals();
  if (name === 'home') {
    renderWeek($('#week-summary'));
    renderHomeGoals();
  }
  window.scrollTo(0, 0);
}

$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

function renderHomeGoals() {
  const el = $('#home-goals');
  el.innerHTML = todayGoalsHTML();
  el.querySelector('[data-goto]')?.addEventListener('click', () => showView('goals'));
}

/* ---------- Helpers ---------- */

function timelineHTML(steps) {
  return steps
    .map((s) => `<i style="flex-grow:${s.dur};background:${LEVELS[s.level].color}"></i>`)
    .join('');
}

function minutesLabel(sec) {
  return `${Math.round(sec / 60)} dk`;
}

function defaultOpts(program) {
  if (program.kind === 'circuit') return { work: program.work, rest: program.rest, rounds: program.rounds };
  if (program.kind === 'combo') return { bikeId: settings.bikeId };
  return {};
}

// Bike programs are picked by duration; the choice is remembered in settings.
function selectedBike() {
  return getProgram(settings.bikeId) || getProgram('bike40');
}

function durationChips() {
  return `
    <div class="chips duration" role="group" aria-label="Bisiklet süresi">
      ${BIKE_MINUTES.map((m) => {
        const id = `bike${m}`;
        const on = id === selectedBike().id;
        return `<button type="button" class="chip ${on ? 'active' : ''}" data-bike="${id}" aria-pressed="${on}">${m === 60 ? '1 saat' : `${m} dk`}</button>`;
      }).join('')}
    </div>`;
}

function selectBike(id) {
  settings = { ...settings, bikeId: id };
  saveSettings(settings);
  renderHome();
}

/* ---------- Home ---------- */

function programCard(p) {
  const opts = defaultOpts(p);
  const info = programInfo(p.id, opts);
  const steps = buildSteps(p.id, opts);
  const secs = totalSeconds(steps);
  const kcal = estimateKcal(steps, settings.weightKg);
  let meta = `${minutesLabel(secs)} · ~${kcal} kcal`;
  if (p.kind === 'circuit') {
    const usesDb = p.exercises.some((id) => EXERCISES[id].equip === 'dumbbell');
    meta += ` · ${p.exercises.length} hareket · ${usesDb ? 'Dumbbell' : 'Ekipmansız'}`;
  }
  if (p.kind === 'custom') meta += ` · ${steps.length - 1} adım`;
  return `
    <button class="card program" data-program="${p.id}">
      <div class="program-head">
        <h3>${esc(info.name)}</h3>
        <span class="go" aria-hidden="true">›</span>
      </div>
      <p>${esc(info.desc)}</p>
      <div class="mini-timeline">${timelineHTML(steps)}</div>
      <div class="meta">${meta}</div>
    </button>`;
}

function renderPlans() {
  const plans = loadPlans().map((pl) => getProgram(pl.id));
  $('#plan-list').innerHTML = plans.map(programCard).join('') + `
    <button type="button" class="card new-plan" id="new-plan">
      <span class="new-plan-plus" aria-hidden="true">+</span>
      <span><b>Yeni plan oluştur</b><small>${plans.length ? 'Bisiklet, hareket ya da kendi adımların' : 'Kendi bisiklet akışını ya da hareket devreni kur'}</small></span>
    </button>`;
  $('#new-plan').addEventListener('click', () => openEditor());
}

function renderHome() {
  renderPlans();
  $('#bike-list').innerHTML = durationChips()
    + [selectedBike(), getProgram('combo')].map(programCard).join('');
  $$('#bike-list [data-bike]').forEach((c) => c.addEventListener('click', () => selectBike(c.dataset.bike)));
  $('#circuit-list').innerHTML = PROGRAMS.filter((p) => p.kind === 'circuit').map(programCard).join('');
  $$('[data-program]').forEach((el) => el.addEventListener('click', () => openSheet(el.dataset.program)));
  renderWeek($('#week-summary'));
}

function startOfWeek(d = new Date()) {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return s;
}

function renderWeek(el) {
  const start = startOfWeek();
  const entries = loadHistory().filter((e) => new Date(e.date) >= start);
  const mins = Math.round(entries.reduce((a, e) => a + e.durationSec, 0) / 60);
  const kcal = entries.reduce((a, e) => a + (e.kcal || 0), 0);
  const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const today = (new Date().getDay() + 6) % 7;
  const active = new Set(entries.map((e) => (new Date(e.date).getDay() + 6) % 7));
  el.innerHTML = `
    <div class="week-stats">
      <div><b>${entries.length}/${settings.weeklyGoal}</b><small>haftalık hedef</small></div>
      <div><b>${mins}</b><small>dakika</small></div>
      <div><b>${kcal}</b><small>~kcal</small></div>
    </div>
    <div class="week-days">
      ${days.map((d, i) => `<span class="${active.has(i) ? 'done' : ''} ${i === today ? 'today' : ''}">${d}</span>`).join('')}
    </div>`;
}

/* ---------- Program sheet ---------- */

const sheet = $('#program-sheet');

function bikeRows(p) {
  // Group consecutive short (interval) blocks into a single row.
  const rows = [];
  let t = 0;
  let i = 0;
  while (i < p.blocks.length) {
    const b = p.blocks[i];
    if (b.dur < 120) {
      let j = i;
      let secs = 0;
      while (j < p.blocks.length && p.blocks[j].dur < 120) secs += p.blocks[j++].dur;
      rows.push({ from: t, to: t + secs, label: `${(j - i) / 2} × (1 dk Orta + 1 dk Ağır)`, level: 'hard' });
      t += secs;
      i = j;
    } else {
      rows.push({ from: t, to: t + b.dur, label: `${b.label} · ${LEVELS[b.level].label}`, level: b.level });
      t += b.dur;
      i++;
    }
  }
  return rows.map((r) => `
    <li><span class="dot" style="background:${LEVELS[r.level].color}"></span>
      <span class="when">${formatTime(r.from)}–${formatTime(r.to)}</span>
      <span>${esc(r.label)}</span></li>`).join('');
}

function levelLegend() {
  return ['easy', 'moderate', 'hard'].map((k) => {
    const t = bikeTarget(k);
    return `
    <li><span class="dot" style="background:${LEVELS[k].color}"></span>
      <span><b>${LEVELS[k].label}:</b> direnç ${t.res} · ${t.rpm} rpm. ${esc(LEVELS[k].hint)}</span></li>`;
  }).join('');
}

function exerciseDetails(id) {
  const ex = EXERCISES[id];
  return `
    <details class="ex">
      <summary><span>${esc(ex.name)}</span><small>${esc(ex.target)}</small></summary>
      <p>${esc(ex.how)}</p>
      <p class="variant"><b>Kolay:</b> ${esc(ex.easier)}</p>
      <p class="variant"><b>Zor:</b> ${esc(ex.harder)}</p>
    </details>`;
}

function stepper(name, label, value, min, max, step, unit) {
  return `
    <div class="stepper" data-name="${name}" data-min="${min}" data-max="${max}" data-step="${step}">
      <span class="stepper-label">${label}</span>
      <div class="stepper-ctrl">
        <button type="button" data-d="-1" aria-label="${label} azalt">−</button>
        <output>${value}</output><small>${unit}</small>
        <button type="button" data-d="1" aria-label="${label} artır">+</button>
      </div>
    </div>`;
}

function openSheet(programId) {
  const p = getProgram(programId);
  const opts = defaultOpts(p);
  const info = programInfo(p.id, opts);

  const summary = () => {
    const steps = buildSteps(p.id, opts);
    return `${minutesLabel(totalSeconds(steps))} · ~${estimateKcal(steps, settings.weightKg)} kcal`;
  };

  let body = '';
  if (p.kind === 'custom') {
    body = `
      <h4>Bölümler</h4><ul class="plan-rows">${planRowsHTML(p)}</ul>
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-plan-act="edit">Düzenle</button>
        <button type="button" class="btn ghost" data-plan-act="copy">Kopyala</button>
        <button type="button" class="btn ghost danger" data-plan-act="delete">Sil</button>
      </div>`;
  } else if (p.kind === 'bike') {
    body = `
      <h4>Süre</h4>${durationChips()}
      <h4>Akış</h4><ul class="rows">${bikeRows(p)}</ul>
      <h4>Direnç rehberi</h4><ul class="rows legend">${levelLegend()}</ul>`;
  } else if (p.kind === 'circuit') {
    body = `
      <div class="steppers">
        ${stepper('work', 'Çalış', opts.work, 20, 90, 5, 'sn')}
        ${stepper('rest', 'Dinlen', opts.rest, 0, 60, 5, 'sn')}
        ${stepper('rounds', 'Tur', opts.rounds, 1, 6, 1, '')}
      </div>
      <h4>Hareketler <small>(dokun: nasıl yapılır)</small></h4>
      ${p.exercises.map(exerciseDetails).join('')}`;
  } else {
    body = `<h4>Bisiklet süresi</h4>${durationChips()}
      <h4>Bölümler</h4><ul class="rows">${p.parts.map((id) => {
      const part = getProgram(id === 'bike' ? opts.bikeId : id);
      return `<li><span class="dot" style="background:var(--accent)"></span><span>${esc(part.name)} — ${esc(part.desc)}</span></li>`;
    }).join('')}</ul>`;
  }

  sheet.innerHTML = `
    <form method="dialog" class="sheet-inner">
      <div class="sheet-head">
        <div>
          <h2>${esc(info.name)}</h2>
          <p class="meta" id="sheet-summary">${summary()}</p>
        </div>
        <button class="icon-btn" value="cancel" aria-label="Kapat">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="timeline big" id="sheet-timeline">${timelineHTML(buildSteps(p.id, opts))}</div>
      <p>${esc(info.desc)}</p>
      ${body}
      ${p.kind !== 'custom' ? '<button type="button" class="btn ghost full" id="sheet-copy">Kopyala ve kendi planım yap</button>' : ''}
      <button type="button" class="btn primary full sticky" id="sheet-start">Başla</button>
    </form>`;

  $$('.stepper', sheet).forEach((st) => {
    const out = $('output', st);
    $$('button', st).forEach((b) => b.addEventListener('click', () => {
      const { name } = st.dataset;
      const min = +st.dataset.min;
      const max = +st.dataset.max;
      const stepSize = +st.dataset.step;
      opts[name] = Math.min(max, Math.max(min, opts[name] + stepSize * +b.dataset.d));
      out.textContent = opts[name];
      $('#sheet-summary', sheet).textContent = summary();
      $('#sheet-timeline', sheet).innerHTML = timelineHTML(buildSteps(p.id, opts));
    }));
  });

  // Switching duration re-renders the sheet for the new selection.
  $$('[data-bike]', sheet).forEach((c) => c.addEventListener('click', () => {
    selectBike(c.dataset.bike);
    openSheet(p.kind === 'bike' ? c.dataset.bike : p.id);
  }));

  // Built-in programs can be copied into an editable plan.
  $('#sheet-copy', sheet)?.addEventListener('click', () => {
    sheet.close();
    openEditor(planFromProgram(p, opts));
  });

  $$('[data-plan-act]', sheet).forEach((b) => b.addEventListener('click', () => {
    const act = b.dataset.planAct;
    if (act === 'edit') {
      sheet.close();
      openEditor(loadPlans().find((pl) => pl.id === p.id));
    }
    if (act === 'copy') {
      const copy = duplicatePlan(p.id);
      renderHome();
      if (copy) openSheet(copy.id);
    }
    if (act === 'delete' && confirm(`“${p.name}” silinsin mi?`)) {
      deletePlan(p.id);
      sheet.close();
      renderHome();
    }
  }));

  $('#sheet-start', sheet).addEventListener('click', () => {
    sheet.close();
    startRunner(p.id, opts);
  });

  if (!sheet.open) sheet.showModal();
}

// Close the sheet when tapping the backdrop.
sheet.addEventListener('click', (e) => {
  if (e.target === sheet) sheet.close();
});

/* ---------- Exercises ---------- */

function renderExercises(filter = 'all') {
  const list = Object.entries(EXERCISES).filter(([, ex]) => filter === 'all' || ex.equip === filter);
  $('#exercise-list').innerHTML = list.map(([, ex]) => `
    <details class="card ex">
      <summary>
        <span>${esc(ex.name)}</span>
        <span class="badge ${ex.equip}">${ex.equip === 'dumbbell' ? `${settings.dumbbellKg} kg dumbbell` : 'Vücut ağırlığı'}</span>
        <small>${esc(ex.target)}</small>
      </summary>
      <p>${esc(ex.how)}</p>
      <p class="variant"><b>Kolay:</b> ${esc(ex.easier)}</p>
      <p class="variant"><b>Zor:</b> ${esc(ex.harder)}</p>
    </details>`).join('');
}

$$('#exercise-filter .chip').forEach((c) => c.addEventListener('click', () => {
  $$('#exercise-filter .chip').forEach((x) => x.classList.toggle('active', x === c));
  renderExercises(c.dataset.filter);
}));

/* ---------- History ---------- */

const dateFmt = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

/* ---------- Calendar & streak ---------- */

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDay = null; // 'YYYY-MM-DD' or null for the whole month

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Bike (and bike + core) vs strength circuits, for the dot colours.
function entryKind(e) {
  const p = getProgram(e.programId);
  if (p?.kind === 'circuit') return 'strength';
  if (p?.kind === 'custom') return p.sections.some((s) => s.items.some((i) => i.type === 'bike')) ? 'bike' : 'strength';
  return 'bike';
}

function groupByDay(list) {
  const map = new Map();
  for (const e of list) {
    const k = dayKey(new Date(e.date));
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(e);
  }
  return map;
}

function weekCounts(list) {
  const map = new Map();
  for (const e of list) {
    const k = dayKey(startOfWeek(new Date(e.date)));
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

// A week counts toward the streak when it reaches the weekly goal. The
// current week only adds to the streak once reached; it never breaks it.
function streakInfo(list) {
  const goal = settings.weeklyGoal;
  const counts = weekCounts(list);
  const thisWeek = startOfWeek();
  const count = (d) => counts.get(dayKey(d)) || 0;

  let current = 0;
  let w = thisWeek;
  if (count(w) >= goal) current++;
  w = addDays(w, -7);
  while (count(w) >= goal) {
    current++;
    w = addDays(w, -7);
  }

  let best = 0;
  if (list.length) {
    const first = startOfWeek(new Date(Math.min(...list.map((e) => new Date(e.date)))));
    let run = 0;
    for (let d = first; d <= thisWeek; d = addDays(d, 7)) {
      run = count(d) >= goal ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return { goal, current, best, thisWeek: count(thisWeek) };
}

function renderStreak(list) {
  const s = streakInfo(list);
  const left = Math.max(0, s.goal - s.thisWeek);
  const pct = Math.min(100, (s.thisWeek / s.goal) * 100);
  let note;
  if (left === 0) note = 'Bu haftanın hedefi tamam. Harika!';
  else if (s.current > 0) note = `Seriyi sürdürmek için bu hafta ${left} antrenman daha.`;
  else note = `Seriyi başlatmak için bu hafta ${left} antrenman daha.`;
  $('#streak-card').innerHTML = `
    <div class="streak-stats">
      <div class="streak-main"><b>${s.current}</b><small>haftalık seri</small></div>
      <div><b>${s.thisWeek}/${s.goal}</b><small>bu hafta</small></div>
      <div><b>${s.best}</b><small>en iyi seri</small></div>
    </div>
    <div class="goal-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${s.goal}" aria-valuenow="${s.thisWeek}">
      <i style="width:${pct}%"></i>
    </div>
    <p class="streak-note">${note}</p>`;
}

function renderCalendar(list) {
  const byDay = groupByDay(list);
  const counts = weekCounts(list);
  const goal = settings.weeklyGoal;
  const y = calMonth.getFullYear();
  const m = calMonth.getMonth();
  const todayKey = dayKey(new Date());
  const lastDay = new Date(y, m + 1, 0);

  $('#cal-title').textContent = monthFmt.format(calMonth);
  // Don't page past the current month.
  $('#cal-next').disabled = y === new Date().getFullYear() && m === new Date().getMonth();

  let html = DAY_NAMES.map((d) => `<span class="cal-dow">${d}</span>`).join('')
    + '<span class="cal-dow cal-wk-head">Hafta</span>';
  for (let w = startOfWeek(calMonth); w <= lastDay; w = addDays(w, 7)) {
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i);
      const k = dayKey(d);
      const items = byDay.get(k) || [];
      const cls = [
        'cal-day',
        d.getMonth() !== m ? 'out' : '',
        items.length ? 'has' : '',
        k === todayKey ? 'today' : '',
        k === selectedDay ? 'selected' : '',
      ].join(' ');
      const dots = items.slice(0, 3).map((e) => `<i class="dot-${entryKind(e)}"></i>`).join('');
      const label = `${dayFmt.format(d)}${items.length ? `, ${items.length} antrenman` : ''}`;
      html += `<button type="button" class="${cls}" data-day="${k}" aria-label="${label}">
        <span>${d.getDate()}</span><span class="dots">${dots}</span></button>`;
    }
    const n = counts.get(dayKey(w)) || 0;
    const future = w > new Date();
    html += `<span class="cal-wk ${n >= goal ? 'met' : ''} ${future ? 'future' : ''}">${future ? '' : `${n}/${goal}`}</span>`;
  }
  $('#cal-grid').innerHTML = html;

  const monthEntries = list.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const mins = Math.round(monthEntries.reduce((a, e) => a + e.durationSec, 0) / 60);
  const kcal = monthEntries.reduce((a, e) => a + (e.kcal || 0), 0);
  const days = new Set(monthEntries.map((e) => dayKey(new Date(e.date)))).size;
  $('#cal-summary').innerHTML = monthEntries.length
    ? `<b>${monthEntries.length}</b> antrenman · <b>${days}</b> gün · <b>${Math.floor(mins / 60)} sa ${mins % 60} dk</b> · ~${kcal} kcal`
    : 'Bu ay henüz antrenman yok.';

  $$('#cal-grid [data-day]').forEach((b) => b.addEventListener('click', () => {
    selectedDay = selectedDay === b.dataset.day ? null : b.dataset.day;
    const d = new Date(`${b.dataset.day}T12:00:00`);
    if (d.getMonth() !== m) calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderHistory();
  }));
  return monthEntries;
}

function historyItemHTML(e) {
  return `
    <div class="card history-item kind-${entryKind(e)}">
      <div>
        <h3>${esc(e.name)}</h3>
        <p class="meta">${dateFmt.format(new Date(e.date))}</p>
      </div>
      <div class="history-right">
        <span class="badge ${e.completed ? 'ok' : 'partial'}">${e.completed ? 'Tamamlandı' : 'Yarım'}</span>
        ${e.rpe ? `<span class="badge rpe-${e.rpe}">${RPE_LABELS[e.rpe]}</span>` : ''}
        <span class="meta">${formatTime(e.durationSec)} · ~${e.kcal} kcal</span>
      </div>
      <button class="icon-btn small" data-remove="${e.id}" aria-label="Kaydı sil">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>`;
}

function renderHistory() {
  const list = loadHistory();
  renderStreak(list);
  const monthEntries = renderCalendar(list);

  const shown = selectedDay
    ? list.filter((e) => dayKey(new Date(e.date)) === selectedDay)
    : monthEntries;
  $('#list-title').textContent = selectedDay
    ? dayFmt.format(new Date(`${selectedDay}T12:00:00`))
    : `${monthFmt.format(calMonth)} antrenmanları`;
  $('#list-clear').hidden = !selectedDay;

  const el = $('#history-list');
  if (!shown.length) {
    el.innerHTML = list.length
      ? '<p class="empty">Bu tarihte antrenman yok.</p>'
      : '<p class="empty">Henüz kayıt yok. İlk antrenmanını bitirince takvimde görünecek.</p>';
    return;
  }
  el.innerHTML = shown.map(historyItemHTML).join('');
  $$('[data-remove]', el).forEach((b) => b.addEventListener('click', () => {
    if (confirm('Bu kayıt silinsin mi?')) {
      removeHistory(b.dataset.remove);
      renderHistory();
    }
  }));
}

$('#cal-prev').addEventListener('click', () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
  selectedDay = null;
  renderHistory();
});
$('#cal-next').addEventListener('click', () => {
  calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
  selectedDay = null;
  renderHistory();
});
$('#list-clear').addEventListener('click', () => {
  selectedDay = null;
  renderHistory();
});

/* ---------- Settings ---------- */

const form = $('#settings-form');

function fillSettings() {
  for (const [k, v] of Object.entries(settings)) {
    const input = form.elements[k];
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = v;
    else input.value = v;
  }
}

form.addEventListener('change', () => {
  const next = { ...settings };
  for (const k of Object.keys(settings)) {
    const input = form.elements[k];
    if (!input) continue;
    if (input.type === 'checkbox') next[k] = input.checked;
    else if (input.value !== '' && !Number.isNaN(+input.value)) next[k] = +input.value;
  }
  settings = next;
  saveSettings(settings);
  renderHome();
  renderExercises($('#exercise-filter .chip.active').dataset.filter);
});

$('#test-sound').addEventListener('click', () => {
  unlockAudio();
  beeps.up();
  if (settings.voice) setTimeout(() => speak('Ağır tempo. Bir dakika.'), 600);
  if (settings.vibrate) vibrate([150, 80, 150]);
});

$('#clear-history').addEventListener('click', () => {
  if (confirm('Tüm antrenman geçmişi silinsin mi?')) {
    clearHistory();
    renderWeek($('#week-summary'));
  }
});

/* ---------- Wake lock ---------- */

let wakeLock = null;

async function acquireWakeLock() {
  if (!settings.wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* denied or unsupported */ }
}

function releaseWakeLock() {
  wakeLock?.release?.();
  wakeLock = null;
}

/* ---------- Runner ---------- */

const runner = $('#runner');
const ringFg = $('#ring-fg');
const RING_LEN = 2 * Math.PI * 54;
ringFg.style.strokeDasharray = RING_LEN;

let timer = null;
let run = null; // { programId, opts, name, steps, total, startedAt, saved, historyId }
let muted = false;
let warnActive = false;

// Short spoken name for what comes next.
function nextPhrase(next) {
  return { hard: 'ağır tempo', moderate: 'orta tempo', easy: 'boşta pedal', rest: 'dinlenme' }[next.level]
    || next.label;
}

// What to do when the change comes, shown during the countdown.
function warnAction(step, next) {
  const to = bikeTarget(next.level);
  const from = bikeTarget(step.level);
  if (to && from) {
    const verb = to.res > from.res ? 'Direnci artır' : to.res < from.res ? 'Direnci azalt' : 'Direnç aynı';
    return `${verb} → ${to.res} · ${to.rpm} rpm`;
  }
  if (next.level === 'work') return `Hazırlan: ${next.hint || next.label}`;
  if (next.level === 'rest') return 'Son saniyeler, bırakma!';
  return next.hint || '';
}

function warnDue(step, next, remaining) {
  return !!next && step.dur > settings.warnSeconds && remaining <= settings.warnSeconds;
}

function announce(step, prev) {
  if (!muted && settings.beeps && prev) {
    if (RANK[step.level] > RANK[prev.level]) beeps.up();
    else beeps.down();
  }
  if (settings.vibrate) vibrate(RANK[step.level] >= 3 ? [250, 100, 250] : [200]);
  if (!muted && settings.voice) {
    let text = step.label;
    const t = bikeTarget(step.level);
    if (step.level === 'hard') text = `Ağır tempo! Direnç ${t.res}.`;
    else if (step.level === 'moderate' && prev?.level === 'hard') text = `Orta tempo. Direnç ${t.res}.`;
    else if (step.level === 'rest') {
      const next = run.steps[run.steps.indexOf(step) + 1];
      text = next ? `Dinlen. Sıradaki: ${next.label}` : 'Dinlen.';
    } else if (step.level === 'work') text = `${step.label}. ${step.dur} saniye.`;
    else if (step.dur >= 120) text = `${step.label}. ${Math.round(step.dur / 60)} dakika.`;
    setTimeout(() => speak(text), 500);
  }
}

function renderTargets(level) {
  const t = bikeTarget(level);
  const el = $('#targets');
  el.hidden = !t;
  if (t) {
    el.innerHTML = `
      <span><small>Direnç</small><b>${t.res}</b></span>
      <span><small>Kadans</small><b>${t.rpm}</b><small>rpm</small></span>`;
  }
}

function renderStep(step, index) {
  warnActive = false;
  runner.classList.remove('warning');
  runner.dataset.level = step.level;
  $('#step-tag').textContent = step.tag;
  $('#step-label').textContent = step.label;
  $('#step-hint').textContent = step.hint || '';
  renderTargets(step.level);
  const next = run.steps[index + 1];
  if (!next) {
    $('#next-step').textContent = 'Son adım!';
    return;
  }
  const lvlLabel = LEVELS[next.level].label;
  // Skip the level tag when the step label already says it (e.g. "Aralık 2/10 · Orta").
  const lvl = next.label.includes(lvlLabel)
    ? ''
    : ` <span class="lvl" style="color:${LEVELS[next.level].color}">${esc(lvlLabel)}</span>`;
  $('#next-step').innerHTML = `Sıradaki: <b>${esc(next.label)}</b>${lvl} · ${formatTime(next.dur)}`;
}

// Countdown mode: the screen switches to the colour and name of the next step.
function renderWarning(step, next) {
  warnActive = true;
  runner.classList.add('warning');
  runner.style.setProperty('--warn', LEVELS[next.level].color);
  $('#step-label').textContent = next.label;
  $('#step-hint').textContent = warnAction(step, next);
  renderTargets(next.level);
}

function renderTick(t) {
  const remaining = t.stepRemaining();
  const step = t.current;
  const next = run.steps[t.index + 1];
  const warn = warnDue(step, next, remaining);
  if (warn && !warnActive) renderWarning(step, next);
  else if (!warn && warnActive) renderStep(step, t.index);
  if (warn) $('#step-tag').textContent = `${Math.ceil(remaining)} sn sonra`;

  $('#step-time').textContent = formatTime(remaining);
  ringFg.style.strokeDashoffset = RING_LEN * (1 - remaining / step.dur);
  const elapsed = t.totalElapsed();
  $('#t-elapsed').textContent = formatTime(elapsed);
  $('#t-remaining').textContent = formatTime(run.total - elapsed);
  $('#t-kcal').textContent = estimateKcal(run.steps, settings.weightKg, elapsed);
  $('#playhead').style.left = `${(elapsed / run.total) * 100}%`;
  runner.classList.toggle('paused', !t.running);
}

function pulseTime() {
  const el = $('#step-time');
  el.classList.remove('pop');
  void el.offsetWidth; // restart the animation
  el.classList.add('pop');
}

function persistActive() {
  if (!run || !timer || timer.finished) return;
  saveActive({
    programId: run.programId,
    opts: run.opts,
    name: run.name,
    index: timer.index,
    elapsedMs: timer.stepElapsed(),
    done: Math.round(timer.totalElapsed()),
    total: run.total,
    startedAt: run.startedAt,
    savedAt: Date.now(),
  });
}

function historyEntry(programId, name, startedAt, steps, elapsed, completed) {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    programId,
    name,
    date: startedAt,
    durationSec: Math.round(elapsed),
    kcal: estimateKcal(steps, settings.weightKg, elapsed),
    completed,
  };
}

function saveRun(completed) {
  if (run.saved) return;
  const elapsed = completed ? run.total : timer.totalElapsed();
  if (elapsed < 60) return; // ignore accidental starts
  run.saved = true;
  const entry = historyEntry(run.programId, run.name, run.startedAt, run.steps, elapsed, completed);
  run.historyId = entry.id;
  addHistory(entry);
}

function startRunner(programId, opts, resume = null) {
  unlockAudio(); // must run inside the user's tap
  const { name } = programInfo(programId, opts);
  const steps = buildSteps(programId, opts);
  run = {
    programId,
    opts,
    name,
    steps,
    total: totalSeconds(steps),
    startedAt: resume?.startedAt || new Date().toISOString(),
    saved: false,
    historyId: null,
  };

  $('#runner-title').textContent = name;
  $('#timeline').innerHTML = `${timelineHTML(steps)}<div class="playhead" id="playhead"></div>`;
  $('#finish').hidden = true;
  runner.hidden = false;
  document.body.classList.add('running');

  let prevStep = null;
  timer = new SequenceTimer(steps, {
    onStep(step, index, info) {
      renderStep(step, index);
      if (info.fresh) announce(step, info.manual ? null : prevStep);
      prevStep = step;
      persistActive();
    },
    onCue(secLeft, step, next) {
      if (secLeft % 5 === 0) persistActive();
      const warnStart = next && step.dur > settings.warnSeconds && secLeft === settings.warnSeconds;
      const inWarn = next && step.dur > settings.warnSeconds && secLeft <= settings.warnSeconds && secLeft >= 1;
      if (inWarn) pulseTime();
      if (warnStart && settings.vibrate) vibrate([100, 60, 100, 60, 100]);
      if (muted) return;

      if (warnStart) {
        if (settings.beeps) beeps.warn();
        if (settings.voice) speak(`${secLeft} saniye sonra ${nextPhrase(next)}.`);
      } else if (inWarn && settings.beeps) {
        if (secLeft <= 3) beeps.count();
        else beeps.tick();
      }
      if (step.dur >= 180 && secLeft === 60) {
        if (settings.beeps) beeps.tick();
        if (settings.voice) speak('Son bir dakika.');
      }
      const ex = step.exercise && EXERCISES[step.exercise];
      if (ex?.sides && secLeft === Math.floor(step.dur / 2)) {
        if (settings.beeps) beeps.down();
        if (settings.voice) speak('Taraf değiştir.');
        if (settings.vibrate) vibrate([120, 60, 120]);
      }
    },
    onTick: renderTick,
    onFinish(t) {
      renderTick(t);
      if (!muted && settings.beeps) beeps.finish();
      if (settings.vibrate) vibrate([300, 100, 300, 100, 500]);
      if (!muted && settings.voice) setTimeout(() => speak('Antrenman tamamlandı. Harika iş!'), 900);
      saveRun(true);
      clearActive();
      $('#finish-text').textContent = `${run.name} bitti. ${formatTime(run.total)} · ~${estimateKcal(run.steps, settings.weightKg)} kcal`;
      $$('#rate-opts button').forEach((b) => b.classList.remove('active'));
      $('#rate-tip').textContent = '';
      $('#finish').hidden = false;
      releaseWakeLock();
    },
  });

  if (resume) {
    // Resume paused at the saved position; the user taps play when ready.
    timer.seek(resume.index, resume.elapsedMs);
    renderStep(timer.current, timer.index);
    renderTick(timer);
    return;
  }
  renderStep(steps[0], 0);
  timer.start();
  acquireWakeLock();
}

function closeRunner() {
  timer?.stop();
  timer = null;
  run = null;
  runner.hidden = true;
  document.body.classList.remove('running');
  clearActive();
  releaseWakeLock();
  window.speechSynthesis?.cancel();
  renderWeek($('#week-summary'));
  renderResume();
}

$('#btn-play').addEventListener('click', () => {
  unlockAudio();
  timer?.toggle();
  if (timer?.running) acquireWakeLock();
  persistActive();
});
$('#btn-next').addEventListener('click', () => timer?.next());
$('#btn-prev').addEventListener('click', () => timer?.prev());

$('#runner-sound').addEventListener('click', () => {
  muted = !muted;
  runner.classList.toggle('muted', muted);
  if (muted) window.speechSynthesis?.cancel();
});

$('#runner-close').addEventListener('click', () => {
  if (!timer || timer.finished) return closeRunner();
  const wasRunning = timer.running;
  timer.pause();
  const elapsed = timer.totalElapsed();
  const msg = elapsed >= 60
    ? 'Antrenmanı bitirmek istiyor musun? Yaptığın kısım geçmişe kaydedilecek.'
    : 'Antrenmanı bitirmek istiyor musun?';
  if (confirm(msg)) {
    saveRun(false);
    closeRunner();
  } else if (wasRunning) {
    timer.start();
  }
});

// Post-workout effort rating, with a tip for next time.
const RATE_TIPS = {
  bike: {
    1: 'Bir dahaki sefere ağır direnci 1 kademe artır ya da daha uzun akışı seç.',
    2: 'Güzel. Birkaç seans böyle devam, sonra ağır direnci 1 kademe artır.',
    3: 'Tam kıvamında. Aynen devam!',
    4: 'Bir dahaki sefere ağır direnci 1 kademe azalt ya da daha kısa akışı seç.',
  },
  circuit: {
    1: 'Bir tur ekle ya da çalışma süresini 5 sn uzat.',
    2: 'Güzel. Haftaya çalışma süresini 5 sn uzatmayı dene.',
    3: 'Tam kıvamında. Aynen devam!',
    4: 'Dinlenmeyi 5 sn uzat ya da bir tur azalt.',
  },
};

$$('#rate-opts button').forEach((b) => b.addEventListener('click', () => {
  if (!run) return;
  const rpe = +b.dataset.rpe;
  $$('#rate-opts button').forEach((x) => x.classList.toggle('active', x === b));
  if (run.historyId) updateHistory(run.historyId, { rpe });
  const kind = getProgram(run.programId).kind === 'circuit' ? 'circuit' : 'bike';
  $('#rate-tip').textContent = RATE_TIPS[kind][rpe];
}));

$('#finish-close').addEventListener('click', closeRunner);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    persistActive();
    return;
  }
  if (!timer) return;
  timer.tick();
  if (timer.running) acquireWakeLock();
});
window.addEventListener('pagehide', persistActive);

// Keyboard shortcuts (handy on tablets with keyboards / desktop testing).
document.addEventListener('keydown', (e) => {
  if (!timer || runner.hidden) return;
  if (e.code === 'Space') { e.preventDefault(); $('#btn-play').click(); }
  if (e.code === 'ArrowRight') timer.next();
  if (e.code === 'ArrowLeft') timer.prev();
});

/* ---------- Resume an interrupted workout ---------- */

const RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function renderResume() {
  const card = $('#resume-card');
  const active = loadActive();
  if (!active || Date.now() - active.savedAt > RESUME_MAX_AGE_MS || !getProgram(active.programId)) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  card.innerHTML = `
    <div>
      <h3>Yarım kalan antrenman</h3>
      <p class="meta">${esc(active.name)} · ${formatTime(active.done)} / ${formatTime(active.total)}</p>
    </div>
    <div class="resume-actions">
      <button type="button" class="btn primary" id="resume-go">Devam et</button>
      <button type="button" class="btn ghost" id="resume-drop">Kaydet ve kapat</button>
    </div>`;
  $('#resume-go').addEventListener('click', () => {
    card.hidden = true;
    startRunner(active.programId, active.opts, active);
  });
  $('#resume-drop').addEventListener('click', () => {
    if (active.done >= 60) {
      const steps = buildSteps(active.programId, active.opts);
      addHistory(historyEntry(active.programId, active.name, active.startedAt, steps, active.done, false));
    }
    clearActive();
    renderResume();
    renderWeek($('#week-summary'));
  });
}

/* ---------- Boot ---------- */

fillSettings();
renderHome();
renderExercises();
renderResume();
initGoals();
initPlans({
  onChange: renderHome,
  onStart: (id) => startRunner(id, {}),
  weightKg: () => settings.weightKg,
});
renderHomeGoals();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
