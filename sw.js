// Service Worker - Dashboard Pesanan Harian
// Meng-cache "app shell" (HTML/manifest/ikon) agar bisa di-install & dibuka cepat,
// TAPI TIDAK PERNAH meng-cache data dari Google Apps Script, supaya dashboard
// tetap menampilkan data pesanan terbaru (real-time), bukan data basi.

const CACHE_NAME = 'pesanan-dashboard-v2';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
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
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.status === 200 && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => cached);

      return cached || network;
    })
  );
});
