/**
 * Halaman Cek Nilai Siswa (Cek_Nilai.html)
 * Tanpa kata sandi: siswa memilih kelas -> nama -> nilai tampil.
 * Server (aksi "cekDaftar" & "cekNilai") hanya mengirim daftar nama dan nilai siswa yang dipilih.
 * Daftar nama & nilai yang pernah dibuka disimpan di perangkat agar tetap bisa dilihat saat offline.
 * SMP KRISTEN 65 BASAAN
 */
(function () {
  const C = window.Core;
  const CFG = C.CFG;
  const esc = C.esc;
  const $ = id => document.getElementById(id);

  const UI = { daftar: null, daftarAt: null, kelas: null, cari: '', nisn: null };
  const WARNA = { A: ['#10b981', '#059669'], B: ['#6366f1', '#8b5cf6'], C: ['#f59e0b', '#f97316'], D: ['#ef4444', '#e11d48'] };
  const AVATAR = [['#6366f1', '#8b5cf6'], ['#06b6d4', '#3b82f6'], ['#ec4899', '#f43f5e'], ['#10b981', '#14b8a6'], ['#f59e0b', '#f97316'], ['#8b5cf6', '#d946ef']];
  const TILE = ['#6366f1', '#0891b2', '#7c3aed', '#db2777', '#059669', '#ea580c'];

  function loading(on, msg) {
    $('loading').classList.toggle('active', !!on);
    if (msg) $('loading-text').textContent = msg;
  }

  function online() {
    return C.isDemo() || C.isOnline();
  }

  /* ===========================================================
     PENYIMPANAN DI PERANGKAT
     =========================================================== */
  function nilaiCache() {
    const c = C.Store.get(C.KEY.cekNilai, null);
    return c && c.byNisn ? c : { byNisn: {}, kelas: null };
  }

  function simpanNilai(nisn, data) {
    const c = nilaiCache();
    c.byNisn[nisn] = { data: data, at: C.nowIso() };
    // simpan paling banyak 10 siswa terakhir
    const keys = Object.keys(c.byNisn).sort((a, b) => String(c.byNisn[b].at).localeCompare(String(c.byNisn[a].at)));
    keys.slice(10).forEach(k => { delete c.byNisn[k]; });
    C.Store.set(C.KEY.cekNilai, c);
  }

  function simpanKelas(k) {
    const c = nilaiCache();
    c.kelas = k;
    C.Store.set(C.KEY.cekNilai, c);
  }

  /* ===========================================================
     UTIL TAMPILAN
     =========================================================== */
  function inisial(nama) {
    const p = String(nama || '').trim().split(/\s+/);
    return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
  }

  function avatarStyle(nama) {
    let h = 0;
    String(nama).split('').forEach(ch => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    const c = AVATAR[h % AVATAR.length];
    return '--a1:' + c[0] + ';--a2:' + c[1];
  }

  function countUp(el, to, digits) {
    let start = null;
    const dur = 1100;
    const step = now => {
      if (start === null) start = now;
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = C.fmtNum(to * e, t < 1 ? 0 : digits);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // pengaman bila animasi tertunda (tab di latar belakang)
    setTimeout(() => { el.textContent = C.fmtNum(to, digits); }, dur + 400);
  }

  function confetti() {
    const colors = ['#f59e0b', '#6366f1', '#ec4899', '#10b981', '#06b6d4', '#facc15'];
    for (let i = 0; i < 70; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.background = colors[i % colors.length];
      d.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      d.style.animationDelay = (Math.random() * 0.6) + 's';
      document.body.appendChild(d);
      setTimeout(() => d.remove(), 4500);
    }
  }

  function heroText(html) {
    $('hero-text').innerHTML = html;
  }

  /* ===========================================================
     DAFTAR KELAS & NAMA
     =========================================================== */
  async function loadDaftar(silent) {
    if (!online()) {
      if (!UI.daftar) $('pilih-alert').innerHTML = '<div class="banner warn"><span class="e">📡</span><div>Tidak ada internet. Sambungkan internet untuk memuat daftar siswa.</div></div>';
      return;
    }
    try {
      const data = await C.api('cekDaftar');
      UI.daftar = data;
      UI.daftarAt = C.nowIso();
      C.Store.set(C.KEY.cekDaftar, { data: data, at: UI.daftarAt });
      $('pilih-alert').innerHTML = '';
      renderPilih();
    } catch (err) {
      const msg = String(err.message || err);
      const teks = msg.indexOf('Aksi tidak dikenal') >= 0 ? 'Fitur cek nilai belum diaktifkan di server sekolah. Hubungi admin.' : msg;
      if (/ditutup/i.test(msg)) {
        UI.daftar = null;
        C.Store.remove(C.KEY.cekDaftar);
        $('kelas-grid').innerHTML = '';
        $('name-list').innerHTML = '';
      }
      $('pilih-alert').innerHTML = '<div class="banner warn"><span class="e">🔒</span><div>' + esc(teks) + '</div></div>';
      if (!silent) C.toast(teks, 'error');
    }
  }

  function renderPilih() {
    const d = UI.daftar;
    if (!d) return;
    $('h-sekolah').textContent = d.sekolah.nama || '';
    $('h-periode').textContent = 'Semester ' + (d.sekolah.semester || '-') + ' • T.P. ' + (d.sekolah.tahun_ajaran || '-');
    if (!d.kelas.some(k => k.kelas === UI.kelas)) UI.kelas = null;
    $('kelas-grid').innerHTML = d.kelas.map((k, i) =>
      '<button class="kelas-tile' + (UI.kelas === k.kelas ? ' active' : '') + '" style="--tile:' + TILE[i % TILE.length] + '" data-kelas="' + esc(k.kelas) + '">' +
        '<b>' + esc(k.kelas) + '</b><span>' + k.jumlah + ' siswa</span><span>' + esc(k.wali || '') + '</span></button>').join('') ||
      '<div class="hint">Belum ada data siswa.</div>';
    renderNama();
  }

  function renderNama() {
    const d = UI.daftar;
    const q = UI.cari.trim().toUpperCase();
    let list = d ? d.siswa : [];
    if (q) list = list.filter(s => s.nama.indexOf(q) >= 0 && (!UI.kelas || s.kelas === UI.kelas));
    else if (UI.kelas) list = list.filter(s => s.kelas === UI.kelas);
    else list = [];
    $('nama-count').textContent = list.length ? list.length + ' siswa' : '';
    if (!list.length) {
      $('name-list').innerHTML = '<div class="hint" style="grid-column:1/-1;"><span class="big">' + (q ? '🔍' : '👆') + '</span>' +
        (q ? 'Nama tidak ditemukan' + (UI.kelas ? ' di kelas ' + esc(UI.kelas) : '') + '.' : 'Pilih kelasmu dulu, atau ketik namamu di kotak cari.') + '</div>';
      return;
    }
    $('name-list').innerHTML = list.map((s, i) =>
      '<button class="name-item" style="animation-delay:' + Math.min(i * 25, 500) + 'ms" data-nisn="' + esc(s.nisn) + '">' +
        '<span class="avatar" style="' + avatarStyle(s.nama) + '">' + esc(inisial(s.nama)) + '</span>' +
        '<b>' + esc(s.nama) + (UI.kelas ? '' : '<br><small style="color:var(--cn-muted);font-weight:700;">Kelas ' + esc(s.kelas) + '</small>') + '</b>' +
        '<span class="go">›</span></button>').join('');
  }

  /* ===========================================================
     NILAI SISWA
     =========================================================== */
  async function bukaSiswa(nisn, silent) {
    const cache = nilaiCache().byNisn[nisn];
    if (!online()) {
      if (cache) { tampilHasil(cache.data, cache.at, true); return; }
      C.toast('Tidak ada internet. Sambungkan internet untuk melihat nilai.', 'warning');
      return;
    }
    if (!silent) loading(true, 'Mengambil nilai...');
    try {
      const data = await C.api('cekNilai', { nisn: nisn });
      simpanNilai(nisn, data);
      tampilHasil(data, C.nowIso(), false);
    } catch (err) {
      if (cache) { tampilHasil(cache.data, cache.at, true); C.toast('Gagal memperbarui, menampilkan data terakhir', 'warning'); }
      else C.toast(String(err.message || err), 'error');
    } finally {
      loading(false);
    }
  }

  function tampilHasil(d, at, dariCache) {
    const pertama = UI.nisn !== d.siswa.nisn || $('view-hasil').classList.contains('hidden');
    UI.nisn = d.siswa.nisn;
    if ($('view-hasil').classList.contains('hidden')) {
      try { history.pushState({ v: 'hasil' }, ''); } catch (e) { /* abaikan */ }
    }
    $('view-pilih').classList.add('hidden');
    $('view-hasil').classList.remove('hidden');
    render(d, at, dariCache, pertama);
    if (pertama) window.scrollTo(0, 0);
  }

  function kembali() {
    $('view-hasil').classList.add('hidden');
    $('view-pilih').classList.remove('hidden');
    heroText('<h1>Yuk, cek <em>nilai raportmu</em> ✨</h1><p class="sub">Pilih kelas, lalu ketuk namamu.</p>');
    document.title = 'Cek Nilai Siswa';
    UI.nisn = null;
    window.scrollTo(0, 0);
  }

  function render(d, at, dariCache, animasi) {
    const cfg = C.normalizeConfig(d.config);
    const s = d.siswa;
    const r = d.ringkasan || {};
    document.title = 'Nilai ' + s.nama;
    $('h-sekolah').textContent = cfg.nama_sekolah || '';
    $('h-periode').textContent = 'Semester ' + (cfg.semester || '-') + ' • T.P. ' + (cfg.tahun_ajaran || '-');
    const sapaan = s.nama.split(/\s+/)[0];
    const pAvg = r.count ? C.predikat(r.average, cfg) : '';
    heroText('<h1>Halo, <em>' + esc(sapaan.charAt(0) + sapaan.slice(1).toLowerCase()) + '</em>! ' + (pAvg === 'A' ? '🌟' : pAvg === 'B' ? '👏' : '💪') + '</h1>' +
      '<p class="sub">' + (pAvg === 'A' ? 'Luar biasa! Pertahankan prestasimu.' : pAvg === 'B' ? 'Hebat! Sedikit lagi menuju sangat baik.' : pAvg ? 'Terus semangat belajar, kamu pasti bisa!' : 'Nilaimu sedang diinput oleh guru.') + '</p>');

    // Profil
    $('h-profile').innerHTML = '<span class="avatar" style="' + avatarStyle(s.nama) + '">' + esc(inisial(s.nama)) + '</span>' +
      '<div class="who"><h2>' + esc(s.nama) + '</h2>' +
        '<div>NISN ' + esc(s.nisn) + (s.nis ? ' • NIS ' + esc(s.nis) : '') + '</div>' +
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;"><span class="pill pri">Kelas ' + esc(s.kelas) + '</span>' +
          (d.wali ? '<span class="pill pri">Wali: ' + esc(d.wali) + '</span>' : '') + '</div></div>';

    // Gauge rata-rata
    const rad = 66, circ = 2 * Math.PI * rad;
    const pct = r.count ? Math.max(0, Math.min(100, r.average)) / 100 : 0;
    const w = WARNA[pAvg] || ['#94a3b8', '#64748b'];
    $('h-gauge').innerHTML = '<svg viewBox="0 0 160 160"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + w[0] + '"/><stop offset="1" stop-color="' + w[1] + '"/></linearGradient></defs>' +
      '<circle class="track" cx="80" cy="80" r="' + rad + '" fill="none" stroke-width="13"/>' +
      '<circle class="bar" id="gauge-bar" cx="80" cy="80" r="' + rad + '" fill="none" stroke="url(#gg)" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + circ + '" stroke-dashoffset="' + (animasi ? circ : circ * (1 - pct)) + '"/></svg>' +
      '<div class="center"><span>Rata-rata</span><b id="gauge-num">' + (r.count ? C.fmtNum(r.average, 2) : '-') + '</b>' +
        '<i style="color:' + w[0] + ';">' + (pAvg ? 'Predikat ' + pAvg + '<br>' + esc(C.kataPredikat(pAvg, cfg)) : 'Belum ada nilai') + '</i></div>';
    if (animasi) {
      requestAnimationFrame(() => requestAnimationFrame(() => { const b = $('gauge-bar'); if (b) b.style.strokeDashoffset = circ * (1 - pct); }));
      if (r.count) countUp($('gauge-num'), r.average, 2);
    }

    // Kotak ringkasan
    const medal = n => n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : '';
    let tiles = '<div class="tile"><span>Jumlah Nilai</span><b>' + C.fmtNum(r.total) + '</b><small>' + r.countP + ' / ' + r.jumlahMapel + ' mapel terisi</small></div>';
    if (d.tampilRanking) {
      tiles += '<div class="tile' + (r.rankKelas && r.rankKelas <= 3 ? ' gold' : '') + '"><span>Ranking Kelas</span><b>' + (r.rankKelas ? '#' + r.rankKelas : '-') + '</b><small>dari ' + r.jumlahKelas + ' siswa ' + esc(s.kelas) + '</small>' +
          (medal(r.rankKelas) ? '<div class="medal">' + medal(r.rankKelas) + '</div>' : '') + '</div>' +
        '<div class="tile' + (r.rankTingkat && r.rankTingkat <= 3 ? ' gold' : '') + '"><span>Ranking Kelas ' + esc(r.tingkat) + '</span><b>' + (r.rankTingkat ? '#' + r.rankTingkat : '-') + '</b><small>dari ' + r.jumlahTingkat + ' siswa (semua rombel)</small>' +
          (medal(r.rankTingkat) ? '<div class="medal">' + medal(r.rankTingkat) + '</div>' : '') + '</div>';
    }
    const tuntas = (d.mapel || []).filter(m => m.nilai !== null && m.nilai !== undefined && m.nilai >= m.kkm).length;
    tiles += '<div class="tile"><span>Mapel Tuntas</span><b>' + tuntas + '</b><small>dari ' + r.countP + ' mapel bernilai</small></div>';
    $('h-tiles').innerHTML = tiles;
    if (animasi && d.tampilRanking && r.count && (r.rankKelas <= 3 || r.rankTingkat <= 3)) setTimeout(confetti, 500);

    // Pemberitahuan
    let alert = '';
    if (dariCache && !online()) alert += '<div class="banner warn"><span class="e">📡</span><div>Sedang offline. Menampilkan data terakhir (' + esc(C.fmtDateTime(at)) + ').</div></div>';
    if (d.pengambilan && d.pengambilan.status === 'Sudah') {
      const tgl = new Date(d.pengambilan.tanggal);
      alert += '<div class="banner ok"><span class="e">✅</span><div>Raport sudah diambil' + (isNaN(tgl) ? '' : ' pada <b>' + esc(tgl.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + '</b>') +
        (d.pengambilan.pengambil ? ' oleh ' + esc(d.pengambilan.pengambil) + (d.pengambilan.hubungan ? ' (' + esc(d.pengambilan.hubungan) + ')' : '') : '') + '.</div></div>';
    }
    if (r.countP < r.jumlahMapel) alert += '<div class="banner info"><span class="e">⏳</span><div>Nilai ' + (r.jumlahMapel - r.countP) + ' mata pelajaran belum diinput guru. Jumlah, rata-rata' + (d.tampilRanking ? ' dan ranking' : '') + ' masih bisa berubah.</div></div>';
    $('h-alert').innerHTML = alert;

    // Nilai per mapel
    const terpisah = cfg.mode_keterampilan === 'terpisah';
    $('h-mapel').innerHTML = (d.mapel || []).map((m, i) => {
      const ada = m.nilai !== null && m.nilai !== undefined;
      const p = ada ? C.predikat(m.nilai, cfg) : '';
      const c = WARNA[p] || ['#94a3b8', '#64748b'];
      const lulus = ada && m.nilai >= m.kkm;
      const desk = ada ? C.buildDeskripsi(s.nama, m.nilai, m.kuasai, m.tingkatkan, cfg) : '';
      const lebar = ada ? Math.max(0, Math.min(100, m.nilai)) : 0;
      return '<div class="mapel" style="animation-delay:' + Math.min(i * 40, 600) + 'ms">' +
        '<div class="mapel-head">' +
          '<span class="ic" style="background:linear-gradient(135deg,' + c[0] + ',' + c[1] + ');">' + (ada ? p : '–') + '</span>' +
          '<div class="nm"><b>' + esc(m.nama) + '</b><small>' + (ada ? esc(C.kataPredikat(p, cfg)) + ' • ' : '') + 'KKM ' + esc(m.kkm) + ' ' +
            (ada ? (lulus ? '<span class="pill ok">Tuntas</span>' : '<span class="pill bad">Belum Tuntas</span>') : '<span class="pill warn">Belum ada nilai</span>') + '</small></div>' +
          '<div class="sc"><b style="color:' + (ada ? c[0] : 'var(--cn-muted)') + ';">' + (ada ? C.fmtNum(m.nilai) : '-') + '</b>' + (terpisah ? '<small>PENGETAHUAN</small>' : '') + '</div>' +
        '</div>' +
        '<div class="meter"><i data-w="' + lebar + '" style="background:linear-gradient(90deg,' + c[0] + ',' + c[1] + ');' + (animasi ? '' : 'width:' + lebar + '%;') + '"></i>' +
          '<span class="kkm" style="left:' + Math.max(0, Math.min(100, m.kkm)) + '%;"></span></div>' +
        (terpisah ? '<div class="k-row">Keterampilan: <b style="color:var(--cn-text);">' + (m.nilai_k !== null && m.nilai_k !== undefined ? C.fmtNum(m.nilai_k) : '-') + '</b></div>' : '') +
        (desk ? '<div class="desk">💬 ' + esc(desk) + '</div>' : '') +
      '</div>';
    }).join('') || '<div class="hint">Belum ada mata pelajaran.</div>';
    if (animasi) {
      setTimeout(() => document.querySelectorAll('#h-mapel .meter > i').forEach(el => { el.style.width = el.dataset.w + '%'; }), 120);
    }

    // Sikap, ekskul, kehadiran, catatan
    const pel = d.pelengkap || {};
    const mini = (k, v) => '<div class="mini"><span>' + k + '</span><b>' + v + '</b></div>';
    const hari = v => (v === '' || v === undefined || v === null ? '0' : esc(v)) + ' hari';
    const eks = [['ek1', 'ek1_nilai'], ['ek2', 'ek2_nilai']].filter(k => pel[k[0]]);
    const kk = C.buildKokurikuler(s.nama, pel, cfg);
    const adaHadir = cfg.tampilkan_hadir !== false && pel.hadir !== undefined && pel.hadir !== '';
    $('h-pelengkap').innerHTML =
      '<div class="panel-title">🙏 Sikap</div><div class="mini-grid">' +
        mini('Spiritual', esc(pel.sp_pred || cfg.sikap_spiritual_predikat || '-')) + mini('Sosial', esc(pel.so_pred || cfg.sikap_sosial_predikat || '-')) + '</div>' +
      (pel.kk_nilai || kk ? '<div class="panel-title" style="margin-top:16px;">🤝 Kokurikuler' + (cfg.kokurikuler_kegiatan ? ' - ' + esc(cfg.kokurikuler_kegiatan) : '') + '</div>' +
        (pel.kk_nilai ? '<div class="mini-grid">' + mini('Nilai', esc(pel.kk_nilai)) + '</div>' : '') +
        (kk ? '<div class="catatan" style="margin-top:8px;">' + esc(kk) + '</div>' : '') : '') +
      (eks.length ? '<div class="panel-title" style="margin-top:16px;">⚽ Ekstrakurikuler</div><div class="mini-grid">' +
        eks.map(k => mini(esc(pel[k[0]]), esc(pel[k[1]] || 'Baik'))).join('') + '</div>' : '') +
      '<div class="panel-title" style="margin-top:16px;">📅 ' + (adaHadir ? 'Kehadiran' : 'Ketidakhadiran') + '</div><div class="mini-grid">' +
        (adaHadir ? mini('Hadir', hari(pel.hadir)) : '') +
        mini('Sakit', hari(pel.sakit)) + mini('Izin', hari(pel.izin)) + mini('Tanpa Keterangan', hari(pel.alpa)) + '</div>' +
      (pel.catatan ? '<div class="panel-title" style="margin-top:16px;">📝 Catatan Wali Kelas</div><div class="catatan">"' + esc(pel.catatan) + '"</div>' : '');

    $('h-updated').textContent = 'Data diambil: ' + C.fmtDateTime(at) + ' • Nilai resmi tetap mengacu pada raport yang dibagikan sekolah.';
  }

  /* ===========================================================
     START
     =========================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    $('kelas-grid').addEventListener('click', e => {
      const b = e.target.closest('[data-kelas]');
      if (!b) return;
      UI.kelas = UI.kelas === b.dataset.kelas ? null : b.dataset.kelas;
      simpanKelas(UI.kelas);
      renderPilih();
      if (UI.kelas && window.innerWidth < 700) $('cari').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('name-list').addEventListener('click', e => {
      const b = e.target.closest('[data-nisn]');
      if (b) bukaSiswa(b.dataset.nisn);
    });
    $('cari').addEventListener('input', e => { UI.cari = e.target.value; renderNama(); });
    $('h-mapel').addEventListener('click', e => {
      const m = e.target.closest('.mapel');
      if (m && m.querySelector('.desk')) m.classList.toggle('open');
    });
    $('btn-back').addEventListener('click', () => { try { history.back(); } catch (e) { kembali(); } });
    window.addEventListener('popstate', () => { if (!$('view-hasil').classList.contains('hidden')) kembali(); });
    $('btn-refresh').addEventListener('click', () => { if (UI.nisn) bukaSiswa(UI.nisn); });
    $('btn-print').addEventListener('click', () => window.print());
    $('btn-theme').addEventListener('click', () => C.toggleTheme());
    $('app-version').textContent = (CFG.NAMA_APLIKASI || 'E-Raport') + ' v' + (CFG.VERSI || '');
    window.addEventListener('online', () => { loadDaftar(true); });
    C.registerSW();

    // Tampilkan daftar tersimpan dulu (cepat & bisa offline), lalu ambil yang terbaru
    UI.kelas = nilaiCache().kelas || null;
    const cd = C.Store.get(C.KEY.cekDaftar, null);
    if (cd && cd.data) { UI.daftar = cd.data; UI.daftarAt = cd.at; renderPilih(); }
    loadDaftar(true);
  });
})();
