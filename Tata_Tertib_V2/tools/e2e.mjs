// Uji end-to-end di Chrome/Edge headless (layar HP) terhadap Code.gs tiruan (tools/gas-mock.mjs).
// Pakai: node tools/e2e.mjs [folder-screenshot]
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from './serve.mjs';
import { launchBrowser } from './cdp.mjs';
import { deriveKey } from '../js/core/sha256.js';

const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const ok = (m) => console.log('✔ ' + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = createServer({ blankServer: true });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const GAS = base + 'gas/exec';
const gas = srv.gas;
const sheet = (n) => gas.sheet(n).objects();

// ---- data awal di server: pengguna & siswa
const adminPw = sheet('Pengguna')[0].Password;
const salt = gas.post({ action: 'pull' }).salt;
const auth = (u, p) => ({ u, t: deriveKey('t', salt, u, p, 200) });
const admin = auth('admin', adminPw);
for (const u of [
  { username: 'ani', nama: 'Ani Lumowa, S.Pd', peran: 'Guru', password: 'guru1234' },
  { username: 'wali7a', nama: 'Yohana Wenas, S.Pd', peran: 'Wali Kelas', kelasWali: '7A', password: 'wali1234' },
  { username: 'gurubk', nama: 'Markus Supit, S.Pd', peran: 'Guru BK', password: 'bk123456' },
]) { const r = gas.post({ action: 'users.save', auth: admin, isNew: true, user: u }); assert.equal(r.ok, true, JSON.stringify(r)); }
const siswa = [['Budi Santoso', '7A', 'L'], ['Citra Mandagi', '7A', 'P'], ['Dodi Rumengan', '7B', 'L'], ['Eka Pontoh', '8A', 'P'], ['Fajar Kalangi', '9A', 'L']]
  .map(([nama, kelas, jk], i) => ({ id: 's' + (i + 1), nis: '2026' + String(i + 1).padStart(3, '0'), nama, kelas, jk, ortu: 'Ortu ' + nama.split(' ')[1], hpOrtu: '0812345678' + i }));
assert.equal(gas.post({ action: 'push', auth: admin, ops: siswa.map((s, i) => ({ id: 'o' + i, table: 'siswa', op: 'upsert', key: s.id, row: s })) }).ok, true);

async function phone(browser) {
  const p = await browser.newPage();
  await p.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
  await p.send('Network.enable');
  const h = {
    p,
    async click(text, sel = 'button', exact = false) {
      const cond = `[...document.querySelectorAll(${JSON.stringify(sel)})].filter((b) => b.getClientRects().length && !b.disabled && (${exact} ? b.textContent.trim() === ${JSON.stringify(text)} : b.textContent.includes(${JSON.stringify(text)})))`;
      await p.waitFor(`${cond}.length`, 8000);
      await p.eval(`(() => { const all = ${cond}; all[all.length - 1].click(); })()`);
    },
    async type(sel, value) {
      await p.waitFor(`document.querySelector(${JSON.stringify(sel)})`, 8000);
      await p.eval(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].pop(); el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    },
    st: (expr) => p.eval(`(() => { const { S, D } = window.__tatib; return (${expr}); })()`),
    async ready() { await p.waitFor('window.__tatib && window.__tatib.S.ready', 15000); },
    async idle() { await sleep(150); await p.waitFor('!window.__tatib.S.sync.running', 20000); await sleep(150); },
    async synced() { await p.waitFor('window.__tatib.S.outbox.length === 0 && !window.__tatib.S.sync.running', 20000); },
    async go(hash) { await p.eval(`location.hash = ${JSON.stringify(hash)}`); await sleep(350); },
    async shot(name) { if (shots) { await sleep(300); await p.screenshot(join(shots, name + '.png')); } },
    async offline(v) {
      srv.offline = v;
      await p.send('Network.emulateNetworkConditions', { offline: v, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await sleep(200);
    },
    noOverlay: () => p.waitFor('!document.querySelector(".scrim")', 8000),
  };
  return h;
}

async function connect(h) {
  await h.p.goto(base);
  await h.ready();
  await h.p.waitFor('document.body.textContent.includes("belum terhubung")', 8000);
  await h.go('#/akun');
  await h.type('input[type=url]', GAS);
  await h.click('Uji & simpan');
  await h.p.waitFor('window.__tatib.S.d.users.length === 4 && window.__tatib.S.d.siswa.length === 5', 20000);
  await h.idle();
}

async function login(h, nama, pw) {
  await h.go('#/login');
  await h.click(nama, '.user-pick');
  await h.type('input[type=password]', pw);
  await h.click('Masuk', 'form button[type=submit]');
  await h.p.waitFor('window.__tatib.S.session', 8000);
  await sleep(300);
}

async function catatRecord(h, siswaIds, jenisKode, lokasi, opts = {}) {
  // Langkah 1 terlewati karena siswa pertama sudah dipilih lewat ?siswa=…
  await h.go(`#/catat?siswa=${siswaIds[0]}&t=${Date.now()}`);
  await h.p.waitFor('document.querySelector(".wiz-step.on") && document.querySelector(".wiz-step.on").textContent.includes("Pelanggaran")', 8000);
  if (siswaIds.length > 1) {
    await h.click('Siswa', '.wiz-step');
    for (const id of siswaIds.slice(1)) {
      const nama = await h.st(`D().siswaMap.get(${JSON.stringify(id)}).nama`);
      await h.type('input[aria-label="Cari siswa"]', nama);
      await sleep(300);
      await h.click(nama, '.pick');
    }
    await h.click('Lanjut', '.form-footer button');
  }
  await h.p.waitFor('document.querySelectorAll(".pick.jenis").length > 10', 8000);
  await h.p.eval(`[...document.querySelectorAll('.pick.jenis')].find((b) => b.querySelector('.rule-no').textContent === ${JSON.stringify(jenisKode)}).click()`);
  if (opts.poin != null) await h.type('.sel-card input[type=number]', String(opts.poin));
  await h.click('Lanjut', '.form-footer button');
  await h.type('input[list=dl-lokasi]', lokasi);
  if (opts.tindakan) await h.type('input[list=dl-tindakan]', opts.tindakan);
  if (opts.pelapor) {
    await h.click('Kronologi, saksi', '.more-btn');
    await h.type('input[list=dl-siswa]', opts.pelapor);
  }
  await sleep(150);
  await h.click('Simpan', '.form-footer button', true);
  if (siswaIds.length > 1) await h.click('Simpan', '.dialog button', true);
  await h.p.waitFor('document.querySelector(".dialog") && document.querySelector(".dialog").textContent.includes("tercatat")', 8000);
}

const browserA = await launchBrowser({ width: 412, height: 860 });
const browserB = await launchBrowser({ width: 412, height: 860 });
let failed = false;
try {
  const A = await phone(browserA);
  await connect(A);
  assert.equal(await A.st('S.d.users.some((u) => "password" in u)'), false, 'password tidak pernah ada di HP');
  assert.equal(await A.st('S.d.jenis.length'), 45);
  await A.shot('01-tersambung');
  ok('HP A tersambung ke server: 4 akun (hanya hash), 5 siswa, 45 jenis pelanggaran diunduh');

  // ---- login guru & catat
  await A.go('#/login');
  await A.click('Ani Lumowa', '.user-pick');
  await A.type('input[type=password]', 'salah-sekali');
  await A.click('Masuk', 'form button[type=submit]');
  await A.p.waitFor('document.querySelector(".error-text").textContent.includes("salah")', 8000);
  assert.equal(await A.st('S.session'), null);
  await A.type('input[type=password]', 'guru1234');
  await A.click('Masuk', 'form button[type=submit]');
  await A.p.waitFor('window.__tatib.S.session && window.__tatib.S.session.username === "ani"', 8000);
  ok('login: password salah ditolak, password benar diterima (diperiksa di HP)');

  await catatRecord(A, ['s1'], '25', 'Ruang kelas', { tindakan: 'HP disita sementara', pelapor: 'Citra Mandagi' });
  await A.shot('02-tercatat');
  await A.click('Selesai', '.dialog button', true);
  await A.noOverlay();
  await A.synced();
  let rows = sheet('Catatan Pelanggaran');
  assert.equal(rows.length, 1);
  assert.equal(rows[0]['Dicatat Oleh'], 'ani');
  assert.equal(rows[0]['Nama Guru'], 'Ani Lumowa, S.Pd');
  assert.equal(rows[0]['Poin'], 20);
  assert.equal(rows[0]['Lokasi'], 'Ruang kelas');
  assert.equal(rows[0]['Tindakan Langsung'], 'HP disita sementara');
  assert.equal(rows[0]['Siswa Pelapor'], 'Citra Mandagi');
  assert.equal(await A.st('D().summaries.get("s1").level.kode'), 'LISAN');
  ok('catat 3 langkah (HP saat jam pelajaran, 20 poin, tindakan & pelapor) → tersimpan & terkirim; Budi masuk Peringatan Lisan');

  await catatRecord(A, ['s4'], '2', 'Gerbang sekolah', { poin: 8 });
  await A.click('Selesai', '.dialog button', true);
  await A.noOverlay();
  await A.synced();
  assert.equal(sheet('Catatan Pelanggaran').find((r) => r['ID Siswa'] === 's4').Poin, 8);
  ok('poin dapat disesuaikan saat mencatat (terlambat > 15 menit: bawaan 5 → 8 poin)');

  // ---- offline: catat 2 siswa sekaligus, muat ulang tanpa internet, lalu online
  await A.p.waitFor('navigator.serviceWorker.controller', 15000);
  await A.offline(true);
  await catatRecord(A, ['s1', 's2'], '7', 'Gerbang sekolah');
  await A.click('Selesai', '.dialog button', true);
  await A.noOverlay();
  assert.equal(await A.st('S.outbox.length'), 2);
  await A.p.goto(base + '?reload=1');
  await A.ready();
  assert.equal(await A.st('S.outbox.length'), 2);
  assert.equal(await A.st('S.d.pelanggaran.length'), 4);
  await A.p.waitFor('document.querySelector(".sync-chip").textContent.includes("Offline")', 5000);
  await A.shot('03-offline');
  ok('offline: 2 catatan (2 siswa × bolos) tersimpan di HP; aplikasi tetap terbuka setelah dimuat ulang tanpa internet');
  await A.offline(false);
  await A.p.eval('window.dispatchEvent(new Event("online"))');
  await A.synced();
  assert.equal(sheet('Catatan Pelanggaran').length, 4);
  assert.equal(await A.st('D().summaries.get("s1").total'), 40);
  assert.equal(await A.st('D().summaries.get("s1").level.kode'), 'SP1');
  ok('kembali online → antrean terkirim otomatis; Budi 40 poin = SP 1, data tetap ada di HP');

  // ---- ubah & batalkan catatan sendiri
  const recId = await A.st('S.d.pelanggaran.find((r) => r.siswaId === "s2").id');
  await A.go(`#/catat/ubah/${recId}`);
  await A.type('input[list=dl-lokasi]', 'Halaman sekolah');
  await A.click('Simpan perubahan', '.form-footer button');
  await A.click('Selesai', '.dialog button', true);
  await A.noOverlay();
  await A.synced();
  assert.equal(sheet('Catatan Pelanggaran').find((r) => r.ID === recId).Lokasi, 'Halaman sekolah');
  await A.go('#/siswa/s2');
  await A.click('Meninggalkan sekolah', '.row-item.rec');
  await A.click('Batalkan', '.sheet button');
  await A.type('.dialog textarea', 'Salah siswa, seharusnya Dodi');
  await A.click('Batalkan catatan', '.dialog button');
  await A.noOverlay();
  await A.synced();
  const batal = sheet('Catatan Pelanggaran').find((r) => r.ID === recId);
  assert.equal(batal.Dibatalkan, 'Ya');
  assert.equal(batal['Alasan Pembatalan'], 'Salah siswa, seharusnya Dodi');
  assert.equal(await A.st('D().summaries.get("s2").total'), 0);
  ok('guru mengubah lokasi & membatalkan catatannya (dengan alasan) → tersinkron; poin Citra kembali 0, riwayat tetap ada');

  // ---- cetak BAP
  await A.p.eval('window.print = () => { window.__printed = (window.__printed || 0) + 1; }');
  await A.go('#/siswa/s1');
  await A.click('Bermain smartphone', '.row-item.rec');
  await A.click('BAP', '.sheet button');
  await A.p.waitFor('document.querySelector(".doc-preview")', 5000);
  assert.match(await A.p.eval('[...document.querySelectorAll(".sheet")].pop().textContent'), /Ortu Santoso \(08123456780\)/, 'penerima WA = orang tua');
  await A.shot('04-dokumen');
  await A.click('Cetak', '.doc-actions button');
  await A.p.waitFor('window.__printed === 1', 5000);
  const bap = await A.p.eval('document.getElementById("print-root").textContent');
  assert.match(bap, /Berita Acara Pemeriksaan/i);
  assert.match(bap, /Budi Santoso/);
  assert.match(bap, /Citra Mandagi/);
  await A.click('Unduh PDF', '.doc-actions button');
  await A.p.waitFor('window.__lastExport && window.__lastExport.type === "application/pdf"', 30000);
  assert.equal(await A.p.eval('window.__lastExport.blob.slice(0, 5).text()'), '%PDF-');
  assert.match(await A.p.eval('window.__lastExport.name'), /^BAP-Budi-Santoso-/);
  await A.p.eval('history.back()');
  await A.p.eval('history.back()');
  await A.noOverlay();
  ok('BAP: lembar dokumen (penerima WA = orang tua), cetak & unduh PDF berhasil');

  // ---- HP B: wali kelas memproses tindak lanjut (login offline)
  const B = await phone(browserB);
  await connect(B);
  assert.equal(await B.st('S.d.pelanggaran.filter((r) => !r.batal).length'), 3);
  assert.equal(await B.st('S.d.pelanggaran.find((r) => r.jenisKode === "25").pelapor'), undefined, 'tanpa login: nama pelapor tidak diunduh');
  await B.offline(true);
  await login(B, 'Yohana Wenas', 'wali1234');
  assert.equal(await B.st('S.session.username'), 'wali7a');
  await B.offline(false);
  await B.p.eval('window.__tatib.syncNow({ full: true })');
  await B.idle();
  assert.equal(await B.st('S.d.pelanggaran.find((r) => r.jenisKode === "25").pelapor'), 'Citra Mandagi', 'setelah login: data lengkap');
  ok('HP B: data dari HP A terlihat; nama pelapor hanya diunduh setelah login; wali kelas login tanpa internet');
  await B.go('#/tindak');
  await B.p.waitFor('document.querySelectorAll(".row-item").length >= 2', 8000);
  await B.shot('04-tindak');
  await B.click('SP 1', '.row-item');
  await B.click('Simpan', '.sheet button', true);
  await B.noOverlay();
  await B.synced();
  const tl = sheet('Tindak Lanjut');
  assert.equal(tl.length, 1);
  assert.equal(tl[0].Status, 'Selesai');
  assert.equal(tl[0]['Kode Tahap'], 'SP1');
  assert.match(tl[0]['Nomor Surat'], /^001\/SP1\/SMPKB\/X\/2026$/);
  ok('wali kelas 7A memproses SP 1 Budi (nomor surat otomatis 001/SP1/SMPKB/X/2026) → tersimpan di sheet Tindak Lanjut');

  // ---- admin: tambah jenis pelanggaran → HP A menerimanya
  await B.go('#/akun');
  await B.click('Keluar', 'button');
  await login(B, 'Administrator', adminPw);
  await B.go('#/kelola/jenis');
  await B.click('Tambah jenis');
  await B.type('.sheet textarea', 'Membawa petasan atau kembang api ke sekolah.');
  await B.p.eval(`(() => { const sel = document.querySelectorAll('.sheet select'); sel[0].value = 'F'; sel[0].dispatchEvent(new Event('change')); sel[1].value = 'Berat'; sel[1].dispatchEvent(new Event('change')); })()`);
  await B.p.eval(`(() => { const n = document.querySelectorAll('.sheet input[type=number]'); n[0].value = '60'; n[0].dispatchEvent(new Event('input')); })()`);
  await B.click('Simpan', '.sheet button', true);
  await B.noOverlay();
  await B.synced();
  const j46 = sheet('Jenis Pelanggaran').find((r) => r.Kode === '46');
  assert.equal(j46.Poin, 60);
  assert.equal(j46.Tingkat, 'Berat');
  await A.p.eval('window.__tatib.syncNow()');
  await A.idle();
  assert.equal(await A.st('D().jenisMap.get("46").uraian'), 'Membawa petasan atau kembang api ke sekolah.');
  ok('admin menambah jenis pelanggaran baru (46, 60 poin, Berat) → tersimpan di sheet & muncul di HP A');

  // ---- edit langsung di spreadsheet → ikut ke HP (onEdit menaikkan _rev)
  const shP = gas.sheet('Catatan Pelanggaran');
  const head = shP.rows[0];
  const rIdx = shP.rows.findIndex((r, i) => i > 0 && r[head.indexOf('Kode Pelanggaran')] === '25');
  shP.rows[rIdx][head.indexOf('Saksi')] = 'Pak Kepala Sekolah';
  gas.onEdit({ range: shP.getRange(rIdx + 1, head.indexOf('Saksi') + 1, 1, 1) });
  await A.p.eval('window.__tatib.syncNow()');
  await A.idle();
  assert.equal(await A.st('S.d.pelanggaran.find((r) => r.jenisKode === "25").saksi'), 'Pak Kepala Sekolah');
  ok('isian yang diubah langsung di Google Sheets ikut tersinkron ke HP');

  // ---- password guru diganti admin → antrean HP A tertahan → login ulang → terkirim
  await A.offline(true);
  await catatRecord(A, ['s3'], '1', 'Gerbang sekolah');
  await A.click('Selesai', '.dialog button', true);
  await A.noOverlay();
  assert.equal(gas.post({ action: 'users.save', auth: admin, isNew: false, user: { username: 'ani', nama: 'Ani Lumowa, S.Pd', peran: 'Guru', password: 'baru5678' } }).ok, true);
  await A.offline(false);
  await A.p.eval('window.__tatib.syncNow()');
  await A.idle();
  assert.equal(await A.st('S.outbox.length'), 1);
  assert.match(await A.st('S.sync.authError'), /login ulang/i);
  await A.p.waitFor('document.querySelector(".banner.warn")', 5000);
  await A.shot('05-perlu-login-ulang');
  await A.go('#/akun');
  await A.click('Keluar', 'button');
  await A.p.waitFor('document.querySelector(".dialog")', 3000).then(() => A.click('Keluar', '.dialog button'), () => {});
  await login(A, 'Ani Lumowa', 'baru5678');
  await A.p.eval('window.__tatib.syncNow()');
  await A.synced();
  assert.equal(sheet('Catatan Pelanggaran').length, 5);
  ok('password diganti di server: catatan offline tertahan (tidak hilang) → setelah login ulang langsung terkirim');

  // ---- laporan: unduh PNG & PDF
  await A.go('#/laporan?jenis=siswa');
  await A.click('Unduh PNG', '.export-bar button');
  await A.p.waitFor('window.__lastExport && window.__lastExport.type === "image/png"', 30000);
  assert.ok(await A.p.eval('window.__lastExport.size') > 20000);
  await A.click('Unduh PDF', '.export-bar button');
  await A.p.waitFor('window.__lastExport && window.__lastExport.type === "application/pdf" && window.__lastExport.name.startsWith("Rekap")', 30000);
  ok('laporan: unduh PNG & PDF berhasil (tombol Kirim WA memakai berkas yang sama)');

  // ---- Halaman Siswa & Orang Tua: tanpa nama di daftar, cek anak dengan NIS
  await A.p.goto(base + 'DashboardSiswa.html');
  await A.p.waitFor('window.__siswa && document.querySelector(".ds-hero")', 15000);
  assert.match(await A.p.eval('document.getElementById("view").textContent'), /Siswa tanpa pelanggaran/);
  await A.p.eval(`location.hash = '#kelas/7A'`);
  await A.p.waitFor('document.querySelector(".ds-tiles")', 5000);
  assert.equal((await A.p.eval('document.getElementById("view").textContent')).includes('Budi Santoso'), false, 'nama siswa tidak ditampilkan di rekap kelas');
  await A.p.eval(`location.hash = '#anak'`);
  await A.type('input[aria-label="NIS atau NISN"]', '2026001');
  await A.p.eval('document.querySelector(".ds-search").requestSubmit()');
  await A.p.waitFor('document.querySelector(".ds-kid")', 8000);
  const kid = await A.p.eval('document.querySelector(".ds-kid").textContent');
  assert.match(kid, /Budi Santoso/);
  assert.match(kid, /40/);
  assert.equal((await A.p.eval('document.getElementById("view").textContent')).includes('Citra Mandagi'), false, 'nama pelapor tidak tampil');
  await A.click('Simpan sebagai', '.ds-kid button');
  await A.shot('07-dashboard-siswa');
  ok('DashboardSiswa: ringkasan sekolah & kelas tanpa nama siswa; orang tua cek anak dengan NIS (40 poin, SP 1)');

  // ---- mode "dasbor khusus login": orang tua di HP lain tetap bisa cek anak lewat server (data lain anonim)
  assert.equal(gas.post({ action: 'push', auth: admin, ops: [{ id: 'm', table: 'pengaturan', op: 'upsert', key: 'aksesDashboard', row: { kunci: 'aksesDashboard', nilai: 'login' } }] }).results[0].ok, true);
  const browserC = await launchBrowser({ width: 412, height: 860 });
  try {
    const C = await phone(browserC);
    await C.p.goto(base + 'DashboardSiswa.html');
    await C.p.waitFor('window.__siswa', 15000);
    await C.p.eval(`(async () => { const db = await import('/js/db.js'); await db.kvSet('serverUrl', ${JSON.stringify(GAS)}); })()`);
    await C.p.goto(base + 'DashboardSiswa.html?c=2');
    await C.p.waitFor('window.__siswa && window.__siswa.data().mode === "anon"', 20000);
    assert.equal(await C.p.eval('window.__siswa.S.d.siswa.length'), 0, 'tanpa data bernama di HP');
    await C.p.waitFor('document.querySelector(".ds-tiles")', 8000);
    await C.p.eval(`location.hash = '#anak/2026002'`);
    await C.p.waitFor('document.querySelector(".ds-kid")', 10000);
    assert.match(await C.p.eval('document.querySelector(".ds-kid").textContent'), /Citra Mandagi/);
    assert.deepEqual(C.p.errors, []);
  } finally {
    await browserC.close();
  }
  assert.equal(gas.post({ action: 'push', auth: admin, ops: [{ id: 'm2', table: 'pengaturan', op: 'upsert', key: 'aksesDashboard', row: { kunci: 'aksesDashboard', nilai: 'publik' } }] }).results[0].ok, true);
  ok('akses dasbor "login": HP orang tua hanya menerima statistik anonim, cek NIS lewat server tetap berfungsi');
  await A.p.goto(base + '?kembali=1');
  await A.ready();

  // ---- wewenang: guru biasa tidak bisa membuka Kelola; server menolak walau dipaksa
  await A.go('#/kelola');
  assert.match(await A.p.eval('document.getElementById("view").textContent'), /Tidak ada akses/);
  const forced = gas.post({ action: 'push', auth: auth('ani', 'baru5678'), ops: [{ id: 'x', table: 'jenis', op: 'upsert', key: '1', row: { kode: '1', kategori: 'A', uraian: 'X', poin: 0, tingkat: 'Ringan' } }] });
  assert.equal(forced.results[0].code, 'FORBIDDEN');
  ok('guru tidak bisa mengubah aturan (menu tersembunyi & ditolak server)');

  // ---- tombol Update: rilis baru terdeteksi → Perbarui → aplikasi dimuat ulang dengan service worker baru
  const swSrc = (await import('node:fs')).readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  srv.overrides.set('version.json', JSON.stringify({ version: '9.9.9', notes: ['uji'] }));
  srv.overrides.set('sw.js', swSrc.replace(/const CACHE = '[^']*';/, "const CACHE = 'tatib-9.9.9-uji';"));
  await A.p.eval('window.__beforeUpdate = true');
  await A.shot('08-sebelum-update');
  await A.click('Update', '.update-btn');
  await A.p.waitFor('!window.__beforeUpdate && window.__tatib && window.__tatib.S.ready', 40000);
  assert.ok((await A.p.eval('caches.keys()')).includes('tatib-9.9.9-uji'));
  assert.equal(await A.st('S.session.username'), 'ani', 'tetap login setelah pembaruan');
  ok('tombol Update di bilah atas: data disinkronkan, versi baru diunduh & dipasang, aplikasi dimuat ulang; sesi & data tetap');

  assert.deepEqual(A.p.errors, [], 'tidak ada error JS di HP A');
  assert.deepEqual(B.p.errors, [], 'tidak ada error JS di HP B');
  ok('tanpa error JavaScript di kedua HP');
} catch (e) {
  failed = true;
  console.error('✘', e);
} finally {
  await browserA.close();
  await browserB.close();
  await srv.closeNow();
}
process.exit(failed ? 1 : 0);
