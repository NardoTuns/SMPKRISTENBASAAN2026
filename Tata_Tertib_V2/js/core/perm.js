// Hak akses per peran. Aturan yang sama ditegakkan ulang di server (Code.gs) — klien hanya menyembunyikan tombol.
import { parseStamp } from './util.js';

const MGR = ['Admin', 'Kepala Sekolah', 'Guru BK'];

export const isMgr = (u) => !!u && MGR.includes(u.peran);
export const canRecord = (u) => !!u;
export const canSiswa = (u) => !!u && ['Admin', 'Guru BK'].includes(u.peran);
export const canRules = (u) => !!u && ['Admin', 'Kepala Sekolah'].includes(u.peran);
export const canAdmin = (u) => !!u && u.peran === 'Admin';

export const kelasWali = (u) => String(u?.kelasWali || '').split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Tindak lanjut: Admin/Kepsek/BK untuk semua kelas, Wali Kelas untuk kelasnya. */
export const canTindak = (u, kelas) => isMgr(u) || (!!u && u.peran === 'Wali Kelas' && kelasWali(u).includes(String(kelas || '').trim().toLowerCase()));
export const canTindakAny = (u) => isMgr(u) || (!!u && u.peran === 'Wali Kelas');

/** Ubah/batalkan catatan: Admin/Kepsek/BK kapan saja; guru pencatat dalam batas jam koreksi. */
export function canEditRecord(u, rec, settings, now = Date.now()) {
  if (!u || !rec) return false;
  if (isMgr(u)) return true;
  if (rec.batal) return false;
  if (String(rec.guru || '').toLowerCase() !== String(u.username || '').toLowerCase()) return false;
  const jam = Number(settings?.batasKoreksiJam ?? 24);
  const t = parseStamp(rec.createdAt);
  return !t || now - t.getTime() <= jam * 3600000;
}

export function editDeadline(rec, settings) {
  const t = parseStamp(rec.createdAt);
  if (!t) return null;
  return new Date(t.getTime() + Number(settings?.batasKoreksiJam ?? 24) * 3600000);
}
