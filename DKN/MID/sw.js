/**
 * Service Worker: menyimpan file aplikasi agar tetap bisa dibuka saat offline.
 * Data nilai disimpan terpisah di localStorage oleh aplikasi.
 * Naikkan CACHE_VERSION setiap kali file aplikasi diperbarui.
 */
const CACHE_VERSION = 'eraport-mid-v3.1.0';

const APP_SHELL = [
  './',
  'index.html',
  'guru.html',
  'admin.html',
  'manifest.json',
  'css/app.css',
  'css/admin.css',
  'css/print.css',
  'js/config.js',
  'js/seed.js',
  'js/core.js',
  'js/login.js',
  'js/guru.js',
  'js/admin/app.js',
  'js/admin/raport.js',
  'js/admin/reports.js',
  'js/admin/data.js',
  'js/admin/excel.js',
  'js/admin/settings.js',
  'js/admin/peringkat.js',
  'js/admin/pengambilan.js',
  'assets/logo_left.png',
  'assets/logo_right.png',
  'assets/vendor/xlsx-style.bundle.js',
  'assets/vendor/chart.umd.min.js',
  'assets/vendor/html2pdf.bundle.min.js',
  'assets/vendor/jszip.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      // hanya hapus cache lama milik versi Mid (cache E-Raport Semester di domain yang sama dibiarkan)
      .then(keys => Promise.all(keys.filter(k => k.indexOf('eraport-mid-') === 0 && k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: simpan agar tampilan tetap rapi saat offline
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  // API Apps Script & domain lain tidak di-cache
  if (url.origin !== self.location.origin && !isFont) return;

  // Network-first untuk halaman HTML & file aplikasi (agar pembaruan cepat terlihat),
  // jatuh ke cache saat offline.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && (res.type === 'basic' || isFont || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
