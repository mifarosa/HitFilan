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

/* ---------- Meal times and periods ---------- */

export const MEAL_SLOTS = [
  { id: 'morning', label: 'Sabah' },
  { id: 'noon', label: 'Öğle' },
  { id: 'evening', label: 'Akşam' },
  { id: 'snack', label: 'Ara' },
];

export const slotLabel = (id) => MEAL_SLOTS.find((s) => s.id === id)?.label ?? '';

// The slot to preselect for a clock hour; the user can change it.
export function slotForHour(hour) {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'noon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'snack';
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// [from, to] local days (inclusive) of the week (Monday first) or month that contains `now`.
export function periodRange(kind, now = Date.now()) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  if (kind === 'month') {
    return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
  }
  if (kind === 'week') {
    const start = new Date(d);
    start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end) };
  }
  return { from: ymd(d), to: ymd(d) };
}

// Per-day rows and totals for a day range. Days after `today` are left out so a half-finished week or month does
// not count the future as "no food eaten". Days with nothing logged still count their target (they are in the
// range, up to today); `logged` tells how many days have any meal, so averages can be honest.
export function periodTotals({ meals, history, settings, from, to, today = ymd(new Date()) }) {
  const days = [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd, 12);
  for (let guard = 0; guard < 400; guard++) {
    const day = ymd(cur);
    if (day > to || day > today) break;
    days.push({ day, ...dayBalance({ meals, history, day, settings }), logged: meals.some((m) => dayOf(m.date) === day) });
    cur.setDate(cur.getDate() + 1);
  }
  const sum = (k) => days.reduce((s, r) => s + r[k], 0);
  const logged = days.filter((r) => r.logged).length;
  return { days, eaten: sum('eaten'), burned: sum('burned'), target: sum('target'), balance: sum('balance'), logged };
}
