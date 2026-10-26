/**
 * ============================================================================
 *  TATA TERTIB SMP KRISTEN BASAAN — Server Google Apps Script        v1.0.0
 * ============================================================================
 *  Pasang (lengkapnya di PANDUAN.md):
 *   1. Buat Google Spreadsheet baru → Ekstensi → Apps Script → hapus isi Code.gs → tempel file ini → Simpan.
 *   2. Pilih fungsi "setup" → Jalankan → izinkan akses. Semua sheet, aturan bawaan dari dokumen
 *      tata tertib, dan akun admin pertama dibuat otomatis (lihat sheet "Pengguna").
 *   3. Terapkan → Deployment baru → jenis "Aplikasi web" → Jalankan sebagai: Saya →
 *      Yang memiliki akses: Siapa saja → Terapkan → salin URL yang berakhiran /exec.
 *   4. Tempel URL itu di js/config.js (DEFAULT_SCRIPT_URL), atau di aplikasi: Kelola → Pengaturan → Server.
 *  Setelah mengubah kode ini: Terapkan → Kelola deployment → ikon pensil → Versi: "Versi baru" → Terapkan.
 *
 *  Keamanan: kolom Password hanya dibaca server. HP hanya menerima hash (SHA-256 berulang) untuk login
 *  offline; setiap perubahan data diperiksa ulang di sini (token login + hak akses peran).
 * ============================================================================
 */

var SERVER_VERSION = '1.0.0';
var HASH_ITER = 200;
var REV_OVERLAP_MS = 5 * 60 * 1000;
var ROLES = ['Admin', 'Kepala Sekolah', 'Guru BK', 'Wali Kelas', 'Guru'];
var MGR = ['Admin', 'Kepala Sekolah', 'Guru BK'];
var TINGKAT = ['Ringan', 'Sedang', 'Berat'];
var STATUS_TINDAK = ['Belum', 'Dijadwalkan', 'Selesai'];
var STATUS_SISWA = ['Aktif', 'Lulus', 'Pindah', 'Dikeluarkan', 'Nonaktif'];
var SURAT = ['', 'SP1', 'SP2', 'SP3', 'PK', 'KELUAR'];
var WARNA = ['info', 'warn', 'serious', 'critical', 'severe', 'dark'];

// Kolom: [kunci JSON, judul kolom di sheet, tipe, nilai bawaan]
// Tipe: t teks · n angka · b Ya/Tidak · d tanggal (yyyy-MM-dd) · tm jam (HH:mm) · dt waktu (yyyy-MM-dd HH:mm:ss)
var META = [['updatedAt', 'Diubah Pada', 'dt'], ['updatedBy', 'Diubah Oleh', 't']];
var TABLES = {
  pengaturan: { sheet: 'Pengaturan', key: 'kunci', cols: [['kunci', 'Kunci', 't'], ['nilai', 'Nilai', 't'], ['keterangan', 'Keterangan', 't']].concat(META) },
  kategori: { sheet: 'Kategori', key: 'kode', cols: [['kode', 'Kode', 't'], ['nama', 'Nama Kategori', 't'], ['urutan', 'Urutan', 'n'], ['aktif', 'Aktif', 'b', true]].concat(META) },
  jenis: { sheet: 'Jenis Pelanggaran', key: 'kode', cols: [
    ['kode', 'Kode', 't'], ['kategori', 'Kategori', 't'], ['uraian', 'Bentuk Pelanggaran', 't'], ['poin', 'Poin', 'n'],
    ['poinMaks', 'Poin Maks', 'n'], ['tingkat', 'Tingkat', 't'], ['zt', 'Zero Tolerance', 'b', false], ['aktif', 'Aktif', 'b', true],
    ['urutan', 'Urutan', 'n']].concat(META) },
  sanksi: { sheet: 'Tahap Sanksi', key: 'kode', cols: [
    ['kode', 'Kode', 't'], ['min', 'Poin Minimal', 'n'], ['label', 'Nama Tahap', 't'], ['tindakan', 'Tindakan', 't'],
    ['pj', 'Penanggung Jawab', 't'], ['surat', 'Jenis Surat', 't'], ['warna', 'Warna', 't']].concat(META) },
  siswa: { sheet: 'Siswa', key: 'id', idPrefix: 's', cols: [
    ['id', 'ID', 't'], ['nis', 'NIS', 't'], ['nisn', 'NISN', 't'], ['nama', 'Nama Lengkap', 't'], ['kelas', 'Kelas', 't'],
    ['jk', 'L/P', 't'], ['angkatan', 'Tahun Masuk', 't'], ['ortu', 'Nama Orang Tua/Wali', 't'], ['hpOrtu', 'No. HP Orang Tua', 't'],
    ['alamat', 'Alamat', 't'], ['status', 'Status', 't'], ['catatan', 'Catatan', 't']].concat(META) },
  pelanggaran: { sheet: 'Catatan Pelanggaran', key: 'id', idPrefix: 'p', rev: true, cols: [
    ['id', 'ID', 't'], ['tanggal', 'Tanggal', 'd'], ['jam', 'Jam', 'tm'], ['siswaId', 'ID Siswa', 't'], ['nis', 'NIS', 't'],
    ['nama', 'Nama Siswa', 't'], ['kelas', 'Kelas', 't'], ['jenisKode', 'Kode Pelanggaran', 't'], ['uraian', 'Bentuk Pelanggaran', 't'],
    ['kategori', 'Kategori', 't'], ['tingkat', 'Tingkat', 't'], ['poin', 'Poin', 'n'], ['lokasi', 'Lokasi', 't'],
    ['kronologi', 'Kronologi', 't'], ['saksi', 'Saksi', 't'], ['pelapor', 'Siswa Pelapor', 't'], ['tindakanLangsung', 'Tindakan Langsung', 't'],
    ['guru', 'Dicatat Oleh', 't'], ['guruNama', 'Nama Guru', 't'], ['createdAt', 'Dibuat Pada', 'dt'],
    ['batal', 'Dibatalkan', 'b', false], ['alasanBatal', 'Alasan Pembatalan', 't'], ['device', 'Perangkat', 't']]
    .concat(META).concat([['_rev', '_rev', 'n']]) },
  tindak: { sheet: 'Tindak Lanjut', key: 'id', rev: true, cols: [
    ['id', 'ID', 't'], ['siswaId', 'ID Siswa', 't'], ['nama', 'Nama Siswa', 't'], ['kelas', 'Kelas', 't'], ['tahap', 'Kode Tahap', 't'],
    ['tahapLabel', 'Tahap', 't'], ['poinSaat', 'Poin Saat Tercapai', 'n'], ['tanggalCapai', 'Tanggal Tercapai', 'd'], ['status', 'Status', 't'],
    ['tanggalPelaksanaan', 'Tanggal Pelaksanaan', 'd'], ['nomorSurat', 'Nomor Surat', 't'], ['catatan', 'Catatan', 't'], ['petugas', 'Petugas', 't']]
    .concat(META).concat([['_rev', '_rev', 'n']]) },
};
var USERS = { sheet: 'Pengguna', key: 'username', cols: [
  ['username', 'Username', 't'], ['nama', 'Nama Lengkap', 't'], ['password', 'Password', 't'], ['peran', 'Peran', 't'],
  ['kelasWali', 'Kelas Wali', 't'], ['nip', 'NIP', 't'], ['hp', 'No. HP', 't'], ['aktif', 'Aktif', 'b', true], ['updatedAt', 'Diubah Pada', 'dt']] };
var LOG = { sheet: 'Log Aktivitas', key: 'waktu', cols: [
  ['waktu', 'Waktu', 'dt'], ['user', 'Pengguna', 't'], ['aksi', 'Aksi', 't'], ['detail', 'Detail', 't'], ['device', 'Perangkat', 't']] };
var APPLY_ORDER = ['pengaturan', 'kategori', 'jenis', 'sanksi', 'siswa', 'pelanggaran', 'tindak'];

// ----------------------------------------------------------------------------- aturan bawaan
var DEFAULT_KATEGORI = [
  ['A', 'Kehadiran & Kedisiplinan Waktu'], ['B', 'Kerapian, Penampilan & Seragam'], ['C', 'Kebersihan & Fasilitas Sekolah'],
  ['D', 'Ketertiban Kelas & Akademik'], ['E', 'Sikap, Etika & Sopan Santun'], ['F', 'Sosial, Keamanan & Hukum (Pelanggaran Berat)']];
var DEFAULT_JENIS = [
  [1, 'A', 'Datang terlambat ke sekolah (kurang dari 15 menit).', 2, '', 'Ringan'],
  [2, 'A', 'Datang terlambat lebih dari 15 menit tanpa alasan darurat.', 5, '', 'Ringan'],
  [3, 'A', 'Tidak mengikuti Upacara Bendera / apel pagi tanpa alasan sah.', 2, '', 'Ringan'],
  [4, 'A', 'Tidak mengikuti kegiatan ekstrakurikuler wajib / senam pagi.', 2, '', 'Ringan'],
  [5, 'A', 'Berada di kantin atau area lain saat jam pelajaran berlangsung.', 5, '', 'Ringan'],
  [6, 'A', 'Tidak masuk sekolah tanpa keterangan (Alpa) 2 hari berturut-turut.', 5, '', 'Ringan'],
  [7, 'A', 'Meninggalkan sekolah (bolos) sebelum jam pulang tanpa izin.', 20, '', 'Ringan'],
  [8, 'A', 'Memalsukan surat izin (tanda tangan orang tua/surat dokter).', 20, '', 'Ringan'],
  [9, 'A', 'Melompati pagar untuk masuk atau keluar dari lingkungan sekolah.', 10, '', 'Ringan'],
  [10, 'B', 'Atribut seragam tidak lengkap (tanpa dasi, topi, bet, sabuk standar).', 5, '', 'Ringan'],
  [11, 'B', 'Salah memakai seragam (tidak sesuai jadwal yang ditentukan).', 2, '', 'Ringan'],
  [12, 'B', 'Baju tidak dimasukkan, celana/rok diketatkan (pensil/span berlebihan).', 5, '', 'Ringan'],
  [13, 'B', 'Sepatu dan kaos kaki tidak sesuai ketentuan (misal: warna bukan hitam).', 2, '', 'Ringan'],
  [14, 'B', 'Rambut laki-laki gondrong, menyentuh kerah, telinga, atau alis.', 10, '', 'Ringan'],
  [15, 'B', 'Menggunakan cat kuku (kuteks), kuku panjang, atau riasan wajah (makeup) berlebih.', 5, '', 'Ringan'],
  [16, 'B', 'Mewarnai rambut selain warna hitam alami.', 10, '', 'Ringan'],
  [17, 'B', 'Memakai perhiasan berlebihan, bertato (termasuk temporer), atau bertindik (bagi laki-laki).', 10, '', 'Ringan'],
  [18, 'C', 'Membuang sampah tidak pada tempatnya / meninggalkan sampah di laci meja.', 5, '', 'Ringan'],
  [19, 'C', 'Makan atau minum di dalam kelas saat guru sedang mengajar.', 5, '', 'Ringan'],
  [20, 'C', 'Memarkir kendaraan sembarangan / tidak pada area parkir siswa.', 5, '', 'Ringan'],
  [21, 'C', 'Mencoret-coret meja, kursi, atau tembok sekolah (vandalisme ringan).', 15, '', 'Ringan'],
  [22, 'C', 'Merusak fasilitas sekolah, memecahkan kaca, atau merusak alat lab dengan sengaja.', 25, '', 'Sedang'],
  [23, 'D', 'Tidur di kelas atau sengaja membuat kegaduhan saat jam pelajaran.', 10, '', 'Ringan'],
  [24, 'D', 'Membawa barang non-edukasi (mainan, kartu remi, komik, dll).', 10, '', 'Ringan'],
  [25, 'D', 'Bermain smartphone/gadget saat jam pelajaran tanpa izin guru.', 20, '', 'Ringan'],
  [26, 'D', 'Mencontek saat ulangan harian atau tidak mengerjakan PR.', 10, '', 'Ringan'],
  [27, 'D', 'Mencontek terencana / membawa catatan saat Ujian Tengah/Akhir Semester.', 30, '', 'Sedang'],
  [28, 'D', 'Mengubah nilai raport atau memanipulasi dokumen akademik sekolah.', 40, '', 'Sedang'],
  [29, 'E', 'Berbicara kotor, kasar, mengumpat, atau memanggil teman dengan nama ejekan (nama orang tua).', 20, '', 'Ringan'],
  [30, 'E', 'Bermesraan atau berpacaran secara berlebihan di lingkungan sekolah.', 20, '', 'Ringan'],
  [31, 'E', 'Menentang, membantah dengan kasar, atau bersikap tidak sopan kepada Guru/Staf.', 50, '', 'Sedang'],
  [32, 'E', 'Menyebarkan rumor palsu, memfitnah, atau memprovokasi teman.', 30, '', 'Sedang'],
  [33, 'E', 'Menghina, mengancam, atau melecehkan Guru dan Staf Sekolah secara verbal/digital.', 90, 100, 'Berat'],
  [34, 'E', 'Mencemarkan nama baik sekolah di media sosial atau lingkungan publik.', 80, '', 'Berat'],
  [35, 'F', 'Melakukan perundungan (bullying) secara fisik, verbal, atau cyberbullying.', 80, '', 'Berat'],
  [36, 'F', 'Membawa rokok, merokok, atau menggunakan vape/pod di sekolah dan sekitarnya.', 80, '', 'Berat'],
  [37, 'F', 'Memalak / memeras / meminta uang secara paksa kepada siswa lain.', 70, '', 'Berat'],
  [38, 'F', 'Berkelahi sesama siswa (baku hantam) di dalam atau luar sekolah (berseragam).', 70, '', 'Berat'],
  [39, 'F', 'Mengambil barang milik orang lain atau fasilitas sekolah (mencuri).', 70, '', 'Berat'],
  [40, 'F', 'Melakukan aktivitas perjudian (dadu, kartu, judi online) di lingkungan sekolah.', 70, '', 'Berat'],
  [41, 'F', 'Membawa, menyimpan, atau mengakses materi pornografi (buku, video, foto).', 70, '', 'Berat'],
  [42, 'F', 'Membawa senjata tajam, senjata api, atau alat berbahaya lainnya.', 90, '', 'Berat'],
  [43, 'F', 'Terlibat tawuran antar sekolah atau bergabung dengan geng motor kriminal.', 70, '', 'Berat'],
  [44, 'F', 'Melakukan tindakan asusila / pelecehan seksual di dalam maupun luar sekolah.', 90, '', 'Berat'],
  [45, 'F', 'Membawa, menggunakan, atau mengedarkan Narkoba / Minuman Keras.', 90, 100, 'Berat']];
var DEFAULT_SANKSI = [
  ['LISAN', 10, 'Peringatan Lisan', 'Peringatan lisan, pembinaan langsung oleh Guru Mata Pelajaran / Guru Piket, dan hukuman edukatif ringan (misal: membersihkan kelas/halaman).', 'Guru Mata Pelajaran / Guru Piket', '', 'info'],
  ['SP1', 30, 'SP 1 (Teguran Tertulis)', 'Pemanggilan oleh Wali Kelas. Siswa diberikan Teguran Tertulis (SP 1) dan wajib menandatangani surat komitmen perbaikan diri.', 'Wali Kelas', 'SP1', 'warn'],
  ['SP2', 50, 'SP 2 + Panggilan Orang Tua', 'Pemanggilan Orang Tua/Wali ke sekolah oleh Komite Disiplin/Guru BK. Siswa mendapat Surat Peringatan 2 (SP 2).', 'Komite Disiplin / Guru BK', 'SP2', 'serious'],
  ['SP3', 70, 'SP 3 + Skorsing 3 Hari', 'Pemanggilan Orang Tua/Wali dan siswa mendapat Surat Peringatan 3 (SP 3) disertai Skorsing selama 3 hari.', 'Komite Disiplin / Guru BK', 'SP3', 'critical'],
  ['PK', 90, 'Peringatan Keras Terakhir', 'Peringatan Keras Terakhir. Penandatanganan surat perjanjian di atas materai yang melibatkan Kepala Sekolah, Guru BK, dan Orang Tua/Wali. Siswa dalam masa percobaan ketat.', 'Kepala Sekolah, Guru BK & Orang Tua', 'PK', 'severe'],
  ['KELUAR', 100, 'Dikeluarkan / Dipindahkan', 'Siswa dikeluarkan / dipindahkan. Akumulasi poin maksimal telah terpenuhi. Sekolah mengembalikan wewenang pendidikan siswa sepenuhnya kepada Orang Tua/Wali secara final dan mengikat.', 'Kepala Sekolah (Sidang Dewan Guru)', 'KELUAR', 'dark']];
var DEFAULT_SETTINGS = [
  ['namaSekolah', 'SMP Kristen Basaan', 'Nama sekolah (kop surat & judul)'],
  ['yayasan', '', 'Nama yayasan (baris atas kop surat, boleh kosong)'],
  ['npsn', '', 'NPSN'],
  ['alamat', '', 'Alamat sekolah (kop surat)'],
  ['kota', 'Basaan', 'Tempat penandatanganan surat (mis. Basaan)'],
  ['telepon', '', 'Telepon sekolah'],
  ['email', '', 'Email sekolah'],
  ['kepalaSekolah', '', 'Nama Kepala Sekolah'],
  ['nipKepsek', '', 'NIP/NIY Kepala Sekolah'],
  ['guruBK', '', 'Nama Guru BK / Koordinator Disiplin'],
  ['nipBK', '', 'NIP/NIY Guru BK'],
  ['tahunAjaran', '2026/2027', 'Tahun ajaran berjalan (mis. 2026/2027)'],
  ['semester', 'Ganjil', 'Semester berjalan (Ganjil/Genap)'],
  ['zonaWaktu', 'WITA', 'Zona waktu pada dokumen (WIB/WITA/WIT)'],
  ['batasKoreksiJam', '24', 'Batas waktu guru boleh mengubah/membatalkan catatannya sendiri (jam)'],
  ['batasSidang', '50', 'Akumulasi poin di atas angka ini wajib diputuskan Sidang Dewan Guru'],
  ['aksesDashboard', 'publik', 'publik = dasbor terbuka untuk semua; login = dasbor hanya setelah login'],
  ['lokasi', 'Ruang kelas, Halaman sekolah, Kantin, Gerbang sekolah, Toilet, Lapangan, Laboratorium, Perpustakaan, Luar sekolah, Media sosial', 'Pilihan lokasi kejadian (pisahkan dengan koma)'],
  ['tindakanCepat', 'Teguran lisan, Membersihkan kelas/halaman, Barang disita sementara, Dipanggil ke ruang BK, Membuat surat pernyataan, Orang tua dihubungi', 'Pilihan tindakan langsung (pisahkan dengan koma)'],
  ['logo', '', 'Logo sekolah (diunggah dari aplikasi)']];

// ----------------------------------------------------------------------------- pintu masuk
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, app: 'tatib-krisba', server: SERVER_VERSION, time: Date.now() });
  return json_({ ok: true, app: 'tatib-krisba', server: SERVER_VERSION, pesan: 'Server Tata Tertib aktif. Gunakan aplikasi untuk mengakses data.' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, code: 'BAD_REQUEST', error: 'Format permintaan tidak valid.' }); }
  REQ_ = {};
  try {
    var a = body.action;
    var out;
    if (a === 'pull') out = apiPull_(body);
    else if (a === 'push') out = apiPush_(body);
    else if (a === 'ping') out = { ok: true, app: 'tatib-krisba', server: SERVER_VERSION, time: Date.now() };
    else if (a === 'users.list') out = apiUsersList_(body);
    else if (a === 'users.save') out = apiUsersSave_(body);
    else if (a === 'users.delete') out = apiUsersDelete_(body);
    else if (a === 'password') out = apiChangePassword_(body);
    else throw err_('BAD_REQUEST', 'Aksi tidak dikenal: ' + a);
    return json_(out);
  } catch (x) {
    return json_({ ok: false, code: x.code || 'ERROR', error: x.message || String(x) });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code, msg) { var e = new Error(msg); e.code = code; return e; }
var REQ_ = {};

// ----------------------------------------------------------------------------- tarik data
function apiPull_(body) {
  var auth = checkAuth_(body.auth, true);
  var settings = readSettings_();
  var restricted = settings.aksesDashboard === 'login' && !auth;
  var now = Date.now();
  var since = Number(body.since) || 0;
  var out = {
    ok: true, server: SERVER_VERSION, rev: now, salt: getSalt_(), iter: HASH_ITER, settings: settings,
    users: publicUsers_(), kategori: objs_(readTable_(TABLES.kategori)), jenis: objs_(readTable_(TABLES.jenis)),
    sanksi: objs_(readTable_(TABLES.sanksi)), restricted: restricted, me: auth ? publicUser_(auth, '') : null,
  };
  if (body.auth && body.auth.u && !auth) out.authError = 'Sesi login tidak berlaku lagi (password diganti atau akun dinonaktifkan). Silakan login ulang.';
  if (!restricted) {
    out.siswa = objs_(readTable_(TABLES.siswa, true));
    ['pelanggaran', 'tindak'].forEach(function (name) {
      var rows = objs_(readTable_(TABLES[name], true));
      out[name + 'Count'] = rows.length;
      out[name] = since ? rows.filter(function (r) { return (Number(r._rev) || 0) > since - REV_OVERLAP_MS; }) : rows;
    });
    out.full = !since;
  }
  return out;
}

// ----------------------------------------------------------------------------- kirim perubahan
function apiPush_(body) {
  var user = checkAuth_(body.auth, false);
  var ops = (body.ops || []).slice(0, 500);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ctx = { user: user, settings: readSettings_(), now: Date.now(), stamp: stamp_(new Date()), logs: [], rev: 0,
      device: String(body.device || '').slice(0, 80), cache: {} };
    var results = [];
    APPLY_ORDER.forEach(function (name) {
      var list = ops.filter(function (o) { return o && o.table === name; });
      if (list.length) applyOps_(name, list, ctx, results);
    });
    ops.forEach(function (o) {
      if (!o || APPLY_ORDER.indexOf(o.table) < 0) results.push({ id: o && o.id, ok: false, code: 'VALIDATION', error: 'Tabel tidak dikenal.' });
    });
    writeLogs_(ctx.logs);
    return { ok: true, results: results, rev: Date.now() };
  } finally {
    lock.releaseLock();
  }
}

function applyOps_(name, ops, ctx, results) {
  var def = TABLES[name];
  var tb = readTable_(def, true);
  var map = {};
  tb.rows.forEach(function (row) { map[String(row.obj[def.key])] = row; });
  var dirty = [], added = [], removed = [];
  ops.forEach(function (op) {
    try {
      var key = String(op.key || (op.row && op.row[def.key]) || '').trim();
      if (!key) throw err_('VALIDATION', 'Kunci data kosong.');
      var ex = map[key];
      if (op.op === 'delete') {
        RULES_[name].del(ctx, ex ? ex.obj : null, key);
        if (ex) {
          if (ex.r) removed.push(ex.r); else added.splice(added.indexOf(ex), 1);
          var di = dirty.indexOf(ex); if (di >= 0) dirty.splice(di, 1);
          delete map[key];
        }
        results.push({ id: op.id, ok: true, deleted: true, key: key });
        return;
      }
      var row = RULES_[name].upsert(ctx, op.row || {}, ex ? ex.obj : null, key);
      row[def.key] = key;
      row.updatedAt = ctx.stamp;
      row.updatedBy = ctx.user.username;
      if (def.rev) { ctx.rev = Math.max(Date.now(), ctx.rev + 1); row._rev = ctx.rev; }
      if (ex) {
        ex.obj = row;
        ex.arr = toArr_(def, tb.idx, row, ex.arr, tb.width);
        if (ex.r && dirty.indexOf(ex) < 0) dirty.push(ex);
      } else {
        var entry = { r: 0, obj: row, arr: toArr_(def, tb.idx, row, null, tb.width) };
        added.push(entry);
        map[key] = entry;
      }
      results.push({ id: op.id, ok: true, key: key, row: row });
    } catch (x) {
      results.push({ id: op.id, ok: false, code: x.code || 'ERROR', error: x.message || String(x) });
    }
  });
  flush_(tb, dirty, added);
  removed.sort(function (a, b) { return b - a; }).forEach(function (r) { tb.sh.deleteRow(r); });
}

// Aturan validasi & hak akses per tabel (cerminan js/core/perm.js di aplikasi).
var RULES_ = {
  pelanggaran: {
    upsert: function (ctx, inp, ex) {
      var u = ctx.user, mgr = isMgr_(u);
      if (ex && !mgr) {
        if (low_(ex.guru) !== low_(u.username)) throw err_('FORBIDDEN', 'Hanya guru pencatat, Guru BK, Kepala Sekolah, atau Admin yang boleh mengubah catatan ini.');
        if (ex.batal) throw err_('FORBIDDEN', 'Catatan ini sudah dibatalkan.');
        var t = parseStamp_(ex.createdAt), jam = Number(ctx.settings.batasKoreksiJam) || 24;
        if (t && ctx.now - t.getTime() > (jam + 2) * 3600000) throw err_('FORBIDDEN', 'Batas waktu koreksi (' + jam + ' jam) sudah lewat. Hubungi Guru BK atau Admin.');
      }
      var r = pick_(TABLES.pelanggaran, inp);
      if (!r.siswaId || !r.nama) throw err_('VALIDATION', 'Data siswa belum lengkap.');
      if (!isYmd_(r.tanggal)) throw err_('VALIDATION', 'Tanggal tidak valid.');
      if (r.jam && !/^\d{1,2}:\d{2}$/.test(r.jam)) throw err_('VALIDATION', 'Jam tidak valid.');
      if (!r.jenisKode || !r.uraian) throw err_('VALIDATION', 'Jenis pelanggaran belum dipilih.');
      var poin = Number(r.poin);
      if (isNaN(poin) || poin < 0 || poin > 1000) throw err_('VALIDATION', 'Poin harus 0–1000.');
      r.poin = poin;
      if (r.batal && !String(r.alasanBatal || '').trim()) throw err_('VALIDATION', 'Alasan pembatalan wajib diisi.');
      if (r.batal && ex && !ex.batal && !mgr && low_(ex.guru) !== low_(u.username)) throw err_('FORBIDDEN', 'Tidak berhak membatalkan.');
      if (ex) {
        r.guru = ex.guru; r.guruNama = ex.guruNama; r.createdAt = ex.createdAt || r.createdAt;
      } else {
        if (!(mgr && r.guru)) { r.guru = u.username; r.guruNama = u.nama; }
        if (!parseStamp_(r.createdAt)) r.createdAt = ctx.stamp;
      }
      r.device = r.device || ctx.device;
      var aksi = !ex ? 'Catat pelanggaran' : (r.batal && !ex.batal ? 'Batalkan catatan' : (!r.batal && ex.batal ? 'Pulihkan catatan' : 'Ubah catatan'));
      log_(ctx, aksi, r.nama + ' (' + r.kelas + ') – ' + r.jenisKode + '. ' + String(r.uraian).slice(0, 70) + ' (+' + r.poin + ')' + (r.batal ? ' · alasan: ' + r.alasanBatal : ''));
      return r;
    },
    del: function () { throw err_('FORBIDDEN', 'Catatan pelanggaran tidak dapat dihapus. Gunakan "Batalkan" dengan alasan.'); },
  },
  tindak: {
    upsert: function (ctx, inp, ex, key) {
      var r = pick_(TABLES.tindak, inp);
      if (ex) r.siswaId = ex.siswaId || r.siswaId;
      var s = findRow_(ctx, 'siswa', 'id', r.siswaId);
      if (s) { r.kelas = s.kelas; r.nama = s.nama; } else if (ex) r.kelas = ex.kelas;
      if (!canTindak_(ctx.user, r.kelas)) throw err_('FORBIDDEN', 'Hanya Admin, Kepala Sekolah, Guru BK, atau Wali Kelas ' + r.kelas + ' yang boleh memproses tindak lanjut ini.');
      if (key.indexOf('__') < 0 || !r.siswaId) throw err_('VALIDATION', 'ID tindak lanjut tidak valid.');
      if (STATUS_TINDAK.indexOf(r.status) < 0) throw err_('VALIDATION', 'Status tindak lanjut tidak valid.');
      if (r.tanggalPelaksanaan && !isYmd_(r.tanggalPelaksanaan)) throw err_('VALIDATION', 'Tanggal pelaksanaan tidak valid.');
      if (!r.petugas) r.petugas = ctx.user.nama;
      log_(ctx, 'Tindak lanjut', r.nama + ' (' + r.kelas + ') – ' + r.tahapLabel + ': ' + r.status + (r.nomorSurat ? ' · No. ' + r.nomorSurat : ''));
      return r;
    },
    del: function (ctx) { if (!isMgr_(ctx.user)) throw err_('FORBIDDEN', 'Tidak berhak menghapus tindak lanjut.'); },
  },
  siswa: {
    upsert: function (ctx, inp) {
      if (!canSiswa_(ctx.user)) throw err_('FORBIDDEN', 'Hanya Admin atau Guru BK yang boleh mengubah data siswa.');
      var r = pick_(TABLES.siswa, inp);
      if (!r.nama) throw err_('VALIDATION', 'Nama siswa wajib diisi.');
      if (!r.kelas) throw err_('VALIDATION', 'Kelas wajib diisi (' + r.nama + ').');
      r.jk = /^p/i.test(r.jk) ? 'P' : /^l/i.test(r.jk) ? 'L' : '';
      if (STATUS_SISWA.indexOf(r.status) < 0) r.status = 'Aktif';
      ctx.siswaN = (ctx.siswaN || 0) + 1;
      if (ctx.siswaN <= 3) log_(ctx, 'Data siswa', r.nama + ' (' + r.kelas + ')');
      else if (ctx.siswaN === 4) log_(ctx, 'Data siswa', 'dan siswa lainnya (impor/ubah massal)');
      return r;
    },
    del: function (ctx, ex, key) {
      if (!canSiswa_(ctx.user)) throw err_('FORBIDDEN', 'Hanya Admin atau Guru BK yang boleh menghapus siswa.');
      if (used_(ctx, 'pelanggaran', 'siswaId', key)) throw err_('VALIDATION', 'Siswa sudah memiliki catatan pelanggaran sehingga tidak bisa dihapus. Ubah statusnya (Lulus/Pindah/Nonaktif).');
      log_(ctx, 'Hapus siswa', ex ? ex.nama + ' (' + ex.kelas + ')' : key);
    },
  },
  kategori: {
    upsert: function (ctx, inp, ex, key) {
      rulesOnly_(ctx);
      var r = pick_(TABLES.kategori, inp);
      if (!/^[A-Za-z0-9]{1,6}$/.test(key)) throw err_('VALIDATION', 'Kode kategori 1–6 huruf/angka.');
      if (!r.nama) throw err_('VALIDATION', 'Nama kategori wajib diisi.');
      r.urutan = Number(r.urutan) || 0;
      log_(ctx, 'Kategori', key + ' – ' + r.nama);
      return r;
    },
    del: function (ctx, ex, key) {
      rulesOnly_(ctx);
      if (used_(ctx, 'jenis', 'kategori', key)) throw err_('VALIDATION', 'Kategori masih dipakai jenis pelanggaran. Pindahkan/hapus jenisnya dulu, atau nonaktifkan kategori.');
      log_(ctx, 'Hapus kategori', key);
    },
  },
  jenis: {
    upsert: function (ctx, inp, ex, key) {
      rulesOnly_(ctx);
      var r = pick_(TABLES.jenis, inp);
      if (!/^[A-Za-z0-9._-]{1,12}$/.test(key)) throw err_('VALIDATION', 'Kode pelanggaran 1–12 karakter (huruf/angka).');
      if (!r.kategori) throw err_('VALIDATION', 'Kategori wajib dipilih.');
      if (!r.uraian) throw err_('VALIDATION', 'Bentuk pelanggaran wajib diisi.');
      if (TINGKAT.indexOf(r.tingkat) < 0) throw err_('VALIDATION', 'Tingkat harus Ringan, Sedang, atau Berat.');
      r.poin = Number(r.poin);
      if (isNaN(r.poin) || r.poin < 0 || r.poin > 100) throw err_('VALIDATION', 'Poin harus 0–100.');
      if (r.poinMaks !== '' && r.poinMaks != null) {
        r.poinMaks = Number(r.poinMaks);
        if (isNaN(r.poinMaks) || r.poinMaks < r.poin || r.poinMaks > 100) throw err_('VALIDATION', 'Poin maks harus ≥ poin dan ≤ 100.');
        if (r.poinMaks === r.poin) r.poinMaks = '';
      } else r.poinMaks = '';
      if (r.zt) { r.poin = 100; r.poinMaks = ''; }
      r.urutan = Number(r.urutan) || 0;
      log_(ctx, ex ? 'Ubah jenis pelanggaran' : 'Tambah jenis pelanggaran', key + '. ' + String(r.uraian).slice(0, 70) + ' (' + r.poin + (r.poinMaks ? '–' + r.poinMaks : '') + ' poin' + (r.aktif ? '' : ', nonaktif') + ')');
      return r;
    },
    del: function (ctx, ex, key) {
      rulesOnly_(ctx);
      if (used_(ctx, 'pelanggaran', 'jenisKode', key)) throw err_('VALIDATION', 'Jenis pelanggaran ini sudah dipakai di catatan siswa. Nonaktifkan saja agar riwayat tetap utuh.');
      log_(ctx, 'Hapus jenis pelanggaran', key);
    },
  },
  sanksi: {
    upsert: function (ctx, inp, ex, key) {
      rulesOnly_(ctx);
      var r = pick_(TABLES.sanksi, inp);
      if (!/^[A-Za-z0-9_]{1,12}$/.test(key)) throw err_('VALIDATION', 'Kode tahap 1–12 huruf/angka.');
      r.min = Number(r.min);
      if (isNaN(r.min) || r.min < 1 || r.min > 1000) throw err_('VALIDATION', 'Poin minimal harus 1–1000.');
      if (!r.label) throw err_('VALIDATION', 'Nama tahap wajib diisi.');
      if (SURAT.indexOf(r.surat) < 0) r.surat = '';
      if (WARNA.indexOf(r.warna) < 0) r.warna = 'warn';
      log_(ctx, 'Tahap sanksi', key + ' – ' + r.label + ' (≥ ' + r.min + ' poin)');
      return r;
    },
    del: function (ctx, ex, key) { rulesOnly_(ctx); log_(ctx, 'Hapus tahap sanksi', key); },
  },
  pengaturan: {
    upsert: function (ctx, inp, ex, key) {
      if (!isAdmin_(ctx.user)) throw err_('FORBIDDEN', 'Hanya Admin yang boleh mengubah pengaturan.');
      if (!/^[A-Za-z0-9_]{1,40}$/.test(key)) throw err_('VALIDATION', 'Kunci pengaturan tidak valid.');
      var r = pick_(TABLES.pengaturan, inp);
      r.nilai = String(r.nilai == null ? '' : r.nilai);
      if (r.nilai.length > 49000) throw err_('VALIDATION', 'Isi pengaturan terlalu panjang (logo maks. ±35 KB).');
      if (!r.keterangan) r.keterangan = (ex && ex.keterangan) || settingInfo_(key);
      log_(ctx, 'Pengaturan', key + ' = ' + (key === 'logo' ? (r.nilai ? '[gambar]' : '(kosong)') : r.nilai.slice(0, 60)));
      return r;
    },
    del: function (ctx) { if (!isAdmin_(ctx.user)) throw err_('FORBIDDEN', 'Hanya Admin.'); },
  },
};

// ----------------------------------------------------------------------------- pengguna
function apiUsersList_(body) {
  var me = checkAuth_(body.auth, false);
  if (!isAdmin_(me)) throw err_('FORBIDDEN', 'Hanya Admin.');
  return { ok: true, users: readTable_(USERS).rows.map(function (row) {
    var u = row.obj;
    return { username: u.username, nama: u.nama, peran: u.peran, kelasWali: u.kelasWali, nip: u.nip, hp: u.hp, aktif: u.aktif, hasPassword: !!u.password, updatedAt: u.updatedAt };
  }) };
}

function apiUsersSave_(body) {
  var me = checkAuth_(body.auth, false);
  if (!isAdmin_(me)) throw err_('FORBIDDEN', 'Hanya Admin yang boleh mengelola pengguna.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var inp = body.user || {};
    var uname = low_(inp.username).trim();
    if (!/^[a-z0-9._-]{3,30}$/.test(uname)) throw err_('VALIDATION', 'Username 3–30 karakter: huruf kecil, angka, titik, minus, garis bawah.');
    var tb = readTable_(USERS);
    var ex = null;
    tb.rows.forEach(function (row) { if (low_(row.obj.username) === uname) ex = row; });
    if (body.isNew && ex) throw err_('VALIDATION', 'Username "' + uname + '" sudah dipakai.');
    if (!body.isNew && !ex) throw err_('VALIDATION', 'Pengguna tidak ditemukan.');
    var peran = normRole_(inp.peran);
    if (!peran) throw err_('VALIDATION', 'Peran tidak valid.');
    if (!String(inp.nama || '').trim()) throw err_('VALIDATION', 'Nama lengkap wajib diisi.');
    var pw = String(inp.password || '');
    if ((!ex || !ex.obj.password) && pw.length < 4) throw err_('VALIDATION', 'Password minimal 4 karakter.');
    if (pw && pw.length < 4) throw err_('VALIDATION', 'Password minimal 4 karakter.');
    var row = {
      username: uname, nama: String(inp.nama).trim(), password: pw || (ex ? ex.obj.password : ''), peran: peran,
      kelasWali: String(inp.kelasWali || '').trim(), nip: String(inp.nip || '').trim(), hp: String(inp.hp || '').trim(),
      aktif: inp.aktif !== false, updatedAt: stamp_(new Date()),
    };
    var admins = tb.rows.filter(function (r) { return r.obj.aktif && normRole_(r.obj.peran) === 'Admin' && low_(r.obj.username) !== uname; }).length;
    if (!admins && !(row.aktif && row.peran === 'Admin')) throw err_('VALIDATION', 'Harus ada minimal satu Admin aktif.');
    if (ex) { ex.arr = toArr_(USERS, tb.idx, row, ex.arr, tb.width); flush_(tb, [ex], []); }
    else flush_(tb, [], [{ r: 0, arr: toArr_(USERS, tb.idx, row, null, tb.width) }]);
    writeLogs_([[stamp_(new Date()), me.username, ex ? 'Ubah pengguna' : 'Tambah pengguna', uname + ' (' + peran + ')' + (pw ? ' · password diatur' : ''), String(body.device || '')]]);
    REQ_ = {};
    return { ok: true, users: publicUsers_() };
  } finally { lock.releaseLock(); }
}

function apiUsersDelete_(body) {
  var me = checkAuth_(body.auth, false);
  if (!isAdmin_(me)) throw err_('FORBIDDEN', 'Hanya Admin.');
  var uname = low_(body.username);
  if (uname === low_(me.username)) throw err_('VALIDATION', 'Tidak bisa menghapus akun sendiri.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var tb = readTable_(USERS);
    var ex = tb.rows.filter(function (r) { return low_(r.obj.username) === uname; })[0];
    if (!ex) throw err_('VALIDATION', 'Pengguna tidak ditemukan.');
    tb.sh.deleteRow(ex.r);
    writeLogs_([[stamp_(new Date()), me.username, 'Hapus pengguna', uname, String(body.device || '')]]);
    REQ_ = {};
    return { ok: true, users: publicUsers_() };
  } finally { lock.releaseLock(); }
}

function apiChangePassword_(body) {
  var me = checkAuth_(body.auth, false);
  var pw = String(body.newPassword || '');
  if (pw.length < 6) throw err_('VALIDATION', 'Password baru minimal 6 karakter.');
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var tb = readTable_(USERS);
    var ex = tb.rows.filter(function (r) { return low_(r.obj.username) === low_(me.username); })[0];
    var row = ex.obj;
    row.password = pw;
    row.updatedAt = stamp_(new Date());
    ex.arr = toArr_(USERS, tb.idx, row, ex.arr, tb.width);
    flush_(tb, [ex], []);
    writeLogs_([[stamp_(new Date()), me.username, 'Ganti password', '', String(body.device || '')]]);
    REQ_ = {};
    return { ok: true, users: publicUsers_() };
  } finally { lock.releaseLock(); }
}

function allUsers_() {
  if (!REQ_.users) REQ_.users = readTable_(USERS).rows.map(function (r) { var u = r.obj; u.username = low_(u.username).trim(); u.peran = normRole_(u.peran); return u; });
  return REQ_.users;
}

function publicUsers_() {
  var list = allUsers_().filter(function (u) { return u.username && u.aktif && u.password && u.peran; });
  var keys = keysForAll_(list);
  return list.map(function (u) { return publicUser_(u, keys[u.username].v); });
}
function publicUser_(u, v) { return { username: u.username, nama: u.nama, peran: u.peran, kelasWali: u.kelasWali, nip: u.nip, aktif: u.aktif, v: v }; }

function checkAuth_(auth, optional) {
  if (!auth || !auth.u || !auth.t) { if (optional) return null; throw err_('AUTH', 'Silakan login terlebih dahulu.'); }
  var u = allUsers_().filter(function (x) { return x.username === low_(auth.u).trim(); })[0];
  if (u && u.aktif && u.password && u.peran) {
    var k = keysForAll_([u])[u.username];
    if (k.t === String(auth.t)) return u;
  }
  if (optional) return null;
  throw err_('AUTH', 'Sesi login tidak berlaku (password diganti atau akun dinonaktifkan). Silakan login ulang.');
}

// Turunan password disimpan di cache 6 jam (kunci = hash password) agar tidak dihitung ulang setiap permintaan.
function keysForAll_(users) {
  var salt = getSalt_();
  var cache = CacheService.getScriptCache();
  var ck = users.map(function (u) { return 'k1:' + sha256hex_(salt + '|' + u.username + '|' + u.password); });
  var hit = ck.length ? (cache.getAll(ck) || {}) : {};
  var out = {}, put = {};
  users.forEach(function (u, i) {
    var c = hit[ck[i]];
    if (c) { var p = c.split(','); out[u.username] = { v: p[0], t: p[1] }; return; }
    var v = derive_('v', salt, u.username, u.password), t = derive_('t', salt, u.username, u.password);
    out[u.username] = { v: v, t: t };
    put[ck[i]] = v + ',' + t;
  });
  if (Object.keys(put).length) cache.putAll(put, 21600);
  return out;
}

function derive_(kind, salt, username, password) {
  var h = kind + '|' + salt + '|' + String(username).trim().toLowerCase() + '|' + password;
  for (var i = 0; i < HASH_ITER; i++) h = sha256hex_(h);
  return h;
}
function sha256hex_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < b.length; i++) { var x = (b[i] + 256) % 256; out += (x < 16 ? '0' : '') + x.toString(16); }
  return out;
}
function getSalt_() {
  var p = PropertiesService.getScriptProperties();
  var s = p.getProperty('SALT');
  if (!s) { s = Utilities.getUuid().replace(/-/g, '').slice(0, 16); p.setProperty('SALT', s); }
  return s;
}

function isMgr_(u) { return !!u && MGR.indexOf(u.peran) >= 0; }
function isAdmin_(u) { return !!u && u.peran === 'Admin'; }
function canSiswa_(u) { return !!u && (u.peran === 'Admin' || u.peran === 'Guru BK'); }
function canTindak_(u, kelas) {
  if (isMgr_(u)) return true;
  if (!u || u.peran !== 'Wali Kelas') return false;
  var list = String(u.kelasWali || '').split(/[,;]/).map(function (s) { return s.trim().toLowerCase(); });
  return list.indexOf(String(kelas || '').trim().toLowerCase()) >= 0;
}
function rulesOnly_(ctx) { if (!(ctx.user.peran === 'Admin' || ctx.user.peran === 'Kepala Sekolah')) throw err_('FORBIDDEN', 'Hanya Admin atau Kepala Sekolah yang boleh mengubah aturan.'); }
function normRole_(p) {
  var s = low_(p).replace(/\s+/g, ' ').trim();
  for (var i = 0; i < ROLES.length; i++) if (ROLES[i].toLowerCase() === s) return ROLES[i];
  if (s === 'kepsek') return 'Kepala Sekolah';
  if (s === 'bk' || s === 'guru bk/konselor' || s === 'konselor') return 'Guru BK';
  if (s === 'wali' || s === 'walikelas') return 'Wali Kelas';
  return '';
}
function used_(ctx, table, field, key) { return !!findRow_(ctx, table, field, key); }
function findRow_(ctx, table, field, key) {
  if (!ctx.cache[table]) ctx.cache[table] = objs_(readTable_(TABLES[table]));
  return ctx.cache[table].filter(function (r) { return String(r[field]) === String(key); })[0] || null;
}

// ----------------------------------------------------------------------------- pembacaan & penulisan sheet
function readSettings_() {
  if (REQ_.settings) return REQ_.settings;
  var s = {};
  DEFAULT_SETTINGS.forEach(function (d) { s[d[0]] = d[1]; });
  objs_(readTable_(TABLES.pengaturan)).forEach(function (r) { if (r.kunci) s[r.kunci] = r.nilai; });
  REQ_.settings = s;
  return s;
}
function settingInfo_(key) { var d = DEFAULT_SETTINGS.filter(function (x) { return x[0] === key; })[0]; return d ? d[2] : ''; }

function objs_(tb) { return tb.rows.map(function (r) { return r.obj; }); }

function readTable_(def, ensureIds) {
  var sh = ensureSheet_(def);
  var width = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, width).getValues()[0];
  var idx = colIndex_(def, head);
  var last = sh.getLastRow();
  var vals = last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
  var rows = [], fix = [];
  for (var i = 0; i < vals.length; i++) {
    var arr = vals[i];
    if (!arr.some(function (v) { return v !== '' && v !== null; })) continue;
    var row = { r: i + 2, arr: arr, obj: toObj_(def, idx, arr) };
    if (!row.obj[def.key]) {
      if (!(ensureIds && def.idPrefix)) continue; // baris tanpa kunci diabaikan
      row.obj[def.key] = def.idPrefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      if (def.rev) row.obj._rev = Date.now();
      row.arr = toArr_(def, idx, row.obj, arr, width);
      fix.push(row);
    }
    rows.push(row);
  }
  var tb = { def: def, sh: sh, head: head, idx: idx, rows: rows, width: width, vals: vals };
  if (fix.length) flush_(tb, fix, []); // baris yang diketik manual di sheet diberi ID otomatis
  return tb;
}

function ensureSheet_(def) {
  if (REQ_['sh:' + def.sheet]) return REQ_['sh:' + def.sheet];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(def.sheet) || ss.insertSheet(def.sheet);
  var width = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  var used = head.filter(function (h) { return h !== ''; }).length;
  var missing = def.cols.filter(function (c) { return !head.some(function (h) { return sameHead_(h, c); }); });
  if (missing.length) {
    var start = used ? sh.getLastColumn() + 1 : 1;
    sh.getRange(1, start, 1, missing.length).setValues([missing.map(function (c) { return c[1]; })]);
    sh.getRange(1, 1, 1, start + missing.length - 1).setFontWeight('bold').setBackground('#0B1B33').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    var rows = Math.max(sh.getMaxRows(), 2);
    missing.forEach(function (c, i) {
      sh.getRange(1, start + i, rows, 1).setNumberFormat(c[2] === 'n' ? '0' : '@');
      sh.setColumnWidth(start + i, c[0] === 'uraian' || c[0] === 'kronologi' || c[0] === 'tindakan' || c[0] === 'detail' || c[0] === 'keterangan' ? 320 : c[0] === 'nama' || c[0] === 'nilai' ? 200 : 120);
    });
  }
  REQ_['sh:' + def.sheet] = sh;
  return sh;
}

function sameHead_(h, c) { var n = String(h).trim().toLowerCase(); return n === c[1].toLowerCase() || n === c[0].toLowerCase(); }
function colIndex_(def, head) {
  var idx = {};
  def.cols.forEach(function (c) {
    idx[c[0]] = -1;
    for (var i = 0; i < head.length; i++) if (sameHead_(head[i], c)) { idx[c[0]] = i; break; }
  });
  return idx;
}

function toObj_(def, idx, arr) {
  var o = {};
  def.cols.forEach(function (c) { var i = idx[c[0]]; o[c[0]] = readVal_(i >= 0 ? arr[i] : '', c[2], c[3]); });
  return o;
}
function readVal_(v, type, dflt) {
  if (type === 'b') return toBool_(v, dflt === undefined ? false : dflt);
  if (type === 'n') { if (v === '' || v === null || v === undefined) return ''; var n = Number(v); return isNaN(n) ? '' : n; }
  if (Object.prototype.toString.call(v) === '[object Date]') return fmt_(v, type === 'd' ? 'yyyy-MM-dd' : type === 'tm' ? 'HH:mm' : 'yyyy-MM-dd HH:mm:ss');
  var s = v === null || v === undefined ? '' : String(v).trim();
  if (type === 'd') { var m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s); if (m) s = m[3] + '-' + pad_(m[2]) + '-' + pad_(m[1]); }
  if (type === 'tm') { var t = /^(\d{1,2})[:.](\d{2})/.exec(s); if (t) s = pad_(t[1]) + ':' + t[2]; }
  return s;
}
function writeVal_(v, type) {
  if (type === 'b') return v ? 'Ya' : 'Tidak';
  if (type === 'n') return v === '' || v === null || v === undefined || isNaN(Number(v)) ? '' : Number(v);
  return v === null || v === undefined ? '' : String(v);
}
function toArr_(def, idx, obj, base, width) {
  var arr = base ? base.slice() : [];
  while (arr.length < width) arr.push('');
  def.cols.forEach(function (c) { var i = idx[c[0]]; if (i >= 0) arr[i] = writeVal_(obj[c[0]], c[2]); });
  return arr;
}
function pick_(def, inp) {
  var o = {};
  def.cols.forEach(function (c) {
    if (c[0] === 'updatedAt' || c[0] === 'updatedBy' || c[0] === '_rev') return;
    var v = inp[c[0]];
    o[c[0]] = c[2] === 'b' ? toBool_(v, c[3] === undefined ? false : c[3]) : c[2] === 'n' ? (v === '' || v == null ? '' : Number(v)) : String(v == null ? '' : v).trim().slice(0, 4000);
  });
  if (def === TABLES.pengaturan) o.nilai = String(inp.nilai == null ? '' : inp.nilai);
  return o;
}

/** Tulis baris yang berubah (per baris, atau sekaligus bila banyak) dan tambahkan baris baru di bawah. */
function flush_(tb, dirty, added) {
  dirty.forEach(function (row) { tb.vals[row.r - 2] = row.arr; });
  if (dirty.length > 15) {
    var block = tb.vals.map(function (a) { var x = a.slice(); while (x.length < tb.width) x.push(''); return x.slice(0, tb.width); });
    if (block.length) tb.sh.getRange(2, 1, block.length, tb.width).setValues(block);
  } else {
    dirty.forEach(function (row) { tb.sh.getRange(row.r, 1, 1, tb.width).setValues([row.arr.slice(0, tb.width)]); });
  }
  if (added.length) {
    var start = tb.sh.getLastRow() + 1;
    tb.sh.getRange(start, 1, added.length, tb.width).setValues(added.map(function (e) { return e.arr.slice(0, tb.width); }));
    added.forEach(function (e, i) { e.r = start + i; });
  }
}

function log_(ctx, aksi, detail) { ctx.logs.push([ctx.stamp, ctx.user.username, aksi, String(detail).slice(0, 300), ctx.device]); }
function writeLogs_(rows) {
  if (!rows.length) return;
  var sh = ensureSheet_(LOG);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// ----------------------------------------------------------------------------- utilitas
function low_(s) { return String(s == null ? '' : s).toLowerCase(); }
function pad_(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
function toBool_(v, d) {
  if (v === true || v === false) return v;
  var s = low_(v).trim();
  if (!s) return d;
  return ['ya', 'y', 'true', '1', 'aktif', 'yes'].indexOf(s) >= 0;
}
function isYmd_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function tz_() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Asia/Makassar'; }
function fmt_(d, f) { return Utilities.formatDate(d, tz_(), f); }
function stamp_(d) { return fmt_(d, 'yyyy-MM-dd HH:mm:ss'); }
function parseStamp_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : null;
}

// ----------------------------------------------------------------------------- pemasangan
/** Jalankan sekali dari editor Apps Script. Aman dijalankan ulang (hanya melengkapi yang kurang). */
function setup() {
  REQ_ = {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var msg = [];
  [USERS, TABLES.pengaturan, TABLES.kategori, TABLES.jenis, TABLES.sanksi, TABLES.siswa, TABLES.pelanggaran, TABLES.tindak, LOG].forEach(ensureSheet_);
  var now = stamp_(new Date());

  var seed = function (def, rows, label) {
    var tb = readTable_(def);
    if (tb.rows.length) return;
    flush_(tb, [], rows.map(function (o) { o.updatedAt = now; o.updatedBy = 'setup'; return { r: 0, arr: toArr_(def, tb.idx, o, null, tb.width) }; }));
    msg.push('✓ ' + rows.length + ' ' + label + ' bawaan dibuat');
  };
  var d = new Date(), y = d.getFullYear(), ganjil = d.getMonth() >= 6;
  seed(TABLES.pengaturan, DEFAULT_SETTINGS.map(function (s) {
    var v = s[0] === 'tahunAjaran' ? (ganjil ? y + '/' + (y + 1) : (y - 1) + '/' + y) : s[0] === 'semester' ? (ganjil ? 'Ganjil' : 'Genap') : s[1];
    return { kunci: s[0], nilai: v, keterangan: s[2] };
  }), 'pengaturan');
  seed(TABLES.kategori, DEFAULT_KATEGORI.map(function (k, i) { return { kode: k[0], nama: k[1], urutan: i + 1, aktif: true }; }), 'kategori');
  seed(TABLES.jenis, DEFAULT_JENIS.map(function (j) {
    return { kode: String(j[0]), kategori: j[1], uraian: j[2], poin: j[3], poinMaks: j[4], tingkat: j[5], zt: false, aktif: true, urutan: j[0] };
  }), 'jenis pelanggaran');
  seed(TABLES.sanksi, DEFAULT_SANKSI.map(function (s) {
    return { kode: s[0], min: s[1], label: s[2], tindakan: s[3], pj: s[4], surat: s[5], warna: s[6] };
  }), 'tahap sanksi');

  var ut = readTable_(USERS);
  if (!ut.rows.length) {
    var pw = 'krisba' + Math.floor(1000 + Math.random() * 9000);
    flush_(ut, [], [{ r: 0, arr: toArr_(USERS, ut.idx, { username: 'admin', nama: 'Administrator', password: pw, peran: 'Admin', aktif: true, updatedAt: now }, null, ut.width) }]);
    msg.push('✓ Akun admin dibuat → username: admin · password: ' + pw + ' (ganti segera; terlihat di sheet "Pengguna")');
  }
  ['Sheet1', 'Lembar1', 'Sheet 1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  buildRekapSheet_();
  getSalt_();
  msg.push('✓ Server siap. Langkah berikutnya: Terapkan → Deployment baru → Aplikasi web (akses: Siapa saja).');
  var text = msg.join('\n');
  try { SpreadsheetApp.getUi().alert('Tata Tertib — Setup selesai', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (x) { Logger.log(text); }
  return text;
}

/** Sheet "Rekap Poin Siswa" berisi rumus QUERY (otomatis ikut data) agar admin bisa melihat rekap langsung di Sheets. */
function buildRekapSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = 'Rekap Poin Siswa';
  if (ss.getSheetByName(name)) return;
  var tb = readTable_(TABLES.pelanggaran);
  var L = function (key) { var i = tb.idx[key]; var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  var src = "'" + TABLES.pelanggaran.sheet + "'!A:" + L('_rev');
  var q = 'select ' + L('siswaId') + ', ' + L('nama') + ', ' + L('kelas') + ', sum(' + L('poin') + '), count(' + L('id') + ') where ' + L('id') +
    " <> '' and (" + L('batal') + " is null or " + L('batal') + " <> 'Ya') group by " + L('siswaId') + ', ' + L('nama') + ', ' + L('kelas') +
    ' order by sum(' + L('poin') + ') desc label sum(' + L('poin') + ") 'Total Poin', count(" + L('id') + ") 'Jumlah Pelanggaran'";
  var sh = ss.insertSheet(name);
  sh.getRange('A1').setValue('Rekap otomatis dari sheet "Catatan Pelanggaran" (catatan yang dibatalkan tidak dihitung). Jangan diketik manual.');
  sh.getRange('A3').setFormula('=IFERROR(QUERY(' + src + ', "' + q + '", 1), "Belum ada data")');
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Tata Tertib')
      .addItem('Siapkan / perbaiki sheet', 'setup')
      .addItem('Info server', 'infoServer')
      .addToUi();
  } catch (x) { /* dibuka tanpa UI */ }
}
function infoServer() {
  SpreadsheetApp.getUi().alert('Server Tata Tertib v' + SERVER_VERSION + '\nZona waktu spreadsheet: ' + tz_() +
    '\nSaran: File → Setelan → Zona waktu = (GMT+08:00) Makassar agar jam di sheet sesuai WITA.');
}

/** Pemicu sederhana: baris yang diedit langsung di sheet ditandai agar ikut terkirim ke HP saat sinkron berikutnya. */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    var name = sh.getName();
    if (name !== TABLES.pelanggaran.sheet && name !== TABLES.tindak.sheet) return;
    if (e.range.getRow() < 2) return;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var c = -1;
    for (var i = 0; i < head.length; i++) if (String(head[i]).trim() === '_rev') c = i + 1;
    if (c < 0 || (e.range.getColumn() === c && e.range.getNumColumns() === 1)) return;
    var n = e.range.getNumRows(), now = Date.now(), vals = [];
    for (var k = 0; k < n; k++) vals.push([now]);
    sh.getRange(e.range.getRow(), c, n, 1).setValues(vals);
  } catch (x) { /* abaikan */ }
}
