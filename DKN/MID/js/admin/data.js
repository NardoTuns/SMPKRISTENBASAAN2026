/**
 * Admin: Data Siswa & Log Aktivitas
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
  const withNilai = confirm('Hapus juga NILAI siswa tersebut?\n\nOK = hapus semua  •  Batal = hanya data siswa');
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

  document.getElementById('log-search').addEventListener('input', renderLog);
});
