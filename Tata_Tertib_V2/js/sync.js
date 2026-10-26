// Sinkronisasi dua arah dengan Google Sheets:
//   1) kirim antrean (outbox) per pengguna pencatat, 150 perubahan per permintaan;
//   2) tarik data: aturan, siswa & pengguna selalu penuh; catatan & tindak lanjut bertahap (_rev),
//      dengan pemeriksaan jumlah baris → tarik penuh bila berbeda (mis. baris dihapus langsung di sheet).
// Data di HP tidak dihapus setelah terkirim; baris yang masih menunggu dikirim tidak ditimpa server.
import { call } from './api.js';
import * as db from './db.js';
import { S, emit, bump, deviceLabel, mergeFromServer, replaceFromServer, saveMeta, saveSettings, stripLocal, stripRuntime } from './store.js';
import { AUTO_SYNC_MS } from './config.js';
import { hm } from './core/util.js';

let running = null;
let again = false;
let timer = null;

export function schedule(ms = 1500) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow({ quiet: true }), ms);
}

export function startAuto() {
  window.addEventListener('online', () => { S.online = true; emit('sync'); schedule(800); });
  window.addEventListener('offline', () => { S.online = false; emit('sync'); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow({ quiet: true }); }, AUTO_SYNC_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - (S.meta.lastPull || 0) > 60000) schedule(500);
  });
}

export function syncNow(opts = {}) {
  if (S.demo || !S.serverUrl) return Promise.resolve(false);
  if (running) { again = true; return running; }
  running = run(opts).finally(() => {
    running = null;
    if (again) { again = false; schedule(300); }
  });
  return running;
}

async function run({ full = false } = {}) {
  if (!navigator.onLine) { S.sync.msg = 'Offline — data tersimpan di HP'; emit('sync'); return false; }
  S.sync.running = true;
  S.sync.msg = 'Menyinkronkan…';
  emit('sync');
  try {
    const pushed = await pushAll();
    await pull(full);
    S.sync.lastOk = Date.now();
    await db.kvSet('lastOk', S.sync.lastOk);
    S.sync.error = '';
    const left = S.outbox.length;
    S.sync.msg = `Tersinkron ${hm()}` + (pushed ? ` · ${pushed} terkirim` : '') + (left ? ` · ${left} tertunda` : '');
    return true;
  } catch (e) {
    S.sync.error = e.message;
    S.sync.msg = e.code === 'OFFLINE' ? 'Offline — data tersimpan di HP' : 'Gagal sinkron';
    return false;
  } finally {
    S.sync.running = false;
    bump();
    emit('sync');
  }
}

async function pushAll() {
  let sent = 0;
  const ready = S.outbox.filter((o) => !o.failed && o.by && !(S.sync.authBlocked || []).includes(o.by.u));
  const groups = new Map();
  for (const o of ready) {
    const g = `${o.by.u}|${o.by.t}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  }
  const blocked = [];
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i += 150) {
      const chunk = list.slice(i, i + 150);
      chunk.forEach((o) => { o.inflight = true; });
      let res;
      try {
        res = await call(S.serverUrl, {
          action: 'push', auth: chunk[0].by, device: deviceLabel(),
          ops: chunk.map((o) => ({ id: o.opId, table: o.table, op: o.op, key: o.key, row: stripLocal(o.row) })),
        }, 90000);
      } catch (e) {
        chunk.forEach((o) => { delete o.inflight; });
        if (e.code === 'AUTH') {
          blocked.push(chunk[0].by.u);
          S.sync.authError = `Perubahan dari akun "${chunk[0].by.u}" belum terkirim karena sesi login tidak berlaku (password diganti?). Login ulang dengan akun tersebut untuk mengirimnya.`;
          break;
        }
        throw e;
      }
      sent += await applyResults(chunk, res.results || []);
    }
  }
  S.sync.authBlocked = blocked;
  if (!blocked.length && S.sync.authError.startsWith('Perubahan dari akun')) S.sync.authError = '';
  return sent;
}

async function applyResults(chunk, results) {
  const byId = new Map(results.map((r) => [r.id, r]));
  let ok = 0;
  for (const o of chunk) {
    delete o.inflight;
    const r = byId.get(o.opId);
    if (!r) continue;
    if (r.ok) {
      ok++;
      S.outbox.splice(S.outbox.indexOf(o), 1);
      await db.del('outbox', o.opId);
      const stillPending = S.outbox.some((x) => x.table === o.table && x.key === o.key);
      if (stillPending || o.table === 'pengaturan') continue;
      if (r.deleted) continue;
      if (r.row) await mergeFromServer(o.table, [r.row]);
    } else if (r.code === 'FORBIDDEN' || r.code === 'VALIDATION') {
      o.failed = true;
      o.err = r.error;
      await db.put('outbox', stripRuntime(o));
    } else {
      o.tries = (o.tries || 0) + 1;
      o.err = r.error;
      await db.put('outbox', stripRuntime(o));
    }
  }
  return ok;
}

async function pull(full) {
  const since = full ? 0 : S.meta.rev || 0;
  const res = await call(S.serverUrl, { action: 'pull', since, auth: S.session ? { u: S.session.username, t: S.session.token } : null, device: deviceLabel() }, 90000);
  await replaceFromServer('users', res.users || []);
  await replaceFromServer('kategori', res.kategori || []);
  await replaceFromServer('jenis', res.jenis || []);
  await replaceFromServer('sanksi', res.sanksi || []);
  S.settings = { ...S.settings, ...(res.settings || {}) };
  for (const o of S.outbox) if (o.table === 'pengaturan' && o.row) S.settings[o.row.kunci] = o.row.nilai; // perubahan lokal yang belum terkirim
  await saveSettings();
  S.meta.restricted = !!res.restricted;
  S.meta.salt = res.salt;
  S.meta.iter = res.iter;
  S.meta.server = res.server;
  S.meta.lastPull = Date.now();
  S.sync.authError = res.authError || (S.sync.authError.startsWith('Perubahan dari akun') ? S.sync.authError : '');
  if (res.me && S.session) { Object.assign(S.session, { nama: res.me.nama, peran: res.me.peran, kelasWali: res.me.kelasWali }); await db.kvSet('session', S.session); }
  S.anon = res.anon || null; // statistik tanpa identitas (hanya dikirim bila dasbor diatur "login")
  await db.kvSet('anon', S.anon);
  if (!res.restricted) {
    await replaceFromServer('siswa', res.siswa || []);
    let needFull = false;
    for (const t of ['pelanggaran', 'tindak']) {
      if (res.full) await replaceFromServer(t, res[t] || []);
      else {
        await mergeFromServer(t, res[t] || []);
        const synced = S.d[t].filter((r) => r._s).length;
        if (synced !== res[t + 'Count']) needFull = true;
      }
    }
    S.meta.rev = res.rev;
    await saveMeta();
    if (needFull) return pull(true);
  } else {
    await saveMeta();
  }
  return res;
}

/** Buang perubahan yang ditolak server; baris lokal dipulihkan dari server saat sinkron berikutnya. */
export async function discardFailed(opId) {
  const o = S.outbox.find((x) => x.opId === opId);
  if (!o) return;
  S.outbox.splice(S.outbox.indexOf(o), 1);
  await db.del('outbox', opId);
  if (o.table !== 'pengaturan' && o.row && !o.row._s) {
    const k = o.table === 'jenis' || o.table === 'kategori' || o.table === 'sanksi' ? 'kode' : 'id';
    const local = S.d[o.table]?.find((r) => String(r[k]) === o.key);
    if (local && !local._s) { S.d[o.table].splice(S.d[o.table].indexOf(local), 1); await db.del(o.table, o.key); }
  }
  bump();
  return syncNow({ full: true });
}

export async function retryFailed() {
  for (const o of S.outbox) if (o.failed) { o.failed = false; o.err = ''; await db.put('outbox', stripRuntime(o)); }
  bump();
  return syncNow();
}

/** Panggilan langsung (khusus online): kelola pengguna & ganti password. */
export async function callAuthed(action, extra = {}) {
  if (S.demo) throw new Error('Tidak tersedia di Mode Demo.');
  if (!S.session) throw new Error('Silakan login.');
  const res = await call(S.serverUrl, { action, auth: { u: S.session.username, t: S.session.token }, device: deviceLabel(), ...extra });
  if (res.users) { await replaceFromServer('users', res.users); bump(); }
  return res;
}
