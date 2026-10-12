# E-Raport SMP Kristen 65 Basaan (v3)

Aplikasi web untuk **input nilai oleh Guru** (dari HP, bisa offline) dan **pengolahan & cetak raport oleh Admin**.
Database dan backend berada di **Google Spreadsheet + Google Apps Script**. Aplikasinya berupa file statis yang bisa
diunggah ke **GitHub Pages**, dan bisa dipasang di HP seperti aplikasi (PWA).

## Pengguna

| Peran | Password bawaan | Tugas |
|---|---|---|
| Guru  | `guru123`  | Pilih mapel → pilih kelas → isi nilai angka + pilih 2 deskripsi (paling dikuasai & perlu ditingkatkan) → Simpan |
| Admin | `admin123` | Data siswa, sikap/ekskul/kehadiran, cetak raport, leger, ranking, analisis, import/export Excel, pengaturan |

Ganti password di `js/config.js`.

## Cara Pasang

### 1. Siapkan Spreadsheet & Apps Script
1. Buat Google Spreadsheet baru (misal: "Database E-Raport").
2. Menu **Ekstensi → Apps Script**. Hapus isi `Code.gs`, lalu tempel seluruh isi file `backend/Code.gs`. Simpan.
3. Pilih fungsi `setupSheets` lalu klik **Jalankan** (izinkan akses). Sheet database otomatis dibuat.
4. Klik **Terapkan → Deployment baru → Jenis: Aplikasi web**
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
5. Salin **URL Aplikasi Web** (berakhiran `/exec`).

> Jika `Code.gs` diubah, buka **Terapkan → Kelola deployment → Edit → Versi: Versi baru**.

### 2. Atur `js/config.js`
```js
API_URL: 'https://script.google.com/macros/s/XXXX/exec',
API_KEY: 'krisba-raport-2026',   // harus sama dengan KUNCI_API di Code.gs
PASSWORD_GURU: 'guru123',
PASSWORD_ADMIN: 'admin123',
```
Jika `API_URL` dikosongkan, aplikasi berjalan dalam **Mode Demo** (data contoh, hanya tersimpan di perangkat) untuk mencoba fitur.

### 3. Unggah ke GitHub
1. Buat repository baru, unggah seluruh isi folder ini (folder `_arsip_versi_lama` otomatis diabaikan oleh `.gitignore`).
2. **Settings → Pages → Branch: main / root → Save**.
3. Buka `https://<username>.github.io/<repo>/`.
4. **Admin masuk pertama kali** → spreadsheet kosong otomatis diisi data awal (12 mapel, 6 kelas & wali kelas, pengaturan, bank deskripsi).
5. Admin mengisi data siswa (menu Data Siswa / Import Excel).

> Bisa juga dijalankan tanpa GitHub: buka `index.html` di Chrome/Edge (fitur offline/PWA penuh hanya aktif bila dibuka lewat http/https).

## Alur Guru (HP)
- **Masuk harus online** → data siswa, mapel, dan deskripsi diambil dari spreadsheet.
- Nilai yang diketik **langsung tersimpan di HP** (tanda kuning "Tersimpan di HP"). Tekan **Simpan** untuk mengirim ke spreadsheet.
- Tanpa internet tetap bisa input; data dikirim otomatis saat online kembali (bisa dimatikan di menu Akun) atau tekan tombol **Sinkron** di pojok kanan atas.
- Nilai **tetap tersimpan di HP** walaupun sudah sinkron. Penghapusan dilakukan dari menu **Data**: per mapel & kelas, yang sudah tersinkron saja, atau semuanya (ada peringatan jika masih ada data yang belum terkirim).
- Fitur lain: tambah/ubah deskripsi (bisa banyak sekaligus, per tingkat), isi deskripsi massal, filter (belum diisi / di bawah KKM / belum sinkron), statistik kelas, pratinjau kalimat raport, rekap + export Excel + bagikan ke WhatsApp, cadangan & pulihkan (pindah HP), riwayat sinkron, mode gelap, pasang sebagai aplikasi.

## Fitur Admin
Semua fitur versi lama tetap ada, dengan tambahan:
- **Cetak Raport** format **Semester** sesuai `Template Rapor.pdf` (identitas, sikap, pengetahuan & keterampilan + deskripsi, jumlah/rata-rata/ranking, ekstrakurikuler, kehadiran, keputusan, tanda tangan, QR verifikasi). Halaman dibagi otomatis ke kertas F4. Format **Laporan Mid Semester** lama tetap bisa dipilih.
- Unduh PDF (per siswa / 1 kelas), buka PDF di tab, cetak massal, Word (.doc) per siswa / 1 kelas, ZIP Word.
- **Data Siswa**: tambah, ubah, hapus, pindah kelas, urut nomor absen, import & template Excel.
- **Sikap, Ekskul & Kehadiran** per kelas (+ isi massal), **Bank Deskripsi**, **Log Aktivitas Guru**, monitoring progres input per mapel.
- **Excel**: template import lengkap (Siswa, 1 sheet per mapel, Pelengkap, Daftar_Deskripsi) yang sudah terisi data saat ini; import dengan **pratinjau & validasi** sebelum disimpan; file format lama (sheet Siswa + Nilai) dan Leger tetap terbaca; export seluruh data; Leger Excel berwarna.
- Cadangan & pemulihan lengkap (.json), hapus nilai per mapel/kelas (misal pergantian semester).
- **Pengaturan**: identitas, semester & tahun pelajaran, batas & kata predikat, pola kalimat deskripsi, teks bawaan sikap/ekskul/keputusan, kepala sekolah + gambar tanda tangan, kelas & wali kelas, mapel & KKM, nilai keterampilan sama/terpisah.

## Struktur
```
index.html            Login (Guru / Admin)
guru.html             Aplikasi guru (mobile)
admin.html            Aplikasi admin
js/config.js          URL API & password  <- diedit
js/seed.js            Data bawaan (mapel, kelas, bank deskripsi)
js/core.js            API, penyimpanan HP, perhitungan nilai/predikat/deskripsi
js/guru.js            Logika aplikasi guru
js/admin/*.js         Modul admin (raport, laporan, data, excel, pengaturan)
backend/Code.gs       Backend Google Apps Script
sw.js, manifest.json  Mode offline / pasang di HP
_arsip_versi_lama/    Versi Python sebelumnya (tidak diunggah ke GitHub)
```

## Sheet di Spreadsheet
`Pengaturan`, `Kelas`, `Mapel`, `Siswa`, `Nilai`, `Deskripsi`, `Pelengkap`, `Log` — dibuat otomatis. Sebaiknya data diubah lewat aplikasi, bukan langsung di spreadsheet.

## Catatan Keamanan
Sesuai kebutuhan sekolah, password disimpan di kode (`js/config.js`) dan dapat dilihat oleh siapa pun yang membuka kode sumber di GitHub. Jangan simpan data yang sangat rahasia. Jika repository publik, pertimbangkan mengganti password & `API_KEY` secara berkala.
