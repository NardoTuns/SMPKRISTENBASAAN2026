# 🦉 English Ceria — Belajar Bahasa Inggris untuk Anak

Aplikasi web gratis untuk anak usia ±5 tahun belajar kosakata bahasa Inggris.
Setiap kata tampil dengan **gambar**, **arti bahasa Indonesia**, **kata bahasa Inggris**,
**cara membaca**, dan **suara pengucapan** (normal & pelan).

## Fitur

- **23 level, 228 kosakata**, dibagi 3 tahap:
  - 🌱 **Tahap 1 – Pemula:** Buah, Hewan Peliharaan, Warna, Angka, Anggota Tubuh, Keluarga, Hewan Liar, Makanan & Minuman
  - 🚀 **Tahap 2 – Penjelajah:** Sayuran, Mainan, Kendaraan, Pakaian, Benda di Rumah, Alam & Cuaca, Bentuk, Hewan Laut
  - 🏆 **Tahap 3 – Juara:** Hewan Kecil, Sekolah, Profesi, Perasaan, Kata Kerja, Lawan Kata, Sapaan
- **📖 Belajar Kata:** kartu bergambar. Kata dibacakan “*Kucing… bahasa Inggrisnya… Cat!*”, lengkap dengan tombol 🔊 Dengar, 🐢 Pelan, dan 🎤 Ucapkan (latihan pengucapan dengan mikrofon, di browser yang mendukung).
- **3 permainan:**
  - 👂 **Dengar & Pilih:** dengarkan kata Inggrisnya, lalu pilih gambar yang benar (cocok untuk anak yang belum lancar membaca)
  - 🖼️ **Tebak Kata:** lihat gambarnya, lalu pilih kata Inggris yang benar (setiap pilihan bisa didengarkan)
  - 🃏 **Kartu Memori:** cari pasangan gambar dan katanya
- **⭐ Bintang & 🔓 level bertahap:** menyelesaikan satu permainan membuka level berikutnya.
- **🏅 Album Stiker:** setiap kata yang dijawab benar menjadi stiker koleksi.
- **📚 Kamus:** daftar semua kata yang bisa dicari, lengkap dengan suara.
- **👨‍👩‍👧 Menu Orang Tua** (dikunci soal hitungan sederhana): nama anak, laporan perkembangan per level, pengaturan suara, buka semua level, simpan offline, dan hapus kemajuan.
- **Suara rekaman** (suara anak untuk bahasa Inggris dan suara perempuan untuk bahasa Indonesia): sama di semua HP dan bisa dipakai offline. Suara bawaan perangkat dipakai sebagai cadangan.
- **Bisa dipasang seperti aplikasi (PWA)** dan **bisa dipakai tanpa internet.**
- Tanpa iklan, tanpa login, dan tanpa mengirim data. Kemajuan anak tersimpan di perangkat itu sendiri.

## Menerbitkan ke GitHub Pages (tanpa perlu instal apa pun)

1. Masuk ke <https://github.com> lalu klik **New repository**. Beri nama, misalnya `english-ceria`, pilih **Public**, lalu klik **Create repository**.
2. Di halaman repositori yang baru, klik **uploading an existing file**.
3. Buka folder `LES_BAHASA_INGGRIS` di komputer, **pilih semua isinya** (`index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `.nojekyll`, dan folder `css`, `js`, `audio`, `icons`, `tools`), lalu seret ke halaman GitHub.
   Jumlahnya hanya sekitar 40 file, jadi muat dalam sekali unggah (batas GitHub: 100 file per unggahan).
4. Klik **Commit changes**.
5. Buka **Settings → Pages**. Di bagian *Build and deployment*, pilih **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, lalu **Save**.
6. Tunggu 1–2 menit. Alamat aplikasi akan muncul, misalnya:
   `https://NAMA-AKUN-ANDA.github.io/english-ceria/`

Bagikan alamat itu ke orang tua atau murid. Di HP Android (Chrome), pilih menu ⋮ → **Tambahkan ke layar utama**.
Di iPhone (Safari), pilih **Bagikan → Tambah ke Layar Utama**.

> **Catatan:** file `.nojekyll` kadang tersembunyi di Windows Explorer. Kalau tidak ikut terunggah, aplikasi tetap berjalan normal.

## Mencoba di komputer sendiri

- **Cara paling mudah:** klik dua kali `index.html`. Semua fitur jalan, termasuk suara rekaman. Yang tidak aktif hanya fitur “pasang aplikasi” dan “simpan offline”, karena kedua fitur itu butuh alamat web.
- **Seperti di internet:** buka terminal di folder ini lalu jalankan `python -m http.server 8000`, kemudian buka <http://localhost:8000>.

## Memperbarui aplikasi

Setelah mengubah file lalu mengunggahnya ulang ke GitHub, naikkan nomor versi di `sw.js`
(misalnya `ec-app-1.0.0` → `ec-app-1.0.1`) agar HP pengguna mengambil versi terbaru.

## Menambah atau mengubah kosakata

1. Edit `js/data.js`. Setiap kata ditulis seperti ini:
   ```js
   { en: "Cat", ind: "Kucing", ucap: "két", e: "🐱" },
   ```
   Gambar bisa berupa emoji (`e`), warna (`color: "#e53935"`), bentuk (`shape: "circle", fill: "#ff595e"`), atau angka (`num: 3, item: "🍓"`).
2. Buat rekamannya (perlu Python, Node.js, dan internet):
   ```
   pip install edge-tts imageio-ffmpeg
   python tools/buat_suara.py
   ```
   Skrip ini membuat suara untuk kata baru lalu memperbarui file di folder `audio/`.
   Kalau langkah ini dilewati, kata baru tetap dibacakan dengan suara bawaan perangkat.
3. Jika rekaman dibuat ulang, naikkan juga `AUDIO_CACHE` (misalnya `ec-audio-1` → `ec-audio-2`) di `sw.js` **dan** `js/app.js`.

## Struktur file

```
index.html            halaman utama
css/style.css         tampilan
js/data.js            daftar level & kosakata
js/app.js             logika aplikasi (layar, permainan, suara, progres)
audio/L01.js … L23.js rekaman suara per level (dibuat otomatis)
audio/ui.js           rekaman instruksi & pujian
sw.js                 service worker (mode offline)
manifest.webmanifest  data aplikasi untuk “pasang di layar utama”
icons/                ikon aplikasi
tools/buat_suara.py   pembuat rekaman suara
```

## Kredit

- Gambar memakai emoji bawaan perangkat (Android, iPhone, dan Windows menampilkan gaya emoji masing-masing).
- Rekaman suara dibuat dengan suara neural Microsoft Edge melalui [edge-tts](https://github.com/rany2/edge-tts):
  `en-US-AnaNeural` (Inggris) dan `id-ID-GadisNeural` (Indonesia).
- Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (Google Fonts, SIL Open Font License).
