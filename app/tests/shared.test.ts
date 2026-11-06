import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXERCISES, PROGRAMS, SequenceTimer, addHistory, buildSteps, estimateKcal, formatTime, historyEntry, loadHistory,
  loadSettings, parseYouTube, saveSettings, totalSeconds,
} from '@/shared';

describe('programs and steps (shared with the web app)', () => {
  it('has the whole catalog', () => {
    expect(Object.keys(EXERCISES)).toHaveLength(43);
    expect(PROGRAMS.map((p) => p.id)).toContain('db_burn');
  });

  it('builds the 40 minute bike flow: prep + 24 blocks, 2410 s', () => {
    const steps = buildSteps('bike40');
    expect(steps).toHaveLength(25);
    expect(steps[0].level).toBe('prep');
    expect(totalSeconds(steps)).toBe(10 + 40 * 60);
  });

  it('builds the dumbbell circuit: 3 rounds of 8 moves with rests', () => {
    const steps = buildSteps('db_burn');
    expect(steps).toHaveLength(48);
    expect(totalSeconds(steps)).toBe(1510);
    expect(steps.at(-1)?.level).toBe('work'); // never ends on a rest
  });

  it('chains the combo: bike flow, a transition, then the core circuit', () => {
    const steps = buildSteps('combo', { bikeId: 'bike60' });
    expect(steps.filter((s) => s.label === 'Geçiş')).toHaveLength(1);
    expect(totalSeconds(steps)).toBeGreaterThan(60 * 60);
  });

  it('estimates calories from MET, weight and time', () => {
    const steps = buildSteps('bike40');
    const full = estimateKcal(steps, 75);
    expect(full).toBeGreaterThan(200);
    expect(estimateKcal(steps, 75, 600)).toBeLessThan(full);
  });

  it('formats time like the web app', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(249.2)).toBe('4:10');
    expect(formatTime(2340)).toBe('39:00');
  });
});

describe('storage adapter', () => {
  beforeEach(() => { vi.resetModules(); });

  it('saves settings and history through the phone storage', () => {
    saveSettings({ ...loadSettings(), weightKg: 82, beeps: false });
    expect(loadSettings().weightKg).toBe(82);
    expect(loadSettings().beeps).toBe(false);
    const entry = historyEntry('bike40', '40 dk Bisiklet Akışı', new Date().toISOString(), buildSteps('bike40'), 1200, true, 82);
    addHistory(entry);
    expect(loadHistory().at(-1)?.id ?? loadHistory()[0]?.id).toBeTruthy();
    expect(loadHistory().some((h) => h.programId === 'bike40')).toBe(true);
  });
});

describe('SequenceTimer (shared)', () => {
  it('catches up on step boundaries after a long pause in ticks', () => {
    vi.useFakeTimers();
    const steps = buildSteps('bike40');
    const seen: number[] = [];
    const t = new SequenceTimer(steps, { onStep: (_s, i) => { seen.push(i); } });
    t.start();
    vi.setSystemTime(Date.now() + 12 * 60 * 1000); // the app was frozen for 12 minutes
    vi.advanceTimersByTime(250);
    // 10 s prep + 5 + 5 min = 610 s, so 110 s into the intervals: the 2nd interval step (index 4)
    expect(t.index).toBe(4);
    expect(seen.at(-1)).toBe(t.index);
    t.stop();
    vi.useRealTimers();
  });
});

describe('YouTube links (shared)', () => {
  it('parses videos and playlists, rejects the rest', () => {
    expect(parseYouTube('https://youtu.be/dQw4w9WgXcQ')).toEqual({ kind: 'video', id: 'dQw4w9WgXcQ' });
    expect(parseYouTube('https://www.youtube.com/playlist?list=PLabcdefghij12')?.kind).toBe('playlist');
    expect(parseYouTube('merhaba')).toBeNull();
  });
});
