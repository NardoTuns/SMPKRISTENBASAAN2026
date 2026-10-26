// Kelola data master: aturan (jenis/kategori/tahap), siswa, pengguna, dan pengaturan sekolah.
import { h, icon, btn, select, sheet, toast, confirmDialog, dialog, pickFile, downloadText } from '../ui/dom.js';
import { emptyState, pageHead, tingkatBadge, levelBadge, showMore, avatar } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { S, D, me, saveRow, saveRows, deleteRow, saveSettingsMap, isPending } from '../store.js';
import { callAuthed, syncNow } from '../sync.js';
import { canAdmin, canRules, canSiswa } from '../core/perm.js';
import { ROLES, STATUS_SISWA, SURAT, TINGKAT, WARNA, SETTING_INFO } from '../core/rules.js';
import { cmpKelas, cmpNama, debounce, fmtNum, matches, norm, parseTable, toCSV, uid } from '../core/util.js';

// Formulir pengaturan tidak digambar ulang saat sinkron agar isian yang belum disimpan tidak hilang.
let curTab = '';
export const meta = { title: 'Kelola', live: () => curTab !== 'pengaturan' };

const TABS = [
  { kode: 'jenis', label: 'Jenis Pelanggaran', ic: 'list', can: canRules },
  { kode: 'kategori', label: 'Kategori', ic: 'grid', can: canRules },
  { kode: 'tahap', label: 'Tahap Sanksi', ic: 'alert', can: canRules },
  { kode: 'siswa', label: 'Siswa', ic: 'users', can: canSiswa },
  { kode: 'pengguna', label: 'Pengguna', ic: 'key', can: canAdmin },
  { kode: 'pengaturan', label: 'Pengaturan', ic: 'settings', can: canAdmin },
];

export function render(view, route) {
  const u = me();
  if (!u) { view.append(emptyState('lock', 'Masuk terlebih dahulu', 'Menu kelola untuk Admin, Kepala Sekolah, dan Guru BK.', btn('Masuk', () => go('login', { next: 'kelola' }), { kind: 'primary', ic: 'login' }))); return; }
  const tabs = TABS.filter((t) => t.can(u));
  if (!tabs.length) { view.append(emptyState('lock', 'Tidak ada akses', 'Akun Anda tidak memiliki hak mengelola data. Hubungi Admin.')); return; }
  const tab = tabs.find((t) => t.kode === route.parts[1]) || tabs[0];
  curTab = tab.kode;
  view.append(pageHead('Kelola Data', `Masuk sebagai ${u.nama} (${u.peran})`));
  view.append(h('nav', { class: 'tabs', role: 'tablist' }, ...tabs.map((t) => h('a', { href: `#/kelola/${t.kode}`, role: 'tab', class: t.kode === tab.kode ? 'on' : '', 'aria-selected': String(t.kode === tab.kode) }, icon(t.ic), h('span', { text: t.label })))));
  if (S.demo) view.append(h('div', { class: 'notice info sm' }, icon('info'), h('p', { class: 'small', text: 'Mode Demo: perubahan hanya tersimpan di perangkat ini.' })));
  const body = h('div', { class: 'tab-body' });
  view.append(body);
  ({ jenis: tabJenis, kategori: tabKategori, tahap: tabTahap, siswa: tabSiswa, pengguna: tabPengguna, pengaturan: tabPengaturan })[tab.kode](body, route.query);
}

const fld = (label, control, hint) => h('label', { class: 'field' }, h('span', { class: 'lbl', text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null);
const sw = (label, checked, onchange) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }), h('span', { text: label }));
const usedCount = (field, key) => S.d.pelanggaran.filter((r) => String(r[field]) === String(key)).length;

// ================================================================== JENIS PELANGGARAN
let jq = '', jkat = '', jnon = false;
function tabJenis(body) {
  const d = D();
  const head = h('div', { class: 'filters' },
    h('label', { class: 'fsel search' }, icon('search'), h('input', { type: 'search', placeholder: 'Cari…', value: jq, 'aria-label': 'Cari jenis', oninput: debounce((e) => { jq = e.target.value; draw(); }, 150) })),
    h('label', { class: 'fsel' }, icon('grid'), select([{ value: '', label: 'Semua kategori' }, ...d.kategori.map((k) => ({ value: k.kode, label: `${k.kode}. ${k.nama}` }))], jkat, (v) => { jkat = v; draw(); })),
    sw('Tampilkan nonaktif', jnon, (v) => { jnon = v; draw(); }),
    btn('Tambah jenis', () => jenisForm(null), { kind: 'primary', ic: 'plus' }));
  const list = h('div');
  body.append(h('p', { class: 'muted small', text: 'Mengubah poin hanya berlaku untuk catatan baru; catatan lama tetap memakai poin saat dicatat. Jenis yang sudah dipakai tidak bisa dihapus — nonaktifkan saja.' }), head, list);
  function draw() {
    const items = d.jenis.filter((j) => (jnon || j.aktif !== false) && (!jkat || j.kategori === jkat) && (!jq || matches(jq, j.kode, j.uraian)));
    list.replaceChildren(...d.kategori.filter((k) => items.some((j) => j.kategori === k.kode)).map((k) => h('section', { class: 'card flush' },
      h('div', { class: 'group-head' }, h('span', { class: 'rule-kat', text: k.kode }), h('strong', { class: 'grow', text: k.nama })),
      h('div', { class: 'list' }, ...items.filter((j) => j.kategori === k.kode).map((j) => h('button', { class: 'row-item' + (j.aktif === false ? ' dim' : ''), type: 'button', onclick: () => jenisForm(j) },
        h('span', { class: 'rule-no', text: j.kode }),
        h('span', { class: 'grow min0' }, h('span', { class: 'row-title wrap', text: j.uraian }),
          h('span', { class: 'row gap-sm wrap' }, tingkatBadge(j.tingkat), j.zt ? h('span', { class: 'badge sm st-dark', text: 'Zero Tolerance' }) : null, j.aktif === false ? h('span', { class: 'badge sm st-dark', text: 'Nonaktif' }) : null,
            h('span', { class: 'muted small', text: `${usedCount('jenisKode', j.kode)}× dipakai` }), isPending('jenis', String(j.kode)) ? h('span', { class: 'badge sm st-warn', text: 'belum tersinkron' }) : null)),
        h('strong', { class: 'rule-pts', text: j.zt ? '100' : `${j.poin}${j.poinMaks ? '–' + j.poinMaks : ''}` }))))))
      .concat(items.length ? [] : [emptyState('search', 'Tidak ada jenis pelanggaran', '')]));
  }
  draw();
}

function jenisForm(j) {
  const d = D();
  const isNew = !j;
  const nextKode = String(Math.max(0, ...S.d.jenis.map((x) => Number(x.kode) || 0)) + 1);
  const f = j ? { ...j } : { kode: nextKode, kategori: d.kategori[0]?.kode || 'A', uraian: '', poin: 5, poinMaks: '', tingkat: 'Ringan', zt: false, aktif: true, urutan: Number(nextKode) || 99 };
  const used = j ? usedCount('jenisKode', j.kode) : 0;
  sheet((b, close) => {
    const ura = h('textarea', { rows: 3, oninput: (e) => { f.uraian = e.target.value; } });
    ura.value = f.uraian;
    b.append(
      h('div', { class: 'form-row' },
        fld('Kode', h('input', { type: 'text', value: f.kode, disabled: !isNew, maxlength: 12, oninput: (e) => { f.kode = e.target.value.trim(); } }), isNew ? 'Nomor/kode unik, tidak bisa diubah' : 'Kode tidak bisa diubah'),
        fld('Kategori', select(d.kategori.map((k) => ({ value: k.kode, label: `${k.kode}. ${k.nama}` })), f.kategori, (v) => { f.kategori = v; }))),
      fld('Bentuk pelanggaran', ura),
      h('div', { class: 'form-row' },
        fld('Poin', h('input', { type: 'number', min: 0, max: 100, value: f.poin, inputmode: 'numeric', oninput: (e) => { f.poin = e.target.value; } })),
        fld('Poin maks (opsional)', h('input', { type: 'number', min: 0, max: 100, value: f.poinMaks, inputmode: 'numeric', oninput: (e) => { f.poinMaks = e.target.value; } }), 'Isi bila poin berupa rentang, mis. 90–100'),
        fld('Tingkat', select(TINGKAT, f.tingkat, (v) => { f.tingkat = v; }))),
      h('div', { class: 'form-row' }, fld('Urutan', h('input', { type: 'number', value: f.urutan, oninput: (e) => { f.urutan = e.target.value; } }))),
      sw('Zero Tolerance (langsung 100 poin)', !!f.zt, (v) => { f.zt = v; }),
      sw('Aktif (bisa dipilih saat mencatat)', f.aktif !== false, (v) => { f.aktif = v; }),
      used ? h('p', { class: 'muted small', text: `Sudah dipakai di ${used} catatan.` }) : null,
      h('div', { class: 'sheet-actions' },
        btn('Simpan', async () => {
          const err = validJenis(f, isNew);
          if (err) return toast(err);
          await saveRow('jenis', { ...f, kode: String(f.kode), poin: f.zt ? 100 : Number(f.poin), poinMaks: f.zt || f.poinMaks === '' || Number(f.poinMaks) === Number(f.poin) ? '' : Number(f.poinMaks), urutan: Number(f.urutan) || 0, uraian: f.uraian.trim() });
          toast('Jenis pelanggaran tersimpan.'); close();
        }, { kind: 'primary', ic: 'check' }),
        !isNew && !used ? btn('Hapus', async () => {
          if (!(await confirmDialog('Hapus jenis pelanggaran?', `${j.kode}. ${j.uraian}`, 'Hapus', 'danger'))) return;
          await deleteRow('jenis', String(j.kode)); toast('Dihapus.'); close();
        }, { kind: 'danger-tonal', ic: 'trash' }) : null));
  }, { title: isNew ? 'Tambah jenis pelanggaran' : `Ubah jenis ${j.kode}` });
}

function validJenis(f, isNew) {
  if (!/^[A-Za-z0-9._-]{1,12}$/.test(String(f.kode))) return 'Kode 1–12 karakter (huruf/angka).';
  if (isNew && S.d.jenis.some((x) => String(x.kode) === String(f.kode))) return `Kode ${f.kode} sudah dipakai.`;
  if (!f.uraian.trim()) return 'Bentuk pelanggaran wajib diisi.';
  const p = Number(f.poin);
  if (!f.zt && (isNaN(p) || p < 0 || p > 100)) return 'Poin harus 0–100.';
  if (!f.zt && f.poinMaks !== '' && (Number(f.poinMaks) < p || Number(f.poinMaks) > 100)) return 'Poin maks harus ≥ poin dan ≤ 100.';
  return '';
}

// ================================================================== KATEGORI
function tabKategori(body) {
  const d = D();
  body.append(h('div', { class: 'filters' }, btn('Tambah kategori', () => katForm(null), { kind: 'primary', ic: 'plus' })),
    h('section', { class: 'card flush' }, h('div', { class: 'list' }, ...d.kategori.map((k) => h('button', { class: 'row-item' + (k.aktif === false ? ' dim' : ''), type: 'button', onclick: () => katForm(k) },
      h('span', { class: 'rule-kat', text: k.kode }), h('span', { class: 'grow', text: k.nama }),
      h('span', { class: 'muted small', text: `${S.d.jenis.filter((j) => j.kategori === k.kode).length} jenis` }), k.aktif === false ? h('span', { class: 'badge sm st-dark', text: 'Nonaktif' }) : null)))));
}
function katForm(k) {
  const isNew = !k;
  const f = k ? { ...k } : { kode: '', nama: '', urutan: S.d.kategori.length + 1, aktif: true };
  const usedBy = k ? S.d.jenis.filter((j) => j.kategori === k.kode).length : 0;
  sheet((b, close) => {
    b.append(
      h('div', { class: 'form-row' },
        fld('Kode', h('input', { type: 'text', value: f.kode, maxlength: 6, disabled: !isNew, oninput: (e) => { f.kode = e.target.value.trim().toUpperCase(); } }), 'Mis. G'),
        fld('Urutan', h('input', { type: 'number', value: f.urutan, oninput: (e) => { f.urutan = e.target.value; } }))),
      fld('Nama kategori', h('input', { type: 'text', value: f.nama, oninput: (e) => { f.nama = e.target.value; } })),
      sw('Aktif', f.aktif !== false, (v) => { f.aktif = v; }),
      h('div', { class: 'sheet-actions' },
        btn('Simpan', async () => {
          if (!/^[A-Za-z0-9]{1,6}$/.test(f.kode)) return toast('Kode 1–6 huruf/angka.');
          if (isNew && S.d.kategori.some((x) => x.kode === f.kode)) return toast('Kode sudah dipakai.');
          if (!f.nama.trim()) return toast('Nama wajib diisi.');
          await saveRow('kategori', { ...f, nama: f.nama.trim(), urutan: Number(f.urutan) || 0 }); toast('Kategori tersimpan.'); close();
        }, { kind: 'primary', ic: 'check' }),
        !isNew && !usedBy ? btn('Hapus', async () => { if (await confirmDialog('Hapus kategori?', k.nama, 'Hapus', 'danger')) { await deleteRow('kategori', k.kode); close(); } }, { kind: 'danger-tonal', ic: 'trash' }) : null));
  }, { title: isNew ? 'Tambah kategori' : `Ubah kategori ${k.kode}` });
}

// ================================================================== TAHAP SANKSI
function tabTahap(body) {
  const d = D();
  body.append(h('p', { class: 'muted small', text: 'Tahap ditentukan dari batas bawah poin. Perubahan langsung memengaruhi tahap semua siswa (dihitung ulang dari akumulasi poin).' }),
    h('div', { class: 'filters' }, btn('Tambah tahap', () => tahapForm(null), { kind: 'primary', ic: 'plus' })),
    h('section', { class: 'card flush' }, h('div', { class: 'list' }, ...d.levels.map((l, i) => h('button', { class: 'row-item', type: 'button', onclick: () => tahapForm(l) },
      h('span', { class: 'ladder-range' }, h('strong', { text: `${l.min}${d.levels[i + 1] ? '–' + (d.levels[i + 1].min - 1) : '+'}` })),
      h('span', { class: 'grow min0' }, levelBadge(l, { small: true }), h('span', { class: 'muted small wrap', text: ` ${l.tindakan}` })),
      h('span', { class: 'muted small', text: l.surat || 'tanpa surat' }))))));
}
function tahapForm(l) {
  const isNew = !l;
  const f = l ? { ...l } : { kode: '', min: 0, label: '', tindakan: '', pj: '', surat: '', warna: 'warn' };
  sheet((b, close) => {
    const tind = h('textarea', { rows: 3, oninput: (e) => { f.tindakan = e.target.value; } });
    tind.value = f.tindakan;
    b.append(
      h('div', { class: 'form-row' },
        fld('Kode', h('input', { type: 'text', value: f.kode, maxlength: 12, disabled: !isNew, oninput: (e) => { f.kode = e.target.value.trim().toUpperCase(); } })),
        fld('Poin minimal', h('input', { type: 'number', min: 1, value: f.min, oninput: (e) => { f.min = e.target.value; } }))),
      fld('Nama tahap', h('input', { type: 'text', value: f.label, oninput: (e) => { f.label = e.target.value; } })),
      fld('Tindakan', tind),
      fld('Penanggung jawab', h('input', { type: 'text', value: f.pj, oninput: (e) => { f.pj = e.target.value; } })),
      h('div', { class: 'form-row' },
        fld('Jenis surat', select(SURAT.map((x) => ({ value: x.kode, label: x.label })), f.surat, (v) => { f.surat = v; })),
        fld('Warna', select(WARNA.map((x) => ({ value: x.kode, label: x.label })), f.warna, (v) => { f.warna = v; }))),
      h('div', { class: 'sheet-actions' },
        btn('Simpan', async () => {
          if (!/^[A-Z0-9_]{1,12}$/.test(f.kode)) return toast('Kode 1–12 huruf/angka.');
          if (isNew && S.d.sanksi.some((x) => x.kode === f.kode)) return toast('Kode sudah dipakai.');
          if (!(Number(f.min) >= 1)) return toast('Poin minimal harus ≥ 1.');
          if (!f.label.trim()) return toast('Nama tahap wajib diisi.');
          await saveRow('sanksi', { ...f, min: Number(f.min), label: f.label.trim() }); toast('Tahap tersimpan.'); close();
        }, { kind: 'primary', ic: 'check' }),
        !isNew ? btn('Hapus', async () => { if (await confirmDialog('Hapus tahap?', l.label, 'Hapus', 'danger')) { await deleteRow('sanksi', l.kode); close(); } }, { kind: 'danger-tonal', ic: 'trash' }) : null));
  }, { title: isNew ? 'Tambah tahap sanksi' : `Ubah tahap ${l.kode}` });
}

// ================================================================== SISWA
let sq = '', skls = '', slimit = 80;
function tabSiswa(body) {
  const d = D();
  const kelasAll = [...new Set(S.d.siswa.map((s) => s.kelas).filter(Boolean))].sort(cmpKelas);
  body.append(h('div', { class: 'filters' },
    h('label', { class: 'fsel search' }, icon('search'), h('input', { type: 'search', placeholder: 'Cari nama/NIS…', value: sq, 'aria-label': 'Cari siswa', oninput: debounce((e) => { sq = e.target.value; slimit = 80; draw(); }, 150) })),
    h('label', { class: 'fsel' }, icon('school'), select([{ value: '', label: 'Semua kelas' }, ...kelasAll.map((k) => ({ value: k, label: `Kelas ${k}` }))], skls, (v) => { skls = v; slimit = 80; draw(); })),
    btn('Tambah', () => openSiswaForm(null), { kind: 'primary', ic: 'plus' }),
    btn('Impor Excel/CSV', () => importDialog(), { ic: 'upload' }),
    btn('Pindah kelas massal', () => massMove(kelasAll), { ic: 'school', kind: 'text' }),
    btn('Unduh semua', () => exportSiswa(), { ic: 'download', kind: 'text' })));
  const list = h('div');
  body.append(list);
  function draw() {
    const items = S.d.siswa.filter((s) => (!skls || s.kelas === skls) && (!sq || matches(sq, s.nama, s.nis, s.nisn))).sort((a, b) => cmpKelas(a.kelas, b.kelas) || cmpNama(a.nama, b.nama));
    list.replaceChildren(h('p', { class: 'muted small', text: `${fmtNum(items.length)} siswa` }),
      h('section', { class: 'card flush' }, h('div', { class: 'list' }, ...items.slice(0, slimit).map((s) => h('button', { class: 'row-item' + ((s.status || 'Aktif') !== 'Aktif' ? ' dim' : ''), type: 'button', onclick: () => openSiswaForm(s) },
        avatar(s.nama, s.jk === 'P' ? 'f' : ''),
        h('span', { class: 'grow min0' }, h('span', { class: 'row-title ellipsis', text: s.nama }), h('span', { class: 'row-sub muted' }, h('span', { text: `Kelas ${s.kelas}` }), s.nis ? h('span', { text: `NIS ${s.nis}` }) : null, s.hpOrtu ? h('span', { text: `HP ortu ${s.hpOrtu}` }) : null)),
        (s.status || 'Aktif') !== 'Aktif' ? h('span', { class: 'badge sm st-dark', text: s.status }) : null,
        isPending('siswa', s.id) ? h('span', { class: 'badge sm st-warn', text: 'belum tersinkron' }) : null,
        h('span', { class: 'muted small', text: `${d.summaries.get(s.id)?.total || 0} poin` }))))),
      showMore(slimit, items.length, () => { slimit += 200; draw(); }));
  }
  draw();
}

export function openSiswaForm(s) {
  const isNew = !s;
  const f = s ? { ...s } : { id: uid('s'), nis: '', nisn: '', nama: '', kelas: D().kelasList[0] || '', jk: '', angkatan: '', ortu: '', hpOrtu: '', alamat: '', status: 'Aktif', catatan: '' };
  const used = s ? usedCount('siswaId', s.id) : 0;
  const inp = (k, attrs = {}) => h('input', { type: 'text', value: f[k] || '', oninput: (e) => { f[k] = e.target.value; }, ...attrs });
  sheet((b, close) => {
    b.append(
      fld('Nama lengkap', inp('nama', { autofocus: true })),
      h('div', { class: 'form-row' }, fld('Kelas', inp('kelas', { list: 'dl-kelas', placeholder: 'mis. 7A' })), fld('L/P', select([{ value: '', label: '-' }, { value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }], f.jk, (v) => { f.jk = v; }))),
      h('datalist', { id: 'dl-kelas' }, ...D().kelasList.map((k) => h('option', { value: k }))),
      h('div', { class: 'form-row' }, fld('NIS', inp('nis', { inputmode: 'numeric' })), fld('NISN', inp('nisn', { inputmode: 'numeric' })), fld('Tahun masuk', inp('angkatan', { inputmode: 'numeric' }))),
      h('div', { class: 'form-row' }, fld('Nama orang tua/wali', inp('ortu')), fld('No. HP orang tua', inp('hpOrtu', { type: 'tel', inputmode: 'tel', placeholder: '08…' }))),
      fld('Alamat', inp('alamat')),
      h('div', { class: 'form-row' }, fld('Status', select(STATUS_SISWA, f.status || 'Aktif', (v) => { f.status = v; })), fld('Catatan', inp('catatan'))),
      h('div', { class: 'sheet-actions' },
        btn('Simpan', async () => {
          if (!f.nama.trim()) return toast('Nama wajib diisi.');
          if (!String(f.kelas).trim()) return toast('Kelas wajib diisi.');
          if (f.nis && S.d.siswa.some((x) => x.id !== f.id && x.nis && x.nis === f.nis.trim())) return toast(`NIS ${f.nis} sudah dipakai siswa lain.`);
          await saveRow('siswa', { ...f, nama: f.nama.trim(), kelas: String(f.kelas).trim().toUpperCase(), nis: f.nis.trim(), status: f.status || 'Aktif' });
          toast('Data siswa tersimpan.'); close();
        }, { kind: 'primary', ic: 'check' }),
        !isNew && !used ? btn('Hapus', async () => { if (await confirmDialog('Hapus siswa?', f.nama, 'Hapus', 'danger')) { await deleteRow('siswa', s.id); toast('Siswa dihapus.'); close(); } }, { kind: 'danger-tonal', ic: 'trash' }) : null,
        !isNew && used ? h('p', { class: 'muted small', text: `Memiliki ${used} catatan pelanggaran sehingga tidak bisa dihapus; ubah status menjadi Lulus/Pindah/Nonaktif.` }) : null));
  }, { title: isNew ? 'Tambah siswa' : 'Ubah data siswa' });
}

const HEADS = {
  nis: ['nis', 'no induk', 'nomor induk', 'nipd'], nisn: ['nisn'], nama: ['nama', 'nama lengkap', 'nama siswa', 'nama peserta didik'], kelas: ['kelas', 'rombel', 'rombongan belajar'],
  jk: ['l/p', 'jk', 'jenis kelamin', 'gender', 'lp'], angkatan: ['tahun masuk', 'angkatan'], ortu: ['nama orang tua/wali', 'nama orang tua', 'orang tua', 'wali', 'nama wali', 'nama ayah', 'nama ibu'],
  hpOrtu: ['no. hp orang tua', 'no hp orang tua', 'hp orang tua', 'no hp', 'no. hp', 'hp', 'telepon', 'no telepon', 'whatsapp', 'no wa'], alamat: ['alamat'], status: ['status'], catatan: ['catatan', 'keterangan'],
};
function mapHeader(row) {
  const idx = {};
  row.forEach((c, i) => { const n = norm(c).replace(/\s+/g, ' '); for (const [k, names] of Object.entries(HEADS)) if (idx[k] == null && names.includes(n)) idx[k] = i; });
  return idx.nama != null ? idx : null;
}

function importDialog() {
  let text = '';
  const ta = h('textarea', { rows: 8, placeholder: 'Tempel dari Excel/Google Sheets (dengan baris judul), contoh:\nNIS\tNama\tKelas\tL/P\tNama Orang Tua\tNo HP Orang Tua\n2026001\tAndre Mandagi\t7A\tL\tYohanis Mandagi\t08123456789', oninput: (e) => { text = e.target.value; preview(); } });
  const out = h('div');
  let parsed = [];
  function preview() {
    const rows = parseTable(text);
    if (!rows.length) { out.replaceChildren(); parsed = []; return; }
    let idx = mapHeader(rows[0]);
    let data = rows.slice(1);
    if (!idx) { idx = { nis: 0, nama: 1, kelas: 2, jk: 3 }; data = rows; }
    const byNis = new Map(S.d.siswa.filter((s) => s.nis).map((s) => [s.nis, s]));
    const byNamaKelas = new Map(S.d.siswa.map((s) => [norm(s.nama) + '|' + norm(s.kelas), s]));
    parsed = data.map((r) => {
      const g = (k) => (idx[k] != null ? String(r[idx[k]] || '').trim() : '');
      const o = { nis: g('nis'), nisn: g('nisn'), nama: g('nama'), kelas: g('kelas').toUpperCase().replace(/\s+/g, ''), jk: /^p/i.test(g('jk')) ? 'P' : /^l/i.test(g('jk')) ? 'L' : '', angkatan: g('angkatan'), ortu: g('ortu'), hpOrtu: g('hpOrtu'), alamat: g('alamat'), status: STATUS_SISWA.includes(g('status')) ? g('status') : '', catatan: g('catatan') };
      const ex = (o.nis && byNis.get(o.nis)) || byNamaKelas.get(norm(o.nama) + '|' + norm(o.kelas));
      return { o, ex, ok: !!(o.nama && o.kelas) };
    });
    const nNew = parsed.filter((p) => p.ok && !p.ex).length, nUpd = parsed.filter((p) => p.ok && p.ex).length, nBad = parsed.filter((p) => !p.ok).length;
    out.replaceChildren(h('p', { class: 'small' }, h('strong', { text: `${nNew} siswa baru` }), ` · ${nUpd} diperbarui (cocok NIS atau nama+kelas)`, nBad ? ` · ${nBad} baris dilewati (nama/kelas kosong)` : ''),
      h('div', { class: 'table-wrap mini' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ...['', 'NIS', 'Nama', 'Kelas', 'L/P', 'Orang tua', 'HP'].map((c) => h('th', { text: c })))),
        h('tbody', null, ...parsed.slice(0, 8).map((p) => h('tr', { class: p.ok ? '' : 'dim' }, h('td', { text: !p.ok ? '✕' : p.ex ? 'ubah' : 'baru' }), ...['nis', 'nama', 'kelas', 'jk', 'ortu', 'hpOrtu'].map((k) => h('td', { text: p.o[k] }))))))),
      parsed.length > 8 ? h('p', { class: 'muted small', text: `…dan ${parsed.length - 8} baris lainnya` }) : null);
  }
  dialog('Impor data siswa', h('div', { class: 'stack-sm import' },
    h('p', { class: 'muted small', text: 'Salin tabel dari Excel/Google Sheets lalu tempel di bawah, atau pilih file CSV. Kolom dikenali dari judulnya (NIS, NISN, Nama, Kelas, L/P, Tahun Masuk, Nama Orang Tua, No HP Orang Tua, Alamat). Tanpa judul: NIS, Nama, Kelas, L/P.' }),
    h('div', { class: 'row gap-sm wrap' },
      btn('Pilih file CSV', async () => { const file = await pickFile({ accept: '.csv,.txt,.tsv,text/csv' }); if (file) { text = await file.text(); ta.value = text; preview(); } }, { ic: 'upload', small: true }),
      btn('Unduh templat', () => downloadText(toCSV([['NIS', 'NISN', 'Nama Lengkap', 'Kelas', 'L/P', 'Tahun Masuk', 'Nama Orang Tua/Wali', 'No. HP Orang Tua', 'Alamat']]), 'templat-siswa.csv'), { ic: 'download', small: true, kind: 'text' })),
    ta, out),
  [{ label: 'Batal', value: null }, { label: 'Impor', value: 'ok', kind: 'primary' }]).then(async (v) => {
    if (v !== 'ok') return;
    const rows = parsed.filter((p) => p.ok).map((p) => (p.ex ? { ...p.ex, ...Object.fromEntries(Object.entries(p.o).filter(([, x]) => x)) } : { id: uid('s'), ...p.o, status: p.o.status || 'Aktif' }));
    if (!rows.length) return toast('Tidak ada baris yang bisa diimpor.');
    await saveRows('siswa', rows);
    toast(`${rows.length} data siswa disimpan${S.demo ? '' : ' — sedang dikirim ke server'}.`);
  });
}

function massMove(kelasAll) {
  const o = { dari: kelasAll[0] || '', ke: '', status: 'Aktif' };
  dialog('Pindah kelas massal', h('div', { class: 'stack-sm' },
    h('p', { class: 'muted small', text: 'Untuk kenaikan kelas di tahun ajaran baru. Kerjakan dari kelas tertinggi dulu (mis. 9A → Lulus, lalu 8A → 9A, lalu 7A → 8A). Riwayat & poin siswa tetap terbawa.' }),
    fld('Dari kelas', select(kelasAll, o.dari, (v) => { o.dari = v; })),
    fld('Ke kelas', h('input', { type: 'text', placeholder: 'mis. 8A (kosongkan bila lulus)', oninput: (e) => { o.ke = e.target.value.trim().toUpperCase(); } })),
    fld('Status', select(STATUS_SISWA, o.status, (v) => { o.status = v; }))),
  [{ label: 'Batal', value: null }, { label: 'Terapkan', value: 'ok', kind: 'primary' }]).then(async (v) => {
    if (v !== 'ok') return;
    const list = S.d.siswa.filter((s) => s.kelas === o.dari && (s.status || 'Aktif') === 'Aktif');
    if (!list.length) return toast('Tidak ada siswa aktif di kelas itu.');
    if (!o.ke && o.status === 'Aktif') return toast('Isi kelas tujuan, atau pilih status Lulus/Pindah.');
    if (!(await confirmDialog('Terapkan?', `${list.length} siswa kelas ${o.dari} → ${o.ke ? 'kelas ' + o.ke : ''}${o.status !== 'Aktif' ? ' status ' + o.status : ''}.`, 'Ya, terapkan'))) return;
    await saveRows('siswa', list.map((s) => ({ ...s, kelas: o.ke || s.kelas, status: o.status })));
    toast(`${list.length} siswa diperbarui.`);
  });
}

function exportSiswa() {
  const rows = [['ID', 'NIS', 'NISN', 'Nama Lengkap', 'Kelas', 'L/P', 'Tahun Masuk', 'Nama Orang Tua/Wali', 'No. HP Orang Tua', 'Alamat', 'Status', 'Catatan', 'Total Poin']];
  const d = D();
  for (const s of [...S.d.siswa].sort((a, b) => cmpKelas(a.kelas, b.kelas) || cmpNama(a.nama, b.nama))) rows.push([s.id, s.nis, s.nisn, s.nama, s.kelas, s.jk, s.angkatan, s.ortu, s.hpOrtu, s.alamat, s.status || 'Aktif', s.catatan, d.summaries.get(s.id)?.total || 0]);
  downloadText(toCSV(rows), 'data-siswa.csv');
}

// ================================================================== PENGGUNA (online)
let usersCache = null;
function tabPengguna(body) {
  body.append(h('div', { class: 'notice info sm' }, icon('info'), h('p', { class: 'small', text: 'Akun & password disimpan di sheet "Pengguna". Perubahan di sini langsung dikirim ke server (perlu internet). HP hanya menyimpan hash password, bukan password aslinya.' })));
  const list = h('div');
  body.append(h('div', { class: 'filters' }, btn('Tambah pengguna', () => userForm(null), { kind: 'primary', ic: 'plus', disabled: S.demo }), btn('Muat ulang', () => load(true), { ic: 'sync', kind: 'text' })), list);
  async function load(force) {
    if (S.demo) { usersCache = S.d.users.map((u) => ({ ...u, hasPassword: true })); return draw(); }
    if (!usersCache || force) {
      list.replaceChildren(h('p', { class: 'muted', text: 'Memuat daftar pengguna dari server…' }));
      try { usersCache = (await callAuthed('users.list')).users; } catch (e) {
        usersCache = null;
        list.replaceChildren(h('div', { class: 'notice warn' }, icon('cloudoff'), h('div', null, h('strong', { text: 'Tidak dapat memuat dari server' }), h('p', { class: 'small', text: e.message }))),
          h('p', { class: 'muted small', text: 'Daftar di bawah dari data terakhir di HP (hanya baca):' }), userList(S.d.users, false));
        return;
      }
    }
    draw();
  }
  function draw() { list.replaceChildren(userList(usersCache, !S.demo)); }
  function userList(users, editable) {
    const sorted = [...users].sort((a, b) => ROLES.indexOf(a.peran) - ROLES.indexOf(b.peran) || cmpNama(a.nama, b.nama));
    return h('section', { class: 'card flush' }, h('div', { class: 'list' }, ...sorted.map((u) => h('button', { class: 'row-item' + (u.aktif === false ? ' dim' : ''), type: 'button', disabled: !editable, onclick: () => userForm(u) },
      avatar(u.nama), h('span', { class: 'grow min0' }, h('span', { class: 'row-title ellipsis', text: u.nama }), h('span', { class: 'row-sub muted' }, h('span', { text: `@${u.username}` }), h('span', { text: u.peran }), u.kelasWali ? h('span', { text: `Wali ${u.kelasWali}` }) : null)),
      u.aktif === false ? h('span', { class: 'badge sm st-dark', text: 'Nonaktif' }) : null, u.hasPassword === false ? h('span', { class: 'badge sm st-warn', text: 'Belum ada password' }) : null))));
  }
  function userForm(u) {
    const isNew = !u;
    const f = u ? { ...u, password: '' } : { username: '', nama: '', peran: 'Guru', kelasWali: '', nip: '', hp: '', aktif: true, password: '' };
    sheet((b, close) => {
      const inp = (k, attrs = {}) => h('input', { type: 'text', value: f[k] || '', oninput: (e) => { f[k] = e.target.value; }, ...attrs });
      const pw = inp('password', { type: 'password', autocomplete: 'new-password', placeholder: isNew ? 'Minimal 4 karakter' : 'Kosongkan bila tidak diganti' });
      b.append(
        h('div', { class: 'form-row' }, fld('Username', inp('username', { disabled: !isNew, autocapitalize: 'none', placeholder: 'mis. bu.ani' }), 'Huruf kecil/angka/titik, 3–30 karakter'), fld('Peran', select(ROLES, f.peran, (v) => { f.peran = v; }))),
        fld('Nama lengkap (dengan gelar)', inp('nama')),
        h('div', { class: 'form-row' }, fld('Kelas wali', inp('kelasWali', { placeholder: 'mis. 7A (pisahkan koma bila >1)' }), 'Hanya untuk peran Wali Kelas'), fld('NIP/NIY', inp('nip'))),
        h('div', { class: 'form-row' }, fld('No. HP', inp('hp', { type: 'tel' })), fld(isNew ? 'Password' : 'Password baru', pw)),
        sw('Aktif (bisa login)', f.aktif !== false, (v) => { f.aktif = v; }),
        h('div', { class: 'sheet-actions' },
          btn('Simpan', async (e) => {
            const b = e.currentTarget;
            b.disabled = true;
            try {
              await callAuthed('users.save', { isNew, user: { ...f, username: f.username.trim().toLowerCase() } });
              toast('Pengguna tersimpan.'); close(); load(true);
            } catch (err) { toast(err.message); b.disabled = false; }
          }, { kind: 'primary', ic: 'check' }),
          !isNew && u.username !== me().username ? btn('Hapus', async () => {
            if (!(await confirmDialog('Hapus pengguna?', `${u.nama} (@${u.username}). Catatan yang pernah dibuatnya tetap tersimpan.`, 'Hapus', 'danger'))) return;
            try { await callAuthed('users.delete', { username: u.username }); toast('Pengguna dihapus.'); close(); load(true); } catch (err) { toast(err.message); }
          }, { kind: 'danger-tonal', ic: 'trash' }) : null));
    }, { title: isNew ? 'Tambah pengguna' : 'Ubah pengguna' });
  }
  load(false);
}

// ================================================================== PENGATURAN
function tabPengaturan(body) {
  const f = { ...S.settings };
  const changed = new Set();
  const set = (k, v) => { f[k] = v; changed.add(k); };
  const inp = (k, attrs = {}) => fld(SETTING_INFO[k] || k, h('input', { type: 'text', value: f[k] ?? '', oninput: (e) => set(k, e.target.value), ...attrs }));
  const area = (k) => { const t = h('textarea', { rows: 2, oninput: (e) => set(k, e.target.value) }); t.value = f[k] ?? ''; return fld(SETTING_INFO[k] || k, t); };
  const logoImg = h('img', { class: 'logo-prev', alt: 'Logo sekolah', src: f.logo || '', hidden: !f.logo });
  body.append(
    h('section', { class: 'card stack' }, h('h3', { text: 'Identitas sekolah (kop surat)' }),
      inp('namaSekolah'), inp('yayasan'), h('div', { class: 'form-row' }, inp('npsn'), inp('kota')), area('alamat'), h('div', { class: 'form-row' }, inp('telepon'), inp('email', { type: 'email' })),
      h('div', { class: 'logo-row' }, logoImg, h('div', { class: 'stack-sm' }, h('span', { class: 'lbl', text: 'Logo sekolah' }),
        h('div', { class: 'row gap-sm' },
          btn('Unggah logo', async () => {
            const file = await pickFile({ accept: 'image/*' });
            if (!file) return;
            try { const url = await shrinkImage(file); set('logo', url); logoImg.src = url; logoImg.hidden = false; } catch (e) { toast(e.message); }
          }, { ic: 'upload', small: true }),
          btn('Hapus', () => { set('logo', ''); logoImg.hidden = true; }, { kind: 'text', small: true })),
        h('span', { class: 'hint', text: 'Diperkecil otomatis (maks. ±35 KB) agar muat di spreadsheet.' })))),
    h('section', { class: 'card stack' }, h('h3', { text: 'Pejabat penanda tangan' }),
      h('div', { class: 'form-row' }, inp('kepalaSekolah'), inp('nipKepsek')), h('div', { class: 'form-row' }, inp('guruBK'), inp('nipBK'))),
    h('section', { class: 'card stack' }, h('h3', { text: 'Tahun ajaran' }),
      h('div', { class: 'form-row' }, inp('tahunAjaran'), fld(SETTING_INFO.semester, select(['Ganjil', 'Genap'], f.semester, (v) => set('semester', v))), fld(SETTING_INFO.zonaWaktu, select(['WIB', 'WITA', 'WIT'], f.zonaWaktu, (v) => set('zonaWaktu', v))))),
    h('section', { class: 'card stack' }, h('h3', { text: 'Aturan aplikasi' }),
      h('div', { class: 'form-row' }, inp('batasKoreksiJam', { type: 'number', min: 0 }), inp('batasSidang', { type: 'number', min: 0 })),
      fld(SETTING_INFO.aksesDashboard, select([{ value: 'publik', label: 'Publik — dasbor & riwayat terbuka untuk semua pengguna aplikasi' }, { value: 'login', label: 'Login — data siswa hanya untuk guru yang login' }], f.aksesDashboard, (v) => set('aksesDashboard', v))),
      area('lokasi'), area('tindakanCepat')),
    h('div', { class: 'form-footer static' }, h('span', { class: 'grow muted small', text: 'Perubahan disimpan ke sheet "Pengaturan" dan berlaku di semua HP setelah sinkron.' }),
      btn('Simpan pengaturan', async () => {
        if (!changed.size) return toast('Tidak ada perubahan.');
        await saveSettingsMap(Object.fromEntries([...changed].map((k) => [k, f[k]])));
        changed.clear();
        toast('Pengaturan tersimpan.');
        syncNow();
      }, { kind: 'primary', ic: 'check' })));
}

async function shrinkImage(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Gambar tidak dapat dibaca.')); i.src = URL.createObjectURL(file); });
  for (const size of [220, 180, 140, 110]) {
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; // latar putih: JPEG tidak mendukung transparan (kop surat juga di kertas putih)
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const [type, q] of [['image/png'], ['image/webp', 0.85], ['image/jpeg', 0.85]]) {
      const url = c.toDataURL(type, q);
      if (url.startsWith(`data:${type}`) && url.length < 45000) return url;
    }
  }
  throw new Error('Gambar terlalu besar. Gunakan logo yang lebih sederhana.');
}
