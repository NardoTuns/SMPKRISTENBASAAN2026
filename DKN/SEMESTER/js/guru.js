/**
 * APLIKASI GURU: input nilai + deskripsi, simpan di HP, sinkron ke spreadsheet.
 * SMP KRISTEN 65 BASAAN
 */
(function () {
  const C = window.Core;
  const session = C.requireRole('guru');
  if (!session) return;

  const $ = id => document.getElementById(id);
  const esc = C.esc;

  /* ===========================================================
     STATE
     =========================================================== */
  let DB = C.loadDB();
  if (!DB) { C.logout(); return; }

  // Nilai yang diinput di HP ini: { "NISN|KODE": {..., dirty, syncedAt} }
  let L = C.Store.get(C.KEY.guruNilai, {});
  // Deskripsi buatan guru di HP ini: { added: {id: desk}, deleted: [id] }
  let LD = C.Store.get(C.KEY.guruDesk, { added: {}, deleted: [] });
  // Isian wali kelas di HP ini: { NISN: { patch: {hadir, sakit, kk_nilai, ...}, dirty, updated, syncedAt } }
  let W = C.Store.get(C.KEY.guruWali, {});
  let prefs = Object.assign({ autoSync: true, preview: true }, C.Store.get(C.KEY.guruPrefs, {}));
  if (!prefs.nama) prefs.nama = session.nama;

  const ui = { view: 'nilai', mapel: prefs.mapel || null, kelas: prefs.kelas || null, inputOpen: false, deskMapel: null, waliKelas: prefs.waliKelas || null };
  let syncing = false;
  let installPrompt = null;

  function saveL() { C.Store.set(C.KEY.guruNilai, L); }
  function saveLD() { C.Store.set(C.KEY.guruDesk, LD); }
  function saveW() { C.Store.set(C.KEY.guruWali, W); }
  function savePrefs() { C.Store.set(C.KEY.guruPrefs, prefs); }
  function cfg() { return DB.config || {}; }
  function terpisah() { return cfg().mode_keterampilan === 'terpisah'; }
  function mapelList() { return C.activeMapel(DB); }
  function mapelByKode(k) { return DB.mapel.find(m => m.kode === k); }
  function siswaKelas(k) { return DB.siswa.filter(s => s.kelas === k); }
  function getN(id) { return L[id] || DB.nilai[id] || null; }
  function waliPending() { return Object.values(W).filter(w => w.dirty).length; }
  function pendingCount() { return Object.values(L).filter(n => n.dirty).length + Object.values(LD.added).filter(d => d.dirty).length + LD.deleted.length + waliPending(); }

  function loading(on, msg) {
    $('loading').classList.toggle('active', !!on);
    if (msg) $('loading-text').textContent = msg;
  }

  /* ===========================================================
     DESKRIPSI (bank server + tambahan lokal)
     =========================================================== */
  function allDeskripsi() {
    const deleted = new Set(LD.deleted);
    const map = {};
    DB.deskripsi.forEach(d => { if (!deleted.has(d.id)) map[d.id] = d; });
    Object.values(LD.added).forEach(d => { if (!deleted.has(d.id)) map[d.id] = d; });
    return Object.values(map);
  }

  function deskFor(kode, kelas) {
    const t = C.tingkatOf(kelas);
    return allDeskripsi()
      .filter(d => d.kode === kode && (!kelas || d.tingkat === 'Semua' || !d.tingkat || d.tingkat === t))
      .sort((a, b) => a.teks.localeCompare(b.teks));
  }

  /* ===========================================================
     PENGGABUNGAN DATA SERVER
     =========================================================== */
  function mergeServer() {
    Object.keys(L).forEach(id => {
      const loc = L[id];
      const srv = DB.nilai[id];
      if (!loc.dirty && srv && String(srv.updated) > String(loc.updated || '')) {
        L[id] = Object.assign({}, srv, { dirty: false, syncedAt: loc.syncedAt });
      }
    });
    // deskripsi lokal yang sudah ada di server tidak perlu disimpan dobel
    const srvIds = new Set(DB.deskripsi.map(d => d.id));
    Object.keys(LD.added).forEach(id => {
      if (!LD.added[id].dirty && srvIds.has(id)) delete LD.added[id];
    });
    // isian wali kelas yang sudah terkirim sudah ada di data server
    // (kecuali backend lama: kolom Hadir/Kokurikuler belum ada, jadi tetap disimpan di HP)
    if (!C.backendOutdated(DB)) {
      Object.keys(W).forEach(n => { if (!W[n].dirty) delete W[n]; });
    }
    saveL();
    saveLD();
    saveW();
  }

  function addSyncLog(entry) {
    const logs = C.Store.get(C.KEY.syncLog, []);
    logs.unshift(entry);
    C.Store.set(C.KEY.syncLog, logs.slice(0, 30));
  }

  async function sync(opts) {
    opts = opts || {};
    if (syncing) return;
    if (!C.isDemo() && !C.isOnline()) {
      if (!opts.silent) C.toast('Sedang offline. Nilai sudah tersimpan di HP dan akan dikirim saat online.', 'warning');
      return;
    }
    syncing = true;
    setSyncSpin(true);
    const started = C.nowIso();
    let pushed = 0, pushedW = 0;
    try {
      // 1. Kirim nilai yang belum tersinkron
      const pending = Object.values(L).filter(n => n.dirty);
      if (pending.length) {
        const snap = pending.map(n => ({ id: n.id, updated: n.updated }));
        const info = summarizePending(pending);
        for (let i = 0; i < pending.length; i += 400) {
          const chunk = pending.slice(i, i + 400).map(C.nilaiToRow);
          await C.api('syncNilai', { rows: chunk, info: info });
        }
        const at = C.nowIso();
        snap.forEach(s => {
          const cur = L[s.id];
          if (cur && cur.updated === s.updated) { cur.dirty = false; cur.syncedAt = at; }
        });
        pushed = pending.length;
        saveL();
      }

      // 2. Kirim deskripsi baru / hapus
      const dAdd = Object.values(LD.added).filter(d => d.dirty);
      if (dAdd.length) {
        await C.api('saveDeskripsi', { rows: dAdd.map(C.deskToRow) });
        dAdd.forEach(d => { d.dirty = false; });
      }
      if (LD.deleted.length) {
        await C.api('deleteDeskripsi', { ids: LD.deleted });
        LD.deleted = [];
      }
      saveLD();

      // 3. Kirim isian wali kelas (hanya kolom yang diubah, kolom lain di spreadsheet tidak tertimpa)
      const wPend = Object.keys(W).filter(n => W[n].dirty);
      if (wPend.length) {
        const snapW = wPend.map(n => ({ n, updated: W[n].updated }));
        const kelasW = Array.from(new Set(wPend.map(n => (DB.siswa.find(s => s.nisn === n) || {}).kelas).filter(Boolean)));
        await C.api('savePelengkap', { rows: wPend.map(n => C.pelengkapPatchToRow(n, waliRowPatch(W[n].patch))), info: 'Wali kelas ' + kelasW.join(', ') + ' (' + wPend.length + ' siswa)' });
        const atW = C.nowIso();
        snapW.forEach(s => {
          const cur = W[s.n];
          if (cur && cur.updated === s.updated) { cur.dirty = false; cur.syncedAt = atW; }
        });
        pushedW = wPend.length;
        saveW();
      }

      // 4. Ambil data terbaru dari spreadsheet
      const res = await C.fetchDB();
      DB = res.db;
      mergeServer();
      addSyncLog({ at: started, ok: true, pushed: pushed, desk: dAdd.length, wali: pushedW });
      const msg = [pushed ? pushed + ' nilai' : '', pushedW ? pushedW + ' isian wali kelas' : ''].filter(Boolean).join(' & ');
      if (!opts.silent || pushed || pushedW) C.toast(msg ? msg + ' terkirim. Data sudah terbaru.' : 'Data sudah terbaru dari spreadsheet.', 'success');
    } catch (err) {
      addSyncLog({ at: started, ok: false, pushed: pushed, wali: pushedW, error: err.message });
      if (!opts.silent) C.toast('Sinkron gagal: ' + err.message, 'error');
    } finally {
      syncing = false;
      setSyncSpin(false);
      renderAll();
    }
  }

  function summarizePending(rows) {
    const g = {};
    rows.forEach(r => { const k = r.kode + ' ' + r.kelas; g[k] = (g[k] || 0) + 1; });
    return Object.keys(g).map(k => k + ' (' + g[k] + ')').join(', ');
  }

  function setSyncSpin(on) {
    const icon = $('sync-icon');
    icon.style.animation = on ? 'spin 0.9s linear infinite' : '';
    $('btn-sync').disabled = on;
  }

  /* ===========================================================
     HEADER / STATUS
     =========================================================== */
  function renderHeader() {
    const online = C.isDemo() || C.isOnline();
    $('net-dot').classList.toggle('off', !online);
    $('offline-banner').classList.toggle('hidden', online);
    const p = pendingCount();
    const badge = $('pending-badge');
    badge.textContent = p > 99 ? '99+' : p;
    badge.classList.toggle('hidden', p === 0);
    const titles = { nilai: 'Input Nilai', deskripsi: 'Bank Deskripsi', wali: 'Wali Kelas', rekap: 'Rekap Nilai', data: 'Data & Sinkron', akun: 'Akun' };
    const wOn = waliOn();
    $('tab-wali').classList.toggle('hidden', !wOn);
    $('tabbar').classList.toggle('six', wOn);
    $('bar-title').textContent = titles[ui.view] + (C.isDemo() ? ' (Demo)' : '');
    $('bar-sub').textContent = prefs.nama + ' • data: ' + C.fmtDateTime(DB.fetchedAt);
    $('btn-back').classList.toggle('hidden', !(ui.view === 'nilai' && ui.inputOpen));
  }

  /* ===========================================================
     VIEW: NILAI (pilih mapel -> kelas -> input)
     =========================================================== */
  function countFilled(kode, kelas) {
    const list = siswaKelas(kelas);
    let filled = 0;
    list.forEach(s => {
      const n = getN(s.nisn + '|' + kode);
      if (n && C.isFilled(n.nilai)) filled++;
    });
    return { filled, total: list.length };
  }

  function renderPick() {
    const mapel = mapelList();
    if (!mapel.length) {
      $('pick-mapel').innerHTML = '<div class="empty"><b>Belum ada mata pelajaran</b>Minta admin mengisi data mapel di spreadsheet.</div>';
      return;
    }
    const classes = C.classList(DB);
    $('pick-mapel').innerHTML = mapel.map(m => {
      let f = 0, t = 0;
      classes.forEach(k => { const r = countFilled(m.kode, k); f += r.filled; t += r.total; });
      const pct = t ? Math.round(f / t * 100) : 0;
      return '<button class="picker-item' + (ui.mapel === m.kode ? ' active' : '') + '" data-mapel="' + esc(m.kode) + '">' +
        '<span class="badge badge-pri">' + esc(m.kode) + ' • KKM ' + m.kkm + '</span>' +
        '<b>' + esc(m.nama) + '</b>' +
        '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
        '<span class="muted">' + f + '/' + t + ' nilai terisi</span></button>';
    }).join('');

    const wrap = $('pick-kelas-wrap');
    if (!ui.mapel || !mapelByKode(ui.mapel)) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    $('pick-kelas').innerHTML = classes.map(k => {
      const r = countFilled(ui.mapel, k);
      const pct = r.total ? Math.round(r.filled / r.total * 100) : 0;
      const info = C.kelasInfo(DB, k);
      return '<button class="picker-item' + (ui.kelas === k ? ' active' : '') + '" data-kelas="' + esc(k) + '">' +
        '<b>Kelas ' + esc(k) + '</b>' +
        '<span class="muted">' + esc(info.wali || '-') + '</span>' +
        '<div class="progress"><i style="width:' + pct + '%"></i></div>' +
        '<span class="muted">' + r.filled + '/' + r.total + ' siswa' + (pct === 100 ? ' ✓' : '') + '</span></button>';
    }).join('');
  }

  function openInput(kode, kelas) {
    ui.mapel = kode;
    ui.kelas = kelas;
    prefs.mapel = kode;
    prefs.kelas = kelas;
    savePrefs();
    ui.inputOpen = true;
    $('nilai-pick').classList.add('hidden');
    $('nilai-input').classList.remove('hidden');
    $('input-bar').classList.remove('hidden');
    document.body.classList.add('editing');
    $('search-siswa').value = '';
    renderInput();
    renderHeader();
    window.scrollTo(0, 0);
  }

  function closeInput() {
    ui.inputOpen = false;
    $('nilai-pick').classList.remove('hidden');
    $('nilai-input').classList.add('hidden');
    $('input-bar').classList.add('hidden');
    document.body.classList.remove('editing');
    renderPick();
    renderHeader();
  }

  function deskOptions(list, current, placeholder) {
    let html = '<option value="">' + placeholder + '</option>';
    let found = false;
    list.forEach(d => {
      const sel = d.teks === current;
      if (sel) found = true;
      html += '<option value="' + esc(d.teks) + '"' + (sel ? ' selected' : '') + '>' + esc(d.teks) + '</option>';
    });
    if (current && !found) html += '<option value="' + esc(current) + '" selected>' + esc(current) + '</option>';
    html += '<option value="__new__">+ Tambah deskripsi baru...</option>';
    return html;
  }

  function rowState(s) {
    const id = s.nisn + '|' + ui.mapel;
    const n = getN(id);
    return { id, n, local: L[id] };
  }

  function studentCardHtml(s, idx, deskList) {
    const m = mapelByKode(ui.mapel);
    const st = rowState(s);
    const n = st.n || {};
    const v = C.isFilled(n.nilai) ? n.nilai : '';
    const vk = C.isFilled(n.nilai_k) ? n.nilai_k : '';
    const pred = C.predikat(v, cfg());
    const below = v !== '' && parseFloat(v) < m.kkm;
    let cls = 'student';
    let status = '<span class="row-status muted">Belum diisi</span>';
    if (st.local && st.local.dirty) { cls += ' dirty'; status = '<span class="row-status" style="color:var(--warning)">● Tersimpan di HP</span>'; }
    else if (st.n && (C.isFilled(n.nilai) || n.kuasai)) { cls += ' synced'; status = '<span class="row-status" style="color:var(--success)">✓ Tersinkron</span>'; }
    if (below) cls += ' below';

    const preview = prefs.preview ? '<div class="preview" data-preview>' + esc(C.buildDeskripsi(s.nama, v, n.kuasai, n.tingkatkan, cfg()) || 'Pratinjau deskripsi akan tampil di sini.') + '</div>' : '';
    return '<div class="' + cls + '" data-nisn="' + esc(s.nisn) + '">' +
      '<div class="student-head">' +
        '<div class="student-no">' + (s.no || idx + 1) + '</div>' +
        '<div class="student-name"><b>' + esc(s.nama) + '</b><span>NISN ' + esc(s.nisn) + ' • ' + status + '</span></div>' +
        '<div class="score-wrap">' +
          '<input class="score" type="number" inputmode="decimal" min="0" max="100" step="any" enterkeyhint="next" data-field="nilai" value="' + esc(v) + '" placeholder="' + (terpisah() ? 'P' : '-') + '" aria-label="Nilai ' + esc(s.nama) + '">' +
          (terpisah() ? '<input class="score k" type="number" inputmode="decimal" min="0" max="100" step="any" data-field="nilai_k" value="' + esc(vk) + '" placeholder="K" aria-label="Nilai keterampilan">' : '') +
          '<div class="pred ' + pred + '" data-pred>' + (pred || '-') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="desk-grid">' +
        '<div><label>✅ Paling dikuasai</label><select class="select" data-field="kuasai">' + deskOptions(deskList, n.kuasai, '- pilih deskripsi -') + '</select></div>' +
        '<div><label>📈 Perlu ditingkatkan</label><select class="select" data-field="tingkatkan">' + deskOptions(deskList, n.tingkatkan, '- pilih deskripsi -') + '</select></div>' +
      '</div>' + preview +
    '</div>';
  }

  function filteredStudents() {
    const m = mapelByKode(ui.mapel);
    const q = $('search-siswa').value.trim().toUpperCase();
    const f = $('filter-siswa').value;
    return siswaKelas(ui.kelas).filter(s => {
      if (q && s.nama.indexOf(q) < 0 && s.nisn.indexOf(q) < 0) return false;
      const st = rowState(s);
      const n = st.n || {};
      if (f === 'empty') return !C.isFilled(n.nilai);
      if (f === 'nodesk') return !n.kuasai || !n.tingkatkan;
      if (f === 'below') return C.isFilled(n.nilai) && parseFloat(n.nilai) < m.kkm;
      if (f === 'dirty') return st.local && st.local.dirty;
      return true;
    });
  }

  function renderInput() {
    const m = mapelByKode(ui.mapel);
    if (!m) { closeInput(); return; }
    const info = C.kelasInfo(DB, ui.kelas);
    $('ctx-mapel').textContent = m.nama;
    $('ctx-kelas').textContent = 'Kelas ' + ui.kelas + ' • KKM ' + m.kkm + ' • Wali: ' + (info.wali || '-');
    const list = filteredStudents();
    const deskList = deskFor(ui.mapel, ui.kelas);
    const box = $('student-list');
    if (!siswaKelas(ui.kelas).length) {
      box.innerHTML = '<div class="empty"><b>Belum ada siswa di kelas ini</b>Minta admin menambahkan data siswa.</div>';
    } else if (!list.length) {
      box.innerHTML = '<div class="empty"><b>Tidak ada siswa yang cocok</b>Ubah pencarian atau filter.</div>';
    } else {
      box.innerHTML = list.map((s, i) => studentCardHtml(s, i, deskList)).join('');
    }
    renderStats();
  }

  function renderStats() {
    const m = mapelByKode(ui.mapel);
    const all = siswaKelas(ui.kelas);
    const vals = [];
    let pend = 0;
    all.forEach(s => {
      const st = rowState(s);
      if (st.n && C.isFilled(st.n.nilai)) vals.push(parseFloat(st.n.nilai));
      if (st.local && st.local.dirty) pend++;
    });
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    $('st-isi').textContent = vals.length + '/' + all.length;
    $('st-avg').textContent = avg === null ? '-' : C.fmtNum(avg);
    $('st-bawah').textContent = vals.filter(v => v < m.kkm).length;
    $('st-pending').textContent = pend;
    $('st-bar').style.width = (all.length ? Math.round(vals.length / all.length * 100) : 0) + '%';
  }

  function updateLocal(nisn, patch) {
    const s = DB.siswa.find(x => x.nisn === nisn);
    const id = nisn + '|' + ui.mapel;
    const base = getN(id) || { id, nisn, kode: ui.mapel, kelas: s ? s.kelas : ui.kelas, nilai: null, nilai_k: null, kuasai: '', tingkatkan: '' };
    const next = Object.assign({}, base, patch, {
      id, nisn, kode: ui.mapel, kelas: s ? s.kelas : ui.kelas,
      guru: prefs.nama, updated: C.nowIso(), dirty: true
    });
    L[id] = next;
    saveL();
    return next;
  }

  function refreshCard(card) {
    const nisn = card.dataset.nisn;
    const s = DB.siswa.find(x => x.nisn === nisn);
    const m = mapelByKode(ui.mapel);
    const n = getN(nisn + '|' + ui.mapel) || {};
    const v = C.isFilled(n.nilai) ? n.nilai : '';
    const pred = C.predikat(v, cfg());
    const predEl = card.querySelector('[data-pred]');
    predEl.className = 'pred ' + pred;
    predEl.textContent = pred || '-';
    card.classList.add('dirty');
    card.classList.remove('synced');
    card.classList.toggle('below', v !== '' && parseFloat(v) < m.kkm);
    const stEl = card.querySelector('.row-status');
    if (stEl) { stEl.className = 'row-status'; stEl.style.color = 'var(--warning)'; stEl.textContent = '● Tersimpan di HP'; }
    const pv = card.querySelector('[data-preview]');
    if (pv) pv.textContent = C.buildDeskripsi(s.nama, v, n.kuasai, n.tingkatkan, cfg()) || 'Pratinjau deskripsi akan tampil di sini.';
    renderStats();
    renderHeader();
  }

  function onListInput(e) {
    const el = e.target;
    const field = el.dataset.field;
    if (!field) return;
    const card = el.closest('.student');
    if (!card) return;

    if (field === 'nilai' || field === 'nilai_k') {
      let raw = el.value.trim();
      let val = raw === '' ? null : parseFloat(raw.replace(',', '.'));
      if (val !== null && (isNaN(val) || val < 0 || val > 100)) {
        el.style.borderColor = 'var(--danger)';
        C.toast('Nilai harus 0 - 100', 'warning');
        return;
      }
      el.style.borderColor = '';
      const patch = {};
      patch[field] = val;
      updateLocal(card.dataset.nisn, patch);
      refreshCard(card);
      return;
    }

    if (field === 'kuasai' || field === 'tingkatkan') {
      if (el.value === '__new__') {
        const prev = (getN(card.dataset.nisn + '|' + ui.mapel) || {})[field] || '';
        el.value = prev;
        openAddDesk(ui.mapel, teks => {
          const patch = {};
          patch[field] = teks;
          updateLocal(card.dataset.nisn, patch);
          renderInput();
        });
        return;
      }
      const patch = {};
      patch[field] = el.value;
      updateLocal(card.dataset.nisn, patch);
      refreshCard(card);
    }
  }

  function onListKey(e) {
    if (e.key !== 'Enter' || !e.target.classList.contains('score')) return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('#student-list .score[data-field="nilai"]'));
    const i = inputs.indexOf(e.target);
    if (i >= 0 && i < inputs.length - 1) {
      inputs[i + 1].focus();
      inputs[i + 1].select();
      inputs[i + 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else {
      e.target.blur();
    }
  }

  async function onSave() {
    const p = Object.values(L).filter(n => n.dirty).length;
    if (!p) {
      C.toast('Semua nilai sudah tersimpan & tersinkron', 'success');
      return;
    }
    if (C.isDemo() || C.isOnline()) {
      await sync();
    } else {
      C.toast(p + ' nilai tersimpan di HP. Tekan Sinkron saat online untuk mengirim.', 'success');
    }
  }

  /* ---------- Isi massal ---------- */
  function openBulk() {
    const deskList = deskFor(ui.mapel, ui.kelas);
    const opts = '<option value="">(tidak diubah)</option>' + deskList.map(d => '<option value="' + esc(d.teks) + '">' + esc(d.teks) + '</option>').join('');
    openSheet(
      '<h3>Isi Massal Deskripsi</h3><p class="muted" style="margin-bottom:12px;">Terapkan deskripsi yang sama ke banyak siswa di kelas ' + esc(ui.kelas) + ' sekaligus.</p>' +
      '<div class="field"><label>Paling dikuasai</label><select class="select" id="bulk-k">' + opts + '</select></div>' +
      '<div class="field"><label>Perlu ditingkatkan</label><select class="select" id="bulk-t">' + opts + '</select></div>' +
      '<div class="field"><label>Terapkan ke</label><select class="select" id="bulk-target">' +
        '<option value="empty">Hanya siswa yang deskripsinya masih kosong</option>' +
        '<option value="filled">Hanya siswa yang sudah ada nilai</option>' +
        '<option value="all">Semua siswa (timpa)</option></select></div>' +
      '<div class="sheet-actions"><button class="btn" data-close>Batal</button><button class="btn btn-primary" id="bulk-go">Terapkan</button></div>'
    );
    $('bulk-go').onclick = () => {
      const k = $('bulk-k').value, t = $('bulk-t').value, target = $('bulk-target').value;
      if (!k && !t) { C.toast('Pilih minimal satu deskripsi', 'warning'); return; }
      let count = 0;
      siswaKelas(ui.kelas).forEach(s => {
        const n = getN(s.nisn + '|' + ui.mapel) || {};
        const patch = {};
        if (k && (target !== 'empty' || !n.kuasai)) patch.kuasai = k;
        if (t && (target !== 'empty' || !n.tingkatkan)) patch.tingkatkan = t;
        if (target === 'filled' && !C.isFilled(n.nilai)) return;
        if (Object.keys(patch).length) { updateLocal(s.nisn, patch); count++; }
      });
      closeSheet();
      renderInput();
      renderHeader();
      C.toast('Deskripsi diterapkan ke ' + count + ' siswa', 'success');
    };
  }

  /* ===========================================================
     VIEW: DESKRIPSI
     =========================================================== */
  function renderDeskripsi() {
    const mapel = mapelList();
    if (!ui.deskMapel || !mapelByKode(ui.deskMapel)) ui.deskMapel = ui.mapel || (mapel[0] && mapel[0].kode);
    // Daftar pilihan mapel (dulu chip geser ke samping yang tidak terlihat bisa digeser)
    const semua = allDeskripsi();
    $('desk-mapel-select').innerHTML = mapel.map(m => {
      const n = semua.filter(d => d.kode === m.kode).length;
      return '<option value="' + esc(m.kode) + '"' + (m.kode === ui.deskMapel ? ' selected' : '') + '>' + esc(m.nama) + ' (' + n + ' deskripsi)</option>';
    }).join('');
    const idx = mapel.findIndex(m => m.kode === ui.deskMapel);
    $('desk-prev').disabled = idx <= 0;
    $('desk-next').disabled = idx < 0 || idx >= mapel.length - 1;

    const q = $('desk-search').value.trim().toLowerCase();
    const t = $('desk-tingkat').value;
    const pendingIds = new Set(Object.values(LD.added).filter(d => d.dirty).map(d => d.id));
    const usage = {};
    Object.values(Object.assign({}, DB.nilai, L)).forEach(n => {
      if (n.kode !== ui.deskMapel) return;
      if (n.kuasai) usage[n.kuasai] = (usage[n.kuasai] || 0) + 1;
      if (n.tingkatkan) usage[n.tingkatkan] = (usage[n.tingkatkan] || 0) + 1;
    });
    const list = allDeskripsi()
      .filter(d => d.kode === ui.deskMapel)
      .filter(d => t === 'all' || d.tingkat === 'Semua' || d.tingkat === t)
      .filter(d => !q || d.teks.toLowerCase().indexOf(q) >= 0)
      .sort((a, b) => a.teks.localeCompare(b.teks));

    $('desk-list').innerHTML = list.length ? list.map(d => {
      const mine = d.oleh === prefs.nama || LD.added[d.id];
      return '<div class="list-item"><div class="grow">' + esc(d.teks) +
        '<div class="meta">' + (d.tingkat === 'Semua' ? 'Semua tingkat' : 'Kelas ' + esc(d.tingkat)) + ' • ' + esc(d.oleh || '-') +
        (usage[d.teks] ? ' • dipakai ' + usage[d.teks] + 'x' : '') +
        (pendingIds.has(d.id) ? ' • <span style="color:var(--warning)">belum sinkron</span>' : '') + '</div></div>' +
        (mine ? '<button class="btn btn-sm" data-edit-desk="' + esc(d.id) + '">Ubah</button><button class="btn btn-sm" data-del-desk="' + esc(d.id) + '" style="color:var(--danger)">Hapus</button>' : '') +
        '</div>';
    }).join('') : '<div class="empty"><b>Belum ada deskripsi</b>Tekan "Tambah Deskripsi" untuk membuat daftar pilihan.</div>';
  }

  function openAddDesk(kode, onDone, existing) {
    const m = mapelByKode(kode);
    const ting = existing ? existing.tingkat : (ui.kelas ? C.tingkatOf(ui.kelas) || 'Semua' : 'Semua');
    openSheet(
      '<h3>' + (existing ? 'Ubah' : 'Tambah') + ' Deskripsi</h3><p class="muted" style="margin-bottom:12px;">' + esc(m ? m.nama : kode) + (existing ? '' : '. Satu baris = satu deskripsi (bisa sekaligus banyak).') + '</p>' +
      '<div class="field"><label>Teks deskripsi (kompetensi / tujuan pembelajaran)</label>' +
      '<textarea class="textarea" id="nd-teks" placeholder="Contoh: Menyelesaikan operasi hitung bilangan bulat">' + esc(existing ? existing.teks : '') + '</textarea></div>' +
      '<div class="field"><label>Berlaku untuk</label><select class="select" id="nd-ting">' +
      ['Semua', '7', '8', '9'].map(t => '<option value="' + t + '"' + (t === ting ? ' selected' : '') + '>' + (t === 'Semua' ? 'Semua tingkat' : 'Kelas ' + t) + '</option>').join('') +
      '</select></div>' +
      '<p class="muted">Tulis tanpa awalan "Baik dalam" — kalimat raport disusun otomatis, contoh: <i>' + esc(C.buildDeskripsi('NAMA SISWA', 85, 'Menyelesaikan soal cerita', 'Menghitung luas bangun datar', cfg())) + '</i></p>' +
      '<div class="sheet-actions"><button class="btn" data-close>Batal</button><button class="btn btn-primary" id="nd-save">Simpan</button></div>'
    );
    setTimeout(() => $('nd-teks').focus(), 50);
    $('nd-save').onclick = () => {
      const lines = $('nd-teks').value.split('\n').map(s => C.trimDot(s)).filter(Boolean);
      if (!lines.length) { C.toast('Teks deskripsi masih kosong', 'warning'); return; }
      const tingkat = $('nd-ting').value;
      const existingTeks = new Set(allDeskripsi().filter(d => d.kode === kode && (!existing || d.id !== existing.id)).map(d => d.teks.toLowerCase()));
      let added = 0;
      lines.forEach((teks, i) => {
        if (existingTeks.has(teks.toLowerCase())) return;
        const d = existing && i === 0
          ? Object.assign({}, existing, { teks, tingkat, updated: C.nowIso(), dirty: true })
          : { id: C.uid('D'), kode, tingkat, teks, oleh: prefs.nama, updated: C.nowIso(), dirty: true };
        LD.added[d.id] = d;
        added++;
      });
      saveLD();
      closeSheet();
      if (!added) { C.toast('Deskripsi sudah ada di daftar', 'warning'); return; }
      C.toast(existing ? 'Deskripsi diperbarui' : added + ' deskripsi ditambahkan (tersimpan di HP)', 'success');
      if (onDone) onDone(lines[0]);
      renderAll();
      if (prefs.autoSync && (C.isDemo() || C.isOnline())) sync({ silent: true });
    };
  }

  function deleteDesk(id) {
    const d = allDeskripsi().find(x => x.id === id);
    if (!d) return;
    if (!confirm('Hapus deskripsi ini dari daftar?\n\n"' + d.teks + '"\n\nNilai siswa yang sudah memakai deskripsi ini tidak berubah.')) return;
    const onServer = DB.deskripsi.some(x => x.id === id);
    delete LD.added[id];
    if (onServer && LD.deleted.indexOf(id) < 0) LD.deleted.push(id);
    saveLD();
    renderAll();
    C.toast('Deskripsi dihapus', 'success');
  }

  /* ===========================================================
     VIEW: WALI KELAS (kehadiran, kokurikuler, ekskul, catatan)
     Pilihan isian diatur admin di Pengaturan -> "Isian Wali Kelas".
     =========================================================== */
  const HADIR_F = [['hadir', 'Hadir'], ['sakit', 'Sakit'], ['izin', 'Izin'], ['alpa', 'Tidak Hadir']];

  function waliOn() {
    const c = cfg();
    return !!(c.wali_kehadiran || c.wali_kokurikuler || c.wali_ekskul || c.wali_catatan);
  }
  function waliEkskul() { return C.listKoma(cfg().wali_daftar_ekskul).slice(0, 2); }
  function opsiEkskul() { const o = C.listKoma(cfg().opsi_nilai_ekskul); return o.length ? o : ['Sangat Baik', 'Baik', 'Cukup', 'Kurang']; }
  function opsiKk() { const o = C.listKoma(cfg().opsi_nilai_kokurikuler); return o.length ? o : ['Sangat Baik', 'Baik', 'Cukup', 'Kurang']; }
  function hariEfektif() { return C.num(cfg().hari_efektif); }

  function waliClasses() {
    const all = C.classList(DB);
    if (!cfg().wali_kunci_kelas) return all;
    return all.filter(k => C.samaNama(prefs.nama, C.kelasInfo(DB, k).wali));
  }

  // Data pelengkap dari server + perubahan di HP ini
  function walVal(nisn) {
    return Object.assign({ nisn }, DB.pelengkap[nisn] || {}, (W[nisn] || {}).patch || {});
  }

  // Angka kehadiran dikirim sebagai angka, bukan teks
  function waliRowPatch(patch) {
    const out = Object.assign({}, patch);
    HADIR_F.forEach(f => { if (out[f[0]] !== undefined && out[f[0]] !== '') out[f[0]] = C.num(out[f[0]]); });
    return out;
  }

  function waliStatus(p) {
    const c = cfg(), s = {};
    if (c.wali_kehadiran) s.hadir = HADIR_F.some(f => C.isFilled(p[f[0]]));
    if (c.wali_kokurikuler) s.kk = !!p.kk_nilai && !!(p.kk_kuat || p.kk_lemah || p.kk_desk);
    if (c.wali_ekskul) s.ek = waliEkskul().every((e, i) => !!p['ek' + (i + 1) + '_nilai']);
    if (c.wali_catatan) s.cat = !!p.catatan;
    return s;
  }
  function waliLengkap(p) { return Object.values(waliStatus(p)).every(Boolean); }

  function optHtml(list, cur, ph) {
    return '<option value="">' + ph + '</option>' + list.map(v => '<option' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('') +
      (cur && list.indexOf(cur) < 0 ? '<option selected>' + esc(cur) + '</option>' : '');
  }

  function waliCardHtml(s, idx) {
    const c = cfg();
    const p = walVal(s.nisn);
    const w = W[s.nisn];
    let cls = 'student wali-card';
    let status = '<span class="row-status muted">Belum lengkap</span>';
    if (w && w.dirty) { cls += ' dirty'; status = '<span class="row-status" style="color:var(--warning)">● Tersimpan di HP</span>'; }
    else if (waliLengkap(p)) { cls += ' synced'; status = '<span class="row-status" style="color:var(--success)">✓ Lengkap</span>'; }
    let html = '<div class="' + cls + '" data-nisn="' + esc(s.nisn) + '">' +
      '<div class="student-head" style="margin-bottom:2px;"><div class="student-no">' + (s.no || idx + 1) + '</div>' +
      '<div class="student-name"><b>' + esc(s.nama) + '</b><span>NISN ' + esc(s.nisn) + ' • ' + status + '</span></div></div>';

    if (c.wali_kehadiran) {
      const ef = hariEfektif();
      const sisa = ef ? Math.max(0, ef - (C.num(p.sakit) || 0) - (C.num(p.izin) || 0) - (C.num(p.alpa) || 0)) : null;
      html += '<div class="wali-sec">Kehadiran (hari)' + (ef ? '<span>' + ef + ' hari efektif</span>' : '') + '</div><div class="hadir-grid">' +
        HADIR_F.map(f => '<label>' + f[1] + '<input class="input" type="number" inputmode="numeric" min="0" step="1" enterkeyhint="next" data-wf="' + f[0] + '" value="' +
          esc(C.isFilled(p[f[0]]) ? p[f[0]] : '') + '" placeholder="' + (f[0] === 'hadir' && sisa !== null ? sisa : '-') + '"></label>').join('') + '</div>';
    }
    if (c.wali_kokurikuler) {
      const dim = C.listBaris(c.kokurikuler_dimensi);
      html += '<div class="wali-sec">Kokurikuler' + (c.kokurikuler_kegiatan ? '<span>' + esc(c.kokurikuler_kegiatan) + '</span>' : '') + '</div><div class="wali-grid">' +
        '<div><label>Nilai</label><select class="select" data-wf="kk_nilai">' + optHtml(opsiKk(), p.kk_nilai, '- pilih nilai -') + '</select></div>' +
        '<div><label>✅ Sudah baik dalam</label><select class="select" data-wf="kk_kuat">' + optHtml(dim, p.kk_kuat, '- pilih dimensi -') + '</select></div>' +
        '<div><label>📈 Perlu penguatan dalam</label><select class="select" data-wf="kk_lemah">' + optHtml(dim, p.kk_lemah, '- pilih dimensi -') + '</select></div>' +
        '</div><div class="preview" data-kkprev>' + esc(C.buildKokurikuler(s.nama, p, c) || 'Pratinjau deskripsi kokurikuler akan tampil di sini.') + '</div>' +
        '<details' + (p.kk_desk ? ' open' : '') + '><summary>✎ Tulis deskripsi kokurikuler sendiri (opsional)</summary>' +
        '<textarea class="textarea" data-wf="kk_desk" placeholder="Kosongkan untuk memakai kalimat otomatis di atas. {NAMA} = nama siswa">' + esc(p.kk_desk) + '</textarea></details>';
    }
    const ek = waliEkskul();
    if (c.wali_ekskul && ek.length) {
      html += '<div class="wali-sec">Ekstrakurikuler</div><div class="wali-grid">' +
        ek.map((e, i) => '<div><label>' + esc(e) + '</label><select class="select" data-wf="ek' + (i + 1) + '_nilai" data-ek="' + esc(e) + '">' +
          optHtml(opsiEkskul(), p['ek' + (i + 1) + '_nilai'], '- belum dinilai -') + '</select></div>').join('') + '</div>';
    }
    if (c.wali_catatan) {
      html += '<div class="wali-sec">Catatan Wali Kelas</div><textarea class="textarea" data-wf="catatan" placeholder="Catatan perkembangan siswa (opsional)">' + esc(p.catatan) + '</textarea>';
    }
    return html + '</div>';
  }

  function renderWali() {
    const classes = waliClasses();
    const sel = $('wali-kelas');
    if (!classes.length) {
      sel.innerHTML = '';
      $('wali-body').classList.add('hidden');
      $('wali-alert').innerHTML = '<div class="empty"><b>Anda belum terdaftar sebagai wali kelas</b>Nama "' + esc(prefs.nama) +
        '" belum cocok dengan nama wali kelas mana pun. Samakan nama di menu Akun dengan nama wali kelas, atau hubungi admin.</div>';
      return;
    }
    if (!ui.waliKelas || classes.indexOf(ui.waliKelas) < 0) {
      ui.waliKelas = classes.find(k => C.samaNama(prefs.nama, C.kelasInfo(DB, k).wali)) || classes[0];
    }
    sel.innerHTML = classes.map(k => {
      const wali = C.kelasInfo(DB, k).wali;
      return '<option value="' + esc(k) + '"' + (k === ui.waliKelas ? ' selected' : '') + '>' + (C.samaNama(prefs.nama, wali) ? '★ ' : '') + 'Kelas ' + esc(k) + ' — ' + esc(wali || '-') + '</option>';
    }).join('');
    $('wali-body').classList.remove('hidden');
    let alert = '';
    if (C.backendOutdated(DB)) {
      alert += '<div class="card" style="margin-bottom:10px;border-color:var(--warning);font-size:13px;">⚠️ Server sekolah belum diperbarui. Isian <b>Hadir &amp; Kokurikuler</b> tetap tersimpan di HP ini, tetapi belum masuk spreadsheet sampai admin memperbarui Code.gs.</div>';
    }
    const info = C.kelasInfo(DB, ui.waliKelas);
    if (info.wali && !C.samaNama(prefs.nama, info.wali)) {
      alert += '<p class="muted" style="margin-bottom:10px;">Wali kelas ' + esc(ui.waliKelas) + ': <b>' + esc(info.wali) + '</b>. Pastikan Anda berwenang mengisi kelas ini.</p>';
    }
    $('wali-alert').innerHTML = alert;
    $('btn-wali-hadir').classList.toggle('hidden', !(cfg().wali_kehadiran && hariEfektif()));
    renderWaliList();
  }

  function renderWaliList() {
    const all = siswaKelas(ui.waliKelas);
    const q = $('wali-search').value.trim().toUpperCase();
    const f = $('wali-filter').value;
    const list = all.filter(s => {
      if (q && s.nama.indexOf(q) < 0 && s.nisn.indexOf(q) < 0) return false;
      if (f === 'incomplete') return !waliLengkap(walVal(s.nisn));
      if (f === 'dirty') return !!(W[s.nisn] && W[s.nisn].dirty);
      return true;
    });
    $('wali-list').innerHTML = !all.length ? '<div class="empty"><b>Belum ada siswa di kelas ini</b>Minta admin menambahkan data siswa.</div>'
      : !list.length ? '<div class="empty"><b>Tidak ada siswa yang cocok</b>Ubah pencarian atau filter.</div>'
      : list.map(waliCardHtml).join('');
    renderWaliStats();
  }

  function renderWaliStats() {
    const all = siswaKelas(ui.waliKelas);
    const c = cfg();
    let done = 0, hadir = 0, kk = 0, pend = 0;
    all.forEach(s => {
      const st = waliStatus(walVal(s.nisn));
      if (Object.values(st).every(Boolean)) done++;
      if (st.hadir) hadir++;
      if (st.kk) kk++;
      if (W[s.nisn] && W[s.nisn].dirty) pend++;
    });
    $('wali-stats').innerHTML = '<div class="stat"><b>' + done + '/' + all.length + '</b><span>Lengkap</span></div>' +
      (c.wali_kehadiran ? '<div class="stat"><b>' + hadir + '</b><span>Kehadiran</span></div>' : '') +
      (c.wali_kokurikuler ? '<div class="stat"><b>' + kk + '</b><span>Kokurikuler</span></div>' : '') +
      '<div class="stat"><b>' + pend + '</b><span>Blm sinkron</span></div>';
    $('wali-bar').style.width = (all.length ? Math.round(done / all.length * 100) : 0) + '%';
  }

  function updateWali(nisn, patch) {
    const cur = W[nisn] || { patch: {} };
    W[nisn] = { patch: Object.assign({}, cur.patch, patch), dirty: true, updated: C.nowIso(), syncedAt: cur.syncedAt };
    saveW();
  }

  function refreshWaliCard(card) {
    const nisn = card.dataset.nisn;
    const s = DB.siswa.find(x => x.nisn === nisn);
    card.classList.add('dirty');
    card.classList.remove('synced');
    const stEl = card.querySelector('.row-status');
    if (stEl) { stEl.className = 'row-status'; stEl.style.color = 'var(--warning)'; stEl.textContent = '● Tersimpan di HP'; }
    const pv = card.querySelector('[data-kkprev]');
    if (pv) pv.textContent = C.buildKokurikuler(s ? s.nama : '', walVal(nisn), cfg()) || 'Pratinjau deskripsi kokurikuler akan tampil di sini.';
    renderWaliStats();
    renderHeader();
  }

  function onWaliInput(e) {
    const el = e.target;
    const f = el.dataset.wf;
    const card = el.closest('.wali-card');
    if (!f || !card) return;
    let v = el.value.trim();
    if (HADIR_F.some(x => x[0] === f)) {
      if (v !== '') {
        const n = C.num(v);
        if (n === null || n < 0 || n !== Math.floor(n) || n > 366) {
          el.style.borderColor = 'var(--danger)';
          C.toast('Isi jumlah hari dengan bilangan bulat 0 atau lebih', 'warning');
          return;
        }
        v = String(n);
      }
      el.style.borderColor = '';
    }
    const patch = {};
    patch[f] = v;
    // nilai ekskul: nama ekskul ikut disimpan agar tampil di raport
    if (/^ek[12]_nilai$/.test(f) && v) patch[f.slice(0, 3)] = el.dataset.ek;
    updateWali(card.dataset.nisn, patch);
    refreshWaliCard(card);
    if (f === 'kk_desk' && v) C.toast('Deskripsi kokurikuler ditulis sendiri (kalimat otomatis tidak dipakai)', 'info');
  }

  function onWaliKey(e) {
    if (e.key !== 'Enter' || e.target.type !== 'number') return;
    e.preventDefault();
    const inputs = Array.from(document.querySelectorAll('#wali-list input[type="number"]'));
    const i = inputs.indexOf(e.target);
    if (i >= 0 && i < inputs.length - 1) {
      inputs[i + 1].focus();
      inputs[i + 1].select();
      inputs[i + 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else e.target.blur();
  }

  function hitungHadir() {
    const ef = hariEfektif();
    if (!ef) return;
    const list = siswaKelas(ui.waliKelas);
    const rumus = 'HADIR = ' + ef + ' hari efektif − Sakit − Izin − Tidak Hadir';
    let target = list.filter(s => !C.isFilled(walVal(s.nisn).hadir));
    if (!target.length) {
      if (!confirm('Semua HADIR sudah terisi. Hitung ulang & timpa untuk ' + list.length + ' siswa?\n\n' + rumus)) return;
      target = list;
    } else if (!confirm(rumus + '\n\nHitung untuk ' + target.length + ' siswa yang HADIR-nya masih kosong?')) return;
    target.forEach(s => {
      const p = walVal(s.nisn);
      updateWali(s.nisn, { hadir: String(Math.max(0, ef - (C.num(p.sakit) || 0) - (C.num(p.izin) || 0) - (C.num(p.alpa) || 0))) });
    });
    if (target.length) { renderWaliList(); renderHeader(); C.toast('HADIR dihitung untuk ' + target.length + ' siswa', 'success'); }
  }

  function openWaliBulk() {
    const c = cfg();
    let html = '<h3>Isi Massal Wali Kelas</h3><p class="muted" style="margin-bottom:12px;">Kelas ' + esc(ui.waliKelas) + '. Pilihan yang dibiarkan "(tidak diubah)" diabaikan.</p>';
    if (c.wali_kehadiran) {
      html += '<div class="field"><label>Kehadiran</label><select class="select" id="wb-nol"><option value="">(tidak diubah)</option><option value="1">Sakit / Izin / Tidak Hadir yang kosong diisi 0</option></select></div>';
    }
    if (c.wali_kokurikuler) {
      const dim = C.listBaris(c.kokurikuler_dimensi);
      html += '<div class="field"><label>Kokurikuler: Nilai</label><select class="select" id="wb-kk_nilai">' + optHtml(opsiKk(), '', '(tidak diubah)') + '</select></div>' +
        '<div class="field"><label>Kokurikuler: Sudah baik dalam</label><select class="select" id="wb-kk_kuat">' + optHtml(dim, '', '(tidak diubah)') + '</select></div>' +
        '<div class="field"><label>Kokurikuler: Perlu penguatan dalam</label><select class="select" id="wb-kk_lemah">' + optHtml(dim, '', '(tidak diubah)') + '</select></div>';
    }
    if (c.wali_ekskul) {
      html += waliEkskul().map((e, i) => '<div class="field"><label>Nilai ' + esc(e) + '</label><select class="select" id="wb-ek' + (i + 1) + '_nilai" data-ek="' + esc(e) + '">' +
        optHtml(opsiEkskul(), '', '(tidak diubah)') + '</select></div>').join('');
    }
    html += '<div class="field"><label>Terapkan ke</label><select class="select" id="wb-target">' +
      '<option value="empty">Hanya isian yang masih kosong</option><option value="all">Semua siswa (timpa)</option></select></div>' +
      '<div class="sheet-actions"><button class="btn" data-close>Batal</button><button class="btn btn-primary" id="wb-go">Terapkan</button></div>';
    openSheet(html);
    $('wb-go').onclick = () => {
      const all = $('wb-target').value === 'all';
      const vals = {};
      ['kk_nilai', 'kk_kuat', 'kk_lemah', 'ek1_nilai', 'ek2_nilai'].forEach(k => { const el = $('wb-' + k); if (el && el.value) vals[k] = el.value; });
      const nol = $('wb-nol') && $('wb-nol').value === '1';
      if (!Object.keys(vals).length && !nol) { C.toast('Pilih minimal satu isian', 'warning'); return; }
      let n = 0;
      siswaKelas(ui.waliKelas).forEach(s => {
        const p = walVal(s.nisn);
        const patch = {};
        Object.keys(vals).forEach(k => {
          if (!all && p[k]) return;
          patch[k] = vals[k];
          if (/^ek[12]_nilai$/.test(k)) patch[k.slice(0, 3)] = $('wb-' + k).dataset.ek;
        });
        if (nol) ['sakit', 'izin', 'alpa'].forEach(k => { if (!C.isFilled(p[k])) patch[k] = '0'; });
        if (Object.keys(patch).length) { updateWali(s.nisn, patch); n++; }
      });
      closeSheet();
      renderWaliList();
      renderHeader();
      C.toast('Diterapkan ke ' + n + ' siswa (tersimpan di HP)', 'success');
    };
  }

  function exportWali() {
    if (typeof XLSX === 'undefined') { C.toast('Pustaka Excel belum termuat, coba lagi', 'warning'); return; }
    const c = cfg();
    const ek = waliEkskul();
    const head = ['NO', 'NISN', 'NIS', 'NAMA', 'KELAS', 'HADIR', 'SAKIT', 'IZIN', 'TIDAK HADIR', 'KOKURIKULER_NILAI', 'KOKURIKULER_DESKRIPSI']
      .concat(ek.map(e => 'NILAI_' + e.toUpperCase().replace(/\s+/g, '_'))).concat(['CATATAN_WALI']);
    const aoa = [['Kelas', ui.waliKelas], ['Wali Kelas', C.kelasInfo(DB, ui.waliKelas).wali || prefs.nama], [], head];
    siswaKelas(ui.waliKelas).forEach((s, i) => {
      const p = walVal(s.nisn);
      aoa.push([s.no || i + 1, s.nisn, s.nis, s.nama, s.kelas].concat(HADIR_F.map(f => C.num(p[f[0]]))).concat([p.kk_nilai || '', C.buildKokurikuler(s.nama, p, c)])
        .concat(ek.map((e, j) => p['ek' + (j + 1) + '_nilai'] || '')).concat([p.catatan || '']));
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 10 }, { wch: 32 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 7 }, { wch: 11 }, { wch: 12 }, { wch: 70 }]
      .concat(ek.map(() => ({ wch: 12 }))).concat([{ wch: 40 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ('Wali_' + ui.waliKelas).slice(0, 31));
    XLSX.writeFile(wb, 'Isian_Wali_Kelas_' + C.safeFileName(ui.waliKelas) + '.xlsx');
  }

  /* ===========================================================
     VIEW: REKAP
     =========================================================== */
  function myRows() {
    return Object.values(L);
  }

  function renderRekap() {
    const rows = myRows();
    if (!rows.length) {
      $('rekap-list').innerHTML = '<div class="empty"><b>Belum ada nilai yang diinput dari HP ini</b>Mulai dari menu Nilai.</div>';
      return;
    }
    const groups = {};
    rows.forEach(r => {
      const k = r.kode + '|' + r.kelas;
      (groups[k] = groups[k] || []).push(r);
    });
    const keys = Object.keys(groups).sort();
    $('rekap-list').innerHTML = keys.map(k => {
      const [kode, kelas] = k.split('|');
      const m = mapelByKode(kode) || { nama: kode, kkm: 75 };
      const list = groups[k];
      const vals = list.filter(r => C.isFilled(r.nilai)).map(r => parseFloat(r.nilai));
      const total = siswaKelas(kelas).length;
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const pend = list.filter(r => r.dirty).length;
      const pct = total ? Math.round(vals.length / total * 100) : 0;
      return '<div class="card" style="margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">' +
          '<div><b>' + esc(m.nama) + '</b><div class="muted">Kelas ' + esc(kelas) + ' • ' + vals.length + '/' + total + ' siswa</div></div>' +
          (pend ? '<span class="badge badge-warn">' + pend + ' belum sinkron</span>' : '<span class="badge badge-ok">Tersinkron</span>') +
        '</div>' +
        '<div class="progress" style="margin:10px 0;"><i style="width:' + pct + '%"></i></div>' +
        '<div class="stats-row" style="margin-bottom:10px;">' +
          '<div class="stat"><b>' + (vals.length ? C.fmtNum(avg) : '-') + '</b><span>Rata-rata</span></div>' +
          '<div class="stat"><b>' + (vals.length ? Math.max.apply(null, vals) : '-') + '</b><span>Tertinggi</span></div>' +
          '<div class="stat"><b>' + (vals.length ? Math.min.apply(null, vals) : '-') + '</b><span>Terendah</span></div>' +
          '<div class="stat"><b>' + vals.filter(v => v < m.kkm).length + '</b><span>&lt; KKM</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn btn-sm btn-soft" data-open="' + esc(k) + '">Buka</button>' +
          '<button class="btn btn-sm" data-export="' + esc(k) + '">Excel</button>' +
          '<button class="btn btn-sm" data-share="' + esc(k) + '">WA</button>' +
        '</div></div>';
    }).join('');
  }

  function exportExcel(filterKey) {
    if (typeof XLSX === 'undefined') { C.toast('Pustaka Excel belum termuat, coba lagi', 'warning'); return; }
    const wb = XLSX.utils.book_new();
    const rows = myRows().filter(r => !filterKey || (r.kode + '|' + r.kelas) === filterKey);
    const groups = {};
    rows.forEach(r => { (groups[r.kode + '|' + r.kelas] = groups[r.kode + '|' + r.kelas] || []).push(r); });
    Object.keys(groups).sort().forEach(k => {
      const [kode, kelas] = k.split('|');
      const m = mapelByKode(kode) || { nama: kode, kkm: '' };
      const aoa = [['Mata Pelajaran', m.nama], ['Kelas', kelas], ['Guru', prefs.nama], [],
        ['NO', 'NISN', 'NAMA', 'NILAI'].concat(terpisah() ? ['NILAI_KETERAMPILAN'] : []).concat(['PREDIKAT', 'DESKRIPSI_DIKUASAI', 'DESKRIPSI_DITINGKATKAN', 'KALIMAT_RAPORT'])];
      siswaKelas(kelas).forEach((s, i) => {
        const n = getN(s.nisn + '|' + kode) || {};
        aoa.push([i + 1, s.nisn, s.nama, C.isFilled(n.nilai) ? n.nilai : ''].concat(terpisah() ? [C.isFilled(n.nilai_k) ? n.nilai_k : ''] : [])
          .concat([C.predikat(n.nilai, cfg()), n.kuasai || '', n.tingkatkan || '', C.buildDeskripsi(s.nama, n.nilai, n.kuasai, n.tingkatkan, cfg())]));
      });
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 32 }, { wch: 8 }].concat(terpisah() ? [{ wch: 10 }] : []).concat([{ wch: 9 }, { wch: 45 }, { wch: 45 }, { wch: 80 }]);
      XLSX.utils.book_append_sheet(wb, ws, (kode + '_' + kelas).slice(0, 31));
    });
    if (!wb.SheetNames.length) { C.toast('Belum ada data untuk diexport', 'warning'); return; }
    XLSX.writeFile(wb, 'Nilai_' + C.safeFileName(prefs.nama) + (filterKey ? '_' + filterKey.replace('|', '_') : '') + '.xlsx');
  }

  function shareText(filterKey) {
    const rows = myRows();
    const keys = filterKey ? [filterKey] : Array.from(new Set(rows.map(r => r.kode + '|' + r.kelas))).sort();
    let text = '📊 *REKAP INPUT NILAI*\n' + (cfg().nama_sekolah || '') + '\nGuru: ' + prefs.nama + '\n\n';
    keys.forEach(k => {
      const [kode, kelas] = k.split('|');
      const m = mapelByKode(kode) || { nama: kode, kkm: 75 };
      const vals = siswaKelas(kelas).map(s => getN(s.nisn + '|' + kode)).filter(n => n && C.isFilled(n.nilai)).map(n => parseFloat(n.nilai));
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      text += '• *' + m.nama + '* Kelas ' + kelas + ': ' + vals.length + '/' + siswaKelas(kelas).length + ' siswa, rata-rata ' + (vals.length ? C.fmtNum(avg) : '-') + ', < KKM: ' + vals.filter(v => v < m.kkm).length + '\n';
    });
    text += '\nStatus: ' + (pendingCount() ? pendingCount() + ' data belum sinkron' : 'semua sudah tersinkron ✅');
    if (navigator.share) {
      navigator.share({ text }).catch(() => { /* dibatalkan */ });
    } else {
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
    }
  }

  /* ===========================================================
     VIEW: DATA
     =========================================================== */
  function renderData() {
    const all = Object.values(L);
    const dirty = all.filter(n => n.dirty).length;
    const logs = C.Store.get(C.KEY.syncLog, []);
    const lastOk = logs.find(l => l.ok);
    $('data-info').innerHTML =
      '<div class="kv"><span>Nilai tersimpan di HP</span><b>' + all.length + '</b></div>' +
      '<div class="kv"><span>Belum tersinkron</span><b style="color:' + (dirty ? 'var(--warning)' : 'var(--success)') + '">' + dirty + '</b></div>' +
      '<div class="kv"><span>Deskripsi buatan saya (lokal)</span><b>' + Object.keys(LD.added).length + '</b></div>' +
      (waliOn() ? '<div class="kv"><span>Isian wali kelas di HP (belum sinkron)</span><b style="color:' + (waliPending() ? 'var(--warning)' : 'var(--success)') + '">' + Object.keys(W).length + ' (' + waliPending() + ')</b></div>' : '') +
      '<div class="kv"><span>Siswa / Mapel dari server</span><b>' + DB.siswa.length + ' / ' + mapelList().length + '</b></div>' +
      '<div class="kv"><span>Data server diambil</span><b>' + C.fmtDateTime(DB.fetchedAt) + '</b></div>' +
      '<div class="kv"><span>Sinkron berhasil terakhir</span><b>' + (lastOk ? C.fmtDateTime(lastOk.at) : '-') + '</b></div>' +
      '<div class="kv" style="border:none"><span>Ruang terpakai</span><b>' + C.Store.sizeKB() + ' KB</b></div>';
    $('sync-history').innerHTML = logs.length ? logs.slice(0, 10).map(l =>
      '<div class="list-item"><div class="grow">' + (l.ok ? '✅ Berhasil' : '⚠️ Gagal') + ' • ' + C.fmtDateTime(l.at) +
      '<div class="meta">' + (l.pushed || 0) + ' nilai dikirim' + (l.desk ? ', ' + l.desk + ' deskripsi' : '') + (l.wali ? ', ' + l.wali + ' isian wali kelas' : '') + (l.error ? ' • ' + esc(l.error) : '') + '</div></div></div>'
    ).join('') : '<div class="empty">Belum ada riwayat sinkron.</div>';
  }

  function confirmPending(rows) {
    const d = rows.filter(n => n.dirty).length;
    if (!d) return true;
    return confirm('PERHATIAN: ' + d + ' nilai BELUM tersinkron ke spreadsheet dan akan hilang permanen.\n\nSebaiknya tekan Sinkron dulu. Tetap hapus?');
  }

  function delCtx() {
    const keys = Array.from(new Set(Object.values(L).map(r => r.kode + '|' + r.kelas))).sort();
    if (!keys.length) { C.toast('Tidak ada data nilai di HP', 'info'); return; }
    openSheet('<h3>Hapus Nilai Tertentu</h3><p class="muted" style="margin-bottom:12px;">Hanya menghapus dari HP ini. Data di spreadsheet tidak terhapus.</p>' +
      '<div class="field"><select class="select" id="del-key">' + keys.map(k => {
        const [kode, kelas] = k.split('|');
        const m = mapelByKode(kode);
        const n = Object.values(L).filter(r => r.kode === kode && r.kelas === kelas).length;
        return '<option value="' + esc(k) + '">' + esc((m ? m.nama : kode) + ' - Kelas ' + kelas + ' (' + n + ' nilai)') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="sheet-actions"><button class="btn" data-close>Batal</button><button class="btn btn-danger" id="del-go">Hapus</button></div>');
    $('del-go').onclick = () => {
      const k = $('del-key').value;
      const rows = Object.values(L).filter(r => (r.kode + '|' + r.kelas) === k);
      if (!confirmPending(rows)) return;
      rows.forEach(r => delete L[r.id]);
      saveL();
      closeSheet();
      renderAll();
      C.toast(rows.length + ' nilai dihapus dari HP', 'success');
    };
  }

  function downloadBackup() {
    const data = { app: 'e-raport-guru', versi: C.CFG.VERSI, guru: prefs.nama, dibuat: C.nowIso(), nilai: L, deskripsi: LD, wali: W };
    C.downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'Cadangan_Nilai_' + C.safeFileName(prefs.nama) + '_' + new Date().toISOString().slice(0, 10) + '.json');
  }

  function restoreBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.app !== 'e-raport-guru' || !data.nilai) throw new Error('Bukan file cadangan aplikasi guru');
        let n = 0;
        Object.values(data.nilai).forEach(r => {
          const cur = L[r.id];
          if (!cur || String(r.updated) > String(cur.updated)) { L[r.id] = Object.assign({}, r, { dirty: true }); n++; }
        });
        if (data.deskripsi && data.deskripsi.added) {
          Object.values(data.deskripsi.added).forEach(d => { if (!LD.added[d.id]) LD.added[d.id] = Object.assign({}, d, { dirty: true }); });
        }
        let nw = 0;
        Object.keys(data.wali || {}).forEach(nisn => {
          const r = data.wali[nisn];
          const cur = W[nisn];
          if (r && r.patch && (!cur || String(r.updated) > String(cur.updated))) { W[nisn] = Object.assign({}, r, { dirty: true }); nw++; }
        });
        saveL();
        saveLD();
        saveW();
        renderAll();
        C.toast(n + ' nilai' + (nw ? ' & ' + nw + ' isian wali kelas' : '') + ' dipulihkan. Tekan Sinkron untuk mengirim ke spreadsheet.', 'success');
      } catch (e) {
        C.toast('Gagal memulihkan: ' + e.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ===========================================================
     VIEW: AKUN
     =========================================================== */
  function renderAkun() {
    $('akun-nama').value = prefs.nama;
    $('pref-autosync').checked = !!prefs.autoSync;
    $('pref-preview').checked = !!prefs.preview;
    $('pref-dark').checked = document.documentElement.getAttribute('data-theme') === 'dark';
    $('btn-install').classList.toggle('hidden', !installPrompt);
    $('about').innerHTML = esc(C.CFG.NAMA_APLIKASI) + ' v' + esc(C.CFG.VERSI) + '<br>' + (C.isDemo() ? 'Mode Demo (data hanya di perangkat ini)' : 'Terhubung ke spreadsheet sekolah');
  }

  /* ===========================================================
     SHEET (dialog bawah)
     =========================================================== */
  function openSheet(html) {
    $('sheet').innerHTML = html;
    $('sheet-backdrop').classList.add('open');
    $('sheet').querySelectorAll('[data-close]').forEach(b => { b.onclick = closeSheet; });
  }

  function closeSheet() {
    $('sheet-backdrop').classList.remove('open');
    $('sheet').innerHTML = '';
  }

  /* ===========================================================
     NAVIGASI & RENDER
     =========================================================== */
  function switchView(v) {
    ui.view = v;
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + v));
    document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    const editing = v === 'nilai' && ui.inputOpen;
    $('input-bar').classList.toggle('hidden', !editing);
    document.body.classList.toggle('editing', editing);
    renderAll();
    window.scrollTo(0, 0);
  }

  function renderAll() {
    if (ui.view === 'wali' && !waliOn()) { switchView('nilai'); return; }
    renderHeader();
    if (ui.view === 'nilai') { if (ui.inputOpen) renderInput(); else renderPick(); }
    if (ui.view === 'deskripsi') renderDeskripsi();
    if (ui.view === 'wali') renderWali();
    if (ui.view === 'rekap') renderRekap();
    if (ui.view === 'data') renderData();
    if (ui.view === 'akun') renderAkun();
  }

  function bind() {
    document.querySelectorAll('#tabbar button').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $('btn-sync').addEventListener('click', () => sync());
    $('btn-sync-now').addEventListener('click', () => sync());
    $('btn-back').addEventListener('click', closeInput);
    $('btn-close-input').addEventListener('click', closeInput);
    $('btn-save').addEventListener('click', onSave);
    $('btn-bulk').addEventListener('click', openBulk);

    $('pick-mapel').addEventListener('click', e => {
      const b = e.target.closest('[data-mapel]');
      if (!b) return;
      ui.mapel = b.dataset.mapel;
      renderPick();
      $('pick-kelas-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('pick-kelas').addEventListener('click', e => {
      const b = e.target.closest('[data-kelas]');
      if (b) openInput(ui.mapel, b.dataset.kelas);
    });

    const list = $('student-list');
    list.addEventListener('change', onListInput);
    list.addEventListener('keydown', onListKey);
    list.addEventListener('focusin', e => { if (e.target.classList.contains('score')) e.target.select(); });
    let t;
    $('search-siswa').addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderInput, 200); });
    $('filter-siswa').addEventListener('change', renderInput);

    $('desk-mapel-select').addEventListener('change', e => { ui.deskMapel = e.target.value; renderDeskripsi(); });
    const geserMapel = d => {
      const mapel = mapelList();
      const i = mapel.findIndex(m => m.kode === ui.deskMapel) + d;
      if (i < 0 || i >= mapel.length) return;
      ui.deskMapel = mapel[i].kode;
      renderDeskripsi();
    };
    $('desk-prev').addEventListener('click', () => geserMapel(-1));
    $('desk-next').addEventListener('click', () => geserMapel(1));
    $('desk-search').addEventListener('input', renderDeskripsi);
    $('desk-tingkat').addEventListener('change', renderDeskripsi);
    $('btn-add-desk').addEventListener('click', () => openAddDesk(ui.deskMapel));
    $('desk-list').addEventListener('click', e => {
      const ed = e.target.closest('[data-edit-desk]');
      const del = e.target.closest('[data-del-desk]');
      if (ed) {
        const d = allDeskripsi().find(x => x.id === ed.dataset.editDesk);
        if (d) openAddDesk(d.kode, null, d);
      }
      if (del) deleteDesk(del.dataset.delDesk);
    });

    $('wali-kelas').addEventListener('change', e => {
      ui.waliKelas = e.target.value;
      prefs.waliKelas = ui.waliKelas;
      savePrefs();
      renderWali();
    });
    const wl = $('wali-list');
    wl.addEventListener('change', onWaliInput);
    wl.addEventListener('keydown', onWaliKey);
    wl.addEventListener('focusin', e => { if (e.target.type === 'number') e.target.select(); });
    let tw;
    $('wali-search').addEventListener('input', () => { clearTimeout(tw); tw = setTimeout(renderWaliList, 200); });
    $('wali-filter').addEventListener('change', renderWaliList);
    $('btn-wali-bulk').addEventListener('click', openWaliBulk);
    $('btn-wali-hadir').addEventListener('click', hitungHadir);
    $('btn-wali-export').addEventListener('click', exportWali);
    $('btn-wali-send').addEventListener('click', () => {
      if (!waliPending()) { C.toast('Semua isian wali kelas sudah tersinkron', 'success'); sync({ silent: true }); return; }
      sync();
    });

    $('rekap-list').addEventListener('click', e => {
      const o = e.target.closest('[data-open]');
      const x = e.target.closest('[data-export]');
      const s = e.target.closest('[data-share]');
      if (o) { const [kode, kelas] = o.dataset.open.split('|'); switchView('nilai'); openInput(kode, kelas); }
      if (x) exportExcel(x.dataset.export);
      if (s) shareText(s.dataset.share);
    });
    $('btn-export-mine').addEventListener('click', () => exportExcel(null));
    $('btn-share-rekap').addEventListener('click', () => shareText(null));

    $('btn-backup').addEventListener('click', downloadBackup);
    $('file-restore').addEventListener('change', e => { if (e.target.files[0]) restoreBackup(e.target.files[0]); e.target.value = ''; });
    $('btn-del-ctx').addEventListener('click', delCtx);
    $('btn-del-synced').addEventListener('click', () => {
      const rows = Object.values(L).filter(r => !r.dirty);
      if (!rows.length) { C.toast('Tidak ada nilai tersinkron di HP', 'info'); return; }
      if (!confirm('Hapus ' + rows.length + ' nilai yang SUDAH tersinkron dari HP ini?\nData di spreadsheet tetap aman.')) return;
      rows.forEach(r => delete L[r.id]);
      saveL();
      renderAll();
      C.toast(rows.length + ' nilai dihapus dari HP', 'success');
    });
    $('btn-del-all').addEventListener('click', () => {
      const rows = Object.values(L);
      if (!rows.length) { C.toast('Tidak ada data nilai di HP', 'info'); return; }
      if (!confirm('Hapus SEMUA ' + rows.length + ' nilai dari HP ini?')) return;
      if (!confirmPending(rows)) return;
      L = {};
      saveL();
      renderAll();
      C.toast('Semua nilai di HP dihapus', 'success');
    });
    $('btn-reset').addEventListener('click', () => {
      if (!confirmPending(Object.values(L))) return;
      if (waliPending() && !confirm('PERHATIAN: ' + waliPending() + ' isian wali kelas BELUM tersinkron dan akan hilang. Tetap hapus?')) return;
      if (!confirm('Hapus semua data aplikasi di HP ini (nilai, isian wali kelas, deskripsi lokal, cache) lalu keluar?')) return;
      [C.KEY.guruNilai, C.KEY.guruDesk, C.KEY.guruWali, C.KEY.syncLog, C.KEY.db, C.KEY.guruPrefs].forEach(k => C.Store.remove(k));
      C.logout();
    });

    $('btn-save-nama').addEventListener('click', () => {
      const v = $('akun-nama').value.trim();
      if (!v) { C.toast('Nama tidak boleh kosong', 'warning'); return; }
      prefs.nama = v;
      savePrefs();
      const s = C.getSession();
      s.nama = v;
      C.setSession(s);
      renderHeader();
      C.toast('Nama disimpan', 'success');
    });
    $('pref-autosync').addEventListener('change', e => { prefs.autoSync = e.target.checked; savePrefs(); });
    $('pref-preview').addEventListener('change', e => { prefs.preview = e.target.checked; savePrefs(); });
    $('pref-dark').addEventListener('change', () => C.toggleTheme());
    $('btn-logout').addEventListener('click', () => {
      const p = pendingCount();
      if (p && !confirm(p + ' data belum tersinkron. Data tetap tersimpan di HP dan bisa dikirim setelah masuk lagi (harus online).\n\nKeluar sekarang?')) return;
      C.logout();
    });
    $('btn-install').addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      installPrompt = null;
      renderAkun();
    });

    $('sheet-backdrop').addEventListener('click', e => { if (e.target.id === 'sheet-backdrop') closeSheet(); });

    window.addEventListener('online', () => {
      renderHeader();
      if (prefs.autoSync && pendingCount()) sync({ silent: true });
    });
    window.addEventListener('offline', renderHeader);
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
    window.addEventListener('beforeunload', e => {
      if (syncing) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    mergeServer();
    renderAll();
    C.registerSW();
    // Ambil data terbaru setiap kali aplikasi dibuka (bila online)
    if (C.isDemo() || C.isOnline()) {
      const fresh = Date.now() - new Date(DB.fetchedAt).getTime() < 60000;
      if (!fresh || pendingCount()) sync({ silent: true });
    }
  });
})();
