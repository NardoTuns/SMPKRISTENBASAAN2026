// Halaman Siswa & Orang Tua (DashboardSiswa.html): tanpa login, sederhana, bisa offline.
// Menu: Beranda (ringkasan sekolah) · Anak (cek perkembangan per siswa dengan NIS) · Kelas · Tata Tertib · Info.
// Privasi: secara bawaan nama siswa tidak ditampilkan dalam daftar; detail siswa dibuka dengan NIS/NISN
// (Admin dapat mengubahnya di Kelola → Pengaturan → Halaman Siswa & Orang Tua).
import { h, icon, btn, toast, dialog } from './ui/dom.js';
import { barList, chartCard, columnChart, cumChart, pointsMeter, stackBar, hideTip } from './ui/charts.js';
import { avatar, emptyState, levelBadge, tingkatBadge, statTile, deltaChip, TINGKAT_WARNA } from './ui/widgets.js';
import { openDoc } from './ui/export.js';
import { kartuHtml } from './ui/print.js';
import * as aturan from './pages/aturan.js';
import { S, D, on, loadAll, hidden } from './store.js';
import { startAuto, syncNow } from './sync.js';
import { call } from './api.js';
import { PWA, applyTheme, applyUpdate, install, isIOS, registerSW, updateApp } from './pwa.js';
import { buildSummaries, sortLevels, summarize } from './core/points.js';
import { countBy, filterRecords, periodRange, totals, trend } from './core/stats.js';
import { cmpKelas, cmpNama, debounce, fmtNum, fmtTgl, matches, relTime, waNumber, ymd } from './core/util.js';
import { APP_VERSION } from './config.js';

const TABS = [
  { kode: 'beranda', label: 'Beranda', ic: 'home' },
  { kode: 'anak', label: 'Anak', ic: 'user' },
  { kode: 'kelas', label: 'Kelas', ic: 'school' },
  { kode: 'aturan', label: 'Tata Tertib', ic: 'book' },
  { kode: 'info', label: 'Info', ic: 'info' },
];

// ------------------------------------------------------------------ penyimpanan kecil per perangkat
const ls = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* mode privat */ } },
};
const savedKids = () => ls.get('ds.anak', []);
const isSaved = (key) => savedKids().some((k) => k.key === key);
function toggleKid(key, siswa) {
  const list = savedKids().filter((k) => k.key !== key);
  if (list.length === savedKids().length) list.push({ key, nama: siswa.nama, kelas: siswa.kelas });
  ls.set('ds.anak', list);
}

// ------------------------------------------------------------------ data (lengkap / anonim)
let memo = { key: '' };
function data() {
  const mode = S.d.siswa.length && !hidden() ? 'full' : S.anon ? 'anon' : 'none';
  const key = `${mode}:${S.ver}`;
  if (memo.key === key) return memo;
  const levels = sortLevels(S.d.sanksi);
  let siswa = [], recs = [], summaries = new Map();
  if (mode === 'full') { siswa = S.d.siswa; recs = S.d.pelanggaran.filter((r) => !r.batal); summaries = D().summaries; }
  if (mode === 'anon') { siswa = S.anon.siswa; recs = S.anon.pelanggaran; summaries = buildSummaries(siswa, recs, levels); }
  const aktif = siswa.filter((s) => (s.status || 'Aktif') === 'Aktif');
  const kelasList = [...new Set(aktif.map((s) => s.kelas).filter(Boolean))].sort(cmpKelas);
  memo = { key, mode, levels, siswa, aktif, recs, summaries, kelasList };
  return memo;
}
const showNames = () => S.settings.dashboardSiswa === 'nama' && data().mode === 'full';
const keyOf = (s) => (s.nis ? String(s.nis).replace(/\s+/g, '') : `id:${s.id}`);

/** Cari satu siswa: lokal bila data lengkap ada di HP, selain itu tanya server (hasil disimpan untuk offline). */
async function lookup(key) {
  const k = String(key || '').replace(/\s+/g, '');
  if (data().mode === 'full') {
    const s = k.startsWith('id:') && showNames() ? S.d.siswa.find((x) => x.id === k.slice(3))
      : S.d.siswa.find((x) => (x.nis && String(x.nis).replace(/\s+/g, '') === k) || (x.nisn && String(x.nisn).replace(/\s+/g, '') === k));
    if (!s) throw new Error('NIS/NISN tidak ditemukan. Periksa kembali, atau hubungi wali kelas.');
    return { siswa: s, recs: S.d.pelanggaran.filter((r) => r.siswaId === s.id && !r.batal), tindak: D().tindak.filter((t) => t.siswaId === s.id && t.stored), at: S.sync.lastOk || S.meta.lastPull };
  }
  const cached = ls.get('ds.cek.' + k, null);
  if (!navigator.onLine || !S.serverUrl) {
    if (cached) return { ...cached, offline: true };
    throw new Error('Perlu internet untuk mencari data siswa.');
  }
  try {
    const r = await call(S.serverUrl, { action: 'cekSiswa', nis: k }, 30000);
    const res = { siswa: r.siswa, recs: r.pelanggaran, tindak: r.tindak, at: Date.now() };
    ls.set('ds.cek.' + k, res);
    return res;
  } catch (e) {
    if (cached && e.code !== 'NOT_FOUND') return { ...cached, offline: true };
    throw e.code === 'BAD_REQUEST' ? new Error('Server sekolah belum diperbarui ke versi terbaru. Hubungi Admin.') : e;
  }
}

// ------------------------------------------------------------------ kerangka
let view, tabsBar, bottomNav, banners, updateBtn, curTab = '';

function buildShell() {
  const app = document.getElementById('app');
  const logo = S.settings.logo ? h('img', { src: S.settings.logo, alt: '' }) : h('img', { src: 'icons/favicon.svg', alt: '' });
  updateBtn = h('button', { class: 'update-btn', type: 'button', title: 'Ambil data & tampilan terbaru', 'aria-label': 'Update', onclick: runUpdate }, icon('download'), h('span', { class: 'update-text', text: 'Update' }));
  banners = h('div', { class: 'banners' });
  tabsBar = h('nav', { class: 'ds-tabs', 'aria-label': 'Menu' });
  bottomNav = h('nav', { class: 'bottomnav ds-nav', 'aria-label': 'Menu bawah' });
  view = h('main', { id: 'view', class: 'view ds-view', tabindex: '-1' });
  app.replaceChildren(
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#beranda' }, h('span', { class: 'brand-mark' }, logo),
        h('span', { class: 'brand-text' }, h('span', { class: 'brand-title', text: 'Info Kedisiplinan' }), h('span', { class: 'brand-sub', text: S.settings.namaSekolah }))),
      h('span', { class: 'grow' }), updateBtn,
      h('a', { class: 'user-btn', href: 'index.html', title: 'Halaman guru' }, icon('login'), h('span', { class: 'user-name', text: 'Guru' }))),
    banners, tabsBar, view, bottomNav);
}

function drawNav() {
  const item = (t, cls) => h('a', { href: '#' + t.kode, class: `${cls} ${curTab === t.kode ? 'on' : ''}`, 'aria-current': curTab === t.kode ? 'page' : null }, icon(t.ic), h('span', { text: t.label }));
  tabsBar.replaceChildren(...TABS.map((t) => item(t, 'ds-tab')));
  bottomNav.replaceChildren(...TABS.map((t) => item(t, 'bn')));
}

function drawBanners() {
  const list = [];
  updateBtn.classList.toggle('has-update', !!PWA.waiting);
  if (PWA.waiting) list.push(h('div', { class: 'banner info' }, icon('download'), h('span', { class: 'grow', text: 'Versi baru tersedia.' }), h('button', { class: 'btn small primary', type: 'button', onclick: applyUpdate, text: 'Perbarui' })));
  if (!S.online) list.push(h('div', { class: 'banner demo' }, icon('cloudoff'), h('span', { class: 'grow', text: `Offline — menampilkan data terakhir${S.sync.lastOk ? ` (${relTime(S.sync.lastOk)})` : ''}.` })));
  if (S.demo) list.push(h('div', { class: 'banner demo' }, icon('spark'), h('span', { class: 'grow', text: 'MODE DEMO · data contoh (nama rekaan)' })));
  banners.replaceChildren(...list);
}

let updating = false;
async function runUpdate() {
  if (updating) return;
  updating = true;
  updateBtn.querySelector('svg').classList.add('spin');
  try {
    const ok = S.demo || !S.serverUrl ? true : await syncNow();
    const msg = await updateApp();
    if (msg) toast(`${msg}${S.demo || !S.serverUrl ? '' : ok ? ' · data terbaru sudah diambil' : ' · data belum bisa diambil'}`);
  } finally {
    updating = false;
    updateBtn.querySelector('svg')?.classList.remove('spin');
  }
}

function route(keepScroll = false) {
  const [tab, ...rest] = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  const t = TABS.some((x) => x.kode === tab) ? tab : 'beranda';
  const changed = t !== curTab;
  curTab = t;
  const y = window.scrollY;
  hideTip();
  view.replaceChildren();
  try {
    ({ beranda: pageBeranda, anak: pageAnak, kelas: pageKelas, aturan: pageAturan, info: pageInfo })[t](view, rest.join('/'));
  } catch (e) {
    console.error(e);
    view.append(emptyState('alert', 'Terjadi kesalahan', String(e.message || e)));
  }
  document.title = `${TABS.find((x) => x.kode === t).label} · Info Kedisiplinan ${S.settings.namaSekolah}`;
  drawNav();
  drawBanners();
  window.scrollTo(0, keepScroll ? y : changed ? 0 : y);
}

const noData = () => emptyState(S.sync.running ? 'sync' : 'cloudoff', S.sync.running ? 'Mengambil data…' : 'Data belum tersedia',
  S.serverUrl ? 'Sambungkan HP ke internet sebentar agar data terbaru dapat diambil. Setelah itu halaman ini tetap bisa dibuka tanpa internet.' : 'Server sekolah belum diatur.',
  S.serverUrl && !S.sync.running ? btn('Ambil data', () => syncNow({ full: true }), { kind: 'primary', ic: 'sync' }) : null);

const head = (title, sub) => h('header', { class: 'page-head' }, h('div', { class: 'grow' }, h('h1', { text: title }), sub ? h('p', { class: 'muted', text: sub }) : null));

// ------------------------------------------------------------------ BERANDA
let periode = 'ta';
function pageBeranda(v) {
  const s = S.settings;
  const dd = data();
  const kids = savedKids();
  v.append(h('section', { class: 'ds-hero' },
    h('div', { class: 'grow' },
      h('h1', { text: 'Halo, Bapak/Ibu & Siswa 👋' }),
      h('p', { text: `Pantau perkembangan kedisiplinan siswa ${s.namaSekolah} · TA ${s.tahunAjaran} · Semester ${s.semester}` }),
      h('div', { class: 'row gap-sm wrap' },
        h('a', { class: 'btn primary big', href: '#anak' }, icon('search'), h('span', { text: 'Cek perkembangan anak' })),
        h('a', { class: 'btn tonal', href: '#aturan' }, icon('book'), h('span', { text: 'Tata tertib' })))),
    h('div', { class: 'ds-hero-art', 'aria-hidden': 'true' }, icon('shield'))));

  if (kids.length) v.append(h('section', { class: 'card' }, h('h3', { text: 'Anak saya' }),
    h('div', { class: 'kid-grid' }, ...kids.map((k) => kidCard(k)))));
  if (s.infoSiswa) v.append(h('section', { class: 'card notice-card' }, h('div', { class: 'row gap-sm' }, icon('bell'), h('h3', { text: 'Pengumuman' })), h('p', { class: 'pre', text: s.infoSiswa })));
  if (dd.mode === 'none') { v.append(noData()); return; }

  const pr = periodRange(periode);
  const recs = filterRecords(dd.recs, { from: pr.from, to: pr.to });
  const bulan = periodRange('bulan');
  const nBulan = filterRecords(dd.recs, { from: bulan.from, to: bulan.to }).length;
  const nPrev = filterRecords(dd.recs, { from: bulan.prev.from, to: bulan.prev.to }).length;
  const bersih = dd.aktif.filter((x) => !dd.summaries.get(x.id)?.total).length;
  const pct = dd.aktif.length ? Math.round((bersih / dd.aktif.length) * 100) : 0;
  const totalPoin = dd.aktif.reduce((t, x) => t + (dd.summaries.get(x.id)?.total || 0), 0);
  const kelasStat = kelasStats(dd);
  const teladan = [...kelasStat].sort((a, b) => b.pct - a.pct || a.rata - b.rata)[0];

  v.append(h('div', { class: 'tiles ds-tiles' },
    statTile('Siswa tanpa pelanggaran', `${pct}%`, { ic: 'shield', tone: 'ok', sub: `${fmtNum(bersih)} dari ${fmtNum(dd.aktif.length)} siswa aktif` }),
    statTile('Pelanggaran bulan ini', fmtNum(nBulan), { ic: 'clipboard', delta: deltaChip(nBulan, nPrev, 'bulan lalu') }),
    statTile('Rata-rata poin per siswa', fmtNum(dd.aktif.length ? totalPoin / dd.aktif.length : 0, 1), { ic: 'scale', sub: 'akumulasi seluruh masa sekolah' }),
    statTile('Kelas paling disiplin', teladan ? teladan.kelas : '-', { ic: 'spark', sub: teladan ? `${teladan.pct}% siswa tanpa pelanggaran` : '' })));

  v.append(h('div', { class: 'seg ds-period', role: 'tablist', 'aria-label': 'Periode' }, ...[['bulan', 'Bulan ini'], ['semester', 'Semester ini'], ['ta', 'Tahun ajaran']].map(([k, l]) =>
    h('button', { type: 'button', role: 'tab', class: periode === k ? 'on' : '', 'aria-selected': String(periode === k), onclick: () => { periode = k; route(true); } }, h('span', { text: l })))));

  const grid = h('div', { class: 'dash-grid' });
  v.append(grid);
  const tr = trend(recs, pr.from, pr.to, ymd());
  grid.append(chartCard({ cls: 'span-8', title: 'Jumlah pelanggaran', sub: `${pr.label} · per ${tr.gran}`, chart: columnChart(tr.buckets),
    table: { cols: ['Periode', 'Pelanggaran'], rows: tr.buckets.map((b) => [b.full, b.value]) } }));
  grid.append(levelCard(dd, dd.aktif, 'span-4'));
  const top = countBy(recs, (r) => r.jenisKode).slice(0, 6);
  grid.append(chartCard({ cls: 'span-6', title: 'Pelanggaran paling sering', sub: 'Mari bersama menghindarinya', chart: barList(top.map((g) => ({ label: uraianOf(g.key, recs), value: g.n, sub: `${g.nSiswa} siswa` })), { unit: 'kali', empty: 'Tidak ada pelanggaran pada periode ini. 🎉' }),
    table: { cols: ['Pelanggaran', 'Kali', 'Siswa'], rows: top.map((g) => [uraianOf(g.key, recs), g.n, g.nSiswa]) } }));
  const kat = D().kategori.map((k) => ({ label: `${k.kode}. ${k.nama}`, value: recs.filter((r) => r.kategori === k.kode).length }));
  grid.append(chartCard({ cls: 'span-6', title: 'Per jenis kategori', sub: pr.label, chart: barList(kat, { unit: 'pelanggaran' }), table: { cols: ['Kategori', 'Pelanggaran'], rows: kat.map((k) => [k.label, k.value]) } }));
  const rank = [...kelasStat].sort((a, b) => b.pct - a.pct || a.rata - b.rata);
  grid.append(chartCard({ cls: 'span-12', title: 'Peringkat kelas disiplin', sub: 'Persentase siswa tanpa pelanggaran (seluruh masa sekolah)',
    chart: barList(rank.map((k) => ({ label: `Kelas ${k.kelas}`, value: k.pct, sub: `${k.bersih} dari ${k.n} siswa · rata-rata ${fmtNum(k.rata, 1)} poin`, onClick: () => { location.hash = `#kelas/${k.kelas}`; } })), { unit: '%', max: 100, fmt: (x) => `${x}%` }),
    table: { cols: ['Kelas', '% tanpa pelanggaran', 'Siswa', 'Rata-rata poin'], rows: rank.map((k) => [k.kelas, k.pct, k.n, k.rata]) } }));
  v.append(dataStamp());
}

function kelasStats(dd) {
  return dd.kelasList.map((k) => {
    const ss = dd.aktif.filter((x) => x.kelas === k);
    const tot = ss.map((x) => dd.summaries.get(x.id)?.total || 0);
    const bersih = tot.filter((x) => !x).length;
    return { kelas: k, n: ss.length, bersih, pct: ss.length ? Math.round((bersih / ss.length) * 100) : 0, rata: ss.length ? tot.reduce((a, b) => a + b, 0) / ss.length : 0, poin: tot.reduce((a, b) => a + b, 0) };
  });
}
const uraianOf = (kode, recs) => { const j = D().jenisMap.get(String(kode)); const u = j?.uraian || recs.find((r) => String(r.jenisKode) === String(kode))?.uraian || ''; return `${kode}. ${u}`; };

function levelCard(dd, pool, cls) {
  const parts = [{ label: 'Aman', value: pool.filter((x) => !dd.summaries.get(x.id)?.level).length, color: 'var(--st-ok)' },
    ...dd.levels.map((l) => ({ label: l.label, value: pool.filter((x) => dd.summaries.get(x.id)?.level?.kode === l.kode).length, color: `var(--st-${l.warna || 'warn'})` }))];
  return chartCard({ cls, title: 'Status siswa', sub: 'Berdasarkan akumulasi poin', chart: stackBar(parts, { unit: 'siswa' }), table: { cols: ['Tahap', 'Siswa'], rows: parts.map((p) => [p.label, p.value]) } });
}

const dataStamp = () => h('p', { class: 'muted small center ds-stamp', text: S.demo ? 'Mode Demo · data contoh' : S.sync.lastOk ? `Data diperbarui ${relTime(S.sync.lastOk)} · tekan Update untuk data terbaru` : 'Data belum pernah diperbarui' });

function kidCard(k) {
  const dd = data();
  const s = dd.mode === 'full' ? (k.key.startsWith('id:') ? S.d.siswa.find((x) => x.id === k.key.slice(3)) : S.d.siswa.find((x) => keyOf(x) === k.key)) : null;
  const sum = s ? dd.summaries.get(s.id) : (() => { const c = ls.get('ds.cek.' + k.key, null); return c ? summarize(c.recs, dd.levels.length ? dd.levels : sortLevels(S.d.sanksi)) : null; })();
  return h('a', { class: 'kid-card', href: `#anak/${encodeURIComponent(k.key)}` },
    avatar(s?.nama || k.nama),
    h('span', { class: 'grow min0 stack-xs' }, h('strong', { class: 'block ellipsis', text: s?.nama || k.nama }), h('span', { class: 'muted small', text: `Kelas ${s?.kelas || k.kelas}${sum ? ` · ${sum.total} poin` : ''}` }),
      sum ? h('span', null, levelBadge(sum.level, { small: true })) : null),
    icon('right'));
}

// ------------------------------------------------------------------ ANAK (cek per siswa)
let qNama = '';
function pageAnak(v, key) {
  const names = showNames();
  const kids = savedKids();
  const inp = h('input', { type: 'search', value: key && !key.startsWith('id:') ? key : '', placeholder: names ? 'NIS / NISN atau nama siswa' : 'Masukkan NIS atau NISN', 'aria-label': 'NIS atau NISN', inputmode: names ? 'text' : 'numeric', autocomplete: 'off', enterkeyhint: 'search' });
  const results = h('div');
  const submit = (e) => { e?.preventDefault(); const val = inp.value.trim(); if (!val) return inp.focus(); location.hash = `#anak/${encodeURIComponent(val.replace(/\s+/g, ''))}`; };
  if (names) inp.addEventListener('input', debounce(() => { qNama = inp.value.trim(); drawNames(); }, 150));
  function drawNames() {
    if (!qNama || /^\d+$/.test(qNama)) { results.replaceChildren(); return; }
    const list = data().aktif.filter((s) => matches(qNama, s.nama, s.kelas)).sort((a, b) => cmpNama(a.nama, b.nama)).slice(0, 20);
    results.replaceChildren(list.length ? h('div', { class: 'pick-list big' }, ...list.map((s) => h('a', { class: 'pick', href: `#anak/${encodeURIComponent(keyOf(s))}` },
      avatar(s.nama), h('span', { class: 'grow min0' }, h('span', { class: 'block pick-name ellipsis', text: s.nama }), h('span', { class: 'muted small', text: `Kelas ${s.kelas}` })), icon('right')))) : h('p', { class: 'muted small', text: 'Nama tidak ditemukan.' }));
  }
  v.append(head('Cek Perkembangan Siswa', names ? 'Ketik NIS/NISN atau nama siswa.' : 'Masukkan NIS atau NISN anak Anda (tertera di kartu pelajar / rapor).'),
    h('form', { class: 'card ds-search', onsubmit: submit },
      h('label', { class: 'fsel search big block' }, icon('search'), inp),
      btn('Lihat', null, { kind: 'primary', type: 'submit', ic: 'right' })),
    results,
    kids.length ? h('div', { class: 'chips' }, h('span', { class: 'muted small', text: 'Anak saya:' }), ...kids.map((k) => h('a', { class: 'chip' + (k.key === key ? ' on' : ''), href: `#anak/${encodeURIComponent(k.key)}` }, h('span', { text: `${k.nama} · ${k.kelas}` })))) : null);
  if (names && qNama) { inp.value = qNama; drawNames(); }
  if (!key) {
    v.append(h('section', { class: 'card ds-help' }, h('h3', { text: 'Apa yang bisa dilihat?' }),
      h('ul', { class: 'rules-list' },
        h('li', { text: 'Total poin pelanggaran dan tahap pembinaan anak saat ini.' }),
        h('li', { text: 'Riwayat pelanggaran: tanggal, bentuk pelanggaran, dan poinnya.' }),
        h('li', { text: 'Grafik perjalanan poin dan berapa poin lagi menuju tahap berikutnya.' }),
        h('li', { text: 'Simpan sebagai "Anak saya" agar berikutnya cukup sekali ketuk.' }))));
    return;
  }
  const box = h('div', { class: 'stack' }, h('p', { class: 'muted center', text: 'Mencari data…' }));
  v.append(box);
  lookup(key).then((res) => { box.replaceChildren(...detail(res, key)); }, (e) => {
    box.replaceChildren(emptyState('search', 'Data tidak ditemukan', e.message, h('a', { class: 'btn tonal', href: '#anak' }, h('span', { text: 'Cari lagi' }))));
  });
}

function detail(res, key) {
  const levels = data().levels.length ? data().levels : sortLevels(S.d.sanksi);
  const s = res.siswa;
  const sum = summarize(res.recs, levels);
  const lv = sum.level;
  const mood = !sum.total ? { cls: 'ok', ic: 'shield', title: 'Hebat! Belum ada catatan pelanggaran.', text: 'Terus pertahankan sikap disiplin dan contoh yang baik. 🌟' }
    : !lv ? { cls: 'info', ic: 'info', title: `Ada ${sum.count} catatan kecil.`, text: 'Yuk, terus perbaiki diri agar tidak bertambah.' }
      : { cls: lv.warna || 'warn', ic: 'alert', title: `Saat ini: ${lv.label}`, text: lv.tindakan };
  const saved = isSaved(key);
  const saveBtn = btn(saved ? 'Hapus dari "Anak saya"' : 'Simpan sebagai "Anak saya"', () => { toggleKid(key, s); toast(isSaved(key) ? 'Disimpan di HP ini.' : 'Dihapus dari daftar.'); route(true); }, { ic: saved ? 'x' : 'plus', kind: saved ? 'text' : 'tonal' });
  const wa = waNumber(S.settings.waSekolah);
  const tl = (res.tindak || []).filter((t) => t.status);
  return [
    h('section', { class: 'card ds-kid' },
      h('div', { class: 'profile-top' }, avatar(s.nama, 'lg' + (s.jk === 'P' ? ' f' : '')),
        h('div', { class: 'grow min0' }, h('h2', { class: 'profile-name', text: s.nama }), h('p', { class: 'muted', text: `Kelas ${s.kelas}${s.nis ? ' · NIS ' + s.nis : ''}` }))),
      h('div', { class: `ds-mood st-${mood.cls}` }, icon(mood.ic), h('div', null, h('strong', { text: mood.title }), h('p', { text: mood.text }))),
      h('div', { class: 'ds-score' },
        h('div', { class: 'score' }, h('span', { class: 'score-n', text: fmtNum(sum.total) }), h('span', { class: 'muted', text: 'poin akumulasi' })),
        h('div', { class: 'grow' }, levelBadge(lv), pointsMeter(sum.total, levels),
          h('p', { class: 'muted small', text: sum.next ? `${sum.toNext} poin lagi menuju tahap ${sum.next.label}.` : sum.total >= 100 ? 'Akumulasi poin maksimal telah tercapai.' : '' }))),
      h('div', { class: 'profile-actions' }, saveBtn,
        btn('Unduh / bagikan', () => openDoc(`Kartu Kedisiplinan ${s.nama}`, kartuHtml(s, sum), { fileBase: `Kartu-Kedisiplinan-${s.nama}`, waText: `Kartu kedisiplinan ${s.nama} (kelas ${s.kelas}) — ${S.settings.namaSekolah}` }), { ic: 'report' }),
        wa ? h('a', { class: 'btn wa', href: `https://wa.me/${wa}?text=${encodeURIComponent(`Selamat siang, saya orang tua/wali dari ${s.nama} (kelas ${s.kelas}). Saya ingin bertanya tentang perkembangan kedisiplinan anak saya.`)}`, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'Hubungi sekolah' })) : null),
      res.offline ? h('p', { class: 'muted small', text: `Offline — data tersimpan ${relTime(res.at)}.` }) : h('p', { class: 'muted small', text: `Data per ${res.at ? relTime(res.at) : '-'}.` })),
    tl.length ? h('section', { class: 'card' }, h('h3', { text: 'Pembinaan / tindak lanjut sekolah' }),
      h('div', { class: 'list' }, ...tl.map((t) => h('div', { class: 'row-item static' },
        h('span', { class: 'grow' }, levelBadge(levels.find((l) => l.kode === t.tahap) || { label: t.tahapLabel || t.tahap, warna: 'dark' }, { small: true })),
        h('span', { class: `badge sm st-${t.status === 'Selesai' ? 'ok' : t.status === 'Dijadwalkan' ? 'info' : 'warn'}`, text: t.status === 'Selesai' && t.tanggalPelaksanaan ? `Selesai ${fmtTgl(t.tanggalPelaksanaan, { short: true })}` : t.status }))))) : null,
    sum.count ? chartCard({ title: 'Perjalanan poin', sub: 'Garis bantu = batas tiap tahap',
      chart: cumChart(sum.timeline.map((t) => ({ x: fmtTgl(t.rec.tanggal, { short: true }), full: fmtTgl(t.rec.tanggal, { hari: true }), value: t.after, add: t.rec.poin, text: t.rec.uraian })), levels.map((l) => ({ ...l, short: l.kode === 'LISAN' ? 'Lisan' : l.kode === 'KELUAR' ? 'Keluar' : l.kode }))),
      table: { cols: ['Tanggal', 'Pelanggaran', 'Poin', 'Akumulasi'], rows: sum.timeline.map((t) => [fmtTgl(t.rec.tanggal), t.rec.uraian, t.rec.poin, t.after]) } }) : null,
    h('section', { class: 'card' }, h('h3', { text: `Riwayat pelanggaran (${sum.count})` }),
      sum.count ? h('div', { class: 'list' }, ...[...sum.timeline].reverse().map((t) => h('div', { class: 'row-item static rec' },
        h('span', { class: `rec-pts st-${TINGKAT_WARNA[t.rec.tingkat] || 'info'}` }, h('strong', { text: `+${t.rec.poin}` })),
        h('div', { class: 'grow min0' }, h('div', { class: 'row-title wrap', text: t.rec.uraian }),
          h('div', { class: 'row-sub muted' }, h('span', { text: fmtTgl(t.rec.tanggal, { hari: true }) }), tingkatBadge(t.rec.tingkat), t.rec.tindakanLangsung ? h('span', { text: `Tindakan: ${t.rec.tindakanLangsung}` }) : null)),
        h('span', { class: 'muted small nowrap', text: `= ${t.after}` }))))
        : h('p', { class: 'muted', text: 'Belum ada pelanggaran. 👍' })),
    h('section', { class: 'card ds-tips' }, h('h3', { text: 'Tips untuk orang tua' }),
      h('ul', { class: 'rules-list' },
        h('li', { text: 'Ajak anak berbicara dengan tenang tentang catatan pelanggarannya dan dengarkan alasannya.' }),
        h('li', { text: 'Bantu anak disiplin waktu, kerapian seragam, dan penggunaan HP yang bijak.' }),
        h('li', { text: 'Beri pujian saat anak menunjukkan perbaikan.' }),
        h('li', { text: 'Hubungi wali kelas atau Guru BK bila membutuhkan pendampingan.' }))),
  ];
}

// ------------------------------------------------------------------ KELAS
function pageKelas(v, kelasArg) {
  const dd = data();
  v.append(head('Rekap Kelas', 'Perkembangan kedisiplinan per kelas'));
  if (dd.mode === 'none') { v.append(noData()); return; }
  const kidKelas = savedKids()[0]?.kelas;
  const kelas = dd.kelasList.includes(kelasArg) ? kelasArg : dd.kelasList.includes(kidKelas) ? kidKelas : dd.kelasList[0];
  v.append(h('div', { class: 'chips scroll ds-kelas-chips' }, ...dd.kelasList.map((k) => h('a', { class: 'chip' + (k === kelas ? ' on' : ''), href: `#kelas/${k}` }, h('span', { text: `Kelas ${k}` })))));
  if (!kelas) { v.append(emptyState('school', 'Belum ada kelas', '')); return; }
  const ss = dd.aktif.filter((x) => x.kelas === kelas);
  const st = kelasStats(dd).find((x) => x.kelas === kelas);
  const pr = periodRange(periode);
  const recs = filterRecords(dd.recs, { kelas, from: pr.from, to: pr.to });
  const t = totals(recs);
  v.append(h('div', { class: 'tiles ds-tiles' },
    statTile('Siswa', fmtNum(ss.length), { ic: 'users', sub: `${ss.filter((x) => x.jk === 'L').length} L · ${ss.filter((x) => x.jk === 'P').length} P` }),
    statTile('Tanpa pelanggaran', `${st.pct}%`, { ic: 'shield', tone: 'ok', sub: `${st.bersih} siswa` }),
    statTile(`Pelanggaran · ${pr.label}`, fmtNum(t.n), { ic: 'clipboard', sub: `${fmtNum(t.poin)} poin` }),
    statTile('Rata-rata poin', fmtNum(st.rata, 1), { ic: 'scale', sub: 'per siswa (akumulasi)' })));
  v.append(h('div', { class: 'seg ds-period', role: 'tablist', 'aria-label': 'Periode' }, ...[['bulan', 'Bulan ini'], ['semester', 'Semester ini'], ['ta', 'Tahun ajaran']].map(([k, l]) =>
    h('button', { type: 'button', role: 'tab', class: periode === k ? 'on' : '', 'aria-selected': String(periode === k), onclick: () => { periode = k; route(true); } }, h('span', { text: l })))));
  const grid = h('div', { class: 'dash-grid' });
  v.append(grid);
  const tr = trend(recs, pr.from, pr.to, ymd());
  grid.append(chartCard({ cls: 'span-8', title: `Pelanggaran kelas ${kelas}`, sub: `${pr.label} · per ${tr.gran}`, chart: columnChart(tr.buckets), table: { cols: ['Periode', 'Pelanggaran'], rows: tr.buckets.map((b) => [b.full, b.value]) } }));
  grid.append(levelCard(dd, ss, 'span-4'));
  const top = countBy(recs, (r) => r.jenisKode).slice(0, 6);
  grid.append(chartCard({ cls: 'span-6', title: 'Pelanggaran paling sering', sub: pr.label, chart: barList(top.map((g) => ({ label: uraianOf(g.key, recs), value: g.n, sub: `${g.nSiswa} siswa` })), { unit: 'kali', empty: 'Tidak ada pelanggaran pada periode ini. 🎉' }),
    table: { cols: ['Pelanggaran', 'Kali'], rows: top.map((g) => [uraianOf(g.key, recs), g.n]) } }));
  const kat = D().kategori.map((k) => ({ label: `${k.kode}. ${k.nama}`, value: recs.filter((r) => r.kategori === k.kode).length }));
  grid.append(chartCard({ cls: 'span-6', title: 'Per kategori', sub: pr.label, chart: barList(kat, { unit: 'pelanggaran' }), table: { cols: ['Kategori', 'Pelanggaran'], rows: kat.map((k) => [k.label, k.value]) } }));
  if (showNames()) {
    const sorted = [...ss].sort((a, b) => cmpNama(a.nama, b.nama));
    grid.append(h('section', { class: 'card span-12' }, h('h3', { text: 'Daftar siswa' }),
      h('div', { class: 'list' }, ...sorted.map((x) => { const sm = dd.summaries.get(x.id); return h('a', { class: 'row-item', href: `#anak/${encodeURIComponent(keyOf(x))}` }, avatar(x.nama), h('span', { class: 'grow min0 ellipsis', text: x.nama }), h('strong', { text: `${sm.total}` }), levelBadge(sm.level, { small: true })); }))));
  } else {
    v.append(h('p', { class: 'muted small center', text: 'Demi privasi, nama siswa tidak ditampilkan. Untuk melihat data anak, buka menu "Anak" dan masukkan NIS.' }));
  }
  v.append(dataStamp());
}

// ------------------------------------------------------------------ TATA TERTIB & INFO
function pageAturan(v) { aturan.render(v, { parts: [], query: {} }, { publik: true }); }

function pageInfo(v) {
  const s = S.settings;
  const wa = waNumber(s.waSekolah);
  v.append(head('Informasi', s.namaSekolah));
  if (s.infoSiswa) v.append(h('section', { class: 'card notice-card' }, h('div', { class: 'row gap-sm' }, icon('bell'), h('h3', { text: 'Pengumuman' })), h('p', { class: 'pre', text: s.infoSiswa })));
  v.append(h('section', { class: 'card stack-sm' }, h('h3', { text: 'Kontak sekolah' }),
    s.alamat ? h('p', null, icon('pin'), ' ', s.alamat) : null,
    s.telepon ? h('p', null, icon('phone'), ' ', h('a', { href: `tel:${s.telepon.replace(/[^\d+]/g, '')}`, text: s.telepon })) : null,
    s.email ? h('p', null, icon('info'), ' ', h('a', { href: `mailto:${s.email}`, text: s.email })) : null,
    wa ? h('a', { class: 'btn wa', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'WhatsApp sekolah' })) : null,
    !s.alamat && !s.telepon && !s.email && !wa ? h('p', { class: 'muted', text: 'Kontak belum diisi oleh sekolah.' }) : null));
  v.append(h('section', { class: 'card' }, h('h3', { text: 'Cara membaca poin' }),
    h('ul', { class: 'rules-list' },
      h('li', { text: 'Setiap pelanggaran diberi poin sesuai tata tertib (guru dapat menyesuaikan sesuai kejadian).' }),
      h('li', { text: 'Poin dijumlahkan selama siswa bersekolah dan tidak dapat dikurangi.' }),
      h('li', null, 'Tahap pembinaan: ', ...data().levels.map((l, i) => h('span', null, i ? ', ' : '', h('strong', { text: `${l.min}+` }), ` ${l.label}`)), '.'),
      h('li', { text: `Akumulasi di atas ${s.batasSidang} poin diputuskan melalui Sidang Dewan Guru.` }),
      h('li', { text: 'Setiap pelanggaran didokumentasikan dalam Berita Acara Pemeriksaan (BAP).' }))));
  const installBtn = PWA.installEvt ? btn('Pasang di HP', () => install(), { kind: 'primary', ic: 'install' })
    : isIOS() && !PWA.installed ? btn('Cara pasang di iPhone', () => dialog('Pasang di iPhone/iPad', 'Buka halaman ini di Safari → ketuk tombol Bagikan → "Tambah ke Layar Utama".'), { ic: 'install' }) : null;
  v.append(h('section', { class: 'card stack-sm' }, h('h3', { text: 'Aplikasi' }),
    h('p', { class: 'muted small', text: `Versi ${APP_VERSION} · halaman ini bisa dibuka tanpa internet setelah dibuka sekali. ${S.sync.lastOk ? `Data diperbarui ${relTime(S.sync.lastOk)}.` : ''}` }),
    h('div', { class: 'row gap-sm wrap' }, installBtn, btn('Update data & tampilan', runUpdate, { ic: 'download' }), h('a', { class: 'btn text', href: 'index.html' }, icon('login'), h('span', { text: 'Halaman guru' })))));
}

// ------------------------------------------------------------------ start
async function boot() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
  try { await loadAll(); } catch (e) {
    document.getElementById('app').replaceChildren(emptyState('alert', 'Penyimpanan HP tidak dapat dibuka', e.message));
    return;
  }
  buildShell();
  route();
  document.getElementById('splash')?.remove();
  window.addEventListener('hashchange', () => route());
  let pending = false;
  const live = debounce(() => {
    const a = document.activeElement;
    if ((a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || document.querySelector('.scrim')) { pending = true; return; }
    pending = false;
    route(true);
  }, 120);
  on('data', live);
  on('sync', drawBanners);
  on('pwa', drawBanners);
  view.addEventListener('focusout', () => setTimeout(() => { if (pending) live(); }, 250));
  registerSW();
  startAuto();
  if (!S.demo && S.serverUrl) syncNow({ full: !S.meta.lastPull });
  window.__siswa = { S, data };
}

boot();
