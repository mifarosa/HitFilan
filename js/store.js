// localStorage-backed settings, workout history, plans and goals. All access is
// guarded because storage can be unavailable (private mode, blocked site data).
//
// Every saved record is also a sync "document" (see js/sync.js):
//   settings        the settings object
//   h_<id>          one history entry
//   p_<id>          one plan
//   g_<id>          one goal
// META_KEY keeps when each document last changed here, and tombstones for
// deleted ones, so cloud sync can merge by "newest wins" and carry deletions.

const SETTINGS_KEY = 'hitfilan.settings';
const HISTORY_KEY = 'hitfilan.history';
const GOALS_KEY = 'hitfilan.goals';
const PLANS_KEY = 'hitfilan.plans';
const ACTIVE_KEY = 'hitfilan.active';
const META_KEY = 'hitfilan.meta';

export const DEFAULT_SETTINGS = {
  weightKg: 75,
  dumbbellKg: 7.5,
  bikeId: 'bike40', // selected bike flow duration
  warnSeconds: 10, // heads-up before each change
  weightReps: 12, // dumbbell moves in circuits: reps per set (0 = timed)
  weeklyGoal: 3, // workouts per week that keep the streak going
  resEasy: 2, // resistance knob levels on the user's bike
  resModerate: 5,
  resHard: 8,
  beeps: true,
  voice: false,
  vibrate: true,
  wakeLock: true,
};

// Record lists that sync one document per item.
export const COLLECTIONS = {
  history: { key: HISTORY_KEY, prefix: 'h_' },
  plan: { key: PLANS_KEY, prefix: 'p_' },
  goal: { key: GOALS_KEY, prefix: 'g_' },
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

function readList(key) {
  const list = read(key, []);
  return Array.isArray(list) ? list : [];
}

/* ---------- Change tracking ---------- */

function loadMeta() {
  const m = read(META_KEY, {});
  return m && typeof m === 'object' ? m : {};
}

// Marks documents as changed (or deleted) now and tells the sync layer.
function stamp(ids, deleted = false) {
  if (!ids.length) return;
  const meta = loadMeta();
  const t = Date.now();
  for (const id of ids) meta[id] = deleted ? { t, del: true } : { t };
  write(META_KEY, meta);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hitfilan:changed', { detail: ids }));
  }
}

// Saves a whole list and stamps only the items that were added, changed or removed.
function saveList(kind, next) {
  const { key, prefix } = COLLECTIONS[kind];
  const before = new Map(readList(key).map((x) => [x.id, JSON.stringify(x)]));
  write(key, next);
  const changed = [];
  for (const item of next) {
    if (before.get(item.id) !== JSON.stringify(item)) changed.push(prefix + item.id);
    before.delete(item.id);
  }
  stamp(changed);
  stamp([...before.keys()].map((id) => prefix + id), true);
}

/* ---------- Settings ---------- */

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  const changed = JSON.stringify(read(SETTINGS_KEY, {})) !== JSON.stringify(settings);
  write(SETTINGS_KEY, settings);
  if (changed) stamp(['settings']);
}

/* ---------- History ---------- */

export function loadHistory() {
  return readList(HISTORY_KEY);
}

// No cap: old entries are the point of keeping a history (and of the backup).
export function addHistory(entry) {
  saveList('history', [entry, ...loadHistory()]);
}

export function updateHistory(id, patch) {
  saveList('history', loadHistory().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function removeHistory(id) {
  saveList('history', loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  saveList('history', []);
}

/* ---------- Goals and plans ---------- */

export function loadGoals() {
  return readList(GOALS_KEY);
}

export function saveGoals(goals) {
  saveList('goal', goals);
}

export function loadPlans() {
  return readList(PLANS_KEY);
}

export function savePlans(plans) {
  saveList('plan', plans);
}

/* ---------- In-progress workout (device only, not synced) ---------- */

// Lets an interrupted session (call, reload, closed tab) resume.
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

/* ---------- Sync interface (used by js/sync.js) ---------- */

// Every local document with its change time; deleted ones as tombstones.
// Records saved before tracking existed get time 0, so the cloud wins ties
// but they are still uploaded when the cloud doesn't have them.
export function localDocs() {
  const meta = loadMeta();
  const docs = new Map();
  for (const [kind, { key, prefix }] of Object.entries(COLLECTIONS)) {
    for (const item of readList(key)) {
      const id = prefix + item.id;
      docs.set(id, { kind, data: item, updatedAt: meta[id]?.del ? 0 : meta[id]?.t || 0, deleted: false });
    }
  }
  const settings = read(SETTINGS_KEY, null);
  if (settings) docs.set('settings', { kind: 'settings', data: settings, updatedAt: meta.settings?.t || 0, deleted: false });
  for (const [id, m] of Object.entries(meta)) {
    if (m.del && !docs.has(id)) docs.set(id, { kind: kindOf(id), data: null, updatedAt: m.t, deleted: true });
  }
  return docs;
}

export function kindOf(docId) {
  if (docId === 'settings') return 'settings';
  return Object.entries(COLLECTIONS).find(([, c]) => docId.startsWith(c.prefix))?.[0] || null;
}

// Writes a document that came from the cloud, without reporting it as a local change.
export function applyRemoteDoc(docId, { kind, data, updatedAt, deleted }) {
  const meta = loadMeta();
  meta[docId] = deleted ? { t: updatedAt, del: true } : { t: updatedAt };
  if (kind === 'settings') {
    if (!deleted && data) write(SETTINGS_KEY, data);
  } else if (COLLECTIONS[kind]) {
    const { key, prefix } = COLLECTIONS[kind];
    const id = docId.slice(prefix.length);
    const list = readList(key);
    const at = list.findIndex((x) => x.id === id);
    if (deleted || !data) {
      if (at >= 0) list.splice(at, 1);
    } else if (at >= 0) {
      list[at] = data; // keep its place in the list
    } else {
      list.unshift(data);
      // History reads newest first.
      if (kind === 'history') list.sort((x, y) => new Date(y.date) - new Date(x.date));
    }
    write(key, list);
  }
  write(META_KEY, meta);
}
