import { beforeEach, describe, expect, it } from 'vitest';
import { cancelCues, scheduleCues } from '@/engine/notifications';
import type { PlannedCue } from '@/engine/cuePlan';
import { state } from './stubNotifications';

const cues = (n: number): PlannedCue[] =>
  Array.from({ length: n }, (_, i) => ({ at: 1_000_000 + i * 1000, title: `t${i}`, body: 'b', sound: 'up' as const }));

describe('lock-screen notifications', () => {
  beforeEach(() => { state.scheduled.clear(); });

  it('leaves nothing behind when the workout is closed while cues are still being scheduled', async () => {
    const scheduling = scheduleCues(cues(30));
    await cancelCues(); // the user closes the workout right away
    await scheduling;
    expect(state.scheduled.size).toBe(0);
  });

  it('keeps only the newest plan when it is scheduled again (pause, skip, resume)', async () => {
    const first = scheduleCues(cues(30));
    const second = scheduleCues(cues(3));
    await Promise.all([first, second]);
    expect(state.scheduled.size).toBe(3);
  });

  it('clears what an earlier session left behind', async () => {
    state.scheduled.add('left-over');
    await cancelCues();
    expect(state.scheduled.size).toBe(0);
  });
});
