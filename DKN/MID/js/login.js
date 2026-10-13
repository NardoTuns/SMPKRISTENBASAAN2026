/**
 * Halaman Login (Guru / Admin)
 */
(function () {
  const C = window.Core;
  const CFG = C.CFG;
  let role = 'guru';

  const $ = id => document.getElementById(id);

  function setRole(r) {
    role = r;
    document.querySelectorAll('.role-tab').forEach(b => b.classList.toggle('active', b.dataset.role === r));
    $('field-nama').classList.toggle('hidden', r !== 'guru');
    $('password').value = '';
    $('password').focus();
  }

  function updateNet() {
    const box = $('net-status');
    const text = $('net-text');
    const btn = $('btn-login');
    box.classList.remove('off', 'demo');
    if (!CFG.API_URL) {
      box.classList.add('demo');
      text.textContent = 'Mode Demo: API_URL di js/config.js belum diisi. Data hanya tersimpan di perangkat ini.';
      btn.disabled = false;
    } else if (!C.isOnline()) {
      box.classList.add('off');
      text.textContent = 'Tidak ada internet. Anda harus online untuk masuk.';
      btn.disabled = true;
    } else {
      text.textContent = 'Online - siap mengambil data dari spreadsheet.';
      btn.disabled = false;
    }
  }

  function loading(on, msg) {
    $('loading').classList.toggle('active', !!on);
    if (msg) $('loading-text').textContent = msg;
  }

  function showResume() {
    const s = C.getSession();
    const box = $('resume-box');
    if (!s) { box.classList.add('hidden'); return; }
    const label = s.role === 'admin' ? 'Admin' : ('Guru: ' + (s.nama || '-'));
    box.innerHTML = 'Anda masih masuk sebagai <b>' + C.esc(label) + '</b>.' +
      '<div style="display:flex;gap:8px;margin-top:10px;">' +
      '<a class="btn btn-primary btn-sm" href="' + (s.role === 'admin' ? 'admin.html' : 'guru.html') + '">Lanjutkan</a>' +
      '<button type="button" class="btn btn-sm" id="btn-switch">Ganti akun</button></div>';
    box.classList.remove('hidden');
    $('btn-switch').onclick = () => { C.Store.remove(C.KEY.session); showResume(); };
  }

  async function doLogin(e) {
    e.preventDefault();
    const pass = $('password').value;
    const nama = $('nama').value.trim();
    const expected = role === 'admin' ? CFG.PASSWORD_ADMIN : CFG.PASSWORD_GURU;

    if (role === 'guru' && !nama) {
      C.toast('Isi nama guru terlebih dahulu', 'warning');
      $('nama').focus();
      return;
    }
    if (pass !== expected) {
      C.toast('Password salah', 'error');
      $('password').select();
      return;
    }
    if (CFG.API_URL && !C.isOnline()) {
      C.toast('Harus online untuk masuk', 'error');
      return;
    }

    const prev = C.getSession();
    const session = { role: role, nama: role === 'admin' ? 'Admin' : nama, demo: !CFG.API_URL, loginAt: C.nowIso() };
    C.setSession(session);
    try {
      loading(true, 'Mengambil data dari spreadsheet...');
      let { db } = await C.fetchDB();

      if (db.mapel.length === 0) {
        if (role === 'admin') {
          loading(true, 'Spreadsheet masih kosong. Mengisi data awal (mapel, kelas, pengaturan)...');
          const S = window.SEED;
          await C.api('seed', { data: { config: S.config, kelas: S.kelas, mapel: S.mapel } });
          db = (await C.fetchDB()).db;
        } else {
          throw new Error('Data mapel belum disiapkan Admin. Minta Admin masuk terlebih dahulu.');
        }
      }

      if (role === 'guru') {
        const prefs = C.Store.get(C.KEY.guruPrefs, {});
        prefs.nama = nama;
        C.Store.set(C.KEY.guruPrefs, prefs);
      }
      loading(true, 'Berhasil! Membuka aplikasi...');
      window.location.href = role === 'admin' ? 'admin.html' : 'guru.html';
    } catch (err) {
      loading(false);
      if (prev) C.setSession(prev); else C.Store.remove(C.KEY.session);
      C.toast('Gagal masuk: ' + err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.role-tab').forEach(b => b.addEventListener('click', () => setRole(b.dataset.role)));
    $('pass-toggle').addEventListener('click', () => {
      const p = $('password');
      p.type = p.type === 'password' ? 'text' : 'password';
    });
    $('login-form').addEventListener('submit', doLogin);
    const prefs = C.Store.get(C.KEY.guruPrefs, {});
    if (prefs.nama) $('nama').value = prefs.nama;
    $('app-version').textContent = (CFG.NAMA_APLIKASI || 'E-Raport') + ' v' + (CFG.VERSI || '');
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
    showResume();
    C.registerSW();
  });
})();
