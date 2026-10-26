// Potongan antarmuka yang dipakai banyak halaman.
import { h, icon, select, sheet, btn, toast, confirmDialog, prompt } from './dom.js';
import { pointsMeter } from './charts.js';
import { go } from './nav.js';
import { S, D, me, isPending, katNama, saveRow } from '../store.js';
import { canEditRecord, isMgr, editDeadline } from '../core/perm.js';
import { PERIODS } from '../core/stats.js';
import { TINGKAT } from '../core/rules.js';
import { fmtNum, fmtTgl, initials, waNumber, hariOf, ymd, hm } from '../core/util.js';
import { printBAP } from './print.js';

export const TINGKAT_WARNA = { Ringan: 'warn', Sedang: 'serious', Berat: 'critical' };

export function levelBadge(level, { small = false } = {}) {
  if (!level) return h('span', { class: `badge st-ok${small ? ' sm' : ''}` }, icon('shield'), h('span', { text: 'Aman' }));
  return h('span', { class: `badge st-${level.warna || 'warn'}${small ? ' sm' : ''}`, title: level.tindakan || '' }, icon(level.kode === 'KELUAR' ? 'gavel' : 'alert'), h('span', { text: level.label }));
}
export const tingkatBadge = (t) => h('span', { class: `badge sm st-${TINGKAT_WARNA[t] || 'info'}`, text: t || '-' });
export const avatar = (nama, cls = '') => h('span', { class: 'avatar ' + cls, 'aria-hidden': 'true', text: initials(nama) });
export const pendingMark = () => h('span', { class: 'pending-mark', title: 'Belum tersinkron ke server' }, icon('cloudup'));

export function emptyState(ic, title, text, action) {
  return h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, icon(ic)), h('h3', { text: title }), text ? h('p', { class: 'muted', text }) : null, action || null);
}

export function pageHead(title, sub, ...actions) {
  return h('header', { class: 'page-head' },
    h('div', { class: 'grow' }, h('h1', { text: title }), sub ? h('p', { class: 'muted', text: sub }) : null),
    actions.length ? h('div', { class: 'page-actions' }, ...actions) : null);
}

export function statTile(label, value, { sub, delta, ic, tone } = {}) {
  return h('div', { class: 'tile' + (tone ? ' tone-' + tone : '') },
    h('div', { class: 'tile-label' }, ic ? icon(ic) : null, h('span', { text: label })),
    h('div', { class: 'tile-value', text: value }),
    delta || null,
    sub ? h('div', { class: 'tile-sub muted', text: sub }) : null);
}

/** Selisih vs periode sebelumnya. Untuk pelanggaran, naik = buruk. */
export function deltaChip(cur, prev, label) {
  if (prev == null) return null;
  if (!prev && !cur) return h('div', { class: 'delta flat', text: `sama dengan ${label}` });
  if (!prev) return h('div', { class: 'delta up-bad' }, icon('alert'), h('span', { text: `+${fmtNum(cur)} dari 0 ${label}` }));
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return h('div', { class: 'delta flat', text: `sama dengan ${label}` });
  return h('div', { class: 'delta ' + (p > 0 ? 'up-bad' : 'down-good') }, h('span', { text: `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% vs ${label}` }));
}

// ------------------------------------------------------------------ baris siswa & catatan
export function studentRow(s, sum, { onClick, extra } = {}) {
  const d = D();
  return h('button', { class: 'row-item', type: 'button', onclick: onClick || (() => go('siswa', s.id)) },
    avatar(s.nama, s.jk === 'P' ? 'f' : ''),
    h('div', { class: 'grow min0' },
      h('div', { class: 'row-title' }, h('span', { class: 'ellipsis', text: s.nama }), (s.status || 'Aktif') !== 'Aktif' ? h('span', { class: 'badge sm st-dark', text: s.status }) : null),
      h('div', { class: 'row-sub muted' }, h('span', { text: `Kelas ${s.kelas || '-'}` }), s.nis ? h('span', { text: `NIS ${s.nis}` }) : null, sum.count ? h('span', { text: `${sum.count} pelanggaran` }) : null),
      pointsMeter(sum.total, d.levels, { compact: true }),
      extra || null),
    h('div', { class: 'row-end' }, h('div', { class: 'pts' }, h('strong', { text: fmtNum(sum.total) }), h('span', { class: 'muted', text: 'poin' })), levelBadge(sum.level, { small: true })));
}

export function recordRow(r, { showSiswa = true, onClick } = {}) {
  const pend = isPending('pelanggaran', r.id);
  return h('button', { class: 'row-item rec' + (r.batal ? ' batal' : ''), type: 'button', onclick: onClick || (() => openRecord(r)) },
    h('span', { class: `rec-pts st-${TINGKAT_WARNA[r.tingkat] || 'info'}` }, h('strong', { text: `+${fmtNum(r.poin)}` })),
    h('div', { class: 'grow min0' },
      showSiswa ? h('div', { class: 'row-title' }, h('span', { class: 'ellipsis', text: r.nama }), h('span', { class: 'muted small', text: r.kelas })) : null,
      h('div', { class: showSiswa ? 'row-sub2' : 'row-title wrap', text: `${r.jenisKode}. ${r.uraian}` }),
      h('div', { class: 'row-sub muted' },
        h('span', { text: `${fmtTgl(r.tanggal, { short: true })}${r.jam ? ' · ' + r.jam : ''}` }),
        r.guruNama ? h('span', { text: r.guruNama }) : null,
        r.batal ? h('span', { class: 'badge sm st-dark', text: 'Dibatalkan' }) : null)),
    pend ? pendingMark() : null);
}

// ------------------------------------------------------------------ penyaring periode/kelas/kategori/tingkat
/** state: {periode, from, to, kelas, kategori, tingkat}; onChange(newState). opts.fields = daftar penyaring yang tampil. */
export function filterBar(state, onChange, { fields = ['periode', 'kelas', 'kategori', 'tingkat'], extra = [] } = {}) {
  const d = D();
  const set = (patch) => onChange({ ...state, ...patch });
  const bar = h('div', { class: 'filters', role: 'group', 'aria-label': 'Penyaring' });
  if (fields.includes('periode')) {
    bar.append(h('label', { class: 'fsel' }, icon('calendar'), select(PERIODS.map((p) => ({ value: p.kode, label: p.label })), state.periode, (v) => set({ periode: v }), { 'aria-label': 'Periode' })));
    if (state.periode === 'kustom') {
      bar.append(h('label', { class: 'fsel date' }, h('span', { class: 'muted small', text: 'Dari' }), h('input', { type: 'date', value: state.from || '', 'aria-label': 'Dari tanggal', onchange: (e) => set({ from: e.target.value }) })));
      bar.append(h('label', { class: 'fsel date' }, h('span', { class: 'muted small', text: 's/d' }), h('input', { type: 'date', value: state.to || '', 'aria-label': 'Sampai tanggal', onchange: (e) => set({ to: e.target.value }) })));
    }
  }
  if (fields.includes('kelas')) bar.append(h('label', { class: 'fsel' }, icon('school'), select([{ value: '', label: 'Semua kelas' }, ...d.kelasList.map((k) => ({ value: k, label: `Kelas ${k}` }))], state.kelas || '', (v) => set({ kelas: v }), { 'aria-label': 'Kelas' })));
  if (fields.includes('kategori')) bar.append(h('label', { class: 'fsel' }, icon('list'), select([{ value: '', label: 'Semua kategori' }, ...d.kategori.map((k) => ({ value: k.kode, label: `${k.kode}. ${k.nama}` }))], state.kategori || '', (v) => set({ kategori: v }), { 'aria-label': 'Kategori' })));
  if (fields.includes('tingkat')) bar.append(h('label', { class: 'fsel' }, icon('alert'), select([{ value: '', label: 'Semua tingkat' }, ...TINGKAT.map((t) => ({ value: t, label: `Pelanggaran ${t}` }))], state.tingkat || '', (v) => set({ tingkat: v }), { 'aria-label': 'Tingkat' })));
  for (const x of extra) bar.append(x);
  const active = ['kelas', 'kategori', 'tingkat'].some((k) => state[k]) || (fields.includes('periode') && state.periode !== (state.defPeriode || state.periode));
  if (active) bar.append(h('button', { class: 'chip-btn', type: 'button', onclick: () => onChange({ ...state, kelas: '', kategori: '', tingkat: '' }) }, icon('x'), h('span', { text: 'Reset' })));
  return bar;
}

export function showMore(shown, total, onMore) {
  if (shown >= total) return null;
  return h('div', { class: 'more' }, h('button', { class: 'btn tonal', type: 'button', onclick: onMore, text: `Tampilkan lebih banyak (${fmtNum(total - shown)} lagi)` }));
}

// ------------------------------------------------------------------ WhatsApp orang tua
export function waLink(siswa, text) {
  const n = waNumber(siswa?.hpOrtu);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : '';
}
export function waRecordText(r, siswa, sum) {
  const st = S.settings;
  return `Yth. Bapak/Ibu ${siswa?.ortu || 'Orang Tua/Wali'} dari ${r.nama} (kelas ${r.kelas}),\n\n` +
    `Kami informasikan bahwa pada ${hariOf(r.tanggal)}, ${fmtTgl(r.tanggal)}${r.jam ? ` pukul ${r.jam} ${st.zonaWaktu}` : ''}, ananda melakukan pelanggaran tata tertib:\n` +
    `• ${r.uraian} (${r.poin} poin)\n\n` +
    `Akumulasi poin ananda saat ini: ${sum.total} poin${sum.level ? ` (${sum.level.label})` : ''}.\n` +
    `Mohon bantuan Bapak/Ibu membimbing ananda di rumah. Terima kasih.\n\n— ${me()?.nama || 'Guru'}, ${st.namaSekolah}`;
}

// ------------------------------------------------------------------ detail catatan
export function openRecord(r) {
  const d = D();
  const siswa = d.siswaMap.get(r.siswaId);
  const sum = d.summaries.get(r.siswaId) || { total: 0 };
  const u = me();
  const canEdit = canEditRecord(u, r, S.settings);
  const after = sum.timeline?.find((t) => t.rec.id === r.id);
  sheet((body, close) => {
    const kv = (k, v) => (v ? h('div', { class: 'kv' }, h('span', { class: 'muted', text: k }), h('span', { text: v })) : null);
    const dl = editDeadline(r, S.settings);
    body.append(
      h('div', { class: 'rec-hero' },
        h('span', { class: `rec-pts lg st-${TINGKAT_WARNA[r.tingkat] || 'info'}` }, h('strong', { text: `+${fmtNum(r.poin)}` }), h('span', { text: 'poin' })),
        h('div', { class: 'grow' },
          h('div', { class: 'row gap-sm wrap' }, tingkatBadge(r.tingkat), h('span', { class: 'badge sm st-info', text: `Kategori ${r.kategori}` }), r.batal ? h('span', { class: 'badge sm st-dark', text: 'Dibatalkan' }) : null, isPending('pelanggaran', r.id) ? h('span', { class: 'badge sm st-warn', text: 'Belum tersinkron' }) : null),
          h('p', { class: 'rec-uraian', text: `${r.jenisKode}. ${r.uraian}` }),
          h('p', { class: 'muted small', text: katNama(r.kategori) }))),
      r.batal ? h('div', { class: 'notice warn' }, icon('undo'), h('div', null, h('strong', { text: 'Catatan dibatalkan' }), h('p', { text: `Alasan: ${r.alasanBatal || '-'} · oleh ${r.updatedBy || '-'}` }), h('p', { class: 'small', text: 'Poin catatan ini tidak dihitung.' }))) : null,
      h('div', { class: 'kv-list' },
        kv('Siswa', `${r.nama} · Kelas ${r.kelas}${r.nis ? ' · NIS ' + r.nis : ''}`),
        kv('Waktu', `${fmtTgl(r.tanggal, { hari: true })}${r.jam ? ', ' + r.jam + ' ' + S.settings.zonaWaktu : ''}`),
        kv('Lokasi', r.lokasi), kv('Kronologi', r.kronologi), kv('Saksi', r.saksi), kv('Siswa pelapor', r.pelapor),
        kv('Tindakan langsung', r.tindakanLangsung),
        kv('Akumulasi setelah ini', after && !r.batal ? `${fmtNum(after.after)} poin` : null),
        kv('Dicatat oleh', `${r.guruNama || r.guru || '-'}${r.createdAt ? ' · ' + r.createdAt : ''}`),
        r.updatedBy && r.updatedAt && r.updatedAt !== r.createdAt ? kv('Terakhir diubah', `${r.updatedBy} · ${r.updatedAt}`) : null),
      h('div', { class: 'sheet-actions' },
        btn('Lihat siswa', () => { close(); go('siswa', r.siswaId); }, { ic: 'user' }),
        btn('Cetak BAP', () => printBAP(r), { ic: 'printer' }),
        u && siswa && waLink(siswa, '') && !r.batal ? h('a', { class: 'btn tonal', href: waLink(siswa, waRecordText(r, siswa, sum)), target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'Kabari orang tua' })) : null,
        canEdit && !r.batal ? btn('Ubah', () => { close(); go('catat', 'ubah', r.id); }, { ic: 'edit' }) : null,
        canEdit && !r.batal ? btn('Batalkan', () => cancelRecord(r, close), { ic: 'undo', kind: 'danger-tonal' }) : null,
        r.batal && isMgr(u) ? btn('Pulihkan', () => restoreRecord(r, close), { ic: 'undo' }) : null),
      u && !canEdit && !r.batal && String(r.guru).toLowerCase() === u.username && dl ? h('p', { class: 'muted small', text: `Batas koreksi untuk guru pencatat sudah lewat (${fmtTgl(ymd(dl))} ${hm(dl)}). Hubungi Guru BK/Admin untuk koreksi.` }) : null,
    );
  }, { title: 'Detail pelanggaran' });
}

async function cancelRecord(r, close) {
  const alasan = await prompt('Batalkan catatan?', {
    label: 'Alasan pembatalan', multiline: true, required: true, okLabel: 'Batalkan catatan',
    note: 'Gunakan hanya untuk koreksi salah input (salah siswa, salah jenis, tercatat ganda). Sesuai tata tertib, poin pelanggaran yang sah tidak dapat dikurangi. Catatan tetap tersimpan sebagai riwayat.',
  });
  if (!alasan?.trim()) return;
  await saveRow('pelanggaran', { ...r, batal: true, alasanBatal: alasan.trim() });
  toast('Catatan dibatalkan.');
  close();
}

async function restoreRecord(r, close) {
  if (!(await confirmDialog('Pulihkan catatan?', 'Poin catatan ini akan kembali dihitung dalam akumulasi siswa.', 'Pulihkan'))) return;
  await saveRow('pelanggaran', { ...r, batal: false, alasanBatal: '' });
  toast('Catatan dipulihkan.');
  close();
}
