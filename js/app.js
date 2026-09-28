import { EXERCISES, LEVELS, PROGRAMS, BIKE_MINUTES, getProgram } from './data.js';
import {
  buildSteps, totalSeconds, estimateKcal, formatTime, programInfo,
} from './steps.js';
import { SequenceTimer } from './timer.js';
import { unlockAudio, beeps, speak, vibrate } from './audio.js';
import {
  loadSettings, saveSettings, loadHistory, addHistory, removeHistory, clearHistory,
} from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let settings = loadSettings();

const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Effort rank decides whether a transition beep goes "up" or "down".
const RANK = { prep: 0, easy: 1, rest: 1, moderate: 2, work: 3, hard: 3 };

/* ---------- Navigation ---------- */

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'history') renderHistory();
  if (name === 'home') renderWeek($('#week-summary'));
  window.scrollTo(0, 0);
}

$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

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

function renderHome() {
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
      <div><b>${entries.length}</b><small>antrenman</small></div>
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
  return ['easy', 'moderate', 'hard'].map((k) => `
    <li><span class="dot" style="background:${LEVELS[k].color}"></span>
      <span><b>${LEVELS[k].label}:</b> ${esc(LEVELS[k].hint)}</span></li>`).join('');
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
  if (p.kind === 'bike') {
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

function renderHistory() {
  renderWeek($('#history-summary'));
  const list = loadHistory();
  const el = $('#history-list');
  if (!list.length) {
    el.innerHTML = '<p class="empty">Henüz kayıt yok. İlk antrenmanını bitirince burada görünecek.</p>';
    return;
  }
  el.innerHTML = list.map((e) => `
    <div class="card history-item">
      <div>
        <h3>${esc(e.name)}</h3>
        <p class="meta">${dateFmt.format(new Date(e.date))}</p>
      </div>
      <div class="history-right">
        <span class="badge ${e.completed ? 'ok' : 'partial'}">${e.completed ? 'Tamamlandı' : 'Yarım'}</span>
        <span class="meta">${formatTime(e.durationSec)} · ~${e.kcal} kcal</span>
      </div>
      <button class="icon-btn small" data-remove="${e.id}" aria-label="Kaydı sil">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>`).join('');
  $$('[data-remove]', el).forEach((b) => b.addEventListener('click', () => {
    if (confirm('Bu kayıt silinsin mi?')) {
      removeHistory(b.dataset.remove);
      renderHistory();
    }
  }));
}

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
let run = null; // { programId, name, steps, total, startedAt, saved }
let muted = false;

function announce(step, prev) {
  if (!muted && settings.beeps && prev) {
    if (RANK[step.level] > RANK[prev.level]) beeps.up();
    else beeps.down();
  }
  if (settings.vibrate) vibrate(RANK[step.level] >= 3 ? [250, 100, 250] : [200]);
  if (!muted && settings.voice) {
    let text = step.label;
    if (step.level === 'hard') text = 'Ağır tempo! Direnci artır.';
    else if (step.level === 'moderate' && prev?.level === 'hard') text = 'Orta tempo.';
    else if (step.level === 'rest') {
      const next = run.steps[run.steps.indexOf(step) + 1];
      text = next ? `Dinlen. Sıradaki: ${next.label}` : 'Dinlen.';
    } else if (step.level === 'work') text = `${step.label}. ${step.dur} saniye.`;
    else if (step.dur >= 120) text = `${step.label}. ${Math.round(step.dur / 60)} dakika.`;
    setTimeout(() => speak(text), 500);
  }
}

function renderStep(step, index) {
  runner.dataset.level = step.level;
  $('#step-tag').textContent = step.tag;
  $('#step-label').textContent = step.label;
  $('#step-hint').textContent = step.hint || '';
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

function renderTick(t) {
  const remaining = t.stepRemaining();
  const step = t.current;
  $('#step-time').textContent = formatTime(remaining);
  ringFg.style.strokeDashoffset = RING_LEN * (1 - remaining / step.dur);
  const elapsed = t.totalElapsed();
  $('#t-elapsed').textContent = formatTime(elapsed);
  $('#t-remaining').textContent = formatTime(run.total - elapsed);
  $('#t-kcal').textContent = estimateKcal(run.steps, settings.weightKg, elapsed);
  $('#playhead').style.left = `${(elapsed / run.total) * 100}%`;
  runner.classList.toggle('paused', !t.running);
}

function saveRun(completed) {
  if (run.saved) return;
  const elapsed = completed ? run.total : timer.totalElapsed();
  if (elapsed < 60) return; // ignore accidental starts
  run.saved = true;
  addHistory({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    programId: run.programId,
    name: run.name,
    date: run.startedAt,
    durationSec: Math.round(elapsed),
    kcal: estimateKcal(run.steps, settings.weightKg, elapsed),
    completed,
  });
}

function startRunner(programId, opts) {
  unlockAudio(); // must run inside the user's tap
  const { name } = programInfo(programId, opts);
  const steps = buildSteps(programId, opts);
  run = {
    programId,
    name,
    steps,
    total: totalSeconds(steps),
    startedAt: new Date().toISOString(),
    saved: false,
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
    },
    onCue(secLeft, step, next) {
      if (muted) return;
      if (secLeft >= 1 && secLeft <= 3 && next && settings.beeps) beeps.count();
      if (step.dur >= 180 && secLeft === 60) {
        if (settings.beeps) beeps.count();
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
      $('#finish-text').textContent = `${run.name} bitti. ${formatTime(run.total)} · ~${estimateKcal(run.steps, settings.weightKg)} kcal`;
      $('#finish').hidden = false;
      releaseWakeLock();
    },
  });

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
  releaseWakeLock();
  window.speechSynthesis?.cancel();
  renderWeek($('#week-summary'));
}

$('#btn-play').addEventListener('click', () => {
  unlockAudio();
  timer?.toggle();
  if (timer?.running) acquireWakeLock();
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

$('#finish-close').addEventListener('click', closeRunner);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !timer) return;
  timer.tick();
  if (timer.running) acquireWakeLock();
});

// Keyboard shortcuts (handy on tablets with keyboards / desktop testing).
document.addEventListener('keydown', (e) => {
  if (!timer || runner.hidden) return;
  if (e.code === 'Space') { e.preventDefault(); $('#btn-play').click(); }
  if (e.code === 'ArrowRight') timer.next();
  if (e.code === 'ArrowLeft') timer.prev();
});

/* ---------- Boot ---------- */

fillSettings();
renderHome();
renderExercises();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
