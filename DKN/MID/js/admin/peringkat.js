/**
 * Admin: Ranking per Tingkat (7 / 8 / 9, gabungan semua rombel) & Ranking Keseluruhan (7-9)
 * + Juara 1-3 tiap kelas, Nilai tertinggi per mapel.
 * SMP KRISTEN 65 BASAAN
 */

const PT = {
  scope: null,     // '7' | '8' | '9' | 'all'
  basis: 'total',  // 'total' | 'avg'
  limit: 0,        // 0 = semua
  search: ''
};

function ptTingkatList() {
  const set = [];
  (AppState.data ? AppState.data.classes : []).forEach(c => {
    const t = C.tingkatOf(c);
    if (t && set.indexOf(t) < 0) set.push(t);
  });
  return set.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function ptClassesOf(scope) {
  return AppState.data.classes.filter(c => scope === 'all' || C.tingkatOf(c) === scope);
}

function ptScopeLabel(scope) {
  if (scope === 'all') {
    const t = ptTingkatList();
    return 'KESELURUHAN KELAS ' + (t.length ? C.romawi(t[0]) + ' - ' + C.romawi(t[t.length - 1]) : '');
  }
  return 'KELAS ' + C.romawi(scope) + ' (TINGKAT ' + scope + ')';
}

// Urutkan & beri peringkat (nilai sama = peringkat sama)
function ptRank(students, basis) {
  const cmp = basis === 'avg'
    ? (a, b) => (b.average - a.average) || (b.total - a.total) || a.nama.localeCompare(b.nama)
    : (a, b) => (b.total - a.total) || (b.average - a.average) || a.nama.localeCompare(b.nama);
  const sorted = students.slice().sort(cmp);
  const out = [];
  sorted.forEach((s, i) => {
    const prev = out[i - 1];
    const same = prev && prev.s.total === s.total && prev.s.average === s.average;
    out.push({ s, rank: same ? prev.rank : i + 1 });
  });
  return out;
}

function ptRows(scope, basis) {
  const classes = ptClassesOf(scope || PT.scope);
  const list = AppState.data.students.filter(s => classes.indexOf(s.kelas) >= 0);
  return ptRank(list, basis || PT.basis);
}

function ptMedal(rank) {
  return rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
}

function ttdKepsekHtml() {
  const cfg = AppState.config || {};
  return '<div style="display:flex;justify-content:flex-end;margin-top:35px;font-size:12pt;">' +
    '<div style="text-align:center;width:260px;"><div>' + esc(cfg.tempat_raport) + ', ' + esc(cfg.tanggal_raport) + '</div><div>Kepala Sekolah</div><div style="height:60px;"></div>' +
    '<div style="font-weight:bold;">' + esc(cfg.kepala_sekolah) + '</div>' + (cfg.nip_kepala_sekolah ? '<div>NIP. ' + esc(cfg.nip_kepala_sekolah) + '</div>' : '') + '</div></div>';
}

function ptSubTitle() {
  const cfg = AppState.config;
  return 'SEMESTER ' + esc(String(cfg.semester || '').toUpperCase()) + ' TAHUN PELAJARAN ' + esc(cfg.tahun_ajaran);
}

/* ===========================================================
   RENDER TAB
   =========================================================== */
window.renderPeringkatTingkat = function () {
  if (!AppState.data) return;
  const tingkat = ptTingkatList();
  if (!PT.scope || (PT.scope !== 'all' && tingkat.indexOf(PT.scope) < 0)) {
    const cur = C.tingkatOf(AppState.selectedClass);
    PT.scope = tingkat.indexOf(cur) >= 0 ? cur : (tingkat[0] || 'all');
  }

  document.getElementById('pt-scope-buttons').innerHTML = tingkat.map(t =>
    '<button class="btn btn-sm ' + (PT.scope === t ? 'btn-primary' : 'btn-secondary') + '" onclick="setPeringkatScope(\'' + esc(t) + '\')">Kelas ' + esc(t) + ' (' + C.romawi(t) + ')</button>').join('') +
    '<button class="btn btn-sm ' + (PT.scope === 'all' ? 'btn-primary' : 'btn-secondary') + '" onclick="setPeringkatScope(\'all\')">Keseluruhan ' + (tingkat.length ? tingkat[0] + '-' + tingkat[tingkat.length - 1] : '') + '</button>';
  document.getElementById('pt-basis').value = PT.basis;
  document.getElementById('pt-limit').value = String(PT.limit);

  const rows = ptRows();
  const classes = ptClassesOf(PT.scope);
  const total = AppState.config.mapel_list.length;
  const incomplete = rows.filter(r => r.s.count < total).length;
  const avgs = rows.map(r => r.s.average).filter(v => v > 0);

  document.getElementById('pt-title').textContent = 'Peringkat ' + (PT.scope === 'all' ? 'Keseluruhan Siswa' : 'Kelas ' + PT.scope) + ' (' + classes.join(', ') + ')';
  document.getElementById('pt-kpi').innerHTML =
    '<div class="kpi-card"><div class="kpi-title">Jumlah Siswa</div><div class="kpi-value">' + rows.length + '</div><div class="kpi-sub">' + classes.length + ' rombel: ' + esc(classes.join(', ')) + '</div></div>' +
    '<div class="kpi-card info"><div class="kpi-title">Rata-Rata</div><div class="kpi-value">' + (avgs.length ? C.fmtNum(avgs.reduce((a, b) => a + b, 0) / avgs.length, 2) : '-') + '</div><div class="kpi-sub">Rerata nilai siswa</div></div>' +
    '<div class="kpi-card success"><div class="kpi-title">Peringkat 1</div><div class="kpi-value" style="font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(rows.length ? rows[0].s.nama : '-') + '</div><div class="kpi-sub">' + (rows.length ? 'Kelas ' + esc(rows[0].s.kelas) + ' • Jumlah ' + C.fmtNum(rows[0].s.total) : '') + '</div></div>' +
    '<div class="kpi-card ' + (incomplete ? 'danger' : 'success') + '"><div class="kpi-title">Nilai Belum Lengkap</div><div class="kpi-value">' + incomplete + '</div><div class="kpi-sub">' + (incomplete ? 'Peringkat bisa berubah setelah lengkap' : 'Semua nilai lengkap') + '</div></div>';

  const card = (r, rank, medal, color) => r ? '<div class="podium-card rank-' + rank + '"><div class="podium-medal">' + medal + '</div>' +
    '<div style="font-size:11px;font-weight:800;color:' + color + ';text-transform:uppercase;">Juara ' + r.rank + ' • Kelas ' + esc(r.s.kelas) + '</div>' +
    '<div class="podium-name" title="' + esc(r.s.nama) + '">' + esc(r.s.nama) + '</div><div class="podium-score">' + C.fmtNum(PT.basis === 'avg' ? r.s.average : r.s.total, 2) + '</div>' +
    '<div class="podium-avg">' + (PT.basis === 'avg' ? 'Jumlah: ' + C.fmtNum(r.s.total) : 'Rata-rata: ' + C.fmtNum(r.s.average, 2)) + '</div></div>' : '';
  document.getElementById('pt-podium').innerHTML = card(rows[1], 2, '🥈', '#94a3b8') + card(rows[0], 1, '🥇', '#f59e0b') + card(rows[2], 3, '🥉', '#d97706');

  const q = PT.search.trim().toUpperCase();
  let shown = PT.limit ? rows.filter(r => r.rank <= PT.limit) : rows;
  if (q) shown = shown.filter(r => r.s.nama.indexOf(q) >= 0 || r.s.nisn.indexOf(q) >= 0 || r.s.kelas === q);
  document.getElementById('pt-table-body').innerHTML = shown.length ? shown.map(r => {
    const s = r.s;
    const p = predikatLabel(s.average);
    const lengkap = s.count >= total;
    return '<tr><td class="center"><strong>' + ptMedal(r.rank) + '#' + r.rank + '</strong></td><td class="center" style="font-family:monospace;font-size:12px;">' + esc(s.nisn) + '</td>' +
      '<td><strong>' + esc(s.nama) + '</strong></td><td class="center"><span class="badge badge-primary">' + esc(s.kelas) + '</span></td>' +
      '<td class="center">#' + s.ranking + '</td>' +
      '<td class="center"><span class="badge ' + (lengkap ? 'badge-success' : 'badge-warning') + '">' + s.count + '/' + total + '</span></td>' +
      '<td class="center"><strong>' + C.fmtNum(s.total) + '</strong></td><td class="center"><strong>' + C.fmtNum(s.average, 2) + '</strong></td>' +
      '<td class="center"><span class="badge ' + p[1] + '">' + p[0] + '</span></td>' +
      '<td class="center"><button class="btn btn-sm btn-secondary" onclick="viewStudentRaport(\'' + esc(s.nisn) + '\')">Raport</button></td></tr>';
  }).join('') : '<tr><td colspan="10" class="center muted" style="padding:24px;">Tidak ada data siswa</td></tr>';

  renderJuaraKelas();
  renderTopMapel(rows);
};

function renderJuaraKelas() {
  const classes = ptClassesOf(PT.scope);
  document.getElementById('pt-juara-kelas').innerHTML = classes.map(c => {
    const top = classStudents(c).filter(s => s.ranking <= 3).sort((a, b) => a.ranking - b.ranking);
    return '<div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><strong>Kelas ' + esc(c) + '</strong><span class="muted" style="font-size:11px;">' + esc(getWali(c).nama) + '</span></div>' +
      (top.length ? top.map(s => '<div style="display:flex;justify-content:space-between;gap:6px;font-size:12.5px;padding:3px 0;"><span>' + ptMedal(s.ranking) + esc(s.nama) + '</span><strong>' + C.fmtNum(s.total) + '</strong></div>').join('') : '<div class="muted">Belum ada siswa</div>') +
      '</div>';
  }).join('');
}

function topMapelData(rows) {
  return AppState.config.mapel_list.map(m => {
    const withVal = rows.map(r => r.s).filter(s => s.grades[m.key] !== null);
    if (!withVal.length) return { m, max: null, list: [] };
    const max = Math.max.apply(null, withVal.map(s => s.grades[m.key]));
    return { m, max, list: withVal.filter(s => s.grades[m.key] === max) };
  });
}

function renderTopMapel(rows) {
  document.getElementById('pt-top-mapel').innerHTML = topMapelData(rows).map((x, i) =>
    '<tr><td class="center">' + (i + 1) + '</td><td><strong>' + esc(x.m.nama) + '</strong></td><td class="center"><strong>' + (x.max === null ? '-' : C.fmtNum(x.max)) + '</strong></td>' +
    '<td>' + (x.list.length ? x.list.map(s => esc(s.nama) + ' <span class="badge badge-primary">' + esc(s.kelas) + '</span>').join(', ') : '<span class="muted">Belum ada nilai</span>') + '</td></tr>').join('');
}

window.setPeringkatScope = function (scope) {
  PT.scope = scope;
  window.renderPeringkatTingkat();
};

/* ===========================================================
   CETAK & EXPORT
   =========================================================== */
window.printPeringkatTingkat = function () {
  const rows = ptRows();
  const shown = PT.limit ? rows.filter(r => r.rank <= PT.limit) : rows;
  const total = AppState.config.mapel_list.length;
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:14pt;font-weight:bold;">DAFTAR PERINGKAT SISWA ' + ptScopeLabel(PT.scope) + (PT.limit ? ' (' + PT.limit + ' BESAR)' : '') + '</div>' +
    '<div style="font-size:12pt;font-weight:bold;">' + ptSubTitle() + '</div>' +
    '<div style="font-size:10pt;">Rombel: ' + esc(ptClassesOf(PT.scope).join(', ')) + ' • Dasar peringkat: ' + (PT.basis === 'avg' ? 'Rata-rata nilai' : 'Jumlah nilai') + '</div></div>' +
    '<table class="raport-table" style="font-size:10pt;"><thead><tr><th>PERINGKAT</th><th>NISN</th><th>NAMA SISWA</th><th>KELAS</th><th>RANK KELAS</th><th>MAPEL</th><th>JUMLAH</th><th>RATA-RATA</th><th>PREDIKAT</th></tr></thead><tbody>' +
    shown.map(r => '<tr><td style="font-weight:bold;">' + r.rank + '</td><td>' + esc(r.s.nisn) + '</td><td style="text-align:left;padding-left:8px;font-weight:bold;">' + esc(r.s.nama) + '</td>' +
      '<td>' + esc(r.s.kelas) + '</td><td>' + r.s.ranking + '</td><td>' + r.s.count + '/' + total + '</td><td style="font-weight:bold;">' + C.fmtNum(r.s.total) + '</td>' +
      '<td style="font-weight:bold;">' + C.fmtNum(r.s.average, 2) + '</td><td>' + predikatLabel(r.s.average)[0] + '</td></tr>').join('') +
    '</tbody></table>' + ttdKepsekHtml() + '</div>', false);
};

window.printJuaraKelas = function () {
  const classes = ptClassesOf(PT.scope);
  let body = '';
  classes.forEach(c => {
    classStudents(c).filter(s => s.ranking <= 3).sort((a, b) => a.ranking - b.ranking).forEach(s => {
      body += '<tr><td>' + esc(c) + '</td><td style="font-weight:bold;">' + s.ranking + '</td><td>' + esc(s.nisn) + '</td><td style="text-align:left;padding-left:8px;font-weight:bold;">' + esc(s.nama) + '</td>' +
        '<td>' + C.fmtNum(s.total) + '</td><td>' + C.fmtNum(s.average, 2) + '</td><td style="text-align:left;padding-left:8px;">' + esc(getWali(c).nama) + '</td></tr>';
    });
  });
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:14pt;font-weight:bold;">DAFTAR JUARA 1 - 3 TIAP KELAS (' + ptScopeLabel(PT.scope) + ')</div>' +
    '<div style="font-size:12pt;font-weight:bold;">' + ptSubTitle() + '</div></div>' +
    '<table class="raport-table" style="font-size:10.5pt;"><thead><tr><th>KELAS</th><th>JUARA</th><th>NISN</th><th>NAMA SISWA</th><th>JUMLAH</th><th>RATA-RATA</th><th>WALI KELAS</th></tr></thead><tbody>' +
    (body || '<tr><td colspan="7">Belum ada data</td></tr>') + '</tbody></table>' + ttdKepsekHtml() + '</div>', false);
};

window.printTopMapel = function () {
  const data = topMapelData(ptRows());
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:14pt;font-weight:bold;">DAFTAR NILAI TERTINGGI PER MATA PELAJARAN</div>' +
    '<div style="font-size:12pt;font-weight:bold;">' + ptScopeLabel(PT.scope) + ' - ' + ptSubTitle() + '</div></div>' +
    '<table class="raport-table" style="font-size:10.5pt;"><thead><tr><th>NO</th><th>MATA PELAJARAN</th><th>NILAI TERTINGGI</th><th>NAMA SISWA (KELAS)</th></tr></thead><tbody>' +
    data.map((x, i) => '<tr><td>' + (i + 1) + '</td><td style="text-align:left;padding-left:8px;">' + esc(x.m.nama) + '</td><td style="font-weight:bold;">' + (x.max === null ? '-' : C.fmtNum(x.max)) + '</td>' +
      '<td style="text-align:left;padding-left:8px;">' + (x.list.map(s => esc(s.nama) + ' (' + esc(s.kelas) + ')').join(', ') || '-') + '</td></tr>').join('') +
    '</tbody></table>' + ttdKepsekHtml() + '</div>', false);
};

window.exportPeringkatExcel = function () {
  if (typeof XLSX === 'undefined') { C.toast('Pustaka Excel belum termuat', 'error'); return; }
  const mapel = AppState.config.mapel_list;
  const wb = XLSX.utils.book_new();
  const scopes = ptTingkatList().concat(['all']);
  scopes.forEach(sc => {
    const rows = ptRows(sc);
    const ws = makeSheet(['PERINGKAT', 'NISN', 'NAMA SISWA', 'KELAS', 'RANK KELAS'].concat(mapel.map(m => m.key)).concat(['JUMLAH', 'RATA2', 'PREDIKAT']),
      rows.map(r => [r.rank, r.s.nisn, r.s.nama, r.s.kelas, r.s.ranking].concat(mapel.map(m => r.s.grades[m.key])).concat([r.s.total, r.s.average, predikatLabel(r.s.average)[0]])),
      [10, 14, 32, 8, 10].concat(mapel.map(() => 7)).concat([9, 8, 18]), [1]);
    XLSX.utils.book_append_sheet(wb, ws, sc === 'all' ? 'Keseluruhan' : 'Kelas_' + sc);
  });
  XLSX.writeFile(wb, 'Peringkat_Tingkat_dan_Keseluruhan_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  C.toast('Excel peringkat diunduh (1 sheet per tingkat + keseluruhan)', 'success');
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pt-basis').addEventListener('change', e => { PT.basis = e.target.value; window.renderPeringkatTingkat(); });
  document.getElementById('pt-limit').addEventListener('change', e => { PT.limit = parseInt(e.target.value, 10) || 0; window.renderPeringkatTingkat(); });
  document.getElementById('pt-search').addEventListener('input', e => { PT.search = e.target.value; window.renderPeringkatTingkat(); });
});
