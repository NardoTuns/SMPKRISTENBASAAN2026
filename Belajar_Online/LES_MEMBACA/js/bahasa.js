/* Baca Ceria — aturan bahasa Indonesia sederhana.
   Dipakai oleh aplikasi DAN oleh tools/buat_suara.py (lewat Node.js), jadi jangan dihapus.
     pecah(kata)       : memenggal kata menjadi suku kata   ("kucing" → ["ku", "cing"])
     kalimat(teks)     : memecah kalimat menjadi kata-kata  ("Ini bola." → ini | bola.)
     daftarSuara(data) : daftar semua rekaman suara yang dibutuhkan aplikasi */
(function (root) {
  'use strict';

  const VOKAL = 'aiueo';
  const DIGRAF = ['ng', 'ny', 'kh', 'sy'];     // dua huruf, satu bunyi
  const DIFTONG = ['ai', 'au', 'oi', 'ei'];    // hanya di akhir kata: pantai, harimau

  /* Mesin suara membaca beberapa suku kata sebagai singkatan (mis. "ri" → "er-i", "ma" → "em-a",
     "vi" → "enam"). Suku kata ini direkam dari teks pengganti; bila suku katanya berakhir vokal,
     rekaman dipotong tepat di akhir vokal oleh tools/buat_suara.py sehingga terdengar "ma", "ri", dst. */
  const REKAM_SUKU = {
    ma: 'mak', mu: 'muk', bi: 'bik', pu: 'puk', ta: 'tak', ka: 'kak', ko: 'kok', nu: 'nuk', ri: 'rik',
    ja: 'jak', ha: 'hak', hi: 'hik', hu: 'huk', ci: 'cik', fa: 'fak', fo: 'fok', va: 'vak', vi: 'vik',
    wo: 'wol', bil: 'bill',
    // suku kata yang vokalnya terdengar berbisik/lemah bila direkam sendirian
    mi: 'mip', pi: 'pih', po: 'poh', tu: 'tuh', to: 'toh', ki: 'kih', ku: 'kus', ke: 'keh', si: 'sih',
    ne: 'nep', ge: 'geh', he: 'hek', cu: 'cup', co: 'coh', fi: 'fih', fu: 'fuh', vu: 'vut', vo: 'voh', ze: 'zek'
  };
  /* Kata yang kurang jelas bila direkam sendirian. ambil: 'awal' = ambil kata pertama dari teks rekaman. */
  const REKAM_KATA = {
    zebra: { t: 'zebra kuda', ambil: 'awal' },  // "zebra" sendirian terdengar berbisik
    ke: { t: 'keh', potong: true }               // "ke" sendirian vokalnya lemah
  };

  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const isVokal = x => (x.length === 1 ? VOKAL.indexOf(x) >= 0 : DIFTONG.indexOf(x) >= 0);

  function satuan(w) {
    const u = [];
    for (let i = 0; i < w.length;) {
      const dua = w.substr(i, 2);
      if (DIGRAF.indexOf(dua) >= 0) { u.push(dua); i += 2; } else { u.push(w[i]); i++; }
    }
    const n = u.length;
    if (n >= 2 && DIFTONG.indexOf(u[n - 2] + u[n - 1]) >= 0 && !(n >= 3 && isVokal(u[n - 3]))) {
      u.splice(n - 2, 2, u[n - 2] + u[n - 1]);
    }
    return u;
  }

  function pecahSatu(w) {
    const u = satuan(w);
    const inti = [];
    u.forEach((x, i) => { if (isVokal(x)) inti.push(i); });
    if (inti.length < 2) return [w];
    const out = [];
    let mulai = 0;
    for (let k = 0; k < inti.length - 1; k++) {
      const a = inti[k], b = inti[k + 1], kons = b - a - 1;
      // V-V: dipisah · V-K-V: konsonan ikut ke belakang · V-K-K(-K)-V: konsonan pertama ikut ke depan
      const potong = kons === 0 ? b : kons === 1 ? b - 1 : a + 2;
      out.push(u.slice(mulai, potong).join(''));
      mulai = potong;
    }
    out.push(u.slice(mulai).join(''));
    return out;
  }

  /* "kupu-kupu" → ["ku","pu","-","ku","pu"].
     Bila pemenggalan otomatis kurang tepat, tulis sendiri di data: suku: "ze-bra" */
  function pecah(kata, atur) {
    if (atur) return String(atur).toLowerCase().split('-');
    const out = [];
    String(kata).toLowerCase().split('-').forEach((bag, i) => {
      if (i) out.push('-');
      out.push.apply(out, pecahSatu(bag.replace(/[^a-z]/g, '')));
    });
    return out;
  }

  function kalimat(teks) {
    return String(teks).trim().split(/\s+/).map(tok => {
      const m = tok.match(/^([("“']*)(.*?)([.,!?;:)"”']*)$/);
      return { pre: m[1], w: m[2], post: m[3], k: slug(m[2]) };
    }).filter(t => t.w);
  }

  function daftarSuara(D) {
    const list = [], ada = {};
    const add = (b, k, t, j, extra) => {
      if (ada[b + '|' + k]) return;
      ada[b + '|' + k] = 1;
      list.push(Object.assign({ b: b, k: k, t: t, j: j }, extra || {}));
    };
    /* Nama huruf direkam dalam kalimat pemandu "Ini huruf A." supaya terdengar jelas.
       ih:a = kalimat utuh; h:a = huruf "A" saja, dipotong dari kalimat itu (ambil kata terakhir). */
    const huruf = h => {
      // koma memberi jeda sebelum huruf; tanpa jeda, desis "f" dari "huruf" menyambung ke H, V, W, Y
      const t = 'Ini huruf, ' + h.toUpperCase() + '.';
      add('huruf', 'ih:' + h, t, 'huruf');
      add('huruf', 'h:' + h, t, 'huruf', { ambil: 'akhir' });
    };
    const suku = s => {
      if (s === '-' || !s) return;
      if (s.length === 1) { huruf(s); return; }
      const ganti = REKAM_SUKU[s];
      add('suku', 's:' + s, ganti || s, 'suku', ganti && VOKAL.indexOf(s[s.length - 1]) >= 0 ? { potong: true } : null);
    };
    const kata = (w, tts) => {
      const k = slug(w), g = REKAM_KATA[k];
      if (g) add('kata', 'k:' + k, g.t, 'kata', g.potong ? { potong: true } : { ambil: g.ambil });
      else add('kata', 'k:' + k, (tts || w).toLowerCase(), 'kata');
    };
    const teks = (k, t) => add('kalimat', k, t, 'kalimat');

    'abcdefghijklmnopqrstuvwxyz'.split('').forEach(huruf);
    D.abjad.forEach(a => { if (a.kata) kata(a.kata, a.tts); });
    D.levels.forEach(lv => {
      if (lv.type === 'suku') lv.kons.split(' ').forEach(c => VOKAL.split('').forEach(v => suku(c + v)));
      (lv.kata || []).forEach(o => { kata(o.w, o.tts); pecah(o.w, o.suku).forEach(suku); });
      if (lv.type === 'cerita') teks('t:' + slug(lv.name), lv.name);
      (lv.kalimat || []).concat(lv.cerita || []).forEach(o => {
        teks('t:' + slug(o.t), o.t);
        kalimat(o.t).forEach(t => kata(t.w));
      });
      (lv.soal || []).forEach(s => {
        add('kalimat', 'q:' + slug(s.q), s.q, 'soal');
        s.a.forEach(a => kata(a.t));
      });
    });
    Object.keys(D.phrases).forEach(k => add('ui', k, D.phrases[k], 'ui'));
    return list;
  }

  root.BC_BAHASA = { VOKAL: VOKAL, slug: slug, pecah: pecah, kalimat: kalimat, daftarSuara: daftarSuara };
})(typeof window !== 'undefined' ? window : globalThis);
