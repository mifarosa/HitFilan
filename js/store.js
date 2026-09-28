// localStorage-backed settings and workout history. All access is guarded
// because storage can be unavailable (private mode, blocked site data).

const SETTINGS_KEY = 'hitfilan.settings';
const HISTORY_KEY = 'hitfilan.history';

export const DEFAULT_SETTINGS = {
  weightKg: 75,
  dumbbellKg: 7.5,
  bikeId: 'bike40', // selected bike flow duration
  beeps: true,
  voice: false,
  vibrate: true,
  wakeLock: true,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage unavailable */ }
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

export function loadHistory() {
  const list = read(HISTORY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  write(HISTORY_KEY, list.slice(0, 500));
}

export function removeHistory(id) {
  write(HISTORY_KEY, loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  write(HISTORY_KEY, []);
}
