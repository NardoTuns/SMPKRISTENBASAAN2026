// Uji apps-script/Code.gs lewat tiruan Apps Script (tools/gas-mock.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv } from '../tools/gas-mock.mjs';
import { deriveKey } from '../js/core/sha256.js';
import { DEFAULT_JENIS, DEFAULT_KATEGORI, DEFAULT_SANKSI, DEFAULT_SETTINGS } from '../js/core/rules.js';

function fresh() {
  const env = makeEnv();
  env.setup();
  const pw = env.sheet('Pengguna').objects()[0].Password;
  const pull = env.post({ action: 'pull' });
  const auth = (u, p) => ({ u, t: deriveKey('t', pull.salt, u, p, pull.iter) });
  return { env, pw, pull, admin: auth('admin', pw), auth };
}
const ok = (res) => { assert.equal(res.ok, true, JSON.stringify(res)); return res; };
const rec = (o = {}) => ({
  id: 'p1', tanggal: '2026-10-26', jam: '07:20', siswaId: 's1', nis: '1001', nama: 'Budi', kelas: '7A', jenisKode: '7',
  uraian: 'Bolos', kategori: 'A', tingkat: 'Ringan', poin: 20, createdAt: '2026-10-26 07:21:00', batal: false, ...o,
});
const push = (env, auth, ops) => env.post({ action: 'push', auth, device: 'uji', ops: ops.map((o, i) => ({ id: 'op' + i, op: 'upsert', key: o.row?.id || o.row?.kode || o.key, ...o })) });

test('setup membuat sheet, aturan bawaan identik dengan rules.js, dan admin', () => {
  const { env, pw, pull } = fresh();
  for (const n of ['Pengguna', 'Pengaturan', 'Kategori', 'Jenis Pelanggaran', 'Tahap Sanksi', 'Siswa', 'Catatan Pelanggaran', 'Tindak Lanjut', 'Log Aktivitas', 'Rekap Poin Siswa']) assert.ok(env.sheet(n), n);
  assert.match(pw, /^krisba\d{4}$/);
  assert.deepEqual(pull.kategori.map(({ kode, nama, urutan, aktif }) => ({ kode, nama, urutan, aktif })), DEFAULT_KATEGORI);
  assert.deepEqual(pull.jenis.map(({ kode, kategori, uraian, poin, poinMaks, tingkat, zt, aktif, urutan }) => ({ kode, kategori, uraian, poin, poinMaks, tingkat, zt, aktif, urutan })), DEFAULT_JENIS);
  assert.deepEqual(pull.sanksi.map(({ kode, min, label, tindakan, pj, surat, warna }) => ({ kode, min, label, tindakan, pj, surat, warna })), DEFAULT_SANKSI);
  for (const k of Object.keys(DEFAULT_SETTINGS)) assert.ok(k in pull.settings, k);
  assert.equal(pull.settings.tahunAjaran, '2026/2027');
  // setup kedua tidak menggandakan data
  env.setup();
  assert.equal(env.post({ action: 'pull' }).jenis.length, 45);
  assert.equal(env.sheet('Pengguna').objects().length, 1);
  assert.match(env.sheet('Rekap Poin Siswa').rows[2][0], /^=IFERROR\(QUERY\('Catatan Pelanggaran'!A:/);
});

test('pull publik: tanpa password, verifier cocok dengan turunan di HP', () => {
  const { pw, pull } = fresh();
  assert.equal(pull.users.length, 1);
  const u = pull.users[0];
  assert.equal(u.password, undefined);
  assert.equal(u.v, deriveKey('v', pull.salt, 'admin', pw, pull.iter));
  assert.notEqual(u.v, deriveKey('t', pull.salt, 'admin', pw, pull.iter));
  assert.equal(pull.restricted, false);
  assert.deepEqual(pull.pelanggaran, []);
  assert.equal(pull.full, true);
});

test('cache turunan password: pull berikutnya tidak menghitung ulang 200 putaran', () => {
  const { env } = fresh();
  const before = env.counters.digest;
  env.post({ action: 'pull' });
  assert.ok(env.counters.digest - before < 5, `digest dihitung ${env.counters.digest - before}x`);
});

test('push ditolak tanpa token yang benar', () => {
  const { env, pull, auth } = fresh();
  const r = push(env, auth('admin', 'salah'), [{ table: 'siswa', row: { id: 's1', nama: 'Budi', kelas: '7A' } }]);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AUTH');
  const r2 = env.post({ action: 'push', ops: [] });
  assert.equal(r2.code, 'AUTH');
  assert.equal(pull.users[0].username, 'admin');
});

test('alur lengkap: admin buat guru & siswa, guru mencatat, sinkron inkremental', () => {
  const { env, admin, auth } = fresh();
  ok(env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'Bu.Ani', nama: 'Ani S.Pd', peran: 'guru', password: 'rahasia1' } }));
  ok(env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'wali7a', nama: 'Wali 7A', peran: 'Wali Kelas', kelasWali: '7A', password: 'rahasia2' } }));
  const users = env.post({ action: 'pull' }).users;
  assert.deepEqual(users.map((u) => u.username).sort(), ['admin', 'bu.ani', 'wali7a']);
  assert.equal(users.find((u) => u.username === 'bu.ani').peran, 'Guru');

  const r1 = ok(push(env, admin, [
    { table: 'siswa', row: { id: 's1', nis: '0012', nama: 'Budi', kelas: '7A', jk: 'laki-laki' } },
    { table: 'siswa', row: { id: 's2', nis: '0013', nama: 'Citra', kelas: '8B', jk: 'P' } },
  ]));
  assert.ok(r1.results.every((x) => x.ok));
  assert.equal(r1.results[0].row.jk, 'L');
  assert.equal(r1.results[0].row.status, 'Aktif');
  assert.equal(env.sheet('Siswa').objects()[0].NIS, '0012');

  const ani = auth('bu.ani', 'rahasia1');
  const p0 = env.post({ action: 'pull' });
  env.tick(60000);
  const r2 = ok(push(env, ani, [{ table: 'pelanggaran', row: rec() }]));
  assert.equal(r2.results[0].ok, true, JSON.stringify(r2.results[0]));
  const saved = r2.results[0].row;
  assert.equal(saved.guru, 'bu.ani');
  assert.equal(saved.guruNama, 'Ani S.Pd');
  assert.ok(saved._rev > p0.rev);
  const sheetRow = env.sheet('Catatan Pelanggaran').objects()[0];
  assert.equal(sheetRow['Dibatalkan'], 'Tidak');
  assert.equal(sheetRow['Poin'], 20);

  const inc = env.post({ action: 'pull', since: p0.rev + 10 * 60000 });
  assert.equal(inc.full, false);
  assert.equal(inc.pelanggaranCount, 1);
  assert.equal(inc.pelanggaran.length, 0, 'catatan lama tidak dikirim ulang');
  const inc2 = env.post({ action: 'pull', since: p0.rev });
  assert.equal(inc2.pelanggaran.length, 1);

  // Guru biasa tidak boleh mengubah data siswa / aturan
  const r3 = push(env, ani, [{ table: 'siswa', row: { id: 's3', nama: 'X', kelas: '7A' } }, { table: 'jenis', row: { kode: '46', kategori: 'A', uraian: 'Baru', poin: 5, tingkat: 'Ringan' } }]);
  assert.deepEqual(r3.results.map((x) => x.code), ['FORBIDDEN', 'FORBIDDEN']);

  const log = env.sheet('Log Aktivitas').objects();
  assert.ok(log.some((l) => l.Aksi === 'Catat pelanggaran' && l.Pengguna === 'bu.ani'));
});

test('koreksi catatan: pencatat dalam batas jam, BK kapan saja, hapus selalu ditolak', () => {
  const { env, admin, auth } = fresh();
  ok(env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'ani', nama: 'Ani', peran: 'Guru', password: 'pw1234' } }));
  ok(env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'budi', nama: 'Pak Budi', peran: 'Guru', password: 'pw1234' } }));
  ok(env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'gurubk', nama: 'Guru BK', peran: 'Guru BK', password: 'pw1234' } }));
  const ani = auth('ani', 'pw1234'), budi = auth('budi', 'pw1234'), bk = auth('gurubk', 'pw1234');
  ok(push(env, ani, [{ table: 'pelanggaran', row: rec({ createdAt: '2026-10-26 08:00:00' }) }]));

  let r = push(env, budi, [{ table: 'pelanggaran', row: rec({ poin: 2 }) }]);
  assert.equal(r.results[0].code, 'FORBIDDEN', 'guru lain tidak boleh mengubah');

  r = push(env, ani, [{ table: 'pelanggaran', row: rec({ batal: true }) }]);
  assert.equal(r.results[0].code, 'VALIDATION', 'alasan batal wajib');
  r = ok(push(env, ani, [{ table: 'pelanggaran', row: rec({ poin: 5, guru: 'budi', createdAt: '2026-01-01 00:00:00' }) }]));
  assert.equal(r.results[0].row.guru, 'ani', 'pencatat & waktu dibuat tidak bisa dipalsukan');
  assert.equal(r.results[0].row.createdAt, '2026-10-26 08:00:00');

  env.tick(30 * 3600000);
  r = push(env, ani, [{ table: 'pelanggaran', row: rec({ poin: 2 }) }]);
  assert.equal(r.results[0].code, 'FORBIDDEN', 'lewat batas 24 jam');
  r = ok(push(env, bk, [{ table: 'pelanggaran', row: rec({ batal: true, alasanBatal: 'Salah siswa' }) }]));
  assert.equal(r.results[0].row.batal, true);
  assert.equal(env.sheet('Catatan Pelanggaran').objects()[0]['Alasan Pembatalan'], 'Salah siswa');

  r = env.post({ action: 'push', auth: bk, ops: [{ id: 'd', table: 'pelanggaran', op: 'delete', key: 'p1' }] });
  assert.equal(r.results[0].code, 'FORBIDDEN');
  assert.equal(env.sheet('Catatan Pelanggaran').objects().length, 1);
});

test('aturan: tambah, ubah, zero tolerance, nonaktif, hapus hanya bila belum dipakai', () => {
  const { env, admin } = fresh();
  let r = ok(push(env, admin, [{ table: 'jenis', row: { kode: '46', kategori: 'F', uraian: 'Membawa petasan', poin: 50, tingkat: 'Berat', zt: true, aktif: true, urutan: 46 } }]));
  assert.equal(r.results[0].row.poin, 100, 'zero tolerance = langsung 100');
  r = push(env, admin, [{ table: 'jenis', row: { kode: '47', kategori: 'A', uraian: 'X', poin: 10, poinMaks: 5, tingkat: 'Ringan' } }]);
  assert.equal(r.results[0].code, 'VALIDATION');
  r = push(env, admin, [{ table: 'jenis', row: { kode: '47', kategori: 'A', uraian: 'X', poin: 10, tingkat: 'Parah' } }]);
  assert.equal(r.results[0].code, 'VALIDATION');

  ok(push(env, admin, [{ table: 'siswa', row: { id: 's1', nama: 'Budi', kelas: '7A' } }, { table: 'pelanggaran', row: rec() }]));
  r = env.post({ action: 'push', auth: admin, ops: [{ id: 'a', table: 'jenis', op: 'delete', key: '7' }, { id: 'b', table: 'jenis', op: 'delete', key: '46' }] });
  assert.equal(r.results.find((x) => x.id === 'a').code, 'VALIDATION', 'jenis 7 sudah dipakai');
  assert.equal(r.results.find((x) => x.id === 'b').ok, true);
  const pull = env.post({ action: 'pull' });
  assert.equal(pull.jenis.length, 45);
  r = env.post({ action: 'push', auth: admin, ops: [{ id: 'c', table: 'kategori', op: 'delete', key: 'A' }] });
  assert.equal(r.results[0].code, 'VALIDATION');
  r = env.post({ action: 'push', auth: admin, ops: [{ id: 'c', table: 'siswa', op: 'delete', key: 's1' }] });
  assert.equal(r.results[0].code, 'VALIDATION', 'siswa dengan catatan tidak bisa dihapus');

  const j7 = pull.jenis.find((j) => j.kode === '7');
  ok(push(env, admin, [{ table: 'jenis', row: { ...j7, aktif: false, poin: 25 } }]));
  const j7b = env.post({ action: 'pull' }).jenis.find((j) => j.kode === '7');
  assert.equal(j7b.aktif, false);
  assert.equal(j7b.poin, 25);
  assert.equal(env.post({ action: 'pull' }).pelanggaran[0].poin, 20, 'catatan lama tetap memakai poin saat dicatat');
});

test('tindak lanjut: wali kelas hanya untuk kelasnya (kelas diambil dari data siswa)', () => {
  const { env, admin, auth } = fresh();
  ok(env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'wali', nama: 'Wali', peran: 'Wali Kelas', kelasWali: '7A, 7B', password: 'pw1234' } }));
  ok(push(env, admin, [{ table: 'siswa', row: { id: 's1', nama: 'Budi', kelas: '7A' } }, { table: 'siswa', row: { id: 's2', nama: 'Citra', kelas: '9A' } }]));
  const wali = auth('wali', 'pw1234');
  const t = (sid, kelas) => ({ table: 'tindak', row: { id: `${sid}__SP1`, siswaId: sid, nama: 'x', kelas, tahap: 'SP1', tahapLabel: 'SP 1', poinSaat: 30, tanggalCapai: '2026-10-20', status: 'Selesai', tanggalPelaksanaan: '2026-10-26', nomorSurat: '001/SP1/X/2026' } });
  let r = ok(push(env, wali, [t('s1', '7A')]));
  assert.equal(r.results[0].ok, true);
  assert.equal(r.results[0].row.petugas, 'Wali');
  r = push(env, wali, [t('s2', '7A')]);
  assert.equal(r.results[0].code, 'FORBIDDEN', 'kelas palsu ditolak');
  r = push(env, wali, [{ table: 'tindak', row: { ...t('s1', '7A').row, status: 'Beres' } }]);
  assert.equal(r.results[0].code, 'VALIDATION');
});

test('pengguna: ganti password membatalkan token lama; admin terakhir dilindungi', () => {
  const { env, admin, auth, pw } = fresh();
  let r = env.post({ action: 'users.save', auth: admin, isNew: false, user: { username: 'admin', nama: 'Admin', peran: 'Guru' } });
  assert.equal(r.code, 'VALIDATION');
  r = env.post({ action: 'users.save', auth: admin, isNew: true, user: { username: 'ab', nama: 'X', peran: 'Guru', password: '1234' } });
  assert.match(r.error, /Username/);
  r = env.post({ action: 'password', auth: admin, newPassword: '123' });
  assert.equal(r.code, 'VALIDATION');
  ok(env.post({ action: 'password', auth: admin, newPassword: 'barubaru' }));
  r = push(env, admin, []);
  assert.equal(r.code, 'AUTH', 'token lama tidak berlaku');
  const p = env.post({ action: 'pull', auth: admin });
  assert.match(p.authError, /login ulang/);
  ok(push(env, auth('admin', 'barubaru'), []));
  assert.notEqual(pw, 'barubaru');
  const list = ok(env.post({ action: 'users.list', auth: auth('admin', 'barubaru') })).users;
  assert.equal(list[0].hasPassword, true);
  assert.equal(list[0].password, undefined);
});

test('baris yang diketik manual di sheet: diberi ID, tanggal Date dinormalkan, onEdit menaikkan _rev', () => {
  const { env, admin } = fresh();
  ok(push(env, admin, [{ table: 'siswa', row: { id: 's1', nama: 'Budi', kelas: '7A' } }, { table: 'pelanggaran', row: rec() }]));
  const sh = env.sheet('Catatan Pelanggaran');
  const head = sh.rows[0];
  const row = head.map(() => '');
  const set = (h, v) => { row[head.indexOf(h)] = v; };
  set('Tanggal', { ymd: [2026, 9, 25] }); set('Jam', '7.05'); set('ID Siswa', 's1'); set('Nama Siswa', 'Budi'); set('Kelas', '7A');
  set('Kode Pelanggaran', '1'); set('Bentuk Pelanggaran', 'Terlambat'); set('Poin', 2); set('Tingkat', 'Ringan');
  sh.rows.push(row.map((v) => (v && v.ymd ? new Date(...v.ymd) : v)));
  sh.rows[2][head.indexOf('Tanggal')] = env.run('new Date(2026, 9, 25)');
  const p = env.post({ action: 'pull' });
  assert.equal(p.pelanggaran.length, 2);
  const manual = p.pelanggaran.find((r) => r.id !== 'p1');
  assert.match(manual.id, /^p/);
  assert.equal(manual.tanggal, '2026-10-25');
  assert.equal(manual.jam, '07:05');
  assert.equal(manual.batal, false);
  assert.ok(sh.objects()[1].ID, 'ID ditulis kembali ke sheet');

  const revCol = head.indexOf('_rev') + 1;
  sh.rows[1][revCol - 1] = 5;
  env.onEdit({ range: sh.getRange(2, head.indexOf('Poin') + 1, 1, 1) });
  assert.ok(sh.rows[1][revCol - 1] > 1e12, '_rev diperbarui');
});

test('akses dasbor "login": tamu hanya menerima aturan & daftar pengguna', () => {
  const { env, admin } = fresh();
  ok(push(env, admin, [{ table: 'pengaturan', row: { kunci: 'aksesDashboard', nilai: 'login' } }, { table: 'siswa', row: { id: 's1', nama: 'Budi', kelas: '7A' } }]));
  const guest = env.post({ action: 'pull' });
  assert.equal(guest.restricted, true);
  assert.equal(guest.siswa, undefined);
  assert.equal(guest.pelanggaran, undefined);
  assert.equal(guest.jenis.length, 45);
  const me = env.post({ action: 'pull', auth: admin });
  assert.equal(me.restricted, false);
  assert.equal(me.siswa.length, 1);
  assert.equal(me.me.peran, 'Admin');
  assert.equal(env.sheet('Pengaturan').objects().find((r) => r.Kunci === 'aksesDashboard').Keterangan.length > 5, true);
});

test('tanpa login: pelapor, saksi, kronologi tidak dikirim; dengan login lengkap', () => {
  const { env, admin } = fresh();
  ok(push(env, admin, [{ table: 'siswa', row: { id: 's1', nis: '2026001', nama: 'Budi', kelas: '7A' } },
    { table: 'pelanggaran', row: rec({ pelapor: 'Citra', saksi: 'Pak Guru', kronologi: 'Kejadian di kelas', lokasi: 'Ruang kelas' }) }]));
  const pub = env.post({ action: 'pull' }).pelanggaran[0];
  assert.equal(pub.pelapor, undefined);
  assert.equal(pub.saksi, undefined);
  assert.equal(pub.kronologi, undefined);
  assert.equal(pub.lokasi, 'Ruang kelas');
  const priv = env.post({ action: 'pull', auth: admin }).pelanggaran[0];
  assert.equal(priv.pelapor, 'Citra');
  assert.equal(priv.kronologi, 'Kejadian di kelas');
});

test('cek siswa dengan NIS/NISN (halaman orang tua) & data anonim saat dasbor khusus login', () => {
  const { env, admin } = fresh();
  ok(push(env, admin, [
    { table: 'siswa', row: { id: 's1', nis: '2026001', nisn: '0091234567', nama: 'Budi', kelas: '7A' } },
    { table: 'siswa', row: { id: 's2', nis: '2026002', nama: 'Citra', kelas: '7A' } },
    { table: 'pelanggaran', row: rec({ pelapor: 'Citra' }) },
    { table: 'pelanggaran', row: rec({ id: 'p2', batal: true, alasanBatal: 'salah' }) },
  ]));
  let r = ok(env.post({ action: 'cekSiswa', nis: '2026001' }));
  assert.equal(r.siswa.nama, 'Budi');
  assert.equal(r.pelanggaran.length, 1, 'catatan batal tidak ikut');
  assert.equal(r.pelanggaran[0].pelapor, undefined);
  assert.equal(ok(env.post({ action: 'cekSiswa', nis: '0091 234 567' })).siswa.id, 's1', 'NISN (spasi diabaikan)');
  assert.equal(env.post({ action: 'cekSiswa', nis: '999999' }).code, 'NOT_FOUND');
  assert.equal(env.post({ action: 'cekSiswa', nis: '1' }).code, 'VALIDATION');

  ok(push(env, admin, [{ table: 'pengaturan', row: { kunci: 'aksesDashboard', nilai: 'login' } }]));
  const g = env.post({ action: 'pull' });
  assert.equal(g.restricted, true);
  assert.equal(g.anon.siswa.length, 2);
  assert.equal(g.anon.pelanggaran.length, 1);
  assert.equal(JSON.stringify(g.anon).includes('Budi'), false, 'tanpa nama');
  assert.equal(JSON.stringify(g.anon).includes('2026001'), false, 'tanpa NIS');
  assert.ok(g.anon.siswa.some((s) => s.id === g.anon.pelanggaran[0].siswaId), 'tetap bisa dihitung per siswa');
  assert.equal(env.post({ action: 'pull', auth: admin }).anon, undefined);
  assert.equal(g.settings.dashboardSiswa, 'nis');
});

test('setup ulang menambah pengaturan baru tanpa mengubah isian lama', () => {
  const { env, admin } = fresh();
  ok(push(env, admin, [{ table: 'pengaturan', row: { kunci: 'kota', nilai: 'Ratatotok' } }]));
  const sh = env.sheet('Pengaturan');
  sh.rows = sh.rows.filter((r) => r[0] !== 'waSekolah');
  env.setup();
  const rows = sh.objects();
  assert.ok(rows.some((r) => r.Kunci === 'waSekolah'));
  assert.equal(rows.find((r) => r.Kunci === 'kota').Nilai, 'Ratatotok');
});

test('impor massal > 15 baris memakai satu penulisan blok', () => {
  const { env, admin } = fresh();
  const ops = [];
  for (let i = 0; i < 40; i++) ops.push({ table: 'siswa', row: { id: 's' + i, nama: 'Siswa ' + i, kelas: '7A' } });
  ok(push(env, admin, ops));
  const sh = env.sheet('Siswa');
  const w0 = sh.writes;
  ok(push(env, admin, ops.map((o) => ({ ...o, row: { ...o.row, kelas: '8A' } }))));
  assert.ok(sh.writes - w0 <= 2, `penulisan: ${sh.writes - w0}`);
  assert.ok(sh.objects().every((r) => r.Kelas === '8A'));
});
