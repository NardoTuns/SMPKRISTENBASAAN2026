/**
 * Admin: Pengambilan Raport (siswa / orang tua yang datang mengambil raport)
 * Data disimpan di sheet "Pengambilan". Saat offline, catatan disimpan dulu di perangkat
 * (antrean) lalu dikirim otomatis ke spreadsheet ketika online.
 * SMP KRISTEN 65 BASAAN
 */

const AMB = {
  scope: 'kelas',   // 'kelas' | 'all' | 'T7' | '7A' ...
  status: 'all',    // 'all' | 'Sudah' | 'Belum'
  search: '',
  selected: new Set(),
  syncing: false
};

const HUBUNGAN_LIST = ['Orang Tua (Ayah)', 'Orang Tua (Ibu)', 'Wali Siswa', 'Siswa Sendiri', 'Saudara / Kerabat', 'Lainnya'];

/* ===========================================================
   DATA & ANTREAN OFFLINE
   =========================================================== */
function ambilQueue() {
  return C.Store.get(C.KEY.ambilQueue, {}) || {};
}

function ambilMap() {
  return Object.assign({}, (AppState.db && AppState.db.pengambilan) || {}, ambilQueue());
}

function ambilRecord(nisn) {
  return ambilMap()[nisn] || null;
}

function sudahAmbil(nisn) {
  const r = ambilRecord(nisn);
  return !!(r && r.status === 'Sudah');
}

function ambilStudents() {
  const all = AppState.data ? AppState.data.students : [];
  const sc = AMB.scope;
  if (sc === 'kelas') return all.filter(s => s.kelas === AppState.selectedClass);
  if (sc === 'all') return all.slice();
  if (sc.indexOf('T') === 0) return all.filter(s => C.tingkatOf(s.kelas) === sc.slice(1));
  return all.filter(s => s.kelas === sc);
}

function ambilScopeLabel() {
  const sc = AMB.scope;
  if (sc === 'kelas') return 'KELAS ' + (AppState.selectedClass || '-');
  if (sc === 'all') return 'SEMUA KELAS';
  if (sc.indexOf('T') === 0) return 'KELAS ' + C.romawi(sc.slice(1)) + ' (TINGKAT ' + sc.slice(1) + ')';
  return 'KELAS ' + sc;
}

// Kelas tunggal (untuk tanda tangan wali kelas) atau null bila banyak kelas
function ambilSingleClass(list) {
  const set = Array.from(new Set(list.map(s => s.kelas)));
  return set.length === 1 ? set[0] : null;
}

function queueAmbil(rows) {
  const q = ambilQueue();
  rows.forEach(p => { q[p.nisn] = p; });
  C.Store.set(C.KEY.ambilQueue, q);
}

async function syncAmbil(manual) {
  const q = ambilQueue();
  const rows = Object.values(q);
  if (!rows.length) { if (manual) C.toast('Tidak ada data pengambilan yang menunggu dikirim', 'info'); return true; }
  if (AMB.syncing) return false;
  if (!C.isDemo() && !C.isOnline()) {
    if (manual) C.toast('Sedang offline. ' + rows.length + ' catatan tersimpan di perangkat dan akan dikirim saat online.', 'warning');
    return false;
  }
  AMB.syncing = true;
  try {
    await C.api('savePengambilan', { rows: rows.map(C.pengambilanToRow), info: rows.length + ' siswa' });
    if (!AppState.db.pengambilan) AppState.db.pengambilan = {};
    const now = ambilQueue();
    rows.forEach(p => {
      AppState.db.pengambilan[p.nisn] = p;
      // hapus dari antrean hanya bila belum diubah lagi selama proses kirim
      if (now[p.nisn] && now[p.nisn].updated === p.updated) delete now[p.nisn];
    });
    C.Store.set(C.KEY.ambilQueue, now);
    C.saveDB(AppState.db);
    if (manual || rows.length > 1) C.toast(rows.length + ' data pengambilan raport tersimpan di spreadsheet', 'success');
    return true;
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.indexOf('Aksi tidak dikenal') >= 0) {
      C.toast('Backend belum diperbarui: tempel Code.gs terbaru di Apps Script lalu buat versi deployment baru. Data tetap aman di perangkat.', 'error');
    } else {
      C.toast('Belum terkirim (' + msg + '). Data tetap tersimpan di perangkat.', 'warning');
    }
    return false;
  } finally {
    AMB.syncing = false;
    if (AppState.activeTab === 'pengambilan') window.renderPengambilan();
  }
}

window.syncPengambilan = () => syncAmbil(true);

async function saveAmbil(list, okMsg) {
  const petugas = (ADMIN_SESSION && ADMIN_SESSION.nama) || 'Admin';
  const now = C.nowIso();
  list.forEach(p => { p.updated = now; p.petugas = p.petugas || petugas; });
  queueAmbil(list);
  window.renderPengambilan();
  if (okMsg) C.toast(okMsg, 'success');
  await syncAmbil(false);
}

function baseRecord(s) {
  return { nisn: s.nisn, nama: s.nama, kelas: s.kelas };
}

function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d)) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fmtTanggalPanjang(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ', pukul ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/* ===========================================================
   RENDER TAB
   =========================================================== */
window.renderPengambilan = function () {
  if (!AppState.data) return;
  const scopeSel = document.getElementById('amb-scope');
  const tingkat = [];
  AppState.data.classes.forEach(c => { const t = C.tingkatOf(c); if (t && tingkat.indexOf(t) < 0) tingkat.push(t); });
  tingkat.sort((a, b) => a - b);
  scopeSel.innerHTML = '<option value="kelas">Kelas terpilih (' + esc(AppState.selectedClass || '-') + ')</option><option value="all">Semua kelas</option>' +
    tingkat.map(t => '<option value="T' + esc(t) + '">Tingkat ' + esc(t) + ' (semua rombel)</option>').join('') +
    AppState.data.classes.map(c => '<option value="' + esc(c) + '">Kelas ' + esc(c) + '</option>').join('');
  if (!Array.from(scopeSel.options).some(o => o.value === AMB.scope)) AMB.scope = 'kelas';
  scopeSel.value = AMB.scope;
  document.getElementById('amb-status').value = AMB.status;

  const queue = ambilQueue();
  const pending = Object.keys(queue).length;
  const list = ambilStudents();
  const sudah = list.filter(s => sudahAmbil(s.nisn)).length;
  const pct = list.length ? Math.round(sudah / list.length * 100) : 0;
  document.getElementById('amb-kpi').innerHTML =
    '<div class="kpi-card"><div class="kpi-title">Jumlah Siswa</div><div class="kpi-value">' + list.length + '</div><div class="kpi-sub">' + esc(ambilScopeLabel()) + '</div></div>' +
    '<div class="kpi-card success"><div class="kpi-title">Sudah Mengambil</div><div class="kpi-value" style="color:var(--success);">' + sudah + '</div><div class="kpi-sub">' + pct + '% dari siswa</div></div>' +
    '<div class="kpi-card danger"><div class="kpi-title">Belum Mengambil</div><div class="kpi-value" style="color:var(--danger);">' + (list.length - sudah) + '</div><div class="kpi-sub">' + (100 - pct) + '% dari siswa</div></div>' +
    '<div class="kpi-card ' + (pending ? 'warning' : 'info') + '"><div class="kpi-title">Belum Terkirim ke Spreadsheet</div><div class="kpi-value">' + pending + '</div>' +
      '<div class="kpi-sub">' + (pending ? '<button class="btn btn-sm btn-primary" style="margin-top:4px;" onclick="syncPengambilan()">Kirim Sekarang</button>' : 'Semua data sudah tersimpan') + '</div></div>';

  document.getElementById('amb-progress-bar').style.width = pct + '%';
  document.getElementById('amb-progress-text').textContent = sudah + ' / ' + list.length + ' siswa sudah mengambil raport (' + pct + '%)';

  // Rekap per kelas
  document.getElementById('amb-rekap-body').innerHTML = AppState.data.classes.map(c => {
    const ls = classStudents(c);
    const n = ls.filter(s => sudahAmbil(s.nisn)).length;
    const p = ls.length ? Math.round(n / ls.length * 100) : 0;
    const color = p === 100 ? 'var(--success)' : p > 0 ? 'var(--warning)' : 'var(--danger)';
    return '<tr><td class="center"><strong>' + esc(c) + '</strong></td><td>' + esc(getWali(c).nama) + '</td><td class="center">' + ls.length + '</td>' +
      '<td class="center"><span class="badge badge-success">' + n + '</span></td><td class="center"><span class="badge badge-danger">' + (ls.length - n) + '</span></td>' +
      '<td><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;background:rgba(148,163,184,0.2);height:6px;border-radius:999px;overflow:hidden;"><div style="background:' + color + ';width:' + p + '%;height:100%;"></div></div><strong style="font-size:12px;">' + p + '%</strong></div></td></tr>';
  }).join('');

  // Tabel siswa
  const q = AMB.search.trim().toUpperCase();
  const rows = list.filter(s => {
    const done = sudahAmbil(s.nisn);
    if (AMB.status === 'Sudah' && !done) return false;
    if (AMB.status === 'Belum' && done) return false;
    if (!q) return true;
    const r = ambilRecord(s.nisn) || {};
    return s.nama.indexOf(q) >= 0 || s.nisn.indexOf(q) >= 0 || String(r.pengambil || '').toUpperCase().indexOf(q) >= 0;
  });
  document.getElementById('amb-count').textContent = rows.length + ' siswa ditampilkan';
  document.getElementById('amb-table-body').innerHTML = rows.length ? rows.map((s, i) => {
    const r = ambilRecord(s.nisn) || {};
    const done = r.status === 'Sudah';
    const wait = queue[s.nisn] ? '<div style="font-size:10.5px;color:var(--warning);margin-top:2px;">⏳ belum terkirim</div>' : '';
    return '<tr' + (done ? ' style="background:rgba(16,185,129,0.06);"' : '') + '>' +
      '<td class="center"><input type="checkbox" class="amb-check" value="' + esc(s.nisn) + '"' + (AMB.selected.has(s.nisn) ? ' checked' : '') + '></td>' +
      '<td class="center">' + (i + 1) + '</td><td class="center" style="font-family:monospace;font-size:12px;">' + esc(s.nisn) + '</td>' +
      '<td><strong>' + esc(s.nama) + '</strong></td><td class="center">' + esc(s.kelas) + '</td>' +
      '<td class="center">' + (done ? '<span class="badge badge-success">✓ Sudah</span>' : '<span class="badge badge-danger">Belum</span>') + wait + '</td>' +
      '<td style="font-size:12.5px;">' + (done ? C.fmtDateTime(r.tanggal) : '-') + '</td>' +
      '<td style="font-size:12.5px;">' + (done ? '<strong>' + esc(r.pengambil || '-') + '</strong>' + (r.hubungan ? '<div class="muted" style="font-size:11px;">' + esc(r.hubungan) + '</div>' : '') : '-') + '</td>' +
      '<td style="font-size:12px;">' + (done ? esc(r.hp || '') + (r.catatan ? '<div class="muted" style="font-size:11px;">' + esc(r.catatan) + '</div>' : '') : '') + '</td>' +
      '<td class="center" style="white-space:nowrap;">' + (done
        ? '<button class="btn btn-sm btn-secondary" onclick="openAmbilForm(\'' + esc(s.nisn) + '\')">Ubah</button> <button class="btn btn-sm btn-secondary" onclick="printBuktiAmbil(\'' + esc(s.nisn) + '\')" title="Cetak tanda terima">Bukti</button> <button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="batalAmbil(\'' + esc(s.nisn) + '\')">Batal</button>'
        : '<button class="btn btn-sm btn-primary" onclick="openAmbilForm(\'' + esc(s.nisn) + '\')">Catat Ambil</button> <button class="btn btn-sm btn-success" onclick="ambilCepat(\'' + esc(s.nisn) + '\')" title="Tandai sudah diambil sekarang oleh orang tua/wali">✓ Cepat</button>') + '</td></tr>';
  }).join('') : '<tr><td colspan="10" class="center muted" style="padding:24px;">Tidak ada siswa yang cocok.</td></tr>';
  updateAmbilButtons();
};

function updateAmbilButtons() {
  const n = AMB.selected.size;
  const b = document.getElementById('btn-amb-bulk');
  b.disabled = !n;
  b.textContent = n ? 'Tandai Sudah Ambil (' + n + ')' : 'Tandai Terpilih Sudah Ambil';
}

/* ===========================================================
   INPUT
   =========================================================== */
window.openAmbilForm = function (nisn) {
  const s = AppState.data.students.find(x => x.nisn === nisn);
  if (!s) return;
  const r = ambilRecord(nisn) || {};
  const done = r.status === 'Sudah';
  const hub = r.hubungan || HUBUNGAN_LIST[0];
  openModal((done ? 'Ubah' : 'Catat') + ' Pengambilan Raport',
    '<div style="background:var(--bg-input);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:14px;">' +
      '<strong>' + esc(s.nama) + '</strong><div class="muted" style="font-size:12px;">NISN ' + esc(s.nisn) + ' • Kelas ' + esc(s.kelas) + ' • Wali: ' + esc(getWali(s.kelas).nama) + '</div></div>' +
    '<div class="grid-form">' +
      '<div class="form-group"><label>Tanggal &amp; Jam Ambil *</label><input type="datetime-local" class="form-control" id="af-tanggal" value="' + esc(toLocalInput(done ? r.tanggal : null)) + '"></div>' +
      '<div class="form-group"><label>Hubungan dengan Siswa</label><select class="form-control" id="af-hubungan">' +
        HUBUNGAN_LIST.concat(HUBUNGAN_LIST.indexOf(hub) < 0 ? [hub] : []).map(h => '<option' + (h === hub ? ' selected' : '') + '>' + esc(h) + '</option>').join('') + '</select></div>' +
    '</div>' +
    '<div class="form-group"><label>Nama Pengambil *</label><input class="form-control" id="af-pengambil" value="' + esc(r.pengambil || '') + '" placeholder="Nama orang tua / wali / siswa"></div>' +
    '<div class="grid-form">' +
      '<div class="form-group"><label>No. HP / WA (opsional)</label><input class="form-control" id="af-hp" inputmode="tel" value="' + esc(r.hp || '') + '"></div>' +
      '<div class="form-group"><label>Catatan (opsional)</label><input class="form-control" id="af-catatan" value="' + esc(r.catatan || '') + '" placeholder="Misal: diwakilkan, sudah konsultasi wali kelas"></div>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button>' +
      '<button class="btn btn-secondary" id="af-save-print">Simpan &amp; Cetak Bukti</button>' +
      '<button class="btn btn-primary" id="af-save">Simpan</button></div>');
  const hubSel = document.getElementById('af-hubungan');
  const nameIn = document.getElementById('af-pengambil');
  hubSel.addEventListener('change', () => { if (hubSel.value === 'Siswa Sendiri' && !nameIn.value) nameIn.value = s.nama; });
  nameIn.focus();
  const doSave = async printAfter => {
    const t = document.getElementById('af-tanggal').value;
    const pengambil = nameIn.value.trim();
    if (!t || !pengambil) { C.toast('Tanggal dan nama pengambil wajib diisi', 'warning'); return; }
    const p = Object.assign(baseRecord(s), {
      status: 'Sudah', tanggal: new Date(t).toISOString(), pengambil: pengambil, hubungan: hubSel.value,
      hp: document.getElementById('af-hp').value.trim(), catatan: document.getElementById('af-catatan').value.trim(),
      petugas: r.petugas || ''
    });
    closeModal();
    if (printAfter) window.printBuktiAmbil(s.nisn, p);
    await saveAmbil([p], 'Pengambilan raport ' + s.nama + ' dicatat');
  };
  document.getElementById('af-save').onclick = () => doSave(false);
  document.getElementById('af-save-print').onclick = () => doSave(true);
};

window.ambilCepat = async function (nisn) {
  const s = AppState.data.students.find(x => x.nisn === nisn);
  if (!s) return;
  await saveAmbil([Object.assign(baseRecord(s), { status: 'Sudah', tanggal: C.nowIso(), pengambil: 'Orang Tua / Wali', hubungan: 'Wali Siswa', hp: '', catatan: 'Dicatat cepat' })],
    s.nama + ' ditandai sudah mengambil raport');
};

window.ambilTerpilih = async function () {
  const list = AppState.data.students.filter(s => AMB.selected.has(s.nisn) && !sudahAmbil(s.nisn));
  if (!list.length) { C.toast('Siswa terpilih sudah tercatat semua', 'info'); return; }
  if (!confirm('Tandai ' + list.length + ' siswa sudah mengambil raport sekarang (diambil orang tua / wali)?')) return;
  const now = C.nowIso();
  AMB.selected.clear();
  await saveAmbil(list.map(s => Object.assign(baseRecord(s), { status: 'Sudah', tanggal: now, pengambil: 'Orang Tua / Wali', hubungan: 'Wali Siswa', hp: '', catatan: 'Dicatat massal' })),
    list.length + ' siswa ditandai sudah mengambil raport');
};

window.batalAmbil = async function (nisn) {
  const s = AppState.data.students.find(x => x.nisn === nisn);
  if (!s || !confirm('Batalkan catatan pengambilan raport ' + s.nama + '?\nStatus kembali menjadi "Belum".')) return;
  await saveAmbil([Object.assign(baseRecord(s), { status: 'Belum', tanggal: '', pengambil: '', hubungan: '', hp: '', catatan: '' })], 'Catatan pengambilan ' + s.nama + ' dibatalkan');
};

// Kotak cari cepat: ketik nama / NISN lalu Enter
function ambilQuickEnter() {
  const q = AMB.search.trim().toUpperCase();
  if (!q) return;
  const all = AppState.data.students;
  let hit = all.filter(s => s.nisn === q);
  if (!hit.length) hit = ambilStudents().filter(s => s.nama.indexOf(q) >= 0 || s.nisn.indexOf(q) >= 0);
  if (!hit.length) hit = all.filter(s => s.nama.indexOf(q) >= 0);
  if (hit.length === 1) window.openAmbilForm(hit[0].nisn);
  else if (!hit.length) C.toast('Siswa tidak ditemukan', 'warning');
  else C.toast(hit.length + ' siswa cocok, perjelas nama / NISN', 'info');
}

/* ===========================================================
   CETAK, EXPORT & BAGIKAN
   =========================================================== */
function ambilTtd(list) {
  const k = ambilSingleClass(list);
  return k ? ttdKepsekWaliHtml(k) : ttdKepsekHtml();
}

function ambilTitle(judul) {
  const cfg = AppState.config;
  return '<div style="text-align:center;margin-bottom:16px;"><div style="font-size:14pt;font-weight:bold;">' + judul + '</div>' +
    '<div style="font-size:12pt;font-weight:bold;">' + esc(String(cfg.judul_laporan || '').toUpperCase()) + '</div>' +
    '<div style="font-size:11pt;font-weight:bold;">SEMESTER ' + esc(String(cfg.semester || '').toUpperCase()) + ' TAHUN PELAJARAN ' + esc(cfg.tahun_ajaran) + '</div></div>';
}

window.printLaporanPengambilan = function () {
  let list = ambilStudents();
  if (AMB.status === 'Sudah') list = list.filter(s => sudahAmbil(s.nisn));
  if (AMB.status === 'Belum') list = list.filter(s => !sudahAmbil(s.nisn));
  const sudah = list.filter(s => sudahAmbil(s.nisn)).length;
  const judul = AMB.status === 'Belum' ? 'DAFTAR SISWA BELUM MENGAMBIL RAPORT' : AMB.status === 'Sudah' ? 'DAFTAR SISWA SUDAH MENGAMBIL RAPORT' : 'LAPORAN PENGAMBILAN RAPORT';
  printHtml('<div class="raport-sheet">' + kopSuratHtml() + ambilTitle(judul + ' - ' + esc(ambilScopeLabel())) +
    '<table class="raport-table" style="font-size:9.5pt;"><thead><tr><th>NO</th><th>NISN</th><th>NAMA SISWA</th><th>KELAS</th><th>STATUS</th><th>TANGGAL / JAM</th><th>DIAMBIL OLEH</th><th>HUBUNGAN</th><th>KET</th></tr></thead><tbody>' +
    (list.length ? list.map((s, i) => {
      const r = ambilRecord(s.nisn) || {};
      const done = r.status === 'Sudah';
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.nisn) + '</td><td style="text-align:left;padding-left:6px;font-weight:bold;">' + esc(s.nama) + '</td><td>' + esc(s.kelas) + '</td>' +
        '<td style="font-weight:bold;' + (done ? '' : 'color:#b91c1c;') + '">' + (done ? 'Sudah' : 'Belum') + '</td><td>' + (done ? C.fmtDateTime(r.tanggal) : '') + '</td>' +
        '<td style="text-align:left;padding-left:6px;">' + (done ? esc(r.pengambil) : '') + '</td><td>' + (done ? esc(r.hubungan) : '') + '</td><td style="font-size:8.5pt;">' + (done ? esc(r.catatan) : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="9">Tidak ada data</td></tr>') +
    '</tbody></table>' +
    '<div style="margin-top:10px;font-size:11pt;"><strong>Ringkasan:</strong> ' + list.length + ' siswa • Sudah mengambil: ' + sudah + ' • Belum: ' + (list.length - sudah) + '</div>' +
    ambilTtd(list) + '</div>', false);
};

// Lembar tanda tangan pengambilan (1 halaman per kelas), terisi otomatis bila sudah dicatat
window.printDaftarTtdAmbil = function () {
  const list = ambilStudents();
  const classes = AppState.data.classes.filter(c => list.some(s => s.kelas === c));
  if (!classes.length) { C.toast('Tidak ada siswa', 'info'); return; }
  const pages = classes.map(c => {
    const ls = list.filter(s => s.kelas === c);
    return '<div class="raport-sheet">' + kopSuratHtml() + ambilTitle('DAFTAR TANDA TANGAN PENGAMBILAN RAPORT - KELAS ' + esc(c)) +
      '<table class="raport-table" style="font-size:10pt;"><thead><tr><th style="width:30px;">NO</th><th>NAMA SISWA</th><th style="width:150px;">NAMA PENGAMBIL</th><th style="width:85px;">HUBUNGAN</th><th style="width:80px;">TANGGAL</th><th style="width:150px;">TANDA TANGAN</th></tr></thead><tbody>' +
      ls.map((s, i) => {
        const r = ambilRecord(s.nisn) || {};
        const done = r.status === 'Sudah';
        const d = done && r.tanggal ? new Date(r.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        return '<tr style="height:34px;"><td>' + (i + 1) + '</td><td style="text-align:left;padding-left:6px;font-weight:bold;">' + esc(s.nama) + '</td>' +
          '<td style="text-align:left;padding-left:6px;">' + (done ? esc(r.pengambil) : '') + '</td><td style="font-size:8.5pt;">' + (done ? esc(r.hubungan) : '') + '</td><td>' + d + '</td>' +
          '<td style="text-align:' + (i % 2 ? 'right' : 'left') + ';padding:0 8px;vertical-align:top;font-size:8pt;">' + (i + 1) + '.</td></tr>';
      }).join('') + '</tbody></table>' + ttdKepsekWaliHtml(c) + '</div>';
  });
  printHtml(pages.join(''), false);
};

window.printRekapAmbil = function () {
  let tot = 0, totS = 0;
  const body = AppState.data.classes.map((c, i) => {
    const ls = classStudents(c);
    const n = ls.filter(s => sudahAmbil(s.nisn)).length;
    tot += ls.length; totS += n;
    return '<tr><td>' + (i + 1) + '</td><td style="font-weight:bold;">' + esc(c) + '</td><td style="text-align:left;padding-left:8px;">' + esc(getWali(c).nama) + '</td><td>' + ls.length + '</td><td>' + n + '</td><td>' + (ls.length - n) + '</td><td style="font-weight:bold;">' + (ls.length ? Math.round(n / ls.length * 100) : 0) + '%</td></tr>';
  }).join('');
  printHtml('<div class="raport-sheet">' + kopSuratHtml() + ambilTitle('REKAPITULASI PENGAMBILAN RAPORT PER KELAS') +
    '<table class="raport-table" style="font-size:11pt;"><thead><tr><th>NO</th><th>KELAS</th><th>WALI KELAS</th><th>JUMLAH SISWA</th><th>SUDAH</th><th>BELUM</th><th>PERSENTASE</th></tr></thead><tbody>' + body +
    '<tr class="row-summary"><td colspan="3">JUMLAH</td><td>' + tot + '</td><td>' + totS + '</td><td>' + (tot - totS) + '</td><td>' + (tot ? Math.round(totS / tot * 100) : 0) + '%</td></tr>' +
    '</tbody></table><div style="margin-top:8px;font-size:10pt;">Dicetak: ' + esc(C.fmtDateTime(C.nowIso())) + '</div>' + ttdKepsekHtml() + '</div>', false);
};

// Tanda terima / bukti pengambilan raport per siswa
window.printBuktiAmbil = function (nisn, rec) {
  const s = AppState.data.students.find(x => x.nisn === nisn);
  const r = rec || ambilRecord(nisn);
  if (!s || !r || r.status !== 'Sudah') { C.toast('Siswa ini belum tercatat mengambil raport', 'warning'); return; }
  const cfg = AppState.config;
  const w = getWali(s.kelas);
  const row = (k, v) => '<tr><td style="width:190px;padding:4px 0;">' + k + '</td><td style="width:14px;">:</td><td style="font-weight:bold;">' + v + '</td></tr>';
  printHtml('<div class="raport-sheet">' + kopSuratHtml() +
    '<div style="text-align:center;margin:10px 0 18px;"><div style="font-size:14pt;font-weight:bold;text-decoration:underline;">TANDA TERIMA PENGAMBILAN RAPORT</div>' +
    '<div style="font-size:11pt;">' + esc(cfg.judul_laporan) + ' • Semester ' + esc(cfg.semester) + ' T.P. ' + esc(cfg.tahun_ajaran) + '</div></div>' +
    '<div style="font-size:12pt;margin-bottom:6px;">Telah diterima Laporan Hasil Belajar siswa berikut:</div>' +
    '<table style="font-size:12pt;border-collapse:collapse;margin-left:10px;">' +
      row('Nama Siswa', esc(s.nama)) + row('NISN', esc(s.nisn)) + row('Kelas', esc(s.kelas)) + row('Wali Kelas', esc(w.nama)) + '</table>' +
    '<div style="font-size:12pt;margin:14px 0 6px;">Diterima oleh:</div>' +
    '<table style="font-size:12pt;border-collapse:collapse;margin-left:10px;">' +
      row('Nama Penerima', esc(r.pengambil)) + row('Hubungan dengan Siswa', esc(r.hubungan || '-')) + (r.hp ? row('No. HP', esc(r.hp)) : '') +
      row('Hari / Tanggal', esc(fmtTanggalPanjang(r.tanggal))) + (r.catatan ? row('Catatan', esc(r.catatan)) : '') + '</table>' +
    '<div style="display:flex;justify-content:space-between;margin-top:40px;font-size:12pt;">' +
      '<div style="text-align:center;width:240px;"><div>&nbsp;</div><div>Yang Menerima,</div><div style="height:65px;"></div><div style="font-weight:bold;">' + esc(r.pengambil) + '</div></div>' +
      '<div style="text-align:center;width:240px;"><div>' + esc(cfg.tempat_raport) + ', ' + esc(new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })) + '</div><div>Wali Kelas ' + esc(s.kelas) + '</div><div style="height:65px;"></div>' +
        '<div style="font-weight:bold;">' + esc(w.nama) + '</div>' + (w.nip ? '<div>NIP. ' + esc(w.nip) + '</div>' : '') + '</div>' +
    '</div></div>', false);
};

window.exportAmbilExcel = function () {
  if (typeof XLSX === 'undefined') { C.toast('Pustaka Excel belum termuat', 'error'); return; }
  const list = ambilStudents();
  const ws = makeSheet(['NO', 'NISN', 'NAMA SISWA', 'KELAS', 'STATUS', 'TANGGAL / JAM', 'DIAMBIL OLEH', 'HUBUNGAN', 'NO HP', 'CATATAN', 'PETUGAS'],
    list.map((s, i) => {
      const r = ambilRecord(s.nisn) || {};
      const done = r.status === 'Sudah';
      return [i + 1, s.nisn, s.nama, s.kelas, done ? 'Sudah' : 'Belum', done ? C.fmtDateTime(r.tanggal) : '', done ? r.pengambil : '', done ? r.hubungan : '', done ? r.hp : '', done ? r.catatan : '', done ? r.petugas : ''];
    }), [5, 14, 32, 8, 9, 20, 26, 16, 16, 26, 14], [1, 8]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pengambilan_Raport');
  XLSX.writeFile(wb, 'Pengambilan_Raport_' + C.safeFileName(ambilScopeLabel()) + '.xlsx');
  C.toast('Excel pengambilan raport diunduh', 'success');
};

window.copyWaBelumAmbil = function () {
  const cfg = AppState.config;
  const list = ambilStudents().filter(s => !sudahAmbil(s.nisn));
  if (!list.length) { C.toast('Semua siswa sudah mengambil raport!', 'success'); return; }
  let text = '📢 *PENGUMUMAN PENGAMBILAN RAPORT*\n*' + cfg.nama_sekolah + '*\nSemester ' + cfg.semester + ' T.P. ' + cfg.tahun_ajaran + '\n\n' +
    'Yth. Bapak/Ibu Orang Tua/Wali siswa berikut, raport putra/putri Bapak/Ibu *belum diambil*:\n';
  let cur = null, no = 0;
  list.forEach(s => {
    if (s.kelas !== cur) { cur = s.kelas; no = 0; text += '\n*Kelas ' + cur + '*\n'; }
    text += (++no) + '. ' + s.nama + '\n';
  });
  text += '\nMohon segera datang ke sekolah untuk mengambil raport. Terima kasih 🙏';
  const done = () => C.toast('Teks pengumuman WhatsApp disalin!', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => prompt('Salin teks berikut:', text));
  else prompt('Salin teks berikut:', text);
};

/* ===========================================================
   EVENT
   =========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('amb-scope').addEventListener('change', e => { AMB.scope = e.target.value; AMB.selected.clear(); window.renderPengambilan(); });
  document.getElementById('amb-status').addEventListener('change', e => { AMB.status = e.target.value; window.renderPengambilan(); });
  const search = document.getElementById('amb-search');
  search.addEventListener('input', e => { AMB.search = e.target.value; window.renderPengambilan(); });
  search.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ambilQuickEnter(); } });
  document.getElementById('amb-table-body').addEventListener('change', e => {
    if (!e.target.classList.contains('amb-check')) return;
    if (e.target.checked) AMB.selected.add(e.target.value); else AMB.selected.delete(e.target.value);
    updateAmbilButtons();
  });
  document.getElementById('amb-check-all').addEventListener('change', e => {
    document.querySelectorAll('#amb-table-body .amb-check').forEach(cb => { if (e.target.checked) AMB.selected.add(cb.value); else AMB.selected.delete(cb.value); });
    window.renderPengambilan();
  });

  // Kirim antrean saat koneksi kembali / saat aplikasi dibuka
  window.addEventListener('online', () => setTimeout(() => syncAmbil(false), 1500));
  setTimeout(() => { if (Object.keys(ambilQueue()).length) syncAmbil(false); }, 4000);
});
