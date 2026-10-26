// Service worker Tata Tertib: aplikasi tetap terbuka tanpa internet & pembaruan lewat tombol "Perbarui".
// Baris CACHE dan ASSETS dibuat otomatis oleh `node tools/build-sw.mjs` — jalankan setiap kali mengubah file.
const CACHE = 'tatib-1.0.0-d894ba5cfd';
const ASSETS = ["./","css/app.css","icons/apple-touch-icon.png","icons/favicon.svg","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","index.html","js/api.js","js/app.js","js/auth.js","js/config.js","js/core/demo.js","js/core/perm.js","js/core/points.js","js/core/rules.js","js/core/sha256.js","js/core/stats.js","js/core/util.js","js/db.js","js/pages/akun.js","js/pages/aturan.js","js/pages/catat.js","js/pages/dashboard.js","js/pages/kelas.js","js/pages/kelola.js","js/pages/laporan.js","js/pages/login.js","js/pages/riwayat.js","js/pages/siswa.js","js/pages/tindak.js","js/pwa.js","js/store.js","js/sync.js","js/ui/charts.js","js/ui/dom.js","js/ui/nav.js","js/ui/print.js","js/ui/widgets.js","manifest.webmanifest","version.json"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'reload' })))));
  // Tidak langsung skipWaiting: versi baru menunggu sampai pengguna menekan "Perbarui".
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('tatib-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// Hanya file aplikasi (daftar ASSETS) yang dilayani dari cache; data (Apps Script) selalu lewat jaringan.
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const ASSET_SET = new Set(ASSETS.map((a) => (a === './' ? '' : a)));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  const rel = url.pathname.slice(SCOPE_PATH.length);
  if (rel === 'version.json') {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('version.json')));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith((async () => (await caches.match('index.html')) || fetch(req))());
    return;
  }
  if (!ASSET_SET.has(rel)) return;
  e.respondWith((async () => (await caches.match(rel === '' ? './' : rel, { ignoreSearch: true })) || fetch(req))());
});
