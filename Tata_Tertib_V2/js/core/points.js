// Akumulasi poin & tahap sanksi. Poin dijumlahkan selama siswa bersekolah dan TIDAK PERNAH berkurang
// (sesuai Catatan Penting no. 1). Catatan yang dibatalkan (koreksi salah input) tidak dihitung.

export function sortLevels(sanksi) {
  return [...(sanksi || [])]
    .map((l) => ({ ...l, min: Number(l.min) || 0 }))
    .sort((a, b) => a.min - b.min);
}

/** Tahap tertinggi yang batas bawahnya ≤ total, atau null (belum ada tindakan). */
export function levelFor(total, levels) {
  let cur = null;
  for (const l of levels) if (total >= l.min) cur = l;
  return cur;
}
export const nextLevel = (total, levels) => levels.find((l) => l.min > total) || null;

export const recKey = (r) => `${r.tanggal || ''} ${r.jam || '99:99'} ${r.createdAt || ''} ${r.id || ''}`;
export const byTime = (a, b) => (recKey(a) < recKey(b) ? -1 : recKey(a) > recKey(b) ? 1 : 0);

/** Ringkasan satu siswa dari daftar catatannya (boleh berisi yang dibatalkan). */
export function summarize(list, levels) {
  const recs = list.filter((r) => !r.batal).sort(byTime);
  let cum = 0;
  const timeline = [];
  const crossings = [];
  let berat = 0;
  for (const r of recs) {
    const before = cum;
    cum += Number(r.poin) || 0;
    if (r.tingkat === 'Berat') berat++;
    timeline.push({ rec: r, before, after: cum });
    for (const l of levels) if (before < l.min && cum >= l.min) crossings.push({ level: l, tanggal: r.tanggal, rec: r, poin: cum });
  }
  const level = levelFor(cum, levels);
  const next = nextLevel(cum, levels);
  return {
    total: cum, count: recs.length, recs, timeline, crossings, level, next,
    toNext: next ? next.min - cum : 0, last: recs.length ? recs[recs.length - 1].tanggal : '', berat,
  };
}

const EMPTY = Object.freeze({ total: 0, count: 0, recs: [], timeline: [], crossings: [], level: null, next: null, toNext: 0, last: '', berat: 0 });

/** Map siswaId → ringkasan, untuk semua siswa (siswa tanpa catatan = total 0). */
export function buildSummaries(siswa, records, levels) {
  const by = new Map();
  for (const r of records) {
    if (!by.has(r.siswaId)) by.set(r.siswaId, []);
    by.get(r.siswaId).push(r);
  }
  const out = new Map();
  for (const s of siswa) {
    const l = by.get(s.id);
    out.set(s.id, l ? summarize(l, levels) : { ...EMPTY, next: levels[0] || null, toNext: levels[0] ? levels[0].min : 0 });
  }
  for (const [id, l] of by) if (!out.has(id)) out.set(id, summarize(l, levels));
  return out;
}

/** Pratinjau dampak catatan baru: total & tahap sebelum → sesudah. */
export function previewImpact(summary, addPoin, levels) {
  const before = summary?.total || 0;
  const after = before + addPoin;
  const lvBefore = levelFor(before, levels);
  const lvAfter = levelFor(after, levels);
  const crossed = levels.filter((l) => before < l.min && after >= l.min);
  return { before, after, lvBefore, lvAfter, crossed };
}

/**
 * Daftar tindak lanjut: satu item per (siswa, tahap yang sudah tercapai). Status diambil dari sheet
 * "Tindak Lanjut" bila sudah pernah diproses; selain itu "Belum". ID deterministik → aman di banyak HP.
 */
export const tindakId = (siswaId, kode) => `${siswaId}__${kode}`;
export function buildTindak(siswaList, summaries, stored) {
  const storedMap = new Map(stored.map((t) => [t.id, t]));
  const items = [];
  const seen = new Set();
  for (const s of siswaList) {
    const sum = summaries.get(s.id);
    if (!sum) continue;
    for (const c of sum.crossings) {
      const id = tindakId(s.id, c.level.kode);
      seen.add(id);
      const st = storedMap.get(id);
      items.push({
        id, siswaId: s.id, nama: s.nama, kelas: s.kelas, tahap: c.level.kode, level: c.level,
        tanggalCapai: c.tanggal, poinSaat: c.poin, status: st?.status || 'Belum',
        tanggalPelaksanaan: st?.tanggalPelaksanaan || '', nomorSurat: st?.nomorSurat || '', catatan: st?.catatan || '',
        petugas: st?.petugas || '', stored: st || null, berlaku: true,
      });
    }
  }
  // Tindak lanjut tersimpan yang tahapnya tidak lagi tercapai (mis. catatan dibatalkan) tetap ditampilkan.
  for (const st of stored) {
    if (seen.has(st.id)) continue;
    const s = siswaList.find((x) => x.id === st.siswaId);
    items.push({ ...st, nama: s?.nama || st.nama, kelas: s?.kelas || st.kelas, level: null, stored: st, berlaku: false });
  }
  return items;
}
