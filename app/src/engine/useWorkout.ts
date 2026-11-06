// One running workout: builds the steps, runs the shared SequenceTimer, plays cues, keeps the screen on,
// schedules the lock-screen notifications and saves the history entry.
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SequenceTimer, addHistory, buildSteps, estimateKcal, historyEntry, loadSettings, programInfo, totalSeconds,
  type Settings, type Step, type TimerLike,
} from '@/shared';
import { countdownCue, inWarning, stepCue } from './cueLogic';
import { planCues } from './cuePlan';
import { initAudio, play, stopSpeech } from './cues';
import { cancelCues, scheduleCues, setupNotifications } from './notifications';

export interface WorkoutView {
  name: string;
  step: Step;
  next?: Step;
  index: number;
  count: number;
  remaining: number; // seconds left in the step (0 for a rep step)
  progress: number; // 0..1 of the step
  elapsed: number; // seconds of the whole workout
  total: number;
  kcal: number;
  running: boolean;
  finished: boolean;
  warn: boolean;
}

export function useWorkout(programId: string, bikeId: string) {
  const [view, setView] = useState<WorkoutView | null>(null);
  const [muted, setMuted] = useState(false);
  const timer = useRef<TimerLike | null>(null);
  const settings = useRef<Settings>(loadSettings());
  const mutedRef = useRef(false);
  const saved = useRef(false);
  const startedAt = useRef(new Date().toISOString());
  const info = useRef({ name: '' });

  const snapshot = useCallback((t: TimerLike): WorkoutView => {
    const s = settings.current;
    const step = t.current;
    const next = t.steps[t.index + 1];
    const remaining = step.open ? 0 : t.stepRemaining();
    const elapsed = t.totalElapsed();
    return {
      name: info.current.name,
      step,
      next,
      index: t.index,
      count: t.steps.length,
      remaining,
      progress: step.open || !step.dur ? 0 : Math.min(1, Math.max(0, 1 - remaining / step.dur)),
      elapsed,
      total: totalSeconds(t.steps),
      kcal: estimateKcal(t.steps, s.weightKg, elapsed),
      running: t.running,
      finished: t.finished,
      warn: t.running && inWarning(Math.ceil(remaining), step, next, s),
    };
  }, []);

  // Plans the lock-screen cues again from where the timer is now (after start, pause, skip).
  const reschedule = useCallback((t: TimerLike) => {
    if (!t.running || t.finished) { cancelCues(); return; }
    scheduleCues(planCues(t.steps, t.index, t.stepElapsed(), Date.now(), settings.current));
  }, []);

  const save = useCallback((completed: boolean) => {
    const t = timer.current;
    if (!t || saved.current) return;
    const elapsed = t.totalElapsed();
    if (elapsed < 60) return; // ignore accidental starts
    saved.current = true;
    addHistory(historyEntry(programId, info.current.name, startedAt.current, t.steps, elapsed, completed, settings.current.weightKg));
  }, [programId]);

  useEffect(() => {
    settings.current = loadSettings();
    const s = settings.current;
    const steps = buildSteps(programId, { bikeId });
    info.current = { name: programInfo(programId, { bikeId }).name };
    let prev: Step | null = null;
    initAudio();
    setupNotifications();
    if (s.keepAwake !== false) activateKeepAwakeAsync('workout').catch(() => {});

    const t = new SequenceTimer(steps, {
      onStep(step, index, stepInfo) {
        if (stepInfo.fresh) play(stepCue(step, stepInfo.manual ? null : prev, steps[index + 1], s), mutedRef.current);
        prev = step;
      },
      onCue(secLeft, step, next) {
        play(countdownCue(secLeft, step, next, s), mutedRef.current);
      },
      onTick(timerNow) {
        setView(snapshot(timerNow));
      },
      onFinish(timerNow) {
        setView(snapshot(timerNow));
        play({ beep: 'finish', vibrate: [300, 100, 300, 100, 500], speech: 'Antrenman tamamlandı. Harika iş!' }, mutedRef.current);
        save(true);
        cancelCues();
        deactivateKeepAwake('workout');
      },
    });
    timer.current = t;
    t.start();
    reschedule(t);
    setView(snapshot(t));

    return () => {
      save(false);
      t.stop();
      stopSpeech();
      cancelCues();
      deactivateKeepAwake('workout');
    };
  }, [programId, bikeId, snapshot, reschedule, save]);

  const act = useCallback((fn: (t: TimerLike) => void) => {
    const t = timer.current;
    if (!t) return;
    fn(t);
    setView(snapshot(t));
    reschedule(t);
  }, [snapshot, reschedule]);

  return {
    view,
    muted,
    toggle: () => act((t) => {
      // On a rep step the big button means "done": go to the next step.
      if (t.current.open && t.running) t.next();
      else t.toggle();
    }),
    next: () => act((t) => t.next()),
    prev: () => act((t) => t.prev()),
    toggleMute: () => {
      mutedRef.current = !mutedRef.current;
      setMuted(mutedRef.current);
      if (mutedRef.current) stopSpeech();
    },
  };
}
