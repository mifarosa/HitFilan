// User-built workout plans and their editor.
//
// Plan shape (kept compatible with older plans and with cloud sync):
//   { id, name, sections: [{ name, repeat, items: [Item] }] }
// The editor works on one flat list of moves: older plans with several sections or
// repeats are flattened when opened, and saved as a single section.
// Item:
//   { type: 'bike', level: 'easy'|'moderate'|'hard', dur }
//   { type: 'exercise', exercise: <EXERCISES key>, dur | reps, sets?, kg?, rest? }
//     sets: how many sets (default 1); reps: counted by hand, else dur seconds;
//     kg: dumbbell weight; rest: seconds of rest between sets
//   { type: 'rest', dur }
//   { type: 'custom', name, level: 'work'|'rest', dur }
import { EXERCISES, LEVELS, GROUPS, getProgram } from './data.js';
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

let hooks = {
  onChange() {}, onStart() {}, weightKg: () => 75, resistance: () => '', defaultReps: () => 12, dumbbellKg: () => 7.5,
};
let draft = null; // plan being edited: { id, name, items: [Item] }

const kgText = (kg) => kg.toLocaleString('tr-TR');

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
      const item = { type: 'exercise', exercise: id, dur: work };
      if (opts.weightReps && EXERCISES[id].equip === 'dumbbell') item.reps = opts.weightReps;
      items.push(item);
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

// "3 × 12 · 7,5 kg" / "3 × 0:40" / "1:00" for a move.
export function itemAmount(it) {
  if (it.type !== 'exercise') return formatTime(it.dur);
  const per = it.reps ? `${it.reps}` : formatTime(it.dur);
  const sets = it.sets > 1 ? `${it.sets} × ${per}` : it.reps ? `${it.reps} tekrar` : per;
  return it.kg > 0 ? `${sets} · ${kgText(it.kg)} kg` : sets;
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
      ${s.name || s.repeat > 1 ? `<div class="plan-sec-head"><b>${esc(s.name || 'Bölüm')}</b>${s.repeat > 1 ? `<span class="badge">${s.repeat} tur</span>` : ''}</div>` : ''}
      <ul class="plan-items">${s.items.map((it) => `
        <li><span class="dot" style="background:${LEVELS[itemLevel(it)].color}"></span>
          <span>${esc(itemName(it))}</span><span class="when">${itemAmount(it)}</span></li>`).join('')}
      </ul>
    </li>`).join('');
}

/* ---------- Editor ---------- */

const editor = () => $('#editor');
const picker = () => $('#step-picker');

// Older plans: sections repeated `repeat` times become one flat list of moves.
function flatten(plan) {
  return plan.sections.flatMap((s) => Array.from({ length: Math.max(1, s.repeat || 1) }, () => clone(s.items))).flat();
}

const asPlan = (d) => ({ ...d, sections: [{ name: '', repeat: 1, items: d.items }] });

export function openEditor(plan = null) {
  draft = plan
    ? { id: plan.id, name: plan.name, items: flatten(plan) }
    : { id: newId(), name: '', items: [] };
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
  if (!draft.items.length) return { text: 'Henüz hareket yok', steps: [] };
  // Preview through the same expansion the runner uses.
  const steps = buildPlanSteps(asPlan(draft)).slice(1);
  return {
    text: `${draft.items.length} hareket · ${Math.round(totalSeconds(steps) / 60)} dk · ~${estimateKcal(steps, hooks.weightKg())} kcal`,
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

function rowHTML(it, ii) {
  const last = ii === draft.items.length - 1;
  return `
    <li class="ed-row" data-ii="${ii}">
      <button type="button" class="ed-drag" aria-label="Sürükleyerek sırala">⠿</button>
      ${itemThumb(it)}
      <button type="button" class="ed-row-main" data-edit aria-label="Düzenle">
        <b>${esc(itemName(it))}</b>
        <small>${itemAmount(it)}${it.type === 'exercise' && it.sets > 1 && it.rest ? ` · ${it.rest} sn dinlenme` : ''}</small>
      </button>
      <div class="ed-tools">
        <button type="button" class="mini" data-act="up" ${ii === 0 ? 'disabled' : ''} aria-label="Yukarı taşı">↑</button>
        <button type="button" class="mini" data-act="down" ${last ? 'disabled' : ''} aria-label="Aşağı taşı">↓</button>
        <button type="button" class="mini" data-act="copy" aria-label="Kopyala">⧉</button>
        <button type="button" class="mini danger" data-act="del" aria-label="Sil">✕</button>
      </div>
    </li>`;
}

function renderEditor() {
  $('#ed-sections').innerHTML = `
    <ol class="ed-items ed-flat" id="ed-list">${draft.items.map(rowHTML).join('')}</ol>
    ${draft.items.length ? '' : '<p class="empty">Henüz hareket yok. Aşağıdan bir hareket seç, set, tekrar ve ağırlığı gir.</p>'}
    <button type="button" class="btn primary full ed-add" id="ed-add-move">+ Hareket ekle</button>`;
  bindEditor();
  renderSummary();
}

function swap(arr, i, j) {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function bindEditor() {
  $('#ed-add-move').addEventListener('click', () => {
    pickGroup = 'all'; // a fresh picker starts unfiltered
    openPicker();
  });
  $$('#ed-list .ed-row').forEach((row) => {
    const ii = +row.dataset.ii;
    $('[data-edit]', row).addEventListener('click', () => openForm(draft.items[ii], false, (item) => {
      draft.items[ii] = item;
      renderEditor();
    }));
    $$('[data-act]', row).forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'up') swap(draft.items, ii, ii - 1);
      if (act === 'down') swap(draft.items, ii, ii + 1);
      if (act === 'copy') draft.items.splice(ii + 1, 0, clone(draft.items[ii]));
      if (act === 'del') draft.items.splice(ii, 1);
      renderEditor();
    }));
    bindDrag(row);
  });
}

// Drag a row by its handle. Rows stay in place while dragging (moving the dragged
// element would drop the pointer capture); the row under the pointer shows where it
// will land, and the list is reordered on release.
function bindDrag(row) {
  const handle = $('.ed-drag', row);
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    row.classList.add('dragging');
    const list = row.parentElement;
    const from = +row.dataset.ii;
    let drop = null; // { index, after }
    const mark = () => $$('.ed-row', list).forEach((r) => {
      r.classList.toggle('drop-before', !!drop && +r.dataset.ii === drop.index && !drop.after);
      r.classList.toggle('drop-after', !!drop && +r.dataset.ii === drop.index && drop.after);
    });
    const move = (ev) => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.ed-row');
      if (!over || over.parentElement !== list || over === row) return;
      const r = over.getBoundingClientRect();
      drop = { index: +over.dataset.ii, after: ev.clientY >= r.top + r.height / 2 };
      mark();
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (drop) {
        const [item] = draft.items.splice(from, 1);
        let to = drop.index + (drop.after ? 1 : 0);
        if (from < to) to -= 1;
        draft.items.splice(to, 0, item);
      }
      renderEditor();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}

/* ---------- Move picker and the quick form ---------- */

const PICK_TABS = [
  { id: 'dumbbell', label: 'Dumbbell' },
  { id: 'bodyweight', label: 'Vücut ağırlığı' },
  { id: 'bike', label: 'Bisiklet' },
  { id: 'other', label: 'Dinlenme / Diğer' },
];
let pickTab = 'dumbbell';
let pickGroup = 'all';

function exerciseCards(equip) {
  return Object.entries(EXERCISES)
    .filter(([, ex]) => ex.equip === equip && (pickGroup === 'all' || ex.group === pickGroup))
    .map(([id, ex]) => `
    <button type="button" class="pick-card" data-ex="${id}">
      ${visualHTML(id, 'thumb', esc(ex.name))}
      <span class="pick-card-text"><b>${esc(ex.name)}</b><small>${esc(ex.target)}</small></span>
    </button>`).join('');
}

function groupChips() {
  return `<div class="chips pick-groups" role="group" aria-label="Bölge">
    ${[{ id: 'all', label: 'Hepsi' }, ...GROUPS].map((g) => `<button type="button" class="chip ${g.id === pickGroup ? 'active' : ''}" data-group="${g.id}">${g.label}</button>`).join('')}
  </div>`;
}

function pickTabHTML(tab) {
  if (tab === 'dumbbell' || tab === 'bodyweight') {
    const cards = exerciseCards(tab);
    return `${groupChips()}<div class="pick-grid">${cards || '<p class="empty">Bu bölgede hareket yok.</p>'}</div>`;
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

function defaultItem(id) {
  const ex = EXERCISES[id];
  const item = { type: 'exercise', exercise: id, dur: DEFAULT_DUR.exercise, sets: 3, rest: 45 };
  if (ex.equip === 'dumbbell') {
    item.reps = hooks.defaultReps() || 12;
    item.kg = hooks.dumbbellKg();
  }
  return item;
}

function sheetHead(title, back) {
  return `
    <div class="sheet-head">
      ${back ? '<button type="button" class="btn ghost" id="form-back">‹ Geri</button>' : ''}
      <h2>${esc(title)}</h2>
      <button class="icon-btn" value="cancel" aria-label="Kapat">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>`;
}

function openPicker() {
  picker().innerHTML = `
    <form method="dialog" class="sheet-inner">
      ${sheetHead('Hareket ekle')}
      <div class="chips pick-tabs" role="tablist">
        ${PICK_TABS.map((t) => `<button type="button" class="chip ${t.id === pickTab ? 'active' : ''}" role="tab" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="pick-body"></div>
    </form>`;

  const add = (item) => {
    draft.items.push(item);
    picker().close();
    renderEditor();
    $$('#ed-list .ed-row').at(-1)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const showTab = (tab) => {
    pickTab = tab;
    $$('[data-tab]', picker()).forEach((c) => c.classList.toggle('active', c.dataset.tab === tab));
    const body = $('#pick-body', picker());
    body.innerHTML = pickTabHTML(tab);
    $$('[data-group]', body).forEach((c) => c.addEventListener('click', () => {
      pickGroup = c.dataset.group;
      showTab(tab);
    }));
    $$('[data-bike]', body).forEach((b) => b.addEventListener('click', () => openForm({ type: 'bike', level: b.dataset.bike, dur: DEFAULT_DUR.bike }, true, add, openPicker)));
    $('[data-rest]', body)?.addEventListener('click', () => openForm({ type: 'rest', dur: DEFAULT_DUR.rest }, true, add, openPicker));
    // Tapping a move opens the quick form with sensible defaults.
    $$('[data-ex]', body).forEach((b) => b.addEventListener('click', () => openForm(defaultItem(b.dataset.ex), true, add, openPicker)));
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
  if (!picker().open) picker().showModal();
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// One small form per move: sets, reps or seconds, kg, rest between sets.
// `onSave(item)` gets the finished item; `back()` returns to the list (new moves only).
function openForm(source, isNew, onSave, back) {
  const f = clone(source);
  const isEx = f.type === 'exercise';
  const dumbbell = isEx && EXERCISES[f.exercise].equip === 'dumbbell';

  const stepper = (key, label, hint = '') => `
    <div class="form-row" data-row="${key}">
      <span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
      <div class="stepper-ctrl">
        <button type="button" data-step="${key}:-1" aria-label="${label} azalt">−</button>
        <input type="number" inputmode="decimal" data-field="${key}" aria-label="${label}">
        <button type="button" data-step="${key}:1" aria-label="${label} artır">+</button>
      </div>
    </div>`;

  const render = () => {
    const mode = f.reps ? 'reps' : 'time';
    picker().innerHTML = `
      <form method="dialog" class="sheet-inner move-form">
        ${sheetHead(itemName(f), isNew && !!back)}
        ${isEx ? visualHTML(f.exercise, 'full', esc(itemName(f))) : ''}
        ${isEx ? stepper('sets', 'Set sayısı') : ''}
        ${isEx ? `<div class="form-row"><span>Ölçü</span>
          <div class="ed-mode" role="group" aria-label="Ölçü">
            <button type="button" class="${mode === 'reps' ? 'active' : ''}" data-mode="reps">Tekrar</button>
            <button type="button" class="${mode === 'time' ? 'active' : ''}" data-mode="time">Süre</button>
          </div></div>` : ''}
        ${isEx && mode === 'reps' ? stepper('reps', 'Tekrar', 'her sette') : stepper('dur', 'Süre (sn)', isEx ? 'her sette' : '')}
        ${dumbbell ? stepper('kg', 'Ağırlık (kg)') : ''}
        ${isEx && f.sets > 1 ? stepper('rest', 'Setler arası dinlenme (sn)', '0 = dinlenme yok') : ''}
        <button type="submit" class="btn primary full" id="form-save">${isNew ? 'Ekle' : 'Kaydet'}</button>
      </form>`;
    $$('[data-field]', picker()).forEach((input) => {
      input.value = f[input.dataset.field] ?? 0;
      input.addEventListener('input', () => {
        f[input.dataset.field] = +input.value || 0;
        if (input.dataset.field === 'sets' && (f.sets > 1) !== (+source.sets > 1)) { /* rest row toggles on change */ }
      });
      input.addEventListener('change', () => { normalize(); render(); });
    });
    $$('[data-step]', picker()).forEach((b) => b.addEventListener('click', () => {
      const [key, dir] = b.dataset.step.split(':');
      const step = { sets: 1, reps: 1, kg: 2.5, rest: 15, dur: f.dur < 60 ? 5 : 15 }[key];
      f[key] = (f[key] || 0) + step * +dir;
      normalize();
      render();
    }));
    $$('[data-mode]', picker()).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.mode === 'reps') f.reps = f.reps || hooks.defaultReps() || 12;
      else delete f.reps;
      render();
    }));
    $('#form-back', picker())?.addEventListener('click', () => back());
    $('.move-form', picker()).addEventListener('submit', (e) => {
      e.preventDefault();
      normalize();
      picker().close();
      onSave(f);
    });
  };

  const normalize = () => {
    if (isEx) {
      f.sets = clamp(Math.round(f.sets || 1), 1, 12);
      f.rest = clamp(Math.round(f.rest || 0), 0, 300);
      if (f.reps) f.reps = clamp(Math.round(f.reps), 1, 100);
      if (dumbbell) f.kg = clamp(Math.round((f.kg || 0) * 2) / 2, 0, 100);
    }
    f.dur = clamp(Math.round(f.dur || DEFAULT_DUR[f.type] || 30), 5, 3600);
  };

  render();
  if (!picker().open) picker().showModal();
}

/* ---------- Wiring ---------- */

function commit() {
  draft.name = $('#ed-name').value.trim() || 'Planım';
  const plan = { id: draft.id, name: draft.name, sections: [{ name: '', repeat: 1, items: draft.items }] };
  upsertPlan(plan);
  return plan.id;
}

export function initPlans(h) {
  hooks = { ...hooks, ...h };
  $('#ed-name').addEventListener('input', () => renderSummary());
  $('#ed-cancel').addEventListener('click', () => {
    if (draft.items.length && !confirm('Değişiklikler kaydedilmeden çıkılsın mı?')) return;
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
