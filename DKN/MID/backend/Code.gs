/**
 * BACKEND E-RAPORT MID SEMESTER - SMP KRISTEN 65 BASAAN
 * Google Apps Script + Google Spreadsheet sebagai database.
 * Pakai spreadsheet TERPISAH dari E-Raport Semester agar nilai tidak tercampur.
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
 */

// Harus sama dengan API_KEY di js/config.js
const KUNCI_API = 'krisba-mid-2026';

const SHEETS = {
  Pengaturan: ['Kunci', 'Nilai'],
  Kelas: ['Kelas', 'Label_Raport', 'Wali_Kelas', 'NIP_Wali', 'Urut'],
  Mapel: ['Kode', 'Nama', 'Kelompok', 'KKM', 'Urut', 'Aktif'],
  Siswa: ['NISN', 'NIS', 'Nama', 'Kelas', 'JK', 'No_Absen'],
  Nilai: ['ID', 'NISN', 'Kelas', 'Kode_Mapel', 'Nilai', 'Guru', 'Diperbarui'],
  Log: ['Waktu', 'Pengguna', 'Peran', 'Aksi', 'Detail']
};

// Kolom yang harus disimpan sebagai teks (agar angka 0 di depan NISN tidak hilang)
const TEXT_COLUMNS = {
  Siswa: ['NISN', 'NIS', 'Kelas'],
  Log: [],
  Nilai: ['ID', 'NISN', 'Kelas', 'Kode_Mapel', 'Diperbarui'],
  Kelas: ['Kelas', 'NIP_Wali'],
  Mapel: ['Kode'],
  Pengaturan: ['Kunci', 'Nilai']
};

// Kunci-kunci tabel (untuk upsert)
const KEYS = {
  Siswa: 'NISN',
  Nilai: 'ID',
  Kelas: 'Kelas',
  Mapel: 'Kode'
};

/* =============================================================
   ENTRY POINTS
   ============================================================= */

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'ping') return jsonOut({ ok: true, data: { pong: true, time: new Date().toISOString() } });
  return ContentService.createTextOutput('API E-Raport Mid Semester SMP Kristen 65 Basaan aktif. Gunakan aplikasi web untuk mengakses data.');
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
  const isWrite = req.action !== 'getAll' && req.action !== 'ping' && req.action !== 'getLog';
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

    case 'getLog':
      return readTable('Log').slice(-(req.limit || 300)).reverse();

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
  log(user, role, 'Isi Data Awal', 'Pengaturan, kelas & mapel bawaan');
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
    serverTime: new Date().toISOString()
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

function writeTable(name, rows) {
  const sh = sheet(name);
  const headers = SHEETS[name];
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
  ['Kelas', 'Mapel', 'Siswa', 'Nilai'].forEach(name => {
    const k = name.toLowerCase();
    if (Array.isArray(data[k])) writeTable(name, data[k]);
  });
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
