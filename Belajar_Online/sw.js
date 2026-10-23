/* English Ceria — service worker: membuat aplikasi bisa dibuka & dipakai offline.
   Naikkan VERSION setiap kali file aplikasi diubah agar pengguna mendapat versi baru.
   Naikkan AUDIO_CACHE (juga di js/app.js) bila rekaman suara dibuat ulang. */
const VERSION = 'ec-app-1.0.0';
const AUDIO_CACHE = 'ec-audio-1';
const FONT_CACHE = 'ec-fonts-1';
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(VERSION);
    await shell.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
    const audio = await caches.open(AUDIO_CACHE);
    if (!(await audio.match('audio/ui.js'))) {
      try { await audio.add(new Request('audio/ui.js', { cache: 'reload' })); } catch (e) { /* dicoba lagi saat dipakai */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [VERSION, AUDIO_CACHE, FONT_CACHE];
    for (const k of await caches.keys()) {
      if (k.startsWith('ec-') && !keep.includes(k)) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) {
    const c = await caches.open(cacheName);
    c.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(VERSION);
  const hit = await c.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => {
    if (res && res.ok) c.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put('index.html', copy));
          return res;
        }).catch(async () => (await caches.match('index.html')) || (await caches.match('./')) || Response.error())
      );
      return;
    }
    if (url.pathname.includes('/audio/')) {
      event.respondWith(cacheFirst(req, AUDIO_CACHE));
      return;
    }
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONT_CACHE).catch(() => Response.error()));
  }
});
