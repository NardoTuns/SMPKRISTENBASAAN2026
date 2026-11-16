// Blok tanda tangan dokumen resmi.
// Setiap blok menyimpan daftar penanda tangannya (data-sign) sehingga lembar pratinjau dapat
// mengaktifkan/menonaktifkan dan mengedit nama, jabatan, serta NIP sebelum dokumen dicetak/diunduh.
import { esc } from '../core/util.js';

const BLANK = '(..............................................)';

/** Kunci stabil penanda tangan (dipakai untuk mengingat pilihan aktif/nonaktif). */
export const signKey = (c) => c.key || String(c.role || 'ttd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Normalisasi kolom: {key, top, role, name, nip, nipLabel, materai, on}
 * on:false → tidak dicetak secara bawaan (bisa diaktifkan di pratinjau).
 */
export function normCols(cols) {
  return cols.filter(Boolean).map((c) => ({
    key: signKey(c), top: c.top || '', role: c.role || '', name: c.name || '', nip: c.nip || '',
    nipLabel: c.nipLabel || 'NIP.', materai: !!c.materai, on: c.on !== false, custom: !!c.custom,
  }));
}

/** Pembagian baris: 1–3 sebaris; 4 → 2+2; 5 → 3+2; 6 → 3+3; seterusnya per 3. */
function rowsOf(list) {
  const n = list.length;
  const sizes = n <= 3 ? [n] : n === 4 ? [2, 2] : n === 5 ? [3, 2] : Array.from({ length: Math.ceil(n / 3) }, (_, i) => Math.min(3, n - i * 3));
  let i = 0;
  return sizes.map((k) => list.slice(i, (i += k)));
}

const colHtml = (c) => `<div class="sign-col">
  <div class="sign-top">${c.top ? esc(c.top) : '&nbsp;'}</div>
  <div class="sign-role">${c.role ? esc(c.role) : '&nbsp;'}</div>
  ${c.materai ? '<div class="materai">Meterai<br>10.000</div>' : '<div class="sign-space"></div>'}
  <div class="sign-name">${c.name ? esc(c.name) : BLANK}</div>
  <div class="sign-nip">${c.nip ? `${esc(c.nipLabel || 'NIP.')} ${esc(c.nip)}` : '&nbsp;'}</div></div>`;

/** HTML blok tanda tangan; hanya penanda tangan aktif yang dicetak. */
export function signHtml(cols) {
  const all = normCols(cols);
  const on = all.filter((c) => c.on);
  const data = encodeURIComponent(JSON.stringify(all));
  if (!on.length) return `<div class="sign-block empty" data-sign="${data}"></div>`;
  return `<div class="sign-block" data-sign="${data}">${rowsOf(on).map((row) =>
    `<div class="sign-row n${row.length}${on.length === 1 ? ' solo' : ''}">${row.map(colHtml).join('')}</div>`).join('')}</div>`;
}

export const readSign = (el) => { try { return normCols(JSON.parse(decodeURIComponent(el.dataset.sign || '%5B%5D'))); } catch { return []; } };
