/**
 * BACKEND E-RAPORT SMP KRISTEN 65 BASAAN
 * Google Apps Script + Google Spreadsheet sebagai database.
 *
 * Cara pasang (lihat README.md untuk lengkapnya):
 * 1. Buat Google Spreadsheet baru -> Ekstensi -> Apps Script.
 * 2. Hapus isi Code.gs bawaan, tempel seluruh isi file ini, simpan.
 * 3. Jalankan fungsi setupSheets() sekali (izinkan akses).
 * 4. Terapkan -> Deployment baru -> Aplikasi Web
 *    - Jalankan sebagai: Saya
 *    - Yang memiliki akses: Siapa saja
 * 5. Salin URL Aplikasi Web ke js/config.js (API_URL).
 *
 * Setiap kali file ini diubah, buat versi deployment baru
 * (Kelola deployment -> Edit -> Versi: Baru) agar perubahan aktif.
 *
 * Versi API 4 (v3.2): kolom Hadir & Kokurikuler di sheet Pelengkap. Kolom baru
 * ditambahkan otomatis di ujung kanan sheet lama saat data pertama kali disimpan.
 */

// Harus sama dengan API_KEY di js/config.js
const KUNCI_API = 'krisba-raport-2026';

// Dibaca aplikasi untuk memastikan backend sudah versi terbaru
const API_VERSION = 4;

const SHEETS = {
  Pengaturan: ['Kunci', 'Nilai'],
  Kelas: ['Kelas', 'Label_Raport', 'Wali_Kelas', 'NIP_Wali', 'Urut'],
  Mapel: ['Kode', 'Nama', 'Kelompok', 'KKM', 'Urut', 'Aktif'],
  Siswa: ['NISN', 'NIS', 'Nama', 'Kelas', 'JK', 'No_Absen'],
  Nilai: ['ID', 'NISN', 'Kelas', 'Kode_Mapel', 'Nilai', 'Nilai_Keterampilan',
          'Deskripsi_Dikuasai', 'Deskripsi_Ditingkatkan', 'Guru', 'Diperbarui'],
  Deskripsi: ['ID', 'Kode_Mapel', 'Tingkat', 'Teks', 'Dibuat_Oleh', 'Diperbarui'],
  Pelengkap: ['NISN', 'Spiritual_Predikat', 'Spiritual_Deskripsi', 'Sosial_Predikat', 'Sosial_Deskripsi',
              'Ekskul1', 'Ekskul1_Nilai', 'Ekskul1_Deskripsi', 'Ekskul2', 'Ekskul2_Nilai', 'Ekskul2_Deskripsi',
              'Sakit', 'Izin', 'Alpa', 'Keputusan', 'Catatan_Wali', 'Diperbarui',
              // v3.2: kolom baru selalu di ujung agar sheet lama tetap cocok
              'Hadir', 'Kokurikuler_Nilai', 'Kokurikuler_Kuat', 'Kokurikuler_Lemah', 'Kokurikuler_Deskripsi'],
  Log: ['Waktu', 'Pengguna', 'Peran', 'Aksi', 'Detail'],
  // Catatan siswa / orang tua yang datang mengambil raport
  Pengambilan: ['NISN', 'Nama', 'Kelas', 'Status', 'Tanggal', 'Pengambil', 'Hubungan', 'No_HP', 'Catatan', 'Petugas', 'Diperbarui']
};

// Kolom yang harus disimpan sebagai teks (agar angka 0 di depan NISN tidak hilang)
const TEXT_COLUMNS = {
  Siswa: ['NISN', 'NIS', 'Kelas'],
  Log: [],
  Nilai: ['ID', 'NISN', 'Kelas', 'Kode_Mapel', 'Diperbarui'],
  Pelengkap: ['NISN', 'Diperbarui'],
  Kelas: ['Kelas', 'NIP_Wali'],
  Mapel: ['Kode'],
  Pengaturan: ['Kunci', 'Nilai'],
  Deskripsi: ['ID', 'Kode_Mapel', 'Tingkat', 'Diperbarui'],
  Pengambilan: ['NISN', 'Kelas', 'Tanggal', 'No_HP', 'Diperbarui']
};

// Kunci-kunci tabel (untuk upsert)
const KEYS = {
  Siswa: 'NISN',
  Nilai: 'ID',
  Deskripsi: 'ID',
  Pelengkap: 'NISN',
  Kelas: 'Kelas',
  Mapel: 'Kode',
  Pengambilan: 'NISN'
};

/* =============================================================
   ENTRY POINTS
   ============================================================= */

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return jsonOut({ ok: true, data: { pong: true, time: new Date().toISOString() } });
  return ContentService.createTextOutput('API E-Raport SMP Kristen 65 Basaan aktif. Gunakan aplikasi web untuk mengakses data.');
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, message: 'Format permintaan tidak valid' });
  }
  if (req.key !== KUNCI_API) return jsonOut({ ok: false, message: 'Kunci API salah. Samakan API_KEY di js/config.js dengan KUNCI_API di Code.gs' });

  const lock = LockService.getScriptLock();
  const isWrite = req.action !== 'getAll' && req.action !== 'ping' && req.action !== 'getLog' && req.action !== 'cekNilai' && req.action !== 'cekDaftar';
  try {
    if (isWrite) lock.waitLock(30000);
    const data = handle(req);
    return jsonOut({ ok: true, data: data });
  } catch (err) {
    return jsonOut({ ok: false, message: String(err && err.message ? err.message : err) });
  } finally {
    if (isWrite) {
      try { lock.releaseLock(); } catch (e2) { /* abaikan */ }
    }
  }
}

function handle(req) {
  ensureSheets();
  const user = req.user || '-';
  const role = req.role || '-';
  switch (req.action) {
    case 'ping':
      return { pong: true, time: new Date().toISOString() };

    case 'getAll':
      return getAll();

    case 'seed':
      return seed(req.data, user, role);

    case 'syncNilai': {
      const res = upsertWithTime('Nilai', (req.rows || []).map(normalizeNilai));
      log(user, role, 'Sinkron Nilai', res.saved + ' disimpan, ' + res.skipped + ' dilewati' + (req.info ? ' | ' + req.info : ''));
      return res;
    }

    case 'deleteNilai': {
      const n = deleteByKeys('Nilai', req.ids || []);
      log(user, role, 'Hapus Nilai', n + ' baris');
      return { deleted: n };
    }

    case 'saveDeskripsi': {
      const res = upsertWithTime('Deskripsi', req.rows || []);
      log(user, role, 'Simpan Deskripsi', res.saved + ' deskripsi');
      return res;
    }

    case 'deleteDeskripsi': {
      const n = deleteByKeys('Deskripsi', req.ids || []);
      log(user, role, 'Hapus Deskripsi', n + ' deskripsi');
      return { deleted: n };
    }

    case 'saveSiswa': {
      let res;
      if (req.mode === 'replace') {
        writeTable('Siswa', req.rows || []);
        res = { saved: (req.rows || []).length };
      } else {
        res = upsert('Siswa', req.rows || []);
      }
      log(user, role, 'Simpan Siswa', res.saved + ' siswa (' + (req.mode || 'gabung') + ')');
      return res;
    }

    case 'deleteSiswa': {
      const n = deleteByKeys('Siswa', req.ids || []);
      if (req.withNilai) {
        const ids = req.ids.map(String);
        const nilai = readTable('Nilai').filter(r => ids.indexOf(String(r.NISN)) < 0);
        writeTable('Nilai', nilai);
        deleteByKeys('Pelengkap', req.ids);
      }
      log(user, role, 'Hapus Siswa', n + ' siswa');
      return { deleted: n };
    }

    case 'saveMapel':
      writeTable('Mapel', req.rows || []);
      log(user, role, 'Simpan Mapel', (req.rows || []).length + ' mapel');
      return { saved: (req.rows || []).length };

    case 'saveKelas':
      writeTable('Kelas', req.rows || []);
      log(user, role, 'Simpan Kelas', (req.rows || []).length + ' kelas');
      return { saved: (req.rows || []).length };

    case 'saveConfig':
      saveConfig(req.config || {});
      log(user, role, 'Simpan Pengaturan', Object.keys(req.config || {}).length + ' kunci');
      return { saved: true };

    case 'savePelengkap': {
      const res = upsert('Pelengkap', (req.rows || []).map(r => { r.NISN = String(r.NISN || '').trim(); return r; }));
      log(user, role, 'Simpan Pelengkap Raport', res.saved + ' siswa' + (req.info ? ' | ' + req.info : ''));
      return res;
    }

    case 'getLog':
      return readTable('Log').slice(-(req.limit || 300)).reverse();

    case 'savePengambilan': {
      const res = upsertWithTime('Pengambilan', (req.rows || []).map(r => { r.NISN = String(r.NISN || '').trim(); return r; }));
      log(user, role, 'Pengambilan Raport', res.saved + ' disimpan, ' + res.skipped + ' dilewati' + (req.info ? ' | ' + req.info : ''));
      return res;
    }

    case 'deletePengambilan': {
      const n = deleteByKeys('Pengambilan', req.ids || []);
      log(user, role, 'Hapus Pengambilan', n + ' baris');
      return { deleted: n };
    }

    // Halaman Cek_Nilai.html: siswa hanya menerima data miliknya sendiri
    case 'cekDaftar':
      return cekDaftar();

    case 'cekNilai':
      return cekNilai(req.nisn);

    case 'restore':
      restore(req.data || {});
      log(user, role, 'Pulihkan Backup', 'Seluruh data diganti dari file backup');
      return { restored: true };

    default:
      throw new Error('Aksi tidak dikenal: ' + req.action);
  }
}

/* =============================================================
   SETUP
   ============================================================= */

// Jalankan sekali dari editor Apps Script
function setupSheets() {
  ensureSheets();
  SpreadsheetApp.getActiveSpreadsheet().toast('Sheet database siap. Silakan deploy sebagai Aplikasi Web.', 'E-Raport', 8);
}

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      const headers = SHEETS[name];
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      (TEXT_COLUMNS[name] || []).forEach(col => {
        const idx = headers.indexOf(col);
        if (idx >= 0) sh.getRange(1, idx + 1, sh.getMaxRows(), 1).setNumberFormat('@');
      });
    }
  });
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
}

function seed(data, user, role) {
  if (!data) throw new Error('Data awal kosong');
  if (readTable('Mapel').length > 0) return { seeded: false, message: 'Data sudah ada' };
  if (data.config) saveConfig(data.config);
  if (data.kelas) writeTable('Kelas', data.kelas);
  if (data.mapel) writeTable('Mapel', data.mapel);
  if (data.deskripsi && readTable('Deskripsi').length === 0) writeTable('Deskripsi', data.deskripsi);
  log(user, role, 'Isi Data Awal', 'Pengaturan, kelas, mapel & bank deskripsi bawaan');
  return { seeded: true };
}

/* =============================================================
   DATA ACCESS
   ============================================================= */

function getAll() {
  const cfgRows = readTable('Pengaturan');
  const config = {};
  cfgRows.forEach(r => { if (r.Kunci) config[r.Kunci] = r.Nilai; });
  return {
    config: config,
    kelas: readTable('Kelas'),
    mapel: readTable('Mapel'),
    siswa: readTable('Siswa'),
    nilai: readTable('Nilai'),
    deskripsi: readTable('Deskripsi'),
    pelengkap: readTable('Pelengkap'),
    pengambilan: readTable('Pengambilan'),
    serverTime: new Date().toISOString(),
    apiVersion: API_VERSION
  };
}

function sheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function readTable(name) {
  const sh = sheet(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const headers = values[0].map(String);
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(v => v === '' || v === null)) continue;
    const obj = {};
    headers.forEach((h, j) => {
      let v = row[j];
      if (v instanceof Date) v = v.toISOString();
      obj[h] = v;
    });
    out.push(obj);
  }
  return out;
}

// Pastikan baris judul memuat semua kolom SHEETS[name]. Kolom yang belum ada
// (sheet dibuat versi lama) ditambahkan di ujung kanan; urutan kolom lama tidak diubah.
function syncHeaders(sh, wanted) {
  const lastCol = sh.getLastColumn();
  const cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()) : [];
  while (cur.length && !cur[cur.length - 1]) cur.pop();
  const missing = wanted.filter(h => cur.indexOf(h) < 0);
  if (missing.length) {
    sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing])
      .setFontWeight('bold').setBackground('#1e3a8a').setFontColor('#ffffff');
  }
  return cur.concat(missing);
}

function writeTable(name, rows) {
  const sh = sheet(name);
  const headers = syncHeaders(sh, SHEETS[name]);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, Math.max(sh.getLastColumn(), headers.length)).clearContent();
  if (!rows.length) return;
  const textCols = TEXT_COLUMNS[name] || [];
  const values = rows.map(r => headers.map(h => {
    const v = cellValue(r[h]);
    return textCols.indexOf(h) >= 0 ? String(v) : v;
  }));
  textCols.forEach(col => {
    const idx = headers.indexOf(col);
    if (idx >= 0) sh.getRange(2, idx + 1, values.length, 1).setNumberFormat('@');
  });
  sh.getRange(2, 1, values.length, headers.length).setValues(values);
}

function cellValue(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function upsert(name, rows) {
  const key = KEYS[name];
  const all = readTable(name);
  const index = {};
  all.forEach((r, i) => { index[String(r[key])] = i; });
  let saved = 0;
  rows.forEach(r => {
    const k = String(r[key] || '').trim();
    if (!k) return;
    r[key] = k;
    if (index[k] !== undefined) {
      all[index[k]] = Object.assign({}, all[index[k]], r);
    } else {
      index[k] = all.length;
      all.push(r);
    }
    saved++;
  });
  writeTable(name, all);
  return { saved: saved };
}

// Upsert yang hanya menimpa bila data masuk lebih baru (kolom Diperbarui)
function upsertWithTime(name, rows) {
  const key = KEYS[name];
  const all = readTable(name);
  const index = {};
  all.forEach((r, i) => { index[String(r[key])] = i; });
  let saved = 0, skipped = 0;
  rows.forEach(r => {
    const k = String(r[key] || '').trim();
    if (!k) return;
    r[key] = k;
    if (!r.Diperbarui) r.Diperbarui = new Date().toISOString();
    if (index[k] !== undefined) {
      const old = all[index[k]];
      if (old.Diperbarui && String(old.Diperbarui) > String(r.Diperbarui)) { skipped++; return; }
      all[index[k]] = Object.assign({}, old, r);
    } else {
      index[k] = all.length;
      all.push(r);
    }
    saved++;
  });
  writeTable(name, all);
  return { saved: saved, skipped: skipped };
}

function deleteByKeys(name, ids) {
  const key = KEYS[name];
  const set = {};
  ids.forEach(id => { set[String(id)] = true; });
  const all = readTable(name);
  const kept = all.filter(r => !set[String(r[key])]);
  writeTable(name, kept);
  return all.length - kept.length;
}

function normalizeNilai(r) {
  r.NISN = String(r.NISN || '').trim();
  r.Kode_Mapel = String(r.Kode_Mapel || '').trim();
  r.ID = r.NISN + '|' + r.Kode_Mapel;
  return r;
}

function saveConfig(cfg) {
  const rows = readTable('Pengaturan');
  const map = {};
  rows.forEach(r => { map[r.Kunci] = r.Nilai; });
  Object.keys(cfg).forEach(k => {
    let v = cfg[k];
    if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
    map[k] = v;
  });
  writeTable('Pengaturan', Object.keys(map).map(k => ({ Kunci: k, Nilai: map[k] })));
}

function restore(data) {
  if (data.config) {
    writeTable('Pengaturan', []);
    saveConfig(data.config);
  }
  ['Kelas', 'Mapel', 'Siswa', 'Nilai', 'Deskripsi', 'Pelengkap', 'Pengambilan'].forEach(name => {
    const k = name.toLowerCase();
    if (Array.isArray(data[k])) writeTable(name, data[k]);
  });
}

/* =============================================================
   CEK NILAI SISWA (Cek_Nilai.html) - hanya membaca, sama dengan cekNilaiFromRaw di js/core.js
   ============================================================= */

function cnStr(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function cnNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function cnBool(v, def) {
  if (v === true || v === false) return v;
  if (v === undefined || v === null || v === '') return def;
  const s = String(v).toLowerCase();
  return s === 'true' || s === 'y' || s === 'ya' || s === '1';
}

function cnTingkat(kelas) {
  const m = String(kelas || '').match(/\d+/);
  return m ? m[0] : '';
}

function cnSama(a, b) {
  const x = cnStr(a).toUpperCase(), y = cnStr(b).toUpperCase();
  if (!x || !y) return false;
  return x === y || (/^\d+$/.test(x) && /^\d+$/.test(y) && x.replace(/^0+/, '') === y.replace(/^0+/, ''));
}

function cnConfig() {
  const cfg = {};
  readTable('Pengaturan').forEach(r => { if (r.Kunci) cfg[r.Kunci] = r.Nilai; });
  if (cnBool(cfg.cek_nilai_aktif, true) === false) throw new Error('Halaman cek nilai sedang ditutup oleh sekolah. Silakan coba lagi nanti.');
  return cfg;
}

// Daftar kelas & nama siswa untuk dipilih di halaman Cek Nilai
function cekDaftar() {
  const cfg = cnConfig();
  const kelasRows = readTable('Kelas').map(k => ({ kelas: cnStr(k.Kelas).toUpperCase(), wali: cnStr(k.Wali_Kelas), urut: cnNum(k.Urut) || 99 }))
    .filter(k => k.kelas);
  const siswa = readTable('Siswa').filter(x => cnStr(x.NISN) && cnStr(x.Nama))
    .map(x => ({ nisn: cnStr(x.NISN), nama: cnStr(x.Nama).toUpperCase(), kelas: cnStr(x.Kelas).toUpperCase() }))
    .sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  siswa.forEach(s => { if (!kelasRows.some(k => k.kelas === s.kelas)) kelasRows.push({ kelas: s.kelas, wali: '', urut: 99 }); });
  kelasRows.sort((a, b) => (a.urut - b.urut) || a.kelas.localeCompare(b.kelas));
  return {
    sekolah: { nama: cfg.nama_sekolah, semester: cfg.semester, tahun_ajaran: cfg.tahun_ajaran },
    kelas: kelasRows.map(k => ({ kelas: k.kelas, wali: k.wali, jumlah: siswa.filter(s => s.kelas === k.kelas).length })).filter(k => k.jumlah),
    siswa: siswa,
    serverTime: new Date().toISOString()
  };
}

function cekNilai(nisn) {
  const cfg = cnConfig();
  const siswa = readTable('Siswa').filter(x => cnStr(x.NISN) && cnStr(x.Nama));
  const s = siswa.filter(x => cnSama(x.NISN, nisn))[0];
  const nis = s ? cnStr(s.NIS) : '';
  if (!s) throw new Error('Data siswa tidak ditemukan. Muat ulang daftar nama.');

  const terpisah = cfg.mode_keterampilan === 'terpisah';
  const mapel = readTable('Mapel').map(m => ({
    kode: cnStr(m.Kode).toUpperCase(), nama: cnStr(m.Nama), kelompok: cnStr(m.Kelompok).toUpperCase() || 'A',
    kkm: cnNum(m.KKM) || 75, urut: cnNum(m.Urut) || 99, aktif: cnBool(m.Aktif, true)
  })).filter(m => m.kode && m.aktif).sort((a, b) => (a.urut - b.urut) || a.nama.localeCompare(b.nama));
  const nil = {};
  readTable('Nilai').forEach(r => {
    const id = cnStr(r.NISN) + '|' + cnStr(r.Kode_Mapel).toUpperCase();
    nil[id] = {
      nilai: cnNum(r.Nilai), nilai_k: cnNum(r.Nilai_Keterampilan),
      kuasai: cnStr(r.Deskripsi_Dikuasai), tingkatkan: cnStr(r.Deskripsi_Ditingkatkan)
    };
  });

  const r1 = v => Math.round(v * 10) / 10;
  const r2 = v => Math.round(v * 100) / 100;
  const hitung = x => {
    let total = 0, count = 0, countP = 0;
    mapel.forEach(m => {
      const n = nil[cnStr(x.NISN) + '|' + m.kode];
      const p = n ? n.nilai : null;
      const k = n ? (terpisah ? n.nilai_k : p) : null;
      if (p !== null) { total += p; count++; countP++; }
      if (k !== null) { total += k; count++; }
    });
    return { total: r1(total), count: count, countP: countP, average: count ? r2(total / count) : 0 };
  };
  const rankIn = list => {
    const arr = list.map(x => Object.assign({ nisn: cnStr(x.NISN) }, hitung(x)))
      .sort((a, b) => (b.total - a.total) || (b.average - a.average));
    let rank = 0;
    arr.forEach((r, i) => {
      if (!(i > 0 && r.total === arr[i - 1].total && r.average === arr[i - 1].average)) rank = i + 1;
      r.rank = rank;
    });
    const me = arr.filter(r => r.nisn === cnStr(s.NISN))[0];
    return { rank: me ? me.rank : 0, dari: arr.length };
  };

  const kelas = cnStr(s.Kelas).toUpperCase();
  const tingkat = cnTingkat(kelas);
  const ringkasan = Object.assign({ jumlahMapel: mapel.length }, hitung(s));
  const tampilRanking = cnBool(cfg.cek_nilai_ranking, true) !== false;
  if (tampilRanking) {
    const rk = rankIn(siswa.filter(x => cnStr(x.Kelas).toUpperCase() === kelas));
    const rt = rankIn(siswa.filter(x => cnTingkat(x.Kelas) === tingkat));
    Object.assign(ringkasan, { rankKelas: rk.rank, jumlahKelas: rk.dari, rankTingkat: rt.rank, jumlahTingkat: rt.dari, tingkat: tingkat });
  }
  const kel = readTable('Kelas').filter(k => cnStr(k.Kelas).toUpperCase() === kelas)[0] || {};
  const pel = readTable('Pelengkap').filter(p => cnStr(p.NISN) === cnStr(s.NISN))[0];
  const amb = readTable('Pengambilan').filter(p => cnStr(p.NISN) === cnStr(s.NISN))[0];
  const keys = ['nama_sekolah', 'semester', 'tahun_ajaran', 'predikat_a', 'predikat_b', 'predikat_c', 'kata_a', 'kata_b', 'kata_c', 'kata_d',
    'format_deskripsi', 'mode_keterampilan', 'sikap_spiritual_predikat', 'sikap_spiritual_deskripsi', 'sikap_sosial_predikat',
    'sikap_sosial_deskripsi', 'ekskul_deskripsi_default', 'format_raport', 'tampilkan_hadir', 'kokurikuler_kegiatan', 'format_kokurikuler'];
  const outCfg = {};
  keys.forEach(k => { if (cfg[k] !== undefined) outCfg[k] = cfg[k]; });

  return {
    siswa: { nisn: cnStr(s.NISN), nis: nis, nama: cnStr(s.Nama).toUpperCase(), kelas: kelas, jk: cnStr(s.JK).toUpperCase() },
    wali: cnStr(kel.Wali_Kelas),
    config: outCfg,
    mapel: mapel.map(m => {
      const n = nil[cnStr(s.NISN) + '|' + m.kode];
      return {
        kode: m.kode, nama: m.nama, kelompok: m.kelompok, kkm: m.kkm,
        nilai: n ? n.nilai : null, nilai_k: n && terpisah ? n.nilai_k : null,
        kuasai: n ? n.kuasai : '', tingkatkan: n ? n.tingkatkan : ''
      };
    }),
    ringkasan: ringkasan,
    tampilRanking: tampilRanking,
    pelengkap: pel ? {
      sp_pred: cnStr(pel.Spiritual_Predikat), sp_desk: cnStr(pel.Spiritual_Deskripsi),
      so_pred: cnStr(pel.Sosial_Predikat), so_desk: cnStr(pel.Sosial_Deskripsi),
      ek1: cnStr(pel.Ekskul1), ek1_nilai: cnStr(pel.Ekskul1_Nilai), ek1_desk: cnStr(pel.Ekskul1_Deskripsi),
      ek2: cnStr(pel.Ekskul2), ek2_nilai: cnStr(pel.Ekskul2_Nilai), ek2_desk: cnStr(pel.Ekskul2_Deskripsi),
      sakit: cnStr(pel.Sakit), izin: cnStr(pel.Izin), alpa: cnStr(pel.Alpa),
      keputusan: cnStr(pel.Keputusan), catatan: cnStr(pel.Catatan_Wali),
      hadir: cnStr(pel.Hadir), kk_nilai: cnStr(pel.Kokurikuler_Nilai), kk_kuat: cnStr(pel.Kokurikuler_Kuat),
      kk_lemah: cnStr(pel.Kokurikuler_Lemah), kk_desk: cnStr(pel.Kokurikuler_Deskripsi)
    } : null,
    pengambilan: amb && cnStr(amb.Status) === 'Sudah'
      ? { status: 'Sudah', tanggal: cnStr(amb.Tanggal), pengambil: cnStr(amb.Pengambil), hubungan: cnStr(amb.Hubungan) }
      : { status: 'Belum' },
    serverTime: new Date().toISOString()
  };
}

function log(user, role, aksi, detail) {
  try {
    const sh = sheet('Log');
    sh.appendRow([new Date(), user, role, aksi, detail || '']);
    // batasi log agar tidak terlalu besar
    const max = 3000;
    if (sh.getLastRow() > max + 200) sh.deleteRows(2, sh.getLastRow() - max);
  } catch (e) { /* log tidak boleh menggagalkan aksi utama */ }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
