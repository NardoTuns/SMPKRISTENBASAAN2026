// Titik masuk aplikasi: kerangka tampilan, router hash, status sinkron, pembaruan, dan start-up.
import { h, icon, sheet, toast, overlayOpen } from './ui/dom.js';
import { avatar } from './ui/widgets.js';
import { go, parseHash } from './ui/nav.js';
import { hideTip } from './ui/charts.js';
import * as db from './db.js';
import { S, D, me, on, loadAll } from './store.js';
import { schedule, startAuto, syncNow } from './sync.js';
import { PWA, applyTheme, applyUpdate, install, registerSW } from './pwa.js';
import { canAdmin, canRules, canSiswa } from './core/perm.js';
import { APP_VERSION } from './config.js';
import { hm } from './core/util.js';
import * as dashboard from './pages/dashboard.js';
import * as siswa from './pages/siswa.js';
import * as kelas from './pages/kelas.js';
import * as riwayat from './pages/riwayat.js';
import * as laporan from './pages/laporan.js';
import * as aturan from './pages/aturan.js';
import * as catat from './pages/catat.js';
import * as tindak from './pages/tindak.js';
import * as kelola from './pages/kelola.js';
import * as akun from './pages/akun.js';
import * as login from './pages/login.js';

const ROUTES = { '': dashboard, beranda: dashboard, siswa, kelas, riwayat, laporan, aturan, catat, tindak, kelola, akun, login };

const NAV = [
  { page: '', label: 'Beranda', ic: 'home' },
  { page: 'siswa', label: 'Siswa', ic: 'users' },
  { page: 'kelas', label: 'Kelas', ic: 'school' },
  { page: 'riwayat', label: 'Riwayat', ic: 'calendar' },
  { page: 'laporan', label: 'Laporan', ic: 'report' },
  { page: 'aturan', label: 'Tata Tertib', ic: 'book' },
  { page: 'tindak', label: 'Tindak Lanjut', ic: 'checklist', show: (u) => !!u },
  { page: 'kelola', label: 'Kelola', ic: 'settings', show: (u) => canRules(u) || canSiswa(u) || canAdmin(u) },
  { page: 'akun', label: 'Akun & Aplikasi', ic: 'user' },
];

let view, sideNav, bottomNav, syncChip, userBtn, banners, brandSub;
let currentPage = null;

function buildShell() {
  const app = document.getElementById('app');
  app.replaceChildren();
  syncChip = h('button', { class: 'sync-chip', type: 'button', onclick: () => go('akun') });
  userBtn = h('button', { class: 'user-btn', type: 'button' });
  brandSub = h('span', { class: 'brand-sub' });
  const top = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/', 'aria-label': 'Beranda' },
      h('span', { class: 'brand-mark' }, h('img', { src: 'icons/favicon.svg', alt: '' })),
      h('span', { class: 'brand-text' }, h('span', { class: 'brand-title', text: 'Tata Tertib' }), brandSub)),
    h('span', { class: 'grow' }), syncChip, userBtn);
  sideNav = h('nav', { class: 'sidenav', 'aria-label': 'Menu utama' });
  bottomNav = h('nav', { class: 'bottomnav', 'aria-label': 'Menu bawah' });
  banners = h('div', { class: 'banners' });
  view = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  app.append(top, banners, h('div', { class: 'layout' }, sideNav, h('div', { class: 'main-col' }, view)), bottomNav);
  drawChrome();
}

function drawChrome() {
  const u = me();
  const page = parseHash().page;
  const active = (p) => (p === page || (p === '' && page === 'beranda') ? 'on' : '');
  brandSub.textContent = S.settings.namaSekolah || '';
  sideNav.replaceChildren(
    u ? h('a', { class: 'btn primary block side-cta', href: '#/catat' }, icon('plus'), h('span', { text: 'Catat Pelanggaran' })) : h('a', { class: 'btn tonal block side-cta', href: '#/login' }, icon('login'), h('span', { text: 'Masuk Guru' })),
    ...NAV.filter((n) => !n.show || n.show(u)).map((n) => h('a', { href: '#/' + n.page, class: 'side-link ' + active(n.page), 'aria-current': active(n.page) ? 'page' : null }, icon(n.ic), h('span', { text: n.label }),
      n.page === 'tindak' ? badgeCount(D().tindak.filter((t) => t.berlaku && t.status === 'Belum').length) : null)),
    h('div', { class: 'side-foot muted small', text: `Versi ${APP_VERSION}` }));
  const bn = (p, label, ic) => h('a', { href: '#/' + p, class: 'bn ' + active(p), 'aria-current': active(p) ? 'page' : null }, icon(ic), h('span', { text: label }));
  bottomNav.replaceChildren(
    bn('', 'Beranda', 'home'), bn('siswa', 'Siswa', 'users'),
    u ? h('a', { href: '#/catat', class: 'bn cta ' + active('catat'), 'aria-label': 'Catat pelanggaran' }, h('span', { class: 'cta-ring' }, icon('plus')), h('span', { text: 'Catat' })) : bn('kelas', 'Kelas', 'school'),
    bn('riwayat', 'Riwayat', 'calendar'),
    h('button', { class: 'bn ' + (['laporan', 'aturan', 'tindak', 'kelola', 'akun', 'kelas', 'login'].includes(page) && !(page === 'kelas' && !u) ? 'on' : ''), type: 'button', onclick: moreMenu }, icon('menu'), h('span', { text: 'Lainnya' })));
  userBtn.replaceChildren(...(u ? [avatar(u.nama, 'sm'), h('span', { class: 'user-name', text: u.nama.split(' ')[0] })] : [icon('login'), h('span', { class: 'user-name', text: 'Masuk' })]));
  userBtn.onclick = () => go(u ? 'akun' : 'login');
  userBtn.setAttribute('aria-label', u ? `Akun ${u.nama}` : 'Masuk');
  drawSync();
  drawBanners();
}

const badgeCount = (n) => (n ? h('span', { class: 'count', text: n > 99 ? '99+' : String(n) }) : null);

function moreMenu() {
  const u = me();
  sheet((b, close) => {
    const item = (p, label, ic, sub) => h('a', { class: 'menu-item', href: '#/' + p, onclick: () => close() }, icon(ic), h('span', { class: 'grow' }, h('span', { class: 'block', text: label }), sub ? h('span', { class: 'muted small', text: sub }) : null), icon('right'));
    b.append(h('div', { class: 'menu-list' },
      item('kelas', 'Kelas', 'school', 'Rekap per kelas'),
      item('laporan', 'Laporan', 'report', 'Rekap siap cetak & unduh'),
      item('aturan', 'Tata Tertib', 'book', 'Bentuk pelanggaran & poin'),
      u ? item('tindak', 'Tindak Lanjut', 'checklist', `${D().tindak.filter((t) => t.berlaku && t.status === 'Belum').length} belum dilaksanakan`) : null,
      canRules(u) || canSiswa(u) || canAdmin(u) ? item('kelola', 'Kelola Data', 'settings', 'Aturan, siswa, pengguna, pengaturan') : null,
      item('akun', 'Akun & Aplikasi', 'user', 'Sinkron, pembaruan, tema'),
      u ? null : item('login', 'Masuk Guru', 'login', 'Untuk mencatat pelanggaran')));
  }, { title: 'Menu' });
}

function drawSync() {
  if (!syncChip) return;
  const pend = S.outbox.filter((o) => !o.failed).length;
  const failed = S.outbox.filter((o) => o.failed).length;
  let ic = 'cloud', text = 'Tersinkron', cls = 'ok';
  if (S.demo) { ic = 'spark'; text = 'Demo'; cls = 'demo'; }
  else if (!S.serverUrl) { ic = 'cloudoff'; text = 'Belum terhubung'; cls = 'warn'; }
  else if (S.sync.running) { ic = 'sync'; text = 'Sinkron…'; cls = 'run'; }
  else if (!S.online) { ic = 'cloudoff'; text = pend ? `Offline · ${pend}` : 'Offline'; cls = 'off'; }
  else if (failed || S.sync.authError) { ic = 'alert'; text = 'Perlu dicek'; cls = 'err'; }
  else if (S.sync.error) { ic = 'alert'; text = 'Gagal sinkron'; cls = 'err'; }
  else if (pend) { ic = 'cloudup'; text = `${pend} tertunda`; cls = 'warn'; }
  else if (S.sync.lastOk) text = `Tersinkron ${hm(new Date(S.sync.lastOk))}`;
  syncChip.className = 'sync-chip ' + cls;
  syncChip.title = S.sync.error || S.sync.authError || S.sync.msg || text;
  syncChip.replaceChildren(icon(ic, cls === 'run' ? 'spin' : ''), h('span', { class: 'sync-text', text }));
}

function drawBanners() {
  if (!banners) return;
  const list = [];
  if (PWA.waiting) list.push(h('div', { class: 'banner info' }, icon('download'), h('span', { class: 'grow', text: `Versi baru${PWA.remoteVersion ? ' ' + PWA.remoteVersion : ''} tersedia.` }), h('button', { class: 'btn small primary', type: 'button', onclick: applyUpdate, text: 'Perbarui' })));
  let dismissed = false;
  try { dismissed = localStorage.getItem('installDismissed') === '1'; } catch { /* abaikan */ }
  if (PWA.installEvt && !dismissed) list.push(h('div', { class: 'banner' }, icon('install'), h('span', { class: 'grow', text: 'Pasang di HP agar bisa dibuka seperti aplikasi, juga tanpa internet.' }),
    h('button', { class: 'btn small primary', type: 'button', onclick: () => install(), text: 'Pasang' }),
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tutup', onclick: () => { try { localStorage.setItem('installDismissed', '1'); } catch { /* abaikan */ } drawBanners(); } }, icon('x'))));
  if (S.demo) list.push(h('div', { class: 'banner demo' }, icon('spark'), h('span', { class: 'grow', text: 'MODE DEMO · data contoh · password semua akun: demo123' }), h('a', { class: 'btn small text', href: '#/akun', text: 'Keluar' })));
  if (S.sync.authError && me()) list.push(h('div', { class: 'banner warn' }, icon('key'), h('span', { class: 'grow', text: S.sync.authError }), h('a', { class: 'btn small text', href: '#/login', text: 'Login ulang' })));
  banners.replaceChildren(...list);
}

// ------------------------------------------------------------------ router
function renderRoute({ keepScroll = false } = {}) {
  const route = parseHash();
  const page = ROUTES[route.page] || dashboard;
  const changed = page !== currentPage;
  currentPage = page;
  const y = window.scrollY;
  hideTip();
  view.replaceChildren();
  try {
    page.render(view, route);
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('div', { class: 'empty' }, h('div', { class: 'empty-ic' }, icon('alert')), h('h3', { text: 'Terjadi kesalahan' }), h('p', { class: 'muted', text: String(e.message || e) }),
      h('button', { class: 'btn tonal', type: 'button', onclick: () => location.reload(), text: 'Muat ulang' })));
  }
  document.title = `${page.meta.title} · Tata Tertib ${S.settings.namaSekolah}`;
  if (keepScroll) window.scrollTo(0, y);
  else { window.scrollTo(0, 0); if (changed) view.focus({ preventScroll: true }); }
  drawChrome();
}

const isLive = () => { const l = currentPage?.meta?.live; return typeof l === 'function' ? l() : !!l; };
let liveTimer, pendingLive = false;
function liveRefresh() {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => {
    drawChrome();
    if (!isLive()) return;
    const a = document.activeElement;
    // Jangan menggambar ulang saat pengguna sedang mengetik atau ada lembar/dialog terbuka.
    if ((a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || overlayOpen()) { pendingLive = true; return; }
    pendingLive = false;
    renderRoute({ keepScroll: true });
  }, 80);
}

// ------------------------------------------------------------------ start
async function boot() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme());
  try {
    await loadAll();
  } catch (e) {
    document.getElementById('app').replaceChildren(h('div', { class: 'empty' }, h('h3', { text: 'Penyimpanan HP tidak dapat dibuka' }), h('p', { class: 'muted', text: e.message }),
      h('p', { class: 'muted small', text: 'Pastikan tidak sedang memakai mode penyamaran/privat, lalu muat ulang.' })));
    return;
  }
  buildShell();
  window.addEventListener('hashchange', () => renderRoute());
  on('data', liveRefresh);
  on('session', () => renderRoute({ keepScroll: true }));
  on('sync', drawSync);
  on('pwa', drawBanners);
  on('write', () => schedule(1200));
  view.addEventListener('focusout', () => setTimeout(() => { if (pendingLive) liveRefresh(); }, 250));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && pendingLive) liveRefresh(); });
  renderRoute();
  document.getElementById('splash')?.remove();
  registerSW();
  db.requestPersist();
  startAuto();
  if (!S.demo && S.serverUrl) syncNow({ full: !S.meta.lastPull });
  window.__tatib = { S, D, syncNow, go };
}

window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); toast('Terjadi kesalahan: ' + (e.reason?.message || e.reason)); });
boot();
