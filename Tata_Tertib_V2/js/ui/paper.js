// Ukuran kertas dokumen (pratinjau, PDF, PNG, cetak). Bawaan sekolah diatur di Kelola → Pengaturan (ukuranKertas).
import { S } from '../store.js';

export const PAPERS = {
  A4: { label: 'A4 (210 × 297 mm)', mm: [210, 297] },
  F4: { label: 'F4 / Folio (215 × 330 mm)', mm: [215, 330] },
  Letter: { label: 'Letter (216 × 279 mm)', mm: [215.9, 279.4] },
  Legal: { label: 'Legal (216 × 356 mm)', mm: [215.9, 355.6] },
};
export const PAPER_OPTIONS = Object.entries(PAPERS).map(([value, p]) => ({ value, label: p.label }));

/** Kode kertas yang sah: pilihan dokumen → pengaturan sekolah → A4. */
export const paperCode = (code) => (PAPERS[code] ? code : PAPERS[S.settings?.ukuranKertas] ? S.settings.ukuranKertas : 'A4');

/** {code, mm:[w,h], px:[w,h]} sesuai orientasi; px pada 96 dpi (A4 tegak = 794 × 1123). */
export function paperSize(code, landscape = false) {
  const c = paperCode(code);
  const [a, b] = PAPERS[c].mm;
  const mm = landscape ? [b, a] : [a, b];
  return { code: c, mm, px: mm.map((v) => Math.round((v * 96) / 25.4)) };
}
