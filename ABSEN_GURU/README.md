# SIABSEN — Sistem Absensi Guru (Offline-First + Sinkron Spreadsheet)

Aplikasi web absensi guru untuk **SMP KRISTEN BASAAN**, bisa dipakai **offline** di HP/laptop,
dan datanya bisa **disinkronkan ke Google Spreadsheet** kapan saja ada internet.

---

## 📦 Isi Folder

```
absensi-guru/
├── index.html          → Halaman utama aplikasi
├── manifest.json        → Agar bisa "Install" seperti aplikasi (PWA)
├── sw.js                → Service worker (bikin aplikasi bisa offline)
├── assets/
│   ├── style.css         → Tampilan (warna, layout)
│   └── app.js            → Semua logika aplikasi
├── vendor/               → Library pihak ketiga (sudah disertakan, tidak perlu internet)
│   ├── jspdf.umd.min.js     → Untuk ekspor laporan ke PDF
│   ├── html2canvas.min.js   → Untuk ekspor laporan ke PNG
│   └── chart.umd.js         → Untuk grafik analisis per guru
├── Code.gs               → Kode backend Google Apps Script (WAJIB dipasang di Google Sheets)
└── README.md             → Panduan ini
```

---

## 🚀 LANGKAH 1 — Siapkan Google Spreadsheet (Backend)

1. Buka [Google Sheets](https://sheets.new) → buat spreadsheet baru,
   beri nama misalnya **"Database Absensi Guru - SMP Kristen Basaan"**.
2. Klik menu **Extensions (Ekstensi) → Apps Script**.
3. Hapus semua kode contoh yang ada, lalu **copy-paste seluruh isi file `Code.gs`** dari folder ini.
4. Simpan (Ctrl+S / ikon disket).
5. Di dropdown pilihan fungsi (di atas, sebelah tombol ▶️ Run), pilih **`setupSheets`**, lalu klik **Run**.
   - Google akan minta izin akses — klik **Allow/Izinkan** (pilih akun Anda, lalu "Advanced/Lanjutan" → "Go to project (unsafe)" jika muncul peringatan, ini normal untuk skrip milik sendiri).
   - Setelah selesai akan muncul pop-up "Setup selesai!".
6. Kembali ke Spreadsheet, sekarang akan ada 3 sheet: **Config**, **Guru**, **Absensi**.
7. Buka sheet **Config**, ganti sel **B1** dengan password yang Anda inginkan untuk aplikasi
   (contoh: `basaan2026`). Bisa juga ubah kop laporan di B2, B3, B4 (opsional, karena juga bisa
   diatur dari dalam aplikasi).

### Deploy sebagai Web App

1. Di editor Apps Script, klik tombol **Deploy → New deployment**.
2. Klik ikon ⚙️ di samping "Select type", pilih **Web app**.
3. Isi:
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: `Anyone`
4. Klik **Deploy**, lalu izinkan akses jika diminta lagi.
5. **Salin URL Web App** yang muncul (bentuknya seperti
   `https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxx/exec`).
   URL inilah yang akan dimasukkan ke aplikasi SIABSEN.

> ⚠️ Setiap kali Anda mengubah isi `Code.gs`, Anda harus membuat **New deployment** lagi (atau
> "Manage deployments" → edit versi) agar perubahan aktif.

---

## 🚀 LANGKAH 2 — Jalankan Aplikasi SIABSEN

Aplikasi ini adalah **website statis murni** (HTML/CSS/JS), tidak butuh server khusus. Pilih salah satu:

### Opsi A — Buka langsung dari HP/Laptop (paling sederhana)
1. Salin seluruh folder `absensi-guru` ke HP atau laptop.
2. Buka file `index.html` dengan browser (Chrome/Edge/Firefox).
3. (Disarankan) klik menu browser → **"Add to Home Screen" / "Install App"** agar tampil
   seperti aplikasi asli dan bisa dibuka offline.

### Opsi B — Hosting online (agar bisa dibuka banyak guru sekaligus)
Upload seluruh folder ke layanan gratis seperti:
- **GitHub Pages**
- **Netlify** / **Vercel**
- Hosting sekolah yang sudah ada

Setelah online, setiap guru/operator cukup membuka URL-nya dari HP masing-masing, dan tetap
bisa dipakai offline setelah kunjungan pertama (berkat *service worker*).

---

## 🚀 LANGKAH 3 — Login Pertama Kali (WAJIB Online)

1. Buka aplikasi → tab **"Pengaturan Server"**.
2. Tempel **URL Web App** dari Langkah 1, isi juga nama sekolah (opsional).
3. Klik **Simpan Pengaturan Server**.
4. Pindah ke tab **"Masuk"**, masukkan password yang tadi diatur di sheet Config (mis. `basaan2026`).
5. Klik **"Masuk & Sinkronkan"**. Aplikasi akan mengunduh data guru & kop laporan dari Spreadsheet.
6. Setelah berhasil, aplikasi **bisa dipakai offline** kapan saja — password akan diverifikasi
   secara lokal di perangkat.

---

## ✅ Fitur Aplikasi

| Fitur | Keterangan |
|---|---|
| **Login + Sinkron Awal** | Wajib online sekali di awal, setelah itu bisa offline |
| **Mode Offline Penuh** | Semua data absensi tersimpan di HP (localStorage), tidak hilang saat tidak ada internet |
| **Admin Data Guru** | Tambah/Edit/Hapus guru (Nama, NIP, Jenis Kelamin, NUPTK) |
| **Absensi Guru** | Pilih tanggal, Datang/Pulang, status (Hadir/Sakit/Izin/Alpa), keterangan (Terlambat/Tugas Luar/Pulang Cepat/Lainnya), catatan bebas |
| **Indikator Data Pending** | Menampilkan jumlah data yang belum tersinkron |
| **Sinkronisasi Manual** | Tombol "Sinkronkan Sekarang", mengirim data absensi baru & data guru ke Spreadsheet |
| **Dashboard** | Statistik hari ini: total guru, hadir, tidak hadir, data pending, daftar guru belum absen |
| **Laporan Harian** | Rekap absensi per tanggal, dengan kop resmi sekolah |
| **Laporan Rentang Tanggal** | Rekap absensi antar dua tanggal |
| **Analisis Per Guru** | Grafik donat + rekap kehadiran per guru dalam periode tertentu |
| **Ekspor PNG & PDF** | Semua laporan bisa diunduh sebagai gambar atau PDF siap cetak |
| **Cetak Langsung** | Tombol cetak ke printer |
| **Kop Laporan Kustom** | SMP KRISTEN BASAAN / KECAMATAN RATATOTOK / KABUPATEN MINAHASA TENGGARA (bisa diubah di Pengaturan) |
| **Mode Gelap** | Nyaman dipakai malam hari |
| **Cadangan Data (Backup/Restore)** | Ekspor & impor seluruh data lokal dalam format JSON |
| **PWA / Install ke Layar Utama** | Bisa dijadikan ikon aplikasi di HP, tetap jalan tanpa internet |
| **Pencarian** | Cari guru / riwayat absensi dengan cepat |

---

## 🔐 Catatan Keamanan

- Password disimpan di server dalam bentuk teks biasa (sheet Config) — pastikan hanya admin
  sekolah yang memiliki akses ke Spreadsheet & Apps Script.
- Di perangkat pengguna, password disimpan dalam bentuk **hash SHA-256**, bukan teks asli.
- Untuk keamanan tambahan, batasi akses Spreadsheet hanya untuk akun Google sekolah.

## 🛠️ Pemecahan Masalah

- **"Gagal menghubungi server"** → pastikan URL Web App benar (diakhiri `/exec`) dan koneksi internet aktif.
- **Password ditolak terus** → cek kembali isi sel B1 di sheet Config, pastikan tidak ada spasi tambahan.
- **Data guru tidak muncul setelah sinkron** → pastikan sheet "Guru" sudah punya header yang benar (jalankan ulang `setupSheets`).
- **Perubahan `Code.gs` tidak berpengaruh** → buat deployment baru (Deploy → Manage deployments → Edit → New version).
