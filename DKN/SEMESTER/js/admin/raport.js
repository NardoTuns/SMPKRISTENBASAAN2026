/**
 * Mesin Raport: format Semester (sesuai "Template Rapor.pdf") & format Mid Semester (lama)
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
  default: { head: '#d9d9d9', headFg: '#000000', sum: '#e7e6e6', border: '#000000', accent: '#000000', midHead: '#b8cce4', midSum: '#fcd5b5' },
  hijau: { head: '#2e7d32', headFg: '#ffffff', sum: '#dcedc8', border: '#1b5e20', accent: '#1b5e20' },
  navy: { head: '#1f3864', headFg: '#ffffff', sum: '#d9e2f3', border: '#1f3864', accent: '#1f3864' },
  marun: { head: '#7b1e1e', headFg: '#ffffff', sum: '#f4e1cf', border: '#5a1515', accent: '#7b1e1e' },
  monokrom: { head: '#d9d9d9', headFg: '#000000', sum: '#efefef', border: '#000000', accent: '#000000' }
};

const MM = 96 / 25.4;              // piksel per mm
const PAGE_CONTENT_MM = 300;       // tinggi isi per halaman F4 (330mm - margin 2x12mm - cadangan)
const PAGE_WIDTH_MM = 187;         // lebar isi F4 (215mm - margin 2x14mm)

function getRaportTheme() {
  const t = (AppState.config || {}).tema_raport;
  return RAPORT_THEMES.some(x => x.id === t) ? t : 'default';
}

function getRaportFormat() {
  return (AppState.config || {}).format_raport === 'mid' ? 'mid' : 'semester';
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

window.changeRaportFormat = async function (fmt) {
  await persistConfigKey('format_raport', fmt);
  updateSingleRaportPreview();
  C.toast(fmt === 'mid' ? 'Format: Laporan Mid Semester' : 'Format: Raport Semester', 'success');
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
  document.getElementById('raport-format-select').value = getRaportFormat();
  updateSingleRaportPreview();
};

function currentStudent() {
  return AppState.data.students.find(s => s.nisn === String(AppState.selectedStudentNisn));
}

function updateSingleRaportPreview() {
  const st = currentStudent();
  const container = document.getElementById('raport-preview-container');
  if (!st || !container) return;
  container.innerHTML = buildRaportPagesHtml(st);
  renderRaportWarning(st);
}

function renderRaportWarning(st) {
  const mapel = AppState.config.mapel_list;
  const noVal = mapel.filter(m => st.grades[m.key] === null).map(m => m.key);
  const noDesk = mapel.filter(m => st.grades[m.key] !== null && (!st.desk[m.key] || !st.desk[m.key].kuasai)).map(m => m.key);
  const el = document.getElementById('raport-warning');
  if (!noVal.length && !noDesk.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="card" style="padding:12px 16px;border-color:rgba(245,158,11,0.5);background:rgba(245,158,11,0.07);margin-bottom:12px;font-size:13px;">⚠️ ' +
    (noVal.length ? '<b>Nilai belum ada:</b> ' + noVal.map(esc).join(', ') + '. ' : '') +
    (noDesk.length ? '<b>Deskripsi kosong:</b> ' + noDesk.map(esc).join(', ') + '.' : '') + '</div>';
}

/* ===========================================================
   FORMAT SEMESTER: SUSUNAN BLOK (unit)
   =========================================================== */
function qrDataUrl(st) {
  if (typeof qrcode === 'undefined' || !AppState.config.tampilkan_qr) return '';
  try {
    const cfg = AppState.config;
    const text = 'E-RAPORT ' + (cfg.nama_sekolah || '') + '\nNama: ' + st.nama + '\nNISN: ' + st.nisn + '\nKelas: ' + st.kelas +
      '\nSemester: ' + (cfg.semester || '') + ' ' + (cfg.tahun_ajaran || '') + '\nRata-rata: ' + C.fmtNum(st.average, 2) + '\nPeringkat: ' + st.ranking;
    const qr = qrcode(0, 'M');
    qr.addData(text.replace(/[^\x20-\x7E\n]/g, '?'));
    qr.make();
    return qr.createDataURL(4, 0);
  } catch (e) {
    return '';
  }
}

function groupedMapel() {
  const mapel = C.activeMapel(AppState.db);
  const keys = [];
  mapel.forEach(m => { if (keys.indexOf(m.kelompok) < 0) keys.push(m.kelompok); });
  keys.sort();
  return keys.map(k => ({ label: 'KELOMPOK ' + k, items: mapel.filter(m => m.kelompok === k) }));
}

const RS_COLGROUP = '<colgroup><col style="width:6%"><col style="width:22%"><col style="width:7%"><col style="width:8%"><col style="width:6%"><col style="width:51%"></colgroup>';

function semesterUnits(st, opts) {
  opts = opts || {};
  const cfg = AppState.config;
  const w = getWali(st.kelas);
  const pel = st.pelengkap || {};
  const units = [];
  const block = (html, keepNext) => units.push({ kind: 'block', html: html, keepNext: !!keepNext });
  const kelasLabel = (w.label || C.romawi(C.tingkatOf(st.kelas))) + '/' + (cfg.semester || '');

  block('<div class="rs-title">' + esc(cfg.judul_raport || 'PENCAPAIAN KOMPETENSI PESERTA DIDIK') + '</div>');
  block('<table class="rs-ident">' +
    '<tr><td class="lbl"><b>Nama Siswa</b></td><td colspan="3"><b>: ' + esc(st.nama) + '</b></td></tr>' +
    '<tr><td class="lbl">Nama Sekolah</td><td class="val">: ' + esc(cfg.nama_sekolah_raport) + '</td><td class="lbl2">NISN</td><td>: ' + esc(st.nisn) + '</td></tr>' +
    '<tr><td class="lbl">Alamat</td><td class="val">: ' + esc(cfg.alamat_raport) + '</td><td class="lbl2">Kelas</td><td>: ' + esc(kelasLabel) + '</td></tr>' +
    '<tr><td class="lbl">Semester</td><td class="val">: ' + esc(cfg.semester) + '</td><td class="lbl2">Thn. Pelajaran</td><td>: ' + esc(cfg.tahun_ajaran) + '</td></tr>' +
    '</table>');

  const sikapTable = (pred, desk) => '<table class="rs-table"><colgroup><col style="width:25%"><col style="width:75%"></colgroup>' +
    '<tr><th>Predikat</th><th>Deskripsi</th></tr><tr><td style="padding:6px 4px;">' + esc(pred) + '</td><td style="padding:6px 8px;">' + esc(desk) + '</td></tr></table>';
  block('<div class="rs-section">A. PENILAIAN SIKAP</div><div class="rs-sub">1. Sikap Spiritual</div>' +
    sikapTable(pel.sp_pred || cfg.sikap_spiritual_predikat, pel.sp_desk || cfg.sikap_spiritual_deskripsi));
  block('<div class="rs-sub" style="margin-top:2mm;">2. Sikap Sosial</div>' +
    sikapTable(pel.so_pred || cfg.sikap_sosial_predikat, pel.so_desk || cfg.sikap_sosial_deskripsi));

  block('<div class="rs-section">B. PENILAIAN PENGETAHUAN dan KETRAMPILAN</div>', true);

  const groups = groupedMapel();
  ['P', 'K'].forEach(type => {
    const label = type === 'P' ? 'PENGETAHUAN' : 'KETRAMPILAN';
    units.push({
      kind: 'thead', table: type, keepNext: true,
      html: '<thead><tr><th rowspan="2">NO</th><th rowspan="2">MATA PELAJARAN</th><th colspan="4">' + label + '</th></tr>' +
        '<tr><th>KKM</th><th>NILAI</th><th>Pre</th><th>Deskripsi</th></tr></thead>'
    });
    let no = 0;
    groups.forEach(g => {
      units.push({ kind: 'row', table: type, keepNext: true, html: '<tr class="rs-group"><td colspan="6">' + esc(g.label) + '</td></tr>' });
      g.items.forEach(m => {
        no++;
        const v = type === 'P' ? st.grades[m.kode] : st.gradesK[m.kode];
        const d = st.desk[m.kode] || {};
        const pred = C.predikat(v, cfg);
        const desk = C.buildDeskripsi(st.nama, v, d.kuasai, d.tingkatkan, cfg);
        units.push({
          kind: 'row', table: type,
          html: '<tr><td class="rs-mapel">' + no + '</td><td class="rs-mapel">' + esc(m.nama) + '</td><td>' + m.kkm + '</td>' +
            '<td>' + (v === null ? '' : C.fmtNum(v)) + '</td><td>' + pred + '</td><td class="rs-desk">' + esc(desk) + '</td></tr>'
        });
      });
    });
    if (type === 'K') {
      units.push({ kind: 'row', table: 'K', html: '<tr class="rs-sum"><td colspan="3">Jumlah</td><td>' + C.fmtNum(st.total) + '</td><td class="rs-noborder"></td><td class="rs-noborder"></td></tr>' });
      units.push({ kind: 'row', table: 'K', html: '<tr class="rs-sum"><td colspan="3">Rata-Rata / Rangking</td><td>' + (st.count ? st.average.toFixed(2) : '-') + '</td><td class="rs-shade">' + (st.count ? st.ranking : '-') + '</td><td class="rs-noborder"></td></tr>' });
    }
  });

  // C. Ekstrakurikuler
  const eks = [];
  [['ek1', 'ek1_nilai', 'ek1_desk'], ['ek2', 'ek2_nilai', 'ek2_desk']].forEach(k => {
    if (pel[k[0]]) {
      eks.push({ nama: pel[k[0]], nilai: pel[k[1]] || 'Baik', desk: pel[k[2]] || String(cfg.ekskul_deskripsi_default || '').replace(/\{EKSKUL\}/g, pel[k[0]]) });
    }
  });
  if (!eks.length) eks.push({ nama: '', nilai: '', desk: '' });
  block('<div class="rs-section">C. EKSTRAKURIKULER</div>' +
    '<table class="rs-table"><colgroup><col style="width:34%"><col style="width:18%"><col style="width:48%"></colgroup>' +
    '<tr><th>Ekstrakurikuler</th><th>Nilai</th><th>Deskripsi</th></tr>' +
    eks.map(e => '<tr><td style="padding:3px 4px;height:7mm;">' + esc(e.nama) + '</td><td>' + esc(e.nilai) + '</td><td>' + esc(e.desk) + '</td></tr>').join('') +
    '</table>');

  // D. Kehadiran + Keputusan
  const absen = (lbl, v) => '<tr><td style="width:50%;">' + lbl + '</td><td style="width:25%;">' + esc(v) + '</td><td class="rs-left" style="width:25%;">hari</td></tr>';
  const keputusan = cfg.tampilkan_keputusan
    ? '<td style="width:55%;vertical-align:top;"><div class="rs-keputusan">KEPUTUSAN\n' + esc(pel.keputusan || cfg.keputusan_default) + '</div></td>'
    : '<td style="width:55%;"></td>';
  block('<div class="rs-section">D. KEHADIRAN</div>' +
    '<table style="width:100%;border-collapse:collapse;"><tr>' +
    '<td style="width:42%;vertical-align:top;padding:0;"><table class="rs-table" style="margin:0;">' +
    absen('Sakit', pel.sakit) + absen('Izin', pel.izin) + absen('Tanpa Keterangan', pel.alpa) + '</table></td>' +
    '<td style="width:3%;"></td>' + keputusan + '</tr></table>');

  if (pel.catatan) {
    block('<div class="rs-section">CATATAN WALI KELAS</div><div class="rs-keputusan" style="margin-bottom:2mm;">' + esc(pel.catatan) + '</div>');
  }

  // Tanda tangan
  block('<table class="rs-ttd-table"><tr>' +
    '<td><br>Orang Tua / Wali<div class="rs-ttd-space"></div>…............................</td>' +
    '<td>' + esc(cfg.tempat_raport) + ', ' + esc(cfg.tanggal_raport) + '<br>Wali Kelas<div class="rs-ttd-space"></div>' + esc(w.nama) +
    (w.nip ? '<br>NIP. ' + esc(w.nip) : '') + '</td></tr></table>');

  const ttdImg = !opts.forWord && cfg.ttd_kepsek ? '<img src="' + cfg.ttd_kepsek + '" alt="">' : '';
  block('<div class="rs-kepsek">Kepala Sekolah<div class="rs-ttd-img">' + ttdImg + '</div>' + esc(cfg.kepala_sekolah) +
    (cfg.nip_kepala_sekolah ? '<br>NIP. ' + esc(cfg.nip_kepala_sekolah) : '') + '</div>');

  const qr = opts.forWord ? '' : qrDataUrl(st);
  block('<table class="rs-footer-table"><tr><td style="vertical-align:bottom;">' + esc((st.no || '') + ' ' + st.nama) + '</td>' +
    '<td style="text-align:right;vertical-align:bottom;">' + (qr ? '<img class="rs-qr-img" src="' + qr + '" alt="QR">' : '') + '</td></tr></table>');

  return units;
}

// Gabungkan unit menjadi satu alur HTML (dipakai untuk pengukuran & Word)
function unitsToFlowHtml(units, withIds) {
  let html = '';
  let openTable = null;
  units.forEach((u, i) => {
    const id = withIds ? ' data-u="' + i + '"' : '';
    if (u.kind === 'block') {
      if (openTable) { html += '</tbody></table>'; openTable = null; }
      html += '<div class="rs-unit"' + id + '>' + u.html + '</div>';
      return;
    }
    if (openTable !== u.table) {
      if (openTable) html += '</tbody></table>';
      html += '<table class="rs-table rs-main">' + RS_COLGROUP;
      openTable = u.table;
      if (u.kind === 'row') html += '<tbody>';
    }
    if (u.kind === 'thead') html += u.html.replace('<thead', '<thead' + id) + '<tbody>';
    else html += u.html.replace('<tr', '<tr' + id);
  });
  if (openTable) html += '</tbody></table>';
  return html;
}

// Ukur tinggi tiap unit lalu bagi ke halaman (tabel boleh terpotong antar baris seperti template)
function paginateUnits(units) {
  const tema = getRaportTheme();
  const box = document.createElement('div');
  box.className = 'raport-sheet fmt-semester';
  box.setAttribute('data-tema', tema);
  box.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;width:' + PAGE_WIDTH_MM + 'mm;padding:0;min-height:0;box-shadow:none;margin:0;';
  box.innerHTML = unitsToFlowHtml(units, true);
  document.body.appendChild(box);
  const base = box.getBoundingClientRect().top;
  const tops = units.map((u, i) => {
    const el = box.querySelector('[data-u="' + i + '"]');
    return el ? el.getBoundingClientRect().top - base : 0;
  });
  const totalH = box.getBoundingClientRect().height;
  document.body.removeChild(box);

  const heights = tops.map((t, i) => (i < tops.length - 1 ? tops[i + 1] : totalH) - t);
  const limit = PAGE_CONTENT_MM * MM;
  const pages = [[]];
  let used = 0;
  for (let i = 0; i < units.length; i++) {
    // tinggi rantai "harus bersama unit berikutnya"
    let chain = heights[i];
    for (let j = i; j < units.length - 1 && units[j].keepNext; j++) chain += heights[j + 1];
    if (used > 0 && used + Math.min(chain, limit) > limit) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(i);
    used += heights[i];
  }
  return pages.map(idx => idx.map(i => units[i]));
}

function sheetWrap(inner, extraClass) {
  return '<div class="raport-sheet fmt-semester rs-page ' + (extraClass || '') + '" data-tema="' + getRaportTheme() + '">' + inner + '</div>';
}

// Halaman-halaman raport untuk 1 siswa (array HTML string, satu per halaman)
function raportPages(st) {
  if (getRaportFormat() === 'mid') return [generateRaportHtmlMid(st)];
  const pages = paginateUnits(semesterUnits(st));
  return pages.map(p => sheetWrap(unitsToFlowHtml(p, false)));
}

function buildRaportPagesHtml(st) {
  return raportPages(st).join('');
}

/* ===========================================================
   FORMAT MID SEMESTER (format lama, tetap tersedia)
   =========================================================== */
function generateRaportHtmlMid(student, forWord) {
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
    '<div class="raport-ttd-wrap"><div class="raport-ttd"><div>' + esc(cfg.tempat_raport) + ', ' + esc(cfg.tanggal_raport) + '</div><div>WALI KELAS</div>' +
    '<div class="raport-ttd-space"></div><div class="raport-ttd-nama">' + esc(w.nama) + '</div>' +
    (w.nip ? '<div style="font-size:11pt;font-weight:normal;margin-top:2px;">NIP. ' + esc(w.nip) + '</div>' : '') + '</div></div></div>';
}

/* ===========================================================
   CETAK
   =========================================================== */
window.printSingleRaport = function () {
  const st = currentStudent();
  if (st) printHtml(buildRaportPagesHtml(st), false);
};

window.printAllRaportClass = function () {
  const students = classStudents();
  if (!students.length) { C.toast('Tidak ada siswa untuk dicetak', 'error'); return; }
  C.toast('Menyiapkan cetak massal ' + students.length + ' siswa Kelas ' + AppState.selectedClass + '...', 'info');
  setTimeout(() => printHtml(students.map(buildRaportPagesHtml).join(''), false), 50);
};

/* ===========================================================
   PDF (html2pdf, di browser)
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
  const all = [];
  students.forEach(s => raportPages(s).forEach(p => all.push(p)));
  const opt = {
    margin: [12, 14, 12, 14],
    filename: filename,
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: [215, 330], orientation: 'portrait' },
    pagebreak: { mode: [] }
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
    printHtml(students.map(buildRaportPagesHtml).join(''), false);
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
    printHtml(students.map(buildRaportPagesHtml).join(''), false);
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
  const midHead = t.midHead || t.head, midSum = t.midSum || t.sum;
  return '@page Section1 { size: 21.5cm 33.0cm; margin: 1.2cm 1.4cm 1.2cm 1.4cm; }' +
    'div.Section1 { page: Section1; } body { font-family: Arial, sans-serif; font-size: 9.5pt; }' +
    '.rs-title { background: ' + t.head + '; color: ' + t.headFg + '; border-bottom: 2px solid ' + t.border + '; text-align: center; font-weight: bold; font-size: 13pt; padding: 3px 0; margin: 6px 0; }' +
    '.rs-ident { width: 100%; font-size: 9.5pt; border-collapse: collapse; } .rs-ident td { padding: 0; }' +
    '.rs-section { font-weight: bold; margin-top: 8px; color: ' + t.accent + '; } .rs-sub { font-weight: bold; font-size: 9pt; }' +
    'table.rs-table { width: 100%; border-collapse: collapse; font-size: 9pt; }' +
    '.rs-table th, .rs-table td { border: 1px solid ' + t.border + '; padding: 2px 4px; text-align: center; vertical-align: middle; }' +
    '.rs-table th { background: ' + t.head + '; color: ' + t.headFg + '; font-weight: bold; }' +
    '.rs-mapel { padding: 7px 4px; } .rs-desk { font-size: 7pt; } .rs-left { text-align: left; }' +
    '.rs-group td, .rs-sum td { font-weight: bold; } .rs-shade { background: ' + t.sum + '; } td.rs-noborder { border: none; }' +
    '.rs-keputusan { border: 1px solid ' + t.border + '; padding: 3px 6px; }' +
    '.rs-ttd-table, .rs-footer-table { width: 100%; } .rs-ttd-table td { width: 50%; text-align: center; vertical-align: top; }' +
    '.rs-ttd-space { height: 60px; } .rs-kepsek { text-align: center; margin-top: 10px; } .rs-ttd-img { height: 60px; }' +
    '.kop-surat { text-align: center; } .kop-yayasan, .kop-bidang { font-size: 14pt; font-weight: bold; } .kop-sekolah { font-size: 22pt; font-weight: bold; }' +
    '.raport-judul-wrap { text-align: center; font-weight: bold; font-size: 14pt; margin: 14px 0; }' +
    '.raport-identitas { font-size: 13pt; font-weight: bold; } .identitas-row div { display: inline; }' +
    'table.raport-table { width: 100%; border-collapse: collapse; font-size: 13pt; }' +
    '.raport-table th, .raport-table td { border: 1.5px solid #000; padding: 5px; text-align: center; }' +
    '.raport-table th { background: ' + midHead + '; } .row-summary td { background: ' + midSum + '; font-weight: bold; }' +
    '.raport-ttd-wrap { text-align: right; margin-top: 20px; font-weight: bold; } .raport-ttd-space { height: 70px; }';
}

function studentWordHtml(st) {
  if (getRaportFormat() === 'mid') return generateRaportHtmlMid(st, true);
  return unitsToFlowHtml(semesterUnits(st, { forWord: true }), false);
}

function buildWordDoc(students) {
  const pageBreak = '<br clear="all" style="mso-special-character:line-break;page-break-before:always">';
  const body = students.map(studentWordHtml).join(pageBreak);
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
