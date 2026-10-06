// User-built workout plans and their editor.
//
// Plan shape:
//   { id, name, sections: [{ name, repeat, items: [Item] }] }
// Item:
//   { type: 'bike', level: 'easy'|'moderate'|'hard', dur }
//   { type: 'exercise', exercise: <EXERCISES key>, dur }
//   { type: 'rest', dur }
//   { type: 'custom', name, level: 'work'|'rest', dur }
import { EXERCISES, LEVELS, getProgram } from './data.js';
import { loadPlans, savePlans } from './store.js';
import { buildPlanSteps, totalSeconds, estimateKcal, formatTime } from './steps.js';
import { visualHTML } from './visual.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (str) => String(str).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const DEFAULT_DUR = { bike: 60, exercise: 40, rest: 20, custom: 30 };
const BIKE_NAMES = { easy: 'Boşta', moderate: 'Orta', hard: 'Ağır' };
const MAX_REPEAT = 50;

let hooks = {
  onChange() {}, onStart() {}, weightKg: () => 75, resistance: () => '',
};
let draft = null; // plan being edited
let pickerSection = -1;

const newId = () => `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------- Storage helpers ---------- */

export function upsertPlan(plan) {
  const plans = loadPlans();
  const i = plans.findIndex((p) => p.id === plan.id);
  if (i >= 0) plans[i] = plan;
  else plans.unshift(plan);
  savePlans(plans);
}

export function deletePlan(id) {
  savePlans(loadPlans().filter((p) => p.id !== id));
}

export function duplicatePlan(id) {
  const src = loadPlans().find((p) => p.id === id);
  if (!src) return null;
  const copy = { ...clone(src), id: newId(), name: `${src.name} (kopya)` };
  upsertPlan(copy);
  return copy;
}

// Turns a built-in program into an editable plan.
export function planFromProgram(program, opts = {}) {
  if (program.kind === 'bike') {
    const sections = [];
    const b = program.blocks;
    for (let i = 0; i < b.length;) {
      // Group repeated 1-min moderate/hard pairs into one repeated section.
      let n = 0;
      while (b[i + n * 2]?.dur === 60 && b[i + n * 2].level === 'moderate'
        && b[i + n * 2 + 1]?.dur === 60 && b[i + n * 2 + 1].level === 'hard') n++;
      if (n > 0) {
        sections.push({
          name: 'Aralıklar',
          repeat: n,
          items: [{ type: 'bike', level: 'moderate', dur: 60 }, { type: 'bike', level: 'hard', dur: 60 }],
        });
        i += n * 2;
      } else {
        sections.push({ name: b[i].label, repeat: 1, items: [{ type: 'bike', level: b[i].level, dur: b[i].dur }] });
        i++;
      }
    }
    return { id: newId(), name: `${program.name} (benim)`, sections };
  }
  if (program.kind === 'circuit') {
    const work = opts.work ?? program.work;
    const rest = opts.rest ?? program.rest;
    const items = [];
    program.exercises.forEach((id, i) => {
      items.push({ type: 'exercise', exercise: id, dur: work });
      const last = i === program.exercises.length - 1;
      if (last && program.roundRest) items.push({ type: 'rest', name: 'Tur arası', dur: program.roundRest });
      else if (!last && rest) items.push({ type: 'rest', dur: rest });
    });
    return {
      id: newId(),
      name: `${program.name} (benim)`,
      sections: [{ name: 'Tur', repeat: opts.rounds ?? program.rounds, items }],
    };
  }
  // combo: merge the parts' sections
  const parts = program.parts.map((id) => getProgram(id === 'bike' ? (opts.bikeId || 'bike40') : id));
  const sections = parts.flatMap((p) => planFromProgram(p).sections);
  return { id: newId(), name: `${program.name} (benim)`, sections };
}

/* ---------- Display helpers ---------- */

function itemName(item) {
  if (item.type === 'bike') return `Bisiklet · ${BIKE_NAMES[item.level]}`;
  if (item.type === 'exercise') return EXERCISES[item.exercise]?.name || 'Hareket';
  if (item.type === 'rest') return item.name || 'Dinlen';
  return item.name;
}

function itemThumb(item) {
  const id = item.type === 'exercise' ? item.exercise : item.type === 'bike' ? 'bike' : null;
  const bar = `<i class="ed-bar" style="background:${LEVELS[itemLevel(item)].color}"></i>`;
  if (!id) return `<span class="ed-thumb">${bar}</span>`;
  return `<span class="ed-thumb">${visualHTML(id, 'thumb')}${bar}</span>`;
}

function itemLevel(item) {
  if (item.type === 'bike') return item.level;
  if (item.type === 'exercise') return 'work';
  if (item.type === 'rest') return 'rest';
  return item.level === 'rest' ? 'rest' : 'work';
}

export function planRowsHTML(plan) {
  return plan.sections.filter((s) => s.items.length).map((s) => `
    <li class="plan-sec">
      <div class="plan-sec-head"><b>${esc(s.name || 'Bölüm')}</b>${s.repeat > 1 ? `<span class="badge">${s.repeat} tur</span>` : ''}</div>
      <ul class="plan-items">${s.items.map((it) => `
        <li><span class="dot" style="background:${LEVELS[itemLevel(it)].color}"></span>
          <span>${esc(itemName(it))}</span><span class="when">${formatTime(it.dur)}</span></li>`).join('')}
      </ul>
    </li>`).join('');
}

// Step for the duration buttons: finer for short steps.
function durStep(dur, dir) {
  if (dir < 0) return dur <= 60 ? 5 : dur <= 300 ? 15 : 60;
  return dur < 60 ? 5 : dur < 300 ? 15 : 60;
}

function parseDuration(text) {
  const t = text.trim().replace(',', '.');
  if (/^\d+:\d{1,2}$/.test(t)) {
    const [m, s] = t.split(':').map(Number);
    return m * 60 + s;
  }
  if (/^\d+(\.\d+)?\s*(dk|d|m)$/i.test(t)) return Math.round(parseFloat(t) * 60);
  if (/^\d+\s*(sn|s)?$/i.test(t)) return parseInt(t, 10);
  return NaN;
}

/* ---------- Editor ---------- */

const editor = () => $('#editor');
const picker = () => $('#step-picker');

export function openEditor(plan = null) {
  draft = plan ? clone(plan) : { id: newId(), name: '', sections: [{ name: '', repeat: 1, items: [] }] };
  $('#ed-name').value = draft.name;
  $('#ed-title').textContent = plan && loadPlans().some((p) => p.id === plan.id) ? 'Planı düzenle' : 'Yeni plan';
  renderEditor();
  editor().hidden = false;
  document.body.classList.add('editing');
  editor().scrollTop = 0;
}

function closeEditor() {
  editor().hidden = true;
  document.body.classList.remove('editing');
  draft = null;
}

function draftSummary() {
  const total = draft.sections.reduce((n, s) => n + s.items.length, 0);
  if (!total) return { text: 'Henüz adım yok', steps: [] };
  // Preview through the same expansion the runner uses.
  const steps = buildPlanSteps(draft).slice(1);
  return {
    text: `${Math.round(totalSeconds(steps) / 60)} dk · ${steps.length} adım · ~${estimateKcal(steps, hooks.weightKg())} kcal`,
    steps,
  };
}

function renderSummary() {
  const { text, steps } = draftSummary();
  $('#ed-summary').textContent = text;
  $('#ed-timeline').innerHTML = steps
    .map((s) => `<i style="flex-grow:${s.dur};background:${LEVELS[s.level].color}"></i>`).join('');
  const empty = !steps.length;
  $('#ed-save').disabled = empty;
  $('#ed-start').disabled = empty;
}

function sectionHTML(s, si) {
  const last = si === draft.sections.length - 1;
  return `
    <section class="ed-sec" data-si="${si}">
      <div class="ed-sec-head">
        <input class="ed-sec-name" value="${esc(s.name)}" placeholder="Bölüm adı (ör. Isınma)" maxlength="30" aria-label="Bölüm adı">
        <div class="ed-tools">
          <button type="button" class="mini" data-sec-act="up" ${si === 0 ? 'disabled' : ''} aria-label="Bölümü yukarı taşı">↑</button>
          <button type="button" class="mini" data-sec-act="down" ${last ? 'disabled' : ''} aria-label="Bölümü aşağı taşı">↓</button>
          <button type="button" class="mini danger" data-sec-act="del" aria-label="Bölümü sil">✕</button>
        </div>
      </div>
      <div class="ed-repeat">
        <span>Tur sayısı</span>
        <div class="stepper-ctrl">
          <button type="button" data-rep="-1" aria-label="Tur azalt">−</button>
          <output>${s.repeat}</output>
          <button type="button" data-rep="1" aria-label="Tur artır">+</button>
        </div>
        <small>${s.repeat > 1 ? 'Bu bölümdeki adımlar sırayla tekrar eder' : 'Bir kez yapılır'}</small>
      </div>
      <ol class="ed-items">${s.items.map((it, ii) => `
        <li class="ed-item" data-ii="${ii}">
          ${itemThumb(it)}
          <span class="ed-item-name">${esc(itemName(it))}</span>
          <div class="ed-dur">
            <button type="button" data-dur="-1" aria-label="Süreyi azalt">−</button>
            <button type="button" class="ed-dur-val" data-dur-edit aria-label="Süreyi yaz">${formatTime(it.dur)}</button>
            <button type="button" data-dur="1" aria-label="Süreyi artır">+</button>
          </div>
          <div class="ed-tools">
            <button type="button" class="mini" data-item-act="up" ${ii === 0 ? 'disabled' : ''} aria-label="Yukarı taşı">↑</button>
            <button type="button" class="mini" data-item-act="down" ${ii === s.items.length - 1 ? 'disabled' : ''} aria-label="Aşağı taşı">↓</button>
            <button type="button" class="mini danger" data-item-act="del" aria-label="Adımı sil">✕</button>
          </div>
        </li>`).join('')}
      </ol>
      <button type="button" class="btn ghost full ed-add" data-add-step>+ Adım ekle</button>
    </section>`;
}

function renderEditor() {
  $('#ed-sections').innerHTML = draft.sections.map(sectionHTML).join('');
  bindEditor();
  renderSummary();
}

function swap(arr, i, j) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function bindEditor() {
  $$('.ed-sec', editor()).forEach((secEl) => {
    const si = +secEl.dataset.si;
    const sec = draft.sections[si];

    $('.ed-sec-name', secEl).addEventListener('input', (e) => {
      sec.name = e.target.value;
      renderSummary();
    });

    $$('[data-sec-act]', secEl).forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.secAct;
      if (act === 'up') swap(draft.sections, si, si - 1);
      if (act === 'down') swap(draft.sections, si, si + 1);
      if (act === 'del') {
        if (sec.items.length && !confirm('Bu bölüm ve adımları silinsin mi?')) return;
        draft.sections.splice(si, 1);
        if (!draft.sections.length) draft.sections.push({ name: '', repeat: 1, items: [] });
      }
      renderEditor();
    }));

    $$('[data-rep]', secEl).forEach((b) => b.addEventListener('click', () => {
      sec.repeat = Math.min(MAX_REPEAT, Math.max(1, sec.repeat + +b.dataset.rep));
      renderEditor();
    }));

    $$('.ed-item', secEl).forEach((row) => {
      const ii = +row.dataset.ii;
      const item = sec.items[ii];
      $$('[data-dur]', row).forEach((b) => b.addEventListener('click', () => {
        const dir = +b.dataset.dur;
        item.dur = Math.min(3600, Math.max(5, item.dur + dir * durStep(item.dur, dir)));
        renderEditor();
      }));
      $('[data-dur-edit]', row).addEventListener('click', () => {
        const raw = prompt('Süre (ör. 45, 1:30 ya da 5 dk):', formatTime(item.dur));
        if (raw === null) return;
        const secs = parseDuration(raw);
        if (!Number.isFinite(secs) || secs < 5 || secs > 3600) {
          alert('Süre 5 saniye ile 60 dakika arasında olmalı.');
          return;
        }
        item.dur = secs;
        renderEditor();
      });
      $$('[data-item-act]', row).forEach((b) => b.addEventListener('click', () => {
        const act = b.dataset.itemAct;
        if (act === 'up') swap(sec.items, ii, ii - 1);
        if (act === 'down') swap(sec.items, ii, ii + 1);
        if (act === 'del') sec.items.splice(ii, 1);
        renderEditor();
      }));
    });

    $('[data-add-step]', secEl).addEventListener('click', () => openPicker(si));
  });
}

/* ---------- Step picker ---------- */

const PICK_TABS = [
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'bodyweight', label: 'Vücut ağırlığı' },
  { id: 'bike', label: 'Bisiklet' },
  { id: 'other', label: 'Dinlenme / Diğer' },
];
let pickTab = 'dumbbell';

function exerciseCards(equip) {
  return Object.entries(EXERCISES).filter(([, ex]) => ex.equip === equip).map(([id, ex]) => `
    <button type="button" class="pick-card" data-ex="${id}">
      ${visualHTML(id, 'thumb', esc(ex.name))}
      <span class="pick-card-text"><b>${esc(ex.name)}</b><small>${esc(ex.target)}</small></span>
    </button>`).join('');
}

function pickTabHTML(tab) {
  if (tab === 'dumbbell' || tab === 'bodyweight') {
    return `<div class="pick-grid">${exerciseCards(tab)}</div>`;
  }
  if (tab === 'bike') {
    return `
      ${visualHTML('bike', 'full', 'Kondisyon bisikleti')}
      <div class="pick-row">
        ${['easy', 'moderate', 'hard'].map((l) => `
          <button type="button" class="pick-bike" data-bike="${l}" style="--c:${LEVELS[l].color}">
            ${BIKE_NAMES[l]}<small>direnç ${hooks.resistance(l)} · ${LEVELS[l].rpm} rpm</small>
          </button>`).join('')}
      </div>`;
  }
  return `
    <div class="pick-row">
      <button type="button" class="pick-bike" data-rest style="--c:${LEVELS.rest.color}">Dinlen<small>nefes al, su iç</small></button>
    </div>
    <h4>Listede yoksa kendin ekle</h4>
    <div class="pick-custom">
      <input type="text" id="pick-name" maxlength="40" placeholder="Hareket adı (ör. İp atlama)">
      <div class="chips">
        <button type="button" class="chip active" data-kind="work">Çalış</button>
        <button type="button" class="chip" data-kind="rest">Dinlen</button>
      </div>
      <button type="button" class="btn primary full" id="pick-add">Ekle</button>
    </div>`;
}

function openPicker(si) {
  pickerSection = si;
  picker().innerHTML = `
    <form method="dialog" class="sheet-inner">
      <div class="sheet-head">
        <h2>Adım ekle</h2>
        <button class="icon-btn" value="cancel" aria-label="Kapat">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="chips pick-tabs" role="tablist">
        ${PICK_TABS.map((t) => `<button type="button" class="chip ${t.id === pickTab ? 'active' : ''}" role="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="pick-body"></div>
    </form>`;

  const add = (item) => {
    draft.sections[pickerSection].items.push(item);
    picker().close();
    renderEditor();
    // Keep the new step in view.
    const rows = $$(`.ed-sec[data-si="${pickerSection}"] .ed-item`, editor());
    rows[rows.length - 1]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const showTab = (tab) => {
    pickTab = tab;
    $$('[data-tab]', picker()).forEach((c) => c.classList.toggle('active', c.dataset.tab === tab));
    const body = $('#pick-body', picker());
    body.innerHTML = pickTabHTML(tab);
    $$('[data-bike]', body).forEach((b) => b.addEventListener('click', () => add({ type: 'bike', level: b.dataset.bike, dur: DEFAULT_DUR.bike })));
    $('[data-rest]', body)?.addEventListener('click', () => add({ type: 'rest', dur: DEFAULT_DUR.rest }));
    $$('[data-ex]', body).forEach((b) => b.addEventListener('click', () => add({ type: 'exercise', exercise: b.dataset.ex, dur: DEFAULT_DUR.exercise })));
    let kind = 'work';
    $$('[data-kind]', body).forEach((c) => c.addEventListener('click', () => {
      kind = c.dataset.kind;
      $$('[data-kind]', body).forEach((x) => x.classList.toggle('active', x === c));
    }));
    $('#pick-add', body)?.addEventListener('click', () => {
      const name = $('#pick-name', body).value.trim();
      if (!name) {
        $('#pick-name', body).focus();
        return;
      }
      add({ type: 'custom', name, level: kind, dur: DEFAULT_DUR.custom });
    });
  };

  $$('[data-tab]', picker()).forEach((c) => c.addEventListener('click', () => showTab(c.dataset.tab)));
  showTab(pickTab);
  picker().showModal();
}

/* ---------- Wiring ---------- */

function commit() {
  draft.name = $('#ed-name').value.trim() || 'Planım';
  draft.sections = draft.sections
    .filter((s) => s.items.length)
    .map((s) => ({ ...s, name: s.name.trim() }));
  upsertPlan(draft);
  return draft.id;
}

export function initPlans(h) {
  hooks = { ...hooks, ...h };
  $('#ed-name').addEventListener('input', () => renderSummary());
  $('#ed-add-section').addEventListener('click', () => {
    draft.sections.push({ name: '', repeat: 1, items: [] });
    renderEditor();
    $$('.ed-sec', editor()).at(-1)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $('#ed-cancel').addEventListener('click', () => {
    if (draft.sections.some((s) => s.items.length) && !confirm('Değişiklikler kaydedilmeden çıkılsın mı?')) return;
    closeEditor();
  });
  $('#ed-save').addEventListener('click', () => {
    commit();
    closeEditor();
    hooks.onChange();
  });
  $('#ed-start').addEventListener('click', () => {
    const id = commit();
    closeEditor();
    hooks.onChange();
    hooks.onStart(id);
  });
  picker().addEventListener('click', (e) => {
    if (e.target === picker()) picker().close();
  });
}
