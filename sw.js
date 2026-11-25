/* Service worker — app shell offline-first dengan pembaruan yang aman. */
const CACHE = 'rutin-buah-v36';
const NAV_TIMEOUT = 3000;
const SHELL = [
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/theme-init.js',
  './js/utils.js',
  './js/errlog.js',
  './js/seed.js',
  './js/archive.js',
  './js/planner.js',
  './js/insights.js',
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

/** Pre-cache atomik dengan HTTP cache di-bypass, sehingga aset baru tidak stale. */
async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map(async (path) => {
    const url = new URL(path, self.registration.scope).href;
    const res = await fetch(url, { cache: 'reload' });
    if (!res || !res.ok) throw new Error(`Gagal memuat ${path}: ${res && res.status}`);
    await cache.put(url, res);
  }));
}

self.addEventListener('install', (event) => {
  // worker baru menunggu (tanpa skipWaiting) sampai pengguna menyetujui muat ulang.
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('rutin-buah-') && k !== CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  // Jangan menyusup ke PWA lain pada origin bersama (mis. GitHub Pages).
  if (!url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;

  // S-01: navigasi network-first ber-timeout. Respons error tidak pernah
  // menimpa shell yang baik, dan lie-fi tidak menggantung pembukaan app.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const fallback = async () => (await cache.match('./index.html')) || Response.error();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT);
      try {
        const res = await fetch(req, { signal: controller.signal });
        clearTimeout(timer);
        if (!res || !res.ok) return fallback();
        await cache.put('./index.html', res.clone());
        return res;
      } catch {
        clearTimeout(timer);
        return fallback();
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
      try {
        const cur = new URL(c.url);
        return cur.origin === target.origin && cur.pathname === target.pathname;
      } catch { return false; }
    });
    if (same) {
      await same.focus();
      if (target.hash) same.postMessage({ type: 'NAVIGATE', hash: target.hash });
      return;
    }
    if (self.clients.openWindow) return self.clients.openWindow(target.href);
  })());
});
