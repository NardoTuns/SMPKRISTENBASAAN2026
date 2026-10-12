/**
 * CORE: fungsi bersama untuk halaman Login, Guru, dan Admin.
 * SMP KRISTEN 65 BASAAN
 */
(function () {
  const CFG = window.APP_CONFIG || {};

  /* ===========================================================
     PENYIMPANAN LOKAL (localStorage)
     =========================================================== */
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        toast('Penyimpanan HP penuh / diblokir. Data mungkin tidak tersimpan.', 'error');
        return false;
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* abaikan */ }
    },
    sizeKB() {
      let total = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf('rpt_') === 0) total += (localStorage.getItem(k) || '').length;
        }
      } catch (e) { /* abaikan */ }
      return Math.round(total / 1024);
    }
  };

  const KEY = {
    session: 'rpt_session',
    db: 'rpt_db',
    guruNilai: 'rpt_guru_nilai',
    guruDesk: 'rpt_guru_desk',
    guruPrefs: 'rpt_guru_prefs',
    syncLog: 'rpt_sync_log',
    demo: 'rpt_demo_db',
    theme: 'theme'
  };

  /* ===========================================================
     UTILITAS
     =========================================================== */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtNum(val, digits) {
    if (val === null || val === undefined || val === '' || isNaN(val)) return '-';
    const num = parseFloat(val);
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(digits === undefined ? 1 : digits);
  }

  function isFilled(v) {
    return v !== null && v !== undefined && v !== '' && !isNaN(parseFloat(v));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function fmtDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function uid(prefix) {
    return (prefix || 'ID') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function toast(message, type) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.innerHTML = '<span>' + esc(message) + '</span>';
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 5500 : 3500);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 4000);
  }

  function safeFileName(s) {
    return String(s || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_');
  }

  function tingkatOf(kelas) {
    const m = String(kelas || '').match(/\d+/);
    return m ? m[0] : '';
  }

  function romawi(n) {
    const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII' };
    return map[parseInt(n, 10)] || String(n || '');
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  /* ===========================================================
     SESI
     =========================================================== */
  function getSession() {
    return Store.get(KEY.session, null);
  }

  function setSession(s) {
    Store.set(KEY.session, s);
  }

  function logout(target) {
    Store.remove(KEY.session);
    window.location.href = target || 'index.html';
  }

  function requireRole(role) {
    const s = getSession();
    if (!s || s.role !== role) {
      window.location.replace('index.html');
      return null;
    }
    return s;
  }

  function isDemo() {
    const s = getSession();
    return !CFG.API_URL || (s && s.demo);
  }

  /* ===========================================================
     API (Google Apps Script) + BACKEND DEMO
     =========================================================== */
  async function api(action, payload) {
    const s = getSession() || {};
    const body = Object.assign({ action: action, key: CFG.API_KEY, user: s.nama || '-', role: s.role || '-' }, payload || {});

    if (isDemo()) return DemoBackend.handle(body);

    if (!isOnline()) throw new Error('Tidak ada koneksi internet');
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), 60000);
    let res;
    try {
      res = await fetch(CFG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'Server terlalu lama merespons, coba lagi' : 'Gagal terhubung ke server. Periksa internet / URL API.');
    } finally {
      clearTimeout(timer);
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('Respons server tidak valid. Pastikan Apps Script sudah di-deploy sebagai Aplikasi Web (akses: Siapa saja).');
    }
    if (!json.ok) throw new Error(json.message || 'Terjadi kesalahan di server');
    return json.data;
  }

  // Meniru perilaku backend/Code.gs memakai localStorage (Mode Demo)
  const DemoBackend = {
    load() {
      let db = Store.get(KEY.demo, null);
      if (!db) {
        const S = window.SEED;
        db = {
          config: Object.assign({}, S.config),
          kelas: S.kelas.slice(),
          mapel: S.mapel.slice(),
          siswa: S.demoSiswa(),
          nilai: [],
          deskripsi: S.deskripsi.slice(),
          pelengkap: [],
          log: []
        };
        // isi sebagian nilai contoh agar fitur analisis bisa dicoba
        const bank = {};
        db.deskripsi.forEach(d => { (bank[d.Kode_Mapel] = bank[d.Kode_Mapel] || []).push(d.Teks); });
        db.siswa.forEach((s, si) => {
          db.mapel.forEach((m, mi) => {
            if ((si + mi) % 7 === 0) return; // sengaja ada yang kosong
            const list = bank[m.Kode] || [];
            const v = 60 + ((si * 13 + mi * 7) % 38);
            db.nilai.push({
              ID: s.NISN + '|' + m.Kode, NISN: s.NISN, Kelas: s.Kelas, Kode_Mapel: m.Kode,
              Nilai: v, Nilai_Keterampilan: '', Deskripsi_Dikuasai: list[si % list.length] || '',
              Deskripsi_Ditingkatkan: list[(si + 1) % list.length] || '', Guru: 'Demo', Diperbarui: '2026-01-01T00:00:00.000Z'
            });
          });
        });
        Store.set(KEY.demo, db);
      }
      return db;
    },
    save(db) {
      Store.set(KEY.demo, db);
    },
    upsert(list, key, rows, withTime) {
      const idx = {};
      list.forEach((r, i) => { idx[String(r[key])] = i; });
      let saved = 0, skipped = 0;
      rows.forEach(r => {
        const k = String(r[key] || '').trim();
        if (!k) return;
        r[key] = k;
        if (withTime && !r.Diperbarui) r.Diperbarui = nowIso();
        if (idx[k] !== undefined) {
          const old = list[idx[k]];
          if (withTime && old.Diperbarui && String(old.Diperbarui) > String(r.Diperbarui)) { skipped++; return; }
          list[idx[k]] = Object.assign({}, old, r);
        } else {
          idx[k] = list.length;
          list.push(r);
        }
        saved++;
      });
      return { saved, skipped };
    },
    log(db, req, aksi, detail) {
      db.log.push({ Waktu: nowIso(), Pengguna: req.user, Peran: req.role, Aksi: aksi, Detail: detail });
      if (db.log.length > 500) db.log = db.log.slice(-500);
    },
    async handle(req) {
      await new Promise(r => setTimeout(r, 250));
      const db = this.load();
      let out;
      const rm = (list, key, ids) => {
        const set = new Set((ids || []).map(String));
        const before = list.length;
        const kept = list.filter(r => !set.has(String(r[key])));
        return { kept, n: before - kept.length };
      };
      switch (req.action) {
        case 'ping': out = { pong: true }; break;
        case 'getAll':
          out = {
            config: Object.assign({}, db.config), kelas: db.kelas, mapel: db.mapel, siswa: db.siswa,
            nilai: db.nilai, deskripsi: db.deskripsi, pelengkap: db.pelengkap, serverTime: nowIso()
          };
          return JSON.parse(JSON.stringify(out));
        case 'seed': out = { seeded: false }; break;
        case 'syncNilai':
          (req.rows || []).forEach(r => { r.ID = String(r.NISN) + '|' + String(r.Kode_Mapel); });
          out = this.upsert(db.nilai, 'ID', req.rows || [], true);
          this.log(db, req, 'Sinkron Nilai', out.saved + ' disimpan' + (req.info ? ' | ' + req.info : ''));
          break;
        case 'deleteNilai': { const r = rm(db.nilai, 'ID', req.ids); db.nilai = r.kept; out = { deleted: r.n }; this.log(db, req, 'Hapus Nilai', r.n + ' baris'); break; }
        case 'saveDeskripsi': out = this.upsert(db.deskripsi, 'ID', req.rows || [], true); this.log(db, req, 'Simpan Deskripsi', out.saved + ' deskripsi'); break;
        case 'deleteDeskripsi': { const r = rm(db.deskripsi, 'ID', req.ids); db.deskripsi = r.kept; out = { deleted: r.n }; break; }
        case 'saveSiswa':
          if (req.mode === 'replace') { db.siswa = req.rows || []; out = { saved: db.siswa.length }; }
          else out = this.upsert(db.siswa, 'NISN', req.rows || [], false);
          this.log(db, req, 'Simpan Siswa', out.saved + ' siswa');
          break;
        case 'deleteSiswa': {
          const r = rm(db.siswa, 'NISN', req.ids); db.siswa = r.kept; out = { deleted: r.n };
          if (req.withNilai) {
            const set = new Set((req.ids || []).map(String));
            db.nilai = db.nilai.filter(n => !set.has(String(n.NISN)));
            db.pelengkap = db.pelengkap.filter(n => !set.has(String(n.NISN)));
          }
          this.log(db, req, 'Hapus Siswa', r.n + ' siswa');
          break;
        }
        case 'saveMapel': db.mapel = req.rows || []; out = { saved: db.mapel.length }; this.log(db, req, 'Simpan Mapel', ''); break;
        case 'saveKelas': db.kelas = req.rows || []; out = { saved: db.kelas.length }; this.log(db, req, 'Simpan Kelas', ''); break;
        case 'saveConfig': Object.assign(db.config, req.config || {}); out = { saved: true }; this.log(db, req, 'Simpan Pengaturan', ''); break;
        case 'savePelengkap': out = this.upsert(db.pelengkap, 'NISN', req.rows || [], false); this.log(db, req, 'Simpan Pelengkap Raport', out.saved + ' siswa'); break;
        case 'getLog': return db.log.slice().reverse();
        case 'restore': {
          const d = req.data || {};
          ['kelas', 'mapel', 'siswa', 'nilai', 'deskripsi', 'pelengkap'].forEach(k => { if (Array.isArray(d[k])) db[k] = d[k]; });
          if (d.config) db.config = d.config;
          out = { restored: true };
          break;
        }
        default: throw new Error('Aksi tidak dikenal: ' + req.action);
      }
      this.save(db);
      return JSON.parse(JSON.stringify(out));
    },
    reset() {
      Store.remove(KEY.demo);
    }
  };

  /* ===========================================================
     NORMALISASI DATA DARI SERVER
     =========================================================== */
  function parseBool(v, def) {
    if (v === true || v === false) return v;
    if (v === undefined || v === null || v === '') return def;
    const s = String(v).toLowerCase();
    return s === 'true' || s === 'y' || s === 'ya' || s === '1';
  }

  function normalizeConfig(raw) {
    const def = (window.SEED && window.SEED.config) || {};
    const c = Object.assign({}, def, raw || {});
    ['predikat_a', 'predikat_b', 'predikat_c'].forEach(k => { c[k] = parseFloat(c[k]) || def[k]; });
    ['tampilkan_keterangan', 'tampilkan_qr', 'tampilkan_keputusan'].forEach(k => { c[k] = parseBool(c[k], def[k]); });
    return c;
  }

  function str(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function normalizeDB(raw) {
    raw = raw || {};
    const kelas = (raw.kelas || []).map(k => ({
      kelas: str(k.Kelas), label: str(k.Label_Raport) || romawi(tingkatOf(k.Kelas)),
      wali: str(k.Wali_Kelas), nip: str(k.NIP_Wali), urut: num(k.Urut) || 99
    })).filter(k => k.kelas);
    kelas.sort((a, b) => (a.urut - b.urut) || a.kelas.localeCompare(b.kelas));

    const mapel = (raw.mapel || []).map(m => ({
      kode: str(m.Kode).toUpperCase(), nama: str(m.Nama), kelompok: str(m.Kelompok).toUpperCase() || 'A',
      kkm: num(m.KKM) || 75, urut: num(m.Urut) || 99, aktif: parseBool(m.Aktif, true)
    })).filter(m => m.kode);
    mapel.sort((a, b) => (a.urut - b.urut) || a.nama.localeCompare(b.nama));

    const siswa = (raw.siswa || []).map(s => ({
      nisn: str(s.NISN), nis: str(s.NIS), nama: str(s.Nama).toUpperCase(), kelas: str(s.Kelas).toUpperCase(),
      jk: str(s.JK).toUpperCase(), no: num(s.No_Absen)
    })).filter(s => s.nisn && s.nama);
    siswa.sort((a, b) => a.kelas.localeCompare(b.kelas) || ((a.no || 999) - (b.no || 999)) || a.nama.localeCompare(b.nama));

    const nilai = {};
    (raw.nilai || []).forEach(r => {
      const n = rowToNilai(r);
      if (n.nisn && n.kode) nilai[n.id] = n;
    });

    const deskripsi = (raw.deskripsi || []).map(d => ({
      id: str(d.ID), kode: str(d.Kode_Mapel).toUpperCase(), tingkat: str(d.Tingkat) || 'Semua',
      teks: str(d.Teks), oleh: str(d.Dibuat_Oleh), updated: str(d.Diperbarui)
    })).filter(d => d.id && d.teks);

    const pelengkap = {};
    (raw.pelengkap || []).forEach(p => {
      const nisn = str(p.NISN);
      if (nisn) pelengkap[nisn] = rowToPelengkap(p);
    });

    return {
      config: normalizeConfig(raw.config),
      kelas, mapel, siswa, nilai, deskripsi, pelengkap,
      serverTime: raw.serverTime || nowIso(),
      fetchedAt: nowIso()
    };
  }

  function rowToNilai(r) {
    const nisn = str(r.NISN), kode = str(r.Kode_Mapel).toUpperCase();
    return {
      id: nisn + '|' + kode, nisn, kode, kelas: str(r.Kelas).toUpperCase(),
      nilai: num(r.Nilai), nilai_k: num(r.Nilai_Keterampilan),
      kuasai: str(r.Deskripsi_Dikuasai), tingkatkan: str(r.Deskripsi_Ditingkatkan),
      guru: str(r.Guru), updated: str(r.Diperbarui)
    };
  }

  function nilaiToRow(n) {
    return {
      ID: n.nisn + '|' + n.kode, NISN: n.nisn, Kelas: n.kelas, Kode_Mapel: n.kode,
      Nilai: n.nilai === null || n.nilai === undefined ? '' : n.nilai,
      Nilai_Keterampilan: n.nilai_k === null || n.nilai_k === undefined ? '' : n.nilai_k,
      Deskripsi_Dikuasai: n.kuasai || '', Deskripsi_Ditingkatkan: n.tingkatkan || '',
      Guru: n.guru || '', Diperbarui: n.updated || nowIso()
    };
  }

  function rowToPelengkap(p) {
    return {
      nisn: str(p.NISN),
      sp_pred: str(p.Spiritual_Predikat), sp_desk: str(p.Spiritual_Deskripsi),
      so_pred: str(p.Sosial_Predikat), so_desk: str(p.Sosial_Deskripsi),
      ek1: str(p.Ekskul1), ek1_nilai: str(p.Ekskul1_Nilai), ek1_desk: str(p.Ekskul1_Deskripsi),
      ek2: str(p.Ekskul2), ek2_nilai: str(p.Ekskul2_Nilai), ek2_desk: str(p.Ekskul2_Deskripsi),
      sakit: str(p.Sakit), izin: str(p.Izin), alpa: str(p.Alpa),
      keputusan: str(p.Keputusan), catatan: str(p.Catatan_Wali), updated: str(p.Diperbarui)
    };
  }

  function pelengkapToRow(p) {
    return {
      NISN: p.nisn, Spiritual_Predikat: p.sp_pred || '', Spiritual_Deskripsi: p.sp_desk || '',
      Sosial_Predikat: p.so_pred || '', Sosial_Deskripsi: p.so_desk || '',
      Ekskul1: p.ek1 || '', Ekskul1_Nilai: p.ek1_nilai || '', Ekskul1_Deskripsi: p.ek1_desk || '',
      Ekskul2: p.ek2 || '', Ekskul2_Nilai: p.ek2_nilai || '', Ekskul2_Deskripsi: p.ek2_desk || '',
      Sakit: p.sakit || '', Izin: p.izin || '', Alpa: p.alpa || '',
      Keputusan: p.keputusan || '', Catatan_Wali: p.catatan || '', Diperbarui: nowIso()
    };
  }

  function deskToRow(d) {
    return { ID: d.id, Kode_Mapel: d.kode, Tingkat: d.tingkat || 'Semua', Teks: d.teks, Dibuat_Oleh: d.oleh || '', Diperbarui: d.updated || nowIso() };
  }

  function siswaToRow(s) {
    return { NISN: s.nisn, NIS: s.nis || '', Nama: s.nama, Kelas: s.kelas, JK: s.jk || '', No_Absen: s.no || '' };
  }

  function mapelToRow(m) {
    return { Kode: m.kode, Nama: m.nama, Kelompok: m.kelompok, KKM: m.kkm, Urut: m.urut, Aktif: m.aktif ? 'Y' : 'N' };
  }

  function kelasToRow(k) {
    return { Kelas: k.kelas, Label_Raport: k.label, Wali_Kelas: k.wali, NIP_Wali: k.nip, Urut: k.urut };
  }

  // Master data dari server yang tersimpan di HP
  function loadDB() {
    return Store.get(KEY.db, null);
  }

  function saveDB(db) {
    return Store.set(KEY.db, db);
  }

  async function fetchDB() {
    const raw = await api('getAll');
    const db = normalizeDB(raw);
    saveDB(db);
    return { db, raw };
  }

  /* ===========================================================
     PENILAIAN: PREDIKAT & DESKRIPSI
     =========================================================== */
  function predikat(nilai, cfg) {
    if (!isFilled(nilai)) return '';
    const v = parseFloat(nilai);
    cfg = cfg || {};
    if (v >= (cfg.predikat_a || 90)) return 'A';
    if (v >= (cfg.predikat_b || 80)) return 'B';
    if (v >= (cfg.predikat_c || 70)) return 'C';
    return 'D';
  }

  function kataPredikat(p, cfg) {
    cfg = cfg || {};
    return { A: cfg.kata_a || 'Sangat Baik', B: cfg.kata_b || 'Baik', C: cfg.kata_c || 'Cukup', D: cfg.kata_d || 'Perlu Bimbingan' }[p] || '';
  }

  function trimDot(s) {
    return String(s || '').trim().replace(/[.\s]+$/, '');
  }

  function buildDeskripsi(nama, nilai, kuasai, tingkatkan, cfg) {
    cfg = cfg || {};
    if (!kuasai && !tingkatkan) return '';
    const p = predikat(nilai, cfg) || 'B';
    let tpl = cfg.format_deskripsi || '{NAMA} {KATA} dalam {DIKUASAI}. dan Perlu Ditingkatkan {DITINGKATKAN}.';
    if (!tingkatkan) tpl = tpl.replace(/[.\s]*dan Perlu Ditingkatkan \{DITINGKATKAN\}\.?/i, '.');
    if (!kuasai) tpl = tpl.replace(/\{KATA\} dalam \{DIKUASAI\}[.\s]*dan /i, '');
    return tpl
      .replace(/\{NAMA\}/g, nama || '')
      .replace(/\{KATA\}/g, kataPredikat(p, cfg))
      .replace(/\{PREDIKAT\}/g, p)
      .replace(/\{DIKUASAI\}/g, trimDot(kuasai))
      .replace(/\{DITINGKATKAN\}/g, trimDot(tingkatkan))
      .replace(/\s+/g, ' ').trim();
  }

  /* ===========================================================
     REKAP SISWA (nilai, total, rata-rata, ranking)
     =========================================================== */
  function activeMapel(db) {
    return (db.mapel || []).filter(m => m.aktif);
  }

  function computeStudents(db, nilaiMap) {
    const cfg = db.config || {};
    const mapel = activeMapel(db);
    const nm = nilaiMap || db.nilai || {};
    const terpisah = cfg.mode_keterampilan === 'terpisah';
    const students = db.siswa.map(s => {
      const grades = {}, gradesK = {}, desk = {};
      let total = 0, count = 0, totalP = 0, countP = 0;
      mapel.forEach(m => {
        const n = nm[s.nisn + '|' + m.kode];
        const p = n && isFilled(n.nilai) ? parseFloat(n.nilai) : null;
        let k = null;
        if (n) k = terpisah ? (isFilled(n.nilai_k) ? parseFloat(n.nilai_k) : null) : p;
        grades[m.kode] = p;
        gradesK[m.kode] = k;
        desk[m.kode] = n ? { kuasai: n.kuasai, tingkatkan: n.tingkatkan, guru: n.guru, updated: n.updated } : null;
        if (p !== null) { total += p; count++; totalP += p; countP++; }
        if (k !== null) { total += k; count++; }
      });
      return Object.assign({}, s, {
        grades, gradesK, desk,
        totalP: round1(totalP), countP,
        total: round1(total), count,
        average: count ? round2(total / count) : 0,
        averageP: countP ? round2(totalP / countP) : 0,
        ranking: 0,
        pelengkap: (db.pelengkap || {})[s.nisn] || null
      });
    });

    const classes = classList(db);
    const analytics = {};
    classes.forEach(c => {
      const list = students.filter(s => s.kelas === c);
      const sorted = list.slice().sort((a, b) => (b.total - a.total) || (b.average - a.average));
      sorted.forEach((st, i) => {
        if (i > 0 && st.total === sorted[i - 1].total && st.average === sorted[i - 1].average) st.ranking = sorted[i - 1].ranking;
        else st.ranking = i + 1;
      });
      const avgs = list.map(s => s.average).filter(v => v > 0);
      analytics[c] = {
        kelas: c,
        total_siswa: list.length,
        rata_rata_kelas: avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : 0,
        siswa_ranking_1: sorted.length ? sorted[0].nama : '-',
        skor_ranking_1: sorted.length ? sorted[0].total : 0
      };
    });
    return { students, classes, analytics, mapel };
  }

  function classList(db) {
    const set = [];
    (db.kelas || []).forEach(k => { if (set.indexOf(k.kelas) < 0) set.push(k.kelas); });
    (db.siswa || []).forEach(s => { if (s.kelas && set.indexOf(s.kelas) < 0) set.push(s.kelas); });
    return set;
  }

  function kelasInfo(db, kelas) {
    const k = (db.kelas || []).find(x => x.kelas === kelas);
    return k || { kelas: kelas, label: romawi(tingkatOf(kelas)), wali: '', nip: '' };
  }

  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }

  /* ===========================================================
     TEMA (gelap / terang)
     =========================================================== */
  function applyTheme() {
    let t = 'light';
    try { t = localStorage.getItem(KEY.theme) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { /* abaikan */ }
    document.documentElement.setAttribute('data-theme', t);
    return t;
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    try { localStorage.setItem(KEY.theme, cur); } catch (e) { /* abaikan */ }
    return cur;
  }

  /* ===========================================================
     SERVICE WORKER (offline)
     =========================================================== */
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ });
    }
  }

  applyTheme();

  window.Core = {
    CFG, Store, KEY, esc, fmtNum, isFilled, nowIso, fmtDateTime, uid, toast, downloadBlob, safeFileName,
    tingkatOf, romawi, isOnline, getSession, setSession, logout, requireRole, isDemo, api, DemoBackend,
    normalizeDB, normalizeConfig, rowToNilai, nilaiToRow, rowToPelengkap, pelengkapToRow, deskToRow, siswaToRow,
    mapelToRow, kelasToRow, loadDB, saveDB, fetchDB, predikat, kataPredikat, buildDeskripsi, trimDot,
    activeMapel, computeStudents, classList, kelasInfo, round1, round2, num, str, applyTheme, toggleTheme, registerSW
  };
})();
