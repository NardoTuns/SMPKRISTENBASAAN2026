// Laporan: pilih jenis, periode, dan kelas → pratinjau tabel, cetak/simpan PDF, atau unduh CSV (Excel).
import { h, icon, btn, downloadText } from '../ui/dom.js';
import { dataTable } from '../ui/charts.js';
import { emptyState, filterBar, pageHead } from '../ui/widgets.js';
import { go, replaceQuery } from '../ui/nav.js';
import { reportHtml, reportOpts } from '../ui/print.js';
import { runExport, waExport } from '../ui/export.js';
import { S, D, hidden, katNama } from '../store.js';
import { countBy, filterRecords, periodRange, totals } from '../core/stats.js';
import { cmpKelas, cmpNama, fmtBulan, fmtTgl, toCSV, ymd } from '../core/util.js';

export const meta = { title: 'Laporan', live: true };

const JENIS = [
  { kode: 'kelas', label: 'Rekap per kelas', ic: 'school' },
  { kode: 'siswa', label: 'Rekap per siswa', ic: 'users' },
  { kode: 'tahap', label: 'Siswa per tahap sanksi', ic: 'alert' },
  { kode: 'jenis', label: 'Rekap per jenis pelanggaran', ic: 'list' },
  { kode: 'kategori', label: 'Rekap per kategori', ic: 'grid' },
  { kode: 'bulanan', label: 'Rekap bulanan', ic: 'calendar' },
  { kode: 'guru', label: 'Rekap per guru pencatat', ic: 'user' },
  { kode: 'detail', label: 'Daftar pelanggaran (rinci)', ic: 'clipboard' },
  { kode: 'tindak', label: 'Daftar tindak lanjut', ic: 'checklist' },
];

export function render(view, route) {
  if (hidden()) { view.append(emptyState('lock', 'Khusus guru', 'Silakan login untuk membuat laporan.', btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }))); return; }
  const q = route.query;
  const f = { jenis: q.jenis || 'kelas', periode: q.periode || 'semester', from: q.from || '', to: q.to || '', kelas: q.kelas || '', kategori: q.kategori || '', tingkat: q.tingkat || '' };
  const update = (patch) => {
    Object.assign(f, patch);
    replaceQuery(Object.fromEntries(Object.entries(f).filter(([, v]) => v)));
    view.replaceChildren();
    render(view, { ...route, query: { ...f } });
  };

  view.append(pageHead('Laporan', 'Rekap siap cetak untuk rapat, Sidang Dewan Guru, dan arsip sekolah'));
  view.append(h('div', { class: 'report-types' }, ...JENIS.map((j) => h('button', { type: 'button', class: 'report-type' + (j.kode === f.jenis ? ' on' : ''), 'aria-pressed': String(j.kode === f.jenis), onclick: () => update({ jenis: j.kode }) }, icon(j.ic), h('span', { text: j.label })))));
  const fields = f.jenis === 'tahap' ? ['kelas'] : f.jenis === 'kelas' ? ['periode', 'kategori', 'tingkat'] : ['periode', 'kelas', 'kategori', 'tingkat'];
  view.append(filterBar(f, (nf) => update(nf), { fields }));

  const rep = build(f);
  const doc = () => [rep.title, reportHtml(rep), reportOpts(rep)];
  view.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', { class: 'grow' }, h('h3', { text: rep.title }), h('p', { class: 'muted small', text: rep.meta.join(' · ') }))),
    h('div', { class: 'export-bar', role: 'group', 'aria-label': 'Unduh atau bagikan laporan' },
      btn('Unduh PDF', () => runExport('pdf', ...doc()), { kind: 'primary', ic: 'download' }),
      btn('Unduh PNG', () => runExport('png', ...doc()), { ic: 'download' }),
      btn('Kirim WA', () => waExport(...doc()), { kind: 'wa', ic: 'wa' }),
      btn('Cetak', () => runExport('print', ...doc()), { ic: 'printer' }),
      btn('CSV (Excel)', () => downloadText(toCSV([rep.cols, ...rep.rows]), `${rep.title.toLowerCase().replace(/[^\w]+/g, '-')}-${ymd()}.csv`), { ic: 'table', kind: 'text' })),
    rep.summary ? h('div', { class: 'report-summary' }, ...rep.summary.map(([k, v]) => h('div', null, h('span', { class: 'muted small', text: k }), h('strong', { text: v })))) : null,
    dataTable(rep.cols, rep.rows, { numeric: rep.numeric })));
}

function build(f) {
  const d = D();
  const pr = periodRange(f.periode, ymd(), f);
  const recs = filterRecords(S.d.pelanggaran, { from: pr.from, to: pr.to, kelas: f.kelas, kategori: f.kategori, tingkat: f.tingkat });
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
      const sum2 = [['Aman', String(d.aktif.filter((s) => (!f.kelas || s.kelas === f.kelas) && !d.summaries.get(s.id).level).length)], ...d.levels.map((l) => [l.label, String(list.filter((x) => x.m.level.kode === l.kode).length)])];
      return { title: 'Daftar Siswa per Tahap Sanksi', meta, summary: sum2, numeric: [3, 4], note: `Siswa dengan akumulasi di atas ${S.settings.batasSidang} poin wajib diputuskan melalui Sidang Dewan Guru.`,
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
      const list = [...recs].sort((a, b) => (a.tanggal + (a.jam || '') > b.tanggal + (b.jam || '') ? 1 : -1));
      return { title: 'Daftar Pelanggaran Siswa', meta, summary, numeric: [5], landscape: true,
        cols: ['Tanggal', 'Jam', 'Nama', 'Kelas', 'Pelanggaran', 'Poin', 'Tingkat', 'Lokasi', 'Pencatat'],
        rows: list.map((r) => [fmtTgl(r.tanggal, { short: true }), r.jam || '', r.nama, r.kelas, `${r.jenisKode}. ${r.uraian}`, r.poin, r.tingkat, r.lokasi || '', r.guruNama || r.guru]) };
    }
    case 'tindak': {
      const list = d.tindak.filter((x) => (!f.kelas || x.kelas === f.kelas) && (!pr.from || (x.tanggalCapai >= pr.from && x.tanggalCapai <= pr.to)))
        .sort((a, b) => (a.tanggalCapai < b.tanggalCapai ? 1 : -1));
      return { title: 'Daftar Tindak Lanjut Pelanggaran', meta, landscape: true, numeric: [4],
        summary: [['Belum', String(list.filter((x) => x.status === 'Belum').length)], ['Dijadwalkan', String(list.filter((x) => x.status === 'Dijadwalkan').length)], ['Selesai', String(list.filter((x) => x.status === 'Selesai').length)]],
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
