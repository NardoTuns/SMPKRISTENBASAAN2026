/**
 * Mesin Raport: format Laporan Mid Semester (sama dengan versi sebelumnya).
 * Pratinjau, cetak, PDF (html2pdf), Word (.doc) & ZIP.
 * SMP KRISTEN 65 BASAAN
 */

const RAPORT_THEMES = [
  { id: 'default', nama: 'Default (Template Resmi)' },
  { id: 'hijau', nama: 'Hijau Asri' },
  { id: 'navy', nama: 'Biru Navy Formal' },
  { id: 'marun', nama: 'Marun Elegan' },
  { id: 'monokrom', nama: 'Hitam Putih (Hemat Tinta)' }
];

// Warna konkret tiap tema (untuk file Word yang tidak mendukung variabel CSS)
const THEME_COLORS = {
  default: { head: '#b8cce4', headFg: '#000000', sum: '#fcd5b5', border: '#000000' },
  hijau: { head: '#2e7d32', headFg: '#ffffff', sum: '#dcedc8', border: '#1b5e20' },
  navy: { head: '#1f3864', headFg: '#ffffff', sum: '#d9e2f3', border: '#1f3864' },
  marun: { head: '#7b1e1e', headFg: '#ffffff', sum: '#f4e1cf', border: '#5a1515' },
  monokrom: { head: '#d9d9d9', headFg: '#000000', sum: '#efefef', border: '#000000' }
};

function getRaportTheme() {
  const t = (AppState.config || {}).tema_raport;
  return RAPORT_THEMES.some(x => x.id === t) ? t : 'default';
}

async function persistConfigKey(key, value) {
  AppState.db.config[key] = value;
  AppState.config[key] = value;
  C.saveDB(AppState.db);
  if (C.isDemo() || C.isOnline()) {
    try { const p = {}; p[key] = value; await C.api('saveConfig', { config: p }); } catch (e) { /* tetap tersimpan lokal */ }
  }
}

window.changeRaportTheme = async function (tema) {
  await persistConfigKey('tema_raport', tema);
  updateSingleRaportPreview();
  C.toast('Tema raport: ' + ((RAPORT_THEMES.find(t => t.id === tema) || {}).nama || tema), 'success');
};

/* ===========================================================
   RENDER TAB
   =========================================================== */
window.renderRaport = function () {
  if (!AppState.data) return;
  const students = classStudents();
  const sel = document.getElementById('raport-student-select');
  const container = document.getElementById('raport-preview-container');
  if (!students.length) {
    sel.innerHTML = '';
    document.getElementById('raport-warning').innerHTML = '';
    container.innerHTML = '<div class="empty-state"><strong>Belum ada siswa di Kelas ' + esc(AppState.selectedClass || '-') + '</strong>Tambahkan siswa di menu Data Siswa atau import Excel.</div>';
    return;
  }
  sel.innerHTML = students.map(s => '<option value="' + esc(s.nisn) + '">' + esc((s.no ? s.no + '. ' : '') + s.nama + '  [#' + s.ranking + ']') + '</option>').join('');
  if (!AppState.selectedStudentNisn || !students.some(s => s.nisn === String(AppState.selectedStudentNisn))) {
    AppState.selectedStudentNisn = students[0].nisn;
  }
  sel.value = AppState.selectedStudentNisn;

  const themeSel = document.getElementById('raport-theme-select');
  if (!themeSel.options.length) themeSel.innerHTML = RAPORT_THEMES.map(t => '<option value="' + t.id + '">' + esc(t.nama) + '</option>').join('');
  themeSel.value = getRaportTheme();
  updateSingleRaportPreview();
};

function currentStudent() {
  return AppState.data.students.find(s => s.nisn === String(AppState.selectedStudentNisn));
}

function updateSingleRaportPreview() {
  const st = currentStudent();
  const container = document.getElementById('raport-preview-container');
  if (!st || !container) return;
  container.innerHTML = generateRaportHtml(st);
  renderRaportWarning(st);
}

function renderRaportWarning(st) {
  const noVal = AppState.config.mapel_list.filter(m => st.grades[m.key] === null).map(m => m.key);
  const el = document.getElementById('raport-warning');
  if (!noVal.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="card" style="padding:12px 16px;border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.07);margin-bottom:12px;font-size:13px;">⚠️ ' +
    '<b>Nilai belum ada:</b> ' + noVal.map(esc).join(', ') + '.</div>';
}

/* ===========================================================
   LEMBAR RAPORT (Laporan Hasil Ujian Tengah Semester)
   =========================================================== */
function generateRaportHtml(student, forWord) {
  const cfg = AppState.config;
  const w = getWali(student.kelas);
  const tampilkanKet = cfg.tampilkan_keterangan !== false;
  let rows = '';
  let total = 0;
  cfg.mapel_list.forEach((m, idx) => {
    const v = student.grades[m.key];
    let ket = '';
    if (v !== null) {
      total += v;
      if (tampilkanKet) ket = v >= m.kkm ? 'Tuntas' : 'Belum Tuntas';
    }
    rows += '<tr><td style="width:38px;">' + (idx + 1) + '</td><td class="mapel-name">' + esc(m.nama) + '</td><td style="width:80px;">' + m.kkm + '</td>' +
      '<td class="score-val" style="width:90px;">' + (v === null ? '-' : C.fmtNum(v)) + '</td><td style="width:120px;">' + ket + '</td></tr>';
  });
  const imgBase = forWord ? new URL('assets/', location.href).href : 'assets/';
  return '<div class="raport-sheet" data-tema="' + getRaportTheme() + '">' +
    '<div class="kop-surat"><img class="kop-logo" src="' + imgBase + 'logo_left.png" alt="" width="75" height="75">' +
    '<div class="kop-text"><div class="kop-yayasan">' + esc(cfg.yayasan) + '</div><div class="kop-bidang">' + esc(cfg.bidang) + '</div>' +
    '<div class="kop-sekolah">' + esc(cfg.nama_sekolah) + '</div><div class="kop-alamat">' + esc(cfg.alamat) + '</div></div>' +
    '<img class="kop-logo" src="' + imgBase + 'logo_right.png" alt="" width="75" height="75"></div><div class="kop-garis"></div>' +
    '<div class="raport-judul-wrap"><div class="raport-judul">' + esc(cfg.judul_laporan) + '</div><div class="raport-subjudul">' + esc(cfg.subjudul) + '</div>' +
    '<div class="raport-tahun">TAHUN AJARAN ' + esc(cfg.tahun_ajaran) + '</div></div>' +
    '<div class="raport-identitas"><div class="identitas-row"><div class="identitas-label">NAMA</div><div class="identitas-colon">:</div><div class="identitas-val">' + esc(student.nama) + '</div></div>' +
    '<div class="identitas-row"><div class="identitas-label">KELAS</div><div class="identitas-colon">:</div><div class="identitas-val">' + esc(student.kelas) + '</div></div></div>' +
    '<table class="raport-table"><thead><tr><th>NO</th><th>MATA PELAJARAN</th><th>KKM</th><th>NILAI</th><th>KETERANGAN</th></tr></thead><tbody>' + rows +
    '<tr class="row-summary"><td colspan="3">JUMLAH</td><td class="score-val">' + C.fmtNum(total) + '</td><td></td></tr>' +
    '<tr class="row-summary"><td colspan="3">RANKING</td><td class="score-val">' + student.ranking + '</td><td></td></tr></tbody></table>' +
    '<div class="raport-ttd-wrap"><div class="raport-ttd"><div>' + esc(cfg.tempat_raport) + ', &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + esc(cfg.tanggal_raport) + '</div><div>WALI KELAS</div>' +
    '<div class="raport-ttd-space"></div><div class="raport-ttd-nama">' + esc(w.nama) + '</div>' +
    (w.nip ? '<div style="font-size:11pt;font-weight:normal;margin-top:2px;">NIP. ' + esc(w.nip) + '</div>' : '') + '</div></div></div>';
}

/* ===========================================================
   CETAK
   =========================================================== */
window.printSingleRaport = function () {
  const st = currentStudent();
  if (st) printHtml(generateRaportHtml(st), false);
};

window.printAllRaportClass = function () {
  const students = classStudents();
  if (!students.length) { C.toast('Tidak ada siswa untuk dicetak', 'error'); return; }
  C.toast('Menyiapkan cetak massal ' + students.length + ' siswa Kelas ' + AppState.selectedClass + '...', 'info');
  setTimeout(() => printHtml(students.map(s => generateRaportHtml(s)).join(''), false), 50);
};

/* ===========================================================
   PDF (html2pdf, di browser) - 1 siswa = 1 halaman F4
   =========================================================== */
function canUseClientPdf() {
  return typeof html2pdf !== 'undefined' && location.protocol !== 'file:';
}

function pdfPageEl(html) {
  const page = document.createElement('div');
  page.className = 'pdf-export';
  page.innerHTML = html;
  return page;
}

async function makeRaportPdf(students, filename, mode, preWin) {
  const all = students.map(s => generateRaportHtml(s));
  const opt = {
    margin: [10, 15, 10, 15],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: [215, 330], orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all'] }
  };
  loading(true, 'Membuat PDF halaman 1 dari ' + all.length + '...');
  try {
    let worker = html2pdf().set(opt).from(pdfPageEl(all[0])).toPdf();
    all.slice(1).forEach((html, i) => {
      worker = worker.get('pdf').then(pdf => {
        pdf.addPage();
        loading(true, 'Membuat PDF halaman ' + (i + 2) + ' dari ' + all.length + '...');
      }).from(pdfPageEl(html)).toContainer().toCanvas().toPdf();
    });
    if (mode === 'open') {
      const url = await worker.output('bloburl');
      if (preWin) preWin.location.href = url;
      else if (!window.open(url, '_blank')) C.toast('Pop-up terblokir. Izinkan pop-up untuk membuka PDF.', 'warning');
    } else {
      await worker.save();
    }
  } finally {
    loading(false);
  }
}

async function raportPdfAction(students, filename, mode) {
  if (!students.length) { C.toast('Tidak ada siswa', 'error'); return; }
  if (!canUseClientPdf()) {
    C.toast('Pilih "Simpan sebagai PDF" pada jendela cetak untuk menyimpan PDF.', 'info');
    printHtml(students.map(s => generateRaportHtml(s)).join(''), false);
    return;
  }
  const preWin = mode === 'open' ? window.open('', '_blank') : null;
  if (preWin) preWin.document.write('<p style="font-family:sans-serif;padding:20px;">Menyiapkan PDF raport...</p>');
  try {
    await makeRaportPdf(students, filename, mode, preWin);
    if (mode !== 'open') C.toast('PDF berhasil disimpan: ' + filename, 'success');
  } catch (e) {
    if (preWin) preWin.close();
    console.warn(e);
    C.toast('PDF gagal dibuat, beralih ke jendela cetak.', 'warning');
    printHtml(students.map(s => generateRaportHtml(s)).join(''), false);
  }
}

window.downloadClassRaportPdf = () => raportPdfAction(classStudents(), 'Raport_Kelas_' + AppState.selectedClass + '.pdf', 'save');
window.openClassRaportPdf = () => raportPdfAction(classStudents(), 'Raport_Kelas_' + AppState.selectedClass + '.pdf', 'open');
window.downloadSingleRaportPdf = () => {
  const st = currentStudent();
  if (st) raportPdfAction([st], 'Raport_' + st.kelas + '_' + C.safeFileName(st.nama) + '.pdf', 'save');
};
window.openSingleRaportPdf = () => {
  const st = currentStudent();
  if (st) raportPdfAction([st], 'Raport_' + st.kelas + '_' + C.safeFileName(st.nama) + '.pdf', 'open');
};

/* ===========================================================
   WORD (.doc berbasis HTML - bisa dibuka & diedit di MS Word)
   =========================================================== */
function wordCss() {
  const t = THEME_COLORS[getRaportTheme()] || THEME_COLORS.default;
  return '@page Section1 { size: 21.5cm 33.0cm; margin: 1.2cm 1.5cm 1.2cm 1.5cm; }' +
    'div.Section1 { page: Section1; } body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; }' +
    '.kop-surat { text-align: center; } .kop-yayasan, .kop-bidang { font-size: 14pt; font-weight: bold; } .kop-sekolah { font-size: 22pt; font-weight: bold; }' +
    '.kop-garis { border-bottom: 3px double #000; margin: 4px 0 10px; }' +
    '.raport-judul-wrap { text-align: center; font-weight: bold; font-size: 14pt; margin: 14px 0; }' +
    '.raport-identitas { font-size: 13pt; font-weight: bold; } .identitas-row div { display: inline; }' +
    'table.raport-table { width: 100%; border-collapse: collapse; font-size: 13pt; }' +
    '.raport-table th, .raport-table td { border: 1.5px solid ' + t.border + '; padding: 5px; text-align: center; }' +
    '.raport-table td.mapel-name { text-align: left; }' +
    '.raport-table th { background: ' + t.head + '; color: ' + t.headFg + '; } .row-summary td { background: ' + t.sum + '; font-weight: bold; }' +
    '.raport-ttd-wrap { text-align: right; margin-top: 20px; font-weight: bold; } .raport-ttd-space { height: 70px; }';
}

function buildWordDoc(students) {
  const pageBreak = '<br clear="all" style="mso-special-character:line-break;page-break-before:always">';
  const body = students.map(s => generateRaportHtml(s, true)).join(pageBreak);
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>Raport</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
    '<style>' + wordCss() + '</style></head><body><div class="Section1">' + body + '</div></body></html>';
}

function wordBlob(students) {
  return new Blob(['﻿', buildWordDoc(students)], { type: 'application/msword' });
}

window.downloadSingleDocx = function () {
  const st = currentStudent();
  if (!st) return;
  C.downloadBlob(wordBlob([st]), 'Raport_' + st.kelas + '_' + C.safeFileName(st.nama) + '.doc');
  C.toast('File Word untuk ' + st.nama + ' diunduh', 'success');
};

window.downloadClassDoc = function () {
  const students = classStudents();
  if (!students.length) { C.toast('Tidak ada siswa', 'error'); return; }
  C.downloadBlob(wordBlob(students), 'Raport_Kelas_' + AppState.selectedClass + '.doc');
  C.toast('File Word 1 kelas diunduh (' + students.length + ' siswa)', 'success');
};

window.downloadClassZip = async function () {
  const students = classStudents();
  if (!students.length) { C.toast('Tidak ada siswa', 'error'); return; }
  if (typeof JSZip === 'undefined') { C.toast('Pustaka ZIP belum termuat', 'error'); return; }
  loading(true, 'Menyiapkan ZIP Word...');
  try {
    const zip = new JSZip();
    students.forEach((s, i) => {
      zip.file(String(s.no || i + 1).padStart(2, '0') + '_' + C.safeFileName(s.nama) + '.doc', '﻿' + buildWordDoc([s]));
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    C.downloadBlob(blob, 'Raport_Word_Kelas_' + AppState.selectedClass + '.zip');
    C.toast('ZIP Word Kelas ' + AppState.selectedClass + ' diunduh', 'success');
  } finally {
    loading(false);
  }
};

/* ===========================================================
   NAVIGASI SISWA
   =========================================================== */
function moveStudent(delta) {
  const students = classStudents();
  const idx = students.findIndex(s => s.nisn === String(AppState.selectedStudentNisn));
  const next = students[idx + delta];
  if (!next) return;
  AppState.selectedStudentNisn = next.nisn;
  document.getElementById('raport-student-select').value = next.nisn;
  updateSingleRaportPreview();
}

window.prevStudent = () => moveStudent(-1);
window.nextStudent = () => moveStudent(1);

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('raport-student-select').addEventListener('change', e => {
    AppState.selectedStudentNisn = e.target.value;
    updateSingleRaportPreview();
  });
});
