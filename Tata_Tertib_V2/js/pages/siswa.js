// Siswa: daftar dengan pencarian/penyaring, dan riwayat lengkap per siswa.
import { h, icon, btn, select } from '../ui/dom.js';
import { barList, chartCard, cumChart, pointsMeter } from '../ui/charts.js';
import { avatar, emptyState, levelBadge, pageHead, recordRow, showMore, studentRow, waLink } from '../ui/widgets.js';
import { go, replaceQuery } from '../ui/nav.js';
import { printKartu } from '../ui/print.js';
import { S, D, hidden, me, katNama } from '../store.js';
import { canSiswa, canTindak } from '../core/perm.js';
import { countBy } from '../core/stats.js';
import { cmpKelas, cmpNama, fmtNum, fmtTgl, matches, debounce, toCSV } from '../core/util.js';
import { downloadText } from '../ui/dom.js';
import { openTindak } from './tindak.js';
import { openSiswaForm } from './kelola.js';

export const meta = { title: 'Siswa', live: true };

let limit = 60;

export function render(view, route) {
  if (hidden()) { view.append(emptyState('lock', 'Khusus guru', 'Silakan login untuk melihat data siswa.', btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }))); return; }
  if (route.parts[1]) return renderDetail(view, route.parts[1]);
  renderList(view, route.query);
}

// ------------------------------------------------------------------ daftar
function renderList(view, q) {
  const d = D();
  const f = { q: q.q || '', kelas: q.kelas || '', tahap: q.tahap || '', urut: q.urut || 'kelas', status: q.status || 'Aktif' };
  const update = (patch) => { Object.assign(f, patch); limit = 60; replaceQuery(clean(f)); draw(); };
  const u = me();

  view.append(pageHead('Siswa', `${fmtNum(d.aktif.length)} siswa aktif · ${d.kelasList.length} kelas`,
    canSiswa(u) ? btn('Tambah', () => openSiswaForm(null), { ic: 'plus', kind: 'tonal' }) : null,
    btn('CSV', () => exportCsv(filtered()), { ic: 'download', kind: 'text', title: 'Unduh daftar (Excel)' })));

  const search = h('input', { type: 'search', placeholder: 'Cari nama atau NIS…', value: f.q, 'aria-label': 'Cari siswa', oninput: debounce((e) => update({ q: e.target.value }), 200) });
  view.append(h('div', { class: 'filters' },
    h('label', { class: 'fsel search' }, icon('search'), search),
    h('label', { class: 'fsel' }, icon('school'), select([{ value: '', label: 'Semua kelas' }, ...d.kelasList.map((k) => ({ value: k, label: `Kelas ${k}` }))], f.kelas, (v) => update({ kelas: v }), { 'aria-label': 'Kelas' })),
    h('label', { class: 'fsel' }, icon('alert'), select([{ value: '', label: 'Semua tahap' }, { value: 'AMAN', label: 'Aman (belum ada tindakan)' }, { value: 'POIN', label: 'Pernah melanggar' }, ...d.levels.map((l) => ({ value: l.kode, label: l.label }))], f.tahap, (v) => update({ tahap: v }), { 'aria-label': 'Tahap sanksi' })),
    h('label', { class: 'fsel' }, icon('list'), select([{ value: 'kelas', label: 'Urut: kelas & nama' }, { value: 'poin', label: 'Urut: poin tertinggi' }, { value: 'nama', label: 'Urut: nama' }, { value: 'terbaru', label: 'Urut: pelanggaran terbaru' }], f.urut, (v) => update({ urut: v }), { 'aria-label': 'Urutan' })),
    h('label', { class: 'fsel' }, icon('users'), select([{ value: 'Aktif', label: 'Siswa aktif' }, { value: 'semua', label: 'Semua status' }, { value: 'nonaktif', label: 'Lulus/pindah/keluar' }], f.status, (v) => update({ status: v }), { 'aria-label': 'Status siswa' }))));

  const out = h('div');
  view.append(out);

  function filtered() {
    const list = S.d.siswa.filter((s) => {
      const st = s.status || 'Aktif';
      if (f.status === 'Aktif' && st !== 'Aktif') return false;
      if (f.status === 'nonaktif' && st === 'Aktif') return false;
      if (f.kelas && s.kelas !== f.kelas) return false;
      const sum = d.summaries.get(s.id);
      if (f.tahap === 'AMAN' && sum.level) return false;
      if (f.tahap === 'POIN' && !sum.total) return false;
      if (f.tahap && !['AMAN', 'POIN'].includes(f.tahap) && sum.level?.kode !== f.tahap) return false;
      return !f.q || matches(f.q, s.nama, s.nis, s.nisn, s.kelas);
    });
    const sumOf = (s) => d.summaries.get(s.id);
    if (f.urut === 'poin') list.sort((a, b) => sumOf(b).total - sumOf(a).total || cmpNama(a.nama, b.nama));
    else if (f.urut === 'nama') list.sort((a, b) => cmpNama(a.nama, b.nama));
    else if (f.urut === 'terbaru') list.sort((a, b) => (sumOf(b).last || '').localeCompare(sumOf(a).last || '') || cmpNama(a.nama, b.nama));
    else list.sort((a, b) => cmpKelas(a.kelas, b.kelas) || cmpNama(a.nama, b.nama));
    return list;
  }

  function draw() {
    const list = filtered();
    const total = list.reduce((t, s) => t + d.summaries.get(s.id).total, 0);
    out.replaceChildren(
      h('p', { class: 'muted small result-line', text: `${fmtNum(list.length)} siswa · total ${fmtNum(total)} poin` }),
      list.length ? h('div', { class: 'list card flush' }, ...list.slice(0, limit).map((s) => studentRow(s, d.summaries.get(s.id))))
        : emptyState('search', 'Tidak ada siswa yang cocok', 'Ubah kata kunci atau penyaring.'),
      showMore(limit, list.length, () => { limit += 120; draw(); }));
  }
  draw();
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => v && !(k === 'urut' && v === 'kelas') && !(k === 'status' && v === 'Aktif')));

function exportCsv(list) {
  const d = D();
  const rows = [['NIS', 'NISN', 'Nama', 'Kelas', 'L/P', 'Status', 'Jumlah Pelanggaran', 'Total Poin', 'Tahap', 'Pelanggaran Terakhir']];
  for (const s of list) { const m = d.summaries.get(s.id); rows.push([s.nis, s.nisn, s.nama, s.kelas, s.jk, s.status || 'Aktif', m.count, m.total, m.level?.label || 'Aman', m.last]); }
  downloadText(toCSV(rows), `daftar-siswa-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ------------------------------------------------------------------ detail
let showBatal = false;
function renderDetail(view, id) {
  const d = D();
  const s = d.siswaMap.get(id);
  if (!s) { view.append(emptyState('user', 'Siswa tidak ditemukan', 'Data mungkin sudah dihapus atau belum tersinkron.', btn('Kembali ke daftar', () => go('siswa'), { kind: 'tonal' }))); return; }
  const sum = d.summaries.get(id);
  const u = me();
  const all = S.d.pelanggaran.filter((r) => r.siswaId === id);
  const batal = all.filter((r) => r.batal);
  const wa = u ? waLink(s, `Yth. Bapak/Ibu ${s.ortu || 'Orang Tua/Wali'} dari ${s.nama} (kelas ${s.kelas}), `) : '';

  view.append(h('div', { class: 'crumbs' }, h('a', { href: '#/siswa', text: 'Siswa' }), icon('right'), h('span', { text: s.nama })));
  view.append(h('section', { class: 'card profile' },
    h('div', { class: 'profile-top' },
      avatar(s.nama, 'lg' + (s.jk === 'P' ? ' f' : '')),
      h('div', { class: 'grow min0' },
        h('h1', { class: 'profile-name', text: s.nama }),
        h('p', { class: 'muted' }, `Kelas ${s.kelas}`, s.nis ? ` · NIS ${s.nis}` : '', s.nisn ? ` · NISN ${s.nisn}` : '', s.jk ? ` · ${s.jk === 'P' ? 'Perempuan' : 'Laki-laki'}` : ''),
        (s.status || 'Aktif') !== 'Aktif' ? h('span', { class: 'badge sm st-dark', text: s.status }) : null,
        u && (s.ortu || s.hpOrtu) ? h('p', { class: 'muted small' }, icon('user'), ` Orang tua/wali: ${s.ortu || '-'}${s.hpOrtu ? ' · ' + s.hpOrtu : ''}`) : null)),
    h('div', { class: 'profile-score' },
      h('div', { class: 'score' }, h('span', { class: 'score-n', text: fmtNum(sum.total) }), h('span', { class: 'muted', text: 'poin akumulasi' })),
      h('div', { class: 'grow' },
        h('div', { class: 'row gap-sm wrap' }, levelBadge(sum.level), sum.total > d.batasSidang ? h('span', { class: 'badge st-critical' }, icon('gavel'), h('span', { text: 'Perlu Sidang Dewan Guru' })) : null),
        pointsMeter(sum.total, d.levels),
        h('p', { class: 'muted small', text: sum.next ? `${sum.toNext} poin lagi menuju ${sum.next.label} (${sum.next.min} poin).` : sum.total >= 100 ? 'Akumulasi poin maksimal telah terpenuhi.' : '' }),
        sum.level ? h('p', { class: 'small level-action' }, h('strong', { text: 'Tindakan: ' }), sum.level.tindakan) : null)),
    h('div', { class: 'profile-actions' },
      u ? btn('Catat pelanggaran', () => go('catat', { siswa: s.id }), { kind: 'primary', ic: 'plus' }) : null,
      btn('Kartu · PDF/WA', () => printKartu(s), { ic: 'report', title: 'Kartu kedisiplinan: unduh PDF/PNG, kirim WhatsApp, atau cetak' }),
      wa ? h('a', { class: 'btn tonal', href: wa, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'WhatsApp orang tua' })) : null,
      canSiswa(u) ? btn('Ubah data', () => openSiswaForm(s), { ic: 'edit', kind: 'text' }) : null)));

  const grid = h('div', { class: 'dash-grid' });
  view.append(grid);
  const points = sum.timeline.map((t) => ({ x: fmtTgl(t.rec.tanggal, { short: true }), full: fmtTgl(t.rec.tanggal, { hari: true }), value: t.after, add: t.rec.poin, text: `${t.rec.jenisKode}. ${t.rec.uraian}` }));
  grid.append(chartCard({ cls: 'span-8', title: 'Perjalanan akumulasi poin', sub: 'Garis bantu = batas tiap tahap sanksi',
    chart: cumChart(points, d.levels.map((l) => ({ ...l, short: l.kode === 'LISAN' ? 'Lisan' : l.kode === 'KELUAR' ? 'Keluar' : l.kode }))),
    table: { cols: ['Tanggal', 'Pelanggaran', 'Poin', 'Akumulasi'], rows: sum.timeline.map((t) => [fmtTgl(t.rec.tanggal), `${t.rec.jenisKode}. ${t.rec.uraian}`, t.rec.poin, t.after]) } }));
  const byKat = countBy(sum.recs, (r) => r.kategori);
  grid.append(chartCard({ cls: 'span-4', title: 'Per kategori', sub: `${sum.count} pelanggaran`,
    chart: barList(byKat.map((g) => ({ label: `${g.key}. ${katNama(g.key)}`, value: g.poin, sub: `${g.n} kali` })), { unit: 'poin' }),
    table: { cols: ['Kategori', 'Kali', 'Poin'], rows: byKat.map((g) => [`${g.key}. ${katNama(g.key)}`, g.n, g.poin]) } }));

  // tindak lanjut
  const items = d.tindak.filter((t) => t.siswaId === id);
  if (items.length) {
    grid.append(h('section', { class: 'card span-12' },
      h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Tindak lanjut' }), h('p', { class: 'muted small', text: 'Setiap tahap yang tercapai perlu ditindaklanjuti' }))),
      h('div', { class: 'list' }, ...items.map((t) => h('button', { class: 'row-item', type: 'button', onclick: () => openTindak(t) },
        h('span', { class: 'grow min0' },
          h('span', { class: 'row-title' }, levelBadge(t.level || { label: t.tahapLabel || t.tahap, warna: 'dark' }, { small: true })),
          h('span', { class: 'row-sub muted' }, h('span', { text: `Tercapai ${fmtTgl(t.tanggalCapai, { short: true })} (${t.poinSaat} poin)` }), t.nomorSurat ? h('span', { text: `No. ${t.nomorSurat}` }) : null, !t.berlaku ? h('span', { text: 'tidak berlaku lagi' }) : null)),
        h('span', { class: `badge sm st-${t.status === 'Selesai' ? 'ok' : t.status === 'Dijadwalkan' ? 'info' : 'warn'}`, text: t.status }),
        canTindak(u, s.kelas) ? icon('right') : null)))));
  }

  // riwayat
  const listWrap = h('div');
  const toggle = batal.length ? h('label', { class: 'switch small' }, h('input', { type: 'checkbox', checked: showBatal, onchange: (e) => { showBatal = e.target.checked; drawList(); } }), h('span', { text: `Tampilkan ${batal.length} catatan dibatalkan` })) : null;
  grid.append(h('section', { class: 'card span-12' },
    h('div', { class: 'card-head' }, h('div', { class: 'grow' }, h('h3', { text: 'Riwayat pelanggaran' }), h('p', { class: 'muted small', text: `${sum.count} catatan berlaku · ${fmtNum(sum.total)} poin` })), toggle),
    listWrap));
  function drawList() {
    const list = (showBatal ? all : sum.recs).slice().sort((a, b) => ((b.tanggal + (b.jam || '')) > (a.tanggal + (a.jam || '')) ? 1 : -1));
    listWrap.replaceChildren(list.length ? h('div', { class: 'list' }, ...list.map((r) => recordRow(r, { showSiswa: false }))) : h('p', { class: 'muted', text: 'Belum ada pelanggaran. Pertahankan! 👍' }));
  }
  drawList();
}
