// Full screen from inside the page. The Fullscreen API exists on Android Chrome, desktop and iPad, but NOT
// on iPhone (only for video): there the only way to lose the browser bars is "Add to Home Screen" in Safari.

const root = document.documentElement;

// Installed apps already run without browser bars.
export function isStandalone() {
  try {
    return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches
      || navigator.standalone === true;
  } catch { return false; }
}

export function canFullscreen() {
  return !isStandalone() && !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// Must be called from a user gesture (a tap).
export async function enterFullscreen() {
  if (!canFullscreen() || isFullscreen()) return;
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else await root.webkitRequestFullscreen();
  } catch { /* refused: the browser keeps its bars */ }
}

export async function exitFullscreen() {
  if (!isFullscreen()) return;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else await document.webkitExitFullscreen();
  } catch { /* already out */ }
}

export function onFullscreenChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}
