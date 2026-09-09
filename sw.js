// Service Worker - Dashboard Pesanan Harian
// Meng-cache "app shell" (HTML/manifest/ikon) agar bisa di-install & dibuka cepat,
// TAPI TIDAK PERNAH meng-cache data dari Google Apps Script, supaya dashboard
// tetap menampilkan data pesanan terbaru (real-time), bukan data basi.

const CACHE_NAME = 'pesanan-dashboard-v2';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // ES2025: Set.prototype.difference() untuk mencari cache lama yang harus dihapus
    const staleCaches = new Set(keys).difference(new Set([CACHE_NAME]));

    // ES2025: Iterator Helpers (.map() langsung di atas Set iterator)
    await Promise.all(staleCaches.values().map((key) => caches.delete(key)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Data pesanan (Google Apps Script) -> SELALU ambil langsung dari jaringan,
  // jangan pernah dilayani dari cache, supaya sinkronisasi otomatis tetap akurat.
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Aset app shell -> cache-first, lalu perbarui cache di latar belakang
  event.respondWith((async () => {
    const cached = await caches.match(event.request);

    const networkFetch = (async () => {
      const response = await fetch(event.request);

      const isCacheableAsset =
        event.request.method === 'GET' &&
        response.status === 200 &&
        url.origin === self.location.origin;

      if (isCacheableAsset) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }

      return response;
    })().catch(() => cached);

    return cached ?? networkFetch;
  })());
});
