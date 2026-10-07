// Turns program definitions into a flat list of timed steps for the runner.
import { EXERCISES, LEVELS, getProgram } from './data.js';

const PREP_SECONDS = 10;
export const DEFAULT_BIKE = 'bike40';

function bikeSteps(program) {
  return program.blocks.map((b) => ({
    label: b.label,
    level: b.level,
    tag: LEVELS[b.level].label,
    hint: LEVELS[b.level].hint,
    dur: b.dur,
  }));
}

// Rep-based sets have no timer: the user moves on when done. Their duration is
// only an estimate (about 3 s per rep) for totals and calorie numbers.
export const SECONDS_PER_REP = 3;

function repStep(id, reps, tag) {
  const ex = EXERCISES[id];
  return {
    label: ex.name,
    level: 'work',
    tag,
    hint: ex.how,
    exercise: id,
    reps,
    open: true,
    dur: reps * SECONDS_PER_REP,
  };
}

function circuitSteps(program, opts = {}) {
  const work = opts.work ?? program.work;
  const rest = opts.rest ?? program.rest;
  const rounds = opts.rounds ?? program.rounds;
  const steps = [];
  const list = program.exercises;

  // Weight moves can be counted in reps instead of seconds (opts.weightReps).
  const weightReps = opts.weightReps || 0;
  for (let r = 1; r <= rounds; r++) {
    list.forEach((id, i) => {
      const ex = EXERCISES[id];
      const tag = rounds > 1 ? `Tur ${r}/${rounds} · ${i + 1}/${list.length}` : `${i + 1}/${list.length}`;
      if (weightReps && ex.equip === 'dumbbell') {
        steps.push(repStep(id, weightReps, tag));
      } else {
        steps.push({
          label: ex.name,
          level: 'work',
          tag,
          hint: ex.how,
          exercise: id,
          dur: work,
        });
      }
      const isLastInRound = i === list.length - 1;
      const isLastOverall = isLastInRound && r === rounds;
      if (isLastOverall) return;
      if (isLastInRound && program.roundRest > 0) {
        steps.push({
          label: 'Tur arası',
          level: 'rest',
          tag: `Tur ${r} bitti`,
          hint: 'Su iç, nefesini topla.',
          dur: program.roundRest,
        });
      } else if (rest > 0) {
        steps.push({
          label: 'Dinlen',
          level: 'rest',
          tag: 'Dinlen',
          hint: LEVELS.rest.hint,
          dur: rest,
        });
      }
    });
  }
  return steps;
}

function prepStep(label, hint, dur = PREP_SECONDS) {
  return { label, level: 'prep', tag: 'Hazırlan', hint, dur };
}

// Returns the step list for a program id. `opts` can override circuit timing.
// Default names for bike levels inside user plans.
const BIKE_NAMES = { easy: 'Boşta pedal', moderate: 'Orta tempo', hard: 'Ağır tempo' };

function planItemStep(item, section) {
  const single = section.items.length === 1 && section.name;
  if (item.type === 'bike') {
    return {
      label: item.name || (single ? section.name : BIKE_NAMES[item.level]),
      level: item.level,
      tag: LEVELS[item.level].label,
      hint: LEVELS[item.level].hint,
      dur: item.dur,
    };
  }
  if (item.type === 'exercise') {
    if (item.reps) return repStep(item.exercise, item.reps, `${item.reps} tekrar`);
    const ex = EXERCISES[item.exercise];
    return { label: ex.name, level: 'work', tag: 'Çalış', hint: ex.how, exercise: item.exercise, dur: item.dur };
  }
  if (item.type === 'rest') {
    return { label: item.name || 'Dinlen', level: 'rest', tag: 'Dinlen', hint: LEVELS.rest.hint, dur: item.dur };
  }
  // Free-form step the user typed in
  const rest = item.level === 'rest';
  return { label: item.name, level: rest ? 'rest' : 'work', tag: rest ? 'Dinlen' : 'Çalış', hint: '', dur: item.dur };
}

// Expands a user plan: each section's steps repeat `repeat` times (rounds).
function planSteps(plan) {
  const steps = [];
  for (const section of plan.sections) {
    const n = Math.max(1, section.repeat || 1);
    for (let r = 1; r <= n; r++) {
      for (const item of section.items) {
        const s = planItemStep(item, section);
        if (n > 1) s.tag = `${section.name || 'Tur'} ${r}/${n} · ${s.tag}`;
        else if (section.name && s.label !== section.name) s.tag = `${section.name} · ${s.tag}`;
        steps.push(s);
      }
    }
  }
  // A workout never ends on a rest.
  while (steps.length > 1 && steps[steps.length - 1].level === 'rest') steps.pop();
  return steps;
}

// Steps for a user plan object (also used for the editor's live preview).
export function buildPlanSteps(plan) {
  const bike = plan.sections.some((s) => s.items.some((i) => i.type === 'bike'));
  return [prepStep('Hazırlan', bike ? 'Müziğini aç, suyunu yanına al.' : 'Matını hazırla.'), ...planSteps(plan)];
}

export function buildSteps(programId, opts = {}) {
  const program = getProgram(programId);
  if (program.kind === 'custom') return buildPlanSteps(program);
  if (program.kind === 'bike') {
    return [prepStep('Bisiklete geç', 'Müziğini aç, suyunu yanına al.'), ...bikeSteps(program)];
  }
  if (program.kind === 'circuit') {
    return [prepStep('Hazırlan', 'Matını ve dumbbell’ını hazırla.'), ...circuitSteps(program, opts)];
  }
  // combo: concatenate parts with a transition step in between
  const steps = [];
  program.parts.forEach((partId, i) => {
    const part = getProgram(partId === 'bike' ? (opts.bikeId || DEFAULT_BIKE) : partId);
    if (i === 0) steps.push(prepStep('Hazırlan', 'Müziğini aç, suyunu yanına al.'));
    else steps.push(prepStep('Geçiş', `Sıradaki: ${part.name}. Matını hazırla.`, 60));
    steps.push(...(part.kind === 'bike' ? bikeSteps(part) : circuitSteps(part, opts)));
  });
  return steps;
}

// Name and description as shown to the user; combos depend on the chosen bike flow.
export function programInfo(programId, opts = {}) {
  const program = getProgram(programId);
  if (program.kind !== 'combo') return { name: program.name, desc: program.desc };
  const bike = getProgram(opts.bikeId || DEFAULT_BIKE);
  return {
    name: `${bike.minutes} dk ${program.name}`,
    desc: `${bike.minutes} dk bisiklet akışı, ardından 8 dk core bitirici.`,
  };
}

export function totalSeconds(steps) {
  return steps.reduce((sum, s) => sum + s.dur, 0);
}

// Rough calorie estimate: kcal = MET * body weight (kg) * hours.
export function estimateKcal(steps, weightKg, doneSeconds = Infinity) {
  let remaining = doneSeconds;
  let kcal = 0;
  for (const s of steps) {
    if (remaining <= 0) break;
    const secs = Math.min(s.dur, remaining);
    kcal += LEVELS[s.level].met * weightKg * (secs / 3600);
    remaining -= secs;
  }
  return Math.round(kcal);
}

export function formatTime(totalSec) {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
