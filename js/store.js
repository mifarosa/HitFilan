// localStorage-backed settings and workout history. All access is guarded
// because storage can be unavailable (private mode, blocked site data).

const SETTINGS_KEY = 'hitfilan.settings';
const HISTORY_KEY = 'hitfilan.history';

export const DEFAULT_SETTINGS = {
  weightKg: 75,
  dumbbellKg: 7.5,
  bikeId: 'bike40', // selected bike flow duration
  warnSeconds: 10, // heads-up before each change
  weeklyGoal: 3, // workouts per week that keep the streak going
  resEasy: 2, // resistance knob levels on the user's bike
  resModerate: 5,
  resHard: 8,
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

export function updateHistory(id, patch) {
  write(HISTORY_KEY, loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

// In-progress workout, so an interrupted session (call, reload, closed tab) can resume.
const ACTIVE_KEY = 'hitfilan.active';

export function saveActive(state) {
  write(ACTIVE_KEY, state);
}

export function loadActive() {
  return read(ACTIVE_KEY, null);
}

export function clearActive() {
  try {
    localStorage.removeItem(ACTIVE_KEY);
  } catch { /* storage unavailable */ }
}

const GOALS_KEY = 'hitfilan.goals';

export function loadGoals() {
  const list = read(GOALS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveGoals(goals) {
  write(GOALS_KEY, goals);
}

// User-built workout plans (see js/plans.js for the shape).
const PLANS_KEY = 'hitfilan.plans';

export function loadPlans() {
  const list = read(PLANS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function savePlans(plans) {
  write(PLANS_KEY, plans);
}

export function removeHistory(id) {
  write(HISTORY_KEY, loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  write(HISTORY_KEY, []);
}
