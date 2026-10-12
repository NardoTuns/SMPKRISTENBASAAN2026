# E-Raport Mid Semester SMP Kristen 65 Basaan (v3-mid)

Aplikasi web untuk **input nilai mid semester oleh Guru** (dari HP, bisa offline) dan **pengolahan & cetak Laporan Hasil
Ujian Tengah Semester oleh Admin**. Database & backend memakai **Google Spreadsheet + Google Apps Script**. Aplikasinya
berupa file statis yang bisa diunggah ke **GitHub Pages** dan dipasang di HP seperti aplikasi (PWA).

Fitur sama dengan E-Raport Semester, **kecuali semua yang berkaitan dengan deskripsi** (bank deskripsi, pilihan
"paling dikuasai / perlu ditingkatkan", sikap, ekskul, kehadiran, keputusan, QR). Format raport yang dicetak tetap
format lama: kop sekolah, NAMA & KELAS, tabel NO / MATA PELAJARAN / KKM / NILAI / KETERANGAN, JUMLAH, RANKING,
dan tanda tangan wali kelas.

## Pengguna

| Peran | Password bawaan | Tugas |
|---|---|---|
| Guru  | `guru123`  | Pilih mapel → pilih kelas → isi nilai angka → Simpan |
| Admin | `admin123` | Data siswa, cetak raport, leger, ranking, analisis, kelengkapan, import/export Excel, pengaturan |

Ganti password di `js/config.js`.

## Cara Pasang

### 1. Siapkan Spreadsheet & Apps Script (TERPISAH dari E-Raport Semester)
1. Buat Google Spreadsheet **baru** (misal: "Database E-Raport Mid Semester"). Jangan memakai spreadsheet E-Raport
   Semester, agar nilai mid dan nilai semester tidak tercampur.
2. Menu **Ekstensi → Apps Script**. Hapus isi `Code.gs`, tempel seluruh isi `backend/Code.gs`. Simpan.
3. Pilih fungsi `setupSheets` lalu klik **Jalankan** (izinkan akses). Sheet database otomatis dibuat.
4. **Terapkan → Deployment baru → Jenis: Aplikasi web** (Jalankan sebagai: Saya, Akses: Siapa saja).
5. Salin **URL Aplikasi Web** (berakhiran `/exec`).

> Jika `Code.gs` diubah, buka **Terapkan → Kelola deployment → Edit → Versi: Versi baru**.

### 2. Atur `js/config.js`
```js
API_URL: 'https://script.google.com/macros/s/XXXX/exec',
API_KEY: 'krisba-mid-2026',   // harus sama dengan KUNCI_API di backend/Code.gs
```
Selama `API_URL` masih kosong, aplikasi berjalan dalam **Mode Demo** (data contoh, hanya tersimpan di perangkat).

### 3. Jalankan / Unggah
- Lokal: klik ganda `Buka_Aplikasi_Lokal.bat` (http://localhost:8081, butuh Python), atau buka `index.html` di Chrome/Edge.
- GitHub Pages: unggah isi folder ini (folder `_arsip_versi_lama` diabaikan `.gitignore`), lalu
  **Settings → Pages → Branch: main / root**.
- **Admin masuk pertama kali** → spreadsheet kosong otomatis diisi data awal (12 mapel, 6 kelas & wali, pengaturan).
- Isi data siswa lewat menu Data Siswa / Import Excel. File `DKN.xlsx` versi lama bisa langsung diimport.

Aplikasi ini memakai penyimpanan HP dengan awalan `rptm_`, jadi aman dipasang di domain yang sama dengan E-Raport Semester.

## Alur Guru (HP)
- Masuk harus online → data siswa & mapel diambil dari spreadsheet.
- Nilai yang diketik langsung tersimpan di HP (tanda kuning). Tekan **Simpan** untuk mengirim ke spreadsheet.
- Tanpa internet tetap bisa input; dikirim otomatis saat online (bisa dimatikan di menu Akun) atau tekan **Sinkron**.
- Tanda T / BT di samping nilai = Tuntas / Belum Tuntas terhadap KKM.
- Fitur lain: filter (belum diisi / di bawah KKM / belum sinkron), statistik kelas, rekap + export Excel + bagikan WA,
  cadangan & pulihkan (pindah HP), hapus data per mapel/kelas, riwayat sinkron, mode gelap, pasang sebagai aplikasi.

## Fitur Admin
- **Cetak Raport** format Laporan Mid Semester (5 pilihan tema warna): cetak per siswa / massal 1 kelas, unduh PDF
  (per siswa / 1 kelas, kertas F4), buka PDF di tab, Word (.doc) per siswa / 1 kelas, ZIP Word.
- **Leger/DKN**: PDF landscape, Excel berwarna, cetak.
- **Data Siswa**: tambah, ubah, hapus, pindah kelas, urut nomor absen, import & template Excel.
- **Perengkingan**, **Nilai per Mapel** (+ ubah nilai oleh admin), **Analisis & grafik**, **Kelengkapan Nilai**
  (+ pengingat WA guru, lembar kontrol), **Log Aktivitas Guru**.
- **Excel**: template import lengkap (Siswa + 1 sheet per mapel) berisi data saat ini; import dengan pratinjau &
  validasi; format lama (Siswa + Nilai) & DKN/Leger tetap terbaca; export seluruh data.
- Cadangan & pemulihan lengkap (.json), hapus nilai per mapel/kelas.
- **Pengaturan**: kop sekolah, judul & subjudul laporan, semester, tahun ajaran, tempat & tanggal, tampil/sembunyi
  kolom Keterangan, kepala sekolah, predikat (untuk ranking & analisis), kelas & wali kelas, mapel & KKM.

## Struktur
```
index.html            Login (Guru / Admin)
guru.html             Aplikasi guru (mobile)
admin.html            Aplikasi admin
js/config.js          URL API & password  <- diedit
js/seed.js            Data bawaan (mapel, kelas, pengaturan)
js/core.js            API, penyimpanan HP, perhitungan nilai & ranking
js/guru.js            Logika aplikasi guru
js/admin/*.js         Modul admin (raport, laporan, data, excel, pengaturan)
backend/Code.gs       Backend Google Apps Script
sw.js, manifest.json  Mode offline / pasang di HP
_arsip_versi_lama/    Versi Python sebelumnya (tidak diunggah ke GitHub)
```

## Sheet di Spreadsheet
`Pengaturan`, `Kelas`, `Mapel`, `Siswa`, `Nilai`, `Log` — dibuat otomatis.

## Catatan Keamanan
Password disimpan di kode (`js/config.js`) dan dapat dilihat siapa pun yang membuka kode sumber di GitHub. Jangan
simpan data yang sangat rahasia; ganti password & `API_KEY` secara berkala bila repository publik.
