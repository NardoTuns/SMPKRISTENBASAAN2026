// Login guru: pilih nama dari daftar, ketik password. Diperiksa di HP (offline) terhadap hash dari server;
// token tulis diturunkan dari password yang sama dan dicek ulang oleh server saat sinkron.
import * as db from './db.js';
import { S, bump, emit, stripRuntime } from './store.js';
import { deriveKey } from './core/sha256.js';

let fails = 0;
let lockUntil = 0;

export function loginLockedFor() { return Math.max(0, lockUntil - Date.now()); }

export async function login(username, password) {
  const wait = loginLockedFor();
  if (wait) throw new Error(`Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(wait / 1000)} detik.`);
  const u = S.d.users.find((x) => x.username === username);
  if (!u || !u.aktif) throw new Error('Akun tidak ditemukan atau tidak aktif.');
  if (!S.meta.salt) throw new Error('Data akun belum diunduh. Sambungkan ke internet lalu sinkronkan.');
  await new Promise((r) => setTimeout(r, 30)); // beri waktu tampilan "memeriksa…"
  const v = deriveKey('v', S.meta.salt, u.username, password, S.meta.iter);
  if (v !== u.v) {
    fails++;
    if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
    throw new Error('Password salah.');
  }
  fails = 0;
  const token = deriveKey('t', S.meta.salt, u.username, password, S.meta.iter);
  S.session = { username: u.username, nama: u.nama, peran: u.peran, kelasWali: u.kelasWali || '', token, at: Date.now() };
  await db.kvSet('session', S.session);
  // Perbarui token di antrean milik akun ini (mis. setelah password diganti) agar bisa terkirim lagi.
  for (const o of S.outbox) {
    if (o.by?.u === u.username && o.by.t !== token) { o.by = { u: u.username, t: token }; await db.put('outbox', stripRuntime(o)); }
  }
  if (S.sync.authBlocked) S.sync.authBlocked = S.sync.authBlocked.filter((x) => x !== u.username);
  S.sync.authError = '';
  bump();
  emit('session');
  return S.session;
}

export async function logout() {
  S.session = null;
  await db.kvDel('session');
  bump();
  emit('session');
}

/** Setelah ganti password berhasil di server: perbarui token sesi & antrean. */
export async function applyNewPassword(newPassword) {
  const u = S.session.username;
  const token = deriveKey('t', S.meta.salt, u, newPassword, S.meta.iter);
  S.session.token = token;
  await db.kvSet('session', S.session);
  for (const o of S.outbox) if (o.by?.u === u) { o.by.t = token; await db.put('outbox', stripRuntime(o)); }
}
