/**
 * Admin: Template Excel, Import Excel (dengan pratinjau), Export, Cadangan & Pemulihan
 * Memakai xlsx-js-style (SheetJS + dukungan warna/style).
 * SMP KRISTEN 65 BASAAN
 */

const XL_HEAD = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '1E3A8A' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: { top: { style: 'thin', color: { rgb: '94A3B8' } }, bottom: { style: 'thin', color: { rgb: '94A3B8' } }, left: { style: 'thin', color: { rgb: '94A3B8' } }, right: { style: 'thin', color: { rgb: '94A3B8' } } }
};
const XL_KEY = Object.assign({}, XL_HEAD, { fill: { fgColor: { rgb: 'B45309' } } });

// Nama mapel versi lama -> kode baru (untuk file Excel/DKN lama)
const OLD_MAPEL_ALIAS = {
  'BAHASA INDONESIA': 'BIND', 'B. INDO': 'BIND', 'B.INDO': 'BIND', 'B.INDONESIA': 'BIND', 'B. INDONESIA': 'BIND',
  'BAHASA INGGRIS': 'BING', 'B. ING': 'BING', 'B.ING': 'BING', 'B.INGGRIS': 'BING', 'B. INGGRIS': 'BING',
  'MATEMATIKA': 'MTK', 'PRAKARYA': 'PRAK', 'PKR': 'PRAK', 'SENI': 'PRAK', 'PENJAS': 'PJOK', 'PENJASKES': 'PJOK',
  'TIK': 'INF', 'INFORMATIKA': 'INF', 'MULOK': 'BDAE', 'BAHASA DAERAH': 'BDAE', 'B. DAERAH': 'BDAE',
  'MULOK A.KOR': 'AKOR', 'ANTI KORUPSI': 'AKOR', 'PAKOR': 'AKOR', 'A.KOR': 'AKOR', 'AGAMA': 'PAK', 'PPKN': 'PKN'
};

function xlReady() {
  if (typeof XLSX === 'undefined') { C.toast('Pustaka Excel belum termuat', 'error'); return false; }
  return true;
}

// Buat sheet dengan header berwarna; textCols = indeks kolom yang dipaksa teks (NISN)
function makeSheet(headers, rows, widths, textCols, keyCols) {
  textCols = textCols || [];
  keyCols = keyCols || [];
  const aoa = [headers.map((h, i) => ({ v: h, t: 's', s: keyCols.indexOf(i) >= 0 ? XL_KEY : XL_HEAD }))];
  rows.forEach(r => aoa.push(r.map((v, i) => {
    if (v === null || v === undefined || v === '') return { v: '', t: 's' };
    if (textCols.indexOf(i) >= 0) return { v: String(v), t: 's', z: '@' };
    return { v: v, t: typeof v === 'number' ? 'n' : 's' };
  })));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = (widths || headers.map(() => 14)).map(w => ({ wch: w }));
  ws['!rows'] = [{ hpt: 30 }];
  return ws;
}

function siswaScope(onlyClass) {
  return AppState.db.siswa.filter(s => !onlyClass || s.kelas === AppState.selectedClass);
}

function petunjukSheet(lines) {
  const ws = XLSX.utils.aoa_to_sheet(lines.map(l => [l]));
  ws['!cols'] = [{ wch: 120 }];
  if (ws.A1) ws.A1.s = { font: { bold: true, sz: 14, color: { rgb: '1E3A8A' } } };
  return ws;
}

/* ===========================================================
   TEMPLATE
   =========================================================== */
window.downloadTemplateSiswa = function (withData) {
  if (!xlReady()) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, petunjukSheet([
    'PETUNJUK IMPORT DATA SISWA - ' + AppState.config.nama_sekolah,
    '',
    '1. Isi sheet "Siswa" mulai baris ke-2. Jangan mengubah judul kolom di baris pertama.',
    '2. NISN wajib dan harus unik (kunci data). Ketik NISN sebagai teks agar angka 0 di depan tidak hilang.',
    '3. NAMA dan KELAS wajib diisi. KELAS ditulis seperti di aplikasi, contoh: 7A, 7B, 8A.',
    '4. JK diisi L atau P. NO_ABSEN boleh dikosongkan.',
    '5. Jika NISN sudah ada di aplikasi, datanya akan DIPERBARUI. Siswa yang tidak ada di file TIDAK dihapus.',
    '6. Simpan file, lalu di aplikasi Admin pilih menu Excel > Import Excel.',
    '',
    'Kelas yang terdaftar: ' + AppState.data.classes.join(', ')
  ]), 'Petunjuk');
  const list = withData ? AppState.db.siswa : [];
  XLSX.utils.book_append_sheet(wb, makeSheet(['NISN', 'NIS', 'NAMA', 'KELAS', 'JK', 'NO_ABSEN'],
    list.map(s => [s.nisn, s.nis, s.nama, s.kelas, s.jk, s.no]), [16, 12, 36, 9, 6, 10], [0, 1], [0]), 'Siswa');
  XLSX.writeFile(wb, withData ? 'Data_Siswa_' + new Date().toISOString().slice(0, 10) + '.xlsx' : 'Template_Data_Siswa.xlsx');
  C.toast(withData ? 'Data siswa diexport' : 'Template data siswa diunduh', 'success');
};

window.downloadTemplateFull = function (onlyClass) {
  if (!xlReady()) return;
  const cfg = AppState.config;
  const db = AppState.db;
  const students = siswaScope(onlyClass);
  const wb = XLSX.utils.book_new();
  const mapel = C.activeMapel(db);

  XLSX.utils.book_append_sheet(wb, petunjukSheet([
    'PETUNJUK TEMPLATE IMPORT RAPORT - ' + cfg.nama_sekolah,
    'Semester ' + cfg.semester + ' Tahun Pelajaran ' + cfg.tahun_ajaran + (onlyClass ? ' - Kelas ' + AppState.selectedClass : ' - Semua Kelas'),
    '',
    'SHEET "Siswa"      : data siswa (NISN, NIS, NAMA, KELAS, JK, NO_ABSEN). NISN = kunci, ketik sebagai teks.',
    'SHEET kode mapel   : satu sheet per mata pelajaran (contoh: ' + mapel.slice(0, 4).map(m => m.kode).join(', ') + '). Isi kolom NILAI (0-100).',
    '',
    'ATURAN PENTING:',
    '- Jangan mengubah judul kolom (baris pertama) dan nama sheet.',
    '- Sel yang dikosongkan TIDAK menghapus data yang sudah ada di aplikasi.',
    '- Template ini sudah berisi data saat ini, cukup ubah/lengkapi lalu import kembali.',
    '- Sebelum disimpan, aplikasi menampilkan ringkasan dan peringatan (misal NISN tidak dikenal / nilai di luar 0-100).',
    '- File DKN / Leger lama (kolom NISN + kolom mapel) juga bisa langsung diimport.'
  ]), 'Petunjuk');

  XLSX.utils.book_append_sheet(wb, makeSheet(['NISN', 'NIS', 'NAMA', 'KELAS', 'JK', 'NO_ABSEN'],
    students.map(s => [s.nisn, s.nis, s.nama, s.kelas, s.jk, s.no]), [16, 12, 36, 9, 6, 10], [0, 1], [0]), 'Siswa');

  mapel.forEach(m => {
    const headers = ['NO', 'NISN', 'NAMA', 'KELAS', 'NILAI'];
    const rows = students.map((s, i) => {
      const n = db.nilai[s.nisn + '|' + m.kode] || {};
      return [s.no || i + 1, s.nisn, s.nama, s.kelas, C.isFilled(n.nilai) ? n.nilai : ''];
    });
    const ws = makeSheet(headers, rows, [5, 16, 32, 8, 8], [1], [1]);
    XLSX.utils.book_append_sheet(wb, ws, m.kode.slice(0, 31));
  });

  XLSX.utils.book_append_sheet(wb, makeSheet(['KODE', 'NAMA', 'KELOMPOK', 'KKM'], mapel.map(m => [m.kode, m.nama, m.kelompok, m.kkm]), [10, 32, 10, 8]), 'Ref_Mapel');

  XLSX.writeFile(wb, 'Template_Import_Raport_' + (onlyClass ? 'Kelas_' + AppState.selectedClass : 'Semua_Kelas') + '.xlsx');
  C.toast('Template import lengkap diunduh', 'success');
};

/* ===========================================================
   IMPORT
   =========================================================== */
function normKey(h) {
  return String(h || '').trim().toUpperCase().replace(/[\s.]+/g, '_').replace(/_+/g, '_');
}

function pick(row, names) {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== '') return String(row[n]).trim();
  }
  return '';
}

function sheetRows(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  return raw.map(r => {
    const o = {};
    Object.keys(r).forEach(k => { o[normKey(k)] = r[k]; });
    return o;
  });
}

function fixNisn(v, issues, where) {
  let s = String(v === null || v === undefined ? '' : v).trim().replace(/\.0+$/, '');
  if (/^\d{7,9}$/.test(s)) {
    const fixed = s.padStart(10, '0');
    issues.push(where + ': NISN ' + s + ' dibaca sebagai angka, dilengkapi menjadi ' + fixed);
    s = fixed;
  }
  return s;
}

function findMapel(name) {
  const n = String(name || '').trim().toUpperCase();
  const mapel = AppState.db.mapel;
  let m = mapel.find(x => x.kode === n || x.nama.toUpperCase() === n);
  if (!m && OLD_MAPEL_ALIAS[n]) m = mapel.find(x => x.kode === OLD_MAPEL_ALIAS[n]);
  return m || null;
}

function parseWorkbook(wb) {
  const out = { siswa: [], nilai: {}, issues: [], sheets: [] };
  const db = AppState.db;
  const addNilai = (nisn, kode, patch, where) => {
    const id = nisn + '|' + kode;
    out.nilai[id] = Object.assign(out.nilai[id] || { nisn, kode }, patch);
    out.nilai[id].where = where;
  };
  const readScore = (v, where) => {
    if (v === '' || v === null || v === undefined) return undefined;
    const n = C.num(v);
    if (n === null || n < 0 || n > 100) { out.issues.push(where + ': nilai "' + v + '" tidak valid (harus 0-100), dilewati'); return undefined; }
    return n;
  };

  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const up = normKey(name);
    // Sheet khusus E-Raport Semester (deskripsi / sikap / kehadiran) tidak dipakai di versi Mid
    if (up === 'PETUNJUK' || up === 'REF_MAPEL' || up === 'KELAS' || up === 'PELENGKAP' || up === 'DAFTAR_DESKRIPSI' || up === 'DESKRIPSI') return;
    const rows = sheetRows(ws);
    if (!rows.length) return;

    if (up === 'SISWA' || up === 'DATA_SISWA') {
      rows.forEach((r, i) => {
        const where = 'Sheet ' + name + ' baris ' + (i + 2);
        const nama = pick(r, ['NAMA', 'NAMA_SISWA', 'NAMA_LENGKAP']).toUpperCase();
        const nisn = fixNisn(pick(r, ['NISN']), out.issues, where);
        const kelas = pick(r, ['KELAS', 'ROMBEL']).toUpperCase().replace(/\s+/g, '');
        if (!nama && !nisn) return;
        if (!nisn || !nama || !kelas) { out.issues.push(where + ': NISN, NAMA, dan KELAS wajib diisi - dilewati'); return; }
        out.siswa.push({ nisn, nis: pick(r, ['NIS']), nama, kelas, jk: pick(r, ['JK', 'L/P', 'JENIS_KELAMIN']).toUpperCase().slice(0, 1), no: C.num(pick(r, ['NO_ABSEN', 'NO', 'ABSEN'])) });
      });
      out.sheets.push(name + ' (siswa)');
      return;
    }

    // Format lama: sheet "Nilai" (NISN, Mapel, Nilai)
    if (up === 'NILAI' && rows[0] && ('MAPEL' in rows[0] || 'KODE_MAPEL' in rows[0])) {
      rows.forEach((r, i) => {
        const where = 'Sheet ' + name + ' baris ' + (i + 2);
        const nisn = fixNisn(pick(r, ['NISN']), out.issues, where);
        const m = findMapel(pick(r, ['MAPEL', 'KODE_MAPEL']));
        if (!nisn) return;
        if (!m) { out.issues.push(where + ': mapel "' + pick(r, ['MAPEL']) + '" tidak dikenal'); return; }
        const v = readScore(pick(r, ['NILAI']), where);
        if (v !== undefined) addNilai(nisn, m.kode, { nilai: v }, where);
      });
      out.sheets.push(name + ' (nilai format lama)');
      return;
    }

    // Sheet per mata pelajaran (nama sheet = kode / nama mapel)
    const sheetMapel = findMapel(name);
    if (sheetMapel && rows[0] && ('NISN' in rows[0])) {
      rows.forEach((r, i) => {
        const where = 'Sheet ' + name + ' baris ' + (i + 2);
        const nisn = fixNisn(pick(r, ['NISN']), out.issues, where);
        if (!nisn) return;
        const v = readScore(pick(r, ['NILAI', 'NILAI_PENGETAHUAN']), where);
        if (v !== undefined) addNilai(nisn, sheetMapel.kode, { nilai: v }, where);
      });
      out.sheets.push(name + ' (nilai ' + sheetMapel.nama + ')');
      return;
    }

    // Format lebar (misal DKN/Leger): kolom NISN + kolom-kolom mapel
    const headers = Object.keys(rows[0] || {});
    const mapCols = headers.map(h => ({ h, m: findMapel(h.replace(/_/g, ' ')) || findMapel(h) })).filter(x => x.m);
    if (headers.indexOf('NISN') >= 0 && mapCols.length) {
      rows.forEach((r, i) => {
        const where = 'Sheet ' + name + ' baris ' + (i + 2);
        const nisn = fixNisn(pick(r, ['NISN']), out.issues, where);
        if (!nisn) return;
        mapCols.forEach(x => {
          const v = readScore(r[x.h], where + ' kolom ' + x.h);
          if (v !== undefined) addNilai(nisn, x.m.kode, { nilai: v }, where);
        });
        const nama = pick(r, ['NAMA', 'NAMA_SISWA']).toUpperCase();
        const kelas = pick(r, ['KELAS']).toUpperCase().replace(/\s+/g, '');
        if (nama && kelas && !db.siswa.some(s => s.nisn === nisn) && !out.siswa.some(s => s.nisn === nisn)) {
          out.siswa.push({ nisn, nis: '', nama, kelas, jk: '', no: C.num(pick(r, ['NO'])) });
        }
      });
      out.sheets.push(name + ' (format lebar: ' + mapCols.map(x => x.m.kode).join(', ') + ')');
      return;
    }

    out.issues.push('Sheet "' + name + '" tidak dikenali dan dilewati');
  });
  return out;
}

function diffImport(parsed) {
  const db = AppState.db;
  const knownNisn = new Set(db.siswa.map(s => s.nisn).concat(parsed.siswa.map(s => s.nisn)));
  const kelasOf = {};
  db.siswa.forEach(s => { kelasOf[s.nisn] = s.kelas; });
  parsed.siswa.forEach(s => { kelasOf[s.nisn] = s.kelas; });

  const siswaRows = [];
  let siswaNew = 0, siswaUpd = 0;
  parsed.siswa.forEach(s => {
    const ex = db.siswa.find(x => x.nisn === s.nisn);
    const merged = Object.assign({}, ex || {}, s, { nis: s.nis || (ex && ex.nis) || '', jk: s.jk || (ex && ex.jk) || '', no: s.no !== null ? s.no : (ex && ex.no) });
    if (!ex) { siswaNew++; siswaRows.push(merged); }
    else if (['nis', 'nama', 'kelas', 'jk', 'no'].some(k => String(merged[k] || '') !== String(ex[k] || ''))) { siswaUpd++; siswaRows.push(merged); }
  });

  const nilaiRows = [];
  let nilaiNew = 0, nilaiUpd = 0;
  const unknown = new Set();
  Object.values(parsed.nilai).forEach(n => {
    if (!knownNisn.has(n.nisn)) { unknown.add(n.nisn); return; }
    const ex = db.nilai[n.nisn + '|' + n.kode];
    const merged = Object.assign({ nilai: null }, ex || {}, n, { kelas: kelasOf[n.nisn], guru: 'Import Excel (Admin)', updated: C.nowIso() });
    const changed = !ex || String(merged.nilai === null ? '' : merged.nilai) !== String(ex.nilai === null ? '' : ex.nilai);
    if (!changed) return;
    if (ex) nilaiUpd++; else nilaiNew++;
    nilaiRows.push(merged);
  });
  unknown.forEach(n => parsed.issues.push('NISN ' + n + ' tidak ada di data siswa - nilainya dilewati'));

  return { siswaRows, siswaNew, siswaUpd, nilaiRows, nilaiNew, nilaiUpd };
}

function showImportPreview(fileName, parsed, diff) {
  const total = diff.siswaRows.length + diff.nilaiRows.length;
  const issues = parsed.issues;
  openModal('Pratinjau Import: ' + fileName,
    '<div class="muted" style="margin-bottom:10px;">Sheet terbaca: ' + (parsed.sheets.length ? esc(parsed.sheets.join(' • ')) : '-') + '</div>' +
    '<div class="import-summary">' +
      '<div><b>' + diff.siswaNew + '</b>Siswa baru</div><div><b>' + diff.siswaUpd + '</b>Siswa diperbarui</div>' +
      '<div><b>' + diff.nilaiNew + '</b>Nilai baru</div><div><b>' + diff.nilaiUpd + '</b>Nilai diubah</div>' +
    '</div>' +
    (issues.length ? '<div style="font-weight:700;margin-bottom:6px;color:var(--warning);">⚠️ ' + issues.length + ' catatan:</div><ul class="issue-list">' +
      issues.slice(0, 80).map(i => '<li>' + esc(i) + '</li>').join('') + (issues.length > 80 ? '<li>... dan ' + (issues.length - 80) + ' lainnya</li>' : '') + '</ul>' : '') +
    (total ? '' : '<p style="margin-top:12px;font-weight:700;">Tidak ada perubahan baru dibanding data di aplikasi.</p>') +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button>' +
    '<button class="btn btn-success" id="imp-go"' + (total ? '' : ' disabled') + '>Simpan ' + total + ' Perubahan ke Spreadsheet</button></div>', true);
  const go = document.getElementById('imp-go');
  if (go) go.onclick = () => commitImport(diff);
}

async function commitImport(diff) {
  if (!canWrite()) return;
  closeModal();
  loading(true, 'Menyimpan hasil import...');
  try {
    if (diff.siswaRows.length) {
      loading(true, 'Menyimpan ' + diff.siswaRows.length + ' siswa...');
      await C.api('saveSiswa', { rows: diff.siswaRows.map(C.siswaToRow) });
    }
    for (let i = 0; i < diff.nilaiRows.length; i += 500) {
      loading(true, 'Menyimpan nilai ' + Math.min(i + 500, diff.nilaiRows.length) + '/' + diff.nilaiRows.length + '...');
      await C.api('syncNilai', { rows: diff.nilaiRows.slice(i, i + 500).map(C.nilaiToRow), info: 'Import Excel' });
    }

    loading(true, 'Mengambil data terbaru...');
    const res = await C.fetchDB();
    AppState.db = res.db;
    rebuildState();
    initializeUI();
    C.toast('Import berhasil disimpan ke spreadsheet', 'success');
  } catch (e) {
    C.toast('Import gagal: ' + e.message + '. Sebagian data mungkin sudah tersimpan, silakan Sinkron lalu cek kembali.', 'error');
  } finally {
    loading(false);
  }
}

function handleImportFile(file) {
  if (!xlReady()) return;
  const reader = new FileReader();
  loading(true, 'Membaca file Excel...');
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const parsed = parseWorkbook(wb);
      const diff = diffImport(parsed);
      loading(false);
      showImportPreview(file.name, parsed, diff);
    } catch (err) {
      loading(false);
      C.toast('Gagal membaca file: ' + err.message, 'error');
    }
  };
  reader.onerror = () => { loading(false); C.toast('File tidak dapat dibaca', 'error'); };
  reader.readAsArrayBuffer(file);
}

/* ===========================================================
   EXPORT SELURUH DATA
   =========================================================== */
window.exportAllExcel = function () {
  if (!xlReady()) return;
  const db = AppState.db;
  const cfg = AppState.config;
  const wb = XLSX.utils.book_new();
  const byNisn = {};
  db.siswa.forEach(s => { byNisn[s.nisn] = s; });
  XLSX.utils.book_append_sheet(wb, makeSheet(['NISN', 'NIS', 'NAMA', 'KELAS', 'JK', 'NO_ABSEN'], db.siswa.map(s => [s.nisn, s.nis, s.nama, s.kelas, s.jk, s.no]), [16, 12, 36, 9, 6, 10], [0, 1]), 'Siswa');

  const nilai = Object.values(db.nilai).sort((a, b) => a.kelas.localeCompare(b.kelas) || a.kode.localeCompare(b.kode));
  XLSX.utils.book_append_sheet(wb, makeSheet(
    ['NISN', 'NAMA', 'KELAS', 'KODE_MAPEL', 'NILAI', 'KKM', 'KETERANGAN', 'GURU', 'DIPERBARUI'],
    nilai.map(n => {
      const s = byNisn[n.nisn] || { nama: '?' };
      const m = db.mapel.find(x => x.kode === n.kode) || {};
      const ket = C.isFilled(n.nilai) && m.kkm ? (n.nilai >= m.kkm ? 'Tuntas' : 'Belum Tuntas') : '';
      return [n.nisn, s.nama, s.kelas || n.kelas, n.kode, n.nilai, m.kkm, ket, n.guru, C.fmtDateTime(n.updated)];
    }), [16, 30, 8, 10, 7, 7, 14, 22, 18], [0]), 'Nilai');

  AppState.data.classes.forEach(k => {
    const students = classStudents(k);
    if (!students.length) return;
    const mapel = cfg.mapel_list;
    XLSX.utils.book_append_sheet(wb, makeSheet(['NO', 'NISN', 'NAMA'].concat(mapel.map(m => m.key)).concat(['JUMLAH', 'RATA2', 'RANK']),
      students.map((s, i) => [s.no || i + 1, s.nisn, s.nama].concat(mapel.map(m => s.grades[m.key])).concat([s.total, s.average, s.ranking])),
      [5, 16, 32].concat(mapel.map(() => 7)).concat([9, 8, 6]), [1]), ('Leger_' + k).slice(0, 31));
  });

  XLSX.utils.book_append_sheet(wb, makeSheet(['KODE', 'NAMA', 'KELOMPOK', 'KKM', 'URUT', 'AKTIF'], db.mapel.map(m => [m.kode, m.nama, m.kelompok, m.kkm, m.urut, m.aktif ? 'Y' : 'N']), [10, 32, 10, 8, 8, 8]), 'Ref_Mapel');
  XLSX.utils.book_append_sheet(wb, makeSheet(['KELAS', 'LABEL_RAPORT', 'WALI_KELAS', 'NIP_WALI'], db.kelas.map(k => [k.kelas, k.label, k.wali, k.nip]), [8, 12, 34, 22], [3]), 'Kelas');
  const ambil = Object.values(db.pengambilan || {});
  if (ambil.length) {
    XLSX.utils.book_append_sheet(wb, makeSheet(['NISN', 'NAMA', 'KELAS', 'STATUS', 'TANGGAL', 'PENGAMBIL', 'HUBUNGAN', 'NO_HP', 'CATATAN', 'PETUGAS'],
      ambil.map(p => [p.nisn, p.nama, p.kelas, p.status, p.tanggal ? C.fmtDateTime(p.tanggal) : '', p.pengambil, p.hubungan, p.hp, p.catatan, p.petugas]),
      [14, 30, 8, 9, 20, 26, 14, 16, 24, 16], [0, 7]), 'Pengambilan_Raport');
  }
  XLSX.writeFile(wb, 'Export_Data_Raport_Mid_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  C.toast('Seluruh data diexport ke Excel', 'success');
};

/* ===========================================================
   CADANGAN & PEMULIHAN (JSON)
   =========================================================== */
function dbToRaw(db) {
  const cfg = Object.assign({}, db.config);
  return {
    config: cfg,
    kelas: db.kelas.map(C.kelasToRow),
    mapel: db.mapel.map(C.mapelToRow),
    siswa: db.siswa.map(C.siswaToRow),
    nilai: Object.values(db.nilai).map(C.nilaiToRow),
    pengambilan: Object.values(db.pengambilan || {}).map(C.pengambilanToRow)
  };
}

window.downloadBackupJson = function () {
  const data = { app: 'e-raport-mid-admin', versi: C.CFG.VERSI, dibuat: C.nowIso(), data: dbToRaw(AppState.db) };
  C.downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'Cadangan_ERaport_Mid_' + new Date().toISOString().slice(0, 10) + '.json');
  C.toast('File cadangan diunduh', 'success');
};

function restoreBackupFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const j = JSON.parse(reader.result);
      if (j.app !== 'e-raport-mid-admin' || !j.data) throw new Error('Bukan file cadangan admin E-Raport Mid Semester');
      const d = j.data;
      if (!confirm('Pulihkan cadangan tanggal ' + C.fmtDateTime(j.dibuat) + '?\n\nIsi: ' + (d.siswa || []).length + ' siswa, ' + (d.nilai || []).length + ' nilai.\n\nSELURUH data di spreadsheet akan DIGANTI.')) return;
      if (!confirm('Yakin? Tindakan ini tidak dapat dibatalkan.')) return;
      await adminWrite('restore', { data: d }, 'Cadangan berhasil dipulihkan');
    } catch (e) {
      C.toast('Gagal memulihkan: ' + e.message, 'error');
    }
  };
  reader.readAsText(file);
}

/* ===========================================================
   TAB IMPORT / EXPORT
   =========================================================== */
window.renderImpor = function () {
  const ms = document.getElementById('del-nilai-mapel');
  const ks = document.getElementById('del-nilai-kelas');
  ms.innerHTML = '<option value="__all">Semua mapel</option>' + AppState.db.mapel.map(m => '<option value="' + esc(m.kode) + '">' + esc(m.nama) + '</option>').join('');
  ks.innerHTML = '<option value="__all">Semua kelas</option>' + AppState.data.classes.map(k => '<option value="' + esc(k) + '"' + (k === AppState.selectedClass ? ' selected' : '') + '>Kelas ' + esc(k) + '</option>').join('');
};

window.deleteNilaiBulk = async function () {
  const kode = document.getElementById('del-nilai-mapel').value;
  const kelas = document.getElementById('del-nilai-kelas').value;
  const siswaKelas = {};
  AppState.db.siswa.forEach(s => { siswaKelas[s.nisn] = s.kelas; });
  const ids = Object.values(AppState.db.nilai)
    .filter(n => (kode === '__all' || n.kode === kode) && (kelas === '__all' || (siswaKelas[n.nisn] || n.kelas) === kelas))
    .map(n => n.id);
  if (!ids.length) { C.toast('Tidak ada nilai yang cocok', 'info'); return; }
  const label = (kode === '__all' ? 'SEMUA mapel' : kode) + ' / ' + (kelas === '__all' ? 'SEMUA kelas' : 'Kelas ' + kelas);
  if (!confirm('Hapus ' + ids.length + ' nilai (' + label + ') dari spreadsheet?\n\nSebaiknya unduh cadangan terlebih dahulu.')) return;
  if (ids.length > 200 && !confirm('Jumlahnya besar (' + ids.length + '). Lanjutkan?')) return;
  await adminWrite('deleteNilai', { ids }, ids.length + ' nilai dihapus');
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('excel-file-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) handleImportFile(f);
    e.target.value = '';
  });
  document.getElementById('restore-file-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) restoreBackupFile(f);
    e.target.value = '';
  });
});
