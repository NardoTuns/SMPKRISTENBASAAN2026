// Penyimpanan lokal (IndexedDB). Semua data tetap di HP — termasuk yang sudah tersinkron — agar dasbor,
// riwayat, dan pencatatan tetap jalan tanpa internet. Data tidak pernah dihapus otomatis.
//
// Store (keyPath):
//   siswa(id) · kategori(kode) · jenis(kode) · sanksi(kode) · pelanggaran(id) · tindak(id) · users(username)
//   outbox(opId) — antrean perubahan yang belum terkirim ke server
//   kv(k)        — pengaturan sekolah, sesi login, status sinkron, preferensi tampilan
// Baris yang pernah dikonfirmasi server diberi _s = 1.

const DB_NAME = 'tatib-krisba';
const DB_VERSION = 1;
export const STORES = { siswa: 'id', kategori: 'kode', jenis: 'kode', sanksi: 'kode', pelanggaran: 'id', tindak: 'id', users: 'username', outbox: 'opId', kv: 'k' };
let dbp = null;

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      // Skema versi 1. Perubahan berikutnya WAJIB lewat blok if (oldVersion < N) agar data lama tetap ada.
      for (const [name, keyPath] of Object.entries(STORES)) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
    };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null; }; resolve(db); };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Database sedang dipakai tab lain. Tutup tab aplikasi yang lain lalu muat ulang.'));
  });
  return dbp;
}

async function tx(stores, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out;
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksi dibatalkan'));
    Promise.resolve(fn(t)).then((v) => { out = v; }, (e) => { try { t.abort(); } catch { /* sudah selesai */ } reject(e); });
  });
}

export const getAll = (store) => tx([store], 'readonly', (t) => req(t.objectStore(store).getAll()));
export const put = (store, row) => tx([store], 'readwrite', (t) => req(t.objectStore(store).put(row)));
export const putMany = (store, rows) => tx([store], 'readwrite', (t) => Promise.all(rows.map((r) => req(t.objectStore(store).put(r)))));
export const del = (store, key) => tx([store], 'readwrite', (t) => req(t.objectStore(store).delete(key)));
export const delMany = (store, keys) => tx([store], 'readwrite', (t) => Promise.all(keys.map((k) => req(t.objectStore(store).delete(k)))));
/** Ganti seluruh isi store dalam satu transaksi (gagal = isi lama tetap utuh). */
export const replaceAll = (store, rows) => tx([store], 'readwrite', async (t) => {
  const os = t.objectStore(store);
  await req(os.clear());
  await Promise.all(rows.map((r) => req(os.put(r))));
});
export const clearAll = () => tx(Object.keys(STORES), 'readwrite', (t) => Promise.all(Object.keys(STORES).map((s) => req(t.objectStore(s).clear()))));

export async function kvGet(k, def = null) {
  const r = await tx(['kv'], 'readonly', (t) => req(t.objectStore('kv').get(k)));
  return r ? r.v : def;
}
export const kvSet = (k, v) => tx(['kv'], 'readwrite', (t) => req(t.objectStore('kv').put({ k, v })));
export const kvDel = (k) => tx(['kv'], 'readwrite', (t) => req(t.objectStore('kv').delete(k)));

/** Minta browser tidak menghapus data saat ruang penyimpanan menipis. */
export async function requestPersist() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    return navigator.storage?.persist ? await navigator.storage.persist() : false;
  } catch { return false; }
}
export async function storageInfo() {
  try {
    const e = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return { usage: e?.usage || 0, quota: e?.quota || 0, persisted: !!persisted };
  } catch { return { usage: 0, quota: 0, persisted: false }; }
}
