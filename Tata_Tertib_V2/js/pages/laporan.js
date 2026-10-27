// Laporan dalam 3 langkah: (1) pilih laporan — Harian · Rekap · Daftar, (2) atur tanggal/periode & kelas,
// (3) lihat hasil lalu unduh PDF/PNG, kirim WA, cetak, atau unduh CSV (Excel).
// Catatan kronologi kejadian ikut di setiap laporan bila guru login (kolom, atau lampiran untuk rekap).
import { h, icon, btn, iconBtn, downloadText } from '../ui/dom.js';
import { dataTable } from '../ui/charts.js';
import { emptyState, filterBar, levelBadge, pageHead, recordRow, showMore } from '../ui/widgets.js';
import { go, replaceQuery } from '../ui/nav.js';
import { kronOf, reportHtml, reportOpts } from '../ui/print.js';
import { openDoc, runExport, waExport } from '../ui/export.js';
import { S, D, hidden, me, katNama } from '../store.js';
import { countBy, filterRecords, periodRange, totals } from '../core/stats.js';
import { byTime } from '../core/points.js';
import { addDays, cmpKelas, cmpNama, daysBetween, fmtBulan, fmtNum, fmtTgl, isYmd, toCSV, ymd } from '../core/util.js';

export const meta = { title: 'Laporan', live: true };

const GRUP = [
  { kode: 'harian', label: 'Harian', ic: 'calendar', awal: 'harian' },
  { kode: 'rekap', label: 'Rekap', ic: 'chart', awal: 'kelas' },
  { kode: 'daftar', label: 'Daftar', ic: 'list', awal: 'detail' },
];
const JENIS = [
  { kode: 'harian', grup: 'harian', label: 'Laporan harian', ic: 'calendar', ket: 'Semua pelanggaran pada tanggal yang dipilih, lengkap dengan kronologi kejadian.' },
  { kode: 'kelas', grup: 'rekap', label: 'Per kelas', ic: 'school', ket: 'Jumlah pelanggaran dan poin tiap kelas.' },
  { kode: 'siswa', grup: 'rekap', label: 'Per siswa', ic: 'users', ket: 'Pelanggaran dan poin tiap siswa beserta tahap sanksinya.' },
  { kode: 'jenis', grup: 'rekap', label: 'Per jenis pelanggaran', ic: 'list', ket: 'Bentuk pelanggaran yang terjadi dan seberapa sering.' },
  { kode: 'kategori', grup: 'rekap', label: 'Per kategori', ic: 'grid', ket: 'Pelanggaran dikelompokkan per kategori tata tertib.' },
  { kode: 'bulanan', grup: 'rekap', label: 'Bulanan', ic: 'calendar', ket: 'Jumlah pelanggaran tiap bulan.' },
  { kode: 'guru', grup: 'rekap', label: 'Per guru pencatat', ic: 'user', ket: 'Jumlah catatan dari setiap guru.' },
  { kode: 'detail', grup: 'daftar', label: 'Pelanggaran (rinci)', ic: 'clipboard', ket: 'Setiap pelanggaran satu per satu, beserta kronologinya.' },
  { kode: 'tahap', grup: 'daftar', label: 'Siswa per tahap sanksi', ic: 'alert', ket: 'Siswa yang sudah mencapai tahap sanksi (akumulasi seluruh masa sekolah).' },
  { kode: 'tindak', grup: 'daftar', label: 'Tindak lanjut', ic: 'checklist', ket: 'Surat peringatan / pemanggilan beserta status pelaksanaannya.' },
];

let moreFilters = false; // kategori & tingkat disembunyikan sampai diminta
let listLimit = 30;

export function render(view, route) {
  if (hidden()) { view.append(emptyState('lock', 'Khusus guru', 'Silakan login untuk membuat laporan.', btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }))); return; }
  const q = route.query;
  const f = {
    jenis: JENIS.some((j) => j.kode === q.jenis) ? q.jenis : 'harian', tgl: isYmd(q.tgl) ? q.tgl : ymd(),
    periode: q.periode || 'semester', from: q.from || '', to: q.to || '', kelas: q.kelas || '', kategori: q.kategori || '', tingkat: q.tingkat || '', kron: q.kron || '',
  };
  const update = (patch) => {
    Object.assign(f, patch);
    listLimit = 30;
    replaceQuery(Object.fromEntries(Object.entries(f).filter(([k, v]) => v && !(k === 'tgl' && v === ymd()))));
    const y = scrollY; view.replaceChildren(); render(view, { ...route, query: { ...f } }); scrollTo(0, y);
  };
  const u = me();
  const cur = JENIS.find((j) => j.kode === f.jenis);

  view.append(pageHead('Laporan', 'Pilih laporan, atur tanggal atau periode, lalu unduh PDF atau kirim ke WhatsApp.'));

  // ---- 1. pilih laporan
  view.append(h('section', { class: 'rep-block' }, stepLabel(1, 'Pilih laporan'),
    h('div', { class: 'seg lg', role: 'tablist', 'aria-label': 'Kelompok laporan' }, ...GRUP.map((g) => h('button', {
      type: 'button', role: 'tab', class: g.kode === cur.grup ? 'on' : '', 'aria-selected': String(g.kode === cur.grup),
      onclick: () => { if (g.kode !== cur.grup) update({ jenis: g.awal }); },
    }, icon(g.ic), h('span', { text: g.label })))),
    cur.grup === 'harian' ? null : h('div', { class: 'chips rep-chips' }, ...JENIS.filter((j) => j.grup === cur.grup).map((j) => h('button', {
      type: 'button', class: 'chip' + (j.kode === f.jenis ? ' on' : ''), 'aria-pressed': String(j.kode === f.jenis), onclick: () => update({ jenis: j.kode }),
    }, icon(j.ic), h('span', { text: j.label })))),
    h('p', { class: 'muted small', text: cur.ket })));

  // ---- 2. tanggal / periode & kelas
  const atur = h('section', { class: 'rep-block' }, stepLabel(2, f.jenis === 'harian' ? 'Pilih tanggal & kelas' : f.jenis === 'tahap' ? 'Pilih kelas' : 'Atur periode & kelas'));
  if (f.jenis === 'harian') atur.append(dayPicker(f, update));
  else {
    const lainnya = moreFilters || !!(f.kategori || f.tingkat);
    const fields = f.jenis === 'tahap' ? ['kelas'] : [...(f.jenis === 'kelas' ? ['periode'] : ['periode', 'kelas']), ...(lainnya ? ['kategori', 'tingkat'] : [])];
    const extra = f.jenis === 'tahap' || lainnya ? [] : [h('button', { class: 'chip-btn', type: 'button', onclick: () => { moreFilters = true; update({}); } }, icon('filter'), h('span', { text: 'Filter lain' }))];
    atur.append(filterBar(f, (nf) => update(nf), { fields, extra }));
  }
  if (u && !['harian', 'detail'].includes(f.jenis)) {
    atur.append(h('label', { class: 'switch small rep-kron' },
      h('input', { type: 'checkbox', checked: f.kron !== '0', onchange: (e) => update({ kron: e.target.checked ? '' : '0' }) }),
      h('span', { text: 'Sertakan catatan kronologi kejadian (lampiran)' })));
  }
  view.append(atur);

  // ---- 3. hasil
  const rep = build(f);
  const doc = () => [rep.title, reportHtml(rep), reportOpts(rep)];
  const csvName = `${(rep.fileBase || `${rep.title} ${ymd()}`).toLowerCase().replace(/[^\w]+/g, '-')}.csv`;
  view.append(h('section', { class: 'card rep-result' },
    stepLabel(3, 'Hasil — unduh atau kirim'),
    h('div', { class: 'card-head' },
      h('div', { class: 'grow' }, h('h3', { text: rep.title }), h('p', { class: 'muted small', text: rep.meta.join(' · ') }))),
    h('div', { class: 'report-actions' },
      h('div', { class: 'export-bar', role: 'group', 'aria-label': 'Unduh atau bagikan laporan' },
        btn('Unduh PDF', () => runExport('pdf', ...doc()), { kind: 'primary', ic: 'download' }),
        btn('Kirim WA', () => waExport(...doc()), { kind: 'wa', ic: 'wa' }),
        btn('Cetak', () => runExport('print', ...doc()), { ic: 'printer' })),
      h('div', { class: 'export-more' },
        btn('Lihat pratinjau', () => openDoc(...doc()), { kind: 'text', small: true, ic: 'eye' }),
        btn('Unduh PNG', () => runExport('png', ...doc()), { kind: 'text', small: true, ic: 'download' }),
        btn('CSV (Excel)', () => downloadText(toCSV(csvRows(rep)), csvName), { kind: 'text', small: true, ic: 'table' }))),
    rep.summary ? h('div', { class: 'report-summary' }, ...rep.summary.map(([k, v]) => h('div', null, h('span', { class: 'muted small', text: k }), h('strong', { text: v })))) : null,
    ...(f.jenis === 'harian' ? harianView(rep, u) : tabelView(rep, f, u))));
}

const stepLabel = (n, text) => h('div', { class: 'rep-step' }, h('span', { class: 'n', text: String(n) }), h('span', { text }));

// ------------------------------------------------------------------ tampilan hasil
function harianView(rep, u) {
  const out = [];
  if (!rep.list.length) {
    out.push(emptyState('shield', 'Tidak ada pelanggaran', `Tidak ada pelanggaran tercatat pada ${fmtTgl(rep.tgl, { hari: true })}.`,
      u ? btn('Catat pelanggaran', () => go('catat'), { kind: 'primary', ic: 'plus' }) : null));
  } else {
    out.push(h('h3', { class: 'rep-sec', text: `Daftar pelanggaran (${rep.list.length})` }), recList(rep.list));
    if (!u) out.push(kronLocked());
  }
  for (const s of rep.sections) out.push(h('h3', { class: 'rep-sec', text: s.title }), s.items ? capaiList(s.items) : dataTable(s.cols, s.rows, { numeric: s.numeric }));
  return out;
}

/** Siswa yang mencapai tahap sanksi (tabelnya terlalu lebar untuk layar HP, jadi tampil sebagai daftar). */
const capaiList = (items) => h('div', { class: 'list rep-recs' }, ...items.map((x) => h('button', { class: 'row-item', type: 'button', onclick: () => go('siswa', x.siswaId) },
  h('div', { class: 'grow min0' },
    h('div', { class: 'row-title' }, h('span', { class: 'ellipsis', text: x.nama }), h('span', { class: 'muted small', text: x.kelas })),
    h('div', { class: 'row-sub muted' }, h('span', { text: `Akumulasi ${x.poinSaat} poin` }), h('span', { text: `Tindak lanjut: ${x.status}` }))),
  levelBadge(x.level, { small: true }))));

function tabelView(rep, f, u) {
  const out = [dataTable(rep.cols, rep.rows, { numeric: rep.numeric })];
  if (rep.note) out.push(h('p', { class: 'muted small rep-note', text: rep.note }));
  if (!u) out.push(kronLocked());
  else if (rep.kronologi.length) {
    // Dilipat agar halaman tetap ringkas; di dokumen selalu ikut sebagai lampiran.
    out.push(h('details', { class: 'rule-group rep-kron-box' },
      h('summary', null, icon('clipboard'), h('span', { class: 'grow' }, h('span', { class: 'block', text: `Catatan kronologi kejadian (${rep.kronologi.length})` }),
        h('span', { class: 'muted small', text: 'Ketuk untuk melihat · ikut dicetak sebagai lampiran' })), icon('down')),
      recList(rep.kronologi)));
  } else if (f.jenis !== 'detail' && f.kron !== '0') {
    out.push(h('p', { class: 'muted small rep-note', text: 'Tidak ada catatan kronologi pada laporan ini (kronologi diisi saat mencatat pelanggaran).' }));
  }
  return out;
}

const kronLocked = () => h('div', { class: 'notice sm' }, icon('lock'), h('span', { text: 'Catatan kronologi hanya tampil untuk guru yang login.' }));

/** Daftar catatan + kronologinya; ketuk catatan untuk detail. */
function recList(recs) {
  const u = me();
  const box = h('div', { class: 'list rep-recs' });
  const item = (r) => h('div', { class: 'rep-rec' }, recordRow(r),
    r.kronologi ? h('p', { class: 'kron-note' }, h('strong', { text: 'Kronologi: ' }), h('span', { text: r.kronologi }))
      : u ? h('p', { class: 'kron-note none', text: 'Kronologi belum diisi.' }) : null);
  const draw = () => box.replaceChildren(...recs.slice(0, listLimit).map(item), showMore(listLimit, recs.length, () => { listLimit += 50; draw(); }));
  draw();
  return box;
}

function dayPicker(f, update) {
  const today = ymd();
  const tgl = f.tgl;
  const rel = tgl === today ? 'Hari ini' : tgl === addDays(today, -1) ? 'Kemarin' : tgl < today ? `${fmtNum(daysBetween(tgl, today))} hari lalu` : '';
  // Laporan harian hanya disaring per kelas (kategori/tingkat dari laporan lain tidak berlaku di sini).
  const bar = filterBar({ kelas: f.kelas }, (nf) => update({ kelas: nf.kelas }), { fields: ['kelas'] });
  bar.prepend(h('label', { class: 'fsel date' }, icon('calendar'),
    h('input', { type: 'date', value: tgl, max: today, 'aria-label': 'Pilih tanggal', onchange: (e) => { if (isYmd(e.target.value)) update({ tgl: e.target.value }); } })));
  return h('div', { class: 'day-pick' },
    h('div', { class: 'day-nav' },
      iconBtn('left', 'Hari sebelumnya', () => update({ tgl: addDays(tgl, -1) })),
      h('div', { class: 'day-now' }, h('strong', { text: fmtTgl(tgl, { hari: true }) }),
        rel ? h('span', { class: 'muted small', text: rel }) : null,
        tgl !== today ? h('button', { class: 'chip-btn', type: 'button', onclick: () => update({ tgl: today }) }, icon('calendar'), h('span', { text: 'Kembali ke hari ini' })) : null),
      iconBtn('right', 'Hari berikutnya', () => update({ tgl: addDays(tgl, 1) }), { disabled: tgl >= today })),
    bar);
}

// ------------------------------------------------------------------ CSV
const KRON_COLS = ['Tanggal', 'Jam', 'NIS', 'Nama', 'Kelas', 'Pelanggaran', 'Poin', 'Kronologi'];
const kronRow = (r) => [r.tanggal, r.jam || '', r.nis || '', r.nama, r.kelas, `${r.jenisKode}. ${r.uraian}`, r.poin, r.kronologi];

function csvRows(rep) {
  const rows = [rep.cols, ...rep.rows];
  for (const s of rep.sections || []) rows.push([], [s.title], s.cols, ...s.rows);
  if (rep.kronologi?.length) rows.push([], ['Catatan kronologi kejadian'], KRON_COLS, ...rep.kronologi.map(kronRow));
  return rows;
}

// ------------------------------------------------------------------ isi laporan
function build(f) {
  if (f.jenis === 'harian') return harian(f);
  const pr = periodRange(f.periode, ymd(), f);
  const recs = filterRecords(S.d.pelanggaran, { from: pr.from, to: pr.to, kelas: f.kelas, kategori: f.kategori, tingkat: f.tingkat });
  const rep = tabel(f, pr, recs);
  rep.sections = [];
  rep.kronologi = f.kron === '0' || f.jenis === 'detail' ? [] : kronOf(rep.kronSrc || recs);
  return rep;
}

/** Laporan harian: semua pelanggaran pada satu tanggal + kronologi, rekap kelas, dan tahap sanksi yang tercapai. */
function harian(f) {
  const d = D();
  const u = me();
  const tgl = f.tgl;
  const recs = filterRecords(S.d.pelanggaran, { from: tgl, to: tgl, kelas: f.kelas }).sort(byTime);
  const t = totals(recs);
  const sections = [];
  const byKelas = countBy(recs, (r) => r.kelas).sort((a, b) => cmpKelas(a.key, b.key));
  if (!f.kelas && byKelas.length) sections.push({ title: 'Rekap per kelas', cols: ['Kelas', 'Pelanggaran', 'Siswa', 'Total poin'], numeric: [1, 2, 3], rows: byKelas.map((x) => [x.key, x.n, x.nSiswa, x.poin]) });
  const capai = d.tindak.filter((x) => x.berlaku && x.tanggalCapai === tgl && (!f.kelas || x.kelas === f.kelas)).sort((a, b) => cmpKelas(a.kelas, b.kelas) || cmpNama(a.nama, b.nama));
  if (capai.length) sections.push({ title: 'Siswa yang mencapai tahap sanksi baru', items: capai, cols: ['Nama', 'Kelas', 'Tahap', 'Akumulasi poin', 'Tindakan', 'Status'], numeric: [3],
    rows: capai.map((x) => [x.nama, x.kelas, x.level?.label || x.tahap, x.poinSaat, x.level?.tindakan || '', x.status]) });
  const summary = [['Pelanggaran', fmtNum(t.n)], ['Total poin', fmtNum(t.poin)], ['Siswa terlibat', fmtNum(t.siswa)], ['Ringan / Sedang / Berat', `${t.ringan} / ${t.sedang} / ${t.berat}`]];
  return {
    title: 'Laporan Harian Pelanggaran Tata Tertib', fileBase: `Laporan Harian ${tgl}`, tgl, list: recs, landscape: true, numeric: [4],
    meta: [fmtTgl(tgl, { hari: true }), f.kelas ? `Kelas ${f.kelas}` : 'Semua kelas', `TA ${S.settings.tahunAjaran}`],
    summary, tiles: summary, sections, kronologi: [],
    cols: ['Jam', 'Nama siswa', 'Kelas', 'Pelanggaran', 'Poin', 'Lokasi', ...(u ? ['Kronologi'] : []), 'Tindakan langsung', 'Pencatat'],
    rows: recs.map((r) => [r.jam || '-', r.nama, r.kelas, `${r.jenisKode}. ${r.uraian} (${r.tingkat})`, r.poin, r.lokasi || '', ...(u ? [r.kronologi || '-'] : []), r.tindakanLangsung || '', r.guruNama || r.guru]),
  };
}

function tabel(f, pr, recs) {
  const d = D();
  const t = totals(recs);
  const meta = [f.jenis === 'tahap' ? 'Akumulasi seluruh masa sekolah' : `Periode: ${pr.label}${pr.from ? ` (${fmtTgl(pr.from, { short: true })} – ${fmtTgl(pr.to, { short: true })})` : ''}`,
    f.kelas ? `Kelas ${f.kelas}` : 'Semua kelas', f.kategori ? `Kategori ${f.kategori}. ${katNama(f.kategori)}` : '', f.tingkat ? `Pelanggaran ${f.tingkat}` : '', `TA ${S.settings.tahunAjaran}`].filter(Boolean);
  const summary = [['Pelanggaran', String(t.n)], ['Total poin', String(t.poin)], ['Siswa terlibat', String(t.siswa)], ['Ringan / Sedang / Berat', `${t.ringan} / ${t.sedang} / ${t.berat}`]];
  const r1 = (x) => Math.round(x * 10) / 10;

  switch (f.jenis) {
    case 'siswa': {
      const by = new Map(countBy(recs, (r) => r.siswaId).map((g) => [g.key, g]));
      const list = S.d.siswa.filter((s) => (!f.kelas || s.kelas === f.kelas) && ((s.status || 'Aktif') === 'Aktif' || by.has(s.id)))
        .sort((a, b) => cmpKelas(a.kelas, b.kelas) || cmpNama(a.nama, b.nama));
      return { title: 'Rekap Pelanggaran per Siswa', meta, summary, landscape: true, numeric: [4, 5, 6, 7, 8, 9],
        cols: ['NIS', 'Nama', 'Kelas', 'L/P', 'Pelanggaran', 'Ringan', 'Sedang', 'Berat', 'Poin periode', 'Total akumulasi', 'Tahap'],
        rows: list.map((s) => { const g = by.get(s.id); const m = d.summaries.get(s.id); return [s.nis || '', s.nama, s.kelas, s.jk || '', g?.n || 0, g?.ringan || 0, g?.sedang || 0, g?.berat || 0, g?.poin || 0, m.total, m.level?.label || 'Aman']; }) };
    }
    case 'tahap': {
      const list = d.aktif.filter((s) => !f.kelas || s.kelas === f.kelas).map((s) => ({ s, m: d.summaries.get(s.id) })).filter((x) => x.m.level)
        .sort((a, b) => b.m.total - a.m.total || cmpNama(a.s.nama, b.s.nama));
      const ids = new Set(list.map((x) => x.s.id));
      const sum2 = [['Aman', String(d.aktif.filter((s) => (!f.kelas || s.kelas === f.kelas) && !d.summaries.get(s.id).level).length)], ...d.levels.map((l) => [l.label, String(list.filter((x) => x.m.level.kode === l.kode).length)])];
      return { title: 'Daftar Siswa per Tahap Sanksi', meta, summary: sum2, numeric: [3, 4], note: `Siswa dengan akumulasi di atas ${S.settings.batasSidang} poin wajib diputuskan melalui Sidang Dewan Guru.`,
        kronSrc: S.d.pelanggaran.filter((r) => ids.has(r.siswaId)),
        cols: ['Nama', 'Kelas', 'NIS', 'Pelanggaran', 'Total poin', 'Tahap', 'Tindakan', 'Tindak lanjut'],
        rows: list.map(({ s, m }) => { const tl = d.tindak.find((x) => x.siswaId === s.id && x.tahap === m.level.kode); return [s.nama, s.kelas, s.nis || '', m.count, m.total, m.level.label, m.level.tindakan, tl ? tl.status : 'Belum']; }) };
    }
    case 'jenis': {
      const g = countBy(recs, (r) => r.jenisKode);
      return { title: 'Rekap per Jenis Pelanggaran', meta, summary, numeric: [4, 5, 6], landscape: true,
        cols: ['Kode', 'Bentuk pelanggaran', 'Kategori', 'Tingkat', 'Kejadian', 'Siswa', 'Total poin'],
        rows: g.map((x) => { const j = d.jenisMap.get(String(x.key)); const r = recs.find((y) => y.jenisKode === x.key); return [x.key, j?.uraian || r?.uraian || '', `${r?.kategori}. ${katNama(r?.kategori)}`, j?.tingkat || r?.tingkat || '', x.n, x.nSiswa, x.poin]; }) };
    }
    case 'kategori': {
      const g = new Map(countBy(recs, (r) => r.kategori).map((x) => [x.key, x]));
      return { title: 'Rekap per Kategori Pelanggaran', meta, summary, numeric: [1, 2, 3, 4],
        cols: ['Kategori', 'Kejadian', 'Siswa', 'Total poin', '% kejadian'],
        rows: d.kategori.map((k) => { const x = g.get(k.kode); return [`${k.kode}. ${k.nama}`, x?.n || 0, x?.nSiswa || 0, x?.poin || 0, t.n ? r1(((x?.n || 0) / t.n) * 100) : 0]; }) };
    }
    case 'bulanan': {
      const g = countBy(recs, (r) => r.tanggal.slice(0, 7)).sort((a, b) => (a.key < b.key ? -1 : 1));
      return { title: 'Rekap Pelanggaran Bulanan', meta, summary, numeric: [1, 2, 3, 4, 5, 6],
        cols: ['Bulan', 'Kejadian', 'Siswa', 'Total poin', 'Ringan', 'Sedang', 'Berat'],
        rows: g.map((x) => [fmtBulan(x.key), x.n, x.nSiswa, x.poin, x.ringan, x.sedang, x.berat]) };
    }
    case 'guru': {
      const g = countBy(recs, (r) => r.guruNama || r.guru);
      return { title: 'Rekap per Guru Pencatat', meta, summary, numeric: [1, 2, 3],
        cols: ['Guru', 'Catatan', 'Siswa', 'Total poin'], rows: g.map((x) => [x.key, x.n, x.nSiswa, x.poin]) };
    }
    case 'detail': {
      const u = me();
      const list = [...recs].sort((a, b) => (a.tanggal + (a.jam || '') > b.tanggal + (b.jam || '') ? 1 : -1));
      return { title: 'Daftar Pelanggaran Siswa', meta, summary, numeric: [5], landscape: true,
        cols: ['Tanggal', 'Jam', 'Nama', 'Kelas', 'Pelanggaran', 'Poin', 'Tingkat', 'Lokasi', ...(u ? ['Kronologi'] : []), 'Pencatat'],
        rows: list.map((r) => [fmtTgl(r.tanggal, { short: true }), r.jam || '', r.nama, r.kelas, `${r.jenisKode}. ${r.uraian}`, r.poin, r.tingkat, r.lokasi || '', ...(u ? [r.kronologi || '-'] : []), r.guruNama || r.guru]) };
    }
    case 'tindak': {
      const list = d.tindak.filter((x) => (!f.kelas || x.kelas === f.kelas) && (!pr.from || (x.tanggalCapai >= pr.from && x.tanggalCapai <= pr.to)))
        .sort((a, b) => (a.tanggalCapai < b.tanggalCapai ? 1 : -1));
      const ids = new Set(list.map((x) => x.siswaId));
      return { title: 'Daftar Tindak Lanjut Pelanggaran', meta, landscape: true, numeric: [4],
        summary: [['Belum', String(list.filter((x) => x.status === 'Belum').length)], ['Dijadwalkan', String(list.filter((x) => x.status === 'Dijadwalkan').length)], ['Selesai', String(list.filter((x) => x.status === 'Selesai').length)]],
        kronSrc: filterRecords(S.d.pelanggaran, { from: pr.from, to: pr.to, kelas: f.kelas }).filter((r) => ids.has(r.siswaId)),
        cols: ['Nama', 'Kelas', 'Tahap', 'Tanggal tercapai', 'Poin', 'Status', 'Pelaksanaan', 'Nomor surat', 'Petugas', 'Catatan'],
        rows: list.map((x) => [x.nama, x.kelas, x.level?.label || x.tahapLabel || x.tahap, fmtTgl(x.tanggalCapai, { short: true }), x.poinSaat, x.status, x.tanggalPelaksanaan ? fmtTgl(x.tanggalPelaksanaan, { short: true }) : '', x.nomorSurat || '', x.petugas || '', x.catatan || '']) };
    }
    default: {
      const g = new Map(countBy(recs, (r) => r.kelas).map((x) => [x.key, x]));
      return { title: 'Rekap Pelanggaran per Kelas', meta, summary, numeric: [1, 2, 3, 4, 5, 6, 7, 8], landscape: true,
        cols: ['Kelas', 'Siswa aktif', 'Siswa melanggar', 'Kejadian', 'Ringan', 'Sedang', 'Berat', 'Total poin', 'Rata-rata poin/siswa'],
        rows: d.kelasList.map((k) => { const x = g.get(k); const n = d.aktif.filter((s) => s.kelas === k).length; return [k, n, x?.nSiswa || 0, x?.n || 0, x?.ringan || 0, x?.sedang || 0, x?.berat || 0, x?.poin || 0, n ? r1((x?.poin || 0) / n) : 0]; }) };
    }
  }
}
