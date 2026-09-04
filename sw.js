/* =============================================================
   SERVICE WORKER - jangan dihapus.
   File ini yang membuat Chrome mengizinkan tombol "Instal Aplikasi"
   muncul, dan menyimpan salinan halaman ini agar tetap bisa
   dibuka walau sinyal internet sedang lemah.
   Tidak perlu diubah kecuali ingin menambah halaman yang disimpan
   di daftar ASSETS_TO_CACHE di bawah ini.
============================================================= */

const CACHE_NAME = "smp-basaan-v1";

const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return (
                cached ||
                fetch(event.request).catch(() => cached)
            );
        })
    );
});
