// Per-device tweaks. The device is detected once; its profile sets CSS variables on <html>.
// To support another phone, add a profile below (first match wins).
//   match:   test on the CSS screen size (portrait w x h) and the user agent
//   ytShift: how far the YouTube iframe is moved sideways (a CSS length, negative = left).
//            On the notch iPhone the player offsets its picture by the left safe-area inset, so the iframe
//            starts that far to the left; the dock clips it. The inset is 0 in portrait, so nothing moves there.
const PROFILES = [
  { id: 'iphone-notch', match: (w, h, ua) => /iPhone/.test(ua) && h >= 812, ytShift: 'calc(-1 * env(safe-area-inset-left, 0px))' },
  // { id: 'pixel-8', match: (w, h, ua) => /Pixel 8/.test(ua), ytShift: 0 },
];
const FALLBACK = { id: 'generic', ytShift: '0px' };
const KEY = 'hitfilan.ytshift';
const FIX_KEY = 'hitfilan.ytfix';
// How to deal with the YouTube picture offset (try on the phone with ?ytfix=...; ?ytfix=reset clears it):
//   shift   (default) the iframe starts one inset to the left
//   nocover while a video is open the page drops viewport-fit=cover, so the iframe sees no inset
//   none    nothing is done
let fix = 'shift';
let defaultShift = '0px'; // the profile's own shift, used when no manual value is stored

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

function manualFix() {
  try {
    const q = new URLSearchParams(location.search).get('ytfix');
    if (q === 'reset') localStorage.removeItem(FIX_KEY);
    else if (['shift', 'nocover', 'none'].includes(q)) localStorage.setItem(FIX_KEY, q);
    return localStorage.getItem(FIX_KEY);
  } catch { return null; }
}

// Called when a video opens or closes (only matters for the "nocover" fix).
export function setVideoOpen(open) {
  if (fix !== 'nocover') return;
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.content = `width=device-width, initial-scale=1${open ? '' : ', viewport-fit=cover'}`;
}

export function initDevice() {
  fix = manualFix() || 'shift';
  const w = Math.min(screen.width, screen.height);
  const h = Math.max(screen.width, screen.height);
  const profile = PROFILES.find((p) => p.match(w, h, navigator.userAgent)) || FALLBACK;
  const manual = manualShift();
  defaultShift = fix === 'shift' ? profile.ytShift : '0px';
  const root = document.documentElement;
  root.dataset.device = profile.id;
  // A value the user set (slider or link) always wins over the profile.
  root.style.setProperty('--yt-shift', manual === null ? defaultShift : `${manual}px`);
  return profile;
}

// The shift in effect, in px (a probe element resolves env() and calc()).
export function currentShiftPx() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0;margin-left:var(--yt-shift,0px)';
  document.body.append(probe);
  const px = parseFloat(getComputedStyle(probe).marginLeft) || 0;
  probe.remove();
  return Math.round(px);
}

// Sets the sideways shift of the YouTube picture (px; null = back to the profile's value) and remembers it.
export function setShift(px) {
  try {
    if (px === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(px));
  } catch { /* storage unavailable: the shift only lasts for this visit */ }
  document.documentElement.style.setProperty('--yt-shift', px === null ? defaultShift : `${px}px`);
  document.dispatchEvent(new CustomEvent('hitfilan:shift'));
}
