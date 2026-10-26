/**
 * Laporan Admin: Leger/DKN, Perengkingan, Nilai per Mapel, Analisis, Kelengkapan
 * SMP KRISTEN 65 BASAAN
 */

function legerMode() {
  if (!isTerpisah()) return 'P';
  const el = document.getElementById('leger-view');
  return el ? el.value : 'P';
}

function gradeOf(s, key, mode) {
  return mode === 'K' ? s.gradesK[key] : s.grades[key];
}

function mapelStats(students, m, mode) {
  const nums = students.map(s => gradeOf(s, m.key, mode)).filter(v => v !== null);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  const tuntas = nums.filter(v => v >= m.kkm).length;
  return {
    key: m.key, nama: m.nama, kkm: m.kkm, count: nums.length,
    avg: C.round1(avg), max: nums.length ? Math.max.apply(null, nums) : 0, min: nums.length ? Math.min.apply(null, nums) : 0,
    tuntas, belum: nums.length - tuntas, pct: nums.length ? C.round1(tuntas / nums.length * 100) : 0
  };
}

/* ===========================================================
   LEGER / DKN
   =========================================================== */
function legerRows(students, mode) {
  const mapel = AppState.config.mapel_list;
  return students.map(s => {
    const vals = mapel.map(m => gradeOf(s, m.key, mode));
    const filled = vals.filter(v => v !== null);
    const sum = filled.reduce((a, b) => a + b, 0);
    return { s, vals, sum, avg: filled.length ? sum / filled.length : 0, missing: vals.length - filled.length };
  });
}

window.renderLeger = function () {
  if (!AppState.data) return;
  const viewSel = document.getElementById('leger-view');
  viewSel.style.display = isTerpisah() ? '' : 'none';
  const mode = legerMode();
  const students = classStudents();
  const mapel = AppState.config.mapel_list;
  const container = document.getElementById('leger-table-container');
  if (!students.length) {
    container.innerHTML = '<div class="empty-state"><strong>Tidak ada data siswa untuk Kelas ' + esc(AppState.selectedClass || '-') + '</strong></div>';
    return;
  }
  const rows = legerRows(students, mode);
  const stats = mapel.map(m => mapelStats(students, m, mode));

  let html = '<table class="data-table" id="table-leger-dom"><thead>' +
    '<tr style="background:#1e3a8a;color:#fff;"><th rowspan="2" style="width:35px;">NO</th><th rowspan="2" style="width:95px;">NISN</th><th rowspan="2" style="min-width:200px;">NAMA SISWA</th>' +
    '<th colspan="' + mapel.length + '" style="text-align:center;">MATA PELAJARAN (' + (mode === 'K' ? 'KETERAMPILAN' : 'PENGETAHUAN') + ')</th>' +
    '<th rowspan="2" style="width:70px;">JUMLAH</th><th rowspan="2" style="width:65px;">RATA2</th><th rowspan="2" style="width:55px;">RANK</th><th rowspan="2" style="width:100px;">KELENGKAPAN</th></tr>' +
    '<tr style="background:#2563eb;color:#fff;">' + mapel.map(m => '<th style="width:48px;font-size:11px;text-align:center;" title="' + esc(m.nama) + '">' + esc(m.key) + '</th>').join('') + '</tr></thead><tbody>';

  rows.forEach((r, i) => {
    const s = r.s;
    const cells = r.vals.map((v, j) => {
      if (v === null) return '<td class="center" style="background:rgba(245,158,11,0.12);color:#d97706;font-style:italic;">-</td>';
      const below = v < mapel[j].kkm;
      return '<td class="center" style="' + (below ? 'background:rgba(239,68,68,0.15);color:#ef4444;font-weight:bold;' : '') + '">' + C.fmtNum(v) + '</td>';
    }).join('');
    let rankStyle = '';
    if (s.ranking === 1) rankStyle = 'background:#fef08a;color:#854d0e;font-weight:800;';
    else if (s.ranking === 2) rankStyle = 'background:#e2e8f0;color:#334155;font-weight:800;';
    else if (s.ranking === 3) rankStyle = 'background:#fed7aa;color:#9a3412;font-weight:800;';
    html += '<tr><td class="center">' + (i + 1) + '</td><td class="center" style="font-family:monospace;font-size:12px;">' + esc(s.nisn) + '</td><td><strong>' + esc(s.nama) + '</strong></td>' + cells +
      '<td class="center"><strong>' + C.fmtNum(r.sum) + '</strong></td><td class="center"><strong>' + C.fmtNum(r.avg, 2) + '</strong></td>' +
      '<td class="center"><span class="badge badge-primary" style="' + rankStyle + '">#' + s.ranking + '</span></td>' +
      '<td class="center">' + (r.missing ? '<span class="badge badge-danger">-' + r.missing + ' Mapel</span>' : '<span class="badge badge-success">Lengkap</span>') + '</td></tr>';
  });

  const sumRow = (label, bg, fn) => '<tr style="background:' + bg + ';font-weight:bold;"><td colspan="3" class="center">' + label + '</td>' + stats.map(st => '<td class="center">' + fn(st) + '</td>').join('') + '<td colspan="4" class="center">-</td></tr>';
  html += sumRow('KKM MATA PELAJARAN', 'rgba(148,163,184,0.2)', st => st.kkm);
  html += sumRow('RATA-RATA KELAS', 'rgba(79,70,229,0.12)', st => st.count ? C.fmtNum(st.avg) : '-');
  html += sumRow('NILAI TERTINGGI', 'rgba(16,185,129,0.12)', st => st.count ? C.fmtNum(st.max) : '-');
  html += sumRow('NILAI TERENDAH', 'rgba(239,68,68,0.12)', st => st.count ? C.fmtNum(st.min) : '-');
  html += sumRow('KETUNTASAN (%)', 'rgba(245,158,11,0.14)', st => st.count ? C.fmtNum(st.pct) + '%' : '-');
  html += '</tbody></table>';
  container.innerHTML = html;
};

function legerPrintHtml() {
  const c = AppState.selectedClass;
  const cfg = AppState.config;
  const table = document.getElementById('table-leger-dom');
  return '<div class="print-leger-sheet" style="background:#fff;color:#000;font-family:Arial,sans-serif;">' +
    '<div style="text-align:center;margin-bottom:12px;border-bottom:2px solid #000;padding-bottom:6px;">' +
      '<div style="font-size:13pt;font-weight:bold;">' + esc(cfg.yayasan) + '</div>' +
      '<div style="font-size:16pt;font-weight:bold;">' + esc(cfg.nama_sekolah) + '</div>' +
      '<div style="font-size:10pt;">' + esc(cfg.alamat) + '</div>' +
      '<div style="font-size:13pt;font-weight:bold;margin-top:6px;">DAFTAR KUMPULAN NILAI (LEGER) - KELAS ' + esc(c) + '</div>' +
      '<div style="font-size:10pt;font-weight:bold;">SEMESTER ' + esc(String(cfg.semester || '').toUpperCase()) + ' TAHUN PELAJARAN ' + esc(cfg.tahun_ajaran) + '</div>' +
    '</div>' + (table ? table.outerHTML.replace('class="data-table"', 'class="data-table print-leger-table"') : '') +
    ttdKepsekWaliHtml(c) + '</div>';
}

window.printLeger = function () {
  if (!document.getElementById('table-leger-dom')) window.renderLeger();
  printHtml(legerPrintHtml(), true);
};

async function legerPdf(mode) {
  const c = AppState.selectedClass;
  if (!document.getElementById('table-leger-dom')) window.renderLeger();
  if (typeof html2pdf === 'undefined') { window.printLeger(); return; }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = '<style>#lg td,#lg th{border:1px solid #333;padding:3px 4px;font-size:8.5pt;color:#000;} #lg table{border-collapse:collapse;width:100%;} #lg .badge{border:none;padding:0;background:none!important;color:#000!important;}</style><div id="lg">' + legerPrintHtml() + '</div>';
  const opt = {
    margin: [6, 8, 6, 8], filename: 'Leger_Nilai_Kelas_' + c + '.pdf',
    image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: [330, 215], orientation: 'landscape' }
  };
  const preWin = mode === 'open' ? window.open('', '_blank') : null;
  loading(true, 'Membuat PDF Leger...');
  try {
    const worker = html2pdf().set(opt).from(wrapper);
    if (mode === 'open') {
      const url = await worker.toPdf().output('bloburl');
      if (preWin) preWin.location.href = url; else window.open(url, '_blank');
    } else {
      await worker.save();
      C.toast('PDF Leger Kelas ' + c + ' disimpan', 'success');
    }
  } catch (e) {
    if (preWin) preWin.close();
    window.printLeger();
  } finally {
    loading(false);
  }
}

window.exportLegerPdf = () => legerPdf('save');
window.openLegerPdf = () => legerPdf('open');

// Excel berwarna (xlsx-js-style)
window.exportLegerExcel = function () {
  if (typeof XLSX === 'undefined') { C.toast('Pustaka Excel belum termuat', 'error'); return; }
  const c = AppState.selectedClass;
  const cfg = AppState.config;
  const mode = legerMode();
  const mapel = cfg.mapel_list;
  const students = classStudents();
  const rows = legerRows(students, mode);
  const stats = mapel.map(m => mapelStats(students, m, mode));
  const ncol = 3 + mapel.length + 4;

  const border = { top: { style: 'thin', color: { rgb: '94A3B8' } }, bottom: { style: 'thin', color: { rgb: '94A3B8' } }, left: { style: 'thin', color: { rgb: '94A3B8' } }, right: { style: 'thin', color: { rgb: '94A3B8' } } };
  const S = (fill, opts) => Object.assign({ border, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, font: { name: 'Calibri', sz: 10 } }, fill ? { fill: { fgColor: { rgb: fill } } } : {}, opts || {});
  const cell = (v, s) => ({ v: v === null || v === undefined ? '' : v, t: typeof v === 'number' ? 'n' : 's', s });

  const aoa = [];
  const banner = { fill: { fgColor: { rgb: '1E3A8A' } }, font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center' } };
  const pad = n => Array.from({ length: n }, () => cell('', banner));
  aoa.push([cell(cfg.nama_sekolah, banner)].concat(pad(ncol - 1)));
  aoa.push([cell('DAFTAR KUMPULAN NILAI (LEGER) KELAS ' + c + ' - ' + (mode === 'K' ? 'KETERAMPILAN' : 'PENGETAHUAN'), Object.assign({}, banner, { font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } } }))].concat(pad(ncol - 1)));
  aoa.push([cell('Semester ' + cfg.semester + ' T.P. ' + cfg.tahun_ajaran + '  |  Wali Kelas: ' + getWali(c).nama, Object.assign({}, banner, { font: { sz: 10, color: { rgb: 'FFFFFF' } } }))].concat(pad(ncol - 1)));
  const hs = S('2563EB', { font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 } });
  aoa.push(['NO', 'NISN', 'NAMA SISWA'].concat(mapel.map(m => m.key)).concat(['JUMLAH', 'RATA2', 'RANK', 'KET']).map(v => cell(v, hs)));

  rows.forEach((r, i) => {
    const zebra = i % 2 ? 'F1F5F9' : 'FFFFFF';
    const line = [cell(i + 1, S(zebra)), cell(r.s.nisn, S(zebra)), cell(r.s.nama, S(zebra, { alignment: { horizontal: 'left', vertical: 'center' } }))];
    r.vals.forEach((v, j) => {
      if (v === null) line.push(cell('', S('FEF3C7')));
      else if (v < mapel[j].kkm) line.push(cell(v, S('FEE2E2', { font: { bold: true, color: { rgb: 'DC2626' }, sz: 10 } })));
      else line.push(cell(v, S(zebra)));
    });
    line.push(cell(C.round1(r.sum), S(zebra, { font: { bold: true, sz: 10 } })));
    line.push(cell(C.round2(r.avg), S(zebra, { font: { bold: true, sz: 10 } })));
    line.push(cell(r.s.ranking, S(r.s.ranking <= 3 ? 'FEF08A' : zebra, { font: { bold: true, sz: 10 } })));
    line.push(cell(r.missing ? 'Kurang ' + r.missing + ' mapel' : 'Lengkap', S(r.missing ? 'FEE2E2' : 'DCFCE7')));
    aoa.push(line);
  });

  const sum = (label, fill, fn) => {
    const st = S(fill, { font: { bold: true, sz: 10 } });
    aoa.push([cell(label, st), cell('', st), cell('', st)].concat(stats.map(x => cell(fn(x), st))).concat([cell('', st), cell('', st), cell('', st), cell('', st)]));
  };
  sum('KKM', 'E2E8F0', x => x.kkm);
  sum('RATA-RATA KELAS', 'E0E7FF', x => x.count ? x.avg : '');
  sum('NILAI TERTINGGI', 'DCFCE7', x => x.count ? x.max : '');
  sum('NILAI TERENDAH', 'FEE2E2', x => x.count ? x.min : '');
  sum('KETUNTASAN (%)', 'FEF3C7', x => x.count ? x.pct : '');

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastRow = aoa.length - 1;
  ws['!merges'] = [0, 1, 2].map(r => ({ s: { r, c: 0 }, e: { r, c: ncol - 1 } }))
    .concat([0, 1, 2, 3, 4].map(k => ({ s: { r: lastRow - 4 + k, c: 0 }, e: { r: lastRow - 4 + k, c: 2 } })));
  ws['!cols'] = [{ wch: 5 }, { wch: 13 }, { wch: 32 }].concat(mapel.map(() => ({ wch: 7 }))).concat([{ wch: 9 }, { wch: 8 }, { wch: 6 }, { wch: 15 }]);
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 16 }, { hpt: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, ('Leger_' + c).slice(0, 31));
  XLSX.writeFile(wb, 'Leger_Nilai_Kelas_' + c + '.xlsx');
  C.toast('Excel Leger Kelas ' + c + ' diunduh', 'success');
};

/* ===========================================================
   PERENGKINGAN
   =========================================================== */
function predikatLabel(avg) {
  const p = C.predikat(avg, AppState.config);
  const map = { A: ['Sangat Baik (A)', 'badge-success'], B: ['Baik (B)', 'badge-primary'], C: ['Cukup (C)', 'badge-warning'], D: ['Perlu Bimbingan (D)', 'badge-danger'] };
  return map[p] || ['-', 'badge-muted'];
}

window.renderRanking = function () {
  if (!AppState.data) return;
  const c = AppState.selectedClass;
  const students = classStudents().slice().sort((a, b) => a.ranking - b.ranking);
  const podium = document.getElementById('ranking-podium');
  const tbody = document.getElementById('ranking-table-body');
  if (!students.length) {
    podium.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="7" class="center">Tidak ada data siswa</td></tr>';
    return;
  }
  const card = (s, rank, medal, color) => s ? '<div class="podium-card rank-' + rank + '"><div class="podium-medal">' + medal + '</div>' +
    '<div style="font-size:11px;font-weight:800;color:' + color + ';text-transform:uppercase;">Juara ' + rank + ' Kelas ' + esc(c) + '</div>' +
    '<div class="podium-name" title="' + esc(s.nama) + '">' + esc(s.nama) + '</div><div class="podium-score">' + C.fmtNum(s.total) + '</div>' +
    '<div class="podium-avg">Rata-rata: ' + C.fmtNum(s.average, 2) + '</div></div>' : '';
  podium.innerHTML = card(students[1], 2, '🥈', '#94a3b8') + card(students[0], 1, '🥇', '#f59e0b') + card(students[2], 3, '🥉', '#d97706');

  tbody.innerHTML = students.map(s => {
    const medal = s.ranking === 1 ? '🥇 ' : s.ranking === 2 ? '🥈 ' : s.ranking === 3 ? '🥉 ' : '';
    const p = predikatLabel(s.average);
    return '<tr><td class="center"><strong>' + medal + '#' + s.ranking + '</strong></td><td class="center">' + esc(s.nisn) + '</td><td><strong>' + esc(s.nama) + '</strong></td>' +
      '<td class="center"><strong>' + C.fmtNum(s.total) + '</strong></td><td class="center"><strong>' + C.fmtNum(s.average, 2) + '</strong></td>' +
      '<td class="center"><span class="badge ' + p[1] + '">' + p[0] + '</span></td>' +
      '<td class="center"><button class="btn btn-sm btn-secondary" onclick="viewStudentRaport(\'' + esc(s.nisn) + '\')">Lihat Raport</button></td></tr>';
  }).join('');
};

window.printRanking = function () {
  const c = AppState.selectedClass;
  const cfg = AppState.config;
  const students = classStudents().slice().sort((a, b) => a.ranking - b.ranking);
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:14pt;font-weight:bold;">DAFTAR PERINGKAT KELAS ' + esc(c) + '</div>' +
    '<div style="font-size:12pt;font-weight:bold;">SEMESTER ' + esc(String(cfg.semester).toUpperCase()) + ' TAHUN PELAJARAN ' + esc(cfg.tahun_ajaran) + '</div></div>' +
    '<table class="raport-table" style="font-size:11pt;"><thead><tr><th>PERINGKAT</th><th>NISN</th><th>NAMA SISWA</th><th>JUMLAH</th><th>RATA-RATA</th><th>PREDIKAT</th></tr></thead><tbody>' +
    students.map(s => '<tr><td style="font-weight:bold;">' + s.ranking + '</td><td>' + esc(s.nisn) + '</td><td style="text-align:left;padding-left:12px;font-weight:bold;">' + esc(s.nama) + '</td>' +
      '<td style="font-weight:bold;">' + C.fmtNum(s.total) + '</td><td style="font-weight:bold;">' + C.fmtNum(s.average, 2) + '</td><td>' + predikatLabel(s.average)[0] + '</td></tr>').join('') +
    '</tbody></table>' + ttdKepsekWaliHtml(c) + '</div>', false);
};

/* ===========================================================
   NILAI PER MATA PELAJARAN (+ edit nilai oleh admin)
   =========================================================== */
let selectedMapelKey = null;

window.renderMapel = function () {
  if (!AppState.data) return;
  const mapel = AppState.config.mapel_list;
  const sel = document.getElementById('mapel-select');
  if (!selectedMapelKey || !mapel.some(m => m.key === selectedMapelKey)) selectedMapelKey = mapel.length ? mapel[0].key : null;
  sel.innerHTML = mapel.map(m => '<option value="' + esc(m.key) + '">' + esc(m.nama) + ' (KKM: ' + m.kkm + ')</option>').join('');
  if (selectedMapelKey) sel.value = selectedMapelKey;
  updateMapelView();
};

function updateMapelView() {
  const m = AppState.config.mapel_list.find(x => x.key === selectedMapelKey);
  const tbody = document.getElementById('mapel-table-body');
  if (!m) { tbody.innerHTML = '<tr><td colspan="10" class="center">Belum ada mata pelajaran</td></tr>'; return; }
  const students = classStudents();
  const st = mapelStats(students, m, 'P');
  document.getElementById('mapel-kpi-kkm').textContent = m.kkm;
  document.getElementById('mapel-kpi-avg').textContent = st.count ? C.fmtNum(st.avg) : '-';
  document.getElementById('mapel-kpi-max').textContent = st.count ? C.fmtNum(st.max) : '-';
  document.getElementById('mapel-kpi-min').textContent = st.count ? C.fmtNum(st.min) : '-';
  document.getElementById('mapel-kpi-tuntas').textContent = st.tuntas + ' (' + C.fmtNum(st.pct) + '%)';
  document.getElementById('mapel-kpi-remedial').textContent = st.belum + ' Siswa';

  tbody.innerHTML = students.length ? students.map((s, i) => {
    const v = s.grades[m.key];
    const d = s.desk[m.key] || {};
    let status = '<span class="badge badge-muted">Belum Ada Nilai</span>', diff = '-';
    if (v !== null) {
      diff = (v - m.kkm >= 0 ? '+' : '') + C.fmtNum(v - m.kkm);
      status = v >= m.kkm ? '<span class="badge badge-success">Tuntas</span>' : '<span class="badge badge-danger">Remedial</span>';
    }
    const kal = C.buildDeskripsi(s.nama, v, d.kuasai, d.tingkatkan, AppState.config);
    return '<tr><td class="center">' + (i + 1) + '</td><td class="center">' + esc(s.nisn) + '</td><td><strong>' + esc(s.nama) + '</strong>' +
      (d.guru ? '<div class="muted" style="font-size:11px;">oleh ' + esc(d.guru) + ', ' + C.fmtDateTime(d.updated) + '</div>' : '') + '</td>' +
      '<td class="center" style="font-weight:bold;font-size:15px;">' + (v === null ? '-' : C.fmtNum(v)) + (isTerpisah() && s.gradesK[m.key] !== null ? '<div class="muted" style="font-size:11px;">K: ' + C.fmtNum(s.gradesK[m.key]) + '</div>' : '') + '</td>' +
      '<td class="center">' + C.predikat(v, AppState.config) + '</td><td class="center">' + m.kkm + '</td><td class="center">' + diff + '</td><td class="center">' + status + '</td>' +
      '<td style="font-size:12px;min-width:240px;">' + (kal ? esc(kal) : '<span class="muted">-</span>') + '</td>' +
      '<td class="center"><button class="btn btn-sm btn-secondary" onclick="openEditNilai(\'' + esc(s.nisn) + '\',\'' + esc(m.key) + '\')">Ubah</button></td></tr>';
  }).join('') : '<tr><td colspan="10" class="center">Tidak ada siswa</td></tr>';
}

function deskSelectHtml(id, kode, kelas, current) {
  const t = C.tingkatOf(kelas);
  const list = AppState.db.deskripsi.filter(d => d.kode === kode && (d.tingkat === 'Semua' || d.tingkat === t)).sort((a, b) => a.teks.localeCompare(b.teks));
  let found = false;
  let html = '<select class="form-control" id="' + id + '"><option value="">- kosong -</option>';
  list.forEach(d => { const s = d.teks === current; if (s) found = true; html += '<option' + (s ? ' selected' : '') + '>' + esc(d.teks) + '</option>'; });
  if (current && !found) html += '<option selected>' + esc(current) + '</option>';
  return html + '</select>';
}

window.openEditNilai = function (nisn, kode) {
  const s = AppState.data.students.find(x => x.nisn === nisn);
  const m = AppState.config.mapel_list.find(x => x.key === kode);
  if (!s || !m) return;
  const n = AppState.db.nilai[nisn + '|' + kode] || {};
  openModal('Ubah Nilai: ' + s.nama + ' - ' + m.nama,
    '<div class="grid-form">' +
    '<div class="form-group"><label>Nilai ' + (isTerpisah() ? 'Pengetahuan' : '') + ' (0-100)</label><input type="number" min="0" max="100" step="any" class="form-control" id="en-nilai" value="' + esc(C.isFilled(n.nilai) ? n.nilai : '') + '"></div>' +
    (isTerpisah() ? '<div class="form-group"><label>Nilai Keterampilan</label><input type="number" min="0" max="100" step="any" class="form-control" id="en-nilaik" value="' + esc(C.isFilled(n.nilai_k) ? n.nilai_k : '') + '"></div>' : '') +
    '</div>' +
    '<div class="form-group"><label>Paling dikuasai</label>' + deskSelectHtml('en-k', kode, s.kelas, n.kuasai) + '</div>' +
    '<div class="form-group"><label>Atau tulis sendiri (opsional)</label><input class="form-control" id="en-k-free" placeholder="Kosongkan jika memakai pilihan di atas"></div>' +
    '<div class="form-group"><label>Perlu ditingkatkan</label>' + deskSelectHtml('en-t', kode, s.kelas, n.tingkatkan) + '</div>' +
    '<div class="form-group"><label>Atau tulis sendiri (opsional)</label><input class="form-control" id="en-t-free" placeholder="Kosongkan jika memakai pilihan di atas"></div>' +
    '<div class="muted">Terakhir diubah: ' + esc(n.guru || '-') + ' • ' + C.fmtDateTime(n.updated) + '</div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="en-save">Simpan ke Spreadsheet</button></div>');
  document.getElementById('en-save').onclick = async () => {
    const v = C.num(document.getElementById('en-nilai').value);
    const vkEl = document.getElementById('en-nilaik');
    const vk = vkEl ? C.num(vkEl.value) : null;
    if ((v !== null && (v < 0 || v > 100)) || (vk !== null && (vk < 0 || vk > 100))) { C.toast('Nilai harus 0 - 100', 'warning'); return; }
    const row = C.nilaiToRow({
      nisn, kode, kelas: s.kelas, nilai: v, nilai_k: vk,
      kuasai: document.getElementById('en-k-free').value.trim() || document.getElementById('en-k').value,
      tingkatkan: document.getElementById('en-t-free').value.trim() || document.getElementById('en-t').value,
      guru: 'Admin', updated: C.nowIso()
    });
    closeModal();
    await adminWrite('syncNilai', { rows: [row], info: kode + ' ' + s.kelas + ' (edit admin)' }, 'Nilai ' + s.nama + ' disimpan');
  };
};

window.printMapel = function () {
  const c = AppState.selectedClass;
  const cfg = AppState.config;
  const m = cfg.mapel_list.find(x => x.key === selectedMapelKey);
  if (!m) return;
  const students = classStudents();
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:14pt;font-weight:bold;text-transform:uppercase;">DAFTAR NILAI MATA PELAJARAN: ' + esc(m.nama) + '</div>' +
    '<div style="font-size:12pt;font-weight:bold;">KELAS ' + esc(c) + ' - KKM: ' + m.kkm + ' | SEMESTER ' + esc(String(cfg.semester).toUpperCase()) + ' T.P. ' + esc(cfg.tahun_ajaran) + '</div></div>' +
    '<table class="raport-table" style="font-size:10.5pt;"><thead><tr><th>NO</th><th>NISN</th><th>NAMA SISWA</th><th>NILAI</th><th>PRE</th><th>KET</th><th>DESKRIPSI</th></tr></thead><tbody>' +
    students.map((s, i) => {
      const v = s.grades[m.key];
      const d = s.desk[m.key] || {};
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.nisn) + '</td><td style="text-align:left;padding-left:8px;">' + esc(s.nama) + '</td><td style="font-weight:bold;">' + (v === null ? '-' : C.fmtNum(v)) + '</td>' +
        '<td>' + C.predikat(v, cfg) + '</td><td>' + (v === null ? '-' : v >= m.kkm ? 'Tuntas' : 'Remedial') + '</td>' +
        '<td style="text-align:left;font-size:8.5pt;">' + esc(C.buildDeskripsi(s.nama, v, d.kuasai, d.tingkatkan, cfg)) + '</td></tr>';
    }).join('') + '</tbody></table>' +
    '<div style="display:flex;justify-content:space-between;margin-top:35px;font-size:12pt;"><div style="text-align:center;width:220px;"><div>Guru Mata Pelajaran,</div><div style="height:60px;"></div><div style="font-weight:bold;">...................................</div></div>' +
    '<div style="text-align:center;width:240px;"><div>' + esc(cfg.tempat_raport) + ', ' + esc(cfg.tanggal_raport) + '</div><div>Wali Kelas ' + esc(c) + '</div><div style="height:60px;"></div><div style="font-weight:bold;">' + esc(getWali(c).nama) + '</div></div></div>' +
    '</div>', false);
};

/* ===========================================================
   ANALISIS & STATISTIK
   =========================================================== */
window.renderAnalisis = function () {
  if (!AppState.data) return;
  const students = classStudents();
  const mapel = AppState.config.mapel_list;
  const stats = mapel.map(m => mapelStats(students, m, 'P'));

  document.getElementById('analisis-table-body').innerHTML = stats.map((s, i) => {
    let badge = '<span class="badge badge-success">Sangat Baik</span>';
    if (!s.count) badge = '<span class="badge badge-muted">Belum ada nilai</span>';
    else if (s.pct < 60) badge = '<span class="badge badge-danger">Perlu Perhatian</span>';
    else if (s.pct < 80) badge = '<span class="badge badge-warning">Cukup</span>';
    return '<tr><td class="center">' + (i + 1) + '</td><td><strong>' + esc(s.nama) + '</strong></td><td class="center">' + s.kkm + '</td>' +
      '<td class="center" style="font-weight:bold;">' + (s.count ? s.avg : '-') + '</td><td class="center">' + (s.count ? s.max : '-') + '</td><td class="center">' + (s.count ? s.min : '-') + '</td>' +
      '<td class="center"><span class="badge badge-success">' + s.tuntas + '</span></td><td class="center"><span class="badge badge-danger">' + s.belum + '</span></td>' +
      '<td class="center"><strong>' + (s.count ? s.pct + '%' : '-') + '</strong></td><td class="center">' + badge + '</td></tr>';
  }).join('');

  renderCharts(stats, students);
  renderRemedialList(students, mapel);
};

function chartTextColor() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? '#334155' : '#cbd5e1';
}

function makeChart(id, config) {
  if (typeof Chart === 'undefined') return;
  const ctx = document.getElementById(id);
  if (!ctx) return;
  if (AppState.charts[id]) AppState.charts[id].destroy();
  Chart.defaults.color = chartTextColor();
  AppState.charts[id] = new Chart(ctx, config);
}

function renderCharts(stats, students) {
  const grid = { color: 'rgba(148,163,184,0.15)' };
  makeChart('chart-mapel-avg', {
    type: 'bar',
    data: {
      labels: stats.map(s => s.key),
      datasets: [
        { label: 'Rata-Rata Nilai', data: stats.map(s => s.avg), backgroundColor: 'rgba(79,70,229,0.75)', borderRadius: 6 },
        { label: 'KKM', data: stats.map(s => s.kkm), type: 'line', borderColor: '#ef4444', borderWidth: 2, borderDash: [5, 5], pointRadius: 3, fill: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { title: items => stats[items[0].dataIndex].nama, afterLabel: ctx => 'Ketuntasan: ' + stats[ctx.dataIndex].pct + '% (' + stats[ctx.dataIndex].tuntas + '/' + stats[ctx.dataIndex].count + ')' } } },
      scales: { y: { beginAtZero: true, max: 100, grid }, x: { grid: { display: false } } }
    }
  });
  makeChart('chart-mapel-pass', {
    type: 'bar',
    data: {
      labels: stats.map(s => s.key),
      datasets: [
        { label: 'Tuntas', data: stats.map(s => s.tuntas), backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Remedial', data: stats.map(s => s.belum), backgroundColor: '#ef4444', borderRadius: 4 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grid } } }
  });

  const cfg = AppState.config;
  const dist = { A: 0, B: 0, C: 0, D: 0 };
  students.forEach(s => cfg.mapel_list.forEach(m => { const p = C.predikat(s.grades[m.key], cfg); if (p) dist[p]++; }));
  makeChart('chart-predikat', {
    type: 'doughnut',
    data: {
      labels: ['A (' + kataPredikat('A') + ')', 'B (' + kataPredikat('B') + ')', 'C (' + kataPredikat('C') + ')', 'D (' + kataPredikat('D') + ')'],
      datasets: [{ data: [dist.A, dist.B, dist.C, dist.D], backgroundColor: ['#10b981', '#4f46e5', '#f59e0b', '#ef4444'], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
  });

  const classes = AppState.data.classes;
  makeChart('chart-kelas', {
    type: 'bar',
    data: {
      labels: classes,
      datasets: [{
        label: 'Rata-rata kelas',
        data: classes.map(k => (AppState.data.analytics[k] || {}).rata_rata_kelas || 0),
        backgroundColor: classes.map(k => k === AppState.selectedClass ? '#f59e0b' : 'rgba(6,182,212,0.7)'),
        borderRadius: 6
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid }, x: { grid: { display: false } } } }
  });
}

function kataPredikat(p) {
  return C.kataPredikat(p, AppState.config);
}

function renderRemedialList(students, mapel) {
  const box = document.getElementById('remedial-list-container');
  const items = students.map(s => ({
    s, list: mapel.filter(m => s.grades[m.key] !== null && s.grades[m.key] < m.kkm).map(m => m.nama + ' (' + C.fmtNum(s.grades[m.key]) + ' < ' + m.kkm + ')')
  })).filter(x => x.list.length);
  if (!items.length) {
    box.innerHTML = '<div style="padding:20px;text-align:center;color:var(--success);font-weight:bold;">🎉 Seluruh nilai yang sudah masuk telah memenuhi KKM.</div>';
    return;
  }
  box.innerHTML = '<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Terdapat <strong>' + items.length + ' siswa</strong> yang memerlukan bimbingan / remedial:</div>' +
    '<div style="display:flex;flex-direction:column;gap:8px;">' + items.map(x =>
      '<div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);padding:10px 14px;border-radius:var(--radius-md);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
      '<div><strong>' + esc(x.s.nama) + '</strong> (NISN: ' + esc(x.s.nisn) + ')<div style="font-size:12px;color:#ef4444;margin-top:2px;">Perlu Remedial: ' + esc(x.list.join(', ')) + '</div></div>' +
      '<button class="btn btn-sm btn-secondary" onclick="viewStudentRaport(\'' + esc(x.s.nisn) + '\')">Lihat Raport</button></div>').join('') + '</div>';
}

window.printAnalisis = function () {
  const c = AppState.selectedClass;
  const cfg = AppState.config;
  const stats = cfg.mapel_list.map(m => mapelStats(classStudents(), m, 'P'));
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:14pt;font-weight:bold;">LAPORAN ANALISIS EVALUASI HASIL BELAJAR - KELAS ' + esc(c) + '</div>' +
    '<div style="font-size:12pt;font-weight:bold;">SEMESTER ' + esc(String(cfg.semester).toUpperCase()) + ' TAHUN PELAJARAN ' + esc(cfg.tahun_ajaran) + '</div></div>' +
    '<table class="raport-table" style="font-size:10.5pt;"><thead><tr><th>NO</th><th>MATA PELAJARAN</th><th>KKM</th><th>RATA2</th><th>MAX</th><th>MIN</th><th>TUNTAS</th><th>BELUM</th><th>% TUNTAS</th></tr></thead><tbody>' +
    stats.map((s, i) => '<tr><td>' + (i + 1) + '</td><td style="text-align:left;padding-left:8px;">' + esc(s.nama) + '</td><td>' + s.kkm + '</td><td>' + (s.count ? s.avg : '-') + '</td><td>' + (s.count ? s.max : '-') + '</td><td>' + (s.count ? s.min : '-') + '</td><td>' + s.tuntas + '</td><td>' + s.belum + '</td><td>' + (s.count ? s.pct + '%' : '-') + '</td></tr>').join('') +
    '</tbody></table>' + ttdKepsekWaliHtml(c) + '</div>', false);
};

/* ===========================================================
   KELENGKAPAN NILAI
   =========================================================== */
let filterKelengkapanMode = 'incomplete';
let filterMissingMapelKey = 'all';

function auditStudents() {
  const mapel = AppState.config.mapel_list;
  return classStudents().map(st => {
    const missing = mapel.filter(m => st.grades[m.key] === null);
    const noDesk = mapel.filter(m => st.grades[m.key] !== null && (!st.desk[m.key] || !st.desk[m.key].kuasai || !st.desk[m.key].tingkatkan));
    const filled = mapel.length - missing.length;
    return { student: st, missing, noDesk, filled, isComplete: missing.length === 0, pct: mapel.length ? Math.round(filled / mapel.length * 100) : 0 };
  });
}

window.renderKelengkapan = function (badgeOnly) {
  if (!AppState.data) return;
  const audited = auditStudents();
  const incomplete = audited.filter(a => !a.isComplete);
  const badge = document.getElementById('nav-incomplete-badge');
  badge.textContent = incomplete.length;
  badge.style.display = incomplete.length ? 'inline-flex' : 'none';
  if (badgeOnly === true) return;

  const students = classStudents();
  const mapel = AppState.config.mapel_list;
  const complete = audited.filter(a => a.isComplete);
  const missingTotal = audited.reduce((n, a) => n + a.missing.length, 0);
  const deskTotal = audited.reduce((n, a) => n + a.noDesk.length, 0);
  document.getElementById('kpi-kelengkapan-total').textContent = students.length + ' Siswa';
  document.getElementById('kpi-kelengkapan-complete').textContent = complete.length + ' Siswa (' + (students.length ? Math.round(complete.length / students.length * 100) : 0) + '%)';
  document.getElementById('kpi-kelengkapan-incomplete').textContent = incomplete.length + ' Siswa';
  document.getElementById('kpi-kelengkapan-missing-grades').textContent = missingTotal + ' Nilai Kosong';
  document.getElementById('kpi-kelengkapan-missing-desk').textContent = deskTotal + ' nilai belum lengkap deskripsinya';

  document.getElementById('kelengkapan-mapel-breakdown').innerHTML = mapel.map(m => {
    const miss = students.filter(s => s.grades[m.key] === null).length;
    const noDesk = students.filter(s => s.grades[m.key] !== null && (!s.desk[m.key] || !s.desk[m.key].kuasai || !s.desk[m.key].tingkatkan)).length;
    const filled = students.length - miss;
    const pct = students.length ? Math.round(filled / students.length * 100) : 0;
    let color = '#10b981', bg = 'rgba(16,185,129,0.1)', text = '100% Lengkap';
    if (students.length && miss === students.length) { color = '#ef4444'; bg = 'rgba(239,68,68,0.12)'; text = 'Belum Ada Nilai Sama Sekali'; }
    else if (miss > 0) { color = '#f59e0b'; bg = 'rgba(245,158,11,0.12)'; text = miss + ' Siswa Belum Diinput'; }
    const gurus = Array.from(new Set(students.map(s => s.desk[m.key] && s.desk[m.key].guru).filter(Boolean)));
    return '<div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;"><strong style="font-size:13px;">' + esc(m.nama) + '</strong>' +
      '<span class="badge" style="background:' + bg + ';color:' + color + ';font-size:11px;">' + pct + '%</span></div>' +
      '<div style="font-size:11.5px;color:' + color + ';font-weight:600;margin-bottom:4px;">' + text + ' (' + filled + '/' + students.length + ')</div>' +
      (noDesk ? '<div style="font-size:11px;color:var(--warning);margin-bottom:4px;">' + noDesk + ' deskripsi belum lengkap</div>' : '') +
      '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Guru: ' + esc(gurus.join(', ') || '-') + '</div>' +
      '<div style="background:rgba(148,163,184,0.2);height:6px;border-radius:999px;overflow:hidden;"><div style="background:' + color + ';width:' + pct + '%;height:100%;"></div></div></div>';
  }).join('');

  const sel = document.getElementById('filter-missing-mapel');
  sel.innerHTML = '<option value="all">Semua Mata Pelajaran</option>' + mapel.map(m => '<option value="' + esc(m.key) + '">' + esc(m.nama) + '</option>').join('');
  sel.value = filterMissingMapelKey;

  let list = audited;
  if (filterKelengkapanMode === 'incomplete') list = list.filter(a => !a.isComplete);
  else if (filterKelengkapanMode === 'complete') list = list.filter(a => a.isComplete);
  if (filterMissingMapelKey !== 'all') list = list.filter(a => a.missing.some(m => m.key === filterMissingMapelKey));

  const tbody = document.getElementById('kelengkapan-table-body');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="center" style="padding:30px;color:var(--success);font-weight:bold;">🎉 Tidak ada data siswa yang cocok dengan filter.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((a, i) => {
    const s = a.student;
    const color = a.pct === 100 ? 'var(--success)' : a.pct >= 70 ? 'var(--warning)' : 'var(--danger)';
    const badges = a.missing.length ? a.missing.map(m => '<span class="badge badge-danger" style="margin:2px;">' + esc(m.key) + '</span>').join(' ') : '<span class="badge badge-success">Semua mapel terisi</span>';
    return '<tr><td class="center">' + (i + 1) + '</td><td class="center" style="font-family:monospace;font-size:12px;">' + esc(s.nisn) + '</td><td><strong>' + esc(s.nama) + '</strong></td>' +
      '<td><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>' + a.filled + '/' + (a.filled + a.missing.length) + ' Mapel</span><strong>' + a.pct + '%</strong></div>' +
      '<div style="background:rgba(148,163,184,0.2);height:6px;border-radius:999px;overflow:hidden;"><div style="background:' + color + ';width:' + a.pct + '%;height:100%;"></div></div></td>' +
      '<td>' + badges + '</td><td class="center"><button class="btn btn-sm btn-secondary" onclick="viewStudentRaport(\'' + esc(s.nisn) + '\')">Lihat Raport</button></td></tr>';
  }).join('');
};

window.copyWaReminder = function () {
  const c = AppState.selectedClass;
  const students = classStudents();
  const cfg = AppState.config;
  const items = cfg.mapel_list.map(m => ({
    m,
    miss: students.filter(s => s.grades[m.key] === null).length,
    desk: students.filter(s => s.grades[m.key] !== null && (!s.desk[m.key] || !s.desk[m.key].kuasai || !s.desk[m.key].tingkatkan)).length
  })).filter(x => x.miss || x.desk);
  if (!items.length) { C.toast('Seluruh nilai & deskripsi kelas ini sudah lengkap!', 'success'); return; }
  let text = '📢 *PENGINGAT KELENGKAPAN NILAI RAPORT*\n*' + cfg.nama_sekolah + '*\nKelas: *' + c + '* | Semester ' + cfg.semester + ' ' + cfg.tahun_ajaran + '\n\n' +
    'Yth. Bapak/Ibu Guru Mata Pelajaran,\nBerikut mata pelajaran yang *masih kurang* di aplikasi E-Raport untuk Kelas ' + c + ':\n\n';
  items.forEach((x, i) => {
    text += (i + 1) + '. *' + x.m.nama + '*: ' + (x.miss ? x.miss + ' dari ' + students.length + ' siswa belum ada nilai' : '') +
      (x.miss && x.desk ? ', ' : '') + (x.desk ? x.desk + ' deskripsi belum dipilih' : '') + '\n';
  });
  text += '\nMohon segera dilengkapi melalui aplikasi lalu tekan tombol *Sinkron*. Terima kasih 🙏\n_Wali Kelas ' + c + '_';
  const done = () => C.toast('Teks pengingat WhatsApp disalin!', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => prompt('Salin teks berikut:', text));
  else prompt('Salin teks berikut:', text);
};

window.printKelengkapan = function () {
  const c = AppState.selectedClass;
  const list = auditStudents().filter(a => !a.isComplete);
  const total = AppState.config.mapel_list.length;
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:20px;"><div style="font-size:14pt;font-weight:bold;">LEMBAR KONTROL KELENGKAPAN NILAI - KELAS ' + esc(c) + '</div>' +
    '<div style="font-size:11pt;font-weight:bold;">Daftar Siswa dengan Nilai Belum Lengkap</div></div>' +
    '<table class="raport-table" style="font-size:10.5pt;"><thead><tr><th>NO</th><th>NISN</th><th>NAMA SISWA</th><th>TERISI</th><th>MAPEL BELUM ADA NILAI</th></tr></thead><tbody>' +
    (list.length ? list.map((a, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(a.student.nisn) + '</td><td style="text-align:left;padding-left:10px;font-weight:bold;">' + esc(a.student.nama) + '</td>' +
      '<td>' + a.filled + ' dari ' + total + '</td><td style="text-align:left;padding-left:10px;color:#b91c1c;font-weight:bold;">' + esc(a.missing.map(m => m.nama).join(', ')) + '</td></tr>').join('')
      : '<tr><td colspan="5">Semua nilai lengkap</td></tr>') +
    '</tbody></table>' + ttdKepsekWaliHtml(c) + '</div>', false);
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mapel-select').addEventListener('change', e => { selectedMapelKey = e.target.value; updateMapelView(); });
  const btns = document.querySelectorAll('.btn-filter-kelengkapan');
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(b => { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
    filterKelengkapanMode = btn.getAttribute('data-mode');
    window.renderKelengkapan();
  }));
  document.getElementById('filter-missing-mapel').addEventListener('change', e => { filterMissingMapelKey = e.target.value; window.renderKelengkapan(); });
});
