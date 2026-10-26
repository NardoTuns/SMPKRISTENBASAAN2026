// Kelas: ringkasan semua kelas dan rekap lengkap per kelas.
import { h, icon, btn } from '../ui/dom.js';
import { barList, chartCard, columnChart, stackBar } from '../ui/charts.js';
import { emptyState, filterBar, pageHead, recordRow, statTile, studentRow, deltaChip } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { printReport } from '../ui/print.js';
import { S, D, hidden, katNama } from '../store.js';
import { countBy, filterRecords, periodRange, totals, trend } from '../core/stats.js';
import { cmpNama, fmtNum, ymd } from '../core/util.js';

export const meta = { title: 'Kelas', live: true };

let F = { periode: 'semester', kategori: '', tingkat: '' };

const waliOf = (kelas) => S.d.users.filter((u) => u.peran === 'Wali Kelas' && String(u.kelasWali || '').toLowerCase().split(/[,;]\s*/).includes(String(kelas).toLowerCase())).map((u) => u.nama);

export function render(view, route) {
  if (hidden()) { view.append(emptyState('lock', 'Khusus guru', 'Silakan login untuk melihat rekap kelas.', btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }))); return; }
  if (route.parts[1]) return renderDetail(view, route.parts[1]);
  const d = D();
  const from30 = periodRange('30h').from;
  view.append(pageHead('Kelas', `${d.kelasList.length} kelas · ${fmtNum(d.aktif.length)} siswa aktif`,
    btn('Rekap · PDF/WA', () => printRekap(), { ic: 'report', kind: 'text' })));
  if (!d.kelasList.length) { view.append(emptyState('school', 'Belum ada kelas', 'Kelas muncul otomatis dari data siswa.')); return; }
  const tiers = [{ label: 'Aman', color: 'var(--st-ok)' }, ...d.levels.map((l) => ({ label: l.label, color: `var(--st-${l.warna || 'warn'})` }))];
  view.append(h('div', { class: 'legend card-legend', 'aria-label': 'Arti warna batang' }, h('span', { class: 'muted', text: 'Sebaran siswa per tahap:' }),
    ...tiers.map((t) => h('span', { class: 'legend-item' }, h('span', { class: 'swatch', style: { background: t.color } }), h('span', { text: t.label })))));
  const grid = h('div', { class: 'kelas-grid' });
  for (const k of d.kelasList) {
    const ss = d.aktif.filter((s) => s.kelas === k);
    const sums = ss.map((s) => d.summaries.get(s.id));
    const total = sums.reduce((t, x) => t + x.total, 0);
    const melanggar = sums.filter((x) => x.total > 0).length;
    const n30 = S.d.pelanggaran.filter((r) => !r.batal && r.kelas === k && r.tanggal >= from30).length;
    const lvCount = (kode) => sums.filter((x) => (x.level?.kode || '') === kode).length;
    const wali = waliOf(k);
    grid.append(h('button', { class: 'card kelas-card', type: 'button', onclick: () => go('kelas', k) },
      h('div', { class: 'kelas-head' }, h('span', { class: 'kelas-name', text: k }),
        h('span', { class: 'grow muted small', text: wali.length ? `Wali: ${wali.join(', ')}` : '' }), icon('right')),
      h('div', { class: 'kelas-stats' },
        h('div', null, h('strong', { text: fmtNum(ss.length) }), h('span', { class: 'muted small', text: `siswa (${ss.filter((s) => s.jk === 'L').length} L · ${ss.filter((s) => s.jk === 'P').length} P)` })),
        h('div', null, h('strong', { text: fmtNum(total) }), h('span', { class: 'muted small', text: 'total poin' })),
        h('div', null, h('strong', { text: fmtNum(ss.length ? total / ss.length : 0, 1) }), h('span', { class: 'muted small', text: 'rata-rata/siswa' })),
        h('div', null, h('strong', { text: fmtNum(n30) }), h('span', { class: 'muted small', text: 'pelanggaran 30 hari' }))),
      stackBar([{ label: 'Aman', value: lvCount(''), color: 'var(--st-ok)' }, ...d.levels.map((l) => ({ label: l.label, value: lvCount(l.kode), color: `var(--st-${l.warna || 'warn'})` }))].filter((p) => p.value), { unit: 'siswa', legend: false }),
      h('p', { class: 'muted small', text: `${melanggar} dari ${ss.length} siswa pernah melanggar · ${sums.filter((x) => x.level?.surat).length} di tahap surat peringatan ke atas` })));
  }
  view.append(grid);
}

function renderDetail(view, kelas) {
  const d = D();
  const ss = S.d.siswa.filter((s) => s.kelas === kelas && (s.status || 'Aktif') === 'Aktif').sort((a, b) => cmpNama(a.nama, b.nama));
  view.append(h('div', { class: 'crumbs' }, h('a', { href: '#/kelas', text: 'Kelas' }), icon('right'), h('span', { text: kelas })));
  const wali = waliOf(kelas);
  view.append(pageHead(`Kelas ${kelas}`, `${ss.length} siswa aktif${wali.length ? ' · Wali kelas: ' + wali.join(', ') : ''}`,
    btn('Riwayat kelas', () => go('riwayat', { kelas, periode: F.periode }), { ic: 'calendar', kind: 'text' }),
    btn('Laporan', () => go('laporan', { jenis: 'siswa', kelas, periode: F.periode }), { ic: 'report', kind: 'text' })));
  view.append(filterBar(F, (nf) => { F = nf; const y = scrollY; view.replaceChildren(); renderDetail(view, kelas); scrollTo(0, y); }, { fields: ['periode', 'kategori', 'tingkat'] }));

  const pr = periodRange(F.periode, ymd(), F);
  const base = { kelas, kategori: F.kategori, tingkat: F.tingkat };
  const recs = filterRecords(S.d.pelanggaran, { ...base, from: pr.from, to: pr.to });
  const prev = pr.prev ? totals(filterRecords(S.d.pelanggaran, { ...base, from: pr.prev.from, to: pr.prev.to })) : null;
  const t = totals(recs);
  const grid = h('div', { class: 'dash-grid' });
  view.append(grid);
  grid.append(h('div', { class: 'tiles span-12' },
    statTile(`Pelanggaran · ${pr.label}`, fmtNum(t.n), { ic: 'clipboard', delta: deltaChip(t.n, prev?.n, 'periode sebelumnya') }),
    statTile('Total poin', fmtNum(t.poin), { ic: 'scale' }),
    statTile('Siswa terlibat', `${fmtNum(t.siswa)} / ${ss.length}`, { ic: 'users' }),
    statTile('Pelanggaran berat', fmtNum(t.berat), { ic: 'alert', tone: t.berat ? 'critical' : '' })));

  const tr = trend(recs, pr.from, pr.to, ymd());
  grid.append(chartCard({ cls: 'span-8', title: 'Tren pelanggaran kelas', sub: `${pr.label} · per ${tr.gran}`, chart: columnChart(tr.buckets),
    table: { cols: ['Periode', 'Pelanggaran'], rows: tr.buckets.map((b) => [b.full, b.value]) } }));
  const byKat = countBy(recs, (r) => r.kategori);
  grid.append(chartCard({ cls: 'span-4', title: 'Per kategori', sub: pr.label,
    chart: barList(byKat.map((g) => ({ label: `${g.key}. ${katNama(g.key)}`, value: g.n, sub: `${g.poin} poin` })), { unit: 'pelanggaran' }),
    table: { cols: ['Kategori', 'Pelanggaran', 'Poin'], rows: byKat.map((g) => [`${g.key}. ${katNama(g.key)}`, g.n, g.poin]) } }));
  const byJenis = countBy(recs, (r) => r.jenisKode).slice(0, 8);
  grid.append(chartCard({ cls: 'span-6', title: 'Pelanggaran paling sering', sub: pr.label,
    chart: barList(byJenis.map((g) => ({ label: `${g.key}. ${d.jenisMap.get(String(g.key))?.uraian || ''}`, value: g.n, sub: `${g.nSiswa} siswa` })), { unit: 'kali' }),
    table: { cols: ['Kode', 'Pelanggaran', 'Kali', 'Siswa'], rows: byJenis.map((g) => [g.key, d.jenisMap.get(String(g.key))?.uraian || '', g.n, g.nSiswa]) } }));
  const latest = [...recs].sort((a, b) => ((b.tanggal + (b.jam || '')) > (a.tanggal + (a.jam || '')) ? 1 : -1)).slice(0, 6);
  grid.append(h('section', { class: 'card span-6' }, h('div', { class: 'card-head' }, h('h3', { class: 'grow', text: 'Pelanggaran terbaru' })),
    latest.length ? h('div', { class: 'list' }, ...latest.map((r) => recordRow(r))) : h('p', { class: 'muted small', text: 'Tidak ada pelanggaran pada periode ini.' })));

  const sorted = ss.map((s) => ({ s, sum: d.summaries.get(s.id) })).sort((a, b) => b.sum.total - a.sum.total || cmpNama(a.s.nama, b.s.nama));
  grid.append(h('section', { class: 'card span-12' },
    h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Daftar siswa' }), h('p', { class: 'muted small', text: 'Diurutkan dari akumulasi poin tertinggi (seluruh masa sekolah)' }))),
    sorted.length ? h('div', { class: 'list' }, ...sorted.map((x) => studentRow(x.s, x.sum))) : h('p', { class: 'muted', text: 'Belum ada siswa.' })));
}

function printRekap() {
  const d = D();
  const from = periodRange('semester').from;
  const rows = d.kelasList.map((k) => {
    const ss = d.aktif.filter((s) => s.kelas === k);
    const sums = ss.map((s) => d.summaries.get(s.id));
    const total = sums.reduce((t, x) => t + x.total, 0);
    const sem = totals(filterRecords(S.d.pelanggaran, { kelas: k, from }));
    return [k, ss.length, sums.filter((x) => x.total > 0).length, sem.n, sem.poin, total, ss.length ? Math.round((total / ss.length) * 10) / 10 : 0, sums.filter((x) => x.level?.surat).length];
  });
  printReport({ title: 'Rekap Kedisiplinan per Kelas', meta: [`TA ${S.settings.tahunAjaran}`, `Semester ${S.settings.semester}`],
    cols: ['Kelas', 'Siswa', 'Pernah melanggar', 'Pelanggaran semester', 'Poin semester', 'Total poin akumulasi', 'Rata-rata/siswa', 'Siswa tahap surat (SP+)'], rows, numeric: [1, 2, 3, 4, 5, 6, 7] });
}
