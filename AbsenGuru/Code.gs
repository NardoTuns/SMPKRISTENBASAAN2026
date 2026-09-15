/**
 * =========================================================
 *  SIABSEN - Backend Google Apps Script
 *  Deploy sebagai "Web App" (Execute as: Me, Access: Anyone)
 * =========================================================
 *
 * CARA PASANG:
 * 1. Buat Google Spreadsheet baru, beri nama misalnya "Database Absensi Guru".
 * 2. Buka menu Extensions > Apps Script.
 * 3. Hapus isi default, tempel seluruh isi file Code.gs ini.
 * 4. Jalankan fungsi `setupSheets` sekali (pilih dari dropdown function,
 *    lalu klik Run) untuk membuat sheet Config, Guru, Absensi otomatis.
 * 5. Di sheet "Config", isi sel B1 dengan password yang diinginkan.
 * 6. Klik Deploy > New deployment > pilih tipe "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Salin URL "Web app" yang muncul, tempel ke aplikasi SIABSEN
 *    pada halaman Pengaturan Server.
 */

const SHEET_CONFIG = 'Config';
const SHEET_GURU = 'Guru';
const SHEET_ABSENSI = 'Absensi';

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg) cfg = ss.insertSheet(SHEET_CONFIG);
  cfg.getRange('A1').setValue('Password');
  cfg.getRange('B1').setValue('ubah-password-ini');
  cfg.getRange('A2').setValue('Kop Baris 1');
  cfg.getRange('B2').setValue('SMP KRISTEN BASAAN');
  cfg.getRange('A3').setValue('Kop Baris 2');
  cfg.getRange('B3').setValue('KECAMATAN RATATOTOK');
  cfg.getRange('A4').setValue('Kop Baris 3');
  cfg.getRange('B4').setValue('KABUPATEN MINAHASA TENGGARA');
  cfg.autoResizeColumns(1, 2);

  let guru = ss.getSheetByName(SHEET_GURU);
  if (!guru) guru = ss.insertSheet(SHEET_GURU);
  if (guru.getLastRow() === 0) {
    guru.appendRow(['ID', 'Nama', 'NIP', 'Jenis Kelamin', 'NUPTK']);
    guru.setFrozenRows(1);
  }

  let absensi = ss.getSheetByName(SHEET_ABSENSI);
  if (!absensi) absensi = ss.insertSheet(SHEET_ABSENSI);
  if (absensi.getLastRow() === 0) {
    absensi.appendRow(['ID', 'GuruID', 'Nama Guru', 'Tanggal', 'Jenis', 'Status', 'Keterangan', 'Catatan', 'Timestamp', 'Waktu Sinkron']);
    absensi.setFrozenRows(1);
  }

  SpreadsheetApp.getUi().alert('Setup selesai! Sheet Config, Guru, dan Absensi sudah siap.');
}

function getConfig_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CONFIG);
  return {
    password: String(sh.getRange('B1').getValue()),
    l1: String(sh.getRange('B2').getValue()),
    l2: String(sh.getRange('B3').getValue()),
    l3: String(sh.getRange('B4').getValue())
  };
}

function sha256_(text) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function getAllTeachers_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_GURU);
  const values = sh.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    out.push({ id: String(row[0]), nama: row[1] || '', nip: row[2] || '', jk: row[3] || '', nuptk: row[4] || '' });
  }
  return out;
}

function writeAllTeachers_(teachers) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_GURU);
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 0), 5).clearContent();
  if (teachers.length === 0) return;
  const rows = teachers.map(function (t) { return [t.id, t.nama, t.nip, t.jk, t.nuptk]; });
  sh.getRange(2, 1, rows.length, 5).setValues(rows);
}

function appendAttendanceRecords_(records) {
  if (!records || records.length === 0) return;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ABSENSI);
  const now = new Date();
  const rows = records.map(function (r) {
    return [r.id, r.guruId, r.namaGuru, r.tanggal, r.jenis, r.status, r.ketStatus || '', r.catatan || '', r.timestamp, now];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
}

/** Handle GET requests: used for initial login + sync */
function doGet(e) {
  const action = e.parameter.action;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (action === 'login') {
      const cfg = getConfig_();
      const password = e.parameter.password || '';
      if (password !== cfg.password) {
        return jsonOut_({ ok: false, message: 'Password salah.' });
      }
      return jsonOut_({
        ok: true,
        teachers: getAllTeachers_(),
        config: { l1: cfg.l1, l2: cfg.l2, l3: cfg.l3 }
      });
    }
    return jsonOut_({ ok: false, message: 'Aksi tidak dikenali.' });
  } finally {
    lock.releaseLock();
  }
}

/** Handle POST requests: used for syncing attendance + teacher data */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    const cfg = getConfig_();

    if (body.action === 'sync') {
      const expectedHash = sha256_(cfg.password);
      if (body.password_hash !== expectedHash) {
        return jsonOut_({ ok: false, message: 'Autentikasi gagal. Silakan login ulang.' });
      }

      // 1. Simpan absensi baru
      appendAttendanceRecords_(body.records || []);

      // 2. Merge data guru: gabungkan guru dari client dengan yang sudah ada di sheet,
      //    lalu hapus yang ditandai deletedTeachers dari client.
      const serverTeachers = getAllTeachers_();
      const serverMap = {};
      serverTeachers.forEach(function (t) { serverMap[t.id] = t; });

      (body.teachers || []).forEach(function (t) { serverMap[t.id] = t; });
      (body.deletedTeachers || []).forEach(function (id) { delete serverMap[id]; });

      const mergedTeachers = Object.keys(serverMap).map(function (k) { return serverMap[k]; });
      writeAllTeachers_(mergedTeachers);

      return jsonOut_({ ok: true, teachers: mergedTeachers });
    }

    return jsonOut_({ ok: false, message: 'Aksi tidak dikenali.' });
  } catch (err) {
    return jsonOut_({ ok: false, message: 'Error: ' + err.message });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
