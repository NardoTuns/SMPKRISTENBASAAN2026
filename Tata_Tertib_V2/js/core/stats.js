// Penyaring & agregasi untuk dasbor, halaman kelas, riwayat, dan laporan (murni, bisa diuji).
import { addDays, daysBetween, fmtBulan, fmtTgl, matches, parseYmd, weekStart, ymd, BULAN3 } from './util.js';

export const PERIODS = [
  { kode: 'hari', label: 'Hari ini' },
  { kode: '7h', label: '7 hari terakhir' },
  { kode: '30h', label: '30 hari terakhir' },
  { kode: 'bulan', label: 'Bulan ini' },
  { kode: 'semester', label: 'Semester ini' },
  { kode: 'ta', label: 'Tahun ajaran ini' },
  { kode: 'semua', label: 'Semua waktu' },
  { kode: 'kustom', label: 'Pilih tanggal…' },
];

/** Rentang periode → {from, to, label, prev:{from,to}|null}. Tahun ajaran mulai 1 Juli. */
export function periodRange(kode, today = ymd(), custom = {}) {
  const d = parseYmd(today);
  const y = d.getFullYear(), m = d.getMonth();
  const mk = (from, to, label, prev) => ({ from, to, label, prev });
  const back = (from, to) => { const n = daysBetween(from, to) + 1; return { from: addDays(from, -n), to: addDays(from, -1) }; };
  switch (kode) {
    case 'hari': return mk(today, today, 'Hari ini', back(today, today));
    case '7h': { const f = addDays(today, -6); return mk(f, today, '7 hari terakhir', back(f, today)); }
    case '30h': { const f = addDays(today, -29); return mk(f, today, '30 hari terakhir', back(f, today)); }
    case 'bulan': {
      const f = ymd(new Date(y, m, 1));
      return mk(f, today, `${BULAN3[m]} ${y}`, { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) });
    }
    case 'semester': {
      const ganjil = m >= 6;
      const f = ganjil ? `${y}-07-01` : `${y}-01-01`;
      const t = ganjil ? `${y}-12-31` : `${y}-06-30`;
      const prev = ganjil ? { from: `${y}-01-01`, to: `${y}-06-30` } : { from: `${y - 1}-07-01`, to: `${y - 1}-12-31` };
      return mk(f, t, `Semester ${ganjil ? 'Ganjil' : 'Genap'}`, prev);
    }
    case 'ta': {
      const y0 = m >= 6 ? y : y - 1;
      return mk(`${y0}-07-01`, `${y0 + 1}-06-30`, `TA ${y0}/${y0 + 1}`, { from: `${y0 - 1}-07-01`, to: `${y0}-06-30` });
    }
    case 'kustom': {
      const f = custom.from || today, t = custom.to || today;
      const [a, b] = f <= t ? [f, t] : [t, f];
      return mk(a, b, a === b ? fmtTgl(a, { short: true }) : `${fmtTgl(a, { short: true })} – ${fmtTgl(b, { short: true })}`, back(a, b));
    }
    default: return mk('', '', 'Semua waktu', null);
  }
}

export const inRange = (s, from, to) => (!from || s >= from) && (!to || s <= to);

/**
 * f: {from,to,kelas,kategori,tingkat,guru,jenis,siswaId,q,batal:'aktif'|'batal'|'semua'}.
 * Kelas = kelas siswa saat pelanggaran dicatat (tersimpan di catatan).
 */
export function filterRecords(records, f = {}) {
  const st = f.batal || 'aktif';
  return records.filter((r) => {
    if (st === 'aktif' && r.batal) return false;
    if (st === 'batal' && !r.batal) return false;
    if (!inRange(r.tanggal, f.from, f.to)) return false;
    if (f.kelas && r.kelas !== f.kelas) return false;
    if (f.kategori && r.kategori !== f.kategori) return false;
    if (f.tingkat && r.tingkat !== f.tingkat) return false;
    if (f.guru && String(r.guru).toLowerCase() !== String(f.guru).toLowerCase()) return false;
    if (f.jenis && String(r.jenisKode) !== String(f.jenis)) return false;
    if (f.siswaId && r.siswaId !== f.siswaId) return false;
    if (f.q && !matches(f.q, r.nama, r.kelas, r.uraian, r.nis, r.lokasi, r.guruNama, r.kronologi)) return false;
    return true;
  });
}

/** Kelompokkan → [{key, n, poin, siswa:Set size}] diurutkan n turun. */
export function countBy(records, keyFn) {
  const m = new Map();
  for (const r of records) {
    const k = keyFn(r);
    if (k == null || k === '') continue;
    let g = m.get(k);
    if (!g) { g = { key: k, n: 0, poin: 0, siswa: new Set(), ringan: 0, sedang: 0, berat: 0 }; m.set(k, g); }
    g.n++;
    g.poin += Number(r.poin) || 0;
    g.siswa.add(r.siswaId);
    if (r.tingkat === 'Ringan') g.ringan++; else if (r.tingkat === 'Sedang') g.sedang++; else if (r.tingkat === 'Berat') g.berat++;
  }
  return [...m.values()].map((g) => ({ ...g, nSiswa: g.siswa.size })).sort((a, b) => b.n - a.n || b.poin - a.poin);
}

export function totals(records) {
  const siswa = new Set();
  let poin = 0, ringan = 0, sedang = 0, berat = 0;
  for (const r of records) {
    siswa.add(r.siswaId);
    poin += Number(r.poin) || 0;
    if (r.tingkat === 'Ringan') ringan++; else if (r.tingkat === 'Sedang') sedang++; else if (r.tingkat === 'Berat') berat++;
  }
  return { n: records.length, poin, siswa: siswa.size, ringan, sedang, berat, rata: siswa.size ? poin / siswa.size : 0 };
}

/**
 * Deret waktu untuk grafik tren. Granularitas otomatis: harian (≤ 45 hari), mingguan (≤ 26 minggu), bulanan.
 * Rentang kosong (semua waktu) memakai tanggal catatan pertama s/d hari ini.
 */
export function trend(records, from, to, today = ymd()) {
  let a = from, b = to || today;
  if (!a) a = records.reduce((min, r) => (r.tanggal && (!min || r.tanggal < min) ? r.tanggal : min), '') || addDays(b, -29);
  if (b > today && a <= today) b = today;
  const span = daysBetween(a, b) + 1;
  const gran = span <= 45 ? 'hari' : span <= 26 * 7 ? 'minggu' : 'bulan';
  const keyOf = (s) => (gran === 'hari' ? s : gran === 'minggu' ? weekStart(s) : s.slice(0, 7));
  const buckets = new Map();
  if (gran === 'hari') for (let s = a; s <= b; s = addDays(s, 1)) buckets.set(s, 0);
  else if (gran === 'minggu') for (let s = weekStart(a); s <= b; s = addDays(s, 7)) buckets.set(s, 0);
  else {
    let [yy, mm] = a.split('-').map(Number);
    const end = b.slice(0, 7);
    for (;;) { const k = `${yy}-${String(mm).padStart(2, '0')}`; buckets.set(k, 0); if (k >= end) break; mm++; if (mm > 12) { mm = 1; yy++; } }
  }
  for (const r of records) { const k = keyOf(r.tanggal); if (buckets.has(k)) buckets.set(k, buckets.get(k) + 1); }
  const label = (k) => {
    if (gran === 'bulan') { const [yy, mm] = k.split('-'); return `${BULAN3[+mm - 1]} ${yy.slice(2)}`; }
    const d = parseYmd(k); return `${d.getDate()} ${BULAN3[d.getMonth()]}`;
  };
  const full = (k) => (gran === 'hari' ? fmtTgl(k, { hari: true }) : gran === 'minggu' ? `Minggu mulai ${fmtTgl(k)}` : fmtBulan(k));
  return { gran, buckets: [...buckets].map(([key, value]) => ({ key, value, label: label(key), full: full(key) })) };
}

/** Matriks hari (Senin–Sabtu, + Minggu bila ada) × jam (06–17). */
export function heat(records) {
  const days = [1, 2, 3, 4, 5, 6, 0];
  const hours = [];
  for (let h = 6; h <= 17; h++) hours.push(h);
  const grid = days.map(() => hours.map(() => 0));
  let tanpaJam = 0;
  for (const r of records) {
    const d = parseYmd(r.tanggal);
    const hh = /^(\d{1,2}):/.exec(r.jam || '');
    if (!d || !hh) { tanpaJam++; continue; }
    const hi = hours.indexOf(Math.min(17, Math.max(6, Number(hh[1]))));
    grid[days.indexOf(d.getDay())][hi]++;
  }
  const hasSunday = grid[6].some((x) => x > 0);
  return { days: hasSunday ? days : days.slice(0, 6), hours, grid: hasSunday ? grid : grid.slice(0, 6), tanpaJam };
}

/** Kelompok per tanggal (terbaru dulu) untuk tampilan riwayat. */
export function byDate(records) {
  const m = new Map();
  for (const r of records) {
    if (!m.has(r.tanggal)) m.set(r.tanggal, []);
    m.get(r.tanggal).push(r);
  }
  return [...m].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([tanggal, list]) => ({
    tanggal, list: list.sort((x, y) => String(y.jam || '').localeCompare(String(x.jam || ''))),
    poin: list.reduce((t, r) => t + (r.batal ? 0 : Number(r.poin) || 0), 0),
  }));
}

export function pctChange(cur, prev) {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / prev) * 100;
}
