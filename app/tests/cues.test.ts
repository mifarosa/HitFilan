import { describe, expect, it } from 'vitest';
import { countdownCue, inWarning, nextPhrase, stepCue } from '@/engine/cueLogic';
import { MAX_CUES, planCues } from '@/engine/cuePlan';
import { DEFAULT_SETTINGS, buildSteps, type Settings, type Step } from '@/shared';

const settings: Settings = { ...DEFAULT_SETTINGS, beeps: true, voice: true, vibrate: true, warnSeconds: 10 };
const step = (over: Partial<Step>): Step => ({ label: 'X', level: 'work', tag: 't', hint: '', dur: 60, ...over });

describe('cues', () => {
  it('beeps up when effort rises and down when it falls', () => {
    const easy = step({ level: 'easy' });
    const hard = step({ level: 'hard', label: 'Aralık' });
    expect(stepCue(hard, easy, undefined, settings).beep).toBe('up');
    expect(stepCue(easy, hard, undefined, settings).beep).toBe('down');
    expect(stepCue(hard, null, undefined, settings).beep).toBeUndefined(); // manual jump: silent
  });

  it('announces resistance for hard bike steps and the next move on rests', () => {
    expect(stepCue(step({ level: 'hard' }), null, undefined, settings).speech).toBe(`Ağır tempo! Direnç ${settings.resHard}.`);
    expect(stepCue(step({ level: 'rest' }), null, step({ label: 'Squat' }), settings).speech).toBe('Dinlen. Sıradaki: Squat');
    expect(stepCue(step({ open: true, reps: 12, label: 'Press' }), null, undefined, settings).speech).toBe('Press. 12 tekrar. Bitince dokun.');
  });

  it('warns 10 s before a change and counts the last seconds', () => {
    const cur = step({ level: 'moderate', dur: 60 });
    const next = step({ level: 'hard' });
    expect(countdownCue(10, cur, next, settings).beep).toBe('warn');
    expect(countdownCue(10, cur, next, settings).speech).toBe('10 saniye sonra ağır tempo.');
    expect(countdownCue(7, cur, next, settings).beep).toBe('tick');
    expect(countdownCue(3, cur, next, settings).beep).toBe('count');
    expect(countdownCue(30, cur, next, settings)).toEqual({});
    expect(countdownCue(5, cur, undefined, settings)).toEqual({}); // last step: no heads-up
    expect(inWarning(8, cur, next, settings)).toBe(true);
    expect(inWarning(11, cur, next, settings)).toBe(false);
  });

  it('says the next phrase for each level', () => {
    expect(nextPhrase(step({ level: 'easy' }))).toBe('boşta pedal');
    expect(nextPhrase(step({ level: 'work', label: 'Plank' }))).toBe('Plank');
  });
});

describe('lock-screen cue plan', () => {
  it('plans a heads-up, the change and the finish for the 40 minute flow', () => {
    const steps = buildSteps('bike40');
    const plan = planCues(steps, 0, 0, 1_000_000, settings);
    expect(plan.length).toBeLessThanOrEqual(MAX_CUES);
    expect(plan[0].at).toBeLessThan(plan[1].at); // sorted
    expect(plan.some((c) => c.sound === 'warn')).toBe(true);
    expect(plan.some((c) => c.sound === 'up')).toBe(true);
    // the first change comes when the 10 s prep step ends (no heads-up: the step is not longer than 10 s)
    expect(plan[0].at).toBe(1_000_000 + 10_000);
  });

  it('resumes from the middle of a step', () => {
    const steps = buildSteps('bike40');
    const plan = planCues(steps, 1, 100_000, 5_000_000, settings); // 100 s into the 300 s warm-up
    expect(plan.find((c) => c.sound !== 'warn')?.at).toBe(5_000_000 + 200_000);
  });

  it('stops planning after a rep step (its end is unknown)', () => {
    const steps: Step[] = [step({ dur: 30 }), step({ dur: 36, open: true, reps: 12 }), step({ dur: 30 })];
    const plan = planCues(steps, 0, 0, 0, settings);
    expect(plan.map((c) => c.sound)).toEqual(['warn', 'down']); // heads-up + the change into the rep step, nothing after it
    expect(plan.at(-1)?.at).toBe(30_000);
  });

  it('adds the finish cue at the end', () => {
    const steps = [step({ dur: 20 }), step({ dur: 20 })];
    const plan = planCues(steps, 0, 0, 0, settings);
    expect(plan.at(-1)).toMatchObject({ sound: 'finish', at: 40_000 });
  });
});
