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

function circuitSteps(program, opts = {}) {
  const work = opts.work ?? program.work;
  const rest = opts.rest ?? program.rest;
  const rounds = opts.rounds ?? program.rounds;
  const steps = [];
  const list = program.exercises;

  for (let r = 1; r <= rounds; r++) {
    list.forEach((id, i) => {
      const ex = EXERCISES[id];
      steps.push({
        label: ex.name,
        level: 'work',
        tag: rounds > 1 ? `Tur ${r}/${rounds} · ${i + 1}/${list.length}` : `${i + 1}/${list.length}`,
        hint: ex.how,
        exercise: id,
        dur: work,
      });
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
export function buildSteps(programId, opts = {}) {
  const program = getProgram(programId);
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
