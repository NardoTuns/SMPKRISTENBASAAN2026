// Konfigurasi aplikasi. APP_VERSION disamakan otomatis dengan version.json oleh `node tools/build-sw.mjs`.
export const APP_VERSION = '1.2.0';
export const APP_NAME = 'Tatib KRISBA';
export const APP_FULLNAME = 'Tata Tertib SMP Kristen Basaan';

// URL Web App Google Apps Script (berakhiran /exec). Isi setelah Code.gs di-deploy (lihat PANDUAN.md),
// supaya semua HP langsung tersambung. Admin juga bisa mengisinya per-perangkat di Kelola → Pengaturan.
export const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz9o5gaYB8dK2WCvvPudhVWWb8yVmh5PsMn-KGEr_CvRnSN4ypGZGbjJlL4mlRgSSF2/exec';

// Jumlah putaran SHA-256 untuk hash password (harus sama dengan HASH_ITER di Code.gs; server mengirim nilainya).
export const HASH_ITER = 200;

// Sinkron otomatis berkala saat aplikasi terbuka (ms).
export const AUTO_SYNC_MS = 5 * 60 * 1000;
