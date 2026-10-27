// Halaman Siswa & Orang Tua (DashboardSiswa.html): tanpa login, ceria, bisa offline.
// Menu: Beranda (ringkasan sekolah & Top 10) · Anak (cari Nama / NIS / NISN) · Kelas · Tata Tertib · Info.
import { h, icon, btn, toast, dialog } from './ui/dom.js';
import { barList, chartCard, columnChart, cumChart, pointsMeter, stackBar, hideTip } from './ui/charts.js';
import { avatar, emptyState, levelBadge, tingkatBadge, statTile, deltaChip, TINGKAT_WARNA } from './ui/widgets.js';
import { openDoc } from './ui/export.js';
import { kartuHtml } from './ui/print.js';
import * as aturan from './pages/aturan.js';
import { S, D, on, loadAll } from './store.js';
import { startAuto, syncNow } from './sync.js';
import { call } from './api.js';
import { PWA, applyTheme, applyUpdate, install, isIOS, registerSW, updateApp } from './pwa.js';
import { buildSummaries, sortLevels, summarize } from './core/points.js';
import { countBy, filterRecords, periodRange, totals, trend } from './core/stats.js';
import { cmpKelas, cmpNama, debounce, fmtNum, fmtTgl, matches, relTime, waNumber, ymd } from './core/util.js';
import { APP_VERSION } from './config.js';

const TABS = [
  { kode: 'beranda', label: 'Beranda', ic: 'home' },
  { kode: 'anak', label: 'Cari Siswa', ic: 'search' },
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

// Pastikan mode nama selalu diaktifkan agar pencarian Nama & Top 10 tampil lengkap
function ensureShowNames() {
  if (S && S.settings) S.settings.dashboardSiswa = 'nama';
}

// ------------------------------------------------------------------ data (lengkap / anonim)
let memo = { key: '' };
function data() {
  ensureShowNames();
  const mode = S.d.siswa.length ? 'full' : S.anon ? 'anon' : 'none';
  const key = `${mode}:${S.ver}`;
  if (memo.key === key) return memo;
  const levels = sortLevels(S.d.sanksi);
  let siswa = [], recs = [], summaries = new Map();
  if (mode === 'full') {
    siswa = S.d.siswa;
    recs = S.d.pelanggaran.filter((r) => !r.batal);
    summaries = D().summaries;
  } else if (mode === 'anon') {
    siswa = S.anon.siswa;
    recs = S.anon.pelanggaran;
    summaries = buildSummaries(siswa, recs, levels);
  }
  const aktif = siswa.filter((s) => (s.status || 'Aktif') === 'Aktif');
  const kelasList = [...new Set(aktif.map((s) => s.kelas).filter(Boolean))].sort(cmpKelas);
  memo = { key, mode, levels, siswa, aktif, recs, summaries, kelasList };
  return memo;
}

const showNames = () => data().mode !== 'none';
const keyOf = (s) => (s.nis ? String(s.nis).replace(/\s+/g, '') : `id:${s.id}`);

/** Cari siswa berdasarkan NIS, NISN, ID, atau Nama Siswa */
async function lookup(rawKey) {
  const q = String(rawKey || '').trim();
  const kNoSpace = q.replace(/\s+/g, '');
  const qLower = q.toLowerCase();
  const dd = data();

  if (dd.mode === 'full' || dd.siswa.length) {
    const pool = S.d.siswa.length ? S.d.siswa : dd.siswa;
    // 1. Cek berdasarkan ID, NIS, atau NISN persis
    let s = kNoSpace.startsWith('id:')
      ? pool.find((x) => String(x.id) === kNoSpace.slice(3))
      : pool.find((x) =>
          (x.nis && String(x.nis).replace(/\s+/g, '').toLowerCase() === kNoSpace.toLowerCase()) ||
          (x.nisn && String(x.nisn).replace(/\s+/g, '').toLowerCase() === kNoSpace.toLowerCase())
        );

    // 2. Cek berdasarkan Nama persis (case-insensitive)
    if (!s) {
      s = pool.find((x) => x.nama && x.nama.trim().toLowerCase() === qLower);
    }

    // 3. Cek berdasarkan kecocokan sebagian Nama / Kelas
    if (!s) {
      const matchedList = pool.filter((x) => x.nama && matches(q, x.nama, x.kelas));
      if (matchedList.length === 1) {
        s = matchedList[0];
      } else if (matchedList.length > 1) {
        const err = new Error(`Ditemukan ${matchedList.length} siswa dengan kata kunci "${q}". Silakan pilih salah satu di bawah.`);
        err.candidates = matchedList;
        throw err;
      }
    }

    if (s) {
      const allRecs = S.d.pelanggaran.length ? S.d.pelanggaran : dd.recs;
      return {
        siswa: s,
        recs: allRecs.filter((r) => r.siswaId === s.id && !r.batal),
        tindak: D().tindak ? D().tindak.filter((t) => t.siswaId === s.id && t.stored) : [],
        at: S.sync.lastOk || S.meta.lastPull,
      };
    }
    throw new Error(`Siswa dengan Nama / NIS / NISN "${q}" tidak ditemukan. Periksa kembali ejaan atau pilih dari daftar saran.`);
  }

  // Fallback pencarian ke server bila data lokal belum terunduh penuh
  const cached = ls.get('ds.cek.' + kNoSpace, null);
  if (!navigator.onLine || !S.serverUrl) {
    if (cached) return { ...cached, offline: true };
    throw new Error('Perlu koneksi internet untuk mencari data siswa pertama kali.');
  }
  try {
    const r = await call(S.serverUrl, { action: 'cekSiswa', nis: q, nama: q }, 30000);
    const res = { siswa: r.siswa, recs: r.pelanggaran, tindak: r.tindak, at: Date.now() };
    ls.set('ds.cek.' + kNoSpace, res);
    return res;
  } catch (e) {
    if (cached && e.code !== 'NOT_FOUND') return { ...cached, offline: true };
    throw e.code === 'BAD_REQUEST' ? new Error('Server sekolah belum diperbarui ke versi terbaru. Hubungi Admin.') : e;
  }
}

// ------------------------------------------------------------------ Komponen Top 10 Siswa Poin Terbanyak
let top10Kelas = 'ALL';
function renderTop10Section(dd, forcedKelas = null) {
  const activeKelas = forcedKelas || top10Kelas;
  const pool = activeKelas === 'ALL' ? dd.aktif : dd.aktif.filter((s) => s.kelas === activeKelas);

  const ranked = pool
    .map((s) => {
      const sum = dd.summaries.get(s.id) || { total: 0, count: 0, level: null };
      return { s, total: sum.total || 0, count: sum.count || 0, level: sum.level };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || b.count - a.count || cmpNama(a.s.nama || '', b.s.nama || ''))
    .slice(0, 10);

  const maxPts = ranked[0]?.total || 100;
  const medals = ['👑', '🥈', '🥉'];

  const filterChips = !forcedKelas && dd.kelasList.length > 1
    ? h('div', { class: 'chips scroll', style: 'margin-bottom: 12px;' },
        h('button', {
          type: 'button',
          class: 'chip' + (top10Kelas === 'ALL' ? ' on' : ''),
          onclick: () => { top10Kelas = 'ALL'; route(true); },
        }, h('span', { text: '🌟 Semua Kelas' })),
        ...dd.kelasList.map((k) =>
          h('button', {
            type: 'button',
            class: 'chip' + (top10Kelas === k ? ' on' : ''),
            onclick: () => { top10Kelas = k; route(true); },
          }, h('span', { text: `Kelas ${k}` }))
        )
      )
    : null;

  if (!ranked.length) {
    return h('section', { class: 'top10-section' },
      h('div', { class: 'top10-head' },
        h('div', { class: 'top10-title-wrap' },
          h('div', { class: 'top10-trophy', text: '🏆' }),
          h('div', null,
            h('h3', { class: 'top10-main-title', text: `Top 10 Siswa Poin Terbanyak${forcedKelas ? ` · Kelas ${forcedKelas}` : ''}` }),
            h('p', { class: 'top10-sub', text: 'Luar biasa! Belum ada siswa yang memiliki poin pelanggaran.' })
          )
        )
      ),
      filterChips,
      h('p', { class: 'muted center', style: 'padding: 16px 0;', text: '🎉 Semua siswa di kategori ini memiliki 0 poin pelanggaran!' })
    );
  }

  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3, 10);

  return h('section', { class: 'top10-section' },
    h('div', { class: 'top10-head' },
      h('div', { class: 'top10-title-wrap' },
        h('div', { class: 'top10-trophy', text: '⚡' }),
        h('div', null,
          h('h3', { class: 'top10-main-title', text: `Top 10 Siswa Poin Terbanyak${forcedKelas ? ` · Kelas ${forcedKelas}` : ''}` }),
          h('p', { class: 'top10-sub', text: 'Ketuk nama siswa untuk melihat detail riwayat & tahap pembinaan' })
        )
      )
    ),
    filterChips,
    // Podium 1 - 3
    h('div', { class: 'top3-podium' },
      ...top3.map((item, idx) => {
        const displayName = item.s.nama || `Siswa #${item.s.nis || item.s.id}`;
        return h('a', { class: `podium-card r-${idx + 1}`, href: `#anak/${encodeURIComponent(keyOf(item.s))}` },
          h('span', { class: 'podium-rank', text: medals[idx] }),
          avatar(displayName, item.s.jk === 'P' ? 'f' : ''),
          h('div', { class: 'grow min0' },
            h('strong', { class: 'block ellipsis', text: displayName }),
            h('span', { class: 'muted small block', text: `Kelas ${item.s.kelas} · ${item.count}x catatan` }),
            item.level ? levelBadge(item.level, { small: true }) : null
          ),
          h('div', { class: 'podium-pts' },
            h('strong', { text: fmtNum(item.total) }),
            h('span', { text: 'Poin' })
          )
        );
      })
    ),
    // Peringkat 4 - 10
    rest.length
      ? h('div', { class: 'top10-list' },
          ...rest.map((item, idx) => {
            const rank = idx + 4;
            const displayName = item.s.nama || `Siswa #${item.s.nis || item.s.id}`;
            const pct = Math.max(8, Math.min(100, Math.round((item.total / maxPts) * 100)));
            return h('a', { class: 'top10-row', href: `#anak/${encodeURIComponent(keyOf(item.s))}` },
              h('span', { class: 'rank-num', text: `#${rank}` }),
              avatar(displayName, 'sm' + (item.s.jk === 'P' ? ' f' : '')),
              h('div', { class: 'grow min0' },
                h('div', { class: 'row gap-sm wrap', style: 'align-items:center;' },
                  h('strong', { class: 'ellipsis', text: displayName }),
                  h('span', { class: 'muted small', text: `Kelas ${item.s.kelas} · ${item.count} pelanggaran` }),
                  item.level ? levelBadge(item.level, { small: true }) : null
                ),
                h('div', { class: 'top10-bar-wrap' },
                  h('div', { class: 'top10-bar-fill', style: `width: ${pct}%` })
                )
              ),
              h('span', { class: 'top10-pts-badge', text: `${fmtNum(item.total)} Poin` }),
              icon('right')
            );
          })
        )
      : null
  );
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
        h('span', { class: 'brand-text' }, h('span', { class: 'brand-title', text: '✨ Info Kedisiplinan' }), h('span', { class: 'brand-sub', text: S.settings.namaSekolah }))),
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
  ensureShowNames();
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
      h('h1', { text: 'Halo, Bapak/Ibu & Siswa! 🌈👋' }),
      h('p', { text: `Pantau perkembangan kedisiplinan siswa ${s.namaSekolah} · TA ${s.tahunAjaran} · Semester ${s.semester}` }),
      h('div', { class: 'row gap-sm wrap' },
        h('a', { class: 'btn primary big', href: '#anak' }, icon('search'), h('span', { text: 'Cari Nama / NIS Siswa' })),
        h('a', { class: 'btn tonal', href: '#aturan' }, icon('book'), h('span', { text: 'Tata Tertib' })))),
    h('div', { class: 'ds-hero-art', 'aria-hidden': 'true' }, icon('shield'))));

  if (kids.length) v.append(h('section', { class: 'card' }, h('h3', { text: '💖 Anak Saya' }),
    h('div', { class: 'kid-grid' }, ...kids.map((k) => kidCard(k)))));
  if (s.infoSiswa) v.append(h('section', { class: 'card notice-card' }, h('div', { class: 'row gap-sm' }, icon('bell'), h('h3', { text: '📢 Pengumuman Sekolah' })), h('p', { class: 'pre', text: s.infoSiswa })));
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
    statTile('Siswa Tanpa Pelanggaran', `${pct}%`, { ic: 'shield', tone: 'ok', sub: `${fmtNum(bersih)} dari ${fmtNum(dd.aktif.length)} siswa aktif` }),
    statTile('Pelanggaran Bulan Ini', fmtNum(nBulan), { ic: 'clipboard', delta: deltaChip(nBulan, nPrev, 'bulan lalu') }),
    statTile('Rata-rata Poin Siswa', fmtNum(dd.aktif.length ? totalPoin / dd.aktif.length : 0, 1), { ic: 'scale', sub: 'akumulasi seluruh masa sekolah' }),
    statTile('Kelas Paling Disiplin', teladan ? teladan.kelas : '-', { ic: 'spark', sub: teladan ? `${teladan.pct}% siswa tanpa pelanggaran` : '' })));

  // Tampilkan Top 10 Siswa dengan Poin Terbanyak di Beranda
  v.append(renderTop10Section(dd));

  v.append(h('div', { class: 'seg ds-period', role: 'tablist', 'aria-label': 'Periode' }, ...[['bulan', 'Bulan ini'], ['semester', 'Semester ini'], ['ta', 'Tahun ajaran']].map(([k, l]) =>
    h('button', { type: 'button', role: 'tab', class: periode === k ? 'on' : '', 'aria-selected': String(periode === k), onclick: () => { periode = k; route(true); } }, h('span', { text: l })))));

  const grid = h('div', { class: 'dash-grid' });
  v.append(grid);
  const tr = trend(recs, pr.from, pr.to, ymd());
  grid.append(chartCard({ cls: 'span-8', title: '📈 Grafik Jumlah Pelanggaran', sub: `${pr.label} · per ${tr.gran}`, chart: columnChart(tr.buckets),
    table: { cols: ['Periode', 'Pelanggaran'], rows: tr.buckets.map((b) => [b.full, b.value]) } }));
  grid.append(levelCard(dd, dd.aktif, 'span-4'));
  const top = countBy(recs, (r) => r.jenisKode).slice(0, 6);
  grid.append(chartCard({ cls: 'span-6', title: '⚠️ Pelanggaran Paling Sering', sub: 'Mari bersama menghindarinya', chart: barList(top.map((g) => ({ label: uraianOf(g.key, recs), value: g.n, sub: `${g.nSiswa} siswa` })), { unit: 'kali', empty: 'Tidak ada pelanggaran pada periode ini. 🎉' }),
    table: { cols: ['Pelanggaran', 'Kali', 'Siswa'], rows: top.map((g) => [uraianOf(g.key, recs), g.n, g.nSiswa]) } }));
  const kat = D().kategori.map((k) => ({ label: `${k.kode}. ${k.nama}`, value: recs.filter((r) => r.kategori === k.kode).length }));
  grid.append(chartCard({ cls: 'span-6', title: '🗂️ Per Jenis Kategori', sub: pr.label, chart: barList(kat, { unit: 'pelanggaran' }), table: { cols: ['Kategori', 'Pelanggaran'], rows: kat.map((k) => [k.label, k.value]) } }));
  const rank = [...kelasStat].sort((a, b) => b.pct - a.pct || a.rata - b.rata);
  grid.append(chartCard({ cls: 'span-12', title: '🏅 Peringkat Kelas Disiplin', sub: 'Persentase siswa tanpa pelanggaran (seluruh masa sekolah)',
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
  return chartCard({ cls, title: '🛡️ Status Siswa', sub: 'Berdasarkan akumulasi poin', chart: stackBar(parts, { unit: 'siswa' }), table: { cols: ['Tahap', 'Siswa'], rows: parts.map((p) => [p.label, p.value]) } });
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

// ------------------------------------------------------------------ ANAK (cari per siswa dengan Nama / NIS / NISN)
let qNama = '';
function pageAnak(v, key) {
  const dd = data();
  const kids = savedKids();
  const inp = h('input', {
    type: 'search',
    value: key && !key.startsWith('id:') ? key : '',
    placeholder: '🔍 Ketik Nama Siswa, NIS, NISN, atau Kelas…',
    'aria-label': 'Cari Nama Siswa, NIS, atau NISN',
    inputmode: 'text',
    autocomplete: 'off',
    enterkeyhint: 'search',
  });
  const results = h('div');

  const submit = (e) => {
    e?.preventDefault();
    const val = inp.value.trim();
    if (!val) return inp.focus();
    location.hash = `#anak/${encodeURIComponent(val)}`;
  };

  inp.addEventListener('input', debounce(() => {
    qNama = inp.value.trim();
    drawSuggestions();
  }, 120));

  function renderStudentPickItem(s) {
    const sum = dd.summaries.get(s.id) || { total: 0, level: null };
    return h('a', {
      class: 'pick',
      href: `#anak/${encodeURIComponent(keyOf(s))}`,
      onclick: () => { qNama = ''; },
    },
      avatar(s.nama, s.jk === 'P' ? 'f' : ''),
      h('span', { class: 'grow min0' },
        h('span', { class: 'block pick-name ellipsis', style: 'font-weight:700;', text: s.nama }),
        h('span', { class: 'muted small', text: `Kelas ${s.kelas}${s.nis ? ` · NIS ${s.nis}` : ''}${s.nisn ? ` · NISN ${s.nisn}` : ''}` })
      ),
      h('span', { class: 'pick-poin-badge' + (sum.total === 0 ? ' clean' : ''), text: `${fmtNum(sum.total)} Poin` }),
      icon('right')
    );
  }

  function drawSuggestions() {
    if (!qNama) {
      results.replaceChildren();
      return;
    }
    const qLow = qNama.toLowerCase();
    const list = dd.aktif
      .filter((s) =>
        matches(qNama, s.nama, s.kelas) ||
        (s.nis && String(s.nis).toLowerCase().includes(qLow)) ||
        (s.nisn && String(s.nisn).toLowerCase().includes(qLow))
      )
      .sort((a, b) => cmpNama(a.nama, b.nama))
      .slice(0, 25);

    results.replaceChildren(
      list.length
        ? h('div', { class: 'pick-list big' },
            h('div', { class: 'muted small', style: 'padding: 8px 16px; background:#EEF2FF; font-weight:600;', text: `Ditemukan ${list.length} siswa yang cocok — ketuk untuk membuka:` }),
            ...list.map(renderStudentPickItem)
          )
        : h('p', { class: 'muted small', style: 'padding: 8px 4px;', text: 'Tidak ada saran nama/NIS yang cocok di daftar lokal. Tekan "Lihat" untuk mencari.' })
    );
  }

  v.append(
    head('🔍 Cari & Cek Perkembangan Siswa', 'Bisa mencari menggunakan Nama Siswa, NIS, NISN, atau Kelas.'),
    h('form', { class: 'card ds-search', onsubmit: submit },
      h('label', { class: 'fsel search big block' }, icon('search'), inp),
      btn('Lihat', null, { kind: 'primary', type: 'submit', ic: 'right' })
    ),
    results,
    kids.length
      ? h('div', { class: 'chips' },
          h('span', { class: 'muted small', text: '💖 Anak saya:' }),
          ...kids.map((k) => h('a', { class: 'chip' + (k.key === key ? ' on' : ''), href: `#anak/${encodeURIComponent(k.key)}` }, h('span', { text: `${k.nama} · ${k.kelas}` })))
        )
      : null
  );

  if (qNama && !key) {
    inp.value = qNama;
    drawSuggestions();
  }

  if (!key) {
    if (dd.mode !== 'none') {
      v.append(renderTop10Section(dd));
    }
    v.append(
      h('section', { class: 'card ds-help' },
        h('h3', { text: '✨ Apa saja yang bisa dilihat di sini?' }),
        h('ul', { class: 'rules-list' },
          h('li', { text: 'Cari siswa dengan mudah cukup ketik Nama Lengkap, Nama Panggilan, NIS, atau NISN.' }),
          h('li', { text: 'Lihat total poin pelanggaran dan tahap pembinaan anak saat ini.' }),
          h('li', { text: 'Riwayat pelanggaran lengkap: tanggal, bentuk pelanggaran, dan poinnya.' }),
          h('li', { text: 'Simpan sebagai "Anak saya" agar berikutnya cukup sekali ketuk di Beranda.' })
        )
      )
    );
    return;
  }

  const box = h('div', { class: 'stack' }, h('p', { class: 'muted center', text: 'Mencari data siswa…' }));
  v.append(box);
  lookup(key).then(
    (res) => {
      results.replaceChildren();
      box.replaceChildren(...detail(res, keyOf(res.siswa)));
    },
    (e) => {
      if (e.candidates && e.candidates.length) {
        box.replaceChildren(
          h('section', { class: 'card' },
            h('h3', { text: `🔍 Hasil Pencarian Nama "${key}" (${e.candidates.length} Siswa)` }),
            h('p', { class: 'muted small', style: 'margin-bottom:12px;', text: 'Pilih nama siswa yang ingin Anda lihat:' }),
            h('div', { class: 'pick-list big' }, ...e.candidates.map(renderStudentPickItem))
          )
        );
      } else {
        box.replaceChildren(emptyState('search', 'Data tidak ditemukan', e.message, h('a', { class: 'btn tonal', href: '#anak' }, h('span', { text: 'Cari lagi' }))));
      }
    }
  );
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
        h('div', { class: 'grow min0' }, h('h2', { class: 'profile-name', text: s.nama }), h('p', { class: 'muted', text: `Kelas ${s.kelas}${s.nis ? ' · NIS ' + s.nis : ''}${s.nisn ? ' · NISN ' + s.nisn : ''}` }))),
      h('div', { class: `ds-mood st-${mood.cls}` }, icon(mood.ic), h('div', null, h('strong', { text: mood.title }), h('p', { text: mood.text }))),
      h('div', { class: 'ds-score' },
        h('div', { class: 'score' }, h('span', { class: 'score-n', text: fmtNum(sum.total) }), h('span', { class: 'muted', text: 'poin akumulasi' })),
        h('div', { class: 'grow' }, levelBadge(lv), pointsMeter(sum.total, levels),
          h('p', { class: 'muted small', text: sum.next ? `${sum.toNext} poin lagi menuju tahap ${sum.next.label}.` : sum.total >= 100 ? 'Akumulasi poin maksimal telah tercapai.' : '' }))),
      h('div', { class: 'profile-actions' }, saveBtn,
        btn('Unduh / bagikan', () => openDoc(`Kartu Kedisiplinan ${s.nama}`, kartuHtml(s, sum, { kronologi: false }), { fileBase: `Kartu-Kedisiplinan-${s.nama}`, waText: `Kartu kedisiplinan ${s.nama} (kelas ${s.kelas}) — ${S.settings.namaSekolah}` }), { ic: 'report' }),
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
    h('section', { class: 'card ds-tips' }, h('h3', { text: '💡 Tips untuk Orang Tua' }),
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
  v.append(head('🏫 Rekap Kelas', 'Perkembangan kedisiplinan per kelas'));
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
    statTile('Tanpa Pelanggaran', `${st.pct}%`, { ic: 'shield', tone: 'ok', sub: `${st.bersih} siswa` }),
    statTile(`Pelanggaran · ${pr.label}`, fmtNum(t.n), { ic: 'clipboard', sub: `${fmtNum(t.poin)} poin` }),
    statTile('Rata-rata Poin', fmtNum(st.rata, 1), { ic: 'scale', sub: 'per siswa (akumulasi)' })));

  // Top 10 khusus kelas terpilih
  v.append(renderTop10Section(dd, kelas));

  v.append(h('div', { class: 'seg ds-period', role: 'tablist', 'aria-label': 'Periode' }, ...[['bulan', 'Bulan ini'], ['semester', 'Semester ini'], ['ta', 'Tahun ajaran']].map(([k, l]) =>
    h('button', { type: 'button', role: 'tab', class: periode === k ? 'on' : '', 'aria-selected': String(periode === k), onclick: () => { periode = k; route(true); } }, h('span', { text: l })))));
  const grid = h('div', { class: 'dash-grid' });
  v.append(grid);
  const tr = trend(recs, pr.from, pr.to, ymd());
  grid.append(chartCard({ cls: 'span-8', title: `📈 Pelanggaran Kelas ${kelas}`, sub: `${pr.label} · per ${tr.gran}`, chart: columnChart(tr.buckets), table: { cols: ['Periode', 'Pelanggaran'], rows: tr.buckets.map((b) => [b.full, b.value]) } }));
  grid.append(levelCard(dd, ss, 'span-4'));
  const top = countBy(recs, (r) => r.jenisKode).slice(0, 6);
  grid.append(chartCard({ cls: 'span-6', title: '⚠️ Pelanggaran Paling Sering', sub: pr.label, chart: barList(top.map((g) => ({ label: uraianOf(g.key, recs), value: g.n, sub: `${g.nSiswa} siswa` })), { unit: 'kali', empty: 'Tidak ada pelanggaran pada periode ini. 🎉' }),
    table: { cols: ['Pelanggaran', 'Kali'], rows: top.map((g) => [uraianOf(g.key, recs), g.n]) } }));
  const kat = D().kategori.map((k) => ({ label: `${k.kode}. ${k.nama}`, value: recs.filter((r) => r.kategori === k.kode).length }));
  grid.append(chartCard({ cls: 'span-6', title: '🗂️ Per Kategori', sub: pr.label, chart: barList(kat, { unit: 'pelanggaran' }), table: { cols: ['Kategori', 'Pelanggaran'], rows: kat.map((k) => [k.label, k.value]) } }));

  if (showNames()) {
    const sorted = [...ss].sort((a, b) => (dd.summaries.get(b.id)?.total || 0) - (dd.summaries.get(a.id)?.total || 0) || cmpNama(a.nama, b.nama));
    grid.append(h('section', { class: 'card span-12' }, h('h3', { text: `📋 Daftar Siswa Kelas ${kelas} (${sorted.length} Siswa)` }),
      h('div', { class: 'list' }, ...sorted.map((x) => {
        const sm = dd.summaries.get(x.id) || { total: 0, level: null };
        return h('a', { class: 'row-item', href: `#anak/${encodeURIComponent(keyOf(x))}` },
          avatar(x.nama, x.jk === 'P' ? 'f' : ''),
          h('div', { class: 'grow min0' },
            h('strong', { class: 'block ellipsis', text: x.nama }),
            h('span', { class: 'muted small', text: x.nis ? `NIS ${x.nis}` : '' })
          ),
          h('span', { class: 'pick-poin-badge' + (sm.total === 0 ? ' clean' : ''), text: `${sm.total} Poin` }),
          levelBadge(sm.level, { small: true })
        );
      }))));
  }
  v.append(dataStamp());
}

// ------------------------------------------------------------------ TATA TERTIB & INFO
function pageAturan(v) { aturan.render(v, { parts: [], query: {} }, { publik: true }); }

function pageInfo(v) {
  const s = S.settings;
  const wa = waNumber(s.waSekolah);
  v.append(head('ℹ️ Informasi Sekolah', s.namaSekolah));
  if (s.infoSiswa) v.append(h('section', { class: 'card notice-card' }, h('div', { class: 'row gap-sm' }, icon('bell'), h('h3', { text: 'Pengumuman' })), h('p', { class: 'pre', text: s.infoSiswa })));
  v.append(h('section', { class: 'card stack-sm' }, h('h3', { text: '📞 Kontak Sekolah' }),
    s.alamat ? h('p', null, icon('pin'), ' ', s.alamat) : null,
    s.telepon ? h('p', null, icon('phone'), ' ', h('a', { href: `tel:${s.telepon.replace(/[^\d+]/g, '')}`, text: s.telepon })) : null,
    s.email ? h('p', null, icon('info'), ' ', h('a', { href: `mailto:${s.email}`, text: s.email })) : null,
    wa ? h('a', { class: 'btn wa', href: `https://wa.me/${wa}`, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'WhatsApp Sekolah' })) : null,
    !s.alamat && !s.telepon && !s.email && !wa ? h('p', { class: 'muted', text: 'Kontak belum diisi oleh sekolah.' }) : null));
  v.append(h('section', { class: 'card' }, h('h3', { text: '📖 Cara Membaca Poin' }),
    h('ul', { class: 'rules-list' },
      h('li', { text: 'Setiap pelanggaran diberi poin sesuai tata tertib (guru dapat menyesuaikan sesuai kejadian).' }),
      h('li', { text: 'Poin dijumlahkan selama siswa bersekolah dan tidak dapat dikurangi.' }),
      h('li', null, 'Tahap pembinaan: ', ...data().levels.map((l, i) => h('span', null, i ? ', ' : '', h('strong', { text: `${l.min}+` }), ` ${l.label}`)), '.'),
      h('li', { text: `Akumulasi di atas ${s.batasSidang} poin diputuskan melalui Sidang Dewan Guru.` }),
      h('li', { text: 'Setiap pelanggaran didokumentasikan dalam Berita Acara Pemeriksaan (BAP).' }))));
  const installBtn = PWA.installEvt ? btn('Pasang di HP', () => install(), { kind: 'primary', ic: 'install' })
    : isIOS() && !PWA.installed ? btn('Cara pasang di iPhone', () => dialog('Pasang di iPhone/iPad', 'Buka halaman ini di Safari → ketuk tombol Bagikan → "Tambah ke Layar Utama".'), { ic: 'install' }) : null;
  v.append(h('section', { class: 'card stack-sm' }, h('h3', { text: '📱 Aplikasi' }),
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
  ensureShowNames();
  buildShell();
  route();
  document.getElementById('splash')?.remove();
  window.addEventListener('hashchange', () => route());
  let pending = false;
  const live = debounce(() => {
    ensureShowNames();
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
