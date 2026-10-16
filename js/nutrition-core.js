// Pure calorie-balance rules (no DOM, no storage), kept separate so they can be tested.
//
// Balance for a day = eaten - (daily target + net workout burn).
// Positive = surplus, negative = deficit.

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: 'Çok az hareketli (masa başı)' },
  { value: 1.375, label: 'Hafif (haftada 1-3 antrenman)' },
  { value: 1.55, label: 'Orta (haftada 3-5 antrenman)' },
  { value: 1.725, label: 'Çok hareketli (neredeyse her gün)' },
];

// Never suggest burning more than this in one go; it is not a punishment for eating.
export const MAX_SUGGEST_KCAL = 600;
// Below this surplus there is nothing worth suggesting.
export const MIN_SUGGEST_KCAL = 50;

// Local calendar day (YYYY-MM-DD) of an ISO date string.
export function dayOf(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function hasProfile(s) {
  return s.heightCm > 0 && s.age > 0 && (s.sex === 1 || s.sex === 2) && s.weightKg > 0;
}

// Mifflin-St Jeor resting energy use, kcal/day.
export function bmr(s) {
  return 10 * s.weightKg + 6.25 * s.heightCm - 5 * s.age + (s.sex === 1 ? 5 : -161);
}

// Daily calorie target: the manual number if set, else estimated from the profile; 0 = unknown.
export function dailyTarget(s) {
  if (s.dailyKcal > 0) return Math.round(s.dailyKcal);
  if (!hasProfile(s)) return 0;
  return Math.round(bmr(s) * (s.activity || 1.375));
}

// Workout burn above resting level: the app's kcal is gross (MET x kg x h), and
// resting use (1 MET) is already inside the daily target.
export function netBurn(kcal, durationSec, weightKg) {
  return Math.max(0, Math.round(kcal - (weightKg * durationSec) / 3600));
}

export function dayBalance({ meals, history, day, settings }) {
  const target = dailyTarget(settings);
  const eaten = meals.filter((m) => dayOf(m.date) === day).reduce((sum, m) => sum + (m.kcal || 0), 0);
  const burned = history
    .filter((h) => dayOf(h.date) === day)
    .reduce((sum, h) => sum + netBurn(h.kcal || 0, h.durationSec || 0, settings.weightKg), 0);
  return { eaten, burned, target, balance: eaten - target - burned };
}

// candidates: [{ id, name, kind, secs, kcal }] with kcal = net burn of the program.
// Returns up to two suggestions: the shortest bike ride and the shortest strength
// circuit that cover `surplus`; if none covers it, the biggest one (partial: true).
export function suggest(surplus, candidates) {
  if (surplus < MIN_SUGGEST_KCAL) return [];
  const need = Math.min(surplus, MAX_SUGGEST_KCAL);
  const pick = (list) => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a.kcal - b.kcal);
    const cover = sorted.find((c) => c.kcal >= need);
    return cover ? { ...cover, partial: false } : { ...sorted[sorted.length - 1], partial: true };
  };
  return [
    pick(candidates.filter((c) => c.kind === 'bike')),
    pick(candidates.filter((c) => c.kind !== 'bike')),
  ].filter(Boolean);
}
