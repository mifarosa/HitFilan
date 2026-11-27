import { beforeEach, describe, expect, it } from 'vitest';
import { addHistory, dayBalance, dayOf, isWalk, loadHistory, loadMeals, loadSettings, walkDetails, walkDistanceText, walkEntry } from '@/shared';

describe('walk estimate', () => {
  it('uses both numbers when both are given', () => {
    const d = walkDetails({ minutes: '45', km: '4', weightKg: 80 });
    expect(d).toMatchObject({ ok: true, minutes: 45, km: 4, estimated: false });
    expect(d.kcal).toBeGreaterThan(200);
    expect(d.kcal).toBeLessThan(300);
  });

  it('estimates the missing one at 5 km/h and marks it', () => {
    expect(walkDetails({ minutes: '', km: '5', weightKg: 70 })).toMatchObject({ ok: true, minutes: 60, km: 5, estimated: true });
    expect(walkDetails({ minutes: '30', km: '', weightKg: 70 })).toMatchObject({ ok: true, minutes: 30, km: 2.5, estimated: true });
    expect(walkDetails({ minutes: '40', km: '3,5', weightKg: 70 }).km).toBe(3.5); // comma decimal
  });

  it('rejects empty, absurd and too-fast input', () => {
    expect(walkDetails({ minutes: '', km: '', weightKg: 70 }).ok).toBe(false);
    expect(walkDetails({ minutes: '900', km: '', weightKg: 70 }).ok).toBe(false);
    expect(walkDetails({ minutes: '10', km: '5', weightKg: 70 }).ok).toBe(false); // 30 km/h
    expect(walkDetails({ minutes: '0', km: '0', weightKg: 70 }).ok).toBe(false);
  });

  it('falls back to 70 kg without a weight, and faster walking burns more per hour', () => {
    const slow = walkDetails({ minutes: '60', km: '3', weightKg: 0 }).kcal;
    const fast = walkDetails({ minutes: '60', km: '6.4', weightKg: 0 }).kcal;
    expect(slow).toBeGreaterThan(150);
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('walk as a workout', () => {
  beforeEach(() => { /* shared in-memory storage persists inside the file; assertions are relative */ });

  it('is a normal history entry that counts for that day\'s balance', () => {
    const date = '2026-11-20T18:30:00';
    const e = walkEntry({ date, minutes: 50, km: 4.5, weightKg: 80 })!;
    expect(e).toMatchObject({ programId: 'walk', name: 'Yürüyüş', completed: true, durationSec: 3000, km: 4.5, estimated: false });
    expect(isWalk(e)).toBe(true);
    expect(walkDistanceText(e)).toBe('4,5 km');
    expect(walkDistanceText({ ...e, estimated: true })).toBe('~4,5 km');
    addHistory(e);
    expect(loadHistory().some((h) => h.id === e.id)).toBe(true);
    const b = dayBalance({ meals: loadMeals(), history: loadHistory(), day: dayOf(new Date(date).toISOString()), settings: loadSettings() });
    expect(b.burned).toBeGreaterThan(100); // net of resting use, not zero
  });

  it('refuses a bad date or bad numbers', () => {
    expect(walkEntry({ date: 'nope', minutes: 30, km: 2, weightKg: 70 })).toBeNull();
    expect(walkEntry({ date: '2026-11-20T10:00:00', minutes: '', km: '', weightKg: 70 })).toBeNull();
  });
});
