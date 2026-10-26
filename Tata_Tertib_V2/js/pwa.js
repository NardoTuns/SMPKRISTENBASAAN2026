// Service worker (offline), tombol Update, dan pemasangan aplikasi (Add to Home Screen).
import { APP_VERSION } from './config.js';
import { emit } from './store.js';

export const PWA = { reg: null, waiting: null, remoteVersion: '', installEvt: null, installed: false, checking: false };

export async function registerSW() {
  PWA.installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); PWA.installEvt = e; emit('pwa'); });
  window.addEventListener('appinstalled', () => { PWA.installEvt = null; PWA.installed = true; emit('pwa'); });
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    PWA.reg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w); });
    });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
    setTimeout(() => checkUpdate(false), 4000);
  } catch (e) { console.warn('Service worker gagal:', e); }
}

function setWaiting(w) { PWA.waiting = w; emit('pwa'); }

/** Periksa versi baru. manual = true → kembalikan pesan untuk ditampilkan. */
export async function checkUpdate(manual = true) {
  if (!navigator.onLine) return 'Tidak ada internet. Pembaruan diperiksa saat online.';
  PWA.checking = true; emit('pwa');
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const v = await r.json();
    PWA.remoteVersion = v.version;
    PWA.remoteNotes = v.notes || [];
    if (PWA.reg) await PWA.reg.update();
    if (PWA.waiting) return `Versi ${v.version} siap dipasang.`;
    if (v.version !== APP_VERSION) return `Versi ${v.version} sedang diunduh… tombol "Perbarui" akan muncul sebentar lagi.`;
    return manual ? `Aplikasi sudah versi terbaru (${APP_VERSION}).` : '';
  } catch {
    return 'Gagal memeriksa pembaruan.';
  } finally {
    PWA.checking = false; emit('pwa');
  }
}

export function applyUpdate() {
  if (PWA.waiting) PWA.waiting.postMessage({ type: 'SKIP_WAITING' });
  else location.reload();
}

export async function install() {
  if (!PWA.installEvt) return false;
  PWA.installEvt.prompt();
  const { outcome } = await PWA.installEvt.userChoice;
  PWA.installEvt = null;
  emit('pwa');
  return outcome === 'accepted';
}

export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream;

// ------------------------------------------------------------------ tema
export function getTheme() { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } }
export function applyTheme(t = getTheme()) {
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#070f1e' : '#0B1B33');
}
export function setTheme(t) { try { localStorage.setItem('theme', t); } catch { /* mode privat */ } applyTheme(t); }
