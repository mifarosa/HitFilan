// Walks added by hand ("I walked 45 min, 4 km today"): the calorie estimate and the history entry.
// A walk is stored as an ordinary history entry (programId 'walk'), so the calendar, the streak, the weekly goal and
// the daily calorie balance count it like any other workout. Pure code, shared by the web app and the Expo app.

export const WALK_ID = 'walk';
export const DEFAULT_SPEED = 5; // km/h, used to estimate the missing one of time and distance

const MAX_MIN = 600;
const MAX_KM = 100;

// Walking MET by speed (km/h), rough values after the Compendium of Physical Activities; linear in between.
const MET_BY_SPEED = [[2, 2.0], [3.2, 2.8], [4.8, 3.5], [5.6, 4.3], [6.4, 5.0], [8, 8.3]];

export function walkMet(speedKmh) {
  const t = MET_BY_SPEED;
  if (speedKmh <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (speedKmh <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return y0 + ((y1 - y0) * (speedKmh - x0)) / (x1 - x0);
    }
  }
  return t[t.length - 1][1];
}

const round1 = (n) => Math.round(n * 10) / 10;
const toNum = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// minutes / km as typed (either may be empty). Returns { ok, error?, minutes, km, estimated, speed, kcal }.
// `estimated` is true when one of the two was worked out from the other at DEFAULT_SPEED.
export function walkDetails({ minutes, km, weightKg }) {
  let min = toNum(minutes);
  let dist = toNum(km);
  if (!(min > 0) && !(dist > 0)) return { ok: false, error: 'Süre veya mesafeden en az birini gir.' };
  let estimated = false;
  if (!(min > 0)) { min = Math.round((dist / DEFAULT_SPEED) * 60); estimated = true; }
  if (!(dist > 0)) { dist = round1((min / 60) * DEFAULT_SPEED); estimated = true; }
  if (min < 1 || min > MAX_MIN) return { ok: false, error: `Süre 1–${MAX_MIN} dakika arasında olmalı.` };
  if (dist < 0.1 || dist > MAX_KM) return { ok: false, error: `Mesafe 0,1–${MAX_KM} km arasında olmalı.` };
  const speed = dist / (min / 60);
  if (speed > 9) return { ok: false, error: 'Bu hız yürüyüş için fazla yüksek. Süre ve mesafeyi kontrol et.' };
  const kcal = Math.round(walkMet(speed) * (weightKg > 0 ? weightKg : 70) * (min / 60));
  return { ok: true, minutes: Math.round(min), km: round1(dist), estimated, speed: round1(speed), kcal };
}

// The history entry for a walk. `date` is the start of the walk (ISO string).
export function walkEntry({ date, minutes, km, weightKg, now = Date.now() }) {
  const d = walkDetails({ minutes, km, weightKg });
  if (!d.ok) return null;
  const when = new Date(date);
  if (Number.isNaN(when.getTime())) return null;
  return {
    id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    programId: WALK_ID,
    name: 'Yürüyüş',
    date: when.toISOString(),
    durationSec: d.minutes * 60,
    kcal: d.kcal,
    completed: true,
    km: d.km,
    estimated: d.estimated,
  };
}

export const isWalk = (entry) => entry?.programId === WALK_ID;

// "4,2 km" with a "~" in front when the number was estimated.
export function walkDistanceText(entry) {
  if (!(entry?.km > 0)) return '';
  return `${entry.estimated ? '~' : ''}${String(entry.km).replace('.', ',')} km`;
}
