/**
 * Admin: Kehadiran siswa (Hadir, Sakit, Izin, Tidak Hadir)
 * - Isi langsung di tabel, Isi HADIR otomatis dari hari efektif
 * - Template Excel / CSV dengan kolom NO;NISN;NIS;NAMA;KELAS;HADIR;SAKIT;IZIN;TIDAK HADIR
 * - Import CSV (pemisah ; , atau tab) atau Excel dengan kolom yang sama + pratinjau
 * - Export Excel, cetak rekap, progres isian wali kelas per kelas
 * Data tersimpan di sheet "Pelengkap" (kolom Hadir, Sakit, Izin, Alpa).
 * SMP KRISTEN 65 BASAAN
 */

let hadirEdits = {};
const HADIR_KEYS = ['hadir', 'sakit', 'izin', 'alpa'];
const HADIR_HEAD = ['NO', 'NISN', 'NIS', 'NAMA', 'KELAS', 'HADIR', 'SAKIT', 'IZIN', 'TIDAK HADIR'];
const HADIR_LABEL = { hadir: 'HADIR', sakit: 'SAKIT', izin: 'IZIN', alpa: 'TIDAK HADIR' };

window.kehadiranDirty = () => Object.keys(hadirEdits).length > 0;

function hadirOf(nisn) {
  return Object.assign({}, AppState.db.pelengkap[nisn] || {}, hadirEdits[nisn] || {});
}

function hadirEfektif() {
  return C.num(AppState.config.hari_efektif);
}

function hadirTerisi(p) {
  return HADIR_KEYS.some(k => C.isFilled(p[k]));
}

// Persentase kehadiran: HADIR / (hari efektif atau H+S+I+TH)
function pctHadir(p) {
  const v = k => C.num(p[k]) || 0;
  const tidak = v('sakit') + v('izin') + v('alpa');
  const ef = hadirEfektif();
  const h = C.isFilled(p.hadir) ? v('hadir') : (ef ? Math.max(0, ef - tidak) : null);
  const total = ef || (h === null ? 0 : h + tidak);
  return h === null || !total ? null : Math.round(h / total * 1000) / 10;
}

function hadirScopeStudents() {
  return document.getElementById('hadir-scope').value === '__all' ? AppState.data.students.slice() : classStudents();
}

/* ===========================================================
   TABEL
   =========================================================== */
window.renderKehadiran = function () {
  if (!AppState.data) return;
  document.getElementById('hadir-alert').innerHTML = backendAlertHtml();
  const ef = document.getElementById('hadir-efektif');
  if (document.activeElement !== ef) ef.value = hadirEfektif() === null ? '' : hadirEfektif();
  document.getElementById('hadir-scope').options[0].textContent = 'Kelas terpilih (' + (AppState.selectedClass || '-') + ')';

  const all = hadirScopeStudents();
  const sum = { terisi: 0, sakit: 0, izin: 0, alpa: 0, pct: [] };
  all.forEach(s => {
    const p = hadirOf(s.nisn);
    if (hadirTerisi(p)) sum.terisi++;
    ['sakit', 'izin', 'alpa'].forEach(k => { sum[k] += C.num(p[k]) || 0; });
    const pc = pctHadir(p);
    if (pc !== null) sum.pct.push(pc);
  });
  const avgPct = sum.pct.length ? sum.pct.reduce((a, b) => a + b, 0) / sum.pct.length : null;
  document.getElementById('hadir-kpi').innerHTML =
    '<div class="kpi-card"><div class="kpi-title">Siswa</div><div class="kpi-value">' + all.length + '</div><div class="kpi-sub">' + (document.getElementById('hadir-scope').value === '__all' ? 'Semua kelas' : 'Kelas ' + esc(AppState.selectedClass || '-')) + '</div></div>' +
    '<div class="kpi-card ' + (sum.terisi === all.length && all.length ? 'success' : 'warning') + '"><div class="kpi-title">Kehadiran Terisi</div><div class="kpi-value">' + sum.terisi + '/' + all.length + '</div><div class="kpi-sub">' + (all.length ? Math.round(sum.terisi / all.length * 100) : 0) + '% siswa</div></div>' +
    '<div class="kpi-card info"><div class="kpi-title">Rata-rata Kehadiran</div><div class="kpi-value">' + (avgPct === null ? '-' : C.fmtNum(avgPct) + '%') + '</div><div class="kpi-sub">' + (hadirEfektif() ? 'Hari efektif: ' + hadirEfektif() : 'Atur hari efektif untuk perhitungan') + '</div></div>' +
    '<div class="kpi-card danger"><div class="kpi-title">Total S / I / TH</div><div class="kpi-value" style="font-size:22px;">' + sum.sakit + ' / ' + sum.izin + ' / ' + sum.alpa + '</div><div class="kpi-sub">Sakit / Izin / Tidak Hadir (hari)</div></div>';

  const q = (document.getElementById('hadir-search').value || '').trim().toUpperCase();
  const f = document.getElementById('hadir-filter').value;
  const list = all.filter(s => {
    if (q && s.nama.indexOf(q) < 0 && s.nisn.indexOf(q) < 0 && (s.nis || '').indexOf(q) < 0) return false;
    const p = hadirOf(s.nisn);
    if (f === 'empty') return !hadirTerisi(p);
    if (f === 'alpa') return (C.num(p.alpa) || 0) > 0;
    if (f === 'dirty') return !!hadirEdits[s.nisn];
    return true;
  });
  document.getElementById('hadir-count').textContent = list.length + ' siswa';
  document.getElementById('hadir-table-body').innerHTML = list.length ? list.map((s, i) => {
    const p = hadirOf(s.nisn);
    return '<tr data-nisn="' + esc(s.nisn) + '"' + (hadirEdits[s.nisn] ? ' class="cell-dirty"' : '') + '>' +
      '<td class="center">' + (s.no || i + 1) + '</td><td class="center" style="font-family:monospace;">' + esc(s.nisn) + '</td><td class="center">' + esc(s.nis || '-') + '</td>' +
      '<td><strong>' + esc(s.nama) + '</strong></td><td class="center">' + esc(s.kelas) + '</td>' +
      HADIR_KEYS.map(k => '<td class="center"><input type="number" min="0" step="1" inputmode="numeric" class="form-control hadir-input" data-hk="' + k + '" value="' + esc(C.isFilled(p[k]) ? p[k] : '') + '"' +
        (k === 'hadir' && hadirEfektif() && !C.isFilled(p.hadir) ? ' placeholder="' + Math.max(0, hadirEfektif() - (C.num(p.sakit) || 0) - (C.num(p.izin) || 0) - (C.num(p.alpa) || 0)) + '"' : '') + '></td>').join('') +
      '<td class="center" data-pct>' + pctBadge(p) + '</td></tr>';
  }).join('') : '<tr><td colspan="10"><div class="empty-state"><strong>Tidak ada siswa yang cocok</strong>Ubah pencarian / filter.</div></td></tr>';
  updateHadirBtn();
  renderWaliProgress();
};

function pctBadge(p) {
  const pc = pctHadir(p);
  if (pc === null) return '<span class="badge badge-muted">-</span>';
  return '<span class="badge ' + (pc >= 90 ? 'badge-success' : pc >= 75 ? 'badge-warning' : 'badge-danger') + '">' + C.fmtNum(pc) + '%</span>';
}

function updateHadirBtn() {
  const n = Object.keys(hadirEdits).length;
  const b = document.getElementById('btn-hadir-save');
  b.textContent = n ? 'Simpan Perubahan (' + n + ' siswa)' : 'Simpan Perubahan';
  b.classList.toggle('btn-warning', n > 0);
}

function setHadirEdit(nisn, patch) {
  const cur = AppState.db.pelengkap[nisn] || {};
  const e = Object.assign({}, hadirEdits[nisn] || {}, patch);
  // buang isian yang sama dengan data tersimpan
  Object.keys(e).forEach(k => { if (String(e[k]) === String(cur[k] || '')) delete e[k]; });
  if (Object.keys(e).length) hadirEdits[nisn] = e; else delete hadirEdits[nisn];
}

window.saveKehadiran = async function () {
  const nisns = Object.keys(hadirEdits);
  if (!nisns.length) { C.toast('Tidak ada perubahan', 'info'); return; }
  const rows = nisns.map(n => C.pelengkapPatchToRow(n, numPatch(hadirEdits[n])));
  const ok = await adminWrite('savePelengkap', { rows, info: 'Kehadiran ' + nisns.length + ' siswa' }, 'Kehadiran ' + nisns.length + ' siswa disimpan');
  if (ok) { hadirEdits = {}; window.renderKehadiran(); }
};

function numPatch(patch) {
  const out = {};
  Object.keys(patch).forEach(k => { const n = C.num(patch[k]); out[k] = n === null ? '' : n; });
  return out;
}

window.isiHadirOtomatis = function () {
  const ef = hadirEfektif();
  if (!ef) {
    C.toast('Isi dulu "Hari efektif semester"', 'warning');
    document.getElementById('hadir-efektif').focus();
    return;
  }
  const list = hadirScopeStudents();
  openModal('Isi HADIR Otomatis',
    '<p class="muted" style="margin-bottom:12px;">HADIR = <b>' + ef + '</b> hari efektif &minus; Sakit &minus; Izin &minus; Tidak Hadir. Berlaku untuk ' + list.length + ' siswa yang tampil (' +
      (document.getElementById('hadir-scope').value === '__all' ? 'semua kelas' : 'Kelas ' + esc(AppState.selectedClass)) + ').</p>' +
    '<div class="form-group"><label>Terapkan ke</label><select class="form-control" id="ho-target"><option value="empty">Hanya siswa yang kolom HADIR-nya masih kosong</option><option value="all">Semua siswa (timpa)</option></select></div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="ho-go">Hitung</button></div>');
  document.getElementById('ho-go').onclick = () => {
    const all = document.getElementById('ho-target').value === 'all';
    let n = 0;
    list.forEach(s => {
      const p = hadirOf(s.nisn);
      if (!all && C.isFilled(p.hadir)) return;
      const h = Math.max(0, ef - (C.num(p.sakit) || 0) - (C.num(p.izin) || 0) - (C.num(p.alpa) || 0));
      setHadirEdit(s.nisn, { hadir: String(h) });
      n++;
    });
    closeModal();
    window.renderKehadiran();
    C.toast('HADIR dihitung untuk ' + n + ' siswa. Klik "Simpan Perubahan" untuk mengirim ke spreadsheet.', 'success');
  };
};

/* ===========================================================
   TEMPLATE & EXPORT
   =========================================================== */
function hadirRows(students, useAbsen) {
  return students.map((s, i) => {
    const p = hadirOf(s.nisn);
    return [useAbsen ? (s.no || i + 1) : i + 1, s.nisn, s.nis, s.nama, s.kelas, C.num(p.hadir), C.num(p.sakit), C.num(p.izin), C.num(p.alpa)];
  });
}

window.downloadTemplateKehadiran = function (onlyClass) {
  if (!xlReady()) return;
  const students = onlyClass ? classStudents() : AppState.data.students;
  if (!students.length) { C.toast('Belum ada data siswa', 'warning'); return; }
  const cfg = AppState.config;
  const wb = XLSX.utils.book_new();
  // Sheet data di urutan pertama: saat "Simpan Sebagai CSV", Excel menyimpan sheet yang aktif
  XLSX.utils.book_append_sheet(wb, makeSheet(HADIR_HEAD, hadirRows(students, onlyClass), [5, 14, 10, 34, 8, 9, 9, 9, 13], [1, 2], [1]), 'Kehadiran');
  XLSX.utils.book_append_sheet(wb, petunjukSheet([
    'PETUNJUK IMPORT KEHADIRAN - ' + cfg.nama_sekolah,
    'Semester ' + cfg.semester + ' Tahun Pelajaran ' + cfg.tahun_ajaran + (onlyClass ? ' - Kelas ' + AppState.selectedClass : ' - Semua Kelas'),
    '',
    '1. Isi sheet "Kehadiran" kolom HADIR, SAKIT, IZIN, TIDAK HADIR dengan jumlah hari (angka bulat).',
    '2. Jangan mengubah judul kolom: NO;NISN;NIS;NAMA;KELAS;HADIR;SAKIT;IZIN;TIDAK HADIR. Siswa dicocokkan lewat NISN (lalu NIS / nama + kelas).',
    '3. Sel yang dikosongkan TIDAK menghapus data yang sudah ada di aplikasi.',
    '4. Simpan: File > Simpan Sebagai > CSV (pemisah titik koma / koma), atau langsung simpan sebagai Excel.',
    '5. Di aplikasi Admin: menu Kehadiran Siswa > Import CSV > pilih file. Periksa pratinjau, lalu simpan.',
    '',
    hadirEfektif() ? 'Hari efektif semester: ' + hadirEfektif() + ' hari (HADIR + SAKIT + IZIN + TIDAK HADIR sebaiknya sama dengan angka ini).' : 'Tips: atur "Hari efektif semester" di aplikasi agar HADIR bisa dihitung otomatis.'
  ]), 'Petunjuk');
  XLSX.writeFile(wb, 'Template_Kehadiran_' + (onlyClass ? 'Kelas_' + AppState.selectedClass : 'Semua_Kelas') + '.xlsx');
  C.toast('Template kehadiran diunduh', 'success');
};

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

window.downloadTemplateKehadiranCsv = function () {
  const students = hadirScopeStudents();
  if (!students.length) { C.toast('Belum ada data siswa', 'warning'); return; }
  const lines = [HADIR_HEAD.join(';')].concat(hadirRows(students, document.getElementById('hadir-scope').value !== '__all').map(r => r.map(csvCell).join(';')));
  C.downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
    'Template_Kehadiran_' + (document.getElementById('hadir-scope').value === '__all' ? 'Semua_Kelas' : 'Kelas_' + AppState.selectedClass) + '.csv');
  C.toast('Template CSV diunduh (pemisah titik koma)', 'success');
};

window.exportKehadiranExcel = function () {
  if (!xlReady()) return;
  const wb = XLSX.utils.book_new();
  AppState.data.classes.forEach(k => {
    const students = classStudents(k);
    if (!students.length) return;
    const rows = hadirRows(students, true).map((r, i) => r.concat([pctHadir(hadirOf(students[i].nisn))]));
    XLSX.utils.book_append_sheet(wb, makeSheet(HADIR_HEAD.concat(['PERSEN HADIR']), rows, [5, 14, 10, 34, 8, 9, 9, 9, 13, 13], [1, 2]), ('Kehadiran_' + k).slice(0, 31));
  });
  if (!wb.SheetNames.length) { C.toast('Belum ada data siswa', 'warning'); return; }
  XLSX.writeFile(wb, 'Rekap_Kehadiran_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  C.toast('Rekap kehadiran diexport (1 sheet per kelas)', 'success');
};

/* ===========================================================
   IMPORT CSV / EXCEL
   =========================================================== */
// Pemisah dideteksi dari baris pertama (; , atau tab). Mendukung tanda kutip & baris baru di dalam sel.
function parseCsv(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = [';', ',', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

function sameNisn(a, b) {
  const x = String(a || '').trim(), y = String(b || '').trim();
  if (!x || !y) return false;
  return x === y || (/^\d+$/.test(x) && /^\d+$/.test(y) && x.replace(/^0+/, '') === y.replace(/^0+/, ''));
}

function processKehadiranRows(aoa, fileName) {
  const hi = aoa.findIndex(r => r.some(c => ['NISN', 'NAMA', 'NAMA_SISWA'].indexOf(normKey(c)) >= 0));
  if (hi < 0) { C.toast('Kolom NISN / NAMA tidak ditemukan. Gunakan template kehadiran (NO;NISN;NIS;NAMA;KELAS;HADIR;SAKIT;IZIN;TIDAK HADIR).', 'error'); return; }
  const head = aoa[hi].map(normKey);
  const col = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const ci = {
    nisn: col(['NISN']), nis: col(['NIS']), nama: col(['NAMA', 'NAMA_SISWA', 'NAMA_LENGKAP']), kelas: col(['KELAS', 'ROMBEL']),
    hadir: col(['HADIR', 'H']), sakit: col(['SAKIT', 'S']), izin: col(['IZIN', 'ISIN', 'I']),
    alpa: col(['TIDAK_HADIR', 'TIDAKHADIR', 'ALPA', 'ALFA', 'TANPA_KETERANGAN', 'TK', 'A'])
  };
  if (HADIR_KEYS.every(k => ci[k] < 0)) { C.toast('Kolom HADIR / SAKIT / IZIN / TIDAK HADIR tidak ditemukan di file', 'error'); return; }

  const db = AppState.db;
  const byNamaKelas = {}, byNama = {};
  db.siswa.forEach(s => {
    byNamaKelas[s.nama + '|' + s.kelas] = s;
    (byNama[s.nama] = byNama[s.nama] || []).push(s);
  });
  const ef = hadirEfektif();
  const issues = [];
  const found = {};
  let dibaca = 0, cocok = 0, tidakAda = 0;

  aoa.slice(hi + 1).forEach((r, idx) => {
    const where = 'Baris ' + (hi + idx + 2);
    const cell = i => (i >= 0 && r[i] !== undefined && r[i] !== null ? String(r[i]).trim().replace(/^="(.*)"$/, '$1') : '');
    const nisn = cell(ci.nisn).replace(/\.0+$/, '');
    const nis = cell(ci.nis);
    const nama = cell(ci.nama).toUpperCase().replace(/\s+/g, ' ');
    const kelas = cell(ci.kelas).toUpperCase().replace(/\s+/g, '');
    if (!nisn && !nama) return;
    dibaca++;
    let s = nisn ? db.siswa.find(x => sameNisn(x.nisn, nisn)) : null;
    if (!s && nis) s = db.siswa.find(x => x.nis && sameNisn(x.nis, nis));
    if (!s && nama) s = byNamaKelas[nama + '|' + kelas] || ((byNama[nama] || []).length === 1 ? byNama[nama][0] : null);
    if (!s) { tidakAda++; issues.push(where + ': siswa "' + (nama || nisn) + '" (NISN ' + (nisn || '-') + ') tidak ditemukan - dilewati'); return; }
    cocok++;
    if (kelas && kelas !== s.kelas) issues.push(where + ': ' + s.nama + ' tercatat di kelas ' + s.kelas + ' (di file: ' + kelas + ')');
    if (found[s.nisn]) issues.push(where + ': ' + s.nama + ' muncul lebih dari sekali - baris terakhir dipakai');

    const vals = {};
    HADIR_KEYS.forEach(k => {
      const raw = cell(ci[k]);
      if (raw === '') return; // kosong = tidak diubah
      const n = C.num(raw);
      if (n === null || n < 0 || n !== Math.floor(n)) { issues.push(where + ': ' + HADIR_LABEL[k] + ' "' + raw + '" tidak valid (harus bilangan bulat >= 0) - dilewati'); return; }
      if (n > 366) { issues.push(where + ': ' + HADIR_LABEL[k] + ' ' + n + ' terlalu besar - dilewati'); return; }
      vals[k] = n;
    });
    if (ef && HADIR_KEYS.every(k => vals[k] !== undefined)) {
      const total = HADIR_KEYS.reduce((a, k) => a + vals[k], 0);
      if (total !== ef) issues.push(where + ': ' + s.nama + ' jumlah H+S+I+TH = ' + total + ' (hari efektif ' + ef + ')');
    }
    const cur = db.pelengkap[s.nisn] || {};
    const diff = {};
    Object.keys(vals).forEach(k => { if (String(cur[k] || '') !== String(vals[k])) diff[k] = vals[k]; });
    found[s.nisn] = { s, cur, diff };
  });

  const changes = Object.values(found).filter(x => Object.keys(x.diff).length);
  showKehadiranPreview(fileName, { dibaca, cocok, tidakAda, sama: Object.keys(found).length - changes.length }, changes, issues);
}

function showKehadiranPreview(fileName, st, changes, issues) {
  const cellHtml = (x, k) => {
    if (x.diff[k] === undefined) return '<td class="center muted">' + esc(x.cur[k] || '-') + '</td>';
    return '<td class="center"><span class="muted" style="text-decoration:line-through;">' + esc(x.cur[k] || '-') + '</span> &rarr; <b>' + x.diff[k] + '</b></td>';
  };
  openModal('Pratinjau Import Kehadiran: ' + fileName,
    '<div class="import-summary">' +
      '<div><b>' + st.dibaca + '</b>Baris dibaca</div><div><b>' + st.cocok + '</b>Siswa cocok</div>' +
      '<div><b>' + changes.length + '</b>Akan diubah</div><div><b>' + st.sama + '</b>Tidak berubah</div>' +
      '<div><b>' + st.tidakAda + '</b>Tidak ditemukan</div>' +
    '</div>' +
    (issues.length ? '<div style="font-weight:700;margin-bottom:6px;color:var(--warning);">⚠️ ' + issues.length + ' catatan:</div><ul class="issue-list">' +
      issues.slice(0, 80).map(i => '<li>' + esc(i) + '</li>').join('') + (issues.length > 80 ? '<li>... dan ' + (issues.length - 80) + ' lainnya</li>' : '') + '</ul>' : '') +
    (changes.length ? '<div class="table-responsive" style="max-height:320px;margin-top:12px;"><table class="data-table"><thead><tr><th>NAMA</th><th class="center">KELAS</th><th class="center">HADIR</th><th class="center">SAKIT</th><th class="center">IZIN</th><th class="center">TIDAK HADIR</th></tr></thead><tbody>' +
      changes.slice(0, 200).map(x => '<tr><td><strong>' + esc(x.s.nama) + '</strong></td><td class="center">' + esc(x.s.kelas) + '</td>' + HADIR_KEYS.map(k => cellHtml(x, k)).join('') + '</tr>').join('') +
      '</tbody></table></div>' : '<p style="margin-top:12px;font-weight:700;">Tidak ada perubahan baru dibanding data di aplikasi.</p>') +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-secondary" id="hi-table"' + (changes.length ? '' : ' disabled') + '>Masukkan ke Tabel (periksa dulu)</button>' +
      '<button class="btn btn-success" id="hi-go"' + (changes.length ? '' : ' disabled') + '>Simpan ' + changes.length + ' Perubahan ke Spreadsheet</button></div>', true);
  if (!changes.length) return;
  document.getElementById('hi-table').onclick = () => {
    changes.forEach(x => { const p = {}; Object.keys(x.diff).forEach(k => { p[k] = String(x.diff[k]); }); setHadirEdit(x.s.nisn, p); });
    closeModal();
    document.getElementById('hadir-filter').value = 'dirty';
    if (changes.some(x => x.s.kelas !== AppState.selectedClass)) document.getElementById('hadir-scope').value = '__all';
    window.renderKehadiran();
    C.toast(changes.length + ' siswa dimasukkan ke tabel. Periksa lalu klik "Simpan Perubahan".', 'info');
  };
  document.getElementById('hi-go').onclick = async () => {
    closeModal();
    const rows = changes.map(x => C.pelengkapPatchToRow(x.s.nisn, x.diff));
    const ok = await adminWrite('savePelengkap', { rows, info: 'Import kehadiran ' + fileName }, 'Kehadiran ' + rows.length + ' siswa diimport');
    if (ok) {
      changes.forEach(x => { delete hadirEdits[x.s.nisn]; });
      if (AppState.activeTab === 'kehadiran') window.renderKehadiran();
    }
  };
}

function handleKehadiranFile(file) {
  const name = file.name.toLowerCase();
  if (/\.xlsx?$/.test(name)) {
    if (!xlReady()) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const sheetName = wb.SheetNames.find(n => normKey(n) === 'KEHADIRAN') || wb.SheetNames[0];
        processKehadiranRows(XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false }), file.name);
      } catch (err) {
        C.toast('Gagal membaca file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }
  const read = (enc, done) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result || ''));
    reader.onerror = () => C.toast('File tidak dapat dibaca', 'error');
    reader.readAsText(file, enc);
  };
  read('utf-8', text => {
    // CSV dari Excel Windows sering ber-encoding ANSI: baca ulang bila ada karakter rusak
    if (text.indexOf('�') >= 0) read('windows-1252', t2 => processKehadiranRows(parseCsv(t2), file.name));
    else processKehadiranRows(parseCsv(text), file.name);
  });
}

/* ===========================================================
   CETAK REKAP
   =========================================================== */
window.printKehadiran = function () {
  const cfg = AppState.config;
  const kelasList = document.getElementById('hadir-scope').value === '__all' ? AppState.data.classes : [AppState.selectedClass];
  const ef = hadirEfektif();
  const pages = kelasList.map(k => {
    const students = classStudents(k);
    if (!students.length) return '';
    return '<div class="raport-sheet">' + kopSuratHtml() +
      '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:14pt;font-weight:bold;">REKAP KEHADIRAN SISWA KELAS ' + esc(k) + '</div>' +
      '<div style="font-size:12pt;font-weight:bold;">SEMESTER ' + esc(String(cfg.semester || '').toUpperCase()) + ' TAHUN PELAJARAN ' + esc(cfg.tahun_ajaran) + (ef ? ' &bull; ' + ef + ' HARI EFEKTIF' : '') + '</div></div>' +
      '<table class="raport-table" style="font-size:10.5pt;"><thead><tr><th>NO</th><th>NISN</th><th>NAMA SISWA</th><th>HADIR</th><th>SAKIT</th><th>IZIN</th><th>TIDAK HADIR</th><th>% HADIR</th></tr></thead><tbody>' +
      students.map((s, i) => {
        const p = hadirOf(s.nisn);
        const pc = pctHadir(p);
        return '<tr><td>' + (s.no || i + 1) + '</td><td>' + esc(s.nisn) + '</td><td style="text-align:left;padding-left:8px;">' + esc(s.nama) + '</td>' +
          HADIR_KEYS.map(key => '<td>' + esc(C.isFilled(p[key]) ? p[key] : '-') + '</td>').join('') + '<td>' + (pc === null ? '-' : C.fmtNum(pc) + '%') + '</td></tr>';
      }).join('') + '</tbody></table>' + ttdKepsekWaliHtml(k) + '</div>';
  }).join('');
  if (!pages) { C.toast('Tidak ada siswa untuk dicetak', 'warning'); return; }
  printHtml(pages, false);
};

/* ===========================================================
   PROGRES ISIAN WALI KELAS
   =========================================================== */
function waliProgress() {
  return AppState.data.classes.map(k => {
    const students = classStudents(k);
    const cnt = fn => students.filter(s => fn(AppState.db.pelengkap[s.nisn] || {})).length;
    return {
      kelas: k, wali: getWali(k).nama, total: students.length,
      hadir: cnt(hadirTerisi),
      kk: cnt(p => !!(p.kk_nilai || p.kk_desk || p.kk_kuat || p.kk_lemah)),
      ek: cnt(p => !!(p.ek1_nilai || p.ek2_nilai))
    };
  }).filter(r => r.total);
}

function renderWaliProgress() {
  const bar = (n, total) => {
    const pct = total ? Math.round(n / total * 100) : 0;
    const color = pct === 100 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--danger)';
    return '<td><div style="display:flex;justify-content:space-between;font-size:11.5px;"><span>' + n + '/' + total + '</span><b style="color:' + color + ';">' + pct + '%</b></div>' +
      '<div class="mini-bar"><i style="width:' + pct + '%;background:' + color + ';"></i></div></td>';
  };
  const rows = waliProgress();
  document.getElementById('wali-progress-body').innerHTML = rows.length ? rows.map(r =>
    '<tr' + (r.kelas === AppState.selectedClass ? ' style="background:rgba(79,70,229,0.06);"' : '') + '><td class="center"><strong>' + esc(r.kelas) + '</strong></td><td>' + esc(r.wali) + '</td><td class="center">' + r.total + '</td>' +
    bar(r.hadir, r.total) + bar(r.kk, r.total) + bar(r.ek, r.total) + '</tr>').join('')
    : '<tr><td colspan="6" class="center muted">Belum ada data siswa.</td></tr>';
}

window.copyWaWali = function () {
  const cfg = AppState.config;
  const kurang = waliProgress().filter(r => r.hadir < r.total || (cfg.wali_kokurikuler && r.kk < r.total) || (cfg.wali_ekskul && r.ek < r.total));
  if (!kurang.length) { C.toast('Semua isian wali kelas sudah lengkap!', 'success'); return; }
  let text = '📢 *PENGINGAT ISIAN WALI KELAS*\n*' + cfg.nama_sekolah + '*\nSemester ' + cfg.semester + ' ' + cfg.tahun_ajaran + '\n\n' +
    'Yth. Bapak/Ibu Wali Kelas, berikut isian raport yang masih kurang:\n\n';
  kurang.forEach((r, i) => {
    const bagian = [];
    if (r.hadir < r.total) bagian.push('Kehadiran ' + r.hadir + '/' + r.total);
    if (cfg.wali_kokurikuler && r.kk < r.total) bagian.push('Kokurikuler ' + r.kk + '/' + r.total);
    if (cfg.wali_ekskul && r.ek < r.total) bagian.push('Ekskul ' + r.ek + '/' + r.total);
    text += (i + 1) + '. *Kelas ' + r.kelas + '* (' + r.wali + '): ' + bagian.join(', ') + '\n';
  });
  text += '\nMohon dilengkapi melalui aplikasi guru menu *Wali Kelas*, lalu tekan *Sinkron*. Terima kasih 🙏';
  const done = () => C.toast('Teks pengingat WhatsApp disalin!', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => prompt('Salin teks berikut:', text));
  else prompt('Salin teks berikut:', text);
};

document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('hadir-table-body');
  body.addEventListener('change', e => {
    const k = e.target.dataset.hk;
    const tr = e.target.closest('tr[data-nisn]');
    if (!k || !tr) return;
    const raw = e.target.value.trim();
    const n = raw === '' ? null : C.num(raw);
    if (raw !== '' && (n === null || n < 0 || n !== Math.floor(n))) {
      e.target.style.borderColor = 'var(--danger)';
      C.toast('Isi dengan bilangan bulat 0 atau lebih', 'warning');
      return;
    }
    e.target.style.borderColor = '';
    const patch = {};
    patch[k] = raw === '' ? '' : String(n);
    setHadirEdit(tr.dataset.nisn, patch);
    tr.classList.toggle('cell-dirty', !!hadirEdits[tr.dataset.nisn]);
    tr.querySelector('[data-pct]').innerHTML = pctBadge(hadirOf(tr.dataset.nisn));
    updateHadirBtn();
  });
  ['hadir-scope', 'hadir-filter'].forEach(id => document.getElementById(id).addEventListener('change', () => window.renderKehadiran()));
  let t;
  document.getElementById('hadir-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => window.renderKehadiran(), 200); });
  document.getElementById('hadir-efektif').addEventListener('change', async e => {
    const v = C.num(e.target.value);
    if (v !== null && (v < 0 || v > 366)) { C.toast('Hari efektif tidak valid', 'warning'); return; }
    await persistConfigKey('hari_efektif', v === null ? '' : v);
    window.renderKehadiran();
    C.toast(v ? 'Hari efektif: ' + v + ' hari' : 'Hari efektif dikosongkan', 'success');
  });
  document.getElementById('hadir-file-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) handleKehadiranFile(f);
    e.target.value = '';
  });
  window.addEventListener('beforeunload', e => {
    if (window.kehadiranDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
});
