/**
 * Data bawaan. Dikirim ke spreadsheet saat admin pertama kali masuk
 * dan spreadsheet masih kosong. Juga dipakai oleh Mode Demo.
 */
window.SEED = (function () {
  const config = {
    yayasan: 'YAYASAN DS.A.Z.WENAS',
    bidang: 'BIDANG PENDIDIKAN DAN PERSEKOLAHAN',
    nama_sekolah: 'SMP KRISTEN 65 BASAAN',
    alamat: 'Jl. Raya Belang Ratatotok, Desa Basaan I Kec. Ratatotok',
    nama_sekolah_raport: 'SMP Kristen Basaan',
    alamat_raport: 'Desa Basaan Satu',
    judul_raport: 'PENCAPAIAN KOMPETENSI PESERTA DIDIK',
    semester: 'Ganjil',
    tahun_ajaran: '2026/2027',
    tempat_raport: 'Basaan',
    tanggal_raport: '.... Desember 2026',
    kepala_sekolah: 'INGGRID KAREPOWAN, S.Pd',
    nip_kepala_sekolah: '197405182008032001',
    format_raport: 'semester',
    tema_raport: 'default',
    mode_keterampilan: 'sama',
    predikat_a: 90,
    predikat_b: 80,
    predikat_c: 70,
    kata_a: 'Sangat Baik',
    kata_b: 'Baik',
    kata_c: 'Cukup',
    kata_d: 'Perlu Bimbingan',
    format_deskripsi: '{NAMA} {KATA} dalam {DIKUASAI}. dan Perlu Ditingkatkan {DITINGKATKAN}.',
    sikap_spiritual_predikat: 'Baik',
    sikap_spiritual_deskripsi: 'Sering memberi salam pada saat awal dan akhir kegiatan, menjalankan ibadah sesuai dengan agamanya dan sikap bersyukur atas nikmat dan karunia Tuhan Yang Maha Esa mulai meningkat',
    sikap_sosial_predikat: 'Baik',
    sikap_sosial_deskripsi: 'Melaksanakan dengan baik dalam sikap jujur, disiplin, tanggung jawab, santun, peduli, percaya diri, kerja sama,',
    ekskul_deskripsi_default: 'Baik, Aktif dalam mengikuti berbagai Kegiatan ekstra kurikuler yang di adakan sekolah terutama kegiatan Ekskul {EKSKUL}',
    keputusan_default: 'Berdasarkan Hasil yang telah dicapai, maka peserta didik dinyatakan\nTUNTAS dan NAIK KE KELAS SELANJUTNYA',
    tampilkan_keputusan: true,
    tampilkan_qr: true,
    // halaman Cek_Nilai.html untuk siswa
    cek_nilai_aktif: true,
    cek_nilai_ranking: true,
    ttd_kepsek: '',
    // format lama (laporan mid semester)
    judul_laporan: 'LAPORAN HASIL UJIAN TENGAH SEMESTER GANJIL',
    subjudul: '(SUMATIF / MID SEMESTER)',
    tampilkan_keterangan: true
  };

  const kelas = [
    { Kelas: '7A', Label_Raport: 'VII', Wali_Kelas: 'Laurita Ruindungan, S.Pd.Gr', NIP_Wali: '', Urut: 1 },
    { Kelas: '7B', Label_Raport: 'VII', Wali_Kelas: 'Linda Karepowan, Amd.Par', NIP_Wali: '', Urut: 2 },
    { Kelas: '8A', Label_Raport: 'VIII', Wali_Kelas: 'Mikhael N. Tunas, S.Pd', NIP_Wali: '198811272011021001', Urut: 3 },
    { Kelas: '8B', Label_Raport: 'VIII', Wali_Kelas: 'Noci Pogaga', NIP_Wali: '', Urut: 4 },
    { Kelas: '9A', Label_Raport: 'IX', Wali_Kelas: 'Shinta Lamsu, S.Pd.Gr', NIP_Wali: '', Urut: 5 },
    { Kelas: '9B', Label_Raport: 'IX', Wali_Kelas: 'Lela Nurlela, S.Pd.Gr', NIP_Wali: '', Urut: 6 }
  ];

  const mapel = [
    { Kode: 'PAK', Nama: 'Pendidikan Agama Kristen', Kelompok: 'A', KKM: 75, Urut: 1, Aktif: 'Y' },
    { Kode: 'PKN', Nama: 'Pendidikan Kewarganegaraan', Kelompok: 'A', KKM: 75, Urut: 2, Aktif: 'Y' },
    { Kode: 'BIND', Nama: 'Bahasa Indonesia', Kelompok: 'A', KKM: 70, Urut: 3, Aktif: 'Y' },
    { Kode: 'BING', Nama: 'Bahasa Inggris', Kelompok: 'A', KKM: 70, Urut: 4, Aktif: 'Y' },
    { Kode: 'MTK', Nama: 'Matematika', Kelompok: 'A', KKM: 70, Urut: 5, Aktif: 'Y' },
    { Kode: 'IPA', Nama: 'Ilmu Pengetahuan Alam', Kelompok: 'A', KKM: 70, Urut: 6, Aktif: 'Y' },
    { Kode: 'IPS', Nama: 'Ilmu Pengetahuan Sosial', Kelompok: 'A', KKM: 70, Urut: 7, Aktif: 'Y' },
    { Kode: 'PRAK', Nama: 'Prakarya / Seni', Kelompok: 'B', KKM: 75, Urut: 8, Aktif: 'Y' },
    { Kode: 'INF', Nama: 'Informatika', Kelompok: 'B', KKM: 75, Urut: 9, Aktif: 'Y' },
    { Kode: 'PJOK', Nama: 'PJOK', Kelompok: 'B', KKM: 75, Urut: 10, Aktif: 'Y' },
    { Kode: 'AKOR', Nama: 'Mulok - Anti Korupsi', Kelompok: 'B', KKM: 75, Urut: 11, Aktif: 'Y' },
    { Kode: 'BDAE', Nama: 'Mulok - Bahasa Daerah', Kelompok: 'B', KKM: 75, Urut: 12, Aktif: 'Y' }
  ];

  const bank = {
    PAK: [
      'Menjelaskan karya keselamatan Allah melalui Yesus Kristus',
      'Memahami karya keselamatan Allah dalam sejarah bangsa Israel',
      'Menjelaskan makna Allah sebagai Pencipta dan Pemelihara',
      'Menerapkan nilai-nilai kasih dalam kehidupan sehari-hari',
      'Menjelaskan peran Roh Kudus dalam kehidupan orang percaya'
    ],
    PKN: [
      'Menampilkan hasil wawancara/survei tentang toleransi',
      'Menjelaskan jenis-jenis norma (agama, hukum, adat, dsb)',
      'Menjelaskan nilai-nilai Pancasila dalam kehidupan sehari-hari',
      'Menganalisis hak dan kewajiban sebagai warga negara',
      'Menjelaskan makna Bhinneka Tunggal Ika'
    ],
    BIND: [
      'Menyusun ringkasan teks naratif atau eksplanasi',
      'Menyusun teks prosedur dengan langkah-langkah yang sistematis',
      'Menemukan gagasan utama dalam teks bacaan',
      'Menulis teks deskripsi dengan kalimat yang efektif',
      'Menyampaikan pendapat secara lisan dengan santun'
    ],
    BING: [
      'Memahami instruksi lisan dan tertulis sederhana dalam konteks kelas/sekolah',
      'Mengidentifikasi struktur teks dan unsur kebahasaan dalam teks prosedur sederhana (how to…)',
      'Memperkenalkan diri dan orang lain dalam bahasa Inggris',
      'Menulis teks deskriptif sederhana tentang orang, benda, atau tempat',
      'Menggunakan kosakata sehari-hari dengan tepat'
    ],
    MTK: [
      'Mengurutkan bilangan berdasarkan nilai mutlak dan posisi di garis bilangan',
      'Menghitung luas dan keliling bangun datar',
      'Menyelesaikan operasi hitung bilangan bulat dan pecahan',
      'Menyelesaikan persamaan dan pertidaksamaan linear satu variabel',
      'Menyajikan dan menafsirkan data dalam bentuk tabel dan diagram'
    ],
    IPA: [
      'Menjelaskan struktur dan fungsi organ pada sistem pencernaan manusia',
      'Menyebutkan besaran pokok dan satuannya dalam Sistem Internasional',
      'Mengklasifikasikan makhluk hidup berdasarkan ciri-cirinya',
      'Menjelaskan perubahan wujud zat dalam kehidupan sehari-hari',
      'Melakukan pengukuran dengan alat ukur yang tepat'
    ],
    IPS: [
      'Menjelaskan kondisi geologis dan astronomis wilayah Indonesia',
      'Menyajikan garis waktu perkembangan kerajaan-kerajaan di Indonesia',
      'Menjelaskan interaksi sosial dalam kehidupan bermasyarakat',
      'Menjelaskan kegiatan ekonomi produksi, distribusi, dan konsumsi',
      'Membaca dan menafsirkan peta wilayah Indonesia'
    ],
    PRAK: [
      'Menjelaskan prinsip kerja teknologi sederhana (alat penjernih air, rangkaian listrik, dll.)',
      'Menjelaskan teknik dasar pembuatan kerajinan dari bahan alam',
      'Merancang dan membuat produk kerajinan dari bahan limbah',
      'Mengapresiasi karya seni rupa daerah setempat',
      'Mempresentasikan hasil karya dengan percaya diri'
    ],
    INF: [
      'Menjelaskan konsep dasar jaringan komputer dan fungsi internet',
      'Menyajikan data sederhana dalam bentuk tabel dan grafik',
      'Menerapkan berpikir komputasional dalam menyelesaikan masalah',
      'Menggunakan aplikasi pengolah kata dan angka dengan baik',
      'Menerapkan etika dan keamanan dalam bermedia digital'
    ],
    PJOK: [
      'Menjelaskan pentingnya pemanasan dan pendinginan sebelum dan setelah berolahraga',
      'Menerapkan pola hidup sehat dengan cara menjaga kebugaran fisik melalui aktivitas olahraga',
      'Mempraktikkan teknik dasar permainan bola besar',
      'Mempraktikkan gerak dasar atletik (lari, lompat, lempar)',
      'Menunjukkan sikap sportif dan kerja sama dalam permainan'
    ],
    AKOR: [
      'Menjelaskan pengertian dan bentuk-bentuk perilaku korupsi',
      'Menerapkan nilai kejujuran dan tanggung jawab di lingkungan sekolah',
      'Menjelaskan dampak korupsi bagi masyarakat dan negara',
      'Menunjukkan sikap disiplin dan sederhana dalam kehidupan sehari-hari'
    ],
    BDAE: [
      'Menggunakan kosakata bahasa daerah dalam percakapan sehari-hari',
      'Memahami cerita rakyat daerah setempat',
      'Menyanyikan lagu daerah dengan lafal yang tepat',
      'Menulis kalimat sederhana dalam bahasa daerah'
    ]
  };

  const now = '2026-01-01T00:00:00.000Z';
  const deskripsi = [];
  Object.keys(bank).forEach(kode => {
    bank[kode].forEach((teks, i) => {
      deskripsi.push({ ID: 'D-' + kode + '-' + (i + 1), Kode_Mapel: kode, Tingkat: 'Semua', Teks: teks, Dibuat_Oleh: 'Bawaan', Diperbarui: now });
    });
  });

  // Data contoh khusus Mode Demo (nama fiktif)
  function demoSiswa() {
    const depan = ['Andreas', 'Bella', 'Christian', 'Debora', 'Elisa', 'Frans', 'Grace', 'Hendra', 'Imanuel', 'Jessica', 'Kevin', 'Lidia'];
    const belakang = ['Lumintang', 'Pangemanan', 'Rumondor', 'Wenas', 'Sumual', 'Tumbelaka', 'Karundeng', 'Mandagi'];
    const rows = [];
    let n = 1;
    kelas.forEach((k, ki) => {
      for (let i = 0; i < 8; i++) {
        const nama = (depan[(i + ki * 3) % depan.length] + ' ' + belakang[(i * 3 + ki) % belakang.length]).toUpperCase();
        rows.push({ NISN: '01' + String(10000000 + n * 7919).slice(-8), NIS: String(2026000 + n), Nama: nama, Kelas: k.Kelas, JK: i % 2 ? 'P' : 'L', No_Absen: i + 1 });
        n++;
      }
    });
    return rows;
  }

  return { config, kelas, mapel, deskripsi, demoSiswa };
})();
