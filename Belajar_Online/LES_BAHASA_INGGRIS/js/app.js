/* English Ceria — logika aplikasi (JavaScript murni, tanpa framework & tanpa build). */
(function () {
  'use strict';

  const D = window.EC_DATA;
  const APP_VERSION = '1.0.0';
  const AUDIO_CACHE = 'ec-audio-1';
  const AUDIO_SIZE_MB = 5;
  const app = document.getElementById('app');
  if (!D || !D.levels) {
    app.innerHTML = '<div class="boot"><p>Data kosakata gagal dimuat.<br>Silakan muat ulang halaman.</p></div>';
    return;
  }

  /* ================= Utilitas ================= */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // harus sama dengan slug() di tools/buat_suara.py
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const restart = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const bounce = el => restart(el, 'boing');

  const ICON = {
    back: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ================= Data ================= */
  const LEVELS = D.levels;
  const STAGES = {};
  D.stages.forEach(s => { STAGES[s.id] = s; });
  const WORDS = [];
  const WORD_BY_UID = {};
  LEVELS.forEach((lv, i) => {
    lv.idx = i;
    lv.key = 'L' + String(lv.n).padStart(2, '0');
    lv.stg = STAGES[lv.stage] || D.stages[0];
    lv.words.forEach(w => {
      w.lv = lv;
      w.uid = lv.key + '-' + slug(w.en);
      w.ek = slug(w.en);
      w.ik = slug(w.ind);
      WORDS.push(w);
      WORD_BY_UID[w.uid] = w;
    });
  });
  const getLevel = n => LEVELS.find(l => l.n === +n);
  const PRAISE = ['great', 'excellent', 'welldone', 'awesome', 'verygood', 'perfect', 'amazing'];

  /* ================= Penyimpanan kemajuan ================= */
  const Store = {
    KEY: 'englishCeria.v1',
    d: null,
    defaults() {
      return {
        name: '', seenWelcome: false,
        settings: { voice: 'rekaman', idVoice: true, autoplay: true, sfx: true, rate: 0.9, ttsVoice: '', unlockAll: false },
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
      this.d = d;
    },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { /* mode privat / penyimpanan penuh */ } },
    lv(n) {
      const r = this.d.levels[n] || (this.d.levels[n] = {});
      r.games = r.games || {};
      return r;
    },
    reset() { const keep = this.d.settings; this.d = this.defaults(); this.d.settings = keep; this.d.seenWelcome = true; this.save(); }
  };
  Store.load();

  const gamesOf = lv => (Store.d.levels[lv.n] && Store.d.levels[lv.n].games) || {};
  const levelStars = lv => { const g = gamesOf(lv); return Math.max(0, g.dengar || 0, g.tebak || 0, g.memori || 0); };
  const levelDone = lv => levelStars(lv) > 0;
  const isUnlocked = lv => Store.d.settings.unlockAll || lv.idx === 0 || levelDone(LEVELS[lv.idx - 1]);
  const totalStars = () => LEVELS.reduce((t, lv) => { const g = gamesOf(lv); return t + (g.dengar || 0) + (g.tebak || 0) + (g.memori || 0); }, 0);
  const stickerCount = () => WORDS.filter(w => Store.d.stickers[w.uid]).length;
  const collect = w => { if (!Store.d.stickers[w.uid]) { Store.d.stickers[w.uid] = 1; Store.save(); } };
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
          case 'lock': this.tone(220, t, 0.1, 'square', 0.06); this.tone(196, t + 0.11, 0.14, 'square', 0.06); break;
          case 'win':
            [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => this.tone(f, t + i * 0.11, i === 5 ? 0.6 : 0.2, 'triangle', 0.17));
            [1568, 2093, 2637].forEach((f, i) => this.tone(f, t + 0.75 + i * 0.08, 0.25, 'sine', 0.06));
            break;
        }
      } catch (e) { /* abaikan */ }
    }
  };

  /* ================= Suara kata: rekaman + cadangan suara perangkat ================= */
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

  const Voice = {
    el: null, bundles: {}, pending: {}, urls: {}, token: 0, stopper: null, loading: 0, voices: [], unlocked: false,
    init() {
      this.el = new Audio();
      this.el.preload = 'auto';
      window.EC_AUDIO = (name, map) => { this.bundles[name] = map; };
      if ('speechSynthesis' in window) {
        const upd = () => { try { this.voices = speechSynthesis.getVoices() || []; } catch (e) { this.voices = []; } };
        upd();
        try { speechSynthesis.addEventListener('voiceschanged', upd); } catch (e) { speechSynthesis.onvoiceschanged = upd; }
      }
    },
    /* iPhone/Safari: elemen audio harus pernah diputar di dalam sentuhan pengguna.
       Dicoba di setiap sentuhan sampai berhasil, tanpa memotong suara yang sedang diputar. */
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
    /* quiet: muat di latar belakang tanpa menampilkan indikator "memuat suara" */
    load(name, quiet) {
      if (this.bundles[name]) return Promise.resolve(true);
      if (!this.pending[name]) {
        if (!quiet) { this.loading++; document.body.classList.add('audio-loading'); }
        this.pending[name] = new Promise(res => {
          const s = document.createElement('script');
          s.src = 'audio/' + name + '.js';
          s.async = true;
          const done = ok => {
            if (!quiet) this.loading = Math.max(0, this.loading - 1);
            if (!this.loading) document.body.classList.remove('audio-loading');
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
      const s = Store.d.settings;
      const useDevice = s.voice === 'perangkat' && this.ttsVoice(c.l);
      if (!useDevice) {
        const ok = await Promise.race([this.load(c.b), sleep(15000).then(() => false)]);
        if (tok !== this.token) return false;
        const url = ok && this.urlFor(c.b, c.k);
        if (url) {
          const r = await this.playUrl(url);
          if (r !== 'error') return r === 'ok';
        }
      }
      if (tok !== this.token) return false;
      return this.speak(c);
    },
    playUrl(url) {
      return new Promise(res => {
        const a = this.el;
        let done = false, timer = 0;
        const fin = r => {
          if (done) return;
          done = true;
          clearTimeout(timer);
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
        timer = setTimeout(() => fin('ok'), 10000);
      });
    },
    ttsVoice(lang) {
      if (!('speechSynthesis' in window)) return null;
      let vs = this.voices;
      if (!vs.length) { try { vs = this.voices = speechSynthesis.getVoices() || []; } catch (e) { vs = []; } }
      if (lang === 'en') {
        const want = Store.d.settings.ttsVoice;
        if (want) { const v = vs.find(x => x.voiceURI === want); if (v) return v; }
        const en = vs.filter(v => /^en([-_]|$)/i.test(v.lang));
        const prefs = [/Google US English/i, /Samantha/i, /(Ana|Aria|Jenny).*(Natural|Online)/i, /Zira/i];
        for (const p of prefs) { const v = en.find(x => p.test(x.name)); if (v) return v; }
        return en.find(v => /en[-_]US/i.test(v.lang)) || en.find(v => /en[-_]GB/i.test(v.lang)) || en[0] || null;
      }
      return vs.find(v => /^(id|in)([-_]|$)/i.test(v.lang)) || null;
    },
    speak(c) {
      if (!('speechSynthesis' in window)) return Promise.resolve(false);
      const v = this.ttsVoice(c.l);
      if (!v && c.l !== 'en') return Promise.resolve(false); // jangan bacakan bahasa Indonesia dengan suara Inggris
      return new Promise(res => {
        let done = false, timer = 0;
        const fin = r => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (this.stopper === stopper) this.stopper = null;
          res(r);
        };
        const stopper = () => fin(false);
        this.stopper = stopper;
        try {
          const text = c.t.replace(/&/g, c.l === 'en' ? 'and' : 'dan');
          const u = new SpeechSynthesisUtterance(text);
          u.lang = v ? v.lang : 'en-US';
          if (v) u.voice = v;
          const base = c.l === 'en' ? (+Store.d.settings.rate || 0.9) : 1;
          u.rate = c.slow ? base * 0.6 : base;
          u.pitch = c.l === 'en' ? 1.15 : 1;
          u.onend = () => fin(true);
          u.onerror = () => fin(false);
          speechSynthesis.cancel();
          speechSynthesis.speak(u);
          timer = setTimeout(() => fin(true), 2500 + text.length * 180);
        } catch (e) { fin(false); }
      });
    }
  };
  Voice.init();

  const clipEn = (w, slow, el) => ({ b: w.lv.key, k: (slow ? 'es:' : 'en:') + w.ek, t: w.tts || w.en, l: 'en', slow: !!slow, el: el || null });
  const clipId = (w, el) => ({ b: w.lv.key, k: 'id:' + w.ik, t: w.ind, l: 'id', el: el || null });
  const clipLvEn = (lv, el) => ({ b: lv.key, k: 'lven', t: lv.en, l: 'en', el: el || null });
  const clipLvId = lv => ({ b: lv.key, k: 'lvid', t: lv.name, l: 'id' });
  const clipUi = name => { const p = D.phrases[name]; return p ? { b: 'ui', k: name, t: p.text, l: p.lang } : null; };
  const praiseClip = () => clipUi(pick(PRAISE));
  const idOn = () => Store.d.settings.idVoice;

  /* ================= Latihan ucapan (pengenalan suara) ================= */
  const HOMO = {
    one: ['1', 'won'], two: ['2', 'to', 'too'], three: ['3', 'tree', 'free'], four: ['4', 'for'], five: ['5'], six: ['6', 'sex'],
    seven: ['7'], eight: ['8', 'ate'], nine: ['9'], ten: ['10'], eye: ['i', 'aye', 'hi'], ear: ['here', 'year', 'hear'],
    sea: ['see', 'c'], bee: ['b', 'be'], pear: ['pair', 'bear'], no: ['know', 'now'], sun: ['son'], flower: ['flour'],
    read: ['red', 'reed', 'reading'], write: ['right', 'rite', 'ride'], ant: ['aunt', 'and', 'and'], bear: ['bare', 'pear'],
    hello: ['hallo', 'hi', 'hey'], goodbye: ['good bye', 'bye', 'bye bye'], 'thank you': ['thanks', 'thank u'],
    'i love you': ['i love u', 'love you'], yes: ['yeah', 'yep'], up: ['app'], mouth: ['mouse'], rain: ['reign', 'rein'],
    tooth: ['to', 'truth'], cat: ['kat', 'cut', 'kit'], dog: ['dug', 'duck'], duck: ['dog'], hat: ['hut', 'had'], bag: ['back', 'beg']
  };
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function similar(a, b) {
    if (a === b) return 1;
    const m = a.length, n = b.length;
    if (!m || !n) return 0;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }
  function speechMatches(w, alts) {
    const target = norm(w.en);
    const targets = [target].concat((HOMO[target] || []).map(norm));
    for (const alt of alts) {
      const s = norm(alt);
      if (!s) continue;
      for (const t of targets) {
        if (s === t || (' ' + s + ' ').indexOf(' ' + t + ' ') >= 0) return true;
        if (similar(s, t) >= 0.7) return true;
        if (t.indexOf(' ') < 0 && s.split(' ').some(p => similar(p, t) >= 0.75)) return true;
      }
    }
    return false;
  }
  const Mic = {
    SR: window.SpeechRecognition || window.webkitSpeechRecognition,
    rec: null,
    get supported() { return !!this.SR; },
    listen(w) {
      return new Promise(res => {
        let r;
        try { r = new this.SR(); } catch (e) { res({ ok: false, error: 'unsupported' }); return; }
        this.rec = r;
        r.lang = 'en-US';
        r.interimResults = false;
        r.maxAlternatives = 5;
        r.continuous = false;
        let done = false, heard = '', timer = 0;
        const fin = o => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { r.abort(); } catch (e) { /* abaikan */ }
          if (this.rec === r) this.rec = null;
          res(o);
        };
        r.onresult = e => {
          const alts = [];
          for (let i = 0; i < e.results.length; i++) for (let j = 0; j < e.results[i].length; j++) alts.push(e.results[i][j].transcript);
          heard = alts[0] || '';
          fin({ ok: speechMatches(w, alts), heard: heard });
        };
        r.onerror = e => fin({ ok: false, error: e.error || 'error', heard: heard });
        r.onend = () => fin({ ok: false, heard: heard, error: heard ? null : 'no-speech' });
        timer = setTimeout(() => fin({ ok: false, error: 'no-speech', heard: heard }), 9000);
        try { r.start(); } catch (e) { fin({ ok: false, error: 'start' }); }
      });
    },
    stop() { if (this.rec) { try { this.rec.abort(); } catch (e) { /* abaikan */ } this.rec = null; } }
  };

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
  const NUM_COLORS = ['#ff595e', '#ff924c', '#f4b400', '#58b031', '#1982c4', '#6a4c93', '#ff5fa2', '#00a6c8', '#e0479e', '#2fb36d'];
  const SHAPES = {
    circle: ['<circle cx="50" cy="50" r="42"/>', 50],
    square: ['<rect x="10" y="10" width="80" height="80" rx="8"/>', 50],
    triangle: ['<path d="M50 8 L93 88 L7 88 Z" stroke-linejoin="round"/>', 64],
    rectangle: ['<rect x="4" y="24" width="92" height="52" rx="7"/>', 50],
    oval: ['<ellipse cx="50" cy="50" rx="46" ry="31"/>', 50],
    diamond: ['<path d="M50 4 L92 50 L50 96 L8 50 Z" stroke-linejoin="round"/>', 50],
    heart: ['<path d="M50 90 C22 70 5 54 5 33 C5 18 16 8 29 8 C39 8 46 14 50 22 C54 14 61 8 71 8 C84 8 95 18 95 33 C95 54 78 70 50 90 Z"/>', 42]
  };
  function shapeSVG(name, fill) {
    const sh = SHAPES[name] || SHAPES.circle, d = sh[0], cy = sh[1];
    return '<svg viewBox="0 0 100 100"><g fill="' + fill + '" stroke="rgba(0,0,0,.2)" stroke-width="3">' + d + '</g>' +
      '<g fill="#24304f"><circle cx="41" cy="' + (cy - 4) + '" r="4.2"/><circle cx="59" cy="' + (cy - 4) + '" r="4.2"/></g>' +
      '<circle cx="42.4" cy="' + (cy - 5.4) + '" r="1.4" fill="#fff"/><circle cx="60.4" cy="' + (cy - 5.4) + '" r="1.4" fill="#fff"/>' +
      '<path d="M43 ' + (cy + 5) + ' Q50 ' + (cy + 12) + ' 57 ' + (cy + 5) + '" fill="none" stroke="#24304f" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="33" cy="' + (cy + 4) + '" r="4" fill="#fff" opacity=".4"/><circle cx="67" cy="' + (cy + 4) + '" r="4" fill="#fff" opacity=".4"/></svg>';
  }
  function blobSVG(c) {
    const stroke = c.toLowerCase() === '#ffffff' ? '#c3ccdc' : 'rgba(0,0,0,.18)';
    return '<svg viewBox="0 0 100 100">' +
      '<path d="M50 9c9 0 13 8 21 10 9 2 19 5 20 16 1 8-5 12-4 19 1 8 7 14 3 22-4 9-14 9-21 12-7 4-11 10-20 10s-13-7-20-10c-8-3-17-5-20-14-3-8 3-14 3-21 0-7-6-12-4-20 3-10 13-11 21-13 8-3 12-11 21-11z" fill="' + c + '" stroke="' + stroke + '" stroke-width="2.5"/>' +
      '<circle cx="94" cy="13" r="4.5" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
      '<circle cx="5" cy="93" r="3.5" fill="' + c + '" stroke="' + stroke + '" stroke-width="1.5"/>' +
      '<ellipse cx="35" cy="32" rx="11" ry="6" fill="#fff" opacity=".35" transform="rotate(-28 35 32)"/></svg>';
  }
  function numHTML(w) {
    const n = w.num, rows = n <= 5 ? [n] : [Math.ceil(n / 2), Math.floor(n / 2)];
    return '<div class="num" style="--nc:' + NUM_COLORS[(n - 1) % NUM_COLORS.length] + '"><b>' + n + '</b>' +
      rows.map(r => '<div class="rowi">' + ('<i>' + w.item + '</i>').repeat(r) + '</div>').join('') + '</div>';
  }
  function picHTML(w) {
    let inner;
    if (w.color) inner = blobSVG(w.color);
    else if (w.shape) inner = shapeSVG(w.shape, w.fill);
    else if (w.num) inner = numHTML(w);
    else if (Array.isArray(w.e)) inner = '<span class="emo multi">' + w.e.map(x => '<span>' + x + '</span>').join('') + '</span>';
    else inner = '<span class="emo">' + w.e + '</span>';
    return '<div class="pic" aria-hidden="true">' + inner + '</div>';
  }

  /* ================= Router ================= */
  const session = { mapIntro: false, learnIntro: false, albumIntro: false, gate: false };
  let screenId = 0, timers = [], cleanups = [];
  const alive = id => id === screenId;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const onCleanup = fn => cleanups.push(fn);

  const ROUTES = [
    [/^#?\/?$/, Home],
    [/^#\/peta$/, MapScreen],
    [/^#\/level\/(\d+)$/, LevelScreen],
    [/^#\/level\/(\d+)\/(belajar|dengar|tebak|memori)$/, GameScreen],
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
    Mic.stop();
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
    if (!isUnlocked(lv)) { toast('🔒 Level ' + lv.n + ' masih terkunci'); location.replace('#/peta'); return null; }
    return lv;
  }

  /* ================= Layar: Beranda ================= */
  function Home(root) {
    const d = Store.d;
    const LC = ['#ff595e', '#ff924c', '#f4b400', '#58b031', '#1982c4', '#6a4c93', '#ff5fa2'];
    root.innerHTML =
      '<div class="screen home">' +
        '<div class="deco" aria-hidden="true">' + ['🍎', '🐱', '🚗', '⭐', '🎈', '🦋', '🌈', '🐳'].map((e, i) => '<span style="--i:' + i + '">' + e + '</span>').join('') + '</div>' +
        '<div class="home-top">' +
          '<span class="pill" title="Total bintang">⭐ <b>' + totalStars() + '</b></span>' +
          (installPrompt ? '<button class="pill pill-btn" id="install">📲 Pasang</button>' : '') +
          '<span class="pill" title="Stiker terkumpul">🏅 <b>' + stickerCount() + '</b></span>' +
        '</div>' +
        '<div class="logo" role="img" aria-label="English Ceria">' +
          '<div class="logo-en">' + 'English'.split('').map((c, i) => '<span style="--i:' + i + ';--c:' + LC[i] + '">' + c + '</span>').join('') + '</div>' +
          '<div class="logo-ceria">Ceria</div>' +
        '</div>' +
        '<p class="tagline">Belajar Bahasa Inggris untuk Anak</p>' +
        '<button class="mascot" id="mascot" aria-label="Sapa Oli si burung hantu"><span class="owl">🦉</span>' +
          '<span class="bubble">' + (d.name ? 'Hai, <b>' + esc(d.name) + '</b>! ' : 'Hai! ') + 'Aku Oli. Ayo belajar bahasa Inggris! 🎉</span></button>' +
        '<button class="btn btn-play" id="play">▶ Mulai</button>' +
        '<nav class="home-menu">' +
          '<a class="btn mini" href="#/album" style="--c:#ffe28a;--sh:#d9b23c">🏅<span>Album Stiker</span></a>' +
          '<a class="btn mini" href="#/kamus" style="--c:#b8f2c9;--sh:#62bf82">📚<span>Kamus</span></a>' +
          '<a class="btn mini" href="#/ortu" style="--c:#ffd0e1;--sh:#e08cab">👨‍👩‍👧<span>Orang Tua</span></a>' +
        '</nav>' +
        '<div class="hills" aria-hidden="true"></div>' +
      '</div>';
    $('#play', root).onclick = () => { Sfx.play('tap'); location.hash = '#/peta'; };
    $('#mascot', root).onclick = e => {
      Sfx.play('tap');
      restart(e.currentTarget, 'wiggle');
      Voice.seq([clipUi('hello'), idOn() ? clipUi('welcome') : null]);
    };
    const ib = $('#install', root);
    if (ib) ib.onclick = doInstall;
    if (!d.seenWelcome) later(welcomeModal, 500);
  }

  function welcomeModal() {
    const m = openModal(
      '<span class="owl big">🦉</span><h2>Halo! 👋</h2><p>Aku <b>Oli</b>. Siapa nama kamu?</p>' +
      '<input id="nm" class="input" type="text" maxlength="20" placeholder="Tulis nama…" autocomplete="off">' +
      '<div class="res-btns"><button class="btn btn-green" id="ok">Simpan</button><button class="btn" id="skip">Nanti saja</button></div>' +
      '<p class="small muted">Nama dipakai untuk menyapa anak. Bisa diubah di menu Orang Tua.</p>');
    const done = save => {
      if (save) Store.d.name = $('#nm', m).value.trim().slice(0, 20);
      Store.d.seenWelcome = true;
      Store.save();
      render();
    };
    $('#ok', m).onclick = () => done(true);
    $('#skip', m).onclick = () => done(false);
    $('#nm', m).addEventListener('keydown', e => { if (e.key === 'Enter') done(true); });
  }

  /* ================= Layar: Peta level ================= */
  function tileHTML(lv, current) {
    const locked = !isUnlocked(lv);
    return '<button class="lv-tile' + (locked ? ' locked' : '') + (current ? ' current' : '') + '" data-n="' + lv.n + '" style="--lc:' + lv.color + '" aria-label="Level ' + lv.n + ': ' + esc(lv.name) + (locked ? ' (terkunci)' : '') + '">' +
      '<span class="lv-num">Level ' + lv.n + '</span>' +
      '<span class="lv-ico">' + lv.icon + '</span>' +
      '<span class="lv-name">' + esc(lv.name) + '</span>' +
      '<span class="lv-en">' + esc(lv.en) + '</span>' +
      starsHTML(levelStars(lv)) +
      (locked ? '<span class="lock">🔒</span>' : '') + (current ? '<span class="cur-badge">Main!</span>' : '') +
      '</button>';
  }
  function MapScreen(root) {
    const current = LEVELS.find(lv => isUnlocked(lv) && !levelDone(lv)) || null;
    root.innerHTML =
      '<div class="screen">' + topbar('#/', 'Pilih Level', starPill()) +
      D.stages.map(st => {
        const lvs = LEVELS.filter(l => l.stage === st.id);
        const done = lvs.filter(levelDone).length;
        return '<section class="stage" style="--sc:' + st.color + '">' +
          '<div class="stage-head"><span class="stage-ico">' + st.icon + '</span><div><b>' + st.name + ' · ' + st.title + '</b><small>' + done + '/' + lvs.length + ' level selesai</small></div></div>' +
          '<div class="lv-grid">' + lvs.map(lv => tileHTML(lv, lv === current)).join('') + '</div></section>';
      }).join('') +
      '<p class="hint center">Selesaikan satu permainan di sebuah level untuk membuka level berikutnya 🔓</p></div>';
    $$('.lv-tile', root).forEach(t => {
      t.onclick = () => {
        const lv = getLevel(t.dataset.n);
        if (!isUnlocked(lv)) {
          Sfx.play('lock');
          restart(t, 'shake');
          toast('🔒 Selesaikan level ' + (lv.n - 1) + ' dulu, ya!');
          if (idOn()) Voice.play(clipUi('terkunci'));
          return;
        }
        Sfx.play('tap');
        location.hash = '#/level/' + lv.n;
      };
    });
    const cur = $('.lv-tile.current', root);
    if (cur && current.idx > 1) later(() => cur.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    if (!session.mapIntro && idOn()) { session.mapIntro = true; Voice.play(clipUi('pilihlevel')); }
  }

  /* ================= Layar: Menu level ================= */
  function LevelScreen(root, m) {
    const lv = guardLevel(m[1]);
    if (!lv) return;
    Voice.load(lv.key);
    const rec = Store.d.levels[lv.n] || {}, g = rec.games || {};
    const acts = [
      ['belajar', '📖', 'Belajar Kata', 'Lihat, dengar & tirukan', rec.learned ? '<span class="done-tag">✔ Sudah</span>' : '<span class="new-tag">Mulai di sini</span>', '#4cc9f0'],
      ['dengar', '👂', 'Dengar & Pilih', 'Dengar, lalu pilih gambarnya', starsHTML(g.dengar || 0), '#f72585'],
      ['tebak', '🖼️', 'Tebak Kata', 'Apa bahasa Inggrisnya?', starsHTML(g.tebak || 0), '#7b2cbf'],
      ['memori', '🃏', 'Kartu Memori', 'Cari pasangan kartunya', starsHTML(g.memori || 0), '#f8961e']
    ];
    root.innerHTML =
      '<div class="screen" style="--lc:' + lv.color + '">' + topbar('#/peta', 'Level ' + lv.n, starPill()) +
      '<button class="lv-banner" id="banner"><span class="ico">' + lv.icon + '</span><span class="t"><b>' + esc(lv.name) + '</b><i>' + esc(lv.en) + '</i></span><span class="spk">🔊</span></button>' +
      '<div class="chips" aria-label="Kata di level ini">' + lv.words.map((w, i) => '<button class="chip" data-i="' + i + '" aria-label="' + esc(w.en) + '">' + picHTML(w) + '</button>').join('') + '</div>' +
      '<div class="acts">' + acts.map(a => '<a class="act" href="#/level/' + lv.n + '/' + a[0] + '" style="--ac:' + a[5] + '"><span class="a-ico">' + a[1] + '</span><b>' + a[2] + '</b><small>' + a[3] + '</small>' + a[4] + '</a>').join('') + '</div>' +
      '<p class="hint center">Tips: mulai dari <b>Belajar Kata</b>, lalu mainkan permainannya untuk mendapat bintang ⭐</p>' +
      '</div>';
    const banner = $('#banner', root);
    const sayName = () => Voice.seq([idOn() ? clipLvId(lv) : null, clipLvEn(lv, banner)]);
    banner.onclick = () => { Sfx.play('tap'); sayName(); };
    $$('.chip', root).forEach(ch => { ch.onclick = () => { bounce(ch); Voice.play(clipEn(lv.words[+ch.dataset.i], false, ch)); }; });
    $$('.act', root).forEach(a => a.addEventListener('click', () => Sfx.play('tap')));
    if (Store.d.settings.autoplay) sayName();
  }

  function GameScreen(root, m, sid) {
    const lv = guardLevel(m[1]);
    if (!lv) return;
    Voice.load(lv.key);
    ({ belajar: LearnScreen, dengar: ListenGame, tebak: GuessGame, memori: MemoryGame })[m[2]](root, lv, sid);
  }

  /* ================= Belajar kata (kartu) ================= */
  function LearnScreen(root, lv, sid) {
    const words = lv.words;
    const seen = new Set();
    let i = 0, dir = 0;
    root.innerHTML =
      '<div class="screen learn" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, 'Belajar Kata', '<span class="pill" id="cnt"></span>') +
      '<div class="dots" id="dots">' + words.map(() => '<i></i>').join('') + '</div>' +
      '<div class="learn-main"><div class="flash" id="card"></div></div>' +
      '<div class="learn-ctrl">' +
        '<button class="btn nav" id="prev" aria-label="Kata sebelumnya">' + ICON.prev + '</button>' +
        '<button class="btn ctrl" id="say">🔊<span>Dengar</span></button>' +
        '<button class="btn ctrl" id="slow">🐢<span>Pelan</span></button>' +
        (Mic.supported ? '<button class="btn ctrl" id="mic">🎤<span>Ucapkan</span></button>' : '') +
        '<button class="btn nav" id="next" aria-label="Kata berikutnya">' + ICON.next + '</button>' +
      '</div></div>';
    const card = $('#card', root), nextBtn = $('#next', root), prevBtn = $('#prev', root);

    function show(auto) {
      const w = words[i];
      seen.add(i);
      card.className = 'flash';
      // level Warna: kata Inggrisnya ditulis dengan warnanya sendiri (kecuali putih)
      const tint = w.color && w.color.toLowerCase() !== '#ffffff';
      card.style.setProperty('--wc', tint ? w.color : '');
      card.classList.toggle('tinted', !!tint);
      if (dir) { void card.offsetWidth; card.classList.add(dir > 0 ? 'in-next' : 'in-prev'); }
      card.innerHTML =
        '<button class="flash-pic" id="pic" aria-label="Dengar kata">' + picHTML(w) + '</button>' +
        '<div class="txt">' +
          '<div class="ind-row"><i class="flag-id" title="Bahasa Indonesia"></i><span>' + esc(w.ind) + '</span></div>' +
          '<button class="en-word" id="enw"><span class="en-tag">EN</span><span class="w">' + esc(w.en) + '</span></button>' +
          '<div class="ucap">dibaca: <b>' + esc(w.ucap) + '</b></div>' +
        '</div>';
      $('#cnt', root).textContent = (i + 1) + ' / ' + words.length;
      $$('#dots i', root).forEach((d, k) => { d.className = k === i ? 'on' : seen.has(k) ? 'seen' : ''; });
      prevBtn.disabled = i === 0;
      const last = i === words.length - 1;
      nextBtn.innerHTML = last ? ICON.check : ICON.next;
      nextBtn.classList.toggle('done', last);
      nextBtn.setAttribute('aria-label', last ? 'Selesai' : 'Kata berikutnya');
      $('#pic', card).onclick = () => { bounce($('#pic', card)); sayEn(false); };
      $('#enw', card).onclick = () => sayEn(false);
      if (auto) narrate();
    }
    function narrate(intro) {
      const w = words[i], enw = $('#enw', card);
      const list = idOn() ? [intro ? clipUi('belajar') : null, clipId(w), clipUi('inggrisnya'), clipEn(w, false, enw)] : [clipEn(w, false, enw)];
      Voice.seq(list);
    }
    function sayEn(slow) { Voice.play(clipEn(words[i], slow, $('#enw', card))); }
    function go(step) {
      if (modalOpen()) return;
      if (step > 0 && i === words.length - 1) { finish(); return; }
      const ni = i + step;
      if (ni < 0 || ni >= words.length) return;
      Sfx.play('flip');
      dir = step;
      i = ni;
      show(Store.d.settings.autoplay);
    }
    function finish() {
      Store.lv(lv.n).learned = true;
      Store.save();
      Sfx.play('win');
      Confetti.burst(150);
      const m = openModal(
        '<div class="big-emoji">🎉</div><h2>Hebat' + nameSuffix() + '!</h2>' +
        '<p>Kamu sudah belajar <b>' + words.length + ' kata</b> tentang <b>' + esc(lv.name) + '</b>.</p><p>Sekarang ayo bermain untuk dapat bintang ⭐</p>' +
        '<div class="res-btns">' +
          '<a class="btn btn-pink" href="#/level/' + lv.n + '/dengar">👂 Dengar & Pilih</a>' +
          '<a class="btn btn-purple" href="#/level/' + lv.n + '/tebak">🖼️ Tebak Kata</a>' +
          '<a class="btn btn-orange" href="#/level/' + lv.n + '/memori">🃏 Kartu Memori</a>' +
          '<button class="btn" id="again">🔁 Ulangi dari awal</button>' +
        '</div>', { cls: 'result' });
      $('#again', m).onclick = () => { closeModal(); i = 0; dir = 0; seen.clear(); show(true); };
      Voice.seq([clipUi('youdidit'), idOn() ? clipUi('selesaibelajar') : null]);
    }
    function practice() {
      const w = words[i];
      const m = openModal(
        '<div class="mic-wrap">' + picHTML(w) + '<div class="mic-word">' + esc(w.en) + '</div>' +
        '<div class="mic-ring" id="ring">🎤</div><p class="mic-status" id="st">Dengarkan dulu…</p>' +
        '<div class="res-btns"><button class="btn btn-green" id="retry" hidden>🔁 Coba lagi</button><button class="btn" id="close">Tutup</button></div></div>',
        { cls: 'mic-modal' });
      const st = $('#st', m), ring = $('#ring', m), retry = $('#retry', m);
      $('#close', m).onclick = () => { Mic.stop(); Voice.stop(); closeModal(); };
      retry.onclick = run;
      async function run() {
        retry.hidden = true;
        ring.className = 'mic-ring';
        ring.textContent = '🎤';
        st.textContent = 'Dengarkan dulu…';
        await Voice.seq([clipEn(w), idOn() ? clipUi('ucapkan') : null]);
        if (!m.isConnected) return;
        st.innerHTML = 'Sekarang giliranmu! Ucapkan: <b>' + esc(w.en) + '</b>';
        ring.classList.add('listen');
        Sfx.play('tap');
        const r = await Mic.listen(w);
        if (!m.isConnected) return;
        ring.classList.remove('listen');
        if (r.ok) {
          ring.classList.add('ok');
          ring.textContent = '🌟';
          st.innerHTML = 'Hebat! Ucapanmu benar 👏<br><small class="muted">Terdengar: “' + esc(r.heard) + '”</small>';
          Sfx.play('ok');
          Confetti.burst(90);
          Voice.play(praiseClip());
        } else if (r.error === 'not-allowed' || r.error === 'service-not-allowed') {
          st.textContent = 'Mikrofon belum diizinkan. Izinkan akses mikrofon di browser, lalu coba lagi.';
        } else if (r.error === 'network') {
          st.textContent = 'Latihan ucapan butuh internet. Coba lagi saat online, ya.';
        } else if (r.error === 'unsupported' || r.error === 'start') {
          st.textContent = 'Browser ini belum mendukung latihan ucapan. Coba pakai Google Chrome.';
        } else {
          ring.classList.add('try');
          st.innerHTML = r.heard ? 'Hampir! Terdengar: “' + esc(r.heard) + '”. Coba lagi, ya!' : 'Suaramu belum terdengar. Coba lagi lebih keras, ya!';
          Voice.seq([clipUi('goodtry'), clipEn(w)]);
        }
        retry.hidden = false;
      }
      run();
    }

    prevBtn.onclick = () => go(-1);
    nextBtn.onclick = () => go(1);
    $('#say', root).onclick = () => sayEn(false);
    $('#slow', root).onclick = () => sayEn(true);
    const mic = $('#mic', root);
    if (mic) mic.onclick = practice;

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
      else if (e.key === ' ') { e.preventDefault(); sayEn(false); }
    };
    document.addEventListener('keydown', onKey);
    onCleanup(() => document.removeEventListener('keydown', onKey));

    show(false);
    if (Store.d.settings.autoplay) { narrate(!session.learnIntro); session.learnIntro = true; }
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
    const nextBtn = next && isUnlocked(next) ? '<a class="btn btn-green" href="#/level/' + next.n + '">▶ Lanjut ke Level ' + next.n + '</a>' : '';
    const m = openModal(
      '<div class="res-stars">' + [1, 2, 3].map(k => '<span class="rs' + (k <= stars ? ' on' : '') + '" style="--d:' + k + '">★</span>').join('') + '</div>' +
      '<h2>' + titles[stars] + nameSuffix() + '!</h2><p>' + detail + '</p>' +
      (prevBest && stars > prevBest ? '<p class="small">🏅 Rekor baru!</p>' : '') +
      (newOpen ? '<div class="unlock">🔓 Level baru terbuka!<br><b>' + next.icon + ' Level ' + next.n + ': ' + esc(next.name) + '</b></div>' : '') +
      '<div class="res-btns">' + (newOpen ? nextBtn : '') +
        '<button class="btn btn-orange" id="again">🔁 Main Lagi</button>' +
        '<a class="btn" href="#/level/' + lv.n + '">🎮 Pilih Permainan Lain</a>' +
        (newOpen ? '' : nextBtn) +
      '</div>', { cls: 'result' });
    $('#again', m).onclick = render;
    Voice.seq([clipUi('youdidit'), idOn() ? clipUi('selamat') : null, newOpen && idOn() ? clipUi('levelbaru') : null]);
  }

  /* ================= Permainan: Dengar & Pilih ================= */
  function ListenGame(root, lv, sid) {
    const n = Math.min(lv.stg.options, lv.words.length);
    const qs = shuffle(lv.words.slice());
    let qi = 0, mistakes = 0, firstTry = true, busy = false, right = 0, list = [];
    root.innerHTML =
      '<div class="screen quiz" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, 'Dengar & Pilih', '<span class="pill" id="cnt"></span>') +
      '<div class="progress"><i id="bar"></i></div>' +
      '<div class="prompt"><button class="btn speaker" id="spk" aria-label="Dengar lagi">🔊</button><div class="prompt-text">Dengarkan, lalu pilih gambar yang benar!</div></div>' +
      '<div class="options n' + n + '" id="opts"></div></div>';
    const spk = $('#spk', root), opts = $('#opts', root), bar = $('#bar', root);
    const sayQ = intro => Voice.seq([intro && idOn() ? clipUi('dengar') : null, clipEn(qs[qi], false, spk)]);
    spk.onclick = () => sayQ(false);

    function showQ(first) {
      const w = qs[qi];
      firstTry = true;
      busy = false;
      list = shuffle([w].concat(shuffle(lv.words.filter(x => x !== w)).slice(0, n - 1)));
      opts.innerHTML = list.map((o, k) => '<button class="opt" data-k="' + k + '" aria-label="Pilihan ' + (k + 1) + '">' + picHTML(o) + '<span class="lab"></span></button>').join('');
      $('#cnt', root).textContent = (qi + 1) + ' / ' + qs.length;
      bar.style.width = (qi / qs.length * 100) + '%';
      $$('.opt', opts).forEach(b => { b.onclick = () => answer(b, list[+b.dataset.k]); });
      sayQ(first);
    }
    async function answer(b, o) {
      if (busy) return;
      const w = qs[qi];
      if (o !== w) {
        mistakes++;
        firstTry = false;
        b.classList.add('wrong');
        Sfx.play('no');
        Voice.seq([clipUi(pick(['tryagain', 'oops'])), clipEn(w, false, spk)]);
        return;
      }
      busy = true;
      if (firstTry) right++;
      b.classList.add('right');
      $('.lab', b).textContent = w.en;
      $$('.opt', opts).forEach(x => { if (x !== b && !x.classList.contains('wrong')) x.classList.add('dim'); });
      bar.style.width = ((qi + 1) / qs.length * 100) + '%';
      Sfx.play('ok');
      collect(w);
      await Voice.seq([clipEn(w, false, b), praiseClip()]);
      if (!alive(sid)) return;
      await sleep(250);
      if (!alive(sid)) return;
      qi++;
      if (qi < qs.length) showQ(false);
      else finishGame(lv, 'dengar', starsFor(mistakes, 1, 4), 'Benar pada percobaan pertama: <b>' + right + '</b> dari ' + qs.length);
    }
    showQ(true);
  }

  /* ================= Permainan: Tebak Kata ================= */
  function GuessGame(root, lv, sid) {
    const n = Math.min(lv.stg.options, lv.words.length);
    const qs = shuffle(lv.words.slice());
    let qi = 0, mistakes = 0, firstTry = true, busy = false, right = 0, list = [];
    root.innerHTML =
      '<div class="screen quiz" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, 'Tebak Kata', '<span class="pill" id="cnt"></span>') +
      '<div class="progress"><i id="bar"></i></div>' +
      '<div class="guess-wrap">' +
        '<div class="guess-top"><button class="guess-pic" id="gpic" aria-label="Dengar artinya"></button><div class="ind-row" id="gind"></div><div class="q">Apa bahasa Inggrisnya? 🤔</div></div>' +
        '<div class="word-opts" id="wopts"></div>' +
      '</div></div>';
    const gpic = $('#gpic', root), wopts = $('#wopts', root), bar = $('#bar', root);
    gpic.onclick = () => { bounce(gpic); if (idOn()) Voice.play(clipId(qs[qi])); };

    function showQ(first) {
      const w = qs[qi];
      firstTry = true;
      busy = false;
      list = shuffle([w].concat(shuffle(lv.words.filter(x => x !== w && x.en !== w.en)).slice(0, n - 1)));
      gpic.innerHTML = picHTML(w);
      restart(gpic, 'boing');
      $('#gind', root).innerHTML = '<i class="flag-id"></i><span>' + esc(w.ind) + '</span>';
      wopts.innerHTML = list.map((o, k) =>
        '<div class="wopt" data-k="' + k + '"><button class="btn wopt-spk" aria-label="Dengar ' + esc(o.en) + '">🔊</button><button class="btn wopt-btn">' + esc(o.en) + '</button></div>').join('');
      $$('.wopt', wopts).forEach(row => {
        const o = list[+row.dataset.k];
        $('.wopt-spk', row).onclick = () => Voice.play(clipEn(o, false, row));
        $('.wopt-btn', row).onclick = () => answer(row, o);
      });
      $('#cnt', root).textContent = (qi + 1) + ' / ' + qs.length;
      bar.style.width = (qi / qs.length * 100) + '%';
      if (idOn()) Voice.seq([first ? clipUi('tebak') : null, clipId(w)]);
      else Voice.stop();
    }
    async function answer(row, o) {
      if (busy) return;
      const w = qs[qi];
      if (o !== w) {
        mistakes++;
        firstTry = false;
        row.classList.add('wrong');
        Sfx.play('no');
        Voice.play(clipUi(pick(['tryagain', 'oops'])));
        return;
      }
      busy = true;
      if (firstTry) right++;
      row.classList.add('right');
      $$('.wopt', wopts).forEach(x => { if (x !== row && !x.classList.contains('wrong')) x.classList.add('dim'); });
      bar.style.width = ((qi + 1) / qs.length * 100) + '%';
      Sfx.play('ok');
      collect(w);
      await Voice.seq([clipEn(w, false, row), praiseClip()]);
      if (!alive(sid)) return;
      await sleep(250);
      if (!alive(sid)) return;
      qi++;
      if (qi < qs.length) showQ(false);
      else finishGame(lv, 'tebak', starsFor(mistakes, 1, 4), 'Benar pada percobaan pertama: <b>' + right + '</b> dari ' + qs.length);
    }
    showQ(true);
  }

  /* ================= Permainan: Kartu Memori ================= */
  function MemoryGame(root, lv, sid) {
    const pairs = Math.min(lv.stg.pairs, lv.words.length);
    const ws = shuffle(lv.words.slice()).slice(0, pairs);
    const cards = shuffle(ws.reduce((a, w) => a.concat([{ w: w, t: 'pic' }, { w: w, t: 'word' }]), []));
    let open = [], moves = 0, found = 0, busy = false;
    root.innerHTML =
      '<div class="screen quiz memory" style="--lc:' + lv.color + '">' + topbar('#/level/' + lv.n, 'Kartu Memori', '<span class="pill" title="Langkah">👣 <b id="moves">0</b></span>') +
      '<div class="mem-info"><span>Cari pasangan <b>gambar</b> &amp; <b>kata</b>-nya!</span><span class="pill small">✅ <span><b id="found">0</b>/' + pairs + '</span></span></div>' +
      '<div class="mem-grid" id="grid">' + cards.map((c, k) =>
        '<button class="mcard" data-k="' + k + '" aria-label="Kartu ' + (k + 1) + '"><span class="mc-inner">' +
        '<span class="mc-face mc-back">❓</span>' +
        '<span class="mc-face mc-front">' + (c.t === 'pic' ? picHTML(c.w) : '<span class="mc-word">' + esc(c.w.en) + '</span>') + '</span>' +
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
        const longest = el.textContent.split(' ').reduce((mx, s) => Math.max(mx, s.length), 1);
        el.style.fontSize = Math.max(11, Math.min(cw * 0.22, (cw * 1.5) / longest)) + 'px';
      });
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
      if (open.length < 2) { Voice.play(clipEn(c.w)); return; }
      moves++;
      $('#moves', root).textContent = moves;
      const a = open[0], b = open[1];
      open = [];
      const ca = cards[+a.dataset.k];
      if (ca.w === c.w) {
        Voice.seq([clipEn(c.w), praiseClip()]);
        later(() => {
          a.classList.add('matched');
          b.classList.add('matched');
          Sfx.play('match');
          collect(c.w);
          found++;
          $('#found', root).textContent = found;
          if (found === pairs) {
            later(() => finishGame(lv, 'memori', moves <= pairs + 2 ? 3 : moves <= pairs * 2 + 1 ? 2 : 1, 'Semua pasangan ditemukan dalam <b>' + moves + '</b> langkah'), 1300);
          }
        }, 380);
      } else {
        Voice.play(clipEn(c.w));
        busy = true;
        later(() => { a.classList.remove('open'); b.classList.remove('open'); busy = false; }, 1300);
      }
    }
    if (idOn()) Voice.play(clipUi('memori'));
  }

  /* ================= Album stiker ================= */
  function Album(root) {
    const got = Store.d.stickers, total = WORDS.length, cnt = stickerCount();
    root.innerHTML =
      '<div class="screen">' + topbar('#/', 'Album Stiker', '<span class="pill">🏅 <span><b>' + cnt + '</b>/' + total + '</span></span>') +
      '<div class="card"><div class="sum-row"><span class="big-emoji sm">🏅</span><div><b>' + cnt + ' dari ' + total + ' stiker</b><small>Jawab benar di permainan untuk mengumpulkan stiker baru!</small></div></div>' +
      '<div class="progress"><i style="width:' + (cnt / total * 100) + '%"></i></div></div>' +
      LEVELS.map(lv => {
        const g = lv.words.filter(w => got[w.uid]).length;
        return '<section class="alb"><h3><span class="emo-i">' + lv.icon + '</span> ' + esc(lv.name) + ' <small>' + g + '/' + lv.words.length + '</small></h3><div class="alb-grid">' +
          lv.words.map(w => got[w.uid]
            ? '<button class="stk got" data-uid="' + w.uid + '">' + picHTML(w) + '<span>' + esc(w.en) + '</span></button>'
            : '<div class="stk">' + picHTML(w) + '<span>?</span></div>').join('') +
          '</div></section>';
      }).join('') + '</div>';
    $$('.stk.got', root).forEach(b => { b.onclick = () => { bounce(b); Voice.play(clipEn(WORD_BY_UID[b.dataset.uid], false, b)); }; });
    if (idOn() && !session.albumIntro) { session.albumIntro = true; Voice.play(clipUi('album')); }
  }

  /* ================= Kamus ================= */
  function Kamus(root) {
    root.innerHTML =
      '<div class="screen">' + topbar('#/', 'Kamus Kata', '<span class="pill">📚 ' + WORDS.length + '</span>') +
      '<input class="input search" id="q" type="search" placeholder="🔍 Cari kata (Indonesia / Inggris)…" autocomplete="off">' +
      '<div id="list"></div></div>';
    const list = $('#list', root);
    function draw(q) {
      q = q.trim().toLowerCase();
      let html = '';
      for (const lv of LEVELS) {
        const ws = lv.words.filter(w => !q || w.en.toLowerCase().indexOf(q) >= 0 || w.ind.toLowerCase().indexOf(q) >= 0);
        if (!ws.length) continue;
        html += '<div class="k-head"><span class="emo-i">' + lv.icon + '</span> Level ' + lv.n + ' · ' + esc(lv.name) + ' <small>' + esc(lv.en) + '</small></div>' +
          ws.map(w => '<div class="k-row" data-uid="' + w.uid + '">' + picHTML(w) +
            '<div class="k-txt"><b>' + esc(w.en) + '</b><span>' + esc(w.ind) + '</span><small>dibaca: ' + esc(w.ucap) + '</small></div>' +
            '<button class="btn k-btn" data-a="n" aria-label="Dengar ' + esc(w.en) + '">🔊</button>' +
            '<button class="btn k-btn" data-a="s" aria-label="Dengar pelan ' + esc(w.en) + '">🐢</button></div>').join('');
      }
      list.innerHTML = html || '<p class="hint center">Kata tidak ditemukan 🙈</p>';
    }
    list.addEventListener('click', e => {
      const b = e.target.closest('.k-btn');
      if (!b) return;
      const row = b.closest('.k-row');
      Voice.play(clipEn(WORD_BY_UID[row.dataset.uid], b.dataset.a === 's', row));
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
    const mini = n => '<span class="st">' + [1, 2, 3].map(i => i <= (n || 0) ? '★' : '<span class="off">★</span>').join('') + '</span>';
    const toggleRow = (k, t, d) => '<div class="row"><label for="t-' + k + '">' + t + '<small>' + d + '</small></label><span class="sw"><input type="checkbox" id="t-' + k + '" data-k="' + k + '"' + (s[k] ? ' checked' : '') + '><i></i></span></div>';
    const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
    const httpOk = /^https?:$/.test(location.protocol) && 'caches' in window;
    root.innerHTML =
      '<div class="screen parent">' + topbar('#/', 'Orang Tua', '') +
      '<section class="card"><h2>👧 Profil Anak</h2>' +
        '<label class="field">Nama anak<small>Dipakai untuk menyapa di layar utama</small><input class="input" id="name" type="text" maxlength="20" placeholder="mis. Budi" value="' + esc(Store.d.name) + '"></label></section>' +
      '<section class="card"><h2>📈 Perkembangan</h2>' +
        '<div class="stats"><div class="stat"><b>' + done + '/' + LEVELS.length + '</b><small>Level selesai</small></div>' +
        '<div class="stat"><b>' + totalStars() + '</b><small>Bintang</small></div>' +
        '<div class="stat"><b>' + stickerCount() + '/' + WORDS.length + '</b><small>Kata dikuasai</small></div></div>' +
        '<div class="table-wrap"><table class="prog"><thead><tr><th>Level</th><th title="Belajar Kata">📖</th><th title="Dengar & Pilih">👂</th><th title="Tebak Kata">🖼️</th><th title="Kartu Memori">🃏</th></tr></thead><tbody>' +
        LEVELS.map(lv => {
          const r = Store.d.levels[lv.n] || {}, g = r.games || {};
          return '<tr class="' + (isUnlocked(lv) ? '' : 'lk') + '"><td><span class="emo-i">' + lv.icon + '</span> ' + lv.n + '. ' + esc(lv.name) + '</td><td>' + (r.learned ? '✔' : '–') + '</td><td>' + mini(g.dengar) + '</td><td>' + mini(g.tebak) + '</td><td>' + mini(g.memori) + '</td></tr>';
        }).join('') +
        '</tbody></table></div><p class="small muted">📖 Belajar Kata · 👂 Dengar & Pilih · 🖼️ Tebak Kata · 🃏 Kartu Memori</p></section>' +
      '<section class="card" id="voicecard"><h2>🔊 Suara</h2>' +
        '<div class="row"><label for="src">Sumber suara<small>Rekaman: jelas, sama di semua perangkat & bisa offline. Perangkat: suara bawaan HP/komputer.</small></label>' +
          '<select class="input sel" id="src"><option value="rekaman">Rekaman (disarankan)</option><option value="perangkat">Suara perangkat</option></select></div>' +
        '<div class="row tts-only"><label for="tv">Suara bahasa Inggris perangkat<small id="tvinfo"></small></label><select class="input sel" id="tv"></select></div>' +
        '<div class="row tts-only"><label for="rate">Kecepatan suara perangkat<small id="rateval"></small></label><input type="range" id="rate" min="0.6" max="1.2" step="0.05"></div>' +
        toggleRow('idVoice', 'Bacakan bahasa Indonesia', 'Instruksi & arti kata ikut dibacakan dalam bahasa Indonesia') +
        toggleRow('autoplay', 'Putar suara otomatis', 'Kata langsung dibacakan saat kartu/level dibuka') +
        toggleRow('sfx', 'Efek suara', 'Bunyi benar, salah, membalik kartu & hore') +
        '<div class="row"><label>Tes suara<small>Pastikan volume perangkat tidak dibisukan</small></label><button class="btn btn-blue" id="test">▶ Tes</button></div></section>' +
      '<section class="card"><h2>🗺️ Level</h2>' +
        toggleRow('unlockAll', 'Buka semua level', 'Anak boleh memilih level mana saja tanpa menyelesaikan level sebelumnya') + '</section>' +
      '<section class="card"><h2>📱 Aplikasi</h2>' +
        '<div class="row"><label>Pasang di layar utama<small id="instinfo">' +
          (standalone ? 'Sudah terpasang sebagai aplikasi ✔' : installPrompt ? 'Buka seperti aplikasi biasa, tanpa bilah alamat' : 'Di Chrome: menu ⋮ → “Tambahkan ke layar utama”. Di iPhone: tombol Bagikan → “Tambah ke Layar Utama”.') +
        '</small></label>' + (installPrompt && !standalone ? '<button class="btn" id="inst">📲 Pasang</button>' : '') + '</div>' +
        '<div class="row"><label>Simpan untuk offline<small id="offst">' +
          (httpOk ? 'Unduh semua suara (±' + AUDIO_SIZE_MB + ' MB) agar bisa dipakai tanpa internet' : 'Aplikasi dibuka dari file di perangkat ini, jadi semua suara sudah tersedia offline.') +
        '</small></label>' + (httpOk ? '<button class="btn" id="off">💾 Simpan</button>' : '') + '</div>' +
        '<div class="row"><label>Hapus semua kemajuan<small>Bintang, stiker & level kembali ke awal</small></label><button class="btn btn-red" id="reset">🗑️ Hapus</button></div></section>' +
      '<section class="card about"><h2>ℹ️ Tentang</h2>' +
        '<p><b>English Ceria</b> v' + APP_VERSION + ' — ' + LEVELS.length + ' level, ' + WORDS.length + ' kosakata, 3 permainan.</p>' +
        '<p class="small">Tips: dampingi anak 10–15 menit sehari. Mulai dari <b>Belajar Kata</b>, ajak anak menirukan ucapannya, lalu mainkan <b>Dengar & Pilih</b>. Sesekali ulangi level yang sudah selesai.</p>' +
        '<p class="small muted">Tulisan “dibaca” hanyalah panduan kira-kira untuk orang tua; ikuti suara rekaman untuk pengucapan yang tepat. Gambar memakai emoji bawaan perangkat. Rekaman suara dibuat dengan suara neural Microsoft (edge-tts).</p></section>' +
      '</div>';

    const nameIn = $('#name', root);
    nameIn.addEventListener('input', () => { Store.d.name = nameIn.value.trim().slice(0, 20); Store.save(); });

    const src = $('#src', root), tv = $('#tv', root), rate = $('#rate', root), voiceCard = $('#voicecard', root);
    src.value = s.voice;
    const syncSrc = () => $$('.tts-only', voiceCard).forEach(r => { r.hidden = src.value !== 'perangkat'; });
    syncSrc();
    src.onchange = () => { s.voice = src.value; Store.save(); syncSrc(); };
    const fillVoices = () => {
      const vs = ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^en([-_]|$)/i.test(v.lang));
      tv.innerHTML = '<option value="">Otomatis</option>' + vs.map(v => '<option value="' + esc(v.voiceURI) + '">' + esc(v.name) + ' (' + esc(v.lang) + ')</option>').join('');
      tv.value = vs.some(v => v.voiceURI === s.ttsVoice) ? s.ttsVoice : '';
      const hasId = !!Voice.ttsVoice('id');
      $('#tvinfo', root).textContent = (vs.length ? vs.length + ' suara Inggris tersedia' : 'Tidak ada suara bahasa Inggris di perangkat ini — rekaman tetap dipakai') +
        (hasId ? '' : '. Suara bahasa Indonesia tidak tersedia — memakai rekaman.');
    };
    fillVoices();
    if ('speechSynthesis' in window) {
      try {
        speechSynthesis.addEventListener('voiceschanged', fillVoices);
        onCleanup(() => speechSynthesis.removeEventListener('voiceschanged', fillVoices));
      } catch (e) { /* abaikan */ }
    }
    tv.onchange = () => { s.ttsVoice = tv.value; Store.save(); };
    rate.value = s.rate;
    const showRate = () => { $('#rateval', root).textContent = 'Kecepatan: ' + Math.round(rate.value * 100) + '%'; };
    showRate();
    rate.oninput = () => { s.rate = +rate.value; Store.save(); showRate(); };
    $$('.sw input', root).forEach(inp => {
      inp.onchange = () => {
        s[inp.dataset.k] = inp.checked;
        Store.save();
        if (inp.dataset.k === 'sfx' && inp.checked) Sfx.play('ok');
      };
    });
    $('#test', root).onclick = () => Voice.seq([clipUi('hello'), clipEn(LEVELS[0].words[0]), idOn() ? clipUi('welcome') : null]);
    const inst = $('#inst', root);
    if (inst) inst.onclick = doInstall;
    const off = $('#off', root);
    if (off) off.onclick = () => saveOffline(off, $('#offst', root));
    $('#reset', root).onclick = () => {
      const m = openModal('<div class="big-emoji">🗑️</div><h2>Hapus kemajuan?</h2><p>Semua bintang, stiker, dan level yang terbuka akan kembali ke awal. Pengaturan tetap disimpan.</p>' +
        '<div class="res-btns"><button class="btn btn-red" id="yes">Ya, hapus</button><button class="btn" id="no">Batal</button></div>', { dismiss: true });
      $('#yes', m).onclick = () => { Store.reset(); closeModal(); toast('Kemajuan sudah dihapus'); render(); };
      $('#no', m).onclick = closeModal;
    };
  }

  async function saveOffline(btn, status) {
    const files = ['audio/ui.js'].concat(LEVELS.map(l => 'audio/' + l.key + '.js'));
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) { Voice.stop(); Mic.stop(); } });
  window.addEventListener('hashchange', render);
  render();
  // muat suara instruksi lebih awal supaya tidak menunggu saat pertama dipakai
  setTimeout(() => Voice.load('ui', true), 1200);
})();
