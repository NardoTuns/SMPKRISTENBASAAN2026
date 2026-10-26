// Tindak lanjut: setiap tahap sanksi yang tercapai siswa (Lisan, SP 1, SP 2, …) perlu dilaksanakan dan dicatat.
import { h, icon, btn, select, sheet, dialog, toast } from '../ui/dom.js';
import { emptyState, levelBadge, pageHead, showMore, waLink } from '../ui/widgets.js';
import { go, replaceQuery } from '../ui/nav.js';
import { printSurat } from '../ui/print.js';
import { S, D, me, saveRow } from '../store.js';
import { canTindak, canTindakAny, kelasWali, isMgr } from '../core/perm.js';
import { STATUS_TINDAK } from '../core/rules.js';
import { addDays, fmtNum, fmtTgl, ymd, cmpKelas } from '../core/util.js';

export const meta = { title: 'Tindak Lanjut', live: true };
let limit = 50;

export function render(view, route) {
  const u = me();
  if (!u) { view.append(emptyState('lock', 'Masuk terlebih dahulu', 'Halaman tindak lanjut untuk guru.', btn('Masuk', () => go('login', { next: 'tindak' }), { kind: 'primary', ic: 'login' }))); return; }
  const d = D();
  const q = route.query;
  const mine = !isMgr(u) && u.peran === 'Wali Kelas';
  const f = { status: q.status || 'terbuka', tahap: q.tahap || '', kelas: q.kelas || '', lingkup: q.lingkup || (mine ? 'kelasku' : 'semua') };
  const update = (patch) => { Object.assign(f, patch); limit = 50; replaceQuery(Object.fromEntries(Object.entries(f).filter(([, v]) => v))); view.replaceChildren(); render(view, { ...route, query: { ...f } }); };
  const myKelas = kelasWali(u);
  const list = d.tindak.filter((t) => {
    if (f.status === 'terbuka' && (t.status === 'Selesai' || !t.berlaku)) return false;
    if (f.status !== 'terbuka' && f.status !== 'semua' && t.status !== f.status) return false;
    if (f.tahap && t.tahap !== f.tahap) return false;
    if (f.kelas && t.kelas !== f.kelas) return false;
    if (f.lingkup === 'kelasku' && !myKelas.includes(String(t.kelas).toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.status === 'Selesai') - (b.status === 'Selesai') || (b.tanggalCapai || '').localeCompare(a.tanggalCapai || '') || cmpKelas(a.kelas, b.kelas));
  const open = d.tindak.filter((t) => t.berlaku && t.status !== 'Selesai');

  view.append(pageHead('Tindak Lanjut', `${fmtNum(open.length)} belum selesai · ${fmtNum(d.tindak.filter((t) => t.status === 'Selesai').length)} selesai`));
  if (!canTindakAny(u)) view.append(h('div', { class: 'notice info' }, icon('info'), h('p', { text: 'Anda dapat melihat daftar ini. Pemrosesan tindak lanjut dilakukan oleh Wali Kelas, Guru BK, Kepala Sekolah, atau Admin.' })));
  view.append(h('div', { class: 'filters' },
    h('label', { class: 'fsel' }, icon('filter'), select([{ value: 'terbuka', label: 'Belum selesai' }, ...STATUS_TINDAK.map((s) => ({ value: s, label: s })), { value: 'semua', label: 'Semua status' }], f.status, (v) => update({ status: v }), { 'aria-label': 'Status' })),
    h('label', { class: 'fsel' }, icon('alert'), select([{ value: '', label: 'Semua tahap' }, ...d.levels.map((l) => ({ value: l.kode, label: l.label }))], f.tahap, (v) => update({ tahap: v }), { 'aria-label': 'Tahap' })),
    h('label', { class: 'fsel' }, icon('school'), select([{ value: '', label: 'Semua kelas' }, ...d.kelasList.map((k) => ({ value: k, label: `Kelas ${k}` }))], f.kelas, (v) => update({ kelas: v }), { 'aria-label': 'Kelas' })),
    myKelas.length ? h('label', { class: 'fsel' }, icon('users'), select([{ value: 'kelasku', label: `Kelas saya (${u.kelasWali})` }, { value: 'semua', label: 'Semua kelas' }], f.lingkup, (v) => update({ lingkup: v }), { 'aria-label': 'Lingkup' })) : null));

  if (!list.length) { view.append(emptyState('checklist', 'Tidak ada tindak lanjut', f.status === 'terbuka' ? 'Semua tindak lanjut sudah dilaksanakan. 👍' : 'Tidak ada data yang cocok dengan penyaring.')); return; }
  const wrap = h('div');
  view.append(wrap);
  const draw = () => wrap.replaceChildren(h('div', { class: 'list card flush' }, ...list.slice(0, limit).map((t) => tindakRow(t, d))), showMore(limit, list.length, () => { limit += 100; draw(); }));
  draw();
}

function tindakRow(t, d) {
  const sum = d.summaries.get(t.siswaId);
  const late = t.status === 'Belum' && t.tanggalCapai && t.tanggalCapai < addDays(ymd(), -7);
  return h('button', { class: 'row-item', type: 'button', onclick: () => openTindak(t) },
    h('div', { class: 'grow min0' },
      h('div', { class: 'row-title' }, h('span', { class: 'ellipsis', text: t.nama }), h('span', { class: 'muted small', text: t.kelas })),
      h('div', { class: 'row gap-sm wrap' }, levelBadge(t.level || { label: t.tahapLabel || t.tahap, warna: 'dark' }, { small: true }),
        h('span', { class: 'muted small', text: `tercapai ${fmtTgl(t.tanggalCapai, { short: true })} · ${t.poinSaat} poin (kini ${sum?.total ?? '-'})` })),
      t.level ? h('div', { class: 'muted small ellipsis', text: `${t.level.pj}: ${t.level.tindakan}` }) : h('div', { class: 'muted small', text: 'Tahap tidak berlaku lagi (catatan dibatalkan/aturan berubah)' })),
    h('div', { class: 'row-end' },
      h('span', { class: `badge sm st-${t.status === 'Selesai' ? 'ok' : t.status === 'Dijadwalkan' ? 'info' : late ? 'critical' : 'warn'}`, text: late ? 'Belum · > 7 hari' : t.status }),
      t.nomorSurat ? h('span', { class: 'muted small', text: t.nomorSurat }) : null));
}

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
function suggestNomor(level, tanggal) {
  const kode = level?.surat || level?.kode || 'TL';
  const y = (tanggal || ymd()).slice(0, 4);
  const n = S.d.tindak.filter((x) => x.nomorSurat && x.nomorSurat.includes(`/${kode}/`) && x.nomorSurat.endsWith(y)).length + 1;
  const singkat = String(S.settings.namaSekolah || 'SEKOLAH').split(/\s+/).map((w, i) => (i === 0 && w.length <= 4 ? w.toUpperCase() : w[0]?.toUpperCase() || '')).join('');
  return `${String(n).padStart(3, '0')}/${kode}/${singkat}/${ROMAWI[Number((tanggal || ymd()).slice(5, 7)) - 1]}/${y}`;
}

export function openTindak(t) {
  const u = me();
  const d = D();
  const siswa = d.siswaMap.get(t.siswaId);
  const sum = d.summaries.get(t.siswaId);
  const can = canTindak(u, t.kelas);
  const f = { status: t.status === 'Belum' && can ? 'Selesai' : t.status, tanggalPelaksanaan: t.tanggalPelaksanaan || ymd(), nomorSurat: t.nomorSurat || '', catatan: t.catatan || '' };
  if (!f.nomorSurat && t.level?.surat) f.nomorSurat = suggestNomor(t.level, f.tanggalPelaksanaan);
  sheet((body, close) => {
    body.append(
      h('div', { class: 'row gap-sm wrap' }, levelBadge(t.level || { label: t.tahapLabel || t.tahap, warna: 'dark' }), h('span', { class: `badge st-${t.status === 'Selesai' ? 'ok' : 'warn'}`, text: t.status })),
      h('h3', { class: 'mt', text: `${t.nama} · Kelas ${t.kelas}` }),
      h('p', { class: 'muted small', text: `Tahap tercapai ${fmtTgl(t.tanggalCapai, { hari: true })} dengan akumulasi ${t.poinSaat} poin. Akumulasi saat ini ${sum?.total ?? '-'} poin.` }),
      t.level ? h('div', { class: 'notice info' }, icon('info'), h('div', null, h('strong', { text: `Tindakan (${t.level.pj})` }), h('p', { text: t.level.tindakan }))) : null,
      sum && sum.total > d.batasSidang ? h('div', { class: 'notice critical sm' }, icon('gavel'), h('p', { class: 'small', text: `Akumulasi di atas ${d.batasSidang} poin: keputusan melalui Sidang Dewan Guru.` })) : null);
    if (can) {
      const inp = (key, attrs) => h('input', { ...attrs, value: f[key], oninput: (e) => { f[key] = e.target.value; } });
      const cat = h('textarea', { rows: 3, placeholder: 'Hasil pemanggilan/pembinaan, kehadiran orang tua, kesepakatan…', oninput: (e) => { f.catatan = e.target.value; } });
      cat.value = f.catatan;
      body.append(h('div', { class: 'form-sec-inline' },
        h('div', { class: 'form-row' },
          h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Status' }), select(STATUS_TINDAK, f.status, (v) => { f.status = v; })),
          h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Tanggal pelaksanaan' }), inp('tanggalPelaksanaan', { type: 'date' }))),
        h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Nomor surat' }), inp('nomorSurat', { type: 'text', placeholder: 'Opsional' })),
        h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Catatan' }), cat)));
    }
    const wa = u && siswa ? waLink(siswa, `Yth. Bapak/Ibu ${siswa.ortu || 'Orang Tua/Wali'} dari ${siswa.nama} (kelas ${siswa.kelas}),\n\nKami informasikan bahwa akumulasi poin pelanggaran tata tertib ananda telah mencapai ${t.poinSaat} poin sehingga memasuki tahap "${t.level?.label || t.tahapLabel}". ${t.level?.tindakan || ''}\n\nMohon Bapak/Ibu dapat menghubungi sekolah. Terima kasih.\n\n— ${u.nama}, ${S.settings.namaSekolah}`) : '';
    body.append(h('div', { class: 'sheet-actions' },
      can ? btn('Simpan', async () => {
        await saveRow('tindak', {
          id: t.id, siswaId: t.siswaId, nama: t.nama, kelas: t.kelas, tahap: t.tahap, tahapLabel: t.level?.label || t.tahapLabel || t.tahap,
          poinSaat: t.poinSaat, tanggalCapai: t.tanggalCapai, status: f.status, tanggalPelaksanaan: f.tanggalPelaksanaan, nomorSurat: f.nomorSurat.trim(),
          catatan: f.catatan.trim(), petugas: u.nama,
        });
        toast('Tindak lanjut tersimpan.');
        close();
      }, { kind: 'primary', ic: 'check' }) : null,
      btn(t.level?.surat ? 'Surat · PDF/WA' : 'Catatan pembinaan', () => letterDialog(t, f), { ic: 'report' }),
      wa ? h('a', { class: 'btn tonal', href: wa, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'WhatsApp orang tua' })) : null,
      btn('Lihat siswa', () => { close(); go('siswa', t.siswaId); }, { ic: 'user', kind: 'text' })));
  }, { title: 'Tindak lanjut' });
}

/** Isian tambahan sebelum mencetak surat (jadwal panggilan, skorsing, tanggal sidang). */
function letterDialog(t, f) {
  const kind = t.level?.surat || '';
  const o = { nomor: f.nomorSurat, tanggal: f.tanggalPelaksanaan || ymd(), hariTemu: addDays(ymd(), 2), jamTemu: '09:00', tempat: `Ruang BK ${S.settings.namaSekolah}`, mulai: addDays(ymd(), 1), selesai: addDays(ymd(), 3), sidang: ymd() };
  const inp = (key, type, label) => h('label', { class: 'field' }, h('span', { class: 'lbl', text: label }), h('input', { type, value: o[key], oninput: (e) => { o[key] = e.target.value; } }));
  dialog('Data surat', h('div', { class: 'stack-sm' },
    inp('nomor', 'text', 'Nomor surat'), inp('tanggal', 'date', 'Tanggal surat'),
    kind === 'SP2' || kind === 'SP3' ? h('div', { class: 'stack-sm' }, h('p', { class: 'muted small', text: 'Jadwal panggilan orang tua/wali' }),
      h('div', { class: 'form-row' }, inp('hariTemu', 'date', 'Tanggal'), inp('jamTemu', 'time', 'Jam')), inp('tempat', 'text', 'Tempat')) : null,
    kind === 'SP3' ? h('div', { class: 'form-row' }, inp('mulai', 'date', 'Skorsing mulai'), inp('selesai', 'date', 'Skorsing selesai')) : null,
    kind === 'SP3' || kind === 'KELUAR' ? inp('sidang', 'date', 'Tanggal Sidang Dewan Guru') : null,
    !kind ? h('p', { class: 'muted small', text: 'Tahap ini tidak memerlukan surat resmi; dicetak lembar catatan pembinaan.' }) : null),
  [{ label: 'Batal', value: null }, { label: 'Buat surat', value: 'ok', kind: 'primary' }]).then((v) => { if (v === 'ok') printSurat(t, o); });
}
