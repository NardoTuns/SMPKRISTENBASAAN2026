/**
 * Admin: Pengaturan sekolah, judul & periode laporan, predikat, kepala sekolah,
 * kelas & wali kelas, mata pelajaran & KKM.
 * SMP KRISTEN 65 BASAAN
 */

const CFG_FIELDS = {
  'cfg-yayasan': 'yayasan',
  'cfg-bidang': 'bidang',
  'cfg-nama-sekolah': 'nama_sekolah',
  'cfg-alamat': 'alamat',
  'cfg-judul-laporan': 'judul_laporan',
  'cfg-subjudul': 'subjudul',
  'cfg-semester': 'semester',
  'cfg-tahun-ajaran': 'tahun_ajaran',
  'cfg-tempat-raport': 'tempat_raport',
  'cfg-tanggal-raport': 'tanggal_raport',
  'cfg-predikat-a': 'predikat_a',
  'cfg-predikat-b': 'predikat_b',
  'cfg-predikat-c': 'predikat_c',
  'cfg-kata-a': 'kata_a',
  'cfg-kata-b': 'kata_b',
  'cfg-kata-c': 'kata_c',
  'cfg-kata-d': 'kata_d',
  'cfg-kepsek': 'kepala_sekolah',
  'cfg-nip-kepsek': 'nip_kepala_sekolah'
};

const CFG_CHECKS = {
  'cfg-tampilkan-ket': 'tampilkan_keterangan'
};

window.loadSettingsForm = function () {
  const cfg = AppState.db.config;
  Object.keys(CFG_FIELDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = cfg[CFG_FIELDS[id]] === undefined || cfg[CFG_FIELDS[id]] === null ? '' : cfg[CFG_FIELDS[id]];
  });
  Object.keys(CFG_CHECKS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = cfg[CFG_CHECKS[id]] !== false;
  });
  renderKelasEditor(AppState.db.kelas.map(k => Object.assign({}, k)));
  renderMapelEditor(AppState.db.mapel.map(m => Object.assign({}, m)));
};

function readConfigForm() {
  const out = {};
  Object.keys(CFG_FIELDS).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    let v = el.value.trim();
    if (el.type === 'number') v = C.num(v);
    out[CFG_FIELDS[id]] = v;
  });
  Object.keys(CFG_CHECKS).forEach(id => {
    const el = document.getElementById(id);
    if (el) out[CFG_CHECKS[id]] = el.checked;
  });
  return out;
}

/* ---------- Kelas ---------- */
function renderKelasEditor(rows) {
  document.getElementById('kelas-edit-body').innerHTML = rows.map((k, i) => '<tr>' +
    '<td><input class="form-control" data-f="kelas" value="' + esc(k.kelas) + '" placeholder="7A"></td>' +
    '<td><input class="form-control" data-f="label" value="' + esc(k.label) + '" placeholder="VII"></td>' +
    '<td><input class="form-control" data-f="wali" value="' + esc(k.wali) + '" placeholder="Nama wali kelas, gelar"></td>' +
    '<td><input class="form-control" data-f="nip" value="' + esc(k.nip) + '" placeholder="-"></td>' +
    '<td><input class="form-control" type="number" data-f="urut" value="' + esc(k.urut === 99 ? i + 1 : k.urut) + '"></td>' +
    '<td class="center"><button type="button" class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="this.closest(\'tr\').remove()" title="Hapus kelas">✕</button></td></tr>').join('');
}

function readKelasEditor() {
  return Array.from(document.querySelectorAll('#kelas-edit-body tr')).map(tr => {
    const g = f => tr.querySelector('[data-f="' + f + '"]').value.trim();
    const kelas = g('kelas').toUpperCase().replace(/\s+/g, '');
    return { kelas, label: g('label') || C.romawi(C.tingkatOf(kelas)), wali: g('wali'), nip: g('nip'), urut: C.num(g('urut')) || 99 };
  }).filter(k => k.kelas);
}

window.addKelasRow = function () {
  const rows = readKelasEditor();
  rows.push({ kelas: '', label: '', wali: '', nip: '', urut: rows.length + 1 });
  renderKelasEditor(rows);
};

/* ---------- Mapel ---------- */
function renderMapelEditor(rows) {
  document.getElementById('mapel-edit-body').innerHTML = rows.map((m, i) => '<tr>' +
    '<td><input class="form-control" data-f="kode" value="' + esc(m.kode) + '" placeholder="MTK" style="text-transform:uppercase;"></td>' +
    '<td><input class="form-control" data-f="nama" value="' + esc(m.nama) + '" placeholder="Matematika"></td>' +
    '<td><select class="form-control" data-f="kelompok">' + ['A', 'B', 'C'].map(g => '<option' + (m.kelompok === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></td>' +
    '<td><input class="form-control" type="number" data-f="kkm" value="' + esc(m.kkm) + '"></td>' +
    '<td><input class="form-control" type="number" data-f="urut" value="' + esc(m.urut === 99 ? i + 1 : m.urut) + '"></td>' +
    '<td class="center"><input type="checkbox" data-f="aktif"' + (m.aktif !== false ? ' checked' : '') + '></td>' +
    '<td class="center"><button type="button" class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="this.closest(\'tr\').remove()" title="Hapus mapel">✕</button></td></tr>').join('');
}

function readMapelEditor() {
  return Array.from(document.querySelectorAll('#mapel-edit-body tr')).map(tr => {
    const g = f => tr.querySelector('[data-f="' + f + '"]');
    return {
      kode: g('kode').value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, ''),
      nama: g('nama').value.trim(), kelompok: g('kelompok').value,
      kkm: C.num(g('kkm').value) || 75, urut: C.num(g('urut').value) || 99, aktif: g('aktif').checked
    };
  }).filter(m => m.kode && m.nama);
}

window.addMapelRow = function () {
  const rows = readMapelEditor();
  rows.push({ kode: '', nama: '', kelompok: 'B', kkm: 75, urut: rows.length + 1, aktif: true });
  renderMapelEditor(rows);
};

/* ---------- Simpan ---------- */
window.saveSettings = async function (e) {
  if (e) e.preventDefault();
  if (!canWrite()) return;
  const cfg = readConfigForm();
  cfg.tema_raport = AppState.db.config.tema_raport;
  const kelas = readKelasEditor();
  const mapel = readMapelEditor();

  if (!(cfg.predikat_a > cfg.predikat_b && cfg.predikat_b > cfg.predikat_c)) { C.toast('Batas predikat harus A > B > C', 'warning'); return; }
  const dupK = kelas.map(k => k.kelas).filter((k, i, a) => a.indexOf(k) !== i);
  const dupM = mapel.map(m => m.kode).filter((k, i, a) => a.indexOf(k) !== i);
  if (dupK.length) { C.toast('Kelas ganda: ' + dupK.join(', '), 'warning'); return; }
  if (dupM.length) { C.toast('Kode mapel ganda: ' + dupM.join(', '), 'warning'); return; }
  if (!mapel.length) { C.toast('Minimal harus ada 1 mata pelajaran', 'warning'); return; }

  const used = new Set(Object.values(AppState.db.nilai).map(n => n.kode));
  const removed = AppState.db.mapel.filter(m => !mapel.some(x => x.kode === m.kode) && used.has(m.kode));
  if (removed.length && !confirm('Mapel berikut dihapus/diganti kodenya padahal sudah memiliki nilai:\n' + removed.map(m => m.kode + ' - ' + m.nama).join('\n') +
    '\n\nNilainya tidak ikut terhapus, tetapi tidak akan tampil di raport. Lanjutkan?')) return;
  const kelasUsed = new Set(AppState.db.siswa.map(s => s.kelas));
  const kelasRemoved = AppState.db.kelas.filter(k => !kelas.some(x => x.kelas === k.kelas) && kelasUsed.has(k.kelas));
  if (kelasRemoved.length && !confirm('Kelas ' + kelasRemoved.map(k => k.kelas).join(', ') + ' masih memiliki siswa. Tetap hapus dari daftar kelas?')) return;

  loading(true, 'Menyimpan pengaturan ke spreadsheet...');
  try {
    await C.api('saveConfig', { config: cfg });
    await C.api('saveKelas', { rows: kelas.map(C.kelasToRow) });
    await C.api('saveMapel', { rows: mapel.map(C.mapelToRow) });
    const res = await C.fetchDB();
    AppState.db = res.db;
    rebuildState();
    initializeUI();
    C.toast('Seluruh pengaturan tersimpan', 'success');
  } catch (err) {
    C.toast('Gagal menyimpan: ' + err.message, 'error');
  } finally {
    loading(false);
  }
};
