// Navigasi berbasis hash (#/halaman/param?kunci=nilai) — aman untuk GitHub Pages & mode offline.
import { afterBack, closeAllOverlays } from './dom.js';

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { page: parts[0] || '', parts, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function link(page, ...rest) {
  let q = '';
  if (rest.length && typeof rest[rest.length - 1] === 'object') {
    const obj = Object.fromEntries(Object.entries(rest.pop()).filter(([, v]) => v !== '' && v != null));
    const sp = new URLSearchParams(obj).toString();
    if (sp) q = '?' + sp;
  }
  return '#/' + [page, ...rest].filter((x) => x !== '' && x != null).map((x) => encodeURIComponent(x)).join('/') + q;
}

export async function go(page, ...rest) {
  closeAllOverlays();
  await afterBack();
  const target = page.startsWith('#') ? page : link(page, ...rest);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

/** Ganti query tanpa menambah riwayat (dipakai filter agar Kembali tidak melewati setiap klik filter). */
export function replaceQuery(query) {
  const { parts } = parseHash();
  const url = link(...(parts.length ? parts : ['beranda']), query);
  history.replaceState(history.state, '', url);
}
