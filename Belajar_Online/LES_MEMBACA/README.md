# 🐼 Baca Ceria — Belajar Membaca untuk Anak 3–6 Tahun

Aplikasi web gratis untuk anak belajar membaca bahasa Indonesia dengan **metode suku kata**,
yaitu urutan yang dipakai di TK/PAUD dan SD: kenal huruf → suku kata (ba-bi-bu-be-bo) → kata → kalimat → cerita.
Semua tulisan memakai huruf yang ramah anak (huruf *a* dan *g* sederhana seperti di buku sekolah)
dan dilengkapi **suara rekaman bahasa Indonesia**.

## Isi pelajaran — 32 pelajaran dalam 5 tahap

| Tahap | Usia | Isi |
|---|---|---|
| 🔤 **1. Kenal Huruf** | 3–4 th | Huruf vokal A I U E O, lalu B–Z (huruf besar & kecil, contoh kata bergambar) |
| 🧩 **2. Suku Kata** | 4–5 th | ba-bi-bu-be-bo, ma-mi-mu…, sampai **nga** & **nya**, beserta contoh kata |
| 📖 **3. Membaca Kata** | 5 th | Kata bergambar 2–4 suku kata: benda, hewan, makanan, tubuh, alam, orang, kata ulang |
| 🚀 **4. Kata Lebih Sulit** | 5–6 th | Kata berakhiran konsonan (ayam, ikan), bunyi ng/ny (kucing, nyamuk), kata panjang (televisi) |
| 📚 **5. Kalimat & Cerita** | 6 th | Kalimat pendek & panjang, lalu 4 cerita bergambar dengan kuis |

## 9 jenis kegiatan

- 📖 **Belajar** — kartu bergambar. Kata dibaca per suku kata (“bo… la… bola”), suku kata yang diketuk ikut berbunyi,
  tombol **🔤 Eja** membacakan “be-o bo, el-a la, bola”, dan kalimat dibacakan dengan **kata yang menyala** (seperti karaoke).
- ✍️ **Menulis Huruf** — anak menebalkan huruf dengan jari di layar.
- 👂 **Dengar & Pilih** — dengar suaranya, pilih huruf / suku kata / kata / kalimat yang benar.
- 🎈 **Pecah Balon** — pecahkan balon berisi huruf atau suku kata yang disebut.
- 🔍 **Huruf Awal** — tebak huruf pertama dari gambar.
- 👀 **Baca & Pilih** — baca kata/kalimatnya sendiri, lalu pilih gambarnya (ada tombol 💡 Bantu baca).
- 🧩 **Susun Kata / Susun Kalimat** — urutkan potongan suku kata atau kata.
- 🃏 **Kartu Pasangan / Memori** — pasangkan huruf besar–kecil, atau gambar–kata.
- ❓ **Kuis Cerita** — jawab pertanyaan tentang cerita yang baru dibaca.

Selain itu: ⭐ **bintang** (menyelesaikan satu permainan membuka pelajaran berikutnya), 🏅 **album stiker**,
🔤 **papan abjad A–Z**, 📚 **kamus kata bergambar**, dan 👨‍👩‍👧 **menu orang tua** (dikunci soal hitungan) berisi:
nama & usia anak (menentukan pelajaran pertama), laporan perkembangan, warna suku kata, huruf kapital,
pengaturan suara, buka semua pelajaran, simpan offline, hapus kemajuan, dan tips mendampingi anak.

- **Bisa dipasang seperti aplikasi (PWA)** dan **dipakai tanpa internet**.
- Tanpa iklan, tanpa login, tanpa mengirim data. Kemajuan anak tersimpan di perangkat itu sendiri.

## Menerbitkan ke GitHub Pages (tanpa perlu instal apa pun)

1. Masuk ke <https://github.com> lalu klik **New repository**. Beri nama, misalnya `baca-ceria`, pilih **Public**, lalu klik **Create repository**.
2. Di halaman repositori yang baru, klik **uploading an existing file**.
3. Buka folder `LES_MEMBACA` di komputer, **pilih semua isinya** (`index.html`, `sw.js`, `manifest.webmanifest`, `README.md`, `.nojekyll`,
   dan folder `css`, `js`, `audio`, `icons`, `tools`), lalu seret ke halaman GitHub. Jumlahnya hanya sekitar 20 file.
4. Klik **Commit changes**.
5. Buka **Settings → Pages**. Pada *Build and deployment* pilih **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**, lalu **Save**.
6. Tunggu 1–2 menit. Alamat aplikasi akan muncul, misalnya `https://NAMA-AKUN-ANDA.github.io/baca-ceria/`

Bagikan alamat itu ke orang tua atau murid. Di HP Android (Chrome): menu ⋮ → **Tambahkan ke layar utama**.
Di iPhone (Safari): **Bagikan → Tambah ke Layar Utama**.

> **Catatan:** file `.nojekyll` kadang tersembunyi di Windows Explorer. Kalau tidak ikut terunggah, aplikasi tetap berjalan normal.

## Mencoba di komputer sendiri

- **Cara paling mudah:** klik dua kali `index.html`. Semua pelajaran dan suara rekaman berjalan.
  Yang tidak aktif hanya “pasang aplikasi” dan “simpan offline”, karena keduanya butuh alamat web.
- **Seperti di internet:** buka terminal di folder ini, jalankan `python -m http.server 8000`, lalu buka <http://localhost:8000>.

## Memperbarui aplikasi

Setelah mengubah file lalu mengunggahnya ulang ke GitHub, naikkan nomor versi di `sw.js`
(misalnya `bc-app-1.0.0` → `bc-app-1.0.1`) agar HP pengguna mengambil versi terbaru.

## Menambah atau mengubah isi pelajaran

1. Edit `js/data.js`. Contoh:
   ```js
   { w: "buku", e: "📖" },                          // kata bergambar
   { t: "Ibu minum susu.", e: ["👩", "🥛"] },        // kalimat (boleh beberapa emoji)
   ```
   Suku kata dipenggal otomatis (bu-ku, ku-cing, ka-ngu-ru). Bila hasilnya kurang tepat, tulis sendiri: `suku: "ze-bra"`.
   Untuk cerita, jawaban yang **benar ditulis paling depan**; urutan pilihan diacak otomatis.
2. Buat rekamannya (perlu Python, Node.js, dan internet):
   ```
   pip install edge-tts imageio-ffmpeg
   python tools/buat_suara.py
   ```
   Skrip ini hanya membuat suara untuk isi yang baru, lalu memperbarui 5 file di folder `audio/`.
   Kalau langkah ini dilewati, isi baru tetap dibacakan dengan suara bawaan perangkat (bila tersedia suara bahasa Indonesia).
3. Jika rekaman dibuat ulang, naikkan juga `AUDIO_CACHE` (misalnya `bc-audio-1` → `bc-audio-2`) di `sw.js` **dan** `js/app.js`.

> **Tentang kejernihan suara.** Rekaman pendek diolah otomatis oleh `tools/buat_suara.py` supaya sejelas suara pemandu:
> - Nama huruf direkam dalam kalimat pemandu **“Ini huruf, A.”**; kartu Kenal Huruf memutar kalimat itu, dan di tempat lain hurufnya saja dipotong dari kalimat tersebut.
> - Semua rekaman huruf, suku kata, dan kata disamakan kekerasannya dengan suara pemandu.
> - Mesin suara kadang membaca suku kata pendek sebagai singkatan (*ri* → “er-i”, *ma* → “em-a”, *vi* → “enam”) atau
>   dengan vokal berbisik (*tu*, *ki*). Suku kata seperti ini dicatat di `js/bahasa.js` bagian `REKAM_SUKU`
>   (contoh `ri: 'rik'`): rekamannya dibuat dari teks pengganti lalu dipotong tepat di akhir vokal. Kata yang
>   bermasalah dicatat di `REKAM_KATA` (contoh: *zebra* diambil dari “zebra kuda”).
>   Bila menemukan suku kata atau kata lain yang kurang jelas, tambahkan ke daftar itu lalu jalankan ulang `python tools/buat_suara.py`.

## Struktur file

```
index.html            halaman utama
css/style.css         tampilan
css/fonts.css         huruf Andika & Fredoka yang ditanam (tetap tampil saat offline / dibuka dari file)
js/data.js            isi pelajaran (huruf, suku kata, kata, kalimat, cerita, kalimat petunjuk)
js/bahasa.js          aturan pemenggalan suku kata & daftar rekaman (dipakai aplikasi dan pembuat suara)
js/app.js             logika aplikasi (layar, permainan, suara, kemajuan)
audio/*.js            rekaman suara: ui, huruf, suku, kata, kalimat (dibuat otomatis)
sw.js                 service worker (mode offline)
manifest.webmanifest  data aplikasi untuk “pasang di layar utama”
icons/                ikon aplikasi
tools/buat_suara.py   pembuat rekaman suara
```

## Kredit

- Gambar memakai emoji bawaan perangkat (tampilannya sedikit berbeda di Android, iPhone, dan Windows).
- Rekaman suara dibuat dengan suara neural Microsoft Edge `id-ID-GadisNeural` melalui [edge-tts](https://github.com/rany2/edge-tts).
- Huruf: [Andika](https://software.sil.org/andika/) (SIL, khusus untuk anak belajar membaca) dan
  [Fredoka](https://fonts.google.com/specimen/Fredoka) — keduanya berlisensi SIL Open Font License.
