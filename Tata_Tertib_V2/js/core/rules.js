// Aturan bawaan sesuai dokumen "TATA TERTIB SMP KRISTEN BASAAN 2026".
// Data ini hanya dipakai sebagai isi awal; aturan yang berlaku adalah yang ada di spreadsheet
// (bisa ditambah/diubah/dinonaktifkan Admin). Salinan yang sama ada di apps-script/Code.gs (diuji sama).

export const TINGKAT = ['Ringan', 'Sedang', 'Berat'];
export const ROLES = ['Admin', 'Kepala Sekolah', 'Guru BK', 'Wali Kelas', 'Guru'];
export const STATUS_SISWA = ['Aktif', 'Lulus', 'Pindah', 'Dikeluarkan', 'Nonaktif'];
export const STATUS_TINDAK = ['Belum', 'Dijadwalkan', 'Selesai'];
export const WARNA = [
  { kode: 'info', label: 'Biru (informasi)' },
  { kode: 'warn', label: 'Kuning (waspada)' },
  { kode: 'serious', label: 'Oranye (serius)' },
  { kode: 'critical', label: 'Merah (kritis)' },
  { kode: 'severe', label: 'Merah tua (peringatan terakhir)' },
  { kode: 'dark', label: 'Hitam (final)' },
];
export const SURAT = [
  { kode: '', label: 'Tanpa surat' },
  { kode: 'SP1', label: 'Surat Peringatan 1 + Surat Komitmen' },
  { kode: 'SP2', label: 'Surat Peringatan 2 + Panggilan Orang Tua' },
  { kode: 'SP3', label: 'Surat Peringatan 3 + Skorsing' },
  { kode: 'PK', label: 'Surat Perjanjian (Peringatan Keras Terakhir)' },
  { kode: 'KELUAR', label: 'Surat Pengembalian Siswa kepada Orang Tua' },
];

export const DEFAULT_KATEGORI = [
  ['A', 'Kehadiran & Kedisiplinan Waktu'],
  ['B', 'Kerapian, Penampilan & Seragam'],
  ['C', 'Kebersihan & Fasilitas Sekolah'],
  ['D', 'Ketertiban Kelas & Akademik'],
  ['E', 'Sikap, Etika & Sopan Santun'],
  ['F', 'Sosial, Keamanan & Hukum (Pelanggaran Berat)'],
].map(([kode, nama], i) => ({ kode, nama, urutan: i + 1, aktif: true }));

// [kode, kategori, uraian, poin, poinMaks ('' = tetap), tingkat]
const J = [
  [1, 'A', 'Datang terlambat ke sekolah (kurang dari 15 menit).', 2, '', 'Ringan'],
  [2, 'A', 'Datang terlambat lebih dari 15 menit tanpa alasan darurat.', 5, '', 'Ringan'],
  [3, 'A', 'Tidak mengikuti Upacara Bendera / apel pagi tanpa alasan sah.', 2, '', 'Ringan'],
  [4, 'A', 'Tidak mengikuti kegiatan ekstrakurikuler wajib / senam pagi.', 2, '', 'Ringan'],
  [5, 'A', 'Berada di kantin atau area lain saat jam pelajaran berlangsung.', 5, '', 'Ringan'],
  [6, 'A', 'Tidak masuk sekolah tanpa keterangan (Alpa) 2 hari berturut-turut.', 5, '', 'Ringan'],
  [7, 'A', 'Meninggalkan sekolah (bolos) sebelum jam pulang tanpa izin.', 20, '', 'Ringan'],
  [8, 'A', 'Memalsukan surat izin (tanda tangan orang tua/surat dokter).', 20, '', 'Ringan'],
  [9, 'A', 'Melompati pagar untuk masuk atau keluar dari lingkungan sekolah.', 10, '', 'Ringan'],
  [10, 'B', 'Atribut seragam tidak lengkap (tanpa dasi, topi, bet, sabuk standar).', 5, '', 'Ringan'],
  [11, 'B', 'Salah memakai seragam (tidak sesuai jadwal yang ditentukan).', 2, '', 'Ringan'],
  [12, 'B', 'Baju tidak dimasukkan, celana/rok diketatkan (pensil/span berlebihan).', 5, '', 'Ringan'],
  [13, 'B', 'Sepatu dan kaos kaki tidak sesuai ketentuan (misal: warna bukan hitam).', 2, '', 'Ringan'],
  [14, 'B', 'Rambut laki-laki gondrong, menyentuh kerah, telinga, atau alis.', 10, '', 'Ringan'],
  [15, 'B', 'Menggunakan cat kuku (kuteks), kuku panjang, atau riasan wajah (makeup) berlebih.', 5, '', 'Ringan'],
  [16, 'B', 'Mewarnai rambut selain warna hitam alami.', 10, '', 'Ringan'],
  [17, 'B', 'Memakai perhiasan berlebihan, bertato (termasuk temporer), atau bertindik (bagi laki-laki).', 10, '', 'Ringan'],
  [18, 'C', 'Membuang sampah tidak pada tempatnya / meninggalkan sampah di laci meja.', 5, '', 'Ringan'],
  [19, 'C', 'Makan atau minum di dalam kelas saat guru sedang mengajar.', 5, '', 'Ringan'],
  [20, 'C', 'Memarkir kendaraan sembarangan / tidak pada area parkir siswa.', 5, '', 'Ringan'],
  [21, 'C', 'Mencoret-coret meja, kursi, atau tembok sekolah (vandalisme ringan).', 15, '', 'Ringan'],
  [22, 'C', 'Merusak fasilitas sekolah, memecahkan kaca, atau merusak alat lab dengan sengaja.', 25, '', 'Sedang'],
  [23, 'D', 'Tidur di kelas atau sengaja membuat kegaduhan saat jam pelajaran.', 10, '', 'Ringan'],
  [24, 'D', 'Membawa barang non-edukasi (mainan, kartu remi, komik, dll).', 10, '', 'Ringan'],
  [25, 'D', 'Bermain smartphone/gadget saat jam pelajaran tanpa izin guru.', 20, '', 'Ringan'],
  [26, 'D', 'Mencontek saat ulangan harian atau tidak mengerjakan PR.', 10, '', 'Ringan'],
  [27, 'D', 'Mencontek terencana / membawa catatan saat Ujian Tengah/Akhir Semester.', 30, '', 'Sedang'],
  [28, 'D', 'Mengubah nilai raport atau memanipulasi dokumen akademik sekolah.', 40, '', 'Sedang'],
  [29, 'E', 'Berbicara kotor, kasar, mengumpat, atau memanggil teman dengan nama ejekan (nama orang tua).', 20, '', 'Ringan'],
  [30, 'E', 'Bermesraan atau berpacaran secara berlebihan di lingkungan sekolah.', 20, '', 'Ringan'],
  [31, 'E', 'Menentang, membantah dengan kasar, atau bersikap tidak sopan kepada Guru/Staf.', 50, '', 'Sedang'],
  [32, 'E', 'Menyebarkan rumor palsu, memfitnah, atau memprovokasi teman.', 30, '', 'Sedang'],
  [33, 'E', 'Menghina, mengancam, atau melecehkan Guru dan Staf Sekolah secara verbal/digital.', 90, 100, 'Berat'],
  [34, 'E', 'Mencemarkan nama baik sekolah di media sosial atau lingkungan publik.', 80, '', 'Berat'],
  [35, 'F', 'Melakukan perundungan (bullying) secara fisik, verbal, atau cyberbullying.', 80, '', 'Berat'],
  [36, 'F', 'Membawa rokok, merokok, atau menggunakan vape/pod di sekolah dan sekitarnya.', 80, '', 'Berat'],
  [37, 'F', 'Memalak / memeras / meminta uang secara paksa kepada siswa lain.', 70, '', 'Berat'],
  [38, 'F', 'Berkelahi sesama siswa (baku hantam) di dalam atau luar sekolah (berseragam).', 70, '', 'Berat'],
  [39, 'F', 'Mengambil barang milik orang lain atau fasilitas sekolah (mencuri).', 70, '', 'Berat'],
  [40, 'F', 'Melakukan aktivitas perjudian (dadu, kartu, judi online) di lingkungan sekolah.', 70, '', 'Berat'],
  [41, 'F', 'Membawa, menyimpan, atau mengakses materi pornografi (buku, video, foto).', 70, '', 'Berat'],
  [42, 'F', 'Membawa senjata tajam, senjata api, atau alat berbahaya lainnya.', 90, '', 'Berat'],
  [43, 'F', 'Terlibat tawuran antar sekolah atau bergabung dengan geng motor kriminal.', 70, '', 'Berat'],
  [44, 'F', 'Melakukan tindakan asusila / pelecehan seksual di dalam maupun luar sekolah.', 90, '', 'Berat'],
  [45, 'F', 'Membawa, menggunakan, atau mengedarkan Narkoba / Minuman Keras.', 90, 100, 'Berat'],
];
export const DEFAULT_JENIS = J.map(([no, kategori, uraian, poin, poinMaks, tingkat]) => ({
  kode: String(no), kategori, uraian, poin, poinMaks, tingkat, zt: false, aktif: true, urutan: no,
}));

// Batas bawah tiap tahap. Dokumen menulis rentang 10–20, 30–40, …; celah di antaranya (mis. 21–29)
// mengikuti tahap di bawahnya. Bisa diubah Admin di sheet "Tahap Sanksi".
export const DEFAULT_SANKSI = [
  { kode: 'LISAN', min: 10, label: 'Peringatan Lisan', pj: 'Guru Mata Pelajaran / Guru Piket', surat: '', warna: 'info',
    tindakan: 'Peringatan lisan, pembinaan langsung oleh Guru Mata Pelajaran / Guru Piket, dan hukuman edukatif ringan (misal: membersihkan kelas/halaman).' },
  { kode: 'SP1', min: 30, label: 'SP 1 (Teguran Tertulis)', pj: 'Wali Kelas', surat: 'SP1', warna: 'warn',
    tindakan: 'Pemanggilan oleh Wali Kelas. Siswa diberikan Teguran Tertulis (SP 1) dan wajib menandatangani surat komitmen perbaikan diri.' },
  { kode: 'SP2', min: 50, label: 'SP 2 + Panggilan Orang Tua', pj: 'Komite Disiplin / Guru BK', surat: 'SP2', warna: 'serious',
    tindakan: 'Pemanggilan Orang Tua/Wali ke sekolah oleh Komite Disiplin/Guru BK. Siswa mendapat Surat Peringatan 2 (SP 2).' },
  { kode: 'SP3', min: 70, label: 'SP 3 + Skorsing 3 Hari', pj: 'Komite Disiplin / Guru BK', surat: 'SP3', warna: 'critical',
    tindakan: 'Pemanggilan Orang Tua/Wali dan siswa mendapat Surat Peringatan 3 (SP 3) disertai Skorsing selama 3 hari.' },
  { kode: 'PK', min: 90, label: 'Peringatan Keras Terakhir', pj: 'Kepala Sekolah, Guru BK & Orang Tua', surat: 'PK', warna: 'severe',
    tindakan: 'Peringatan Keras Terakhir. Penandatanganan surat perjanjian di atas materai yang melibatkan Kepala Sekolah, Guru BK, dan Orang Tua/Wali. Siswa dalam masa percobaan ketat.' },
  { kode: 'KELUAR', min: 100, label: 'Dikeluarkan / Dipindahkan', pj: 'Kepala Sekolah (Sidang Dewan Guru)', surat: 'KELUAR', warna: 'dark',
    tindakan: 'Siswa dikeluarkan / dipindahkan. Akumulasi poin maksimal telah terpenuhi. Sekolah mengembalikan wewenang pendidikan siswa sepenuhnya kepada Orang Tua/Wali secara final dan mengikat.' },
];

export const DEFAULT_SETTINGS = {
  namaSekolah: 'SMP Kristen Basaan',
  yayasan: '',
  npsn: '',
  alamat: '',
  kota: 'Basaan',
  telepon: '',
  email: '',
  kepalaSekolah: '',
  nipKepsek: '',
  guruBK: '',
  nipBK: '',
  tahunAjaran: '2026/2027',
  semester: 'Ganjil',
  zonaWaktu: 'WITA',
  batasKoreksiJam: '24',
  batasSidang: '50',
  aksesDashboard: 'publik',
  lokasi: 'Ruang kelas, Halaman sekolah, Kantin, Gerbang sekolah, Toilet, Lapangan, Laboratorium, Perpustakaan, Luar sekolah, Media sosial',
  tindakanCepat: 'Teguran lisan, Membersihkan kelas/halaman, Barang disita sementara, Dipanggil ke ruang BK, Membuat surat pernyataan, Orang tua dihubungi',
  logo: '',
};

export const SETTING_INFO = {
  namaSekolah: 'Nama sekolah (kop surat & judul)',
  yayasan: 'Nama yayasan (baris atas kop surat, boleh kosong)',
  npsn: 'NPSN',
  alamat: 'Alamat sekolah (kop surat)',
  kota: 'Tempat penandatanganan surat (mis. Basaan)',
  telepon: 'Telepon sekolah',
  email: 'Email sekolah',
  kepalaSekolah: 'Nama Kepala Sekolah',
  nipKepsek: 'NIP/NIY Kepala Sekolah',
  guruBK: 'Nama Guru BK / Koordinator Disiplin',
  nipBK: 'NIP/NIY Guru BK',
  tahunAjaran: 'Tahun ajaran berjalan (mis. 2026/2027)',
  semester: 'Semester berjalan (Ganjil/Genap)',
  zonaWaktu: 'Zona waktu pada dokumen (WIB/WITA/WIT)',
  batasKoreksiJam: 'Batas waktu guru boleh mengubah/membatalkan catatannya sendiri (jam)',
  batasSidang: 'Akumulasi poin di atas angka ini wajib diputuskan Sidang Dewan Guru',
  aksesDashboard: 'publik = dasbor terbuka untuk semua; login = dasbor hanya setelah login',
  lokasi: 'Pilihan lokasi kejadian (pisahkan dengan koma)',
  tindakanCepat: 'Pilihan tindakan langsung (pisahkan dengan koma)',
  logo: 'Logo sekolah (diunggah dari aplikasi)',
};

export const tahunAjaranOf = (d = new Date()) => {
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
};
export const semesterOf = (d = new Date()) => (d.getMonth() >= 6 ? 'Ganjil' : 'Genap');
