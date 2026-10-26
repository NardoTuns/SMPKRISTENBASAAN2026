// Status aplikasi di memori + perubahan data lokal. Setiap perubahan langsung disimpan di IndexedDB
// dan dimasukkan ke antrean (outbox) untuk dikirim ke server saat online.
import * as db from './db.js';
import { DEFAULT_SCRIPT_URL, HASH_ITER } from './config.js';
import { DEFAULT_SETTINGS } from './core/rules.js';
import { buildSummaries, buildTindak, sortLevels } from './core/points.js';
import { cmpKelas, stamp, uid } from './core/util.js';

export const KEYS = { siswa: 'id', kategori: 'kode', jenis: 'kode', sanksi: 'kode', pelanggaran: 'id', tindak: 'id', users: 'username' };

export const S = {
  ready: false,
  ver: 0,
  demo: false,
  serverUrl: '',
  session: null,
  d: { siswa: [], kategori: [], jenis: [], sanksi: [], pelanggaran: [], tindak: [], users: [] },
  settings: { ...DEFAULT_SETTINGS },
  meta: { salt: '', iter: HASH_ITER, rev: 0, lastPull: 0, restricted: false, server: '' },
  outbox: [],
  sync: { running: false, lastOk: 0, msg: '', error: '', authError: '' },
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  deviceId: '',
};

// ------------------------------------------------------------------ event
const listeners = new Map();
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
export function emit(evt, data) { for (const fn of listeners.get(evt) || []) { try { fn(data); } catch (e) { console.error(e); } } }
export function bump() { S.ver++; emit('data'); }

// ------------------------------------------------------------------ muat
export async function loadAll() {
  const names = Object.keys(KEYS);
  const all = await Promise.all(names.map((n) => db.getAll(n)));
  names.forEach((n, i) => { S.d[n] = all[i]; });
  S.outbox = (await db.getAll('outbox')).sort((a, b) => a.at - b.at);
  S.settings = { ...DEFAULT_SETTINGS, ...(await db.kvGet('settings', {})) };
  S.meta = { ...S.meta, ...(await db.kvGet('meta', {})) };
  S.session = await db.kvGet('session', null);
  S.demo = !!(await db.kvGet('demo', false));
  S.serverUrl = (await db.kvGet('serverUrl', '')) || DEFAULT_SCRIPT_URL;
  S.sync.lastOk = await db.kvGet('lastOk', 0);
  let dev = await db.kvGet('deviceId', '');
  if (!dev) { dev = uid('d'); await db.kvSet('deviceId', dev); }
  S.deviceId = dev;
  S.ready = true;
  bump();
}

export const saveMeta = () => db.kvSet('meta', S.meta);
export const saveSettings = () => db.kvSet('settings', S.settings);

export function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Lainnya';
  return `${os} · ${S.deviceId.slice(-6)}`;
}

// ------------------------------------------------------------------ turunan (di-cache per versi data)
let memo = { ver: -1 };
export function D() {
  if (memo.ver === S.ver) return memo;
  const levels = sortLevels(S.d.sanksi);
  const kategori = [...S.d.kategori].sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0) || String(a.kode).localeCompare(String(b.kode)));
  const katOrder = new Map(kategori.map((k, i) => [k.kode, i]));
  const jenis = [...S.d.jenis].sort((a, b) => (katOrder.get(a.kategori) ?? 99) - (katOrder.get(b.kategori) ?? 99)
    || (Number(a.urutan) || 0) - (Number(b.urutan) || 0) || String(a.kode).localeCompare(String(b.kode), 'id', { numeric: true }));
  const siswaMap = new Map(S.d.siswa.map((s) => [s.id, s]));
  const summaries = buildSummaries(S.d.siswa, S.d.pelanggaran, levels);
  const aktif = S.d.siswa.filter((s) => (s.status || 'Aktif') === 'Aktif');
  const kelasList = [...new Set(aktif.map((s) => s.kelas).filter(Boolean))].sort(cmpKelas);
  const pendingKeys = new Set(S.outbox.map((o) => `${o.table}:${o.key}`));
  memo = {
    ver: S.ver, levels, kategori, jenis, siswaMap, summaries, aktif, kelasList, pendingKeys,
    katMap: new Map(kategori.map((k) => [k.kode, k])),
    jenisMap: new Map(jenis.map((j) => [String(j.kode), j])),
    userMap: new Map(S.d.users.map((u) => [u.username, u])),
    tindak: buildTindak(S.d.siswa, summaries, S.d.tindak),
    failed: S.outbox.filter((o) => o.failed),
    batasSidang: Number(S.settings.batasSidang) || 50,
  };
  return memo;
}

export const isPending = (table, key) => D().pendingKeys.has(`${table}:${key}`);
export const katNama = (kode) => D().katMap.get(kode)?.nama || kode || '-';

/** Pengguna yang sedang login (data terbaru dari daftar pengguna). */
export function me() {
  if (!S.session) return null;
  const u = S.d.users.find((x) => x.username === S.session.username);
  return u ? { ...S.session, nama: u.nama, peran: u.peran, kelasWali: u.kelasWali, nip: u.nip } : S.session;
}

/** Data siswa & pelanggaran disembunyikan bila server mewajibkan login untuk melihat dasbor. */
export const hidden = () => S.meta.restricted && !S.session;

// ------------------------------------------------------------------ perubahan lokal
function upsertMem(table, row) {
  const k = KEYS[table];
  const list = S.d[table];
  const i = list.findIndex((x) => x[k] === row[k]);
  if (i >= 0) list[i] = row; else list.push(row);
}

async function enqueue(table, op, key, row) {
  const by = S.session ? { u: S.session.username, t: S.session.token } : null;
  const ex = S.outbox.find((o) => o.table === table && o.key === key && o.op === op && !o.inflight && !o.failed);
  if (ex) {
    ex.row = row; ex.by = by || ex.by; ex.err = '';
    await db.put('outbox', stripRuntime(ex));
    return;
  }
  const o = { opId: uid('o'), table, op, key, row, by, at: Date.now(), tries: 0, err: '' };
  S.outbox.push(o);
  await db.put('outbox', o);
}
export const stripRuntime = (o) => { const { inflight, ...rest } = o; return rest; };

/** Simpan satu/banyak baris (upsert). Mengembalikan baris yang tersimpan. */
export async function saveRows(table, rows) {
  const k = KEYS[table];
  const t = stamp();
  const out = rows.map((r) => ({ ...r, [k]: String(r[k]), updatedAt: t, updatedBy: S.session?.username || '' }));
  for (const r of out) { if (S.demo) r._s = 1; upsertMem(table, r); }
  await db.putMany(table, out);
  if (!S.demo) for (const r of out) await enqueue(table, 'upsert', r[k], stripLocal(r));
  bump();
  emit('write');
  return out;
}
export const saveRow = async (table, row) => (await saveRows(table, [row]))[0];

export async function deleteRow(table, key) {
  const k = KEYS[table];
  S.d[table] = S.d[table].filter((x) => x[k] !== key);
  await db.del(table, key);
  if (!S.demo) {
    // Baris yang belum pernah terkirim cukup dibuang dari antrean.
    const pend = S.outbox.filter((o) => o.table === table && o.key === key && !o.inflight);
    for (const o of pend) { S.outbox.splice(S.outbox.indexOf(o), 1); await db.del('outbox', o.opId); }
    await enqueue(table, 'delete', key, null);
  }
  bump();
  emit('write');
}

/** Pengaturan sekolah (Admin). Disimpan langsung di HP dan diantrekan ke sheet "Pengaturan". */
export async function saveSettingsMap(map) {
  for (const [kunci, nilai] of Object.entries(map)) {
    S.settings[kunci] = String(nilai ?? '');
    if (!S.demo) await enqueue('pengaturan', 'upsert', kunci, { kunci, nilai: String(nilai ?? '') });
  }
  await saveSettings();
  bump();
  emit('write');
}

export const stripLocal = (r) => { if (!r) return r; const { _s, ...rest } = r; return rest; };

// ------------------------------------------------------------------ penerapan data server
/** Ganti isi tabel dengan data server, kecuali baris yang masih menunggu dikirim dari HP ini. */
export async function replaceFromServer(table, rows) {
  const k = KEYS[table];
  const pend = new Set(S.outbox.filter((o) => o.table === table).map((o) => o.key));
  const local = new Map(S.d[table].map((r) => [String(r[k]), r]));
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    const key = String(r[k]);
    seen.add(key);
    out.push(pend.has(key) && local.has(key) ? local.get(key) : { ...r, [k]: key, _s: 1 });
  }
  for (const [key, r] of local) if (!seen.has(key) && pend.has(key)) out.push(r);
  S.d[table] = out;
  await db.replaceAll(table, out);
}

/** Gabungkan baris yang berubah (sinkron bertahap). */
export async function mergeFromServer(table, rows) {
  if (!rows.length) return;
  const k = KEYS[table];
  const pend = new Set(S.outbox.filter((o) => o.table === table).map((o) => o.key));
  const put = [];
  for (const r of rows) {
    const key = String(r[k]);
    if (pend.has(key)) continue;
    const row = { ...r, [k]: key, _s: 1 };
    upsertMem(table, row);
    put.push(row);
  }
  if (put.length) await db.putMany(table, put);
}

/** Ganti seluruh data dengan data demo, atau kosongkan (keluar dari demo / ganti server). */
export async function resetData({ demo = null } = {}) {
  await db.clearAll();
  for (const n of Object.keys(KEYS)) S.d[n] = [];
  S.outbox = [];
  S.meta = { salt: '', iter: HASH_ITER, rev: 0, lastPull: 0, restricted: false, server: '' };
  S.settings = { ...DEFAULT_SETTINGS };
  S.session = null;
  S.sync = { running: false, lastOk: 0, msg: '', error: '', authError: '' };
  await db.kvSet('deviceId', S.deviceId);
  if (S.serverUrl && S.serverUrl !== DEFAULT_SCRIPT_URL) await db.kvSet('serverUrl', S.serverUrl);
  S.demo = !!demo;
  if (demo) {
    for (const n of Object.keys(KEYS)) {
      S.d[n] = (demo[n] || []).map((r) => ({ ...r, [KEYS[n]]: String(r[KEYS[n]]), _s: 1 }));
      await db.putMany(n, S.d[n]);
    }
    S.settings = { ...DEFAULT_SETTINGS, ...demo.settings };
    S.meta = { ...S.meta, salt: demo.salt, iter: demo.iter, lastPull: Date.now() };
    await db.kvSet('demo', true);
    await saveSettings();
    await saveMeta();
  }
  bump();
}
