// Offline cache for the app shell. Bump CACHE when shipping changes.
const CACHE = 'hitfilan-v8';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/audio.js',
  'js/data.js',
  'js/goals.js',
  'js/plans.js',
  'js/visual.js',
  'js/steps.js',
  'js/store.js',
  'js/timer.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  // Exercise photos, so workouts look right offline
  'img/ex/squat-0.webp',
  'img/ex/squat-1.webp',
  'img/ex/pushup-0.webp',
  'img/ex/pushup-1.webp',
  'img/ex/reverse_lunge-0.webp',
  'img/ex/reverse_lunge-1.webp',
  'img/ex/mountain_climber-0.webp',
  'img/ex/mountain_climber-1.webp',
  'img/ex/jumping_jack-0.webp',
  'img/ex/jumping_jack-1.webp',
  'img/ex/skater-0.webp',
  'img/ex/skater-1.webp',
  'img/ex/plank-0.webp',
  'img/ex/plank-1.webp',
  'img/ex/side_plank-0.webp',
  'img/ex/side_plank-1.webp',
  'img/ex/glute_bridge-0.webp',
  'img/ex/glute_bridge-1.webp',
  'img/ex/dead_bug-0.webp',
  'img/ex/dead_bug-1.webp',
  'img/ex/bicycle_crunch-0.webp',
  'img/ex/bicycle_crunch-1.webp',
  'img/ex/leg_raise-0.webp',
  'img/ex/leg_raise-1.webp',
  'img/ex/crunch-0.webp',
  'img/ex/crunch-1.webp',
  'img/ex/situp-0.webp',
  'img/ex/situp-1.webp',
  'img/ex/superman-0.webp',
  'img/ex/superman-1.webp',
  'img/ex/goblet_squat-0.webp',
  'img/ex/goblet_squat-1.webp',
  'img/ex/db_rdl-0.webp',
  'img/ex/db_rdl-1.webp',
  'img/ex/db_row-0.webp',
  'img/ex/db_row-1.webp',
  'img/ex/db_press-0.webp',
  'img/ex/db_press-1.webp',
  'img/ex/db_swing-0.webp',
  'img/ex/db_swing-1.webp',
  'img/ex/db_thruster-0.webp',
  'img/ex/db_thruster-1.webp',
  'img/ex/goblet_lunge-0.webp',
  'img/ex/goblet_lunge-1.webp',
  'img/ex/russian_twist-0.webp',
  'img/ex/russian_twist-1.webp',
  'img/ex/floor_press-0.webp',
  'img/ex/floor_press-1.webp',
  'img/ex/db_curl-0.webp',
  'img/ex/db_curl-1.webp',
  'img/ex/db_hammer-0.webp',
  'img/ex/db_hammer-1.webp',
  'img/ex/db_triceps-0.webp',
  'img/ex/db_triceps-1.webp',
  'img/ex/db_kickback-0.webp',
  'img/ex/db_kickback-1.webp',
  'img/ex/db_lateral-0.webp',
  'img/ex/db_lateral-1.webp',
  'img/ex/db_front-0.webp',
  'img/ex/db_front-1.webp',
  'img/ex/db_sumo-0.webp',
  'img/ex/db_sumo-1.webp',
  'img/ex/db_calf-0.webp',
  'img/ex/db_calf-1.webp',
  'img/ex/db_reverse_fly-0.webp',
  'img/ex/db_reverse_fly-1.webp',
  'img/ex/db_shrug-0.webp',
  'img/ex/db_shrug-1.webp',
  'img/ex/bike-0.webp',
  'img/ex/bike-1.webp',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first so updates show up when online; fall back to cache offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
