/**
 * Admin: Data Siswa, Pelengkap Raport (Sikap/Ekskul/Kehadiran), Bank Deskripsi, Log
 * SMP KRISTEN 65 BASAAN
 */

/* ===========================================================
   DATA SISWA
   =========================================================== */
const siswaSelected = new Set();

function siswaFilterList() {
  const q = (document.getElementById('siswa-search').value || '').trim().toUpperCase();
  const f = document.getElementById('siswa-kelas-filter').value;
  return AppState.data.students.filter(s => {
    if (f === '__sel' && s.kelas !== AppState.selectedClass) return false;
    if (f !== '__sel' && f !== '__all' && s.kelas !== f) return false;
    return !q || s.nama.indexOf(q) >= 0 || s.nisn.indexOf(q) >= 0 || (s.nis || '').indexOf(q) >= 0;
  });
}

window.renderSiswa = function () {
  if (!AppState.data) return;
  const classes = AppState.data.classes;
  const filter = document.getElementById('siswa-kelas-filter');
  const cur = filter.value || '__sel';
  filter.innerHTML = '<option value="__sel">Kelas terpilih (' + esc(AppState.selectedClass || '-') + ')</option><option value="__all">Semua kelas</option>' +
    classes.map(c => '<option value="' + esc(c) + '">Kelas ' + esc(c) + '</option>').join('');
  filter.value = Array.from(filter.options).some(o => o.value === cur) ? cur : '__sel';

  document.getElementById('siswa-kpi').innerHTML = classes.map(c => {
    const list = AppState.data.students.filter(s => s.kelas === c);
    const l = list.filter(s => s.jk === 'L').length, p = list.filter(s => s.jk === 'P').length;
    return '<div class="kpi-card' + (c === AppState.selectedClass ? ' warning' : '') + '" style="padding:14px;"><div class="kpi-title">Kelas ' + esc(c) + '</div>' +
      '<div class="kpi-value" style="font-size:22px;">' + list.length + '</div><div class="kpi-sub">L: ' + l + ' • P: ' + p + ' • ' + esc(getWali(c).nama) + '</div></div>';
  }).join('');

  const mapelCount = AppState.config.mapel_list.length;
  const list = siswaFilterList();
  document.getElementById('siswa-count').textContent = list.length + ' siswa';
  document.getElementById('siswa-table-body').innerHTML = list.length ? list.map((s, i) => {
    const filled = AppState.config.mapel_list.filter(m => s.grades[m.key] !== null).length;
    return '<tr><td class="center"><input type="checkbox" class="siswa-check" value="' + esc(s.nisn) + '"' + (siswaSelected.has(s.nisn) ? ' checked' : '') + '></td>' +
      '<td class="center">' + (s.no || i + 1) + '</td><td class="center" style="font-family:monospace;">' + esc(s.nisn) + '</td><td class="center">' + esc(s.nis || '-') + '</td>' +
      '<td><strong>' + esc(s.nama) + '</strong></td><td class="center">' + esc(s.kelas) + '</td><td class="center">' + esc(s.jk || '-') + '</td>' +
      '<td class="center"><span class="badge ' + (filled === mapelCount ? 'badge-success' : filled ? 'badge-warning' : 'badge-muted') + '">' + filled + '/' + mapelCount + '</span></td>' +
      '<td class="center"><button class="btn btn-sm btn-secondary" onclick="openSiswaForm(\'' + esc(s.nisn) + '\')">Ubah</button> ' +
      '<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="deleteSiswa(\'' + esc(s.nisn) + '\')">Hapus</button></td></tr>';
  }).join('') : '<tr><td colspan="9"><div class="empty-state"><strong>Belum ada data siswa</strong>Klik "+ Tambah Siswa" atau "Import Excel" (unduh Template Excel terlebih dahulu).</div></td></tr>';
  updateSiswaButtons();
};

function updateSiswaButtons() {
  const n = siswaSelected.size;
  const del = document.getElementById('btn-siswa-del-selected');
  const mv = document.getElementById('btn-siswa-move');
  del.disabled = !n;
  mv.disabled = !n;
  del.textContent = n ? 'Hapus Terpilih (' + n + ')' : 'Hapus Terpilih';
}

function kelasOptions(selected) {
  const classes = AppState.data.classes.slice();
  if (selected && classes.indexOf(selected) < 0) classes.push(selected);
  return classes.map(c => '<option' + (c === selected ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
}

window.openSiswaForm = function (nisn) {
  const s = nisn ? AppState.db.siswa.find(x => x.nisn === nisn) : null;
  const kelas = s ? s.kelas : AppState.selectedClass;
  const nextNo = AppState.db.siswa.filter(x => x.kelas === kelas).reduce((m, x) => Math.max(m, x.no || 0), 0) + 1;
  openModal(s ? 'Ubah Data Siswa' : 'Tambah Siswa',
    '<div class="grid-form">' +
    '<div class="form-group"><label>NISN *</label><input class="form-control" id="sf-nisn" inputmode="numeric" value="' + esc(s ? s.nisn : '') + '"' + (s ? ' readonly title="NISN adalah kunci data dan tidak dapat diubah"' : '') + '></div>' +
    '<div class="form-group"><label>NIS (opsional)</label><input class="form-control" id="sf-nis" value="' + esc(s ? s.nis : '') + '"></div>' +
    '</div>' +
    '<div class="form-group"><label>Nama Lengkap *</label><input class="form-control" id="sf-nama" value="' + esc(s ? s.nama : '') + '" style="text-transform:uppercase;"></div>' +
    '<div class="grid-form">' +
    '<div class="form-group"><label>Kelas *</label><input class="form-control" id="sf-kelas" list="sf-kelas-list" value="' + esc(kelas || '') + '"><datalist id="sf-kelas-list">' + kelasOptions() + '</datalist></div>' +
    '<div class="form-group"><label>Jenis Kelamin</label><select class="form-control" id="sf-jk"><option value="">-</option><option' + (s && s.jk === 'L' ? ' selected' : '') + '>L</option><option' + (s && s.jk === 'P' ? ' selected' : '') + '>P</option></select></div>' +
    '<div class="form-group"><label>No. Absen</label><input type="number" class="form-control" id="sf-no" value="' + esc(s ? (s.no || '') : nextNo) + '"></div>' +
    '</div>' +
    (s ? '<p class="muted">Untuk mengganti NISN: hapus siswa ini lalu tambahkan kembali dengan NISN baru.</p>' : '') +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="sf-save">Simpan ke Spreadsheet</button></div>');
  document.getElementById(s ? 'sf-nama' : 'sf-nisn').focus();
  document.getElementById('sf-save').onclick = async () => {
    const row = {
      nisn: document.getElementById('sf-nisn').value.trim(),
      nis: document.getElementById('sf-nis').value.trim(),
      nama: document.getElementById('sf-nama').value.trim().toUpperCase(),
      kelas: document.getElementById('sf-kelas').value.trim().toUpperCase(),
      jk: document.getElementById('sf-jk').value,
      no: C.num(document.getElementById('sf-no').value)
    };
    if (!row.nisn || !row.nama || !row.kelas) { C.toast('NISN, Nama, dan Kelas wajib diisi', 'warning'); return; }
    if (!s && AppState.db.siswa.some(x => x.nisn === row.nisn)) {
      const ex = AppState.db.siswa.find(x => x.nisn === row.nisn);
      if (!confirm('NISN ' + row.nisn + ' sudah dipakai oleh ' + ex.nama + ' (' + ex.kelas + '). Timpa data tersebut?')) return;
    }
    closeModal();
    await adminWrite('saveSiswa', { rows: [C.siswaToRow(row)] }, 'Data ' + row.nama + ' disimpan');
  };
};

async function removeSiswa(nisns) {
  if (!nisns.length) return;
  const names = nisns.map(n => (AppState.db.siswa.find(s => s.nisn === n) || {}).nama || n);
  if (!confirm('Hapus ' + nisns.length + ' siswa?\n\n' + names.slice(0, 10).join('\n') + (names.length > 10 ? '\n...' : ''))) return;
  const withNilai = confirm('Hapus juga NILAI & data pelengkap raport siswa tersebut?\n\nOK = hapus semua  •  Batal = hanya data siswa');
  const ok = await adminWrite('deleteSiswa', { ids: nisns, withNilai }, nisns.length + ' siswa dihapus');
  if (ok) siswaSelected.clear();
}

window.deleteSiswa = nisn => removeSiswa([nisn]);
window.deleteSelectedSiswa = () => removeSiswa(Array.from(siswaSelected));

window.openPindahKelas = function () {
  const n = siswaSelected.size;
  if (!n) return;
  openModal('Pindah Kelas (' + n + ' siswa)',
    '<div class="form-group"><label>Kelas tujuan</label><input class="form-control" id="pk-kelas" list="pk-list" placeholder="Contoh: 8A"><datalist id="pk-list">' + kelasOptions() + '</datalist></div>' +
    '<p class="muted">Gunakan untuk kenaikan kelas atau koreksi rombel. Nilai yang sudah ada tetap tersimpan.</p>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="pk-go">Pindahkan</button></div>');
  document.getElementById('pk-go').onclick = async () => {
    const k = document.getElementById('pk-kelas').value.trim().toUpperCase();
    if (!k) { C.toast('Isi kelas tujuan', 'warning'); return; }
    const rows = AppState.db.siswa.filter(s => siswaSelected.has(s.nisn)).map(s => C.siswaToRow(Object.assign({}, s, { kelas: k })));
    closeModal();
    const ok = await adminWrite('saveSiswa', { rows }, rows.length + ' siswa dipindah ke kelas ' + k);
    if (ok) siswaSelected.clear();
  };
};

window.renumberAbsen = async function () {
  const c = AppState.selectedClass;
  const list = AppState.db.siswa.filter(s => s.kelas === c).slice().sort((a, b) => a.nama.localeCompare(b.nama));
  if (!list.length || !confirm('Urutkan ulang nomor absen Kelas ' + c + ' berdasarkan abjad nama (A-Z)?')) return;
  await adminWrite('saveSiswa', { rows: list.map((s, i) => C.siswaToRow(Object.assign({}, s, { no: i + 1 }))) }, 'Nomor absen Kelas ' + c + ' diurutkan');
};

/* ===========================================================
   PELENGKAP RAPORT (Sikap, Ekskul, Kehadiran, Keputusan)
   =========================================================== */
let pelengkapEdits = {};

window.pelengkapDirty = () => Object.keys(pelengkapEdits).length > 0;

function pelOf(nisn) {
  return Object.assign({ nisn }, AppState.db.pelengkap[nisn] || {}, pelengkapEdits[nisn] || {});
}

const PEL_FIELDS = [
  { k: 'sp_pred', label: 'Spiritual: Predikat', w: 110, list: 'pred' },
  { k: 'sp_desk', label: 'Spiritual: Deskripsi', w: 230, area: true, def: 'sikap_spiritual_deskripsi' },
  { k: 'so_pred', label: 'Sosial: Predikat', w: 110, list: 'pred' },
  { k: 'so_desk', label: 'Sosial: Deskripsi', w: 230, area: true, def: 'sikap_sosial_deskripsi' },
  { k: 'ek1', label: 'Ekskul 1', w: 120, list: 'ekskul' },
  { k: 'ek1_nilai', label: 'Nilai', w: 90, list: 'pred' },
  { k: 'ek2', label: 'Ekskul 2', w: 120, list: 'ekskul' },
  { k: 'ek2_nilai', label: 'Nilai', w: 90, list: 'pred' },
  { k: 'sakit', label: 'S', w: 55, num: true },
  { k: 'izin', label: 'I', w: 55, num: true },
  { k: 'alpa', label: 'A', w: 55, num: true },
  { k: 'keputusan', label: 'Keputusan', w: 220, area: true, def: 'keputusan_default' },
  { k: 'catatan', label: 'Catatan Wali (opsional)', w: 200, area: true }
];

window.renderPelengkap = function () {
  if (!AppState.data) return;
  const cfg = AppState.config;
  const students = classStudents();
  const box = document.getElementById('pelengkap-container');
  if (!students.length) { box.innerHTML = '<div class="empty-state"><strong>Belum ada siswa di kelas ini</strong></div>'; return; }
  const ekskulNames = new Set(['OSIS', 'IBADAH', 'PRAMUKA', 'OLAHRAGA', 'PADUAN SUARA', 'SENI TARI']);
  Object.values(AppState.db.pelengkap).forEach(p => { if (p.ek1) ekskulNames.add(p.ek1); if (p.ek2) ekskulNames.add(p.ek2); });
  let html = '<datalist id="dl-pred"><option>Sangat Baik</option><option>Baik</option><option>Cukup</option><option>Kurang</option></datalist>' +
    '<datalist id="dl-ekskul">' + Array.from(ekskulNames).map(n => '<option>' + esc(n) + '</option>').join('') + '</datalist>' +
    '<table class="data-table"><thead><tr><th class="center" style="width:40px;">NO</th><th style="min-width:180px;">NAMA SISWA</th>' +
    PEL_FIELDS.map(f => '<th style="min-width:' + f.w + 'px;">' + esc(f.label) + '</th>').join('') + '</tr></thead><tbody>';
  students.forEach((s, i) => {
    const p = pelOf(s.nisn);
    const dirty = !!pelengkapEdits[s.nisn];
    html += '<tr data-nisn="' + esc(s.nisn) + '"' + (dirty ? ' class="cell-dirty"' : '') + '><td class="center">' + (s.no || i + 1) + '</td><td><strong>' + esc(s.nama) + '</strong></td>';
    PEL_FIELDS.forEach(f => {
      const v = p[f.k] || '';
      let ph = '';
      if (f.def) ph = String(cfg[f.def] || '').slice(0, 60) + '…';
      if (f.k === 'sp_pred') ph = cfg.sikap_spiritual_predikat;
      if (f.k === 'so_pred') ph = cfg.sikap_sosial_predikat;
      if (f.area) html += '<td><textarea class="form-control" rows="2" data-k="' + f.k + '" placeholder="' + esc(ph) + '">' + esc(v) + '</textarea></td>';
      else html += '<td><input class="form-control" data-k="' + f.k + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '"' +
        (f.list ? ' list="dl-' + f.list + '"' : '') + (f.num ? ' type="number" min="0"' : '') + '></td>';
    });
    html += '</tr>';
  });
  box.innerHTML = html + '</tbody></table><p class="muted" style="margin-top:10px;">Kolom yang dikosongkan akan memakai teks abu-abu (bawaan dari Pengaturan). Baris bergaris kuning = belum disimpan.</p>';
  updatePelengkapBtn();
};

function updatePelengkapBtn() {
  const n = Object.keys(pelengkapEdits).length;
  const b = document.getElementById('btn-pelengkap-save');
  b.textContent = n ? 'Simpan Perubahan (' + n + ' siswa)' : 'Simpan Perubahan';
  b.classList.toggle('btn-warning', n > 0);
}

window.savePelengkap = async function () {
  const rows = Object.keys(pelengkapEdits).map(nisn => C.pelengkapToRow(pelOf(nisn)));
  if (!rows.length) { C.toast('Tidak ada perubahan', 'info'); return; }
  const ok = await adminWrite('savePelengkap', { rows }, rows.length + ' data pelengkap raport disimpan');
  if (ok) { pelengkapEdits = {}; window.renderPelengkap(); }
};

window.openPelengkapMassal = function () {
  const cfg = AppState.config;
  const f = (id, label, ph, area) => '<div class="form-group"><label>' + label + '</label>' +
    (area ? '<textarea class="form-control" rows="2" id="pm-' + id + '" placeholder="' + esc(ph || '') + '"></textarea>' : '<input class="form-control" id="pm-' + id + '" placeholder="' + esc(ph || '') + '">') + '</div>';
  openModal('Isi Massal - Kelas ' + AppState.selectedClass,
    '<p class="muted" style="margin-bottom:12px;">Isi hanya kolom yang ingin diterapkan ke seluruh siswa. Kolom kosong diabaikan.</p>' +
    '<div class="grid-form">' + f('sp_pred', 'Sikap Spiritual: Predikat', cfg.sikap_spiritual_predikat) + f('so_pred', 'Sikap Sosial: Predikat', cfg.sikap_sosial_predikat) + '</div>' +
    f('sp_desk', 'Sikap Spiritual: Deskripsi', '', true) + f('so_desk', 'Sikap Sosial: Deskripsi', '', true) +
    '<div class="grid-form">' + f('ek1', 'Ekskul 1', 'Contoh: OSIS') + f('ek1_nilai', 'Nilai Ekskul 1', 'Baik') + f('ek2', 'Ekskul 2', 'Contoh: IBADAH') + f('ek2_nilai', 'Nilai Ekskul 2', 'Baik') + '</div>' +
    f('keputusan', 'Keputusan', '', true) +
    '<div class="form-group"><label>Terapkan ke</label><select class="form-control" id="pm-target"><option value="empty">Hanya kolom yang masih kosong</option><option value="all">Semua siswa (timpa)</option></select></div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="pm-go">Terapkan</button></div>', true);
  document.getElementById('pm-go').onclick = () => {
    const keys = ['sp_pred', 'sp_desk', 'so_pred', 'so_desk', 'ek1', 'ek1_nilai', 'ek2', 'ek2_nilai', 'keputusan'];
    const vals = {};
    keys.forEach(k => { const v = document.getElementById('pm-' + k).value.trim(); if (v) vals[k] = v; });
    if (!Object.keys(vals).length) { C.toast('Isi minimal satu kolom', 'warning'); return; }
    const all = document.getElementById('pm-target').value === 'all';
    let n = 0;
    classStudents().forEach(s => {
      const p = pelOf(s.nisn);
      const patch = {};
      Object.keys(vals).forEach(k => { if (all || !p[k]) patch[k] = vals[k]; });
      if (Object.keys(patch).length) { pelengkapEdits[s.nisn] = Object.assign({}, pelengkapEdits[s.nisn] || {}, patch); n++; }
    });
    closeModal();
    window.renderPelengkap();
    C.toast('Diterapkan ke ' + n + ' siswa. Klik "Simpan Perubahan" untuk mengirim ke spreadsheet.', 'success');
  };
};

/* ===========================================================
   BANK DESKRIPSI
   =========================================================== */
function deskUsage() {
  const u = {};
  Object.values(AppState.db.nilai).forEach(n => {
    [n.kuasai, n.tingkatkan].forEach(t => { if (t) { const k = n.kode + '|' + t; u[k] = (u[k] || 0) + 1; } });
  });
  return u;
}

window.renderDeskripsiAdmin = function () {
  if (!AppState.db) return;
  const mapel = C.activeMapel(AppState.db);
  const sel = document.getElementById('desk-mapel-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="all">Semua mapel</option>' + mapel.map(m => {
    const n = AppState.db.deskripsi.filter(d => d.kode === m.kode).length;
    return '<option value="' + esc(m.kode) + '">' + esc(m.nama) + ' (' + n + ')</option>';
  }).join('');
  sel.value = Array.from(sel.options).some(o => o.value === cur) ? cur : (mapel[0] ? mapel[0].kode : 'all');

  const kode = sel.value;
  const t = document.getElementById('desk-tingkat-filter').value;
  const q = document.getElementById('desk-search').value.trim().toLowerCase();
  const usage = deskUsage();
  const list = AppState.db.deskripsi
    .filter(d => kode === 'all' || d.kode === kode)
    .filter(d => t === 'all' || d.tingkat === t)
    .filter(d => !q || d.teks.toLowerCase().indexOf(q) >= 0 || (d.oleh || '').toLowerCase().indexOf(q) >= 0)
    .sort((a, b) => a.kode.localeCompare(b.kode) || a.teks.localeCompare(b.teks));
  document.getElementById('desk-count').textContent = list.length + ' deskripsi';
  document.getElementById('desk-table-body').innerHTML = list.length ? list.map((d, i) => {
    const used = usage[d.kode + '|' + d.teks] || 0;
    return '<tr><td class="center">' + (i + 1) + '</td><td>' + (kode === 'all' ? '<span class="badge badge-primary" style="margin-right:6px;">' + esc(d.kode) + '</span>' : '') + esc(d.teks) + '</td>' +
      '<td class="center">' + (d.tingkat === 'Semua' ? 'Semua' : 'Kelas ' + esc(d.tingkat)) + '</td><td>' + esc(d.oleh || '-') + '<div class="muted" style="font-size:11px;">' + C.fmtDateTime(d.updated) + '</div></td>' +
      '<td class="center">' + (used ? '<span class="badge badge-success">' + used + 'x</span>' : '<span class="badge badge-muted">0</span>') + '</td>' +
      '<td class="center"><button class="btn btn-sm btn-secondary" onclick="openDeskForm(\'' + esc(d.id) + '\')">Ubah</button> ' +
      '<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="deleteDesk(\'' + esc(d.id) + '\')">Hapus</button></td></tr>';
  }).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>Belum ada deskripsi</strong>Tambahkan deskripsi agar guru bisa memilih saat input nilai.</div></td></tr>';
};

window.openDeskForm = function (id) {
  const d = id ? AppState.db.deskripsi.find(x => x.id === id) : null;
  const mapel = C.activeMapel(AppState.db);
  const curKode = d ? d.kode : (document.getElementById('desk-mapel-filter').value !== 'all' ? document.getElementById('desk-mapel-filter').value : (mapel[0] || {}).kode);
  openModal(d ? 'Ubah Deskripsi' : 'Tambah Deskripsi',
    '<div class="grid-form"><div class="form-group"><label>Mata Pelajaran</label><select class="form-control" id="df-kode">' +
    mapel.map(m => '<option value="' + esc(m.kode) + '"' + (m.kode === curKode ? ' selected' : '') + '>' + esc(m.nama) + '</option>').join('') + '</select></div>' +
    '<div class="form-group"><label>Berlaku untuk</label><select class="form-control" id="df-ting">' +
    ['Semua', '7', '8', '9'].map(t => '<option value="' + t + '"' + (d && d.tingkat === t ? ' selected' : '') + '>' + (t === 'Semua' ? 'Semua tingkat' : 'Kelas ' + t) + '</option>').join('') + '</select></div></div>' +
    '<div class="form-group"><label>Teks deskripsi' + (d ? '' : ' (satu baris = satu deskripsi, bisa banyak sekaligus)') + '</label>' +
    '<textarea class="form-control" id="df-teks" rows="' + (d ? 3 : 7) + '" placeholder="Contoh: Menyelesaikan operasi hitung bilangan bulat">' + esc(d ? d.teks : '') + '</textarea></div>' +
    '<p class="muted">Tulis kompetensinya saja. Kalimat raport otomatis: <i>' + esc(C.buildDeskripsi('NAMA SISWA', 85, 'Kompetensi A', 'Kompetensi B', AppState.config)) + '</i></p>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Batal</button><button class="btn btn-primary" id="df-save">Simpan</button></div>', true);
  document.getElementById('df-save').onclick = async () => {
    const kode = document.getElementById('df-kode').value;
    const tingkat = document.getElementById('df-ting').value;
    const lines = document.getElementById('df-teks').value.split('\n').map(s => C.trimDot(s)).filter(Boolean);
    if (!lines.length) { C.toast('Teks masih kosong', 'warning'); return; }
    const exist = new Set(AppState.db.deskripsi.filter(x => x.kode === kode && (!d || x.id !== d.id)).map(x => x.teks.toLowerCase()));
    const rows = [];
    lines.forEach((teks, i) => {
      if (exist.has(teks.toLowerCase())) return;
      rows.push(C.deskToRow(d && i === 0 ? Object.assign({}, d, { kode, tingkat, teks, updated: C.nowIso() }) : { id: C.uid('D'), kode, tingkat, teks, oleh: 'Admin', updated: C.nowIso() }));
    });
    if (!rows.length) { C.toast('Deskripsi sudah ada', 'warning'); return; }
    closeModal();
    await adminWrite('saveDeskripsi', { rows }, rows.length + ' deskripsi disimpan');
  };
};

window.deleteDesk = async function (id) {
  const d = AppState.db.deskripsi.find(x => x.id === id);
  if (!d || !confirm('Hapus deskripsi ini?\n\n"' + d.teks + '"\n\nNilai yang sudah memakai deskripsi ini tidak berubah.')) return;
  await adminWrite('deleteDeskripsi', { ids: [id] }, 'Deskripsi dihapus');
};

/* ===========================================================
   LOG AKTIVITAS
   =========================================================== */
let logRows = null;

window.loadLog = async function (fromTab) {
  if (fromTab && logRows) { renderLog(); return; }
  const tbody = document.getElementById('log-table-body');
  if (!C.isDemo() && !C.isOnline()) { tbody.innerHTML = '<tr><td colspan="5" class="center muted">Log hanya dapat dimuat saat online.</td></tr>'; return; }
  tbody.innerHTML = '<tr><td colspan="5" class="center muted">Memuat log...</td></tr>';
  try {
    logRows = await C.api('getLog', { limit: 500 });
    renderLog();
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="center" style="color:var(--danger);">Gagal memuat log: ' + esc(e.message) + '</td></tr>';
  }
};

function renderLog() {
  const q = (document.getElementById('log-search').value || '').toLowerCase();
  const rows = (logRows || []).filter(r => !q || JSON.stringify(r).toLowerCase().indexOf(q) >= 0);
  document.getElementById('log-table-body').innerHTML = rows.length ? rows.map(r =>
    '<tr><td>' + C.fmtDateTime(r.Waktu) + '</td><td><strong>' + esc(r.Pengguna) + '</strong></td><td><span class="badge ' + (r.Peran === 'admin' ? 'badge-primary' : 'badge-success') + '">' + esc(r.Peran) + '</span></td>' +
    '<td>' + esc(r.Aksi) + '</td><td style="font-size:12.5px;">' + esc(r.Detail) + '</td></tr>').join('')
    : '<tr><td colspan="5" class="center muted">Belum ada aktivitas.</td></tr>';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('siswa-search').addEventListener('input', () => window.renderSiswa());
  document.getElementById('siswa-kelas-filter').addEventListener('change', () => window.renderSiswa());
  document.getElementById('siswa-table-body').addEventListener('change', e => {
    if (!e.target.classList.contains('siswa-check')) return;
    if (e.target.checked) siswaSelected.add(e.target.value); else siswaSelected.delete(e.target.value);
    updateSiswaButtons();
  });
  document.getElementById('siswa-check-all').addEventListener('change', e => {
    siswaFilterList().forEach(s => { if (e.target.checked) siswaSelected.add(s.nisn); else siswaSelected.delete(s.nisn); });
    window.renderSiswa();
  });

  const pc = document.getElementById('pelengkap-container');
  const onPel = e => {
    const k = e.target.dataset.k;
    const tr = e.target.closest('tr[data-nisn]');
    if (!k || !tr) return;
    const nisn = tr.dataset.nisn;
    pelengkapEdits[nisn] = Object.assign({}, pelengkapEdits[nisn] || {});
    pelengkapEdits[nisn][k] = e.target.value.trim();
    tr.classList.add('cell-dirty');
    updatePelengkapBtn();
  };
  pc.addEventListener('change', onPel);

  ['desk-mapel-filter', 'desk-tingkat-filter'].forEach(id => document.getElementById(id).addEventListener('change', () => window.renderDeskripsiAdmin()));
  document.getElementById('desk-search').addEventListener('input', () => window.renderDeskripsiAdmin());
  document.getElementById('log-search').addEventListener('input', renderLog);

  window.addEventListener('beforeunload', e => {
    if (window.pelengkapDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
});
