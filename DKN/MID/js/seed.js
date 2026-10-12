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
    judul_laporan: 'LAPORAN HASIL UJIAN TENGAH SEMESTER GANJIL',
    subjudul: '(SUMATIF / MID SEMESTER)',
    tampilkan_keterangan: true,
    semester: 'Ganjil',
    tahun_ajaran: '2026/2027',
    tempat_raport: 'BASAAN',
    tanggal_raport: '.... Oktober 2026',
    kepala_sekolah: 'INGGRID KAREPOWAN, S.Pd',
    nip_kepala_sekolah: '197405182008032001',
    tema_raport: 'default',
    predikat_a: 90,
    predikat_b: 80,
    predikat_c: 70,
    kata_a: 'Sangat Baik',
    kata_b: 'Baik',
    kata_c: 'Cukup',
    kata_d: 'Perlu Bimbingan'
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

  return { config, kelas, mapel, demoSiswa };
})();
