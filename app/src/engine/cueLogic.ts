// Which cue plays when (port of the web app's announce / onCue in js/app.js). Pure, so it can be tested.
import { EXERCISES, type Settings, type Step } from '@/shared';

const RANK: Record<Step['level'], number> = { prep: 0, easy: 1, rest: 1, moderate: 2, work: 3, hard: 3 };
export const rank = (level: Step['level']) => RANK[level];

export type Beep = 'tick' | 'count' | 'warn' | 'up' | 'down' | 'finish';

/** Short spoken name for what comes next. */
export function nextPhrase(next: Step): string {
  return { hard: 'ağır tempo', moderate: 'orta tempo', easy: 'boşta pedal', rest: 'dinlenme' }[next.level as string] ?? next.label;
}

function resistance(level: Step['level'], s: Settings): number | null {
  if (level === 'easy') return s.resEasy;
  if (level === 'moderate') return s.resModerate;
  if (level === 'hard') return s.resHard;
  return null;
}

export interface Cue {
  beep?: Beep;
  speech?: string;
  vibrate?: number[];
}

/** A new step started. `prev` is null after a manual jump (no rising/falling beep). */
export function stepCue(step: Step, prev: Step | null, next: Step | undefined, s: Settings): Cue {
  const cue: Cue = {};
  if (s.beeps && prev) cue.beep = rank(step.level) > rank(prev.level) ? 'up' : 'down';
  if (s.vibrate) cue.vibrate = rank(step.level) >= 3 ? [250, 100, 250] : [200];
  if (s.voice) {
    const res = resistance(step.level, s);
    let text = step.label;
    if (step.level === 'hard') text = `Ağır tempo! Direnç ${res}.`;
    else if (step.level === 'moderate' && prev?.level === 'hard') text = `Orta tempo. Direnç ${res}.`;
    else if (step.level === 'rest') text = next ? `Dinlen. Sıradaki: ${next.label}` : 'Dinlen.';
    else if (step.open) text = `${step.label}. ${step.reps} tekrar. Bitince dokun.`;
    else if (step.level === 'work') text = `${step.label}. ${step.dur} saniye.`;
    else if (step.dur >= 120) text = `${step.label}. ${Math.round(step.dur / 60)} dakika.`;
    cue.speech = text;
  }
  return cue;
}

/** One countdown second of a timed step. */
export function countdownCue(secLeft: number, step: Step, next: Step | undefined, s: Settings): Cue {
  const cue: Cue = {};
  const warnable = !!next && !step.open && step.dur > s.warnSeconds;
  const warnStart = warnable && secLeft === s.warnSeconds;
  const inWarn = warnable && secLeft <= s.warnSeconds && secLeft >= 1;
  if (warnStart && s.vibrate) cue.vibrate = [100, 60, 100, 60, 100];
  if (warnStart) {
    if (s.beeps) cue.beep = 'warn';
    if (s.voice && next) cue.speech = `${secLeft} saniye sonra ${nextPhrase(next)}.`;
  } else if (inWarn && s.beeps) {
    cue.beep = secLeft <= 3 ? 'count' : 'tick';
  }
  if (step.dur >= 180 && secLeft === 60) {
    if (s.beeps) cue.beep = 'tick';
    if (s.voice) cue.speech = 'Son bir dakika.';
  }
  const ex = step.exercise ? EXERCISES[step.exercise] : undefined;
  if (ex?.sides && secLeft === Math.floor(step.dur / 2)) {
    if (s.beeps) cue.beep = 'down';
    if (s.voice) cue.speech = 'Taraf değiştir.';
    if (s.vibrate) cue.vibrate = [120, 60, 120];
  }
  return cue;
}

/** Whether the countdown is in its heads-up window (the time pulses). */
export function inWarning(remaining: number, step: Step, next: Step | undefined, s: Settings): boolean {
  return !!next && !step.open && step.dur > s.warnSeconds && remaining <= s.warnSeconds && remaining > 0;
}
