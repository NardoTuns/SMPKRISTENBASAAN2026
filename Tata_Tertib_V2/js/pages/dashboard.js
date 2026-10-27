// Dasbor kedisiplinan — terbuka untuk semua pengguna (kecuali Admin mengatur akses "login").
import { h, icon, btn } from '../ui/dom.js';
import { barList, chartCard, columnChart, heatGrid, stackBar } from '../ui/charts.js';
import { emptyState, filterBar, levelBadge, pageHead, recordRow, statTile, deltaChip, studentRow, TINGKAT_WARNA } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { kronOf, printSummary } from '../ui/print.js';
import { S, D, hidden, me } from '../store.js';
import { countBy, filterRecords, heat, periodRange, totals, trend } from '../core/stats.js';
import { TINGKAT } from '../core/rules.js';
import { fmtNum, relTime, ymd, HARI } from '../core/util.js';
import { enterDemo } from './akun.js';

export const meta = { title: 'Beranda', live: true };

let F = { periode: localStorage.getItem('dash.periode') || '30h', kelas: '', kategori: '', tingkat: '' };

export function render(view) {
  const d = D();
  const s = S.settings;
  const blocker = setupNotice();
  view.append(pageHead('Dasbor Kedisiplinan', `${s.namaSekolah} · TA ${s.tahunAjaran} · Semester ${s.semester}${S.demo ? ' · Mode Demo' : S.sync.lastOk ? ` · data per ${relTime(S.sync.lastOk)}` : ''}`,
    blocker ? null : btn('Ringkasan · PDF/WA', () => printSummary(ringkasan()), { ic: 'report', kind: 'tonal', title: 'Unduh ringkasan dasbor (PDF/PNG) atau kirim ke WhatsApp' }),
    h('a', { class: 'btn text', href: 'DashboardSiswa.html' }, icon('users'), h('span', { text: 'Halaman Siswa & Orang Tua' }))));

  if (blocker) { view.append(blocker); return; }

  view.append(filterBar(F, (nf) => { F = nf; try { localStorage.setItem('dash.periode', F.periode); } catch { /* mode privat */ } rerender(view); }));

  const pr = periodRange(F.periode, ymd(), F);
  const base = { kelas: F.kelas, kategori: F.kategori, tingkat: F.tingkat };
  const recs = filterRecords(S.d.pelanggaran, { ...base, from: pr.from, to: pr.to });
  const prev = pr.prev ? filterRecords(S.d.pelanggaran, { ...base, from: pr.prev.from, to: pr.prev.to }) : null;
  const t = totals(recs);
  const tp = prev ? totals(prev) : null;
  const prevLabel = F.periode === 'hari' ? 'kemarin' : 'periode sebelumnya';

  const grid = h('div', { class: 'dash-grid' });
  view.append(grid);

  // ---- angka utama
  grid.append(h('section', { class: 'card hero span-4' },
    h('div', { class: 'tile-label' }, icon('clipboard'), h('span', { text: `Pelanggaran tercatat · ${pr.label}` })),
    h('div', { class: 'hero-value', text: fmtNum(t.n) }),
    deltaChip(t.n, tp?.n, prevLabel),
    h('p', { class: 'muted small', text: F.kelas ? `Kelas ${F.kelas}` : `${fmtNum(d.aktif.length)} siswa aktif · ${d.kelasList.length} kelas` })));
  grid.append(h('div', { class: 'tiles span-8' },
    statTile('Total poin', fmtNum(t.poin), { ic: 'scale', delta: deltaChip(t.poin, tp?.poin, prevLabel) }),
    statTile('Siswa terlibat', fmtNum(t.siswa), { ic: 'users', sub: d.aktif.length ? `${Math.round((t.siswa / d.aktif.length) * 100)}% dari siswa aktif` : '' }),
    statTile('Rata-rata poin per siswa', fmtNum(t.rata, 1), { ic: 'chart', sub: 'di antara siswa yang melanggar' }),
    statTile('Pelanggaran berat', fmtNum(t.berat), { ic: 'alert', tone: t.berat ? 'critical' : '', sub: `${fmtNum(t.sedang)} sedang · ${fmtNum(t.ringan)} ringan` })));

  // ---- status siswa (akumulasi seluruh masa sekolah)
  const pool = d.aktif.filter((x) => !F.kelas || x.kelas === F.kelas);
  const byLevel = new Map([['', 0], ...d.levels.map((l) => [l.kode, 0])]);
  for (const x of pool) { const lv = d.summaries.get(x.id)?.level; byLevel.set(lv?.kode || '', (byLevel.get(lv?.kode || '') || 0) + 1); }
  grid.append(h('section', { class: 'card span-12' },
    h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Status siswa berdasarkan akumulasi poin' }),
      h('p', { class: 'muted small', text: 'Seluruh masa sekolah — poin tidak dapat dikurangi. Ketuk untuk melihat daftar siswa.' }))),
    h('div', { class: 'level-strip' },
      levelCard(null, byLevel.get(''), `0–${(d.levels[0]?.min || 10) - 1} poin`, pool.length),
      ...d.levels.map((l, i) => levelCard(l, byLevel.get(l.kode), d.levels[i + 1] ? `${l.min}–${d.levels[i + 1].min - 1} poin` : `≥ ${l.min} poin`, pool.length)))));

  // ---- tren & komposisi
  const tr = trend(recs, pr.from, pr.to, ymd());
  grid.append(chartCard({
    cls: 'span-8', title: 'Tren pelanggaran', sub: `${pr.label} · per ${tr.gran}`,
    chart: columnChart(tr.buckets, { onPick: tr.gran === 'hari' ? (b) => go('riwayat', { periode: 'kustom', from: b.key, to: b.key }) : null }),
    table: { cols: [tr.gran === 'bulan' ? 'Bulan' : tr.gran === 'minggu' ? 'Minggu mulai' : 'Tanggal', 'Pelanggaran'], rows: tr.buckets.map((b) => [b.full, b.value]) },
  }));
  grid.append(chartCard({
    cls: 'span-4', title: 'Komposisi tingkat', sub: 'Ringan · Sedang · Berat',
    chart: h('div', { class: 'stack-col' }, stackBar(TINGKAT.map((x) => ({ label: x, value: t[x.toLowerCase()], color: `var(--st-${TINGKAT_WARNA[x]})` }))),
      h('div', { class: 'mini-stats' }, ...TINGKAT.map((x) => {
        const p = recs.filter((r) => r.tingkat === x).reduce((a, r) => a + (Number(r.poin) || 0), 0);
        return h('div', null, h('span', { class: 'muted small', text: `Poin ${x.toLowerCase()}` }), h('strong', { text: fmtNum(p) }));
      }))),
    table: { cols: ['Tingkat', 'Pelanggaran'], rows: TINGKAT.map((x) => [x, t[x.toLowerCase()]]) },
  }));

  // ---- kategori & kelas
  const byKat = countBy(recs, (r) => r.kategori);
  const katItems = d.kategori.map((k) => { const g = byKat.find((x) => x.key === k.kode); return { label: `${k.kode}. ${k.nama}`, value: g?.n || 0, sub: g ? `${fmtNum(g.poin)} poin · ${g.nSiswa} siswa` : '', onClick: () => go('riwayat', { periode: F.periode, kategori: k.kode, kelas: F.kelas }) }; });
  grid.append(chartCard({ cls: 'span-6', title: 'Pelanggaran per kategori', sub: pr.label, chart: barList(katItems, { unit: 'pelanggaran' }),
    table: { cols: ['Kategori', 'Pelanggaran', 'Poin', 'Siswa'], rows: d.kategori.map((k) => { const g = byKat.find((x) => x.key === k.kode); return [`${k.kode}. ${k.nama}`, g?.n || 0, g?.poin || 0, g?.nSiswa || 0]; }) } }));

  const byKelas = countBy(recs, (r) => r.kelas);
  const kelasN = new Map(d.kelasList.map((k) => [k, d.aktif.filter((x) => x.kelas === k).length]));
  const kelasRows = d.kelasList.filter((k) => !F.kelas || k === F.kelas)
    .map((k) => ({ k, g: byKelas.find((x) => x.key === k), n: kelasN.get(k) }))
    .sort((a, b) => (b.g?.n || 0) - (a.g?.n || 0));
  grid.append(chartCard({ cls: 'span-6', title: 'Pelanggaran per kelas', sub: pr.label,
    chart: barList(kelasRows.map(({ k, g, n }) => ({ label: `Kelas ${k}`, value: g?.n || 0, sub: `${fmtNum(g?.poin || 0)} poin · ${g?.nSiswa || 0} dari ${n} siswa`, onClick: () => go('kelas', k) })), { unit: 'pelanggaran', empty: 'Belum ada data kelas.' }),
    table: { cols: ['Kelas', 'Pelanggaran', 'Poin', 'Siswa melanggar', 'Jumlah siswa'], rows: kelasRows.map(({ k, g, n }) => [k, g?.n || 0, g?.poin || 0, g?.nSiswa || 0, n]) } }));

  // ---- jenis terbanyak & siswa poin tertinggi
  const byJenis = countBy(recs, (r) => r.jenisKode).slice(0, 10);
  grid.append(chartCard({ cls: 'span-6', title: 'Pelanggaran paling sering', sub: `10 teratas · ${pr.label}`,
    chart: barList(byJenis.map((g) => ({ label: `${g.key}. ${d.jenisMap.get(String(g.key))?.uraian || recs.find((r) => r.jenisKode === g.key)?.uraian || ''}`, value: g.n, sub: `${g.nSiswa} siswa · ${fmtNum(g.poin)} poin`, onClick: () => go('riwayat', { periode: F.periode, jenis: g.key, kelas: F.kelas }) })), { unit: 'kali' }),
    table: { cols: ['Kode', 'Bentuk pelanggaran', 'Kali', 'Siswa', 'Poin'], rows: byJenis.map((g) => [g.key, d.jenisMap.get(String(g.key))?.uraian || '', g.n, g.nSiswa, g.poin]) } }));

  const top = pool.map((x) => ({ s: x, sum: d.summaries.get(x.id) })).filter((x) => x.sum.total > 0).sort((a, b) => b.sum.total - a.sum.total).slice(0, 8);
  grid.append(h('section', { class: 'card span-6' },
    h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Akumulasi poin tertinggi' }), h('p', { class: 'muted small', text: 'Seluruh masa sekolah' + (F.kelas ? ` · kelas ${F.kelas}` : '') })),
      btn('Semua', () => go('siswa', { urut: 'poin', kelas: F.kelas }), { kind: 'text', small: true })),
    top.length ? h('div', { class: 'list' }, ...top.map((x) => studentRow(x.s, x.sum))) : h('p', { class: 'muted small', text: 'Belum ada siswa dengan poin.' })));

  // ---- pola waktu & perlu perhatian
  const hm = heat(recs);
  const hariShort = (i) => HARI[i].slice(0, 3);
  grid.append(chartCard({ cls: 'span-6', title: 'Pola waktu kejadian', sub: `Hari × jam · ${pr.label}${hm.tanpaJam ? ` · ${hm.tanpaJam} tanpa jam` : ''}`,
    chart: heatGrid({ rowLabels: hm.days.map(hariShort), colLabels: hm.hours.map((x) => String(x).padStart(2, '0')), grid: hm.grid,
      rowTitle: (r) => HARI[hm.days[hm.days.map(hariShort).indexOf(r)]], colTitle: (c) => `pukul ${c}.00–${c}.59` }),
    table: { cols: ['Hari', ...hm.hours.map((x) => `${x}:00`)], rows: hm.grid.map((row, i) => [HARI[hm.days[i]], ...row]) } }));

  grid.append(attentionCard(pool, d));

  // ---- terbaru & pencatat
  const latest = [...recs].sort((a, b) => ((b.tanggal + (b.jam || '')) > (a.tanggal + (a.jam || '')) ? 1 : -1)).slice(0, 6);
  grid.append(h('section', { class: 'card span-6' },
    h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Pelanggaran terbaru' }), h('p', { class: 'muted small', text: pr.label })),
      btn('Riwayat', () => go('riwayat', { periode: F.periode, kelas: F.kelas, kategori: F.kategori, tingkat: F.tingkat }), { kind: 'text', small: true })),
    latest.length ? h('div', { class: 'list' }, ...latest.map((r) => recordRow(r))) : h('p', { class: 'muted small', text: 'Tidak ada pelanggaran pada periode ini. 🎉' })));

  const byGuru = countBy(recs, (r) => r.guruNama || r.guru).slice(0, 6);
  grid.append(chartCard({ cls: 'span-6', title: 'Pencatat teraktif', sub: pr.label, chart: barList(byGuru.map((g) => ({ label: g.key, value: g.n, sub: `${g.nSiswa} siswa` })), { unit: 'catatan' }),
    table: { cols: ['Guru', 'Catatan', 'Siswa', 'Poin'], rows: byGuru.map((g) => [g.key, g.n, g.nSiswa, g.poin]) } }));
}

/** Data ringkasan dasbor (mengikuti penyaring yang sedang aktif) untuk dokumen PDF/PNG/WA. */
function ringkasan() {
  const d = D();
  const pr = periodRange(F.periode, ymd(), F);
  const recs = filterRecords(S.d.pelanggaran, { kelas: F.kelas, kategori: F.kategori, tingkat: F.tingkat, from: pr.from, to: pr.to });
  const t = totals(recs);
  const pool = d.aktif.filter((x) => !F.kelas || x.kelas === F.kelas);
  const lvCount = (kode) => pool.filter((x) => (d.summaries.get(x.id)?.level?.kode || '') === kode).length;
  const byKelas = countBy(recs, (r) => r.kelas);
  return {
    title: 'Ringkasan Kedisiplinan Siswa',
    meta: [`Periode: ${pr.label}`, F.kelas ? `Kelas ${F.kelas}` : 'Semua kelas', F.kategori ? `Kategori ${F.kategori}` : '', F.tingkat ? `Pelanggaran ${F.tingkat}` : '', `TA ${S.settings.tahunAjaran}`].filter(Boolean),
    tiles: [['Pelanggaran', fmtNum(t.n)], ['Total poin', fmtNum(t.poin)], ['Siswa terlibat', fmtNum(t.siswa), `dari ${pool.length} siswa aktif`], ['Pelanggaran berat', fmtNum(t.berat)]],
    sections: [
      { title: 'Status siswa (akumulasi seluruh masa sekolah)', cols: ['Tahap', 'Rentang poin', 'Jumlah siswa'], bar: 2,
        rows: [['Aman', `0–${(d.levels[0]?.min || 10) - 1}`, lvCount('')], ...d.levels.map((l, i) => [l.label, d.levels[i + 1] ? `${l.min}–${d.levels[i + 1].min - 1}` : `≥ ${l.min}`, lvCount(l.kode)])] },
      { title: 'Pelanggaran per kelas', cols: ['Kelas', 'Siswa melanggar', 'Total poin', 'Pelanggaran'], bar: 3,
        rows: d.kelasList.filter((k) => !F.kelas || k === F.kelas).map((k) => { const g = byKelas.find((x) => x.key === k); return [k, g?.nSiswa || 0, g?.poin || 0, g?.n || 0]; }) },
      { title: 'Pelanggaran per kategori', cols: ['Kategori', 'Pelanggaran'], bar: 1,
        rows: d.kategori.map((k) => [`${k.kode}. ${k.nama}`, recs.filter((r) => r.kategori === k.kode).length]) },
      { title: 'Pelanggaran paling sering', cols: ['Bentuk pelanggaran', 'Siswa', 'Kali'], bar: 2,
        rows: countBy(recs, (r) => r.jenisKode).slice(0, 10).map((g) => [`${g.key}. ${d.jenisMap.get(String(g.key))?.uraian || ''}`, g.nSiswa, g.n]) },
    ],
    kronologi: kronOf(recs),
  };
}

function rerender(view) {
  const y = window.scrollY;
  view.replaceChildren();
  render(view);
  window.scrollTo(0, y);
}

function levelCard(level, n, range, total) {
  return h('button', { class: `level-card st-${level?.warna || 'ok'}`, type: 'button', onclick: () => go('siswa', { tahap: level?.kode || 'AMAN', kelas: F.kelas, urut: 'poin' }) },
    h('span', { class: 'level-bar' }),
    h('span', { class: 'level-n', text: fmtNum(n || 0) }),
    h('span', { class: 'level-name', text: level?.label || 'Aman' }),
    h('span', { class: 'muted small', text: `${range}${total ? ` · ${Math.round(((n || 0) / total) * 100)}%` : ''}` }));
}

function attentionCard(pool, d) {
  const sidang = pool.map((x) => ({ s: x, sum: d.summaries.get(x.id) })).filter((x) => x.sum.total > d.batasSidang).sort((a, b) => b.sum.total - a.sum.total);
  const near = pool.map((x) => ({ s: x, sum: d.summaries.get(x.id) })).filter((x) => x.sum.total > 0 && x.sum.next && x.sum.toNext <= 5).sort((a, b) => a.sum.toNext - b.sum.toNext).slice(0, 5);
  const belum = d.tindak.filter((t) => t.berlaku && t.status !== 'Selesai' && pool.some((x) => x.id === t.siswaId));
  const u = me();
  return h('section', { class: 'card span-6' },
    h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Perlu perhatian' }), h('p', { class: 'muted small', text: 'Berdasarkan akumulasi poin saat ini' }))),
    h('div', { class: 'attn' },
      h('button', { class: 'attn-item', type: 'button', onclick: () => go(u ? 'tindak' : 'siswa', u ? {} : { urut: 'poin' }) },
        h('span', { class: 'attn-ic st-warn' }, icon('checklist')),
        h('span', { class: 'grow' }, h('strong', { text: `${fmtNum(belum.length)} tindak lanjut belum selesai` }), h('span', { class: 'muted small', text: 'Surat peringatan / pemanggilan yang belum dilaksanakan' })),
        icon('right')),
      h('div', { class: 'attn-item static' },
        h('span', { class: 'attn-ic st-critical' }, icon('gavel')),
        h('span', { class: 'grow' }, h('strong', { text: `${fmtNum(sidang.length)} siswa perlu Sidang Dewan Guru` }), h('span', { class: 'muted small', text: `Akumulasi di atas ${d.batasSidang} poin` }))),
      sidang.length ? h('div', { class: 'chips' }, ...sidang.slice(0, 8).map((x) => h('button', { class: 'chip', type: 'button', onclick: () => go('siswa', x.s.id) }, h('span', { text: x.s.nama }), h('strong', { text: String(x.sum.total) })))) : null,
      h('div', { class: 'attn-item static' },
        h('span', { class: 'attn-ic st-serious' }, icon('alert')),
        h('span', { class: 'grow' }, h('strong', { text: `${fmtNum(near.length)} siswa mendekati tahap berikutnya` }), h('span', { class: 'muted small', text: 'Kurang ≤ 5 poin' }))),
      near.length ? h('div', { class: 'list' }, ...near.map((x) => h('button', { class: 'row-item slim', type: 'button', onclick: () => go('siswa', x.s.id) },
        h('span', { class: 'grow min0' }, h('span', { class: 'row-title ellipsis', text: x.s.nama }), h('span', { class: 'muted small', text: ` · ${x.s.kelas} · ${x.sum.total} poin` })),
        h('span', { class: 'muted small', text: `${x.sum.toNext} lagi →` }), levelBadge(x.sum.next, { small: true })))) : null));
}

function setupNotice() {
  const d = D();
  if (!S.serverUrl && !S.demo) {
    return emptyState('database', 'Aplikasi belum terhubung ke server',
      'Admin perlu menyiapkan Google Spreadsheet + Apps Script lalu mengisi alamat server (lihat PANDUAN.md). Sambil menunggu, Anda bisa mencoba aplikasi dengan data contoh.',
      h('div', { class: 'row gap-sm wrap center' }, btn('Coba Mode Demo', () => enterDemo(), { kind: 'primary', ic: 'spark' }), btn('Atur alamat server', () => go('akun'), { ic: 'settings' })));
  }
  if (hidden()) {
    return emptyState('lock', 'Dasbor khusus guru', 'Sekolah mengatur agar data kedisiplinan hanya dapat dilihat setelah login.',
      btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }));
  }
  if (!S.d.siswa.length && !S.d.pelanggaran.length) {
    if (!S.sync.lastOk && !S.meta.lastPull) {
      return emptyState('sync', S.sync.running ? 'Mengunduh data…' : 'Belum ada data di perangkat ini',
        S.sync.error ? `Gagal mengunduh: ${S.sync.error}` : 'Data akan diunduh otomatis saat tersambung ke internet.', null);
    }
    return emptyState('users', 'Belum ada data siswa', 'Admin atau Guru BK dapat menambahkan/impor data siswa di menu Kelola → Siswa.',
      me() ? btn('Kelola siswa', () => go('kelola', 'siswa'), { kind: 'primary', ic: 'users' }) : null);
  }
  return null;
}
