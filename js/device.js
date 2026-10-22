// Per-device tweaks. The device is detected once; its profile sets CSS variables on <html>.
// To support another phone, add a profile below (first match wins).
//   match:   test on the CSS screen size (portrait w x h) and the user agent
//   ytShift: px the YouTube picture is moved sideways in landscape (negative = left)
const PROFILES = [
  { id: 'iphone-notch', match: (w, h, ua) => /iPhone/.test(ua) && h >= 812, ytShift: 0 },
  // { id: 'pixel-8', match: (w, h, ua) => /Pixel 8/.test(ua), ytShift: 0 },
];
const FALLBACK = { id: 'generic', ytShift: 0 };
const KEY = 'hitfilan.ytshift';

// A ?ytshift=-47 link stores a manual override on this phone (?ytshift=reset clears it), so a value can be tried without a new release.
function manualShift() {
  try {
    const q = new URLSearchParams(location.search).get('ytshift');
    if (q === 'reset') localStorage.removeItem(KEY);
    else if (q !== null && Number.isFinite(+q)) localStorage.setItem(KEY, String(+q));
    const v = localStorage.getItem(KEY);
    return v === null ? null : +v;
  } catch { return null; }
}

export function initDevice() {
  const w = Math.min(screen.width, screen.height);
  const h = Math.max(screen.width, screen.height);
  const profile = PROFILES.find((p) => p.match(w, h, navigator.userAgent)) || FALLBACK;
  const shift = manualShift() ?? profile.ytShift;
  const root = document.documentElement;
  root.dataset.device = profile.id;
  root.style.setProperty('--yt-shift', `${shift}px`);
  return profile;
}
