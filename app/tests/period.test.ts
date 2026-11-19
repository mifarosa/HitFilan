import { describe, expect, it } from 'vitest';
import { MEAL_SLOTS, periodRange, periodTotals, slotForHour, type Meal, type Settings } from '@/shared';

const settings = { weightKg: 80, heightCm: 180, age: 30, sex: 1, activity: 1.375, dailyKcal: 2000 } as unknown as Settings;
const meal = (date: string, kcal: number): Meal => ({ id: date, date, name: 'x', kcal });

describe('meal slots', () => {
  it('suggests a slot from the hour', () => {
    expect(slotForHour(8)).toBe('morning');
    expect(slotForHour(13)).toBe('noon');
    expect(slotForHour(16)).toBe('snack');
    expect(slotForHour(20)).toBe('evening');
    expect(slotForHour(2)).toBe('snack');
    expect(MEAL_SLOTS.map((s) => s.id)).toEqual(['morning', 'noon', 'evening', 'snack']);
  });
});

describe('periods', () => {
  const wed = new Date('2026-11-18T12:00:00').getTime();
  it('week starts on Monday, month covers the whole month', () => {
    expect(periodRange('week', wed)).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(periodRange('month', wed)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('day', wed)).toEqual({ from: '2026-11-18', to: '2026-11-18' });
  });

  it('adds eaten, burned and need per day, up to today only', () => {
    const t = periodTotals({
      meals: [meal('2026-11-16T09:00:00', 1800), meal('2026-11-17T09:00:00', 2300)],
      history: [{ date: '2026-11-17T18:00:00', kcal: 400, durationSec: 2400 }],
      settings, from: '2026-11-16', to: '2026-11-22', today: '2026-11-18',
    });
    expect(t.days.map((d) => d.day)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(t.eaten).toBe(4100);
    expect(t.target).toBe(6000);
    expect(t.logged).toBe(2);
    const burned = t.days[1].burned;
    expect(burned).toBeGreaterThan(0);
    expect(t.burned).toBe(burned);
    expect(t.balance).toBe(4100 - 6000 - burned);
    expect(t.days[2].logged).toBe(false);
  });
});
