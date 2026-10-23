/* Baca Ceria — isi pelajaran.
   Jenis pelajaran (type):
     huruf   : huruf: "a i u e o"                  → mengenal & menulis huruf
     suku    : kons: "b m" + kata: [...]           → suku kata ba-bi-bu-be-bo, lalu contoh kata
     kata    : kata: [{ w: "buku", e: "📖" }, ...]  → membaca kata bergambar
     kalimat : kalimat: [{ t: "Ini bola.", e: ["⚽"] }, ...]
     cerita  : cerita: [halaman...] + soal: [{ q: "pertanyaan?", a: [jawaban benar, pilihan lain...] }]
   Gambar memakai emoji (e). Untuk beberapa emoji sekaligus tulis sebagai daftar: e: ["👩", "🥛"].
   Suku kata dipenggal otomatis (bo-la, ku-cing). Bila kurang tepat, tulis sendiri: suku: "ze-bra".
   Setelah menambah/mengubah isi, jalankan  python tools/buat_suara.py  agar rekamannya ikut dibuat (lihat README). */
window.BC_DATA = {
  stages: [
    { id: 1, name: "Tahap 1", title: "Kenal Huruf", umur: "3–4 tahun", icon: "🔤", color: "#ff595e", options: 3, pairs: 4 },
    { id: 2, name: "Tahap 2", title: "Suku Kata", umur: "4–5 tahun", icon: "🧩", color: "#ff8c1a", options: 3, pairs: 4 },
    { id: 3, name: "Tahap 3", title: "Membaca Kata", umur: "5 tahun", icon: "📖", color: "#2fb36d", options: 3, pairs: 5 },
    { id: 4, name: "Tahap 4", title: "Kata Lebih Sulit", umur: "5–6 tahun", icon: "🚀", color: "#3a86ff", options: 4, pairs: 6 },
    { id: 5, name: "Tahap 5", title: "Kalimat & Cerita", umur: "6 tahun", icon: "📚", color: "#9b5de5", options: 3, pairs: 5 }
  ],

  // Huruf A–Z beserta contoh kata bergambar
  abjad: [
    { h: "a", kata: "ayam", e: "🐔" },
    { h: "b", kata: "bola", e: "⚽" },
    { h: "c", kata: "cicak", e: "🦎" },
    { h: "d", kata: "domba", e: "🐑" },
    { h: "e", kata: "elang", e: "🦅" },
    { h: "f", kata: "foto", e: "📷" },
    { h: "g", kata: "gajah", e: "🐘" },
    { h: "h", kata: "harimau", e: "🐯" },
    { h: "i", kata: "ikan", e: "🐟" },
    { h: "j", kata: "jeruk", e: "🍊" },
    { h: "k", kata: "kucing", e: "🐱" },
    { h: "l", kata: "lebah", e: "🐝" },
    { h: "m", kata: "mobil", e: "🚗" },
    { h: "n", kata: "nanas", e: "🍍" },
    { h: "o", kata: "ombak", e: "🌊" },
    { h: "p", kata: "pisang", e: "🍌" },
    { h: "q" }, // jarang dipakai dalam bahasa Indonesia
    { h: "r", kata: "rusa", e: "🦌" },
    { h: "s", kata: "sapi", e: "🐮" },
    { h: "t", kata: "topi", e: "🧢" },
    { h: "u", kata: "ular", e: "🐍" },
    { h: "v", kata: "voli", e: "🏐" },
    { h: "w", kata: "wortel", e: "🥕" },
    { h: "x", kata: "xilofon", e: "svg:xilofon", tts: "silofon" },
    { h: "y", kata: "yoyo", e: "🪀" },
    { h: "z", kata: "zebra", e: "🦓", suku: "ze-bra" }
  ],

  levels: [
    // ---------------- Tahap 1: Kenal Huruf ----------------
    { n: 1, stage: 1, type: "huruf", name: "Huruf Vokal", icon: "Aa", color: "#ff595e", huruf: "a i u e o" },
    { n: 2, stage: 1, type: "huruf", name: "Huruf B sampai G", icon: "Bb", color: "#ff8c1a", huruf: "b c d f g" },
    { n: 3, stage: 1, type: "huruf", name: "Huruf H sampai M", icon: "Hh", color: "#f4b400", huruf: "h j k l m" },
    { n: 4, stage: 1, type: "huruf", name: "Huruf N sampai S", icon: "Nn", color: "#58b031", huruf: "n p q r s" },
    { n: 5, stage: 1, type: "huruf", name: "Huruf T sampai Z", icon: "Tt", color: "#1982c4", huruf: "t v w x y z" },

    // ---------------- Tahap 2: Suku Kata ----------------
    { n: 6, stage: 2, type: "suku", name: "Suku Kata B & M", icon: "ba", color: "#6a4c93", kons: "b m", kata: [
      { w: "ibu", e: "👩" }, { w: "bumi", e: "🌍" }, { w: "mama", e: "👩‍👧" }, { w: "bobo", e: "😴" }
    ]},
    { n: 7, stage: 2, type: "suku", name: "Suku Kata P & D", icon: "pa", color: "#ff5fa2", kons: "p d", kata: [
      { w: "padi", e: "🌾" }, { w: "dadu", e: "🎲" }, { w: "papa", e: "👨‍👧" }, { w: "pipi", e: "😊" }
    ]},
    { n: 8, stage: 2, type: "suku", name: "Suku Kata T & K", icon: "ta", color: "#00a6c8", kons: "t k", kata: [
      { w: "kaki", e: "🦶" }, { w: "buku", e: "📖" }, { w: "topi", e: "🧢" }, { w: "bata", e: "🧱" }, { w: "mata", e: "👁️" }
    ]},
    { n: 9, stage: 2, type: "suku", name: "Suku Kata S & N", icon: "sa", color: "#e0479e", kons: "s n", kata: [
      { w: "susu", e: "🥛" }, { w: "nasi", e: "🍚" }, { w: "sapi", e: "🐮" }, { w: "sate", e: "🍢" }
    ]},
    { n: 10, stage: 2, type: "suku", name: "Suku Kata L & R", icon: "la", color: "#2fb36d", kons: "l r", kata: [
      { w: "bola", e: "⚽" }, { w: "roti", e: "🍞" }, { w: "rusa", e: "🦌" }, { w: "lari", e: "🏃" }
    ]},
    { n: 11, stage: 2, type: "suku", name: "Suku Kata G & J", icon: "ga", color: "#ff595e", kons: "g j", kata: [
      { w: "gigi", e: "🦷" }, { w: "jari", e: "☝️" }, { w: "baju", e: "👕" }, { w: "guru", e: "👩‍🏫" }, { w: "keju", e: "🧀" }
    ]},
    { n: 12, stage: 2, type: "suku", name: "Suku Kata H & C", icon: "ha", color: "#ff8c1a", kons: "h c", kata: [
      { w: "hiu", e: "🦈" }, { w: "cuci", e: "🧼" }, { w: "cicak", e: "🦎" }, { w: "hati", e: "❤️" }
    ]},
    { n: 13, stage: 2, type: "suku", name: "Suku Kata W & Y", icon: "wa", color: "#1982c4", kons: "w y", kata: [
      { w: "bayi", e: "👶" }, { w: "yoyo", e: "🪀" }, { w: "buaya", e: "🐊" }, { w: "sawi", e: "🥬" }
    ]},
    { n: 14, stage: 2, type: "suku", name: "Suku Kata F, V & Z", icon: "fa", color: "#6a4c93", kons: "f v z", kata: [
      { w: "sofa", e: "🛋️" }, { w: "foto", e: "📷" }, { w: "voli", e: "🏐" }, { w: "zebra", e: "🦓", suku: "ze-bra" }
    ]},
    { n: 15, stage: 2, type: "suku", name: "Suku Kata NG & NY", icon: "nga", color: "#ff5fa2", kons: "ng ny", kata: [
      { w: "bunga", e: "🌸" }, { w: "singa", e: "🦁" }, { w: "nyanyi", e: "🎤" }, { w: "telinga", e: "👂" }
    ]},

    // ---------------- Tahap 3: Membaca Kata ----------------
    { n: 16, stage: 3, type: "kata", name: "Benda di Sekitarku", icon: "🧸", color: "#00a6c8", kata: [
      { w: "buku", e: "📖" }, { w: "topi", e: "🧢" }, { w: "baju", e: "👕" }, { w: "kado", e: "🎁" },
      { w: "dasi", e: "👔" }, { w: "sofa", e: "🛋️" }, { w: "boneka", e: "🧸" }, { w: "dadu", e: "🎲" }
    ]},
    { n: 17, stage: 3, type: "kata", name: "Hewan", icon: "🐴", color: "#ff8c1a", kata: [
      { w: "kuda", e: "🐴" }, { w: "sapi", e: "🐮" }, { w: "rusa", e: "🦌" }, { w: "kera", e: "🐒" },
      { w: "hiu", e: "🦈" }, { w: "lele", e: "🐟" }, { w: "buaya", e: "🐊" }, { w: "kakatua", e: "🦜" }
    ]},
    { n: 18, stage: 3, type: "kata", name: "Makanan & Minuman", icon: "🍞", color: "#e0479e", kata: [
      { w: "roti", e: "🍞" }, { w: "susu", e: "🥛" }, { w: "nasi", e: "🍚" }, { w: "madu", e: "🍯" },
      { w: "sate", e: "🍢" }, { w: "keju", e: "🧀" }, { w: "kopi", e: "☕" }, { w: "kelapa", e: "🥥" }
    ]},
    { n: 19, stage: 3, type: "kata", name: "Tubuhku", icon: "🦶", color: "#f4b400", kata: [
      { w: "mata", e: "👁️" }, { w: "kaki", e: "🦶" }, { w: "gigi", e: "🦷" }, { w: "jari", e: "☝️" },
      { w: "kuku", e: "💅" }, { w: "pipi", e: "😊" }, { w: "telinga", e: "👂" }
    ]},
    { n: 20, stage: 3, type: "kata", name: "Kendaraan & Alam", icon: "🚲", color: "#2fb36d", kata: [
      { w: "sepeda", e: "🚲" }, { w: "kereta", e: "🚆" }, { w: "perahu", e: "⛵" }, { w: "api", e: "🔥" },
      { w: "bumi", e: "🌍" }, { w: "matahari", e: "☀️" }, { w: "padi", e: "🌾" }, { w: "pelangi", e: "🌈" }
    ]},
    { n: 21, stage: 3, type: "kata", name: "Orang di Sekitarku", icon: "👩‍🏫", color: "#3a86ff", kata: [
      { w: "ibu", e: "👩" }, { w: "guru", e: "👩‍🏫" }, { w: "raja", e: "🤴" }, { w: "ratu", e: "👸" },
      { w: "peri", e: "🧚" }, { w: "koki", e: "👨‍🍳" }, { w: "polisi", e: "👮" }, { w: "petani", e: "👨‍🌾" }
    ]},
    { n: 22, stage: 3, type: "kata", name: "Kata Ulang", icon: "🦋", color: "#9b5de5", kata: [
      { w: "kupu-kupu", e: "🦋" }, { w: "kura-kura", e: "🐢" }, { w: "laba-laba", e: "🕷️" },
      { w: "cumi-cumi", e: "🦑" }, { w: "biri-biri", e: "🐑" }, { w: "lumba-lumba", e: "🐬" }
    ]},

    // ---------------- Tahap 4: Kata Lebih Sulit ----------------
    { n: 23, stage: 4, type: "kata", name: "Akhiran Konsonan", icon: "🐔", color: "#ff595e", kata: [
      { w: "ayam", e: "🐔" }, { w: "ikan", e: "🐟" }, { w: "bebek", e: "🦆" }, { w: "tikus", e: "🐭" },
      { w: "ular", e: "🐍" }, { w: "siput", e: "🐌" }, { w: "apel", e: "🍎" }, { w: "tomat", e: "🍅" }
    ]},
    { n: 24, stage: 4, type: "kata", name: "Bunyi NG & NY", icon: "🌽", color: "#f4b400", kata: [
      { w: "kucing", e: "🐱" }, { w: "bunga", e: "🌸" }, { w: "payung", e: "☂️" }, { w: "jagung", e: "🌽" },
      { w: "hidung", e: "👃" }, { w: "bintang", e: "⭐" }, { w: "nyamuk", e: "🦟" }, { w: "kepiting", e: "🦀" }
    ]},
    { n: 25, stage: 4, type: "kata", name: "Rumah & Sekolah", icon: "🎒", color: "#00a6c8", kata: [
      { w: "mobil", e: "🚗" }, { w: "kapal", e: "🚢" }, { w: "pensil", e: "✏️" }, { w: "tas", e: "🎒" },
      { w: "jam", e: "⏰" }, { w: "sendok", e: "🥄" }, { w: "lampu", e: "💡" }, { w: "gunting", e: "✂️" }
    ]},
    { n: 26, stage: 4, type: "kata", name: "Kata Panjang", icon: "🦒", color: "#2fb36d", kata: [
      { w: "kelinci", e: "🐰" }, { w: "harimau", e: "🐯" }, { w: "semangka", e: "🍉" }, { w: "jerapah", e: "🦒" },
      { w: "kanguru", e: "🦘" }, { w: "pesawat", e: "✈️" }, { w: "kacamata", e: "👓" }, { w: "televisi", e: "📺" }
    ]},

    // ---------------- Tahap 5: Kalimat & Cerita ----------------
    { n: 27, stage: 5, type: "kalimat", name: "Kalimat Pendek", icon: "💬", color: "#ff5fa2", kalimat: [
      { t: "Ini bola.", e: ["⚽"] },
      { t: "Itu kuda.", e: ["🐴"] },
      { t: "Ibu minum susu.", e: ["👩", "🥛"] },
      { t: "Adik makan roti.", e: ["🧒", "🍞"] },
      { t: "Kucing tidur.", e: ["🐱", "💤"] },
      { t: "Ayam makan jagung.", e: ["🐔", "🌽"] },
      { t: "Budi naik sepeda.", e: ["👦", "🚲"] },
      { t: "Ani suka bunga.", e: ["👧", "🌸"] }
    ]},
    { n: 28, stage: 5, type: "kalimat", name: "Kalimat Panjang", icon: "📝", color: "#3a86ff", kalimat: [
      { t: "Kakak membaca buku.", e: ["👧", "📖"] },
      { t: "Ayah pergi naik mobil.", e: ["👨", "🚗"] },
      { t: "Ikan berenang di laut.", e: ["🐟", "🌊"] },
      { t: "Burung terbang tinggi.", e: ["🐦", "☁️"] },
      { t: "Matahari bersinar terang.", e: ["🌞"] },
      { t: "Adik bermain bola.", e: ["🧒", "⚽"] },
      { t: "Nenek menanam bunga.", e: ["👵", "🌷"] },
      { t: "Kami suka makan buah.", e: ["🍎", "🍌", "🍇"] }
    ]},
    { n: 29, stage: 5, type: "cerita", name: "Kiki si Kucing", icon: "🐱", color: "#ff8c1a",
      cerita: [
        { t: "Ini Kiki.", e: ["🐱"] },
        { t: "Kiki suka minum susu.", e: ["🐱", "🥛"] },
        { t: "Kiki main bola.", e: ["🐱", "⚽"] },
        { t: "Kiki lelah, lalu tidur di sofa.", e: ["🐱", "💤", "🛋️"] },
        { t: "Selamat tidur, Kiki!", e: ["🌙", "⭐"] }
      ],
      soal: [
        { q: "Siapa nama kucing itu?", a: [{ t: "Kiki", e: "🐱" }, { t: "Budi", e: "👦" }, { t: "Ani", e: "👧" }] },
        { q: "Kiki suka minum apa?", a: [{ t: "susu", e: "🥛" }, { t: "kopi", e: "☕" }, { t: "air", e: "💧" }] },
        { q: "Kiki tidur di mana?", a: [{ t: "di sofa", e: "🛋️" }, { t: "di mobil", e: "🚗" }, { t: "di pohon", e: "🌳" }] }
      ]
    },
    { n: 30, stage: 5, type: "cerita", name: "Bola Budi", icon: "⚽", color: "#2fb36d",
      cerita: [
        { t: "Budi punya bola.", e: ["👦", "⚽"] },
        { t: "Budi menendang bola.", e: ["👦", "💨", "⚽"] },
        { t: "Bola masuk ke kolam!", e: ["⚽", "💦"] },
        { t: "Bebek membawa bola.", e: ["🦆", "⚽"] },
        { t: "Terima kasih, Bebek!", e: ["👦", "💛", "🦆"] }
      ],
      soal: [
        { q: "Siapa yang punya bola?", a: [{ t: "Budi", e: "👦" }, { t: "Kiki", e: "🐱" }, { t: "Ani", e: "👧" }] },
        { q: "Bola masuk ke mana?", a: [{ t: "kolam", e: "💦" }, { t: "rumah", e: "🏠" }, { t: "sekolah", e: "🏫" }] },
        { q: "Siapa yang membawa bola?", a: [{ t: "bebek", e: "🦆" }, { t: "kucing", e: "🐱" }, { t: "sapi", e: "🐮" }] }
      ]
    },
    { n: 31, stage: 5, type: "cerita", name: "Hujan Turun", icon: "🌧️", color: "#1982c4",
      cerita: [
        { t: "Awan hitam datang.", e: ["🌩️"] },
        { t: "Hujan turun.", e: ["🌧️"] },
        { t: "Ani memakai payung.", e: ["👧", "☂️"] },
        { t: "Katak melompat senang.", e: ["🐸", "💦"] },
        { t: "Hujan berhenti. Ada pelangi!", e: ["🌈", "☀️"] }
      ],
      soal: [
        { q: "Apa yang turun dari langit?", a: [{ t: "hujan", e: "🌧️" }, { t: "bola", e: "⚽" }, { t: "buku", e: "📖" }] },
        { q: "Ani memakai apa?", a: [{ t: "payung", e: "☂️" }, { t: "topi", e: "🧢" }, { t: "sepatu", e: "👟" }] },
        { q: "Apa yang muncul setelah hujan?", a: [{ t: "pelangi", e: "🌈" }, { t: "bulan", e: "🌙" }, { t: "bintang", e: "⭐" }] }
      ]
    },
    { n: 32, stage: 5, type: "cerita", name: "Kebun Kakek", icon: "🌳", color: "#9b5de5",
      cerita: [
        { t: "Dodi pergi ke kebun kakek.", e: ["👦", "👴", "🌳"] },
        { t: "Di kebun ada pohon mangga.", e: ["🌳", "🥭"] },
        { t: "Ada ayam dan sapi juga.", e: ["🐔", "🐮"] },
        { t: "Dodi memetik tomat merah.", e: ["👦", "🍅"] },
        { t: "Kakek tersenyum. Dodi senang!", e: ["👴", "😊", "👦"] }
      ],
      soal: [
        { q: "Dodi pergi ke mana?", a: [{ t: "kebun", e: "🌳" }, { t: "pasar", e: "🛒" }, { t: "pantai", e: "🏖️" }] },
        { q: "Ada pohon apa di kebun?", a: [{ t: "mangga", e: "🥭" }, { t: "kelapa", e: "🥥" }, { t: "pisang", e: "🍌" }] },
        { q: "Dodi memetik apa?", a: [{ t: "tomat", e: "🍅" }, { t: "apel", e: "🍎" }, { t: "jeruk", e: "🍊" }] }
      ]
    }
  ],

  // Kalimat yang dibacakan aplikasi (petunjuk & pujian)
  phrases: {
    halo: "Halo! Aku Lulu si panda.",
    ajak: "Ayo kita belajar membaca bersama!",
    pilih: "Pilih pelajaran yang mau kamu mainkan, ya!",
    terkunci: "Yang ini masih terkunci. Selesaikan pelajaran sebelumnya dulu, ya!",
    kenalhuruf: "Ayo kenalan dengan huruf!",
    belajarsuku: "Ayo belajar suku kata!",
    belajarkata: "Ayo membaca kata!",
    belajarkalimat: "Ayo membaca kalimat bersama!",
    ceritamulai: "Ayo membaca cerita!",
    dengarhuruf: "Dengarkan, lalu pilih huruf yang benar!",
    dengarsuku: "Dengarkan, lalu pilih suku kata yang benar!",
    dengarkata: "Dengarkan, lalu pilih kata yang benar!",
    dengarkalimat: "Dengarkan, lalu pilih kalimat yang benar!",
    bacakata: "Baca katanya, lalu pilih gambar yang cocok!",
    bacakalimat: "Baca kalimatnya, lalu pilih gambar yang cocok!",
    awal: "Huruf apa di awal kata ini?",
    balonhuruf: "Pecahkan balon huruf",
    balonsuku: "Pecahkan balon suku kata",
    susunkata: "Susun suku katanya menjadi kata yang cocok dengan gambar!",
    susunkalimat: "Susun kata-katanya menjadi kalimat yang benar!",
    pasanghuruf: "Cari pasangan huruf besar dan huruf kecil!",
    pasangkata: "Cari pasangan gambar dan katanya!",
    jiplak: "Ayo menulis! Tebalkan hurufnya dengan jarimu.",
    jiplaklagi: "Terus, warnai hurufnya sampai penuh, ya!",
    kuis: "Ayo jawab pertanyaan tentang cerita tadi!",
    abjad: "Ketuk huruf untuk mendengar namanya!",
    album: "Ini album stikermu. Ayo kumpulkan semuanya!",
    hebat: "Hebat!",
    pintar: "Pintar!",
    bagus: "Bagus sekali!",
    luarbiasa: "Luar biasa!",
    keren: "Keren!",
    hore: "Hore, kamu benar!",
    betul: "Betul sekali!",
    cobalagi: "Coba lagi, ya!",
    ups: "Ups, belum tepat. Ayo coba lagi!",
    berhasil: "Hore! Kamu berhasil!",
    bintang: "Selamat, kamu dapat bintang!",
    levelbaru: "Pelajaran baru sudah terbuka!",
    selesaibelajar: "Kamu sudah selesai belajar. Sekarang, ayo bermain!",
    ceritaselesai: "Ceritanya sudah selesai. Ayo jawab pertanyaannya!",
    tulisbagus: "Wah, tulisanmu bagus sekali!"
  }
};
