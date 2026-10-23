/* Baca Ceria — logika aplikasi (JavaScript murni, tanpa framework & tanpa build). */
(function () {
  'use strict';

  const D = window.BC_DATA, B = window.BC_BAHASA;
  const APP_VERSION = '1.0.1';
  const AUDIO_CACHE = 'bc-audio-2';
  const BUNDLES = ['ui', 'huruf', 'suku', 'kata', 'kalimat'];
  const AUDIO_SIZE_MB = 3;
  const READ_FONT = '"Andika", "Century Gothic", "Segoe UI", sans-serif';
  const app = document.getElementById('app');
  if (!D || !D.levels || !B) {
    app.innerHTML = '<div class="boot"><p>Data pelajaran gagal dimuat.<br>Silakan muat ulang halaman.</p></div>';
    return;
  }

  /* ================= Utilitas ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const bounce = el => restart(el, 'boing');

  const ICON = {
    back: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ================= Kegiatan per jenis pelajaran ================= */
  const ACTS = {
    huruf: ['belajar', 'jiplak', 'dengar', 'balon', 'awal', 'pasang'],
    suku: ['belajar', 'dengar', 'balon', 'susun'],
    kata: ['belajar', 'baca', 'dengar', 'susun', 'pasang'],
    kalimat: ['belajar', 'baca', 'dengar', 'susun'],
    cerita: ['belajar', 'kuis', 'susun']
  };
  const ACT_INFO = {
    belajar: { ico: '📖', c: '#3a86ff',
      name: { huruf: 'Kenal Huruf', suku: 'Belajar Suku Kata', kata: 'Belajar Membaca', kalimat: 'Baca Kalimat', cerita: 'Baca Cerita' },
      sub: { huruf: 'Lihat & dengar hurufnya', suku: 'ba – bi – bu – be – bo', kata: 'Baca per suku kata', kalimat: 'Baca bersama-sama', cerita: 'Dengar & baca ceritanya' } },
    jiplak: { ico: '✍️', c: '#ff5fa2', name: 'Menulis Huruf', sub: 'Tebalkan hurufnya' },
    dengar: { ico: '👂', c: '#f72585', name: 'Dengar & Pilih',
      sub: { huruf: 'Pilih huruf yang disebut', suku: 'Pilih suku kata yang disebut', kata: 'Pilih kata yang disebut', kalimat: 'Pilih kalimat yang dibacakan' } },
    balon: { ico: '🎈', c: '#ff8c1a', name: 'Pecah Balon', sub: { huruf: 'Cari huruf yang disebut', suku: 'Cari suku kata yang disebut' } },
    awal: { ico: '🔍', c: '#2fb36d', name: 'Huruf Awal', sub: 'Huruf apa di depan?' },
    pasang: { ico: '🃏', c: '#9b5de5', name: { huruf: 'Kartu Pasangan', kata: 'Kartu Memori' }, sub: { huruf: 'Huruf besar & kecil', kata: 'Gambar & kata' } },
    baca: { ico: '👀', c: '#2fb36d', name: 'Baca & Pilih', sub: 'Baca, lalu pilih gambarnya' },
    susun: { ico: '🧩', c: '#f4a300', name: { suku: 'Susun Kata', kata: 'Susun Kata', kalimat: 'Susun Kalimat', cerita: 'Susun Kalimat' },
      sub: { suku: 'Susun suku katanya', kata: 'Susun suku katanya', kalimat: 'Urutkan kata-katanya', cerita: 'Urutkan kata-katanya' } },
    kuis: { ico: '❓', c: '#f72585', name: 'Kuis Cerita', sub: 'Jawab pertanyaannya' }
  };
  const byType = (v, t) => (v && typeof v === 'object' ? v[t] : v) || '';
  const actInfo = (lv, a) => { const x = ACT_INFO[a]; return { ico: x.ico, c: x.c, name: byType(x.name, lv.type), sub: byType(x.sub, lv.type) }; };

  /* ================= Data ================= */
  const STAGES = {};
  D.stages.forEach(s => { STAGES[s.id] = s; });
  const LEVELS = D.levels;
  const VOKAL = B.VOKAL.split('');
  const ITEMS = {};
  const reg = it => { if (!ITEMS[it.uid]) ITEMS[it.uid] = it; return it; };
  const mkKata = o => reg({ kind: 'kata', w: o.w, e: o.e, tts: o.tts, syl: B.pecah(o.w, o.suku), uid: 'k-' + B.slug(o.w) });
  const mkKalimat = o => reg({ kind: 'kalimat', t: o.t, e: o.e, toks: B.kalimat(o.t), uid: 't-' + B.slug(o.t) });
  const LETTER_COLORS = ['#ff595e', '#ff8c1a', '#e8a700', '#4caf2f', '#00a6c8', '#1982c4', '#6a4c93', '#e0479e', '#ff5fa2', '#2fb36d'];
  const letterColor = h => LETTER_COLORS[(h.charCodeAt(0) - 97) % LETTER_COLORS.length];
  const ABJAD = {};
  const HURUF = D.abjad.map(a => {
    const it = reg({ kind: 'huruf', h: a.h, H: a.h.toUpperCase(), c: letterColor(a.h), uid: 'h-' + a.h });
    if (a.kata) it.word = mkKata({ w: a.kata, e: a.e, tts: a.tts, suku: a.suku });
    ABJAD[a.h] = it;
    return it;
  });
  const sentOK = it => it.toks.length >= 2 && it.toks.length <= 6 && it.toks.every((t, i) => i === it.toks.length - 1 || !t.post);
  function buildPool(lv) {
    if (lv.type === 'kalimat') return lv.items.filter(sentOK);
    if (lv.type === 'cerita') return lv.pages.filter(sentOK);
    return lv.words.filter(w => w.syl.filter(s => s !== '-').length >= 2);
  }
  LEVELS.forEach((lv, i) => {
    lv.idx = i;
    lv.stg = STAGES[lv.stage] || D.stages[0];
    lv.words = [];
    if (lv.type === 'huruf') lv.items = lv.huruf.split(' ').map(h => ABJAD[h]);
    else if (lv.type === 'suku') {
      lv.families = lv.kons.split(' ').map(c => ({ c: c, list: VOKAL.map(v => reg({ kind: 'suku', s: c + v, c: c, v: v, uid: 's-' + c + v })) }));
      lv.items = lv.families.reduce((a, f) => a.concat(f.list), []);
      lv.words = (lv.kata || []).map(mkKata);
    } else if (lv.type === 'kata') {
      lv.items = lv.kata.map(mkKata);
      lv.words = lv.items;
    } else if (lv.type === 'kalimat') lv.items = lv.kalimat.map(mkKalimat);
    else {
      lv.pages = lv.cerita.map(mkKalimat);
      lv.quiz = lv.soal.map(s => ({ q: s.q, a: s.a.map((x, j) => ({ t: x.t, e: x.e, ok: j === 0 })) }));
      lv.items = [reg({ kind: 'cerita', t: lv.name, e: lv.icon, toks: B.kalimat(lv.name), uid: 'c-' + lv.n })];
    }
    lv.acts = ACTS[lv.type].filter(a => (a !== 'susun' || buildPool(lv).length >= 3) && (a !== 'pasang' || lv.items.length >= 3));
  });
  const getLevel = n => LEVELS.find(l => l.n === +n);
  const albumItems = lv => lv.items.concat(lv.type === 'suku' ? lv.words : []);
  const ALBUM_UIDS = Array.from(new Set(LEVELS.reduce((a, lv) => a.concat(albumItems(lv).map(x => x.uid)), [])));
  const KAMUS = (() => {
    const m = {};
    HURUF.forEach(h => { if (h.word) m[h.word.w] = h.word; });
    LEVELS.forEach(lv => lv.words.forEach(w => { if (!m[w.w]) m[w.w] = w; }));
    return Object.keys(m).sort().map(k => m[k]);
  })();
  const PRAISE = ['hebat', 'pintar', 'bagus', 'luarbiasa', 'keren', 'hore', 'betul'];

  /* ================= Penyimpanan kemajuan ================= */
  const Store = {
    KEY: 'bacaCeria.v1',
    d: null,
    defaults() {
      return {
        name: '', seenWelcome: false, start: 1,
        settings: { voice: 'rekaman', guide: true, autoplay: true, sfx: true, rate: 0.9, caps: false, warna: true, unlockAll: false },
        levels: {}, stickers: {}
      };
    },
    load() {
      let d = null;
      try { d = JSON.parse(localStorage.getItem(this.KEY)); } catch (e) { d = null; }
      const def = this.defaults();
      if (!d || typeof d !== 'object') d = def;
      d.settings = Object.assign(def.settings, d.settings || {});
      d.levels = d.levels && typeof d.levels === 'object' ? d.levels : {};
      d.stickers = d.stickers && typeof d.stickers === 'object' ? d.stickers : {};
      if (typeof d.name !== 'string') d.name = '';
      if (!STAGES[d.start]) d.start = 1;
      this.d = d;
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { /* mode privat / penyimpanan penuh */ } },
    lv(n) {
      const r = this.d.levels[n] || (this.d.levels[n] = {});
      r.games = r.games || {};
      return r;
    },
    reset() {
      const keep = { settings: this.d.settings, name: this.d.name, start: this.d.start };
      this.d = Object.assign(this.defaults(), keep, { seenWelcome: true });
      this.save();
    }
  };
  Store.load();
  const applyLook = () => {
    document.body.classList.toggle('caps', !!Store.d.settings.caps);
    document.body.classList.toggle('warna', !!Store.d.settings.warna);
  };
  applyLook();

  const gamesOf = lv => (Store.d.levels[lv.n] && Store.d.levels[lv.n].games) || {};
  const gameActs = lv => lv.acts.filter(a => a !== 'belajar');
  const levelStars = lv => { const g = gamesOf(lv); return gameActs(lv).reduce((m, a) => Math.max(m, g[a] || 0), 0); };
  const levelSum = lv => { const g = gamesOf(lv); return gameActs(lv).reduce((t, a) => t + (g[a] || 0), 0); };
  const levelDone = lv => levelStars(lv) > 0;
  const startIdx = () => { const i = LEVELS.findIndex(l => l.stage >= Store.d.start); return i < 0 ? 0 : i; };
  const isUnlocked = lv => Store.d.settings.unlockAll || lv.idx <= startIdx() || levelDone(LEVELS[lv.idx - 1]);
  const totalStars = () => LEVELS.reduce((t, lv) => t + levelSum(lv), 0);
  const stickerCount = () => ALBUM_UIDS.filter(u => Store.d.stickers[u]).length;
  const collect = it => { if (it && it.uid && !Store.d.stickers[it.uid]) { Store.d.stickers[it.uid] = 1; Store.save(); } };
  const nameSuffix = () => (Store.d.name ? ', ' + esc(Store.d.name) : '');

  /* ================= Efek suara (Web Audio, tanpa file) ================= */
  const Sfx = {
    ctx: null,
    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { try { this.ctx = new AC(); } catch (e) { this.ctx = null; } }
      }
      if (this.ctx && this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { /* abaikan */ } }
    },
    tone(f, t, dur, type, vol, f2) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    },
    play(name) {
      if (!Store.d.settings.sfx) return;
      this.unlock();
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.01;
      try {
        switch (name) {
          case 'tap': this.tone(520, t, 0.08, 'sine', 0.12, 820); break;
          case 'flip': this.tone(380, t, 0.12, 'triangle', 0.12, 900); break;
          case 'ok': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.07, 0.24, 'triangle', 0.16)); break;
          case 'no': this.tone(330, t, 0.16, 'sine', 0.18, 260); this.tone(262, t + 0.16, 0.24, 'sine', 0.18, 190); break;
          case 'match': this.tone(784, t, 0.16, 'triangle', 0.16); this.tone(1175, t + 0.1, 0.3, 'triangle', 0.16); break;
          case 'pop': this.tone(1400, t, 0.05, 'square', 0.07, 300); this.tone(660, t + 0.03, 0.16, 'triangle', 0.16, 1500); break;
          case 'lock': this.tone(220, t, 0.1, 'square', 0.06); this.tone(196, t + 0.11, 0.14, 'square', 0.06); break;
          case 'win':
            [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.11, i === 5 ? 0.6 : 0.2, 'triangle', 0.17));
            [1568, 2093, 2637].forEach((f, i) => this.tone(f, t + 0.75 + i * 0.08, 0.25, 'sine', 0.06));
            break;
        }
      } catch (e) { /* abaikan */ }
    }
  };

  /* ================= Suara: rekaman + cadangan suara perangkat ================= */
  const SILENT_WAV = (() => {
    try {
      const n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
      w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
      return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    } catch (e) { return ''; }
  })();

  /* Menyalakan kata yang sedang dibacakan (karaoke).
     starts = waktu mulai tiap kata dari rekaman; bila tidak ada, diperkirakan dari panjang kata. */
  function karaoke(els, starts, toks, text) {
    let cur = -1;
    const set = i => {
      if (i === cur) return;
      if (els[cur]) els[cur].classList.remove('hl');
      cur = i;
      if (els[i]) els[i].classList.add('hl');
    };
    const lens = toks.map(t => t.w.length + 2), total = lens.reduce((a, b) => a + b, 0);
    const pos = [];
    let p = 0;
    toks.forEach(t => { const i = text.indexOf(t.w, p); const at = i < 0 ? p : i; pos.push(at); p = at + t.w.length; });
    return {
      time(ms, dur) {
        let s = starts && starts.length === els.length ? starts : null;
        if (!s) {
          if (!dur || !isFinite(dur)) return;
          let acc = 0;
          const span = Math.max(1, dur - 250);
          s = lens.map(l => { const v = 80 + acc / total * span; acc += l; return v; });
        }
        let i = 0;
        for (let j = 0; j < s.length; j++) if (ms >= s[j] - 50) i = j;
        set(i);
      },
      char(ci) { let i = 0; for (let j = 0; j < pos.length; j++) if (ci >= pos[j]) i = j; set(i); },
      end() { set(-1); }
    };
  }

  const Voice = {
    el: null, bundles: {}, marks: {}, pending: {}, urls: {}, token: 0, stopper: null, waiting: 0, voices: [], unlocked: false, unlocking: false,
    init() {
      this.el = new Audio();
      this.el.preload = 'auto';
      window.BC_AUDIO = (name, map, extra) => {
        this.bundles[name] = map;
        if (extra && extra.marks) Object.assign(this.marks, extra.marks);
      };
      if ('speechSynthesis' in window) {
        const upd = () => { try { this.voices = speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; } };
        upd();
        try { speechSynthesis.addEventListener('voiceschanged', upd); } catch (e) { speechSynthesis.onvoiceschanged = upd; }
      }
    },
    /* iPhone/Safari: elemen audio harus pernah diputar di dalam sentuhan pengguna. */
    unlock() {
      if (this.unlocked || this.unlocking || !SILENT_WAV || !this.el.paused) return;
      this.unlocking = true;
      const done = ok => { this.unlocking = false; if (ok) this.unlocked = true; };
      try {
        this.el.src = SILENT_WAV;
        const p = this.el.play();
        if (p && p.then) p.then(() => done(true), () => done(false)); else done(true);
      } catch (e) { done(false); }
    },
    load(name) {
      if (this.bundles[name]) return Promise.resolve(true);
      if (!this.pending[name]) {
        this.pending[name] = new Promise(res => {
          const s = document.createElement('script');
          s.src = 'audio/' + name + '.js';
          s.async = true;
          const done = ok => {
            if (!ok) delete this.pending[name];
            s.remove();
            res(ok);
          };
          s.onload = () => done(!!this.bundles[name]);
          s.onerror = () => done(false);
          document.head.appendChild(s);
        });
      }
      return this.pending[name];
    },
    urlFor(b, k) {
      const id = b + '|' + k;
      if (this.urls[id]) return this.urls[id];
      const b64 = this.bundles[b] && this.bundles[b][k];
      if (!b64) return null;
      try {
        const bin = atob(b64), arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        this.urls[id] = URL.createObjectURL(new Blob([arr], { type: 'audio/mpeg' }));
      } catch (e) {
        this.urls[id] = 'data:audio/mpeg;base64,' + b64;
      }
      return this.urls[id];
    },
    stop() {
      this.token++;
      try { this.el.pause(); } catch (e) { /* abaikan */ }
      if (this.stopper) this.stopper();
      if ('speechSynthesis' in window) { try { speechSynthesis.cancel(); } catch (e) { /* abaikan */ } }
      $$('.talk').forEach(e => e.classList.remove('talk'));
      $$('.hl').forEach(e => e.classList.remove('hl'));
    },
    /* Memutar beberapa klip berurutan. Resolve true bila selesai tanpa disela. */
    async seq(clips) {
      this.stop();
      const tok = this.token;
      for (const c of clips) {
        if (!c) continue;
        if (tok !== this.token) return false;
        if (c.el) c.el.classList.add('talk');
        await this.playClip(c, tok);
        if (c.el) c.el.classList.remove('talk');
        if (tok !== this.token) return false;
        await sleep(c.gap != null ? c.gap : 140);
      }
      return tok === this.token;
    },
    play(clip) { return this.seq([clip]); },
    async playClip(c, tok) {
      const useDevice = Store.d.settings.voice === 'perangkat' && this.ttsVoice();
      if (!useDevice) {
        const wait = !this.bundles[c.b];
        if (wait) { this.waiting++; document.body.classList.add('audio-loading'); }
        const ok = await Promise.race([this.load(c.b), sleep(15000).then(() => false)]);
        if (wait) { this.waiting = Math.max(0, this.waiting - 1); if (!this.waiting) document.body.classList.remove('audio-loading'); }
        if (tok !== this.token) return false;
        const url = ok && this.urlFor(c.b, c.k);
        if (url) {
          const r = await this.playUrl(url, c);
          if (r !== 'error') return r === 'ok';
        }
      }
      if (tok !== this.token) return false;
      return this.speak(c);
    },
    playUrl(url, c) {
      return new Promise(res => {
        const a = this.el;
        const kk = c.words && c.toks ? karaoke(c.words, this.marks[c.k], c.toks, c.t) : null;
        let done = false, timer = 0, raf = 0;
        const fin = r => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          cancelAnimationFrame(raf);
          if (kk) kk.end();
          a.onended = a.onerror = null;
          if (this.stopper === stopper) this.stopper = null;
          res(r);
        };
        const stopper = () => fin('stop');
        this.stopper = stopper;
        a.onended = () => fin('ok');
        a.onerror = () => fin('error');
        try { a.src = url; } catch (e) { fin('error'); return; }
        let p;
        try { p = a.play(); } catch (e) { fin('error'); return; }
        if (p && p.then) {
          p.then(() => { this.unlocked = true; },
            err => fin(err && err.name === 'AbortError' ? 'stop' : err && err.name === 'NotAllowedError' ? 'blocked' : 'error'));
        }
        if (kk) {
          const tick = () => { if (done) return; kk.time(a.currentTime * 1000, a.duration * 1000); raf = requestAnimationFrame(tick); };
          raf = requestAnimationFrame(tick);
        }
        timer = setTimeout(() => fin('ok'), 15000);
      });
    },
    ttsVoice() {
      if (!('speechSynthesis' in window)) return null;
      let vs = this.voices;
      if (!vs.length) { try { vs = this.voices = speechSynthesis.getVoices() || []; } catch (e) { vs = []; } }
      const id = vs.filter(v => /^(id|in)([-_]|$)/i.test(v.lang));
      const prefs = [/Gadis/i, /Google/i, /Damayanti/i, /Natural|Online/i];
      for (const p of prefs) { const v = id.find(x => p.test(x.name)); if (v) return v; }
      return id[0] || null;
    },
    speak(c) {
      if (!('speechSynthesis' in window)) return Promise.resolve(false);
      const v = this.ttsVoice();
      if (!v) return Promise.resolve(false); // jangan bacakan bahasa Indonesia dengan suara bahasa lain
      return new Promise(res => {
        const kk = c.words && c.toks ? karaoke(c.words, null, c.toks, c.t) : null;
        let done = false, timer = 0;
        const fin = r => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (kk) kk.end();
          if (this.stopper === stopper) this.stopper = null;
          res(r);
        };
        const stopper = () => fin(false);
        this.stopper = stopper;
        try {
          const u = new SpeechSynthesisUtterance(c.t);
          u.lang = v.lang;
          u.voice = v;
          const base = +Store.d.settings.rate || 0.9;
          u.rate = c.j === 'huruf' || c.j === 'suku' ? base * 0.85 : base;
          if (kk) u.onboundary = e => { if (typeof e.charIndex === 'number') kk.char(e.charIndex); };
          u.onend = () => fin(true);
          u.onerror = () => fin(false);
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
          timer = setTimeout(() => fin(true), 2500 + c.t.length * 170);
        } catch (e) { fin(false); }
      });
    }
  };
  Voice.init();
  const NEEDS = { huruf: ['huruf', 'kata'], suku: ['suku', 'huruf', 'kata'], kata: ['kata', 'suku', 'huruf'], kalimat: ['kalimat', 'kata'], cerita: ['kalimat', 'kata'] };
  const preload = lv => NEEDS[lv.type].forEach(b => Voice.load(b));

  /* ---------- Klip suara ---------- */
  const C = {
    huruf: (h, el) => ({ b: 'huruf', k: 'h:' + h, t: h.toUpperCase(), j: 'huruf', el: el || null }),
    inihuruf: (h, el) => ({ b: 'huruf', k: 'ih:' + h, t: 'Ini huruf, ' + h.toUpperCase() + '.', j: 'ui', el: el || null }),
    suku: (s, el) => (s.length === 1 ? C.huruf(s, el) : { b: 'suku', k: 's:' + s, t: s, j: 'suku', el: el || null }),
    kata: (w, el, tts) => ({ b: 'kata', k: 'k:' + B.slug(w), t: (tts || w).toLowerCase(), j: 'kata', el: el || null }),
    word: (it, el) => C.kata(it.w, el, it.tts),
    kalimat: (it, words, el) => ({ b: 'kalimat', k: 't:' + B.slug(it.t), t: it.t, j: 'kalimat', words: words && words.length ? words : null, toks: it.toks, el: el || null }),
    soal: (q, el) => ({ b: 'kalimat', k: 'q:' + B.slug(q), t: q, j: 'kalimat', el: el || null }),
    ui: name => { const p = D.phrases[name]; return p ? { b: 'ui', k: name, t: p, j: 'ui' } : null; }
  };
  const guide = name => (Store.d.settings.guide ? C.ui(name) : null);
  const praise = () => C.ui(pick(PRAISE));
  const gapped = (c, ms) => Object.assign(c, { gap: ms });
  /* membaca per suku kata: bo… la… bola */
  function sukuClips(it, chips, wordEl) {
    let k = 0;
    const list = [];
    it.syl.forEach(s => { if (s !== '-') list.push(gapped(C.suku(s, chips && chips[k++]), 260)); });
    list.push(C.word(it, wordEl));
    return list;
  }
  /* mengeja: be-o bo, el-a la, bola */
  function ejaClips(it, chips, wordEl) {
    let k = 0;
    const list = [];
    it.syl.forEach(s => {
      if (s === '-') return;
      const el = chips && chips[k++];
      if (s.length > 1) s.split('').forEach(h => list.push(gapped(C.huruf(h, el), 90)));
      list.push(gapped(C.suku(s, el), 420));
    });
    list.push(C.word(it, wordEl));
    return list;
  }
  function itemClips(it, el) {
    if (it.kind === 'huruf') return [C.huruf(it.h, el), it.word ? C.word(it.word) : null];
    if (it.kind === 'suku') return [C.suku(it.s, el)];
    if (it.kind === 'kata') return [C.word(it, el)];
    return [C.kalimat(it, null, el)];
  }

  /* ================= Konfeti ================= */
  const Confetti = {
    cv: null, ctx: null, parts: [], raf: 0, w: 0, h: 0,
    burst(n) {
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const cv = this.cv || (this.cv = document.getElementById('confetti'));
      if (!cv || !cv.getContext) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = window.innerWidth; this.h = window.innerHeight;
      cv.width = this.w * dpr; cv.height = this.h * dpr;
      this.ctx = cv.getContext('2d');
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff70a6', '#ff924c', '#4cc9f0'];
      for (let i = 0; i < (n || 140); i++) {
        this.parts.push({
          x: this.w / 2 + (Math.random() - 0.5) * this.w * 0.5, y: this.h * 0.38,
          vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 15 - 5,
          s: 7 + Math.random() * 8, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
          c: pick(colors), round: Math.random() < 0.3, life: 0
        });
      }
      if (!this.raf) this.raf = requestAnimationFrame(() => this.tick());
    },
    tick() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.w, this.h);
      this.parts = this.parts.filter(p => p.y < this.h + 40 && p.life < 420);
      for (const p of this.parts) {
        p.vy += 0.36; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.283); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (this.parts.length) this.raf = requestAnimationFrame(() => this.tick());
      else { this.raf = 0; ctx.clearRect(0, 0, this.w, this.h); }
    }
  };

  /* ================= Komponen tampilan ================= */
  let toastTimer = 0;
  function toast(msg, ms) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2400);
  }
  function openModal(html, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-bg"><div class="modal ' + (opts.cls || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    const m = root.querySelector('.modal');
    if (opts.dismiss) root.querySelector('.modal-bg').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
    return m;
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
  const modalOpen = () => !!document.querySelector('#modal-root .modal');

  const topbar = (back, title, right) =>
    '<header class="topbar"><a class="btn-round" href="' + back + '" aria-label="Kembali" data-back>' + ICON.back + '</a>' +
    '<h1 class="tb-title">' + title + '</h1><div class="tb-right">' + (right || '') + '</div></header>';
  const starsHTML = n => '<span class="stars" aria-label="' + n + ' bintang">' + [1, 2, 3].map(i => '<i class="' + (i <= n ? 'on' : 'off') + '">★</i>').join('') + '</span>';
  const starPill = () => '<span class="pill" title="Total bintang">⭐ <b>' + totalStars() + '</b></span>';

  /* ---------- Gambar ---------- */
  const SVG = {
    xilofon: '<svg viewBox="0 0 100 100"><path d="M4 37 L96 49 M4 67 L96 57" stroke="#a0642d" stroke-width="5" stroke-linecap="round"/>' +
      '<g stroke="rgba(0,0,0,.2)" stroke-width="1.5">' +
      '<rect x="7" y="29" width="12" height="46" rx="4" fill="#ff595e"/><rect x="22" y="32" width="12" height="40" rx="4" fill="#ff924c"/>' +
      '<rect x="37" y="35" width="12" height="34" rx="4" fill="#ffca3a"/><rect x="52" y="38" width="12" height="28" rx="4" fill="#8ac926"/>' +
      '<rect x="67" y="41" width="12" height="22" rx="4" fill="#1982c4"/><rect x="82" y="44" width="12" height="16" rx="4" fill="#6a4c93"/></g>' +
      '<g fill="#fff" opacity=".85"><circle cx="13" cy="38" r="1.6"/><circle cx="28" cy="40" r="1.6"/><circle cx="43" cy="42" r="1.6"/><circle cx="58" cy="44" r="1.6"/><circle cx="73" cy="46" r="1.6"/><circle cx="88" cy="48" r="1.6"/></g>' +
      '<path d="M26 96 L46 79 M62 97 L74 80" stroke="#a0642d" stroke-width="3.5" stroke-linecap="round"/>' +
      '<circle cx="48" cy="77" r="6" fill="#ff5fa2"/><circle cx="76" cy="77" r="6" fill="#ff5fa2"/></svg>'
  };
  const emo = e => (/^svg:/.test(e) ? '<span class="svgpic">' + (SVG[e.slice(4)] || '') + '</span>' : '<span class="emo">' + e + '</span>');
  function picHTML(e, cls) {
    const many = Array.isArray(e) && e.length > 1;
    const inner = Array.isArray(e) ? (many ? '<span class="scene n' + e.length + '">' + e.map(emo).join('') + '</span>' : emo(e[0])) : emo(e);
    return '<div class="pic' + (many ? ' multi' : '') + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + inner + '</div>';
  }
  /* ---------- Tulisan ---------- */
  function wordHTML(it, cls) {
    let k = 0;
    return '<span class="kata rd' + (cls ? ' ' + cls : '') + '">' + it.syl.map(s => (s === '-' ? '<span class="hy">-</span>' : '<span class="sy s' + (k++ % 2) + '">' + esc(s) + '</span>')).join('') + '</span>';
  }
  const sentHTML = (it, cls) => '<span class="kal rd' + (cls ? ' ' + cls : '') + '">' + it.toks.map(t => '<span class="w">' + esc(t.pre + t.w + t.post) + '</span>').join(' ') + '</span>';
  const hurufHTML = (ch, cls) => '<span class="hf' + (cls ? ' ' + cls : '') + '" style="--hc:' + letterColor(ch.toLowerCase()) + '">' + esc(ch) + '</span>';
  const sukuHTML = it => '<span class="sk rd"><b class="c">' + esc(it.c) + '</b><b class="v">' + esc(it.v) + '</b></span>';
  const iconHTML = lv => (/^[A-Za-z]+$/.test(lv.icon) ? '<span class="ti">' + esc(lv.icon) + '</span>' : '<span class="emo-i">' + lv.icon + '</span>');
  function stickerFace(it) {
    if (it.kind === 'huruf') return hurufHTML(it.H) + hurufHTML(it.h);
    if (it.kind === 'suku') return sukuHTML(it);
    return picHTML(it.e);
  }
  const stickerLabel = it => (it.kind === 'kata' ? it.w : it.kind === 'kalimat' ? it.t : it.kind === 'cerita' ? it.t : '');
  /* kecilkan tulisan bila lebih lebar dari tempatnya (kata panjang seperti "lumba-lumba") */
  function fitWidth(el) {
    if (!el || !el.parentElement) return;
    el.style.fontSize = '';
    const room = el.parentElement.clientWidth - 20, w = el.scrollWidth;
    if (w > room && room > 0) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * room / w) + 'px';
  }

  /* ================= Router ================= */
  const session = { mapIntro: false, intro: {}, albumIntro: false, abjadIntro: false, gate: false };
  let screenId = 0, timers = [], cleanups = [];
  const alive = id => id === screenId;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const onCleanup = fn => cleanups.push(fn);

  const ROUTES = [
    [/^#?\/?$/, Home],
    [/^#\/peta$/, MapScreen],
    [/^#\/level\/(\d+)$/, LevelScreen],
    [/^#\/level\/(\d+)\/([a-z]+)$/, GameScreen],
    [/^#\/abjad$/, Abjad],
    [/^#\/album$/, Album],
    [/^#\/kamus$/, Kamus],
    [/^#\/ortu$/, Parent]
  ];
  function render() {
    timers.forEach(clearTimeout);
    timers = [];
    cleanups.forEach(f => { try { f(); } catch (e) { /* abaikan */ } });
    cleanups = [];
    Voice.stop();
    closeModal();
    screenId++;
    const h = location.hash || '#/';
    for (const r of ROUTES) {
      const m = h.match(r[0]);
      if (m) {
        window.scrollTo(0, 0);
        r[1](app, m, screenId);
        return;
      }
    }
    location.replace('#/');
  }
  function guardLevel(n) {
    const lv = getLevel(n);
    if (!lv) { location.replace('#/peta'); return null; }
    if (!isUnlocked(lv)) { toast('🔒 Pelajaran ' + lv.n + ' masih terkunci'); location.replace('#/peta'); return null; }
    return lv;
  }

  /* ================= Layar: Beranda ================= */
  function Home(root) {
    const d = Store.d;
    const LC = ['#ff595e', '#ff8c1a', '#f4b400', '#4caf2f', '#00a6c8', '#1982c4', '#6a4c93', '#e0479e', '#ff5fa2'];
    const letters = (w, off) => w.split('').map((c, i) => '<span style="--i:' + (i + off) + ';--c:' + LC[(i + off) % LC.length] + '">' + c + '</span>').join('');
    const deco = ['A', 'b', 'C', 'd', 'e', 'K', 'm', 'o'];
    root.innerHTML =
      '<div class="screen home">' +
        '<div class="rainbow" aria-hidden="true"></div>' +
        '<div class="sun" aria-hidden="true">☀️</div>' +
        '<div class="deco" aria-hidden="true">' + deco.map((c, i) => '<span style="--i:' + i + ';--c:' + LC[(i * 2) % LC.length] + '">' + c + '</span>').join('') + '</div>' +
        '<div class="home-top">' +
          '<span class="pill" title="Total bintang">⭐ <b>' + totalStars() + '</b></span>' +
          (installPrompt ? '<button class="pill pill-btn" id="install">📲 Pasang</button>' : '') +
          '<span class="pill" title="Stiker terkumpul">🏅 <b>' + stickerCount() + '</b></span>' +
        '</div>' +
        '<div class="logo" role="img" aria-label="Baca Ceria">' +
          '<div class="logo-1">' + letters('Baca', 0) + '</div>' +
          '<div class="logo-2">Ceria</div>' +
        '</div>' +
        '<p class="tagline">Belajar Membaca untuk Anak 3–6 Tahun</p>' +
        '<button class="mascot" id="mascot" aria-label="Sapa Lulu si panda"><span class="panda">🐼</span>' +
          '<span class="bubble">' + (d.name ? 'Hai, <b>' + esc(d.name) + '</b>! ' : 'Hai! ') + 'Aku Lulu. Ayo belajar membaca! 📚</span></button>' +
        '<button class="btn btn-play" id="play">▶ Mulai</button>' +
        '<nav class="home-menu">' +
          '<a class="btn mini" href="#/abjad" style="--c:#ffd6e7;--sh:#e48cb0">🔤<span>Abjad</span></a>' +
          '<a class="btn mini" href="#/album" style="--c:#ffe59a;--sh:#d9b23c">🏅<span>Album</span></a>' +
          '<a class="btn mini" href="#/kamus" style="--c:#c3f0cf;--sh:#62bf82">📚<span>Kamus</span></a>' +
          '<a class="btn mini" href="#/ortu" style="--c:#cfe3ff;--sh:#7fa7e0">👨‍👩‍👧<span>Orang Tua</span></a>' +
        '</nav>' +
        '<div class="grass" aria-hidden="true"></div>' +
      '</div>';
    $('#play', root).onclick = () => { Sfx.play('tap'); location.hash = '#/peta'; };
    $('#mascot', root).onclick = e => {
      Sfx.play('tap');
      restart(e.currentTarget, 'wiggle');
      Voice.seq([C.ui('halo'), C.ui('ajak')]);
    };
    const ib = $('#install', root);
    if (ib) ib.onclick = doInstall;
    $$('.home-menu a', root).forEach(a => a.addEventListener('click', () => Sfx.play('tap')));
    if (!d.seenWelcome) later(welcomeModal, 500);
  }

  function welcomeModal() {
    const ages = [[1, '3–4 tahun', '🔤 Kenal huruf'], [2, '4–5 tahun', '🧩 Suku kata'], [3, '5–6 tahun', '📖 Membaca kata']];
    const m = openModal(
      '<span class="panda big">🐼</span><h2>Halo! 👋</h2><p>Aku <b>Lulu</b>. Siapa nama kamu?</p>' +
      '<input id="nm" class="input" type="text" maxlength="20" placeholder="Tulis nama…" autocomplete="off">' +
      '<p class="ask"><b>Berapa umur anak?</b><br><span class="small muted">Untuk memilih pelajaran pertama</span></p>' +
      '<div class="age-btns">' + ages.map(a => '<button class="age' + (a[0] === Store.d.start ? ' on' : '') + '" data-s="' + a[0] + '"><b>' + a[1] + '</b><small>' + a[2] + '</small></button>').join('') + '</div>' +
      '<div class="res-btns"><button class="btn btn-green" id="ok">Ayo Mulai! 🎉</button></div>' +
      '<p class="small muted">Nama & umur bisa diubah kapan saja di menu Orang Tua.</p>', { cls: 'welcome' });
    $$('.age', m).forEach(b => { b.onclick = () => { $$('.age', m).forEach(x => x.classList.toggle('on', x === b)); Sfx.play('tap'); }; });
    const done = () => {
      Store.d.name = $('#nm', m).value.trim().slice(0, 20);
      const on = $('.age.on', m);
      Store.d.start = on ? +on.dataset.s : 1;
      Store.d.seenWelcome = true;
      Store.save();
      render();
      Voice.seq([C.ui('halo'), C.ui('ajak')]);
    };
    $('#ok', m).onclick = done;
    $('#nm', m).addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
  }

  /* ================= Layar: Peta belajar ================= */
  function nodeHTML(lv, current, k) {
    const locked = !isUnlocked(lv), x = Math.sin(k * 0.9) * 0.85;
    return '<div class="node-wrap' + (current ? ' current' : '') + '" style="--x:' + x.toFixed(2) + '">' +
      '<button class="node' + (locked ? ' locked' : '') + '" data-n="' + lv.n + '" style="--lc:' + lv.color + '" aria-label="Pelajaran ' + lv.n + ': ' + esc(lv.name) + (locked ? ' (terkunci)' : '') + '">' +
        '<span class="node-ico">' + iconHTML(lv) + '</span>' +
        '<span class="node-num">' + lv.n + '</span>' +
        (locked ? '<span class="lock">🔒</span>' : '') +
      '</button>' +
      '<span class="node-name">' + esc(lv.name) + '</span>' + starsHTML(levelStars(lv)) +
      (current ? '<span class="here' + (x > 0.2 ? ' l' : '') + '" aria-hidden="true">🐼</span>' : '') +
      '</div>';
  }
  function MapScreen(root) {
    const current = LEVELS.find(lv => isUnlocked(lv) && !levelDone(lv)) || null;
    let k = 0;
    root.innerHTML =
      '<div class="screen map">' + topbar('#/', 'Peta Belajar', starPill()) +
      D.stages.map(st => {
        const lvs = LEVELS.filter(l => l.stage === st.id);
        const done = lvs.filter(levelDone).length;
        return '<section class="stage" style="--sc:' + st.color + '">' +
          '<div class="stage-head"><span class="stage-ico">' + st.icon + '</span><div><b>' + st.name + ' · ' + esc(st.title) + '</b>' +
          '<small>Usia ' + st.umur + ' · ' + done + '/' + lvs.length + ' selesai</small></div></div>' +
          '<div class="path">' + lvs.map(lv => nodeHTML(lv, lv === current, k++)).join('') + '</div></section>';
      }).join('') +
      '<p class="hint center">Selesaikan satu permainan untuk membuka pelajaran berikutnya 🔓</p></div>';
    $$('.node', root).forEach(t => {
      t.onclick = () => {
        const lv = getLevel(t.dataset.n);
        if (!isUnlocked(lv)) {
          Sfx.play('lock');
          restart(t, 'shake');
          toast('🔒 Selesaikan pelajaran ' + (lv.n - 1) + ' dulu, ya!');
          Voice.play(guide('terkunci'));
          return;
        }
        Sfx.play('tap');
        location.hash = '#/level/' + lv.n;
      };
    });
    const cur = $('.node-wrap.current', root);
    if (cur && current.idx > 1) later(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    if (!session.mapIntro) { session.mapIntro = true; Voice.play(guide('pilih')); }
  }

  /* ================= Layar: Menu pelajaran ================= */
  function previewChips(lv) {
    if (lv.type === 'huruf') return lv.items.map((it, i) => '<button class="chip" data-i="' + i + '">' + hurufHTML(it.H) + hurufHTML(it.h) + '</button>').join('');
    if (lv.type === 'suku') return lv.items.map((it, i) => '<button class="chip" data-i="' + i + '">' + sukuHTML(it) + '</button>').join('');
    if (lv.type === 'cerita') return lv.pages.map((it, i) => '<button class="chip" data-i="' + i + '">' + picHTML(it.e) + '</button>').join('');
    return lv.items.map((it, i) => '<button class="chip" data-i="' + i + '">' + picHTML(it.e) + '</button>').join('');
  }
  function LevelScreen(root, m) {
    const lv = guardLevel(m[1]);
    if (!lv) return;
    preload(lv);
    const rec = Store.d.levels[lv.n] || {}, g = rec.games || {};
    const intro = { huruf: 'kenalhuruf', suku: 'belajarsuku', kata: 'belajarkata', kalimat: 'belajarkalimat', cerita: 'ceritamulai' }[lv.type];
    root.innerHTML =
      '<div class="screen" style="--lc:' + lv.color + '">' + topbar('#/peta', 'Pelajaran ' + lv.n, starPill()) +
      '<button class="lv-banner" id="banner"><span class="ico">' + iconHTML(lv) + '</span><span class="t"><b>' + esc(lv.name) + '</b><i>' + lv.stg.icon + ' ' + lv.stg.name + ' · ' + lv.stg.umur + '</i></span><span class="spk">🔊</span></button>' +
      '<div class="chips" aria-label="Isi pelajaran">' + previewChips(lv) + '</div>' +
      '<div class="acts n' + lv.acts.length + '">' + lv.acts.map(a => {
        const A = actInfo(lv, a);
        return '<a class="act" href="#/level/' + lv.n + '/' + a + '" style="--ac:' + A.c + '"><span class="a-ico">' + A.ico + '</span><b>' + A.name + '</b><small>' + A.sub + '</small>' +
          (a === 'belajar' ? (rec.learned ? '<span class="done-tag">✔ Sudah</span>' : '<span class="new-tag">Mulai di sini</span>') : starsHTML(g[a] || 0)) + '</a>';
      }).join('') + '</div>' +
      '<p class="hint center">Mulai dari <b>' + actInfo(lv, 'belajar').name + '</b>, lalu mainkan permainannya untuk mendapat bintang ⭐</p>' +
      '</div>';
    const banner = $('#banner', root), chips = $$('.chip', root);
    const src = lv.type === 'cerita' ? lv.pages : lv.items;
    banner.onclick = () => {
      Sfx.play('tap');
      if (lv.type === 'huruf' || lv.type === 'suku') Voice.seq([guide(intro)].concat(src.map((it, i) => gapped(lv.type === 'huruf' ? C.huruf(it.h, chips[i]) : C.suku(it.s, chips[i]), 260))));
      else if (lv.type === 'cerita') Voice.seq([guide(intro), C.kalimat(lv.items[0], null, banner)]);
      else Voice.play(guide(intro));
    };
    chips.forEach((ch, i) => { ch.onclick = () => { bounce(ch); Voice.seq(itemClips(src[i], ch)); }; });
    $$('.act', root).forEach(a => a.addEventListener('click', () => Sfx.play('tap')));
    if (Store.d.settings.autoplay) {
      if (lv.type === 'cerita') Voice.seq([guide(intro), C.kalimat(lv.items[0], null, banner)]);
      else Voice.play(guide(intro));
    }
  }

  function GameScreen(root, m, sid) {
    const lv = guardLevel(m[1]);
    if (!lv) return;
    if (lv.acts.indexOf(m[2]) < 0) { location.replace('#/level/' + lv.n); return; }
    preload(lv);
    const fn = { belajar: LearnScreen, jiplak: TraceGame, balon: BalloonGame, susun: BuildGame, pasang: MemoryGame }[m[2]] || PickGame;
    fn(root, lv, sid, m[2]);
  }

  /* ================= Belajar (kartu) ================= */
  function hurufCard(it) {
    const w = it.word;
    return {
      cls: 'card-huruf',
      html: '<div class="hf-pair" style="--hc:' + it.c + '"><button class="hf-up" id="hu" aria-label="Huruf besar ' + it.H + '">' + it.H + '</button>' +
        '<button class="hf-low" id="hl" aria-label="Huruf kecil ' + it.h + '">' + it.h + '</button></div>' +
        '<div class="hf-cap"><span>huruf besar</span><span>huruf kecil</span></div>' +
        (w ? '<button class="hf-ex" id="ex" aria-label="Contoh kata ' + esc(w.w) + '">' + picHTML(w.e) +
          '<span class="kata rd"><b class="first" style="color:' + it.c + '">' + esc(w.w[0]) + '</b>' + esc(w.w.slice(1)) + '</span></button>'
          : '<p class="rare">Huruf <b>' + it.H + '</b> jarang dipakai dalam bahasa Indonesia 🙂</p>'),
      btns: [['say', '🔊', 'Dengar'], ['tulis', '✍️', 'Tulis']],
      init(el) {
        const hu = $('#hu', el), hl = $('#hl', el), ex = $('#ex', el);
        hu.onclick = () => { bounce(hu); Voice.play(C.huruf(it.h, hu)); };
        hl.onclick = () => { bounce(hl); Voice.play(C.huruf(it.h, hl)); };
        if (ex) ex.onclick = () => { bounce(ex); Voice.seq([C.huruf(it.h, hu), C.word(w, ex)]); };
        const name = Store.d.settings.guide ? C.inihuruf(it.h, hu) : C.huruf(it.h, hu);
        const say = intro => Voice.seq([intro ? guide('kenalhuruf') : null, gapped(name, 350), w ? C.huruf(it.h, hl) : null, w ? C.word(w, ex) : null]);
        return { say: say, act: { say: () => say(false), tulis: () => traceModal(it) } };
      }
    };
  }
  function famCard(f) {
    return {
      cls: 'card-fam',
      html: '<div class="fam-eq rd"><span class="c">' + esc(f.c) + '</span><span class="plus">+</span><span class="v">a i u e o</span></div>' +
        '<div class="fam-grid">' + f.list.map((x, i) => '<button class="fam-sk" data-i="' + i + '" aria-label="' + x.s + '">' + sukuHTML(x) + '</button>').join('') + '</div>' +
        '<p class="tap-hint">Ketuk suku kata untuk mengeja 👆</p>',
      btns: [['all', '🔊', 'Baca Semua']],
      init(el) {
        const bs = $$('.fam-sk', el);
        bs.forEach((b, i) => {
          b.onclick = () => {
            const x = f.list[i];
            restart(b, 'merge');
            Voice.seq(x.c.split('').concat([x.v]).map(h => gapped(C.huruf(h, b), 100)).concat([C.suku(x.s, b)]));
          };
        });
        const all = intro => Voice.seq([intro ? guide('belajarsuku') : null].concat(f.list.map((x, i) => gapped(C.suku(x.s, bs[i]), 380))));
        return { say: all, act: { all: () => all(false) } };
      }
    };
  }
  function wordCard(it, introName) {
    return {
      cls: 'card-kata',
      html: '<button class="flash-pic" id="pic" aria-label="Dengar kata">' + picHTML(it.e) + '</button>' +
        '<div class="word-big" id="wd">' + wordHTML(it) + '</div><p class="tap-hint">Ketuk suku katanya untuk mendengar 👆</p>',
      btns: [['read', '🔊', 'Baca'], ['eja', '🔤', 'Eja']],
      init(el) {
        const wd = $('#wd', el), chips = $$('.sy', wd), pic = $('#pic', el);
        const syl = it.syl.filter(s => s !== '-');
        fitWidth($('.kata', wd));
        chips.forEach((c, i) => { c.onclick = () => { bounce(c); Voice.play(C.suku(syl[i], c)); }; });
        pic.onclick = () => { bounce(pic); Voice.play(C.word(it, wd)); };
        const read = intro => Voice.seq([intro ? guide(introName) : null].concat(sukuClips(it, chips, wd)));
        return { say: read, act: { read: () => read(false), eja: () => Voice.seq(ejaClips(it, chips, wd)) } };
      }
    };
  }
  function sentCard(it, isPage) {
    return {
      cls: isPage ? 'card-kal page' : 'card-kal',
      html: '<button class="scene-box" id="pic" aria-label="Dengarkan">' + picHTML(it.e, 'big') + '</button><div class="sent-big" id="sn">' + sentHTML(it) + '</div>' +
        '<p class="tap-hint">Ketuk kata untuk mendengar 👆</p>',
      btns: [['read', '🔊', 'Baca'], ['slow', '🐢', 'Pelan']],
      init(el) {
        const ws = $$('.w', el);
        ws.forEach((w, i) => { w.onclick = () => { bounce(w); Voice.play(C.kata(it.toks[i].w, w)); }; });
        const read = intro => Voice.seq([intro && !isPage ? guide('belajarkalimat') : null, C.kalimat(it, ws)]);
        $('#pic', el).onclick = () => read(false);
        return { say: read, act: { read: () => read(false), slow: () => Voice.seq(it.toks.map((t, i) => gapped(C.kata(t.w, ws[i]), 330))) } };
      }
    };
  }
  function coverCard(lv) {
    const it = lv.items[0];
    return {
      cls: 'card-cover',
      html: '<div class="cover"><div class="cover-ico">' + emo(lv.icon) + '</div><div class="cover-title">' + sentHTML(it) + '</div>' +
        '<div class="cover-sub">📚 Cerita bergambar · ' + lv.pages.length + ' halaman</div></div>',
      btns: [['read', '🔊', 'Baca Judul']],
      init(el) {
        const ws = $$('.w', el);
        const say = intro => Voice.seq([intro ? guide('ceritamulai') : null, C.kalimat(it, ws)]);
        return { say: say, act: { read: () => say(false) } };
      }
    };
  }
  function learnCards(lv) {
    if (lv.type === 'huruf') return lv.items.map(hurufCard);
    if (lv.type === 'suku') return lv.families.map(famCard).concat(lv.words.map(w => wordCard(w, null)));
    if (lv.type === 'kata') return lv.items.map(w => wordCard(w, 'belajarkata'));
    if (lv.type === 'kalimat') return lv.items.map(it => sentCard(it, false));
    return [coverCard(lv)].concat(lv.pages.map(it => sentCard(it, true)));
  }

  function LearnScreen(root, lv) {
    const cards = learnCards(lv);
    const seen = new Set();
    let i = 0, dir = 0, api = null;
    root.innerHTML =
      '<div class="screen learn t-' + lv.type + '" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, actInfo(lv, 'belajar').name, '<span class="pill" id="cnt"></span>') +
      '<div class="dots" id="dots">' + cards.map(() => '<i></i>').join('') + '</div>' +
      '<div class="learn-main"><div class="flash" id="card"></div></div>' +
      '<div class="learn-ctrl" id="ctrl"></div></div>';
    const card = $('#card', root), ctrl = $('#ctrl', root);

    function show(auto, intro) {
      const c = cards[i];
      seen.add(i);
      card.className = 'flash ' + c.cls;
      if (dir) { void card.offsetWidth; card.classList.add(dir > 0 ? 'in-next' : 'in-prev'); }
      card.innerHTML = c.html;
      const last = i === cards.length - 1;
      ctrl.innerHTML =
        '<button class="btn nav" id="prev" aria-label="Sebelumnya"' + (i === 0 ? ' disabled' : '') + '>' + ICON.prev + '</button>' +
        c.btns.map(b => '<button class="btn ctrl" data-a="' + b[0] + '">' + b[1] + '<span>' + b[2] + '</span></button>').join('') +
        '<button class="btn nav' + (last ? ' done' : '') + '" id="next" aria-label="' + (last ? 'Selesai' : 'Berikutnya') + '">' + (last ? ICON.check : ICON.next) + '</button>';
      api = c.init(card);
      $$('[data-a]', ctrl).forEach(b => { b.onclick = () => api.act[b.dataset.a](); });
      $('#prev', ctrl).onclick = () => go(-1);
      $('#next', ctrl).onclick = () => go(1);
      $('#cnt', root).textContent = (i + 1) + ' / ' + cards.length;
      $$('#dots i', root).forEach((d, k) => { d.className = k === i ? 'on' : seen.has(k) ? 'seen' : ''; });
      if (auto) api.say(!!intro);
    }
    function go(step) {
      if (modalOpen()) return;
      if (step > 0 && i === cards.length - 1) { finish(); return; }
      const ni = i + step;
      if (ni < 0 || ni >= cards.length) return;
      Sfx.play('flip');
      dir = step;
      i = ni;
      show(Store.d.settings.autoplay, false);
    }
    function finish() {
      Store.lv(lv.n).learned = true;
      Store.save();
      if (lv.type === 'cerita') collect(lv.items[0]);
      Sfx.play('win');
      Confetti.burst(150);
      const story = lv.type === 'cerita';
      const m = openModal(
        '<div class="big-emoji">' + (story ? '📚' : '🎉') + '</div><h2>Hebat' + nameSuffix() + '!</h2>' +
        '<p>' + (story ? 'Ceritanya sudah selesai dibaca.' : 'Kamu sudah selesai belajar <b>' + esc(lv.name) + '</b>.') + '</p>' +
        '<p>Sekarang ayo bermain untuk dapat bintang ⭐</p>' +
        '<div class="res-btns">' + gameActs(lv).map(a => {
          const A = actInfo(lv, a);
          return '<a class="btn btn-act" style="--c:' + A.c + '" href="#/level/' + lv.n + '/' + a + '">' + A.ico + ' ' + A.name + '</a>';
        }).join('') + '<button class="btn" id="again">🔁 Ulangi dari awal</button></div>', { cls: 'result' });
      $('#again', m).onclick = () => { closeModal(); i = 0; dir = 0; seen.clear(); show(true, false); };
      Voice.seq([C.ui('berhasil'), guide(story ? 'ceritaselesai' : 'selesaibelajar')]);
    }

    const main = $('.learn-main', root);
    let sx = null, sy = 0;
    main.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    main.addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    const onKey = e => {
      if (modalOpen()) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); api.say(false); }
    };
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));

    const intro = !session.intro[lv.type];
    session.intro[lv.type] = true;
    show(Store.d.settings.autoplay, intro);
  }

  /* ================= Menulis huruf (menebalkan huruf dengan jari) ================= */
  async function fontReady() {
    try {
      if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 100px "Andika"'), sleep(2500)]);
    } catch (e) { /* font cadangan dipakai */ }
  }
  function Tracer(host, ch, color, onDone, onProgress) {
    const N = 150; // resolusi kecil untuk menghitung bagian huruf yang sudah diwarnai
    const size = Math.max(160, Math.floor(Math.min(host.clientWidth, host.clientHeight || host.clientWidth)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = document.createElement('canvas');
    cv.className = 'trace-cv';
    cv.width = cv.height = Math.round(size * dpr);
    cv.style.width = cv.style.height = size + 'px';
    cv.setAttribute('aria-label', 'Tempat menulis huruf ' + ch);
    host.innerHTML = '';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    function place(c, s) { // huruf besar maupun kecil dibuat memenuhi ±70% kotak, tepat di tengah
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.font = '700 100px ' + READ_FONT;
      let m = c.measureText(ch);
      const ink = Math.max(m.actualBoundingBoxLeft + m.actualBoundingBoxRight, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent, 1);
      const px = Math.round(Math.min(s * 1.3, 100 * s * 0.7 / ink));
      c.font = '700 ' + px + 'px ' + READ_FONT;
      m = c.measureText(ch);
      return {
        px: px,
        x: s / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2,
        y: s / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
      };
    }
    const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c.getContext('2d', { willReadFrequently: true }); };
    const mIn = mk(), mOut = mk(), ink = mk();
    let p = place(mIn, N);
    mIn.fillText(ch, p.x, p.y);
    p = place(mOut, N);
    mOut.lineWidth = N * 0.1;
    mOut.lineJoin = 'round';
    mOut.fillText(ch, p.x, p.y);
    mOut.strokeText(ch, p.x, p.y);
    const A = mIn.getImageData(0, 0, N, N).data, O = mOut.getImageData(0, 0, N, N).data;
    const inside = [];
    for (let i = 0; i < N * N; i++) if (A[i * 4 + 3] > 128) inside.push(i);
    const brush = size * 0.1;
    ink.lineCap = ink.lineJoin = 'round';
    ink.lineWidth = brush * N / size;
    ink.strokeStyle = '#000';

    function guideDraw() {
      ctx.clearRect(0, 0, size, size);
      ctx.setLineDash([]);
      ctx.strokeStyle = '#e3ebff';
      ctx.lineWidth = 2;
      [0.2, 0.5, 0.8].forEach(f => { ctx.beginPath(); ctx.moveTo(size * 0.06, size * f); ctx.lineTo(size * 0.94, size * f); ctx.stroke(); });
      const q = place(ctx, size);
      Object.assign(cv.dataset, { px: q.px, x: q.x, y: q.y }); // posisi huruf (dipakai juga untuk uji otomatis)
      ctx.fillStyle = '#f1f4fb';
      ctx.fillText(ch, q.x, q.y);
      ctx.setLineDash([1, size * 0.032]);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(4, size * 0.02);
      ctx.strokeStyle = color;
      ctx.strokeText(ch, q.x, q.y);
      ctx.setLineDash([]);
    }
    guideDraw();

    let drawing = false, last = null, hue = Math.random() * 360, finished = false;
    const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * size / r.width, y: (e.clientY - r.top) * size / r.height }; };
    function seg(a, b) {
      hue = (hue + 3) % 360;
      ctx.strokeStyle = 'hsl(' + hue + ',88%,56%)';
      ctx.lineWidth = brush;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const k = N / size;
      ink.beginPath(); ink.moveTo(a.x * k, a.y * k); ink.lineTo(b.x * k, b.y * k); ink.stroke();
    }
    cv.addEventListener('pointerdown', e => {
      if (finished) return;
      e.preventDefault();
      drawing = true;
      last = pt(e);
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* abaikan */ }
      seg(last, { x: last.x + 0.1, y: last.y });
    });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const q = pt(e);
      seg(last, q);
      last = q;
    });
    const up = () => { if (!drawing) return; drawing = false; check(); };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    function check() {
      const I = ink.getImageData(0, 0, N, N).data;
      let cov = 0, tot = 0, out = 0;
      inside.forEach(i => { if (I[i * 4 + 3] > 0) cov++; });
      for (let i = 0; i < N * N; i++) if (I[i * 4 + 3] > 0) { tot++; if (O[i * 4 + 3] < 60) out++; }
      const ratio = cov / Math.max(1, inside.length);
      if (ratio >= 0.72) {
        finished = true;
        const q = place(ctx, size), g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, color);
        g.addColorStop(1, '#ffb703');
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = g;
        ctx.fillText(ch, q.x, q.y);
        ctx.globalAlpha = 1;
        cv.classList.add('done');
        const r = out / Math.max(1, tot);
        onDone(r < 0.3 ? 3 : r < 0.55 ? 2 : 1);
      } else if (onProgress) onProgress(ratio);
    }
    return { clear() { finished = false; cv.classList.remove('done'); ink.clearRect(0, 0, N, N); guideDraw(); } };
  }

  function TraceGame(root, lv, sid) {
    const seq = [];
    lv.items.forEach(it => { seq.push({ it: it, ch: it.H }); seq.push({ it: it, ch: it.h }); });
    let qi = 0, tr = null, nudged = false, busy = false;
    const scores = [];
    root.innerHTML =
      '<div class="screen trace" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, 'Menulis Huruf', '<span class="pill" id="cnt"></span>') +
      '<div class="dots" id="dots">' + seq.map(() => '<i></i>').join('') + '</div>' +
      '<div class="trace-main"><div class="trace-box" id="box"></div></div>' +
      '<div class="learn-ctrl">' +
        '<button class="btn ctrl" id="clear">🧽<span>Hapus</span></button>' +
        '<button class="btn ctrl" id="say">🔊<span>Dengar</span></button>' +
        '<button class="btn ctrl" id="skip">⏭️<span>Lewati</span></button>' +
      '</div></div>';
    const box = $('#box', root);
    async function showQ(first) {
      const q = seq[qi];
      nudged = false;
      busy = false;
      $('#cnt', root).textContent = (qi + 1) + ' / ' + seq.length;
      $$('#dots i', root).forEach((d, k) => { d.className = k === qi ? 'on' : k < qi ? 'seen' : ''; });
      await fontReady();
      if (!alive(sid)) return;
      tr = Tracer(box, q.ch, q.it.c, done, prog);
      Voice.seq([first ? guide('jiplak') : null, C.huruf(q.it.h)]);
    }
    function prog(r) { if (!nudged && r > 0.3) { nudged = true; Voice.play(guide('jiplaklagi')); } }
    function done(stars) {
      busy = true;
      scores.push(stars);
      collect(seq[qi].it);
      Sfx.play('ok');
      Confetti.burst(50);
      Voice.seq([C.ui(qi % 3 === 2 ? 'tulisbagus' : pick(PRAISE)), C.huruf(seq[qi].it.h)]);
      later(next, 1700);
    }
    function next() {
      qi++;
      if (qi < seq.length) { showQ(false); return; }
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      finishGame(lv, 'jiplak', Math.max(1, Math.round(avg)), 'Huruf yang kamu tulis: <b>' + seq.length + '</b>');
    }
    $('#clear', root).onclick = () => { if (tr && !busy) { Sfx.play('flip'); tr.clear(); } };
    $('#say', root).onclick = () => Voice.play(C.huruf(seq[qi].it.h));
    $('#skip', root).onclick = () => { if (busy) return; busy = true; scores.push(1); next(); };
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (alive(sid) && !busy) tr = Tracer(box, seq[qi].ch, seq[qi].it.c, done, prog); }, 250); };
    window.addEventListener('resize', onResize);
    onCleanup(() => { window.removeEventListener('resize', onResize); clearTimeout(rt); });
    showQ(true);
  }

  async function traceModal(it) {
    const m = openModal(
      '<h2>Ayo menulis <span class="hf-inline" style="color:' + it.c + '">' + it.H + ' ' + it.h + '</span></h2>' +
      '<p class="small muted">Tebalkan hurufnya dengan jari sampai penuh</p>' +
      '<div class="trace-box in-modal" id="mb"></div>' +
      '<div class="res-btns two"><button class="btn" id="mclear">🧽 Hapus</button><button class="btn btn-green" id="mclose">Selesai</button></div>',
      { cls: 'trace-modal' });
    $('#mclose', m).onclick = () => { Voice.stop(); closeModal(); };
    await fontReady();
    if (!m.isConnected) return;
    const box = $('#mb', m);
    let step = 0, tr = null;
    const start = () => {
      tr = Tracer(box, step ? it.h : it.H, it.c, () => {
        Sfx.play('ok');
        Voice.seq([praise(), C.huruf(it.h)]);
        if (step === 0) setTimeout(() => { if (m.isConnected) { step = 1; start(); } }, 1400);
        else Confetti.burst(90);
      });
    };
    start();
    Voice.seq([guide('jiplak'), C.huruf(it.h)]);
    $('#mclear', m).onclick = () => { if (tr) tr.clear(); };
  }

  /* ================= Hasil permainan ================= */
  const starsFor = (mistakes, a, b) => (mistakes <= a ? 3 : mistakes <= b ? 2 : 1);
  function finishGame(lv, game, stars, detail) {
    const rec = Store.lv(lv.n);
    const next = LEVELS[lv.idx + 1];
    const wasOpen = next ? isUnlocked(next) : true;
    const prevBest = rec.games[game] || 0;
    rec.games[game] = Math.max(prevBest, stars);
    Store.save();
    const newOpen = !!next && !wasOpen && isUnlocked(next);
    const titles = ['', 'Bagus', 'Hebat', 'Luar Biasa'];
    Sfx.play('win');
    Confetti.burst(60 + stars * 50);
    const nextBtn = next && isUnlocked(next) ? '<a class="btn btn-green" href="#/level/' + next.n + '">▶ Lanjut ke Pelajaran ' + next.n + '</a>' : '';
    const m = openModal(
      '<div class="res-stars">' + [1, 2, 3].map(k => '<span class="rs' + (k <= stars ? ' on' : '') + '" style="--d:' + k + '">★</span>').join('') + '</div>' +
      '<h2>' + titles[stars] + nameSuffix() + '!</h2><p>' + detail + '</p>' +
      (prevBest && stars > prevBest ? '<p class="small">🏅 Rekor baru!</p>' : '') +
      (newOpen ? '<div class="unlock">🔓 Pelajaran baru terbuka!<br><b>Pelajaran ' + next.n + ': ' + esc(next.name) + '</b></div>' : '') +
      '<div class="res-btns">' + (newOpen ? nextBtn : '') +
        '<button class="btn btn-orange" id="again">🔁 Main Lagi</button>' +
        '<a class="btn" href="#/level/' + lv.n + '">🎮 Pilih Permainan Lain</a>' +
        (newOpen ? '' : nextBtn) +
      '</div>', { cls: 'result' });
    $('#again', m).onclick = render;
    Voice.seq([C.ui('berhasil'), guide('bintang'), newOpen ? guide('levelbaru') : null]);
  }

  /* ================= Permainan pilihan ganda ================= */
  function qList(items, min, max) {
    let qs = shuffle(items.slice());
    while (qs.length < min && items.length > 1) {
      const more = shuffle(items.slice());
      if (more[0] === qs[qs.length - 1]) more.push(more.shift());
      qs = qs.concat(more);
    }
    return qs.slice(0, max);
  }
  const others = (pool, q, n) => shuffle(pool.filter(x => x !== q)).slice(0, Math.max(0, n));

  function pickSpec(lv, mode) {
    const t = lv.type, n = lv.stg.options;
    if (mode === 'kuis') {
      return {
        qs: lv.quiz.slice(), layout: 'answers',
        options: q => shuffle(q.a.slice()),
        prompt: q => '<button class="btn speaker" id="spk" aria-label="Dengar pertanyaan">🔊</button><div class="q-text rd">' + esc(q.q) + '</div>',
        option: o => picHTML(o.e) + '<span class="lab rd">' + esc(o.t) + '</span>',
        say: (q, first, P) => Voice.seq([first ? guide('kuis') : null, C.soal(q.q, $('#spk', P))]),
        isRight: o => o.ok,
        right: (q, o, b) => [C.kata(o.t, b)],
        wrong: (q, P) => [C.soal(q.q, $('#spk', P))],
        item: () => null,
        done: () => collect(lv.items[0])
      };
    }
    if (mode === 'baca') {
      const pool = lv.items, word = t === 'kata';
      return {
        qs: qList(pool, 6, 8), layout: 'pics',
        options: q => shuffle([q].concat(others(pool, q, n - 1))),
        prompt: q => '<div class="read-box">' + (word ? wordHTML(q, 'xl') : sentHTML(q, 'xl')) + '</div><button class="btn help" id="help">💡 Bantu baca</button>',
        bind: (q, P) => {
          if (word) fitWidth($('.kata', P));
          $('#help', P).onclick = () => Voice.seq(word ? sukuClips(q, $$('.sy', P), $('.kata', P)) : [C.kalimat(q, $$('.w', P))]);
        },
        option: o => picHTML(o.e),
        say: (q, first) => { if (first) Voice.play(guide(word ? 'bacakata' : 'bacakalimat')); else Voice.stop(); },
        isRight: (o, q) => o === q,
        right: (q, o, b, P) => (word ? [C.word(q, $('.kata', P))] : [C.kalimat(q, $$('.w', P))]),
        wrong: () => [],
        item: q => q
      };
    }
    if (mode === 'awal') {
      const pool = lv.items.filter(x => x.word);
      const caps = () => Store.d.settings.caps;
      return {
        qs: qList(pool, 5, 8), layout: 'tiles',
        options: q => shuffle([q].concat(others(pool.length >= n ? pool : HURUF.filter(h => h.word), q, n - 1))),
        prompt: q => '<div class="awal-box"><button class="awal-pic" id="ap" aria-label="Dengar kata">' + picHTML(q.word.e) + '</button>' +
          '<div class="kata rd awal-word"><span class="blank" id="bl">?</span>' + esc(q.word.w.slice(1)) + '</div></div>' +
          '<div class="q-text">Huruf apa di awal kata ini? 🤔</div>',
        bind: (q, P) => { const ap = $('#ap', P); ap.onclick = () => { bounce(ap); Voice.play(C.word(q.word, ap)); }; },
        option: o => hurufHTML(caps() ? o.H : o.h),
        say: (q, first, P) => Voice.seq([first ? guide('awal') : null, C.word(q.word, $('#ap', P))]),
        reveal: (q, P) => { const bl = $('#bl', P); bl.textContent = q.word.w[0]; bl.classList.add('filled'); },
        isRight: (o, q) => o === q,
        right: (q, o, b, P) => [C.huruf(q.h, b), C.word(q.word, $('.awal-word', P))],
        wrong: (q, P) => [C.word(q.word, $('#ap', P))],
        item: q => q
      };
    }
    // dengar: dengarkan suaranya, lalu pilih tulisan yang benar
    const pool = lv.items;
    let upper = false;
    const clipOf = (it, el, box) => (t === 'huruf' ? C.huruf(it.h, el) : t === 'suku' ? C.suku(it.s, el) : t === 'kata' ? C.word(it, el) : C.kalimat(it, box ? $$('.w', box) : null, el));
    const ask = { huruf: 'Huruf apa yang kamu dengar?', suku: 'Suku kata apa yang kamu dengar?', kata: 'Kata apa yang kamu dengar?', kalimat: 'Kalimat mana yang kamu dengar?' }[t];
    return {
      qs: qList(pool, 6, 8), layout: t === 'kalimat' ? 'rows' : t === 'kata' ? 'words' : 'tiles',
      options: q => { upper = t === 'huruf' && Math.random() < 0.5; return shuffle([q].concat(others(pool, q, Math.min(n, pool.length) - 1))); },
      prompt: () => '<button class="btn speaker big" id="spk" aria-label="Dengar lagi">🔊</button><div class="q-text">' + ask + '</div>',
      option: o => (t === 'huruf' ? hurufHTML(upper ? o.H : o.h) : t === 'suku' ? '<span class="sk rd">' + esc(o.s) + '</span>' : t === 'kata' ? wordHTML(o) : sentHTML(o)),
      say: (q, first, P) => Voice.seq([first ? guide('dengar' + t) : null, clipOf(q, $('#spk', P))]),
      isRight: (o, q) => o === q,
      right: (q, o, b) => [clipOf(q, b, b)],
      wrong: (q, P) => [clipOf(q, $('#spk', P))],
      item: q => q
    };
  }

  function PickGame(root, lv, sid, mode) {
    const S = pickSpec(lv, mode);
    const qs = S.qs;
    let qi = 0, mistakes = 0, firstTry = true, busy = false, right = 0, list = [];
    root.innerHTML =
      '<div class="screen quiz pick m-' + mode + ' t-' + lv.type + '" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, actInfo(lv, mode).name, '<span class="pill" id="cnt"></span>') +
      '<div class="progress"><i id="bar"></i></div>' +
      '<div class="prompt" id="prompt"></div>' +
      '<div class="options" id="opts"></div></div>';
    const P = $('#prompt', root), opts = $('#opts', root), bar = $('#bar', root);
    P.addEventListener('click', e => { if (e.target.closest('#spk')) S.say(qs[qi], false, P); });

    function showQ(first) {
      const q = qs[qi];
      firstTry = true;
      busy = false;
      list = S.options(q);
      P.innerHTML = S.prompt(q);
      restart(P, 'q-in');
      if (S.bind) S.bind(q, P);
      opts.className = 'options lay-' + S.layout + ' n' + list.length;
      opts.innerHTML = list.map((o, k) => '<button class="opt" data-k="' + k + '">' + S.option(o) + '</button>').join('');
      $$('.opt', opts).forEach(b => { b.onclick = () => answer(b, list[+b.dataset.k]); });
      $('#cnt', root).textContent = (qi + 1) + ' / ' + qs.length;
      bar.style.width = (qi / qs.length * 100) + '%';
      S.say(q, first, P);
    }
    async function answer(b, o) {
      if (busy) return;
      const q = qs[qi];
      if (!S.isRight(o, q)) {
        mistakes++;
        firstTry = false;
        b.classList.add('wrong');
        Sfx.play('no');
        Voice.seq([C.ui(pick(['cobalagi', 'ups']))].concat(S.wrong(q, P)));
        return;
      }
      busy = true;
      if (firstTry) right++;
      b.classList.add('right');
      $$('.opt', opts).forEach(x => { if (x !== b && !x.classList.contains('wrong')) x.classList.add('dim'); });
      bar.style.width = ((qi + 1) / qs.length * 100) + '%';
      Sfx.play('ok');
      collect(S.item(q));
      if (S.reveal) S.reveal(q, P);
      await Voice.seq(S.right(q, o, b, P).concat([praise()]));
      if (!alive(sid)) return;
      await sleep(250);
      if (!alive(sid)) return;
      qi++;
      if (qi < qs.length) showQ(false);
      else {
        if (S.done) S.done();
        finishGame(lv, mode, starsFor(mistakes, 1, 3), 'Benar pada percobaan pertama: <b>' + right + '</b> dari ' + qs.length);
      }
    }
    showQ(true);
  }

  /* ================= Permainan: Pecah Balon ================= */
  function BalloonGame(root, lv, sid) {
    const isH = lv.type === 'huruf';
    const NEED = 3;
    const targets = shuffle(lv.items.slice()).slice(0, 3);
    const extra = isH ? HURUF : LEVELS.filter(l => l.type === 'suku' && l.idx < lv.idx).reduce((a, l) => a.concat(l.items), []);
    const poolFor = t => lv.items.filter(x => x !== t).concat(shuffle(extra.filter(x => x !== t && lv.items.indexOf(x) < 0)).slice(0, 3));
    const COLORS = ['#ff595e', '#ff8c1a', '#f4b400', '#4caf2f', '#1982c4', '#6a4c93', '#ff5fa2', '#00a6c8'];
    const total = NEED * targets.length;
    let ti = 0, got = 0, mistakes = 0, since = 0, over = false, pool = poolFor(targets[0]);
    const lanes = [];
    root.innerHTML =
      '<div class="screen balloon-screen" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, 'Pecah Balon', '<span class="pill">🎈 <b id="pc">0</b>/' + total + '</span>') +
      '<div class="target-bar"><button class="btn speaker sm" id="spk" aria-label="Dengar lagi">🔊</button>' +
        '<span class="tg-lab">Cari:</span><span class="target" id="tg"></span><span class="tg-dots" id="tgd"></span></div>' +
      '<div class="sky" id="sky"><div class="cloud c1"></div><div class="cloud c2"></div></div></div>';
    const sky = $('#sky', root), spk = $('#spk', root), tg = $('#tg', root), tgd = $('#tgd', root);
    const clip = (it, el) => (isH ? C.huruf(it.h, el) : C.suku(it.s, el));
    const setH = () => sky.style.setProperty('--h', sky.clientHeight + 'px');
    setH();
    window.addEventListener('resize', setH);
    onCleanup(() => window.removeEventListener('resize', setH));

    function showTarget() {
      const t = targets[ti];
      tg.innerHTML = isH ? hurufHTML(t.H) + hurufHTML(t.h) : '<span class="sk rd">' + esc(t.s) + '</span>';
      tgd.innerHTML = '<i></i>'.repeat(NEED);
      restart(tg, 'boing');
      Voice.seq([guide(isH ? 'balonhuruf' : 'balonsuku'), clip(t, spk)]);
    }
    spk.onclick = () => Voice.play(clip(targets[ti], spk));

    function spawn() {
      if (!alive(sid) || over) return;
      if ($$('.balloon:not(.gone)', sky).length < 7) {
        const t = targets[ti];
        const isT = since >= 2 || Math.random() < 0.42;
        const it = isT ? t : pick(pool);
        since = isT ? 0 : since + 1;
        const free = [0, 1, 2, 3].filter(l => lanes.indexOf(l) < 0);
        const lane = pick(free);
        lanes.push(lane);
        if (lanes.length > 2) lanes.shift();
        const text = isH ? (Math.random() < 0.5 ? it.H : it.h) : it.s;
        const b = document.createElement('button');
        b.className = 'balloon';
        b.dataset.uid = it.uid;
        b.setAttribute('aria-label', 'Balon ' + text);
        b.style.cssText = 'left:' + (2 + lane * 24.5 + Math.random() * 2) + '%;--c:' + pick(COLORS) + ';--dur:' + ((lv.stage === 1 ? 9 : 7.5) + Math.random() * 2).toFixed(1) + 's';
        b.innerHTML = '<span class="b-body"><span class="b-txt' + (isH ? '' : ' rd') + '">' + esc(text) + '</span></span><span class="b-str"></span>';
        b.addEventListener('animationend', e => { if (e.animationName === 'rise') b.remove(); });
        sky.appendChild(b);
      }
      later(spawn, 850 + Math.random() * 650);
    }
    sky.addEventListener('pointerdown', e => {
      const b = e.target.closest('.balloon');
      if (!b || b.classList.contains('gone') || over) return;
      const t = targets[ti];
      if (b.dataset.uid !== t.uid) {
        mistakes++;
        const body = $('.b-body', b);
        restart(body, 'nope');
        later(() => body.classList.remove('nope'), 500);
        Sfx.play('no');
        Voice.play(clip(t, spk));
        return;
      }
      b.classList.add('gone', 'pop');
      later(() => b.remove(), 450);
      Sfx.play('pop');
      collect(t);
      got++;
      $('#pc', root).textContent = got;
      const inRound = got - ti * NEED;
      $$('i', tgd).forEach((d, k) => d.classList.toggle('on', k < inRound));
      if (inRound < NEED) { Voice.play(clip(t)); return; }
      $$('.balloon:not(.gone)', sky).forEach(x => x.classList.add('gone', 'away'));
      if (ti < targets.length - 1) {
        ti++;
        pool = poolFor(targets[ti]);
        Sfx.play('match');
        Voice.play(praise());
        later(showTarget, 1100);
      } else {
        over = true;
        later(() => finishGame(lv, 'balon', starsFor(mistakes, 1, 4), 'Balon yang kamu pecahkan: <b>' + total + '</b>'), 700);
      }
    });
    showTarget();
    later(spawn, 900);
  }

  /* ================= Permainan: Susun Kata / Kalimat ================= */
  function BuildGame(root, lv, sid) {
    const sent = lv.type === 'kalimat' || lv.type === 'cerita';
    const qs = shuffle(buildPool(lv).slice()).slice(0, sent ? 5 : 6);
    let qi = 0, mistakes = 0, busy = false, parts = [], tiles = [];
    root.innerHTML =
      '<div class="screen quiz build" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, actInfo(lv, 'susun').name, '<span class="pill" id="cnt"></span>') +
      '<div class="progress"><i id="bar"></i></div>' +
      '<div class="b-area"><div class="b-top"><button class="b-pic" id="bpic" aria-label="Gambar"></button>' +
        '<button class="btn help" id="help">💡 Bantu</button></div>' +
      '<div class="b-play"><div class="slots" id="slots"></div>' +
      '<p class="b-hint">' + (sent ? 'Ketuk kata sesuai urutan kalimat 👇' : 'Ketuk suku kata sesuai urutan 👇') + '</p>' +
      '<div class="tiles" id="tiles"></div></div></div></div>';
    const slotsEl = $('#slots', root), tilesEl = $('#tiles', root), bar = $('#bar', root), bpic = $('#bpic', root);
    const sayAll = () => {
      const q = qs[qi];
      return sent ? C.kalimat(q, null, bpic) : C.word(q, bpic);
    };
    bpic.onclick = () => { bounce(bpic); if (!sent) Voice.play(sayAll()); };
    $('#help', root).onclick = () => Voice.play(sayAll());

    function showQ(first) {
      const q = qs[qi];
      busy = false;
      parts = sent ? q.toks.map(t => t.pre + t.w) : q.syl.filter(s => s !== '-');
      const order = parts.map((p, k) => k);
      if (new Set(parts).size > 1) { do { shuffle(order); } while (order.every((v, k) => parts[v] === parts[k])); }
      bpic.innerHTML = picHTML(q.e, sent ? 'big' : '');
      restart(bpic, 'boing');
      let si = 0;
      const end = sent ? q.toks[q.toks.length - 1].post : '';
      slotsEl.className = 'slots rd ' + (sent ? 'sent' : 'word');
      slotsEl.innerHTML = sent
        ? parts.map((p, k) => '<button class="slot" data-s="' + k + '" aria-label="Kotak ' + (k + 1) + '"></button>').join('') + (end ? '<span class="end">' + esc(end) + '</span>' : '')
        : q.syl.map(s => (s === '-' ? '<span class="hy">-</span>' : '<button class="slot" data-s="' + (si++) + '" aria-label="Kotak ' + si + '"></button>')).join('');
      tilesEl.className = 'tiles rd ' + (sent ? 'sent' : 'word');
      tilesEl.innerHTML = order.map(k => '<button class="tile" data-k="' + k + '">' + esc(parts[k]) + '</button>').join('');
      tiles = $$('.tile', tilesEl);
      $('#cnt', root).textContent = (qi + 1) + ' / ' + qs.length;
      bar.style.width = (qi / qs.length * 100) + '%';
      if (sent) Voice.play(first ? guide('susunkalimat') : null);
      else Voice.seq([first ? guide('susunkata') : null, C.word(q, bpic)]);
    }
    const slots = () => $$('.slot', slotsEl);
    const emptySlot = s => { delete s.dataset.t; s.textContent = ''; s.classList.remove('filled', 'bad'); };
    tilesEl.onclick = e => {
      const t = e.target.closest('.tile');
      if (!t || busy || t.classList.contains('used')) return;
      const slot = slots().find(s => !s.dataset.t);
      if (!slot) return;
      const k = +t.dataset.k;
      slot.dataset.t = t.dataset.k;
      slot.textContent = parts[k];
      slot.classList.add('filled');
      restart(slot, 'boing');
      t.classList.add('used');
      Sfx.play('tap');
      Voice.play(sent ? C.kata(parts[k], slot) : C.suku(parts[k], slot));
      if (slots().every(s => s.dataset.t)) { busy = true; later(check, 350); }
    };
    slotsEl.onclick = e => {
      const s = e.target.closest('.slot');
      if (!s || busy || !s.dataset.t || s.classList.contains('lock')) return;
      const t = tiles.find(x => x.dataset.k === s.dataset.t);
      if (t) t.classList.remove('used');
      emptySlot(s);
      Sfx.play('flip');
    };
    async function check() {
      const q = qs[qi], ss = slots();
      const ok = ss.map((s, k) => parts[+s.dataset.t] === parts[k]);
      if (ok.every(Boolean)) {
        ss.forEach(s => s.classList.add('ok'));
        Sfx.play('ok');
        collect(q);
        bar.style.width = ((qi + 1) / qs.length * 100) + '%';
        await Voice.seq([sent ? C.kalimat(q, ss) : C.word(q, slotsEl), praise()]);
        if (!alive(sid)) return;
        await sleep(300);
        if (!alive(sid)) return;
        qi++;
        if (qi < qs.length) showQ(false);
        else finishGame(lv, 'susun', starsFor(mistakes, 1, 3), (sent ? 'Kalimat' : 'Kata') + ' yang kamu susun: <b>' + qs.length + '</b>');
        return;
      }
      mistakes++;
      Sfx.play('no');
      ss.forEach((s, k) => s.classList.add(ok[k] ? 'lock' : 'bad'));
      Voice.play(C.ui('cobalagi'));
      later(() => {
        ss.forEach((s, k) => {
          if (ok[k]) return;
          const t = tiles.find(x => x.dataset.k === s.dataset.t);
          if (t) t.classList.remove('used');
          emptySlot(s);
        });
        busy = false;
      }, 800);
    }
    showQ(true);
  }

  /* ================= Permainan: Kartu Memori / Pasangan ================= */
  function MemoryGame(root, lv, sid) {
    const isH = lv.type === 'huruf';
    const pairs = Math.min(lv.stg.pairs, lv.items.length);
    const ws = shuffle(lv.items.slice()).slice(0, pairs);
    const cards = shuffle(ws.reduce((a, w) => a.concat([{ w: w, t: 'a' }, { w: w, t: 'b' }]), []));
    const face = c => (isH ? '<span class="mc-hf" style="color:' + c.w.c + '">' + (c.t === 'a' ? c.w.H : c.w.h) + '</span>'
      : c.t === 'a' ? picHTML(c.w.e) : '<span class="mc-word">' + wordHTML(c.w) + '</span>');
    const say = w => (isH ? C.huruf(w.h) : C.word(w));
    let open = [], moves = 0, found = 0, busy = false;
    root.innerHTML =
      '<div class="screen quiz memory" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, actInfo(lv, 'pasang').name, '<span class="pill" title="Langkah">👣 <b id="moves">0</b></span>') +
      '<div class="mem-info"><span>' + (isH ? 'Cari pasangan <b>huruf besar</b> &amp; <b>huruf kecil</b>!' : 'Cari pasangan <b>gambar</b> &amp; <b>kata</b>-nya!') + '</span>' +
      '<span class="pill small">✅ <span><b id="found">0</b>/' + pairs + '</span></span></div>' +
      '<div class="mem-grid" id="grid">' + cards.map((c, k) =>
        '<button class="mcard" data-k="' + k + '" aria-label="Kartu ' + (k + 1) + '"><span class="mc-inner">' +
        '<span class="mc-face mc-back">⭐</span>' +
        '<span class="mc-face mc-front">' + face(c) + '</span>' +
        '</span></button>').join('') + '</div></div>';
    const grid = $('#grid', root);

    /* pilih jumlah kolom yang menghasilkan kartu terbesar yang muat di layar */
    function layout() {
      if (!grid.isConnected) return;
      const count = cards.length, gap = 10, gw = grid.clientWidth;
      const availH = Math.max(220, window.innerHeight - grid.getBoundingClientRect().top - 24);
      let best = null;
      for (let cols = 2; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const ch = Math.min(Math.min((gw - (cols - 1) * gap) / cols, 170) * 1.25, (availH - (rows - 1) * gap) / rows);
        const cw = Math.min((gw - (cols - 1) * gap) / cols, 170, ch);
        if (!best || Math.min(cw, ch) > best.size + 0.5) best = { cw: cw, ch: ch, size: Math.min(cw, ch) };
      }
      const cw = best.cw, ch = Math.max(70, best.ch);
      grid.style.setProperty('--cw', cw + 'px');
      grid.style.setProperty('--ch', ch + 'px');
      grid.style.setProperty('--ps', (Math.min(cw, ch) * 0.8) + 'px');
      $$('.mc-word', grid).forEach(el => {
        const len = el.textContent.length;
        el.style.fontSize = Math.max(13, Math.min(cw * 0.3, (cw * 1.55) / Math.max(1, len))) + 'px';
      });
      $$('.mc-hf', grid).forEach(el => { el.style.fontSize = (Math.min(cw, ch) * 0.62) + 'px'; });
    }
    layout();
    window.addEventListener('resize', layout);
    onCleanup(() => window.removeEventListener('resize', layout));

    $$('.mcard', grid).forEach(el => { el.onclick = () => flip(el); });
    function flip(el) {
      if (busy || el.classList.contains('open') || el.classList.contains('matched')) return;
      const c = cards[+el.dataset.k];
      el.classList.add('open');
      Sfx.play('flip');
      open.push(el);
      if (open.length < 2) { Voice.play(say(c.w)); return; }
      moves++;
      $('#moves', root).textContent = moves;
      const a = open[0], b = open[1];
      open = [];
      const ca = cards[+a.dataset.k];
      if (ca.w === c.w) {
        Voice.seq([say(c.w), praise()]);
        later(() => {
          a.classList.add('matched');
          b.classList.add('matched');
          Sfx.play('match');
          collect(c.w);
          found++;
          $('#found', root).textContent = found;
          if (found === pairs) {
            later(() => finishGame(lv, 'pasang', moves <= pairs + 2 ? 3 : moves <= pairs * 2 + 1 ? 2 : 1, 'Semua pasangan ditemukan dalam <b>' + moves + '</b> langkah'), 1300);
          }
        }, 380);
      } else {
        Voice.play(say(c.w));
        busy = true;
        later(() => { a.classList.remove('open'); b.classList.remove('open'); busy = false; }, 1300);
      }
    }
    Voice.play(guide(isH ? 'pasanghuruf' : 'pasangkata'));
  }

  /* ================= Papan abjad ================= */
  function Abjad(root) {
    root.innerHTML =
      '<div class="screen abjad">' + topbar('#/', 'Papan Abjad', '<button class="pill pill-btn" id="all">▶ A–Z</button>') +
      '<div class="ab-pop" id="pop"><span class="ab-hint">Ketuk huruf untuk mendengar namanya 👇</span></div>' +
      '<div class="ab-grid">' + HURUF.map(it => '<button class="ab" data-h="' + it.h + '" style="--c:' + it.c + '" aria-label="Huruf ' + it.H + '"><span class="ab-up">' + it.H + '</span><span class="ab-low">' + it.h + '</span></button>').join('') + '</div></div>';
    const pop = $('#pop', root);
    const tile = h => $('.ab[data-h="' + h + '"]', root);
    function show(it) {
      const w = it.word;
      pop.innerHTML = '<span class="ab-big" style="color:' + it.c + '">' + it.H + it.h + '</span>' +
        (w ? picHTML(w.e) + '<span class="kata rd"><b class="first" style="color:' + it.c + '">' + esc(w.w[0]) + '</b>' + esc(w.w.slice(1)) + '</span>' : '<span class="small muted">jarang dipakai</span>');
      restart(pop, 'boing');
    }
    $$('.ab', root).forEach(b => {
      b.onclick = () => {
        const it = ABJAD[b.dataset.h];
        bounce(b);
        show(it);
        Voice.seq([gapped(C.huruf(it.h, b), 300), it.word ? C.word(it.word, pop) : null]);
      };
    });
    $('#all', root).onclick = () => {
      Sfx.play('tap');
      Voice.seq(HURUF.map(it => gapped(C.huruf(it.h, tile(it.h)), 160)));
    };
    if (!session.abjadIntro) { session.abjadIntro = true; Voice.play(guide('abjad')); }
  }

  /* ================= Album stiker ================= */
  function Album(root) {
    const got = Store.d.stickers, total = ALBUM_UIDS.length, cnt = stickerCount();
    root.innerHTML =
      '<div class="screen">' + topbar('#/', 'Album Stiker', '<span class="pill">🏅 <span><b>' + cnt + '</b>/' + total + '</span></span>') +
      '<div class="card"><div class="sum-row"><span class="big-emoji sm">🏅</span><div><b>' + cnt + ' dari ' + total + ' stiker</b>' +
      '<small>Jawab benar di permainan untuk mengumpulkan stiker baru!</small></div></div>' +
      '<div class="progress"><i style="width:' + (cnt / total * 100) + '%"></i></div></div>' +
      LEVELS.map(lv => {
        const items = albumItems(lv);
        const g = items.filter(x => got[x.uid]).length;
        return '<section class="alb" style="--lc:' + lv.color + '"><h3><span class="alb-ico">' + iconHTML(lv) + '</span> ' + esc(lv.name) + ' <small>' + g + '/' + items.length + '</small></h3>' +
          '<div class="alb-grid' + (lv.type === 'kalimat' || lv.type === 'cerita' ? ' wide' : '') + '">' +
          items.map(it => {
            const lab = stickerLabel(it);
            return got[it.uid]
              ? '<button class="stk got k-' + it.kind + '" data-uid="' + it.uid + '">' + stickerFace(it) + (lab ? '<span class="rd">' + esc(lab) + '</span>' : '') + '</button>'
              : '<div class="stk k-' + it.kind + '">' + stickerFace(it) + (lab ? '<span>?</span>' : '') + '</div>';
          }).join('') + '</div></section>';
      }).join('') + '</div>';
    $$('.stk.got', root).forEach(b => { b.onclick = () => { bounce(b); Voice.seq(itemClips(ITEMS[b.dataset.uid], b)); }; });
    if (!session.albumIntro) { session.albumIntro = true; Voice.play(guide('album')); }
  }

  /* ================= Kamus kata ================= */
  function Kamus(root) {
    root.innerHTML =
      '<div class="screen">' + topbar('#/', 'Kamus Kata', '<span class="pill">📚 ' + KAMUS.length + '</span>') +
      '<input class="input search" id="q" type="search" placeholder="🔍 Cari kata…" autocomplete="off">' +
      '<div id="list"></div></div>';
    const list = $('#list', root);
    function draw(q) {
      q = q.trim().toLowerCase();
      let html = '', head = '';
      KAMUS.forEach((w, i) => {
        if (q && w.w.indexOf(q) < 0) return;
        const h = w.w[0];
        if (h !== head) { head = h; html += '<div class="k-head">' + hurufHTML(h.toUpperCase()) + hurufHTML(h) + '</div>'; }
        html += '<div class="k-row" data-i="' + i + '">' + picHTML(w.e) + '<div class="k-txt">' + wordHTML(w) + '</div>' +
          '<button class="btn k-btn" data-a="n" aria-label="Dengar ' + esc(w.w) + '">🔊</button>' +
          '<button class="btn k-btn" data-a="e" aria-label="Eja ' + esc(w.w) + '">🔤</button></div>';
      });
      list.innerHTML = html || '<p class="hint center">Kata tidak ditemukan 🙈</p>';
    }
    list.addEventListener('click', e => {
      const b = e.target.closest('.k-btn');
      if (!b) return;
      const row = b.closest('.k-row'), w = KAMUS[+row.dataset.i], k = $('.kata', row);
      Voice.seq(b.dataset.a === 'e' ? ejaClips(w, $$('.sy', row), k) : sukuClips(w, $$('.sy', row), k));
    });
    $('#q', root).addEventListener('input', e => draw(e.target.value));
    draw('');
  }

  /* ================= Orang tua ================= */
  function Gate(root) {
    const a = 3 + Math.floor(Math.random() * 7), b = 4 + Math.floor(Math.random() * 6);
    root.innerHTML =
      '<div class="screen">' + topbar('#/', 'Orang Tua', '') +
      '<div class="card gate"><div class="big-emoji">👨‍👩‍👧</div><h2>Khusus Orang Tua</h2><p>Untuk masuk, jawab soal ini:</p>' +
      '<div class="gate-q">' + a + ' + ' + b + ' = ?</div>' +
      '<input class="input gate-in" id="ans" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="Jawaban">' +
      '<button class="btn btn-green" id="go">Masuk</button></div></div>';
    const inp = $('#ans', root);
    const go = () => {
      if (parseInt(inp.value, 10) === a + b) { session.gate = true; render(); return; }
      Sfx.play('no');
      inp.value = '';
      restart(inp, 'shake');
      toast('Jawaban belum tepat');
    };
    $('#go', root).onclick = go;
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }

  function Parent(root) {
    if (!session.gate) { Gate(root); return; }
    const s = Store.d.settings;
    const done = LEVELS.filter(levelDone).length;
    const toggleRow = (k, t, d) => '<div class="row"><label for="t-' + k + '">' + t + '<small>' + d + '</small></label><span class="sw"><input type="checkbox" id="t-' + k + '" data-k="' + k + '"' + (s[k] ? ' checked' : '') + '><i></i></span></div>';
    const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
    const httpOk = /^https?:$/.test(location.protocol) && 'caches' in window;
    root.innerHTML =
      '<div class="screen parent">' + topbar('#/', 'Orang Tua', '') +
      '<section class="card"><h2>👧 Profil Anak</h2>' +
        '<label class="field">Nama anak<small>Dipakai untuk menyapa di layar utama</small><input class="input" id="name" type="text" maxlength="20" placeholder="mis. Budi" value="' + esc(Store.d.name) + '"></label>' +
        '<div class="row"><label for="start">Mulai dari<small>Tahap sebelumnya ikut terbuka. Anak tetap bisa mengulang tahap yang lebih mudah.</small></label>' +
          '<select class="input sel" id="start">' + D.stages.map(st => '<option value="' + st.id + '">' + st.name + ' · ' + esc(st.title) + ' (' + st.umur + ')</option>').join('') + '</select></div></section>' +
      '<section class="card"><h2>📈 Perkembangan</h2>' +
        '<div class="stats"><div class="stat"><b>' + done + '/' + LEVELS.length + '</b><small>Pelajaran selesai</small></div>' +
        '<div class="stat"><b>' + totalStars() + '</b><small>Bintang</small></div>' +
        '<div class="stat"><b>' + stickerCount() + '/' + ALBUM_UIDS.length + '</b><small>Stiker</small></div></div>' +
        '<div class="table-wrap"><table class="prog"><thead><tr><th>Pelajaran</th><th>Belajar</th><th>Bintang</th></tr></thead><tbody>' +
        LEVELS.map(lv => {
          const r = Store.d.levels[lv.n] || {};
          const max = gameActs(lv).length * 3, sum = levelSum(lv);
          return '<tr class="' + (isUnlocked(lv) ? '' : 'lk') + '"><td>' + lv.n + '. ' + esc(lv.name) + '</td><td>' + (r.learned ? '✔' : '–') + '</td>' +
            '<td><span class="bar-mini"><i style="width:' + (sum / max * 100) + '%"></i></span> ' + sum + '/' + max + '</td></tr>';
        }).join('') +
        '</tbody></table></div></section>' +
      '<section class="card"><h2>🔤 Tampilan Tulisan</h2>' +
        toggleRow('warna', 'Warnai suku kata', 'Suku kata diberi warna bergantian (merah–biru) agar mudah dibaca') +
        toggleRow('caps', 'Huruf kapital semua', 'Kata & kalimat ditulis dengan HURUF BESAR') + '</section>' +
      '<section class="card" id="voicecard"><h2>🔊 Suara</h2>' +
        '<div class="row"><label for="src">Sumber suara<small>Rekaman: jelas, sama di semua perangkat & bisa offline. Perangkat: suara bawaan HP/komputer.</small></label>' +
          '<select class="input sel" id="src"><option value="rekaman">Rekaman (disarankan)</option><option value="perangkat">Suara perangkat</option></select></div>' +
        '<div class="row tts-only"><label for="rate">Kecepatan suara perangkat<small id="rateval"></small></label><input type="range" id="rate" min="0.6" max="1.2" step="0.05"></div>' +
        '<p class="small muted tts-only" id="ttsinfo"></p>' +
        toggleRow('guide', 'Bacakan petunjuk', 'Petunjuk permainan & pujian ikut dibacakan') +
        toggleRow('autoplay', 'Putar suara otomatis', 'Huruf/kata langsung dibacakan saat kartu dibuka') +
        toggleRow('sfx', 'Efek suara', 'Bunyi benar, salah, balon pecah & hore') +
        '<div class="row"><label>Tes suara<small>Pastikan volume perangkat tidak dibisukan</small></label><button class="btn btn-blue" id="test">▶ Tes</button></div></section>' +
      '<section class="card"><h2>🗺️ Pelajaran</h2>' +
        toggleRow('unlockAll', 'Buka semua pelajaran', 'Anak boleh memilih pelajaran mana saja tanpa menyelesaikan pelajaran sebelumnya') + '</section>' +
      '<section class="card"><h2>📱 Aplikasi</h2>' +
        '<div class="row"><label>Pasang di layar utama<small>' +
          (standalone ? 'Sudah terpasang sebagai aplikasi ✔' : installPrompt ? 'Buka seperti aplikasi biasa, tanpa bilah alamat' : 'Di Chrome: menu ⋮ → “Tambahkan ke layar utama”. Di iPhone: tombol Bagikan → “Tambah ke Layar Utama”.') +
        '</small></label>' + (installPrompt && !standalone ? '<button class="btn" id="inst">📲 Pasang</button>' : '') + '</div>' +
        '<div class="row"><label>Simpan untuk offline<small id="offst">' +
          (httpOk ? 'Unduh semua suara (±' + AUDIO_SIZE_MB + ' MB) agar bisa dipakai tanpa internet' : 'Aplikasi dibuka dari file di perangkat ini, jadi semua suara sudah tersedia offline.') +
        '</small></label>' + (httpOk ? '<button class="btn" id="off">💾 Simpan</button>' : '') + '</div>' +
        '<div class="row"><label>Hapus semua kemajuan<small>Bintang, stiker & pelajaran kembali ke awal</small></label><button class="btn btn-red" id="reset">🗑️ Hapus</button></div></section>' +
      '<section class="card about"><h2>💡 Tips untuk Orang Tua</h2><ul class="tips">' +
        '<li><b>Sebentar tapi rutin:</b> 10–15 menit sehari lebih baik daripada 1 jam seminggu sekali.</li>' +
        '<li><b>Dampingi anak:</b> ajak menirukan suara, tunjuk hurufnya bersama-sama, dan beri pujian.</li>' +
        '<li><b>Urutannya:</b> kenal huruf → suku kata (ba-bi-bu) → kata → kalimat → cerita. Jangan terburu-buru pindah tahap.</li>' +
        '<li><b>Warna suku kata</b> (merah–biru) membantu anak melihat potongan kata. Matikan bila anak sudah lancar.</li>' +
        '<li><b>Tombol Eja</b> membacakan “be-o bo, el-a la, bola” seperti cara mengeja di sekolah.</li>' +
        '<li>Ulangi pelajaran yang sudah selesai sesekali agar anak makin lancar.</li></ul></section>' +
      '<section class="card about"><h2>ℹ️ Tentang</h2>' +
        '<p><b>Baca Ceria</b> v' + APP_VERSION + ' — ' + LEVELS.length + ' pelajaran, ' + KAMUS.length + ' kata bergambar, 9 jenis permainan.</p>' +
        '<p class="small muted">Tanpa iklan, tanpa login, dan tidak mengirim data apa pun. Kemajuan anak tersimpan di perangkat ini. ' +
        'Gambar memakai emoji bawaan perangkat. Rekaman suara dibuat dengan suara neural Microsoft (edge-tts). Huruf: Andika (SIL) & Fredoka.</p></section>' +
      '</div>';

    const nameIn = $('#name', root);
    nameIn.addEventListener('input', () => { Store.d.name = nameIn.value.trim().slice(0, 20); Store.save(); });
    const st = $('#start', root);
    st.value = String(Store.d.start);
    st.onchange = () => { Store.d.start = +st.value; Store.save(); toast('Pelajaran pertama diubah'); };

    const src = $('#src', root), rate = $('#rate', root), voiceCard = $('#voicecard', root);
    src.value = s.voice;
    const syncSrc = () => {
      $$('.tts-only', voiceCard).forEach(r => { r.hidden = src.value !== 'perangkat'; });
      const v = Voice.ttsVoice();
      $('#ttsinfo', root).textContent = v ? 'Suara perangkat: ' + v.name : 'Perangkat ini belum punya suara bahasa Indonesia — rekaman tetap dipakai.';
    };
    syncSrc();
    if ('speechSynthesis' in window) {
      try {
        speechSynthesis.addEventListener('voiceschanged', syncSrc);
        onCleanup(() => speechSynthesis.removeEventListener('voiceschanged', syncSrc));
      } catch (e) { /* abaikan */ }
    }
    src.onchange = () => { s.voice = src.value; Store.save(); syncSrc(); };
    rate.value = s.rate;
    const showRate = () => { $('#rateval', root).textContent = 'Kecepatan: ' + Math.round(rate.value * 100) + '%'; };
    showRate();
    rate.oninput = () => { s.rate = +rate.value; Store.save(); showRate(); };
    $$('.sw input', root).forEach(inp => {
      inp.onchange = () => {
        s[inp.dataset.k] = inp.checked;
        Store.save();
        applyLook();
        if (inp.dataset.k === 'sfx' && inp.checked) Sfx.play('ok');
      };
    });
    $('#test', root).onclick = () => Voice.seq([C.ui('halo'), C.huruf('a'), C.kata('bola')]);
    const inst = $('#inst', root);
    if (inst) inst.onclick = doInstall;
    const off = $('#off', root);
    if (off) off.onclick = () => saveOffline(off, $('#offst', root));
    $('#reset', root).onclick = () => {
      const m = openModal('<div class="big-emoji">🗑️</div><h2>Hapus kemajuan?</h2><p>Semua bintang, stiker, dan pelajaran yang terbuka akan kembali ke awal. Nama & pengaturan tetap disimpan.</p>' +
        '<div class="res-btns"><button class="btn btn-red" id="yes">Ya, hapus</button><button class="btn" id="no">Batal</button></div>', { dismiss: true });
      $('#yes', m).onclick = () => { Store.reset(); closeModal(); toast('Kemajuan sudah dihapus'); render(); };
      $('#no', m).onclick = closeModal;
    };
  }

  async function saveOffline(btn, status) {
    const files = BUNDLES.map(b => 'audio/' + b + '.js');
    btn.disabled = true;
    let ok = 0;
    try {
      const cache = await caches.open(AUDIO_CACHE);
      for (let k = 0; k < files.length; k++) {
        status.textContent = 'Menyimpan suara… ' + (k + 1) + '/' + files.length;
        try {
          if (await cache.match(files[k])) { ok++; continue; }
          const r = await fetch(files[k], { cache: 'reload' });
          if (r.ok) { await cache.put(files[k], r); ok++; }
        } catch (e) { /* lanjut ke file berikutnya */ }
      }
    } catch (e) { /* Cache API tidak tersedia */ }
    btn.disabled = false;
    status.textContent = ok === files.length ? '✔ Semua suara tersimpan. Aplikasi bisa dipakai tanpa internet.' : 'Tersimpan ' + ok + ' dari ' + files.length + ' file. Periksa internet lalu coba lagi.';
    toast(ok === files.length ? '✔ Siap dipakai offline' : 'Sebagian suara belum tersimpan');
  }

  /* ================= Pasang aplikasi (PWA) ================= */
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installPrompt = e;
    const top = $('.home-top');
    if (top && !$('#install', top)) {
      const b = document.createElement('button');
      b.className = 'pill pill-btn';
      b.id = 'install';
      b.textContent = '📲 Pasang';
      b.onclick = doInstall;
      top.insertBefore(b, top.children[1] || null);
    }
  });
  async function doInstall() {
    if (!installPrompt) { toast('Gunakan menu browser → “Tambahkan ke layar utama”', 3500); return; }
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (e) { /* abaikan */ }
    installPrompt = null;
    render();
  }
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  /* ================= Mulai ================= */
  const unlockAudio = () => { Sfx.unlock(); Voice.unlock(); };
  // touchend/click = sentuhan yang diakui iPhone untuk membuka audio; pointerdown untuk mouse
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, unlockAudio, { capture: true, passive: true }));
  document.addEventListener('click', e => { if (e.target.closest('[data-back]')) Sfx.play('tap'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Voice.stop(); });
  window.addEventListener('hashchange', render);
  render();
  // muat suara petunjuk lebih awal supaya tidak menunggu saat pertama dipakai
  setTimeout(() => { Voice.load('ui'); Voice.load('huruf'); }, 1200);
})();
