# Panduan Aplikasi Tata Tertib — SMP Kristen Basaan

Aplikasi **Buku Kedisiplinan Siswa digital**. Guru mencatat pelanggaran dari HP, poin dijumlahkan otomatis, tahap sanksi (Peringatan Lisan → SP 1 → SP 2 → SP 3 → Peringatan Keras → Dikeluarkan) dihitung sendiri, dan BAP serta surat bisa langsung dicetak. Dasbor dan laporan terbuka untuk semua pengguna aplikasi.

- **Tampilan (frontend)**: folder ini, di-host gratis di **GitHub Pages**. Bisa dipasang di HP dan berjalan **tanpa internet**.
- **Data (backend)**: **Google Spreadsheet** + **Apps Script** (`apps-script/Code.gs`).
- **Data di HP tidak dihapus** setelah tersinkron. Catatan yang dibuat saat offline disimpan di HP, lalu dikirim otomatis saat online.

---

## 1. Menyiapkan server (Google Spreadsheet + Apps Script) — ±10 menit

1. Buka <https://sheets.new> (login dengan akun Google sekolah). Beri nama, mis. **TATA TERTIB SMP KRISTEN BASAAN**.
2. **File → Setelan → Zona waktu** → pilih **(GMT+08:00) Makassar** agar jam di sheet sesuai WITA → Simpan.
3. Menu **Ekstensi → Apps Script**. Hapus semua isi `Code.gs`, lalu **salin-tempel seluruh isi** file `apps-script/Code.gs` dari folder ini. Klik **Simpan** (ikon disket).
4. Di bilah atas editor, pilih fungsi **`setup`** → klik **Jalankan** → izinkan akses (Tinjau izin → pilih akun → *Lanjutan* → *Buka … (tidak aman)* → Izinkan). Ini wajar karena skrip buatan sendiri.
5. Kembali ke spreadsheet. Sheet-sheet sudah dibuat dan terisi aturan dari dokumen tata tertib (45 bentuk pelanggaran, 6 kategori, 6 tahap sanksi). Buka sheet **Pengguna**: ada akun **admin** dengan password acak (mis. `krisba4821`). **Catat password ini.**
6. Di editor Apps Script: **Terapkan → Deployment baru** → ikon roda gigi → **Aplikasi web**
   - Deskripsi: `Tata Tertib v1`
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
   - Klik **Terapkan** → salin **URL aplikasi web** (berakhiran `/exec`).

> Setiap kali `Code.gs` diubah: **Terapkan → Kelola deployment → ikon pensil → Versi: Versi baru → Terapkan**. URL tetap sama.

## 2. Menghubungkan aplikasi ke server

Buka `js/config.js` dan isi URL tadi:

```js
export const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

Dengan cara ini semua HP otomatis tersambung. (Alternatif tanpa mengubah file: di aplikasi buka **Akun & Aplikasi → Server**, tempel URL, **Uji & simpan** — tetapi hanya berlaku di HP itu.)

Lalu jalankan sekali (perlu [Node.js](https://nodejs.org)):

```
node tools/build-sw.mjs
```

Perintah ini memperbarui daftar file offline di `sw.js`. **Jalankan setiap kali ada file yang diubah.**

## 3. Mengunggah ke GitHub Pages

1. Buat repositori baru di GitHub, mis. `tatib-krisba` (Public).
2. Unggah **seluruh isi folder ini** (termasuk `.nojekyll`) ke repositori: *Add file → Upload files* → seret semua file & folder → *Commit changes*.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
4. Tunggu 1–2 menit. Aplikasi tersedia di `https://NAMA-AKUN.github.io/tatib-krisba/`.

Bagikan alamat itu ke guru (mis. lewat grup WhatsApp). Folder `apps-script`, `tools`, dan `test` ikut terunggah tetapi tidak dipakai di HP.

## 4. Langkah pertama setelah online

1. Buka aplikasi → **Masuk** → pilih **Administrator** → password dari sheet *Pengguna*.
2. **Akun & Aplikasi → Ganti password** (minimal 6 karakter).
3. **Kelola → Pengaturan**: lengkapi identitas sekolah (alamat, NPSN, yayasan), **unggah logo** (untuk kop surat), nama & NIP Kepala Sekolah dan Guru BK, tahun ajaran → **Simpan pengaturan**.
4. **Kelola → Pengguna**: tambahkan akun semua guru. Peran yang tersedia:

| Peran | Mencatat | Ubah/batalkan catatan | Tindak lanjut | Data siswa | Aturan | Pengguna & pengaturan |
|---|---|---|---|---|---|---|
| Guru | ✓ | catatan sendiri, dalam batas jam koreksi (bawaan 24 jam) | – | – | – | – |
| Wali Kelas | ✓ | catatan sendiri | kelasnya saja | – | – | – |
| Guru BK | ✓ | semua catatan | semua kelas | ✓ | – | – |
| Kepala Sekolah | ✓ | semua catatan | semua kelas | – | ✓ | – |
| Admin | ✓ | semua catatan | semua kelas | ✓ | ✓ | ✓ |

5. **Kelola → Siswa → Impor Excel/CSV**: salin tabel siswa dari Excel/Google Sheets (dengan judul kolom **NIS, Nama, Kelas, L/P, Nama Orang Tua, No HP Orang Tua**, dst.), tempel, periksa pratinjau, **Impor**. Bisa juga diketik langsung di sheet **Siswa** (kolom ID boleh kosong — diisi otomatis).

Sekarang guru bisa login dan mencatat.

## 5. Memasang di HP

- **Android (Chrome)**: buka alamat aplikasi → muncul tombol **Pasang** di atas (atau menu ⋮ → *Instal aplikasi* / *Tambahkan ke layar utama*).
- **iPhone (Safari)**: tombol **Bagikan** → **Tambah ke Layar Utama**.

Setelah dibuka sekali saat online, aplikasi bisa dibuka tanpa internet. Login guru juga bisa offline (akun diunduh saat sinkron pertama).

## 6. Cara kerja sehari-hari

- **Catat pelanggaran** (tombol hijau **+**): pilih satu atau beberapa siswa → pilih bentuk pelanggaran (bisa lebih dari satu) → isi detail kejadian (lokasi, kronologi, saksi, pelapor, tindakan langsung) → periksa **dampak poin** → **Simpan**. Setelah itu bisa langsung **Cetak BAP** atau **kabari orang tua via WhatsApp**.
- **Salah input?** Buka catatan → **Ubah** atau **Batalkan** (wajib alasan). Sesuai tata tertib, poin yang sah tidak bisa dikurangi; pembatalan hanya untuk koreksi, dan catatan tetap tersimpan sebagai riwayat. Lewat batas jam koreksi, hanya Guru BK/Kepala Sekolah/Admin yang bisa mengubah.
- **Tindak Lanjut**: setiap siswa yang mencapai suatu tahap otomatis muncul di menu Tindak Lanjut. Wali Kelas/Guru BK menandai status, nomor surat (dibuat otomatis), dan mencetak surat: **SP 1 + Surat Komitmen**, **SP 2 + Panggilan Orang Tua**, **SP 3 + Skorsing**, **Surat Perjanjian bermaterai**, **Surat Pengembalian kepada Orang Tua**.
- **Dasbor, Siswa, Kelas, Riwayat, Laporan, Tata Tertib** dapat dibuka siapa saja yang memiliki alamat aplikasi. Laporan bisa **dicetak/disimpan PDF** atau **diunduh CSV** (dibuka di Excel).
- **Status sinkron** ada di kanan atas: *Tersinkron*, *N tertunda*, *Offline*, atau *Perlu dicek*. Ketuk untuk melihat detail di **Akun & Aplikasi**.

## 7. Spreadsheet

| Sheet | Isi | Boleh diedit langsung? |
|---|---|---|
| Pengguna | username, nama, **password**, peran, kelas wali | Ya (cara utama mengatur password). Jangan bagikan spreadsheet ke siswa. |
| Pengaturan | identitas sekolah, batas jam koreksi, batas sidang, akses dasbor | Ya |
| Kategori, Jenis Pelanggaran, Tahap Sanksi | aturan | Ya (atau lewat aplikasi: Kelola) |
| Siswa | data siswa | Ya |
| Catatan Pelanggaran | semua pelanggaran | Sebaiknya lewat aplikasi. Bila diedit di sheet, perubahan tetap ikut ke HP. **Jangan ubah/hapus kolom `_rev` dan `ID`.** |
| Tindak Lanjut | status SP/panggilan | Sebaiknya lewat aplikasi |
| Log Aktivitas | jejak siapa mengubah apa | Hanya dibaca |
| Rekap Poin Siswa | rumus otomatis total poin per siswa | Jangan diketik |

Menu **Tata Tertib → Siapkan / perbaiki sheet** di spreadsheet aman dijalankan ulang (hanya melengkapi kolom/sheet yang hilang).

## 8. Memperbarui aplikasi (tombol Update)

1. Ubah file yang perlu.
2. Naikkan nomor di `version.json`, mis. `"version": "1.0.1"` dan tulis catatannya.
3. Jalankan `node tools/build-sw.mjs`.
4. Unggah file yang berubah ke GitHub (termasuk `sw.js`, `version.json`, `js/config.js`).

Di HP pengguna akan muncul tulisan **"Versi baru tersedia — Perbarui"** (atau lewat **Akun & Aplikasi → Periksa pembaruan**). Data di HP tetap aman.

## 9. Keamanan & privasi

- Password **tidak pernah** dikirim ke HP. HP hanya menyimpan *hash* (SHA-256, 200 putaran) untuk login offline; setiap perubahan data diperiksa lagi oleh server (token login + hak peran). Gunakan password yang tidak mudah ditebak (bukan tanggal lahir/1234).
- Bila password seorang guru diganti, HP lama otomatis diminta login ulang; catatan yang belum terkirim **tidak hilang**.
- Dasbor bawaan bersifat **publik** (sesuai permintaan). Bila sekolah ingin data siswa hanya terlihat oleh guru: **Kelola → Pengaturan → Akses dasbor → Login**.
- Jangan membagikan spreadsheet atau URL Apps Script ke siswa.

## 10. Catatan penafsiran aturan (mohon dicek sekolah)

Aturan bawaan diambil dari *TATA TERTIB SMP KRISTEN BASAAN 2026.pdf*. Ada beberapa hal yang perlu keputusan sekolah — semuanya bisa diubah di **Kelola → Tahap Sanksi / Jenis Pelanggaran** tanpa mengubah kode:

1. **Rentang tahap berlubang** (10–20, 30–40, 50–60, …). Aplikasi memakai **batas bawah**: 10–29 Peringatan Lisan, 30–49 SP 1, 50–69 SP 2, 70–89 SP 3, 90–99 Peringatan Keras, ≥100 Dikeluarkan. Akumulasi 1–9 poin belum ada tindakan.
2. **Contoh kasus Budi** di dokumen menyebut 20 poin = SP 1, padahal tabel menyebut 30–40 = SP 1. Aplikasi mengikuti **tabel**.
3. Contoh yang sama memberi *berkelahi* 50 poin, sedangkan tabel butir 38 = **70 poin**. Aplikasi mengikuti **tabel**.
4. Butir 33 dan 45 bernilai **90–100**: guru memilih angkanya saat mencatat.
5. Belum ada butir yang ditandai **Zero Tolerance** (langsung 100 poin). Admin bisa menandai butir mana saja.
6. "Sidang Dewan Guru untuk pelanggaran di atas 50 poin": aplikasi menandai siswa dengan **akumulasi > 50** (angka bisa diubah di Pengaturan → *batasSidang*).

## 11. Untuk pengembang

```
npm test                 # 22 uji unit (logika poin, statistik, SHA-256, Code.gs lewat tiruan Apps Script)
node tools/e2e.mjs       # 15 uji end-to-end di Chrome headless (offline, sinkron, 2 HP, update)
node tools/serve.mjs     # coba di komputer: http://localhost:8080 (+ server tiruan di /gas/exec)
node tools/make-icons.mjs  # buat ulang ikon
```

Kode tanpa build step (ES modules). Logika murni di `js/core/`, penyimpanan & sinkron di `js/store.js`, `js/sync.js`, `js/db.js`, halaman di `js/pages/`, komponen di `js/ui/`.

## 12. Pemecahan masalah

| Gejala | Solusi |
|---|---|
| "Server membalas halaman HTML" | Deployment Apps Script belum "Siapa saja", atau URL bukan yang berakhiran `/exec`. |
| Daftar guru kosong di halaman Masuk | HP belum pernah sinkron. Sambungkan internet → **Akun & Aplikasi → Unduh ulang semua data**. |
| "Perlu dicek" / perubahan ditolak | Buka **Akun & Aplikasi → Sinkronisasi**: lihat alasan, lalu *Coba kirim ulang* atau *Buang*. |
| Jam di sheet selisih 1 jam | Zona waktu spreadsheet belum Makassar (langkah 1.2). |
| Logo tidak muncul di surat | Unggah ulang di Kelola → Pengaturan (maks. ±35 KB setelah diperkecil otomatis). |
| Ingin mencoba tanpa server | Di dasbor pilih **Coba Mode Demo** (data rekaan, password `demo123`). Keluar lewat Akun & Aplikasi. |
