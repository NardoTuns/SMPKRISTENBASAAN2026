/* English Ceria — data kosakata.
   Setiap kata berisi:
     en   : kata bahasa Inggris
     ind  : arti bahasa Indonesia
     ucap : cara membaca (ejaan ala Indonesia, untuk membantu orang tua)
     gambar: e (emoji), color (warna), shape + fill (bentuk), atau num + item (angka)
     tts  : (opsional) teks khusus untuk mesin suara bila pengucapannya bisa keliru
   Setelah menambah/mengubah kata, jalankan:  python tools/buat_suara.py
   agar rekaman suaranya ikut dibuat (lihat README). */
window.EC_DATA = {
  stages: [
    { id: 1, name: "Tahap 1", title: "Pemula", icon: "🌱", color: "#2fb36d", options: 3, pairs: 4 },
    { id: 2, name: "Tahap 2", title: "Penjelajah", icon: "🚀", color: "#3a86ff", options: 4, pairs: 5 },
    { id: 3, name: "Tahap 3", title: "Juara", icon: "🏆", color: "#9b5de5", options: 4, pairs: 6 }
  ],

  levels: [
    { n: 1, stage: 1, icon: "🍎", name: "Buah-buahan", en: "Fruits", color: "#ff595e", words: [
      { en: "Apple", ind: "Apel", ucap: "é-pel", e: "🍎" },
      { en: "Banana", ind: "Pisang", ucap: "be-né-na", e: "🍌" },
      { en: "Orange", ind: "Jeruk", ucap: "o-rinj", e: "🍊" },
      { en: "Grape", ind: "Anggur", ucap: "gréip", e: "🍇" },
      { en: "Watermelon", ind: "Semangka", ucap: "wo-ter-mé-len", e: "🍉" },
      { en: "Mango", ind: "Mangga", ucap: "méng-gou", e: "🥭" },
      { en: "Pineapple", ind: "Nanas", ucap: "pain-é-pel", e: "🍍" },
      { en: "Strawberry", ind: "Stroberi", ucap: "stro-bé-ri", e: "🍓" },
      { en: "Coconut", ind: "Kelapa", ucap: "kou-ke-nat", e: "🥥" },
      { en: "Pear", ind: "Pir", ucap: "pér", e: "🍐" }
    ]},
    { n: 2, stage: 1, icon: "🐱", name: "Hewan Peliharaan", en: "Pets & Farm Animals", color: "#ff924c", words: [
      { en: "Cat", ind: "Kucing", ucap: "két", e: "🐱" },
      { en: "Dog", ind: "Anjing", ucap: "dog", e: "🐶" },
      { en: "Rabbit", ind: "Kelinci", ucap: "ré-bit", e: "🐰" },
      { en: "Fish", ind: "Ikan", ucap: "fisy", e: "🐟" },
      { en: "Bird", ind: "Burung", ucap: "berd", e: "🐦" },
      { en: "Chicken", ind: "Ayam", ucap: "ci-ken", e: "🐔" },
      { en: "Duck", ind: "Bebek", ucap: "dak", e: "🦆" },
      { en: "Cow", ind: "Sapi", ucap: "kau", e: "🐮" },
      { en: "Goat", ind: "Kambing", ucap: "gout", e: "🐐" },
      { en: "Horse", ind: "Kuda", ucap: "hors", e: "🐴" }
    ]},
    { n: 3, stage: 1, icon: "🎨", name: "Warna", en: "Colors", color: "#9b5de5", words: [
      { en: "Red", ind: "Merah", ucap: "réd", color: "#e53935" },
      { en: "Blue", ind: "Biru", ucap: "bluu", color: "#1e88e5" },
      { en: "Yellow", ind: "Kuning", ucap: "yé-lou", color: "#fdd835" },
      { en: "Green", ind: "Hijau", ucap: "griin", color: "#43a047" },
      { en: "Orange", ind: "Oranye", ucap: "o-rinj", color: "#fb8c00" },
      { en: "Purple", ind: "Ungu", ucap: "per-pel", color: "#8e24aa" },
      { en: "Pink", ind: "Merah muda", ucap: "pingk", color: "#f48fb1" },
      { en: "Brown", ind: "Cokelat", ucap: "braun", color: "#795548" },
      { en: "Black", ind: "Hitam", ucap: "blék", color: "#212121" },
      { en: "White", ind: "Putih", ucap: "wait", color: "#ffffff" }
    ]},
    { n: 4, stage: 1, icon: "🔢", name: "Angka", en: "Numbers", color: "#3a86ff", words: [
      { en: "One", ind: "Satu", ucap: "wan", num: 1, item: "🍎" },
      { en: "Two", ind: "Dua", ucap: "tuu", num: 2, item: "🐥" },
      { en: "Three", ind: "Tiga", ucap: "thrii", num: 3, item: "🍓" },
      { en: "Four", ind: "Empat", ucap: "for", num: 4, item: "⭐" },
      { en: "Five", ind: "Lima", ucap: "faiv", num: 5, item: "🎈" },
      { en: "Six", ind: "Enam", ucap: "siks", num: 6, item: "🐟" },
      { en: "Seven", ind: "Tujuh", ucap: "sé-ven", num: 7, item: "🌸" },
      { en: "Eight", ind: "Delapan", ucap: "éit", num: 8, item: "🍪" },
      { en: "Nine", ind: "Sembilan", ucap: "nain", num: 9, item: "🦋" },
      { en: "Ten", ind: "Sepuluh", ucap: "tén", num: 10, item: "🍬" }
    ]},
    { n: 5, stage: 1, icon: "👀", name: "Anggota Tubuh", en: "Body Parts", color: "#ff6fae", words: [
      { en: "Eye", ind: "Mata", ucap: "ai", e: "👁️" },
      { en: "Ear", ind: "Telinga", ucap: "ir", e: "👂" },
      { en: "Nose", ind: "Hidung", ucap: "nouz", e: "👃" },
      { en: "Mouth", ind: "Mulut", ucap: "mauth", e: "👄" },
      { en: "Tooth", ind: "Gigi", ucap: "tuuth", e: "🦷" },
      { en: "Tongue", ind: "Lidah", ucap: "tang", e: "👅" },
      { en: "Face", ind: "Wajah", ucap: "féis", e: "🙂" },
      { en: "Hand", ind: "Tangan", ucap: "hénd", e: "✋" },
      { en: "Finger", ind: "Jari", ucap: "fing-ger", e: "☝️" },
      { en: "Arm", ind: "Lengan", ucap: "arm", e: "💪" },
      { en: "Foot", ind: "Kaki", ucap: "fut", e: "🦶" }
    ]},
    { n: 6, stage: 1, icon: "👪", name: "Keluarga", en: "Family", color: "#f15bb5", words: [
      { en: "Family", ind: "Keluarga", ucap: "fé-me-li", e: "👪" },
      { en: "Father", ind: "Ayah", ucap: "fa-dher", e: "👨" },
      { en: "Mother", ind: "Ibu", ucap: "ma-dher", e: "👩" },
      { en: "Brother", ind: "Saudara laki-laki", ucap: "bra-dher", e: "👦" },
      { en: "Sister", ind: "Saudara perempuan", ucap: "sis-ter", e: "👧" },
      { en: "Grandfather", ind: "Kakek", ucap: "grénd-fa-dher", e: "👴" },
      { en: "Grandmother", ind: "Nenek", ucap: "grénd-ma-dher", e: "👵" },
      { en: "Baby", ind: "Bayi", ucap: "béi-bi", e: "👶" },
      { en: "Friend", ind: "Teman", ucap: "frénd", e: "👫" }
    ]},
    { n: 7, stage: 1, icon: "🦁", name: "Hewan Liar", en: "Wild Animals", color: "#f4a261", words: [
      { en: "Lion", ind: "Singa", ucap: "lai-en", e: "🦁" },
      { en: "Tiger", ind: "Harimau", ucap: "tai-ger", e: "🐯" },
      { en: "Elephant", ind: "Gajah", ucap: "é-li-fent", e: "🐘" },
      { en: "Monkey", ind: "Monyet", ucap: "mang-ki", e: "🐵" },
      { en: "Giraffe", ind: "Jerapah", ucap: "je-réf", e: "🦒" },
      { en: "Zebra", ind: "Zebra", ucap: "zii-bre", e: "🦓" },
      { en: "Bear", ind: "Beruang", ucap: "bér", e: "🐻" },
      { en: "Snake", ind: "Ular", ucap: "snéik", e: "🐍" },
      { en: "Crocodile", ind: "Buaya", ucap: "kro-ke-dail", e: "🐊" },
      { en: "Rhino", ind: "Badak", ucap: "rai-nou", e: "🦏" }
    ]},
    { n: 8, stage: 1, icon: "🍞", name: "Makanan & Minuman", en: "Food & Drinks", color: "#e76f51", words: [
      { en: "Rice", ind: "Nasi", ucap: "rais", e: "🍚" },
      { en: "Bread", ind: "Roti", ucap: "bréd", e: "🍞" },
      { en: "Egg", ind: "Telur", ucap: "ég", e: "🥚" },
      { en: "Milk", ind: "Susu", ucap: "milk", e: "🥛" },
      { en: "Water", ind: "Air", ucap: "wo-ter", e: "💧" },
      { en: "Cake", ind: "Kue", ucap: "kéik", e: "🍰" },
      { en: "Ice cream", ind: "Es krim", ucap: "ais kriim", e: "🍦" },
      { en: "Noodles", ind: "Mi", ucap: "nuu-delz", e: "🍜" },
      { en: "Candy", ind: "Permen", ucap: "kén-di", e: "🍬" },
      { en: "Cookie", ind: "Biskuit", ucap: "ku-ki", e: "🍪" }
    ]},

    { n: 9, stage: 2, icon: "🥕", name: "Sayuran", en: "Vegetables", color: "#52b788", words: [
      { en: "Carrot", ind: "Wortel", ucap: "ké-ret", e: "🥕" },
      { en: "Corn", ind: "Jagung", ucap: "korn", e: "🌽" },
      { en: "Tomato", ind: "Tomat", ucap: "te-méi-tou", e: "🍅" },
      { en: "Potato", ind: "Kentang", ucap: "pe-téi-tou", e: "🥔" },
      { en: "Broccoli", ind: "Brokoli", ucap: "bro-ke-li", e: "🥦" },
      { en: "Cucumber", ind: "Mentimun", ucap: "kyuu-kam-ber", e: "🥒" },
      { en: "Chili", ind: "Cabai", ucap: "ci-li", e: "🌶️" },
      { en: "Eggplant", ind: "Terong", ucap: "ég-plént", e: "🍆" },
      { en: "Mushroom", ind: "Jamur", ucap: "masy-ruum", e: "🍄" },
      { en: "Lettuce", ind: "Selada", ucap: "lé-tis", e: "🥬" }
    ]},
    { n: 10, stage: 2, icon: "🧸", name: "Mainan", en: "Toys", color: "#ffb703", words: [
      { en: "Ball", ind: "Bola", ucap: "bol", e: "⚽" },
      { en: "Teddy bear", ind: "Boneka beruang", ucap: "té-di bér", e: "🧸" },
      { en: "Balloon", ind: "Balon", ucap: "be-luun", e: "🎈" },
      { en: "Puzzle", ind: "Teka-teki", ucap: "pa-zel", e: "🧩" },
      { en: "Drum", ind: "Drum", ucap: "dram", e: "🥁" },
      { en: "Robot", ind: "Robot", ucap: "rou-bot", e: "🤖" },
      { en: "Gift", ind: "Hadiah", ucap: "gift", e: "🎁" },
      { en: "Guitar", ind: "Gitar", ucap: "gi-tar", e: "🎸" },
      { en: "Dice", ind: "Dadu", ucap: "dais", e: "🎲" },
      { en: "Trumpet", ind: "Terompet", ucap: "tram-pit", e: "🎺" }
    ]},
    { n: 11, stage: 2, icon: "🚗", name: "Kendaraan", en: "Vehicles", color: "#219ebc", words: [
      { en: "Car", ind: "Mobil", ucap: "kar", e: "🚗" },
      { en: "Bus", ind: "Bus", ucap: "bas", e: "🚌" },
      { en: "Bicycle", ind: "Sepeda", ucap: "bai-si-kel", e: "🚲" },
      { en: "Motorcycle", ind: "Sepeda motor", ucap: "mou-ter-sai-kel", e: "🏍️" },
      { en: "Train", ind: "Kereta api", ucap: "tréin", e: "🚆" },
      { en: "Airplane", ind: "Pesawat terbang", ucap: "ér-pléin", e: "✈️" },
      { en: "Ship", ind: "Kapal", ucap: "syip", e: "🚢" },
      { en: "Boat", ind: "Perahu", ucap: "bout", e: "⛵" },
      { en: "Truck", ind: "Truk", ucap: "trak", e: "🚚" },
      { en: "Helicopter", ind: "Helikopter", ucap: "hé-li-kop-ter", e: "🚁" }
    ]},
    { n: 12, stage: 2, icon: "👕", name: "Pakaian", en: "Clothes", color: "#8338ec", words: [
      { en: "Shirt", ind: "Baju", ucap: "syert", e: "👕" },
      { en: "Pants", ind: "Celana", ucap: "pénts", e: "👖" },
      { en: "Dress", ind: "Gaun", ucap: "drés", e: "👗" },
      { en: "Hat", ind: "Topi", ucap: "hét", e: "👒" },
      { en: "Shoes", ind: "Sepatu", ucap: "syuuz", e: "👟" },
      { en: "Socks", ind: "Kaus kaki", ucap: "soks", e: "🧦" },
      { en: "Glasses", ind: "Kacamata", ucap: "glé-siz", e: "👓" },
      { en: "Jacket", ind: "Jaket", ucap: "jé-kit", e: "🧥" },
      { en: "Gloves", ind: "Sarung tangan", ucap: "glavz", e: "🧤" },
      { en: "Umbrella", ind: "Payung", ucap: "am-bré-la", e: "☂️" }
    ]},
    { n: 13, stage: 2, icon: "🏠", name: "Benda di Rumah", en: "Things at Home", color: "#fb8500", words: [
      { en: "House", ind: "Rumah", ucap: "haus", e: "🏠" },
      { en: "Door", ind: "Pintu", ucap: "dor", e: "🚪" },
      { en: "Sofa", ind: "Sofa", ucap: "sou-fa", e: "🛋️" },
      { en: "Bed", ind: "Tempat tidur", ucap: "béd", e: "🛏️" },
      { en: "Lamp", ind: "Lampu", ucap: "lémp", e: "💡" },
      { en: "Clock", ind: "Jam", ucap: "klok", e: "⏰" },
      { en: "Television", ind: "Televisi", ucap: "té-le-vi-zyen", e: "📺" },
      { en: "Key", ind: "Kunci", ucap: "kii", e: "🔑" },
      { en: "Spoon", ind: "Sendok", ucap: "spuun", e: "🥄" },
      { en: "Broom", ind: "Sapu", ucap: "bruum", e: "🧹" }
    ]},
    { n: 14, stage: 2, icon: "🌈", name: "Alam & Cuaca", en: "Nature & Weather", color: "#06b48a", words: [
      { en: "Sun", ind: "Matahari", ucap: "san", e: "☀️" },
      { en: "Moon", ind: "Bulan", ucap: "muun", e: "🌙" },
      { en: "Star", ind: "Bintang", ucap: "star", e: "⭐" },
      { en: "Cloud", ind: "Awan", ucap: "klaud", e: "☁️" },
      { en: "Rain", ind: "Hujan", ucap: "réin", e: "🌧️" },
      { en: "Rainbow", ind: "Pelangi", ucap: "réin-bou", e: "🌈" },
      { en: "Tree", ind: "Pohon", ucap: "trii", e: "🌳" },
      { en: "Flower", ind: "Bunga", ucap: "flau-er", e: "🌸" },
      { en: "Mountain", ind: "Gunung", ucap: "maun-ten", e: "⛰️" },
      { en: "Sea", ind: "Laut", ucap: "sii", e: "🌊" }
    ]},
    { n: 15, stage: 2, icon: "🔷", name: "Bentuk", en: "Shapes", color: "#ef476f", words: [
      { en: "Circle", ind: "Lingkaran", ucap: "ser-kel", shape: "circle", fill: "#ff595e" },
      { en: "Square", ind: "Persegi", ucap: "skwér", shape: "square", fill: "#1982c4" },
      { en: "Triangle", ind: "Segitiga", ucap: "trai-éng-gel", shape: "triangle", fill: "#8ac926" },
      { en: "Rectangle", ind: "Persegi panjang", ucap: "rék-téng-gel", shape: "rectangle", fill: "#ff924c" },
      { en: "Oval", ind: "Oval", ucap: "ou-vel", shape: "oval", fill: "#6a4c93" },
      { en: "Diamond", ind: "Belah ketupat", ucap: "dai-mend", shape: "diamond", fill: "#ffca3a" },
      { en: "Heart", ind: "Hati", ucap: "hart", shape: "heart", fill: "#ff70a6" }
    ]},
    { n: 16, stage: 2, icon: "🐳", name: "Hewan Laut", en: "Sea Animals", color: "#118ab2", words: [
      { en: "Whale", ind: "Paus", ucap: "wéil", e: "🐳" },
      { en: "Dolphin", ind: "Lumba-lumba", ucap: "dol-fin", e: "🐬" },
      { en: "Shark", ind: "Hiu", ucap: "syark", e: "🦈" },
      { en: "Octopus", ind: "Gurita", ucap: "ok-te-pes", e: "🐙" },
      { en: "Crab", ind: "Kepiting", ucap: "kréb", e: "🦀" },
      { en: "Shrimp", ind: "Udang", ucap: "syrimp", e: "🦐" },
      { en: "Squid", ind: "Cumi-cumi", ucap: "skwid", e: "🦑" },
      { en: "Shell", ind: "Kerang", ucap: "syél", e: "🐚" },
      { en: "Turtle", ind: "Kura-kura", ucap: "ter-tel", e: "🐢" },
      { en: "Pufferfish", ind: "Ikan buntal", ucap: "pa-fer-fisy", e: "🐡" }
    ]},

    { n: 17, stage: 3, icon: "🦋", name: "Hewan Kecil", en: "Small Animals", color: "#7cb518", words: [
      { en: "Butterfly", ind: "Kupu-kupu", ucap: "ba-ter-flai", e: "🦋" },
      { en: "Bee", ind: "Lebah", ucap: "bii", e: "🐝" },
      { en: "Ant", ind: "Semut", ucap: "ént", e: "🐜" },
      { en: "Ladybug", ind: "Kepik", ucap: "léi-di-bag", e: "🐞" },
      { en: "Spider", ind: "Laba-laba", ucap: "spai-der", e: "🕷️" },
      { en: "Caterpillar", ind: "Ulat", ucap: "ké-ter-pi-ler", e: "🐛" },
      { en: "Mosquito", ind: "Nyamuk", ucap: "mes-kii-tou", e: "🦟" },
      { en: "Cricket", ind: "Jangkrik", ucap: "kri-kit", e: "🦗" },
      { en: "Frog", ind: "Katak", ucap: "frog", e: "🐸" },
      { en: "Lizard", ind: "Kadal", ucap: "li-zerd", e: "🦎" }
    ]},
    { n: 18, stage: 3, icon: "🏫", name: "Sekolah", en: "School", color: "#e63946", words: [
      { en: "School", ind: "Sekolah", ucap: "skuul", e: "🏫" },
      { en: "Teacher", ind: "Guru", ucap: "tii-cer", e: "👩‍🏫" },
      { en: "Book", ind: "Buku", ucap: "buk", e: "📖" },
      { en: "Pencil", ind: "Pensil", ucap: "pén-sel", e: "✏️" },
      { en: "Crayon", ind: "Krayon", ucap: "kréi-on", e: "🖍️" },
      { en: "Scissors", ind: "Gunting", ucap: "si-zerz", e: "✂️" },
      { en: "Ruler", ind: "Penggaris", ucap: "ruu-ler", e: "📏" },
      { en: "Bag", ind: "Tas", ucap: "bég", e: "🎒" },
      { en: "Paper", ind: "Kertas", ucap: "péi-per", e: "📄" },
      { en: "Computer", ind: "Komputer", ucap: "kem-pyuu-ter", e: "💻" }
    ]},
    { n: 19, stage: 3, icon: "👩‍⚕️", name: "Profesi", en: "Jobs", color: "#457b9d", words: [
      { en: "Doctor", ind: "Dokter", ucap: "dok-ter", e: "👩‍⚕️" },
      { en: "Police officer", ind: "Polisi", ucap: "pe-liis o-fi-ser", e: "👮" },
      { en: "Firefighter", ind: "Pemadam kebakaran", ucap: "fai-er-fai-ter", e: "👨‍🚒" },
      { en: "Chef", ind: "Koki", ucap: "syéf", e: "👨‍🍳" },
      { en: "Farmer", ind: "Petani", ucap: "far-mer", e: "👩‍🌾" },
      { en: "Pilot", ind: "Pilot", ucap: "pai-let", e: "👨‍✈️" },
      { en: "Singer", ind: "Penyanyi", ucap: "sing-er", e: "👩‍🎤" },
      { en: "Painter", ind: "Pelukis", ucap: "péin-ter", e: "👩‍🎨" },
      { en: "Astronaut", ind: "Astronaut", ucap: "és-tre-not", e: "👨‍🚀" },
      { en: "Builder", ind: "Tukang bangunan", ucap: "bil-der", e: "👷" }
    ]},
    { n: 20, stage: 3, icon: "😊", name: "Perasaan", en: "Feelings", color: "#f4a100", words: [
      { en: "Happy", ind: "Senang", ucap: "hé-pi", e: "😄" },
      { en: "Sad", ind: "Sedih", ucap: "séd", e: "😢" },
      { en: "Angry", ind: "Marah", ucap: "éng-gri", e: "😠" },
      { en: "Scared", ind: "Takut", ucap: "skérd", e: "😨" },
      { en: "Sleepy", ind: "Mengantuk", ucap: "slii-pi", e: "😴" },
      { en: "Sick", ind: "Sakit", ucap: "sik", e: "🤒" },
      { en: "Surprised", ind: "Terkejut", ucap: "ser-praizd", e: "😲" },
      { en: "Tired", ind: "Lelah", ucap: "tai-erd", e: "😫" },
      { en: "Shy", ind: "Malu", ucap: "syai", e: "😳" }
    ]},
    { n: 21, stage: 3, icon: "🏃", name: "Kata Kerja", en: "Actions", color: "#fb5607", words: [
      { en: "Run", ind: "Berlari", ucap: "ran", e: "🏃" },
      { en: "Walk", ind: "Berjalan", ucap: "wok", e: "🚶" },
      { en: "Swim", ind: "Berenang", ucap: "swim", e: "🏊" },
      { en: "Dance", ind: "Menari", ucap: "déns", e: "💃" },
      { en: "Sing", ind: "Bernyanyi", ucap: "sing", e: "🎤" },
      { en: "Sleep", ind: "Tidur", ucap: "sliip", e: "🛌" },
      { en: "Eat", ind: "Makan", ucap: "iit", e: "😋" },
      { en: "Drink", ind: "Minum", ucap: "dringk", e: "🥤" },
      { en: "Read", ind: "Membaca", ucap: "riid", e: "📚", tts: "Reed" },
      { en: "Write", ind: "Menulis", ucap: "rait", e: "✍️" },
      { en: "Draw", ind: "Menggambar", ucap: "dro", e: "🎨" },
      { en: "Cry", ind: "Menangis", ucap: "krai", e: "😭" }
    ]},
    { n: 22, stage: 3, icon: "🆚", name: "Lawan Kata", en: "Opposites", color: "#5a4fcf", words: [
      { en: "Big", ind: "Besar", ucap: "big", e: "🐘" },
      { en: "Small", ind: "Kecil", ucap: "smol", e: "🐭" },
      { en: "Fast", ind: "Cepat", ucap: "fést", e: "🐆" },
      { en: "Slow", ind: "Lambat", ucap: "slou", e: "🐌" },
      { en: "Hot", ind: "Panas", ucap: "hot", e: "🥵" },
      { en: "Cold", ind: "Dingin", ucap: "kould", e: "🥶" },
      { en: "Up", ind: "Atas", ucap: "ap", e: "⬆️" },
      { en: "Down", ind: "Bawah", ucap: "daun", e: "⬇️" },
      { en: "Open", ind: "Terbuka", ucap: "ou-pen", e: "📖" },
      { en: "Closed", ind: "Tertutup", ucap: "klouzd", e: "📕" }
    ]},
    { n: 23, stage: 3, icon: "👋", name: "Sapaan", en: "Greetings", color: "#2a9d8f", words: [
      { en: "Hello", ind: "Halo", ucap: "he-lou", e: ["👋", "😃"] },
      { en: "Goodbye", ind: "Selamat tinggal", ucap: "gud-bai", e: ["👋", "🚶"] },
      { en: "Thank you", ind: "Terima kasih", ucap: "thénk yuu", e: "🙏" },
      { en: "Sorry", ind: "Maaf", ucap: "so-ri", e: "🙇" },
      { en: "Please", ind: "Tolong", ucap: "pliiz", e: "🥺" },
      { en: "Good morning", ind: "Selamat pagi", ucap: "gud mor-ning", e: "🌅" },
      { en: "Good night", ind: "Selamat malam", ucap: "gud nait", e: "🌛" },
      { en: "Yes", ind: "Ya", ucap: "yés", e: "👍" },
      { en: "No", ind: "Tidak", ucap: "nou", e: "👎" },
      { en: "I love you", ind: "Aku sayang kamu", ucap: "ai lav yuu", e: "🥰" }
    ]}
  ],

  /* Kalimat yang direkam untuk instruksi & pujian */
  phrases: {
    hello:        { lang: "en", text: "Hello! Let's learn English!" },
    welcome:      { lang: "id", text: "Halo! Ayo belajar bahasa Inggris bersama!" },
    pilihlevel:   { lang: "id", text: "Pilih level yang kamu suka!" },
    inggrisnya:   { lang: "id", text: "Bahasa Inggrisnya," },
    belajar:      { lang: "id", text: "Ayo belajar kata baru! Dengarkan, lalu tirukan, ya." },
    dengar:       { lang: "id", text: "Dengarkan baik-baik, lalu pilih gambar yang benar!" },
    tebak:        { lang: "id", text: "Lihat gambarnya. Apa bahasa Inggrisnya? Pilih kata yang benar!" },
    memori:       { lang: "id", text: "Buka kartunya, lalu cari pasangan yang cocok!" },
    cobalagi:     { lang: "id", text: "Ayo coba lagi!" },
    selesaibelajar: { lang: "id", text: "Hebat! Kamu sudah belajar semua kata. Sekarang, ayo bermain!" },
    selamat:      { lang: "id", text: "Selamat! Kamu berhasil!" },
    levelbaru:    { lang: "id", text: "Hore! Level baru sudah terbuka!" },
    terkunci:     { lang: "id", text: "Level ini masih terkunci. Selesaikan level sebelumnya dulu, ya!" },
    ucapkan:      { lang: "id", text: "Sekarang, giliran kamu. Ayo ucapkan!" },
    album:        { lang: "id", text: "Ini album stiker kamu! Jawab dengan benar untuk mengumpulkan stiker." },
    great:        { lang: "en", text: "Great job!" },
    excellent:    { lang: "en", text: "Excellent!" },
    welldone:     { lang: "en", text: "Well done!" },
    awesome:      { lang: "en", text: "Awesome!" },
    verygood:     { lang: "en", text: "Very good!" },
    perfect:      { lang: "en", text: "Perfect!" },
    amazing:      { lang: "en", text: "Amazing!" },
    tryagain:     { lang: "en", text: "Try again!" },
    oops:         { lang: "en", text: "Oops! Try again!" },
    goodtry:      { lang: "en", text: "Good try! Listen again." },
    youdidit:     { lang: "en", text: "Yay! You did it!" }
  }
};
