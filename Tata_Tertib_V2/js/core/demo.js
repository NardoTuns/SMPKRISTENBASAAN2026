// Data contoh untuk "Mode Demo" (mencoba aplikasi sebelum server Google Sheets disiapkan).
// Semua nama adalah rekaan acak. Data demo tidak pernah dikirim ke server.
import { deriveKey } from './sha256.js';
import { DEFAULT_JENIS, DEFAULT_KATEGORI, DEFAULT_SANKSI, DEFAULT_SETTINGS } from './rules.js';
import { addDays, parseYmd, pad2 } from './util.js';
import { HASH_ITER } from '../config.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COWOK = ['Andre', 'Brian', 'Christian', 'Daniel', 'Elia', 'Feri', 'Gilbert', 'Hizkia', 'Ivan', 'Jonathan', 'Kevin', 'Lukas', 'Marcel', 'Natanael', 'Owen', 'Petrus', 'Rafael', 'Samuel', 'Timotius', 'Yosua', 'Rio', 'Yohanes', 'Steven', 'Valentino'];
const CEWEK = ['Angel', 'Brenda', 'Clara', 'Debora', 'Elisabet', 'Febi', 'Gracia', 'Hana', 'Injilia', 'Jessica', 'Kezia', 'Lidia', 'Maria', 'Natalia', 'Olivia', 'Priskila', 'Rut', 'Sarah', 'Tesalonika', 'Veronika', 'Yuliana', 'Mega', 'Christy', 'Wulan'];
const MARGA = ['Mandagi', 'Lumowa', 'Sondakh', 'Wenas', 'Rumengan', 'Pangemanan', 'Tumbelaka', 'Kalangi', 'Rondonuwu', 'Supit', 'Walangitan', 'Lontoh', 'Tambuwun', 'Karundeng', 'Mamahit', 'Pontoh', 'Rumondor', 'Sumampouw', 'Tangkere', 'Wowor', 'Kaunang', 'Lengkong', 'Rawung', 'Lumingkewas'];
const KELAS = ['7A', '7B', '8A', '8B', '9A', '9B'];
const LOKASI = { A: ['Gerbang sekolah', 'Halaman sekolah', 'Kantin'], B: ['Gerbang sekolah', 'Ruang kelas'], C: ['Ruang kelas', 'Halaman sekolah', 'Laboratorium'], D: ['Ruang kelas', 'Laboratorium', 'Perpustakaan'], E: ['Ruang kelas', 'Halaman sekolah', 'Media sosial'], F: ['Toilet', 'Lapangan', 'Luar sekolah'] };

export const DEMO_PASSWORD = 'demo123';
export const DEMO_USERS = [
  { username: 'admin', nama: 'Admin Demo', peran: 'Admin', kelasWali: '' },
  { username: 'kepsek', nama: 'Kepala Sekolah Demo', peran: 'Kepala Sekolah', kelasWali: '' },
  { username: 'bk', nama: 'Guru BK Demo', peran: 'Guru BK', kelasWali: '' },
  { username: 'wali7a', nama: 'Wali Kelas 7A Demo', peran: 'Wali Kelas', kelasWali: '7A' },
  { username: 'guru', nama: 'Guru Mapel Demo', peran: 'Guru', kelasWali: '' },
];

export function makeDemo(today) {
  const r = rng(20261026);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const salt = 'demo-salt';
  const users = DEMO_USERS.map((u) => ({ ...u, nip: '', aktif: true, v: deriveKey('v', salt, u.username, DEMO_PASSWORD, HASH_ITER) }));

  const siswa = [];
  let no = 1;
  for (const kelas of KELAS) {
    const angkatan = 2026 - (Number(kelas[0]) - 7);
    for (let i = 0; i < 22; i++) {
      const jk = r() < 0.5 ? 'L' : 'P';
      const nama = `${pick(jk === 'L' ? COWOK : CEWEK)} ${pick(MARGA)}`;
      siswa.push({
        id: `demo-s${no}`, nis: `${angkatan}${String(no).padStart(3, '0')}`, nisn: '', nama, kelas, jk, angkatan: String(angkatan),
        ortu: `${pick(COWOK)} ${nama.split(' ')[1]}`, hpOrtu: `08123${String(400000 + no * 37).padStart(6, '0')}`, alamat: 'Basaan', status: 'Aktif', catatan: '',
      });
      no++;
    }
  }

  // Hari sekolah (Senin–Sabtu) 110 hari terakhir.
  const days = [];
  for (let i = 110; i >= 0; i--) { const d = addDays(today, -i); if (parseYmd(d).getDay() !== 0) days.push(d); }
  const jenis = DEFAULT_JENIS;
  const weight = (j) => (j.tingkat === 'Ringan' ? 12 / Math.sqrt(j.poin) : j.tingkat === 'Sedang' ? 0.35 : 0.06);
  const wsum = jenis.reduce((t, j) => t + weight(j), 0);
  const pickJenis = () => { let x = r() * wsum; for (const j of jenis) { x -= weight(j); if (x <= 0) return j; } return jenis[0]; };
  const guru = users.filter((u) => u.peran !== 'Admin');
  const pelanggaran = [];
  let pid = 1;
  const add = (s, j, tanggal, extra = {}) => {
    const kat = j.kategori;
    const jam = kat === 'A' && Number(j.kode) <= 3 ? `07:${pad2(5 + Math.floor(r() * 40))}` : `${pad2(7 + Math.floor(r() * 7))}:${pad2(Math.floor(r() * 60))}`;
    const g = s.kelas === '7A' && r() < 0.4 ? users[3] : pick(guru);
    const poin = j.poin;
    pelanggaran.push({
      id: `demo-p${pid++}`, tanggal, jam, siswaId: s.id, nis: s.nis, nama: s.nama, kelas: s.kelas, jenisKode: j.kode, uraian: j.uraian,
      kategori: kat, tingkat: j.tingkat, poin, lokasi: pick(LOKASI[kat]), kronologi: r() < 0.4 ? 'Siswa kedapatan saat pemeriksaan rutin oleh guru piket.' : '',
      saksi: r() < 0.3 ? 'Guru piket' : '', pelapor: '', tindakanLangsung: pick(['Teguran lisan', 'Membersihkan kelas/halaman', 'Dipanggil ke ruang BK', 'Teguran lisan']),
      guru: g.username, guruNama: g.nama, createdAt: `${tanggal} ${jam}:00`, batal: false, alasanBatal: '', device: 'demo', ...extra,
    });
  };
  for (const s of siswa) {
    const x = r();
    const n = x < 0.5 ? 0 : x < 0.75 ? 1 + Math.floor(r() * 2) : x < 0.9 ? 3 + Math.floor(r() * 3) : x < 0.98 ? 6 + Math.floor(r() * 4) : 10 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) add(s, pickJenis(), pick(days));
  }
  // Beberapa kasus khusus agar semua tahap terlihat.
  const byKode = (k) => jenis.find((j) => j.kode === k);
  add(siswa[5], byKode('38'), days[days.length - 12]);
  add(siswa[5], byKode('7'), days[days.length - 4]);
  add(siswa[40], byKode('36'), days[days.length - 20]);
  add(siswa[70], byKode('31'), days[days.length - 9]);
  add(siswa[100], byKode('25'), days[days.length - 2]);
  add(siswa[100], byKode('25'), days[days.length - 1], { batal: true, alasanBatal: 'Salah input: tercatat dua kali' });
  add(siswa[12], byKode('1'), today);
  add(siswa[30], byKode('10'), today);

  // Sebagian tindak lanjut sudah diproses.
  const tindak = [];
  const lv = DEFAULT_SANKSI;
  const tot = new Map();
  for (const p of [...pelanggaran].filter((p) => !p.batal).sort((a, b) => (a.tanggal + a.jam < b.tanggal + b.jam ? -1 : 1))) {
    const before = tot.get(p.siswaId) || 0;
    const after = before + p.poin;
    tot.set(p.siswaId, after);
    for (const l of lv) {
      if (before < l.min && after >= l.min && p.tanggal < addDays(today, -7) && r() < 0.7) {
        const s = siswa.find((x) => x.id === p.siswaId);
        const selesai = r() < 0.75;
        tindak.push({
          id: `${s.id}__${l.kode}`, siswaId: s.id, nama: s.nama, kelas: s.kelas, tahap: l.kode, tahapLabel: l.label, poinSaat: after, tanggalCapai: p.tanggal,
          status: selesai ? 'Selesai' : 'Dijadwalkan', tanggalPelaksanaan: addDays(p.tanggal, 2), nomorSurat: l.surat ? `${String(tindak.length + 1).padStart(3, '0')}/${l.surat}/SMPK-B/2026` : '',
          catatan: selesai ? 'Siswa dan orang tua hadir, bersedia memperbaiki diri.' : '', petugas: 'Guru BK Demo',
        });
      }
    }
  }

  const settings = { ...DEFAULT_SETTINGS, kepalaSekolah: 'Kepala Sekolah Demo', guruBK: 'Guru BK Demo', alamat: 'Desa Basaan (alamat contoh)' };
  return {
    salt, iter: HASH_ITER, users, siswa, pelanggaran, tindak, settings,
    kategori: DEFAULT_KATEGORI, jenis: DEFAULT_JENIS, sanksi: DEFAULT_SANKSI,
  };
}
