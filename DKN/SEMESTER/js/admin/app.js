/**
 * ADMIN: state utama, navigasi, sinkron spreadsheet & dashboard
 * SMP KRISTEN 65 BASAAN
 */
const C = window.Core;
const ADMIN_SESSION = C.requireRole('admin');

const AppState = {
  db: null,          // data ternormalisasi dari spreadsheet
  data: null,        // { classes, students, analytics }
  config: null,      // pengaturan + mapel_list (format lama)
  selectedClass: null,
  selectedStudentNisn: null,
  activeTab: 'dashboard',
  charts: {}
};

// Kompatibilitas dengan modul lama
window.showToast = C.toast;
window.formatNum = C.fmtNum;
const esc = C.esc;

/* ===========================================================
   DATA
   =========================================================== */
function rebuildState() {
  const db = AppState.db;
  const r = C.computeStudents(db);
  AppState.data = { classes: r.classes, students: r.students, analytics: r.analytics };
  const cfg = Object.assign({}, db.config);
  cfg.mapel_list = r.mapel.map(m => ({ key: m.kode, nama: m.nama, kkm: m.kkm, kelompok: m.kelompok, no: m.urut }));
  AppState.config = cfg;
  if (!AppState.selectedClass || r.classes.indexOf(AppState.selectedClass) < 0) {
    let saved = null;
    try { saved = localStorage.getItem('rpt_admin_kelas'); } catch (e) { /* abaikan */ }
    AppState.selectedClass = r.classes.indexOf(saved) >= 0 ? saved : (r.classes[0] || null);
  }
}

function classStudents(c) {
  return (AppState.data ? AppState.data.students : []).filter(s => s.kelas === (c || AppState.selectedClass));
}

function getWali(kelas) {
  const k = C.kelasInfo(AppState.db, kelas);
  return { nama: k.wali || '-', nip: k.nip || '', label: k.label || '' };
}

function isTerpisah() {
  return (AppState.config || {}).mode_keterampilan === 'terpisah';
}

function canWrite() {
  if (C.isDemo() || C.isOnline()) return true;
  C.toast('Perubahan data butuh koneksi internet. Mode offline hanya untuk melihat & mencetak.', 'warning');
  return false;
}

function loading(on, msg) {
  document.getElementById('loading').classList.toggle('active', !!on);
  if (msg) document.getElementById('loading-text').textContent = msg;
}

async function reloadFromServer(opts) {
  opts = opts || {};
  if (!C.isDemo() && !C.isOnline()) {
    if (!opts.silent) C.toast('Sedang offline - menampilkan data terakhir yang tersimpan.', 'warning');
    return false;
  }
  const btn = document.getElementById('btn-refresh');
  if (btn) btn.disabled = true;
  if (!opts.silent) loading(true, 'Mengambil data terbaru dari spreadsheet...');
  try {
    const res = await C.fetchDB();
    AppState.db = res.db;
    rebuildState();
    initializeUI();
    if (!opts.silent) C.toast('Data terbaru berhasil diambil', 'success');
    return true;
  } catch (err) {
    C.toast('Gagal mengambil data: ' + err.message, 'error');
    return false;
  } finally {
    loading(false);
    if (btn) btn.disabled = false;
  }
}

// Kirim perubahan ke spreadsheet lalu muat ulang data
async function adminWrite(action, payload, okMsg) {
  if (!canWrite()) return false;
  loading(true, 'Menyimpan ke spreadsheet...');
  try {
    await C.api(action, payload);
    const res = await C.fetchDB();
    AppState.db = res.db;
    rebuildState();
    initializeUI();
    if (okMsg) C.toast(okMsg, 'success');
    return true;
  } catch (err) {
    C.toast('Gagal menyimpan: ' + err.message, 'error');
    return false;
  } finally {
    loading(false);
  }
}

/* ===========================================================
   UI UMUM
   =========================================================== */
function initializeUI() {
  if (!AppState.data) return;
  const sel = document.getElementById('class-select');
  sel.innerHTML = AppState.data.classes.map(c => '<option value="' + esc(c) + '">Kelas ' + esc(c) + '</option>').join('');
  if (AppState.selectedClass) sel.value = AppState.selectedClass;

  const cfg = AppState.config;
  document.getElementById('footer-sekolah').textContent = cfg.nama_sekolah || '';
  document.getElementById('footer-ta').textContent = 'T.A. ' + (cfg.tahun_ajaran || '') + ' • Semester ' + (cfg.semester || '');
  updateWaliBadge();
  updateConn();
  document.querySelectorAll('.js-kelas').forEach(el => { el.textContent = AppState.selectedClass || '-'; });
  if (window.renderKelengkapan) window.renderKelengkapan(true);
  renderActiveTab();
}

function updateWaliBadge() {
  const el = document.getElementById('top-wali-name');
  if (el) el.textContent = AppState.selectedClass ? getWali(AppState.selectedClass).nama : '-';
}

function updateConn() {
  const pill = document.getElementById('conn-pill');
  if (!pill) return;
  pill.classList.remove('offline', 'demo');
  if (C.isDemo()) { pill.classList.add('demo'); pill.textContent = 'Mode Demo'; }
  else if (!C.isOnline()) { pill.classList.add('offline'); pill.textContent = 'Offline'; }
  else pill.textContent = 'Online';
  pill.title = 'Data diambil: ' + C.fmtDateTime(AppState.db && AppState.db.fetchedAt);
}

const TAB_TITLES = {
  dashboard: 'Dashboard Ikhtisar',
  raport: 'Cetak Raport Siswa',
  leger: 'Tabel Daftar Nilai (DKN / Leger)',
  siswa: 'Data Siswa',
  pelengkap: 'Sikap, Ekskul & Kehadiran',
  deskripsi: 'Bank Deskripsi',
  impor: 'Import / Export Excel',
  ranking: 'Perengkingan Siswa',
  mapel: 'Daftar Nilai per Mapel',
  analisis: 'Analisis & Statistik Nilai',
  kelengkapan: 'Kontrol Kelengkapan Nilai Siswa',
  log: 'Log Aktivitas',
  settings: 'Pengaturan, Mapel & Wali Kelas'
};

const TAB_RENDER = {
  dashboard: () => renderDashboard(),
  raport: () => window.renderRaport && window.renderRaport(),
  leger: () => window.renderLeger && window.renderLeger(),
  siswa: () => window.renderSiswa && window.renderSiswa(),
  pelengkap: () => window.renderPelengkap && window.renderPelengkap(),
  deskripsi: () => window.renderDeskripsiAdmin && window.renderDeskripsiAdmin(),
  impor: () => window.renderImpor && window.renderImpor(),
  ranking: () => window.renderRanking && window.renderRanking(),
  mapel: () => window.renderMapel && window.renderMapel(),
  analisis: () => window.renderAnalisis && window.renderAnalisis(),
  kelengkapan: () => window.renderKelengkapan && window.renderKelengkapan(),
  log: () => window.loadLog && window.loadLog(true),
  settings: () => window.loadSettingsForm && window.loadSettingsForm()
};

function renderActiveTab() {
  const fn = TAB_RENDER[AppState.activeTab];
  if (fn) fn();
}

function switchTab(tabId) {
  if (AppState.activeTab === 'pelengkap' && tabId !== 'pelengkap' && window.pelengkapDirty && window.pelengkapDirty()) {
    if (!confirm('Ada perubahan Sikap/Ekskul/Kehadiran yang belum disimpan. Tinggalkan halaman ini?')) return;
  }
  AppState.activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-tab') === tabId));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
  document.getElementById('page-title').textContent = TAB_TITLES[tabId] || '';
  closeSidebar();
  renderActiveTab();
  window.scrollTo(0, 0);
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

function viewStudentRaport(nisn) {
  AppState.selectedStudentNisn = String(nisn);
  switchTab('raport');
}

/* ---------- Modal ---------- */
function openModal(title, html, wide) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-box').classList.toggle('wide', !!wide);
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
  document.getElementById('modal-body').innerHTML = '';
}

/* ===========================================================
   DASHBOARD
   =========================================================== */
function renderDashboard() {
  if (!AppState.data) return;
  const c = AppState.selectedClass;
  const students = classStudents(c);
  const analytics = AppState.data.analytics[c] || {};
  const mapel = AppState.config.mapel_list;

  document.getElementById('dash-total-students').textContent = students.length;
  document.getElementById('dash-total-all').textContent = 'Total sekolah: ' + AppState.data.students.length + ' siswa';
  document.getElementById('dash-class-avg').textContent = C.fmtNum(analytics.rata_rata_kelas);
  document.getElementById('dash-rank-1-name').textContent = analytics.siswa_ranking_1 || '-';
  document.getElementById('dash-rank-1-score').textContent = 'Jumlah: ' + C.fmtNum(analytics.skor_ranking_1);

  let filled = 0, deskFilled = 0;
  const totalSlots = students.length * mapel.length;
  const cards = mapel.map(m => {
    let f = 0, d = 0, last = null;
    students.forEach(s => {
      if (s.grades[m.key] !== null) f++;
      const dk = s.desk[m.key];
      if (dk && dk.kuasai && dk.tingkatkan) d++;
      if (dk && dk.updated && (!last || dk.updated > last.updated)) last = dk;
    });
    filled += f;
    deskFilled += d;
    const pct = students.length ? Math.round(f / students.length * 100) : 0;
    const color = pct === 100 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--danger)';
    return '<div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:12px;">' +
      '<div style="display:flex;justify-content:space-between;gap:6px;"><strong style="font-size:13px;">' + esc(m.nama) + '</strong><span style="font-weight:800;color:' + color + ';font-size:12px;">' + pct + '%</span></div>' +
      '<div style="background:rgba(148,163,184,0.2);height:6px;border-radius:999px;overflow:hidden;margin:8px 0;"><div style="background:' + color + ';width:' + pct + '%;height:100%;"></div></div>' +
      '<div class="muted" style="font-size:11.5px;">Nilai ' + f + '/' + students.length + ' • Deskripsi ' + d + '/' + students.length + '</div>' +
      '<div class="muted" style="font-size:11px;margin-top:2px;">' + (last ? 'Terakhir: ' + esc(last.guru || '-') + ', ' + C.fmtDateTime(last.updated) : 'Belum ada input') + '</div></div>';
  });
  document.getElementById('dash-mapel-progress').innerHTML = cards.join('') || '<div class="muted">Belum ada mata pelajaran.</div>';
  const pct = totalSlots ? Math.round(filled / totalSlots * 100) : 0;
  document.getElementById('dash-progress').textContent = pct + '%';
  document.getElementById('dash-progress-sub').textContent = 'Nilai ' + filled + '/' + totalSlots + ' • Deskripsi ' + deskFilled + '/' + totalSlots;
  document.getElementById('dash-sync-info').textContent = 'Data diambil: ' + C.fmtDateTime(AppState.db.fetchedAt);

  const tbody = document.getElementById('dash-quick-students');
  const top = students.slice().sort((a, b) => a.ranking - b.ranking).slice(0, 8);
  tbody.innerHTML = top.length ? top.map(s => '<tr>' +
    '<td class="center"><strong>#' + s.ranking + '</strong></td>' +
    '<td><strong>' + esc(s.nama) + '</strong></td>' +
    '<td class="center">' + esc(s.nisn) + '</td>' +
    '<td class="center"><span class="badge badge-primary">' + C.fmtNum(s.total) + '</span></td>' +
    '<td class="center"><strong>' + C.fmtNum(s.average, 2) + '</strong></td>' +
    '<td class="center"><button class="btn btn-sm btn-secondary" onclick="viewStudentRaport(\'' + esc(s.nisn) + '\')">Lihat Raport</button></td>' +
    '</tr>').join('') : '<tr><td colspan="6" class="center muted" style="padding:24px;">Belum ada siswa di kelas ini. Tambahkan lewat menu Data Siswa.</td></tr>';
}

/* ===========================================================
   CETAK (dipakai banyak modul)
   =========================================================== */
function kopSuratHtml() {
  const cfg = AppState.config || {};
  return '<div class="kop-surat">' +
    '<img class="kop-logo" src="assets/logo_left.png" alt="Logo Yayasan">' +
    '<div class="kop-text">' +
      '<div class="kop-yayasan">' + esc(cfg.yayasan) + '</div>' +
      '<div class="kop-bidang">' + esc(cfg.bidang) + '</div>' +
      '<div class="kop-sekolah">' + esc(cfg.nama_sekolah) + '</div>' +
      '<div class="kop-alamat">' + esc(cfg.alamat) + '</div>' +
    '</div>' +
    '<img class="kop-logo" src="assets/logo_right.png" alt="Logo Tut Wuri">' +
  '</div><div class="kop-garis"></div>';
}

function ttdKepsekWaliHtml(kelas, waliLabel) {
  const cfg = AppState.config || {};
  const w = getWali(kelas);
  return '<div style="display:flex;justify-content:space-between;margin-top:35px;font-size:12pt;">' +
    '<div style="text-align:center;width:240px;"><div>Mengetahui,</div><div>Kepala Sekolah</div><div style="height:60px;"></div>' +
      '<div style="font-weight:bold;">' + esc(cfg.kepala_sekolah) + '</div>' + (cfg.nip_kepala_sekolah ? '<div>NIP. ' + esc(cfg.nip_kepala_sekolah) + '</div>' : '') + '</div>' +
    '<div style="text-align:center;width:240px;"><div>' + esc(cfg.tempat_raport) + ', ' + esc(cfg.tanggal_raport) + '</div><div>' + esc(waliLabel || ('Wali Kelas ' + kelas)) + '</div><div style="height:60px;"></div>' +
      '<div style="font-weight:bold;">' + esc(w.nama) + '</div>' + (w.nip ? '<div>NIP. ' + esc(w.nip) + '</div>' : '') + '</div>' +
  '</div>';
}

function printHtml(html, landscape) {
  const area = document.getElementById('print-area');
  area.innerHTML = html;
  document.body.classList.toggle('print-landscape', !!landscape);
  const pending = Array.from(area.querySelectorAll('img')).filter(img => !img.complete).map(img => new Promise(r => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  }));
  Promise.all(pending).then(() => setTimeout(() => window.print(), 150));
}

window.addEventListener('beforeprint', () => {
  const area = document.getElementById('print-area');
  if (area && area.children.length > 0) document.body.classList.add('print-mode');
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-mode');
  const area = document.getElementById('print-area');
  if (area) area.innerHTML = '';
});

/* ===========================================================
   START
   =========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  if (!ADMIN_SESSION) return;
  AppState.db = C.loadDB();
  if (!AppState.db) { C.logout(); return; }
  rebuildState();

  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', e => { e.preventDefault(); switchTab(item.getAttribute('data-tab')); });
  });
  document.getElementById('nav-logout').addEventListener('click', () => {
    if (confirm('Keluar dari aplikasi admin?')) C.logout();
  });
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-backdrop').classList.add('open');
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

  document.getElementById('class-select').addEventListener('change', e => {
    AppState.selectedClass = e.target.value;
    try { localStorage.setItem('rpt_admin_kelas', e.target.value); } catch (err) { /* abaikan */ }
    updateWaliBadge();
    document.querySelectorAll('.js-kelas').forEach(el => { el.textContent = AppState.selectedClass; });
    if (window.renderKelengkapan) window.renderKelengkapan(true);
    renderActiveTab();
  });

  document.getElementById('theme-toggle').addEventListener('click', () => C.toggleTheme());
  document.getElementById('btn-refresh').addEventListener('click', () => reloadFromServer());

  const dd = document.getElementById('excel-dropdown');
  document.getElementById('btn-excel-menu').addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
  document.addEventListener('click', e => { if (!dd.contains(e.target)) dd.classList.remove('open'); });
  dd.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => {
    dd.classList.remove('open');
    const a = b.dataset.action;
    if (a === 'tpl-full-class') window.downloadTemplateFull(true);
    if (a === 'tpl-full-all') window.downloadTemplateFull(false);
    if (a === 'tpl-siswa') window.downloadTemplateSiswa(false);
    if (a === 'export-all') window.exportAllExcel();
  }));
  dd.querySelector('label').addEventListener('click', () => dd.classList.remove('open'));

  document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  window.addEventListener('online', updateConn);
  window.addEventListener('offline', updateConn);

  initializeUI();
  C.registerSW();

  // Data diambil saat login; bila halaman dibuka ulang, segarkan diam-diam bila online
  const age = Date.now() - new Date(AppState.db.fetchedAt).getTime();
  if (age > 60000) reloadFromServer({ silent: true });
});
