// sw.js — BowlTrack service worker: precache app shell, cache-first.
const CACHE = 'bowltrack-v4';
const ASSETS = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/main.js',
  'js/score.js',
  'js/store.js',
  'js/game-ui.js',
  'js/list-ui.js',
  'js/stats-ui.js',
  'js/io.js',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request)
          .then((res) => {
            if (res.ok && e.request.url.startsWith(self.location.origin)) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => caches.match('index.html'))
    )
  );
});
