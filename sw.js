// sw.js — BowlTrack service worker: precache app shell, network-first with
// cache fallback (offline at the alley still works; online always gets fresh code).
const CACHE = 'bowltrack-v14';
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
  const sameOrigin = e.request.url.startsWith(self.location.origin);
  // no-cache: revalidate with server so deploys are picked up immediately
  // (GitHub Pages answers revalidation with cheap 304s); offline -> cache.
  e.respondWith(
    fetch(e.request, sameOrigin ? { cache: 'no-cache' } : undefined)
      .then((res) => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((hit) => hit || caches.match('index.html'))
      )
  );
});
