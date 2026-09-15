const CACHE_NAME = 'siabsen-cache-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/style.css',
  './assets/config.js',
  './assets/app.js',
  './vendor/jspdf.umd.min.js',
  './vendor/html2canvas.min.js',
  './vendor/chart.umd.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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

/**
 * Strategi NETWORK-FIRST:
 * - Kalau ada internet: selalu ambil versi TERBARU dari jaringan
 *   (jadi update aplikasi langsung terlihat, tidak nyangkut di cache lama),
 *   sambil menyimpan salinannya ke cache untuk dipakai saat offline nanti.
 * - Kalau tidak ada internet: baru pakai salinan dari cache.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
