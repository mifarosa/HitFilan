// Cloud backup and sync: Google sign-in through Firebase Auth, records in
// Firestore. The app keeps working from localStorage; this layer copies every
// change up and merges changes from other devices back in ("newest wins").
//
// Firestore layout (rules in firestore.rules):
//   hitfilan/{uid}/items/{docId}   { kind, data, updatedAt, deleted }
// where docId is "settings", "h_<id>", "p_<id>" or "g_<id>" (see js/store.js).
//
// The Firebase SDK is only downloaded once the user turns backup on.
import { localDocs, applyRemoteDoc } from './store.js';
import { planMerge, toCloud, fromCloud } from './sync-core.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0';

// Shared with Ekünye's Firebase project; HitFilan data lives under its own
// top-level collection. Public by design: access is enforced by sign-in and rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBF2vCW59yE2SxRKSZjGTiRvVRYAx-T-40',
  authDomain: 'ekunye-d7c7f.firebaseapp.com',
  projectId: 'ekunye-d7c7f',
  storageBucket: 'ekunye-d7c7f.firebasestorage.app',
  messagingSenderId: '366785332924',
  appId: '1:366785332924:web:eecd2121d13316af8cb2b9',
};

const ENABLED_KEY = 'hitfilan.sync';
const PUSH_DELAY = 800;
const BATCH_LIMIT = 400;

let fb = null; // loaded SDK pieces
let auth = null;
let db = null;
let user = null;
let unsubscribe = null;
let pushTimer = null;
const pending = new Set();
let status = { state: 'off' };
let hooks = { onStatus() {}, onRemoteChange() {} };

function setStatus(next) {
  status = next;
  hooks.onStatus(status);
}

export function syncStatus() {
  return status;
}

function isEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function setEnabled(on) {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
  } catch { /* storage unavailable */ }
}

async function loadSdk() {
  if (fb) return;
  const [app, authMod, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  fb = { ...app, ...authMod, ...fs };
  const firebaseApp = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(firebaseApp);
  try {
    db = fb.initializeFirestore(firebaseApp, {
      localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }),
    });
  } catch {
    db = fb.getFirestore(firebaseApp); // e.g. private browsing: memory cache only
  }
  fb.onAuthStateChanged(auth, (u) => {
    user = u;
    if (u) attach();
    else {
      detach();
      setStatus({ state: 'signed-out' });
    }
  });
}

function itemsRef() {
  return fb.collection(db, 'hitfilan', user.uid, 'items');
}

/* ---------- Merge and upload ---------- */

function attach() {
  detach();
  setStatus({ state: 'syncing', email: user.email });
  unsubscribe = fb.onSnapshot(itemsRef(), { includeMetadataChanges: true }, (snap) => {
    const remote = new Map();
    snap.forEach((d) => remote.set(d.id, fromCloud(d.data())));
    const { toApply, toPush } = planMerge(localDocs(), remote);
    for (const [id, doc] of toApply) applyRemoteDoc(id, doc);
    if (toApply.length) hooks.onRemoteChange();
    if (toPush.length) push(toPush);
    const waiting = snap.metadata.hasPendingWrites || toPush.length;
    setStatus({
      state: snap.metadata.fromCache && waiting ? 'pending' : 'synced',
      email: user.email,
      at: Date.now(),
    });
  }, (err) => {
    console.error(err);
    setStatus({ state: 'error', email: user?.email, message: errorText(err) });
  });
}

function detach() {
  unsubscribe?.();
  unsubscribe = null;
}

async function push(ids) {
  if (!user || !db) return;
  const docs = localDocs();
  const list = [...new Set(ids)].filter((id) => docs.has(id));
  for (let i = 0; i < list.length; i += BATCH_LIMIT) {
    const batch = fb.writeBatch(db);
    for (const id of list.slice(i, i + BATCH_LIMIT)) batch.set(fb.doc(itemsRef(), id), toCloud(docs.get(id)));
    try {
      await batch.commit();
    } catch (err) {
      console.error(err);
      setStatus({ state: 'error', email: user.email, message: errorText(err) });
      return;
    }
  }
}

// Local edits arrive as events from js/store.js; upload them shortly after.
window.addEventListener('hitfilan:changed', (e) => {
  if (!user) return;
  for (const id of e.detail) pending.add(id);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    const ids = [...pending];
    pending.clear();
    push(ids);
  }, PUSH_DELAY);
});

function errorText(err) {
  const code = err?.code || '';
  if (code === 'permission-denied') return 'Bulut erişim izni yok (Firestore kuralları güncellenmeli).';
  if (code === 'auth/popup-blocked') return 'Giriş penceresi engellendi. Tarayıcıda açılır pencerelere izin ver.';
  if (code === 'auth/unauthorized-domain') return 'Bu adres Firebase’de yetkili değil (Authorized domains).';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'İnternet bağlantısı yok. Bağlanınca devam eder.';
  return 'Eşitleme sırasında bir sorun oldu.';
}

/* ---------- Public API ---------- */

// Called once at startup; resumes sync if the user turned it on before.
export function initSync(h) {
  hooks = { ...hooks, ...h };
  if (!isEnabled()) {
    setStatus({ state: 'off' });
    return;
  }
  setStatus({ state: 'loading' });
  loadSdk().catch((err) => {
    console.error(err);
    setStatus({ state: 'error', message: 'Bulut bağlantısı yüklenemedi. İnternet bağlantını kontrol et.' });
  });
}

export async function signIn() {
  setEnabled(true);
  setStatus({ state: 'loading' });
  try {
    await loadSdk();
    const provider = new fb.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await fb.signInWithPopup(auth, provider);
    } catch (err) {
      // No popups at all (some in-app browsers and installed apps): use a redirect.
      if (err?.code === 'auth/operation-not-supported-in-this-environment') {
        await fb.signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      setEnabled(false);
      setStatus({ state: 'off' });
      return;
    }
    console.error(err);
    setStatus({ state: 'error', message: errorText(err) });
  }
}

// Stops syncing on this device; local data stays, the cloud copy stays too.
export async function signOut() {
  setEnabled(false);
  detach();
  try {
    if (auth) await fb.signOut(auth);
  } catch { /* already signed out */ }
  user = null;
  setStatus({ state: 'off' });
}
