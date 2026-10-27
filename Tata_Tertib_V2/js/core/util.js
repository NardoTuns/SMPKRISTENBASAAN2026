// Utilitas umum (murni, bisa diuji di Node). Tanggal disimpan sebagai teks "yyyy-MM-dd" (waktu lokal HP).

export const pad2 = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const hm = (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const stamp = (d = new Date()) => `${ymd(d)} ${hm(d)}:${pad2(d.getSeconds())}`;

export function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
export function parseStamp(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) : parseYmd(s);
}
export const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !!parseYmd(s);

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
/** Senin pada minggu tanggal s. */
export function weekStart(s) {
  const d = parseYmd(s);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return ymd(d);
}

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BULAN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function fmtTgl(s, { hari = false, short = false } = {}) {
  const d = parseYmd(s);
  if (!d) return s || '-';
  return `${hari ? HARI[d.getDay()] + ', ' : ''}${d.getDate()} ${(short ? BULAN3 : BULAN)[d.getMonth()]} ${d.getFullYear()}`;
}
export const fmtBulan = (key) => { const [y, m] = key.split('-'); return `${BULAN[+m - 1]} ${y}`; };
export const hariOf = (s) => HARI[parseYmd(s)?.getDay() ?? 0];

export function fmtNum(n, digits = 0) {
  const v = Number(n || 0);
  return v.toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
/** 1.284 / 12,9 rb / 4,2 jt */
export function compact(n) {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e6) return fmtNum(v / 1e6, 1) + ' jt';
  if (Math.abs(v) >= 1e4) return fmtNum(v / 1e3, 1) + ' rb';
  return fmtNum(v);
}

export function relTime(ms, now = Date.now()) {
  if (!ms) return 'belum pernah';
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}

export function uid(prefix = '') {
  const rnd = globalThis.crypto?.getRandomValues
    ? Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('')
    : Math.random().toString(36).slice(2, 14);
  return prefix + Date.now().toString(36) + rnd.slice(0, 8);
}

export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
/** Semua kata kunci q muncul di salah satu teks. */
export function matches(q, ...texts) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = norm(texts.join(' '));
  return words.every((w) => hay.includes(w));
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const cmpKelas = (a, b) => String(a || '').localeCompare(String(b || ''), 'id', { numeric: true, sensitivity: 'base' });
export const cmpNama = (a, b) => String(a || '').localeCompare(String(b || ''), 'id', { sensitivity: 'base' });

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function sum(list, fn = (x) => x) { let t = 0; for (const x of list) t += Number(fn(x)) || 0; return t; }
export function groupBy(list, fn) {
  const m = new Map();
  for (const x of list) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

// ------------------------------------------------------------------ CSV / tempel dari Excel
/** CSV ramah Excel Indonesia: pemisah titik koma + BOM UTF-8. */
export function toCSV(rows, sep = ';') {
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[";\n\r,\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n');
}

/** Baca teks tabel (tempel dari Excel/Sheets = tab, atau CSV ; / ,). → array baris. */
export function parseTable(text) {
  const src = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n').find((l) => l.trim()) || '';
  const sep = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"' && cur === '') q = true;
    else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ''));
}

/** Nomor HP Indonesia → format wa.me (62…). '' bila tidak valid. */
export function waNumber(hp) {
  let d = String(hp || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d.length >= 10 ? d : '';
}

export const bool = (v, def = false) => {
  if (v === true || v === false) return v;
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return def;
  return ['ya', 'y', 'true', '1', 'aktif', 'yes'].includes(s);
};
