/* Service worker — app shell offline-first dengan pembaruan yang aman. */
const CACHE = 'rutin-buah-v34';
const NAV_TIMEOUT = 3000;
const SHELL = [
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/theme-init.js',
  './js/utils.js',
  './js/seed.js',
  './js/store.js',
  './js/ui.js',
  './js/pages.js',
  './js/app.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-monochrome.svg'
];

self.addEventListener('install', (event) => {
  // Pre-cache atomik: bila satu berkas gagal, install gagal dan cache lama
  // tetap dipakai (tidak ada campuran versi skrip).
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // S-01: navigasi network-first ber-timeout. Respons error tidak pernah
  // menimpa shell yang baik, dan lie-fi tidak menggantung pembukaan app.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT))
        ]);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch {
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // S-03: cache-first tanpa refresh latar. Nama cache sudah terversi, jadi
  // aset dari rilis berbeda tidak pernah tercampur di satu sesi.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
      }
      return res;
    }))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// S-02: selesaikan URL terhadap scope, lalu fokuskan jendela yang sudah ada.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || './index.html';
  let target;
  try { target = new URL(raw, self.registration.scope); }
  catch { target = new URL('./index.html', self.registration.scope); }

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = wins.find((c) => {
      try { return new URL(c.url).pathname === target.pathname; }
      catch { return false; }
    });
    if (same) {
      await same.focus();
      if (target.hash) same.postMessage({ type: 'NAVIGATE', hash: target.hash });
      return;
    }
    if (self.clients.openWindow) return self.clients.openWindow(target.href);
  })());
});
