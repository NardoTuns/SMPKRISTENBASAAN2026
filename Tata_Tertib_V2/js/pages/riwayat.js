// Riwayat pelanggaran per tanggal: daftar berkelompok per hari dan tampilan kalender bulanan.
import { h, icon, btn, select, downloadText } from '../ui/dom.js';
import { emptyState, filterBar, pageHead, recordRow, showMore } from '../ui/widgets.js';
import { go, replaceQuery } from '../ui/nav.js';
import { S, D, hidden, me, katNama } from '../store.js';
import { byDate, filterRecords, periodRange, totals } from '../core/stats.js';
import { BULAN, HARI, debounce, fmtNum, fmtTgl, pad2, toCSV, ymd } from '../core/util.js';

export const meta = { title: 'Riwayat', live: true };

let limitDays = 20;
let calMonth = null;

export function render(view, route) {
  if (hidden()) { view.append(emptyState('lock', 'Khusus guru', 'Silakan login untuk melihat riwayat.', btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }))); return; }
  const q = route.query;
  const f = {
    periode: q.periode || '30h', from: q.from || '', to: q.to || '', kelas: q.kelas || '', kategori: q.kategori || '', tingkat: q.tingkat || '',
    jenis: q.jenis || '', guru: q.guru || '', q: q.q || '', status: q.status || 'aktif', saya: q.saya || '', tampil: q.tampil || 'daftar',
  };
  const u = me();
  const d = D();
  const update = (patch) => {
    Object.assign(f, patch);
    limitDays = 20;
    replaceQuery(Object.fromEntries(Object.entries(f).filter(([k, v]) => v && !(k === 'periode' && v === '30h') && !(k === 'status' && v === 'aktif') && !(k === 'tampil' && v === 'daftar'))));
    const typing = document.activeElement?.getAttribute('aria-label') === 'Cari';
    const y = scrollY; view.replaceChildren(); render(view, { ...route, query: { ...f } }); scrollTo(0, y);
    if (typing) { const el = view.querySelector('input[aria-label="Cari"]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  };

  const pr = periodRange(f.periode, ymd(), f);
  const recs = filterRecords(S.d.pelanggaran, {
    from: f.tampil === 'kalender' ? '' : pr.from, to: f.tampil === 'kalender' ? '' : pr.to, kelas: f.kelas, kategori: f.kategori, tingkat: f.tingkat,
    jenis: f.jenis, guru: f.saya && u ? u.username : f.guru, q: f.q, batal: f.status,
  });
  const t = totals(recs.filter((r) => !r.batal));

  view.append(pageHead('Riwayat Pelanggaran', f.tampil === 'kalender' ? 'Kalender kejadian per hari' : `${pr.label} · ${fmtNum(recs.length)} catatan · ${fmtNum(t.poin)} poin · ${fmtNum(t.siswa)} siswa`,
    h('div', { class: 'seg', role: 'tablist' },
      h('button', { type: 'button', role: 'tab', class: f.tampil === 'daftar' ? 'on' : '', 'aria-selected': String(f.tampil === 'daftar'), onclick: () => update({ tampil: 'daftar' }) }, icon('list'), h('span', { text: 'Daftar' })),
      h('button', { type: 'button', role: 'tab', class: f.tampil === 'kalender' ? 'on' : '', 'aria-selected': String(f.tampil === 'kalender'), onclick: () => update({ tampil: 'kalender' }) }, icon('calendar'), h('span', { text: 'Kalender' }))),
    btn('CSV', () => exportCsv(recs, pr.label), { ic: 'download', kind: 'text', title: 'Unduh (Excel)' })));

  const guruOpts = [...new Map(S.d.pelanggaran.filter((r) => r.guru).map((r) => [r.guru, r.guruNama || r.guru])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const extra = [
    h('label', { class: 'fsel search' }, icon('search'), h('input', { type: 'search', placeholder: 'Cari siswa / pelanggaran…', value: f.q, 'aria-label': 'Cari', oninput: debounce((e) => update({ q: e.target.value }), 300) })),
    h('label', { class: 'fsel' }, icon('user'), select([{ value: '', label: 'Semua pencatat' }, ...guruOpts.map(([v, l]) => ({ value: v, label: l }))], f.guru, (v) => update({ guru: v, saya: '' }), { 'aria-label': 'Guru pencatat' })),
    h('label', { class: 'fsel' }, icon('filter'), select([{ value: 'aktif', label: 'Catatan berlaku' }, { value: 'batal', label: 'Yang dibatalkan' }, { value: 'semua', label: 'Semua catatan' }], f.status, (v) => update({ status: v }), { 'aria-label': 'Status catatan' })),
    u ? h('label', { class: 'switch small' }, h('input', { type: 'checkbox', checked: !!f.saya, onchange: (e) => update({ saya: e.target.checked ? '1' : '', guru: '' }) }), h('span', { text: 'Catatan saya' })) : null,
  ].filter(Boolean);
  if (f.jenis) extra.unshift(h('button', { class: 'chip-btn on', type: 'button', onclick: () => update({ jenis: '' }) }, h('span', { text: `Jenis ${f.jenis}: ${d.jenisMap.get(f.jenis)?.uraian?.slice(0, 32) || ''}…` }), icon('x')));
  view.append(filterBar(f, (nf) => update(nf), { fields: f.tampil === 'kalender' ? ['kelas', 'kategori', 'tingkat'] : ['periode', 'kelas', 'kategori', 'tingkat'], extra }));

  if (f.tampil === 'kalender') { view.append(calendar(recs, (day) => update({ tampil: 'daftar', periode: 'kustom', from: day, to: day }))); return; }

  if (!recs.length) {
    view.append(emptyState('calendar', 'Tidak ada catatan', 'Tidak ada pelanggaran yang cocok dengan penyaring pada periode ini.', u ? btn('Catat pelanggaran', () => go('catat'), { kind: 'primary', ic: 'plus' }) : null));
    return;
  }
  const groups = byDate(recs);
  const wrap = h('div', { class: 'day-groups' });
  view.append(wrap);
  const draw = () => {
    wrap.replaceChildren(...groups.slice(0, limitDays).map((g) => h('section', { class: 'card day-group' },
      h('div', { class: 'day-head' }, h('div', { class: 'day-date' }, h('strong', { text: fmtTgl(g.tanggal, { hari: true }) })),
        h('span', { class: 'muted small', text: `${g.list.filter((r) => !r.batal).length} pelanggaran · ${fmtNum(g.poin)} poin` })),
      h('div', { class: 'list' }, ...g.list.map((r) => recordRow(r))))),
    showMore(limitDays, groups.length, () => { limitDays += 30; draw(); }));
  };
  draw();
}

function calendar(recs, onDay) {
  const today = ymd();
  if (!calMonth) calMonth = today.slice(0, 7);
  const box = h('section', { class: 'card cal' });
  const draw = () => {
    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const counts = new Map();
    const poin = new Map();
    for (const r of recs) if (r.tanggal.startsWith(calMonth) && !r.batal) { counts.set(r.tanggal, (counts.get(r.tanggal) || 0) + 1); poin.set(r.tanggal, (poin.get(r.tanggal) || 0) + (Number(r.poin) || 0)); }
    const max = Math.max(1, ...counts.values());
    const monthTotal = [...counts.values()].reduce((a, b) => a + b, 0);
    const shift = (n) => { const dd = new Date(y, m - 1 + n, 1); calMonth = `${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}`; draw(); };
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-cell out' }));
    for (let dd = 1; dd <= days; dd++) {
      const key = `${calMonth}-${pad2(dd)}`;
      const n = counts.get(key) || 0;
      const lvl = n ? Math.min(5, 1 + Math.floor((n / max) * 4.999)) : 0;
      cells.push(h('button', {
        class: `cal-cell${key === today ? ' today' : ''}${n ? ' has' : ''}${lvl >= 4 ? ' hi' : ''}`, type: 'button', disabled: !n, onclick: () => onDay(key),
        style: lvl ? { '--cal-bg': `var(--seq-${lvl})` } : null,
        'aria-label': `${fmtTgl(key, { hari: true })}: ${n} pelanggaran`, title: n ? `${n} pelanggaran · ${poin.get(key)} poin` : '',
      }, h('span', { class: 'cal-d', text: String(dd) }), n ? h('span', { class: 'cal-n', text: String(n) }) : null));
    }
    box.replaceChildren(
      h('div', { class: 'cal-head' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Bulan sebelumnya', onclick: () => shift(-1) }, icon('left')),
        h('div', { class: 'grow center' }, h('strong', { text: `${BULAN[m - 1]} ${y}` }), h('div', { class: 'muted small', text: `${monthTotal} pelanggaran` })),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Bulan berikutnya', onclick: () => shift(1) }, icon('right'))),
      h('div', { class: 'cal-grid' }, ...[1, 2, 3, 4, 5, 6, 0].map((i) => h('span', { class: 'cal-dow', text: HARI[i].slice(0, 3) })), ...cells),
      h('p', { class: 'muted small', text: 'Ketuk tanggal untuk melihat daftar pelanggaran hari itu. Warna lebih pekat = lebih banyak pelanggaran.' }));
  };
  draw();
  return box;
}

function exportCsv(recs, label) {
  const rows = [['Tanggal', 'Jam', 'NIS', 'Nama Siswa', 'Kelas', 'Kode', 'Bentuk Pelanggaran', 'Kategori', 'Tingkat', 'Poin', 'Lokasi', 'Kronologi', 'Saksi', 'Siswa Pelapor', 'Tindakan Langsung', 'Dicatat Oleh', 'Dibuat Pada', 'Dibatalkan', 'Alasan Pembatalan']];
  for (const r of [...recs].sort((a, b) => (a.tanggal + (a.jam || '') > b.tanggal + (b.jam || '') ? 1 : -1))) {
    rows.push([r.tanggal, r.jam, r.nis, r.nama, r.kelas, r.jenisKode, r.uraian, `${r.kategori}. ${katNama(r.kategori)}`, r.tingkat, r.poin, r.lokasi, r.kronologi, r.saksi, r.pelapor, r.tindakanLangsung, r.guruNama || r.guru, r.createdAt, r.batal ? 'Ya' : 'Tidak', r.alasanBatal]);
  }
  downloadText(toCSV(rows), `riwayat-pelanggaran-${label.replace(/[^\w]+/g, '-').toLowerCase()}.csv`);
}
