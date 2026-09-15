/* =========================================================
   SIABSEN - Sistem Absensi Guru (Offline-First)
   ========================================================= */

/* ---------- CONSTANTS / STORAGE KEYS ---------- */
const LS = {
  SERVER_URL: 'siabsen_server_url',
  PASS_HASH: 'siabsen_pass_hash',
  TEACHERS: 'siabsen_teachers',
  RECORDS: 'siabsen_records',
  KOP: 'siabsen_kop',
  THEME: 'siabsen_theme',
  LAST_SYNC: 'siabsen_last_sync',
  LOGGED_IN: 'siabsen_logged_in',
  DELETED_TEACHERS: 'siabsen_deleted_teachers'
};

const STATUS_COLORS = { Hadir:'pill-hadir', Sakit:'pill-sakit', Izin:'pill-izin', Alpa:'pill-alpa' };

/* ---------- UTILITIES ---------- */
function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function uid(){ return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){
  const dt = new Date(d+'T00:00:00');
  return dt.toLocaleDateString('id-ID',{weekday:'long', year:'numeric', month:'long', day:'numeric'});
}
function getJSON(key, fallback){
  try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; }
}
function setJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function toast(msg, type=''){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=> t.classList.add('hidden'), 3000);
}
function isOnline(){ return navigator.onLine; }

/* ---------- STATE ---------- */
let teachers = getJSON(LS.TEACHERS, []);
let records = getJSON(LS.RECORDS, []);
let kop = getJSON(LS.KOP, {l1:'SMP KRISTEN BASAAN', l2:'KECAMATAN RATATOTOK', l3:'KABUPATEN MINAHASA TENGGARA'});

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', init);

function init(){
  // theme
  if(getJSON(LS.THEME,'light')==='dark'){
    document.documentElement.setAttribute('data-theme','dark');
    $('#toggleDark').checked = true;
  }
  setTimeout(()=>{
    $('#splash').classList.add('hidden');
    const loggedIn = localStorage.getItem(LS.LOGGED_IN) === '1';
    const hasServer = !!localStorage.getItem(LS.SERVER_URL);
    if(loggedIn && hasServer){
      enterApp();
    }else{
      $('#authScreen').classList.remove('hidden');
      prepareAuthScreen();
    }
  }, 700);

  bindAuthEvents();
  bindAppEvents();
  window.addEventListener('online', updateSyncMini);
  window.addEventListener('offline', updateSyncMini);
}

/* =========================================================
   AUTH / SETUP SCREEN
   ========================================================= */
function prepareAuthScreen(){
  // Jika admin sudah menanamkan URL server di config.js, otomatis simpan
  // ke localStorage supaya guru tidak perlu mengatur apa pun.
  if(typeof DEFAULT_SERVER_URL !== 'undefined' && DEFAULT_SERVER_URL && !localStorage.getItem(LS.SERVER_URL)){
    localStorage.setItem(LS.SERVER_URL, DEFAULT_SERVER_URL);
  }
  if(typeof DEFAULT_SCHOOL_NAME !== 'undefined' && DEFAULT_SCHOOL_NAME && !kop.l1){
    kop.l1 = DEFAULT_SCHOOL_NAME;
    setJSON(LS.KOP, kop);
  }

  const urlPreconfigured = !!(typeof DEFAULT_SERVER_URL !== 'undefined' && DEFAULT_SERVER_URL);
  $('#loginTabs').classList.toggle('hidden', urlPreconfigured);
  $('#adminServerLink').classList.toggle('hidden', !urlPreconfigured);
  if(urlPreconfigured){
    $all('#loginTabs .tab-btn')[0].classList.add('active');
    $('#loginPanel').classList.add('active');
    $('#setupPanel').classList.remove('active');
  }

  const hasHash = !!localStorage.getItem(LS.PASS_HASH);
  const online = isOnline();
  $('#onlineLoginBox').classList.toggle('hidden', !(online || !hasHash) || (hasHash && !online ? true:false));
  if(hasHash && !online){
    $('#onlineLoginBox').classList.add('hidden');
    $('#offlineLoginBox').classList.remove('hidden');
  }else{
    $('#onlineLoginBox').classList.remove('hidden');
    $('#offlineLoginBox').classList.add('hidden');
  }
  const url = localStorage.getItem(LS.SERVER_URL) || '';
  $('#serverUrl').value = url;
  $('#schoolNameInput').value = kop.l1 || '';
}

function bindAuthEvents(){
  $all('#loginTabs .tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $all('#loginTabs .tab-btn').forEach(b=>b.classList.remove('active'));
      $all('.tab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      $('#'+btn.dataset.tab+'Panel').classList.add('active');
    });
  });

  $('#btnSaveServer').addEventListener('click', ()=>{
    const url = $('#serverUrl').value.trim();
    if(!url){ toast('Masukkan URL server terlebih dahulu','error'); return; }
    localStorage.setItem(LS.SERVER_URL, url);
    if($('#schoolNameInput').value.trim()){
      kop.l1 = $('#schoolNameInput').value.trim();
      setJSON(LS.KOP, kop);
    }
    toast('Pengaturan server disimpan','success');
    $all('#loginTabs .tab-btn')[0].click();
    prepareAuthScreen();
  });

  $('#btnLogin').addEventListener('click', doOnlineLogin);
  $('#btnLoginOffline').addEventListener('click', doOfflineLogin);

  $('#btnShowServerSettings').addEventListener('click', (e)=>{
    e.preventDefault();
    $('#loginTabs').classList.remove('hidden');
    $all('#loginTabs .tab-btn')[1].click();
  });
}

async function doOnlineLogin(){
  const pass = $('#loginPassword').value;
  const url = localStorage.getItem(LS.SERVER_URL);
  hideLoginError();
  if(!url){ showLoginError('Atur URL Server terlebih dahulu di tab "Pengaturan Server".'); return; }
  if(!pass){ showLoginError('Password wajib diisi.'); return; }

  if(!isOnline()){
    // fallback to offline check if hash exists
    const hash = localStorage.getItem(LS.PASS_HASH);
    if(hash){
      const inputHash = await sha256(pass);
      if(inputHash === hash){ finalizeLogin(); return; }
    }
    showLoginError('Tidak ada koneksi internet dan password tidak cocok dengan data lokal.');
    return;
  }

  $('#btnLogin').disabled = true;
  $('#btnLogin').textContent = '⏳ Menghubungkan...';
  try{
    const res = await fetch(url + '?action=login&password=' + encodeURIComponent(pass));
    const data = await res.json();
    if(!data.ok){
      showLoginError(data.message || 'Password salah.');
      return;
    }
    // success: store hash, teachers, kop
    localStorage.setItem(LS.PASS_HASH, await sha256(pass));
    if(Array.isArray(data.teachers)){
      teachers = data.teachers;
      setJSON(LS.TEACHERS, teachers);
    }
    if(data.config){
      if(data.config.l1 || data.config.l2 || data.config.l3){
        kop = { l1:data.config.l1||kop.l1, l2:data.config.l2||kop.l2, l3:data.config.l3||kop.l3 };
        setJSON(LS.KOP, kop);
      }
    }
    localStorage.setItem(LS.LAST_SYNC, new Date().toISOString());
    toast('Login & sinkronisasi berhasil!','success');
    finalizeLogin();
  }catch(err){
    console.error(err);
    showLoginError('Gagal menghubungi server. Periksa URL atau koneksi internet.');
  }finally{
    $('#btnLogin').disabled = false;
    $('#btnLogin').textContent = '🔄 Masuk & Sinkronkan';
  }
}

async function doOfflineLogin(){
  const pass = $('#loginPasswordOffline').value;
  const hash = localStorage.getItem(LS.PASS_HASH);
  hideLoginError();
  if(!hash){ showLoginError('Belum ada data login lokal. Sambungkan internet untuk login pertama kali.'); return; }
  const inputHash = await sha256(pass);
  if(inputHash === hash){ finalizeLogin(); }
  else{ showLoginError('Password salah.'); }
}

function showLoginError(msg){ $('#loginError').textContent = msg; $('#loginError').classList.remove('hidden'); }
function hideLoginError(){ $('#loginError').classList.add('hidden'); }

function finalizeLogin(){
  localStorage.setItem(LS.LOGGED_IN, '1');
  $('#authScreen').classList.add('hidden');
  enterApp();
}

function enterApp(){
  $('#appShell').classList.remove('hidden');
  $('#sidebarSchool').textContent = kop.l1 || 'Sekolah';
  $('#serverUrlShow').textContent = localStorage.getItem(LS.SERVER_URL) || '-';
  $('#kopBaris1').value = kop.l1 || '';
  $('#kopBaris2').value = kop.l2 || '';
  $('#kopBaris3').value = kop.l3 || '';
  fillTeacherSelects();
  $('#fTanggal').value = todayStr();
  updateSyncMini();
  renderDashboard();
  renderGuruTable();
  renderRecentAbsensi();
  updateLastSyncInfo();
}

/* =========================================================
   NAVIGATION
   ========================================================= */
function switchPage(page, label){
  $all('.nav-link, .bnav-link').forEach(l=> l.classList.toggle('active', l.dataset.page===page));
  $all('.page').forEach(p=>p.classList.remove('active'));
  $('#page-'+page).classList.add('active');
  if(label) $('#topbarTitle').textContent = label;
  if(page==='dashboard') renderDashboard();
}

function bindAppEvents(){
  $all('.nav-link, .bnav-link').forEach(link=>{
    link.addEventListener('click', (e)=>{
      e.preventDefault();
      const page = link.dataset.page;
      const label = link.textContent.trim();
      switchPage(page, label);
    });
  });

  $all('.report-subtabs .tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $all('.report-subtabs .tab-btn').forEach(b=>b.classList.remove('active'));
      $all('.subtab-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      $('#subtab-'+btn.dataset.subtab).classList.add('active');
    });
  });

  $('#btnLogout').addEventListener('click', ()=>{
    if(confirm('Keluar dari aplikasi? Data lokal tidak akan dihapus.')){
      localStorage.removeItem(LS.LOGGED_IN);
      location.reload();
    }
  });
  $('#btnSyncTop').addEventListener('click', syncNow);
  $('#btnSyncNow').addEventListener('click', syncNow);

  /* --- Absensi form --- */
  $all('.seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $all('.seg-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $('#fJenis').value = btn.dataset.val;
    });
  });
  $all('.status-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $all('.status-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $('#fStatus').value = btn.dataset.val;
      $('#ketStatusWrap').style.display = (btn.dataset.val==='Hadir') ? '' : '';
    });
  });
  $('#fKetStatus').addEventListener('change', ()=>{
    $('#fKetLainnya').classList.toggle('hidden', $('#fKetStatus').value !== 'Lainnya');
  });
  $('#formAbsensi').addEventListener('submit', saveAbsensi);
  $('#searchAbsensi').addEventListener('input', renderRecentAbsensi);

  /* --- Guru admin --- */
  $('#btnAddGuru').addEventListener('click', ()=> openGuruModal());
  $('#btnCancelGuru').addEventListener('click', closeGuruModal);
  $('#formGuru').addEventListener('submit', saveGuru);
  $('#searchGuru').addEventListener('input', renderGuruTable);

  /* --- Laporan --- */
  $('#lapHarianTanggal').value = todayStr();
  $('#btnGenLapHarian').addEventListener('click', renderLapHarian);
  $('#lapRentangDari').value = todayStr();
  $('#lapRentangSampai').value = todayStr();
  $('#btnGenLapRentang').addEventListener('click', renderLapRentang);
  $('#lapGuruDari').value = todayStr();
  $('#lapGuruSampai').value = todayStr();
  $('#btnGenLapGuru').addEventListener('click', renderLapGuru);

  /* --- Pengaturan --- */
  $('#btnSaveKop').addEventListener('click', ()=>{
    kop = { l1:$('#kopBaris1').value.trim(), l2:$('#kopBaris2').value.trim(), l3:$('#kopBaris3').value.trim() };
    setJSON(LS.KOP, kop);
    $('#sidebarSchool').textContent = kop.l1;
    toast('Kop laporan disimpan','success');
  });
  $('#toggleDark').addEventListener('change', (e)=>{
    const dark = e.target.checked;
    document.documentElement.setAttribute('data-theme', dark ? 'dark':'light');
    setJSON(LS.THEME, dark ? 'dark':'light');
  });
  $('#btnExportBackup').addEventListener('click', exportBackup);
  $('#btnImportBackup').addEventListener('click', ()=> $('#fileImportBackup').click());
  $('#fileImportBackup').addEventListener('change', importBackup);
  $('#btnResetApp').addEventListener('click', ()=>{
    if(confirm('Semua data lokal (guru, absensi, pengaturan) akan dihapus. Lanjutkan?')){
      localStorage.clear();
      location.reload();
    }
  });
}

/* =========================================================
   SYNC STATUS
   ========================================================= */
function pendingCount(){ return records.filter(r=>!r.synced).length; }
function updateSyncMini(){
  const online = isOnline();
  const pend = pendingCount();
  $('#syncStatusMini').textContent = online ? (pend>0 ? `🟡 ${pend} data menunggu sinkron` : '🟢 Tersinkron') : '🔴 Offline';
  $('#statPending').textContent = pend;
  $('#pendingCountAbsen').textContent = pend;
}
function updateLastSyncInfo(){
  const t = localStorage.getItem(LS.LAST_SYNC);
  $('#lastSyncInfo').textContent = t ? ('Sinkronisasi terakhir: ' + new Date(t).toLocaleString('id-ID')) : 'Belum pernah sinkron.';
}

async function syncNow(){
  const url = localStorage.getItem(LS.SERVER_URL);
  if(!url){ toast('URL server belum diatur','error'); return; }
  if(!isOnline()){ toast('Tidak ada koneksi internet','error'); return; }

  const pending = records.filter(r=>!r.synced);
  toast('Menyinkronkan data...', '');
  try{
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify({
        action:'sync',
        password_hash: localStorage.getItem(LS.PASS_HASH),
        records: pending,
        teachers: teachers,
        deletedTeachers: getJSON(LS.DELETED_TEACHERS, [])
      })
    });
    const data = await res.json();
    if(!data.ok){ toast(data.message || 'Sinkronisasi gagal','error'); return; }

    // mark synced
    const sentIds = new Set(pending.map(r=>r.id));
    records = records.map(r=> sentIds.has(r.id) ? {...r, synced:true} : r);
    setJSON(LS.RECORDS, records);
    localStorage.removeItem(LS.DELETED_TEACHERS);

    if(Array.isArray(data.teachers)){
      teachers = data.teachers;
      setJSON(LS.TEACHERS, teachers);
    }
    localStorage.setItem(LS.LAST_SYNC, new Date().toISOString());
    updateSyncMini();
    updateLastSyncInfo();
    fillTeacherSelects();
    renderGuruTable();
    renderDashboard();
    toast(`Sinkronisasi berhasil! ${pending.length} data terkirim.`, 'success');
  }catch(err){
    console.error(err);
    toast('Gagal menyinkronkan. Periksa koneksi/URL server.', 'error');
  }
}

/* =========================================================
   GURU (ADMIN)
   ========================================================= */
function fillTeacherSelects(){
  const opts = teachers.map(t=>`<option value="${t.id}">${t.nama}</option>`).join('');
  $('#fGuru').innerHTML = opts || '<option value="">Belum ada data guru</option>';
  $('#lapGuruSelect').innerHTML = opts || '<option value="">Belum ada data guru</option>';
}

function openGuruModal(data){
  $('#formGuru').reset();
  $('#mGuruId').value = '';
  $('#modalGuruTitle').textContent = data ? 'Edit Guru' : 'Tambah Guru';
  if(data){
    $('#mGuruId').value = data.id;
    $('#mNama').value = data.nama;
    $('#mNip').value = data.nip||'';
    $('#mJk').value = data.jk||'Laki-laki';
    $('#mNuptk').value = data.nuptk||'';
  }
  $('#modalGuru').classList.remove('hidden');
}
function closeGuruModal(){ $('#modalGuru').classList.add('hidden'); }

function saveGuru(e){
  e.preventDefault();
  const id = $('#mGuruId').value || uid();
  const obj = {
    id,
    nama: $('#mNama').value.trim(),
    nip: $('#mNip').value.trim(),
    jk: $('#mJk').value,
    nuptk: $('#mNuptk').value.trim()
  };
  const idx = teachers.findIndex(t=>t.id===id);
  if(idx>=0) teachers[idx] = obj; else teachers.push(obj);
  setJSON(LS.TEACHERS, teachers);
  fillTeacherSelects();
  renderGuruTable();
  renderDashboard();
  closeGuruModal();
  toast('Data guru disimpan (sinkronkan untuk mengirim ke server)','success');
}

function deleteGuru(id){
  if(!confirm('Hapus data guru ini?')) return;
  teachers = teachers.filter(t=>t.id!==id);
  setJSON(LS.TEACHERS, teachers);
  const del = getJSON(LS.DELETED_TEACHERS, []);
  del.push(id);
  setJSON(LS.DELETED_TEACHERS, del);
  fillTeacherSelects();
  renderGuruTable();
  toast('Guru dihapus secara lokal. Sinkronkan untuk menerapkan di server.','success');
}

function renderGuruTable(){
  const q = ($('#searchGuru').value||'').toLowerCase();
  const filtered = teachers.filter(t=>
    t.nama.toLowerCase().includes(q) || (t.nip||'').includes(q) || (t.nuptk||'').includes(q)
  );
  if(filtered.length===0){
    $('#guruTableWrap').innerHTML = '<p class="muted">Tidak ada data guru.</p>';
    return;
  }
  let html = `<table><thead><tr><th>Nama</th><th>NIP</th><th>Jenis Kelamin</th><th>NUPTK</th><th>Aksi</th></tr></thead><tbody>`;
  filtered.forEach(t=>{
    html += `<tr>
      <td>${t.nama}</td><td>${t.nip||'-'}</td><td>${t.jk}</td><td>${t.nuptk||'-'}</td>
      <td class="row-actions">
        <button onclick='window.__editGuru("${t.id}")' title="Edit">✏️</button>
        <button onclick='window.__deleteGuru("${t.id}")' title="Hapus">🗑️</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  $('#guruTableWrap').innerHTML = html;
}
window.__editGuru = (id)=> openGuruModal(teachers.find(t=>t.id===id));
window.__deleteGuru = deleteGuru;

/* =========================================================
   ABSENSI
   ========================================================= */
function saveAbsensi(e){
  e.preventDefault();
  const guruId = $('#fGuru').value;
  if(!guruId){ toast('Pilih guru terlebih dahulu','error'); return; }
  const guru = teachers.find(t=>t.id===guruId);
  const ketStatus = $('#fKetStatus').value === 'Lainnya' ? $('#fKetLainnya').value.trim() : $('#fKetStatus').value;

  const rec = {
    id: uid(),
    guruId,
    namaGuru: guru ? guru.nama : '-',
    tanggal: $('#fTanggal').value,
    jenis: $('#fJenis').value,
    status: $('#fStatus').value,
    ketStatus,
    catatan: $('#fCatatan').value.trim(),
    timestamp: new Date().toISOString(),
    synced:false
  };
  records.unshift(rec);
  setJSON(LS.RECORDS, records);
  updateSyncMini();
  renderRecentAbsensi();
  renderDashboard();
  $('#formAbsensi').reset();
  $('#fTanggal').value = todayStr();
  $all('.seg-btn').forEach(b=>b.classList.remove('active'));
  $('.seg-btn[data-val="Datang"]').classList.add('active');
  $('#fJenis').value = 'Datang';
  $all('.status-btn').forEach(b=>b.classList.remove('active'));
  $('.status-btn[data-val="Hadir"]').classList.add('active');
  $('#fStatus').value = 'Hadir';
  $('#fKetLainnya').classList.add('hidden');
  toast('Absensi tersimpan di perangkat ✔️','success');
}

function renderRecentAbsensi(){
  const q = ($('#searchAbsensi').value||'').toLowerCase();
  const list = records.filter(r=> r.namaGuru.toLowerCase().includes(q)).slice(0,50);
  if(list.length===0){
    $('#recentAbsensiList').innerHTML = '<p class="muted">Belum ada data absensi.</p>';
    return;
  }
  let html = `<table><thead><tr><th>Tanggal</th><th>Guru</th><th>Jenis</th><th>Status</th><th>Keterangan</th><th>Sinkron</th></tr></thead><tbody>`;
  list.forEach(r=>{
    html += `<tr>
      <td>${r.tanggal}</td><td>${r.namaGuru}</td><td>${r.jenis}</td>
      <td><span class="pill ${STATUS_COLORS[r.status]}">${r.status}</span></td>
      <td>${r.ketStatus||'-'}${r.catatan? ' — '+r.catatan:''}</td>
      <td>${r.synced ? '✅' : '<span class="pill pill-sync">Pending</span>'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  $('#recentAbsensiList').innerHTML = html;
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard(){
  $('#dateToday').textContent = fmtDate(todayStr());
  $('#statTotalGuru').textContent = teachers.length;
  const today = todayStr();
  const todays = records.filter(r=>r.tanggal===today);
  const hadirIds = new Set(todays.filter(r=>r.status==='Hadir').map(r=>r.guruId));
  $('#statHadirHariIni').textContent = hadirIds.size;
  const tidakHadir = todays.filter(r=>r.status!=='Hadir').length;
  $('#statTidakHadirHariIni').textContent = tidakHadir;
  updateSyncMini();

  if(todays.length===0){
    $('#todayAttendanceList').innerHTML = '<p class="muted">Belum ada absensi hari ini.</p>';
  }else{
    let html = `<table><thead><tr><th>Guru</th><th>Jenis</th><th>Status</th><th>Keterangan</th><th>Waktu</th></tr></thead><tbody>`;
    todays.forEach(r=>{
      html += `<tr><td>${r.namaGuru}</td><td>${r.jenis}</td>
        <td><span class="pill ${STATUS_COLORS[r.status]}">${r.status}</span></td>
        <td>${r.ketStatus||'-'}</td><td>${new Date(r.timestamp).toLocaleTimeString('id-ID')}</td></tr>`;
    });
    html += '</tbody></table>';
    $('#todayAttendanceList').innerHTML = html;
  }

  const sudahAbsenIds = new Set(todays.map(r=>r.guruId));
  const belum = teachers.filter(t=>!sudahAbsenIds.has(t.id));
  $('#belumAbsenList').innerHTML = belum.length
    ? belum.map(t=>`<span class="chip">${t.nama}</span>`).join('')
    : '<p class="muted">Semua guru sudah tercatat hari ini 🎉</p>';
}

/* =========================================================
   LAPORAN — HELPERS
   ========================================================= */
function buildKopHTML(title, sub){
  return `
    <div class="kop">
      <div class="kop-emblem">🏫</div>
      <div class="kop-text">
        <h4>${kop.l1||''}</h4>
        <p>${kop.l2||''}</p>
        <p>${kop.l3||''}</p>
      </div>
    </div>
    <div class="report-title">${title}</div>
    <div class="report-sub">${sub}</div>
  `;
}

function summaryCounts(list){
  const s = {Hadir:0, Sakit:0, Izin:0, Alpa:0};
  list.forEach(r=>{ if(s[r.status]!==undefined) s[r.status]++; });
  return s;
}

function summaryHTML(s){
  return `<div class="report-summary">
    <div class="rs-item" style="background:#16a34a">Hadir<br><b style="font-size:20px">${s.Hadir}</b></div>
    <div class="rs-item" style="background:#f59e0b">Sakit<br><b style="font-size:20px">${s.Sakit}</b></div>
    <div class="rs-item" style="background:#0891b2">Izin<br><b style="font-size:20px">${s.Izin}</b></div>
    <div class="rs-item" style="background:#dc2626">Alpa<br><b style="font-size:20px">${s.Alpa}</b></div>
  </div>`;
}

function reportFooterHTML(){
  const now = new Date();
  return `<div class="report-footer">
    <div>Dicetak: ${now.toLocaleString('id-ID')}</div>
    <div style="text-align:center;">Mengetahui,<br>Kepala Sekolah<br><br><br><br>___________________</div>
  </div>`;
}

function exportButtonsHTML(id){
  return `<div class="report-actions">
    <button class="btn btn-secondary" onclick="window.__exportPNG('${id}')">🖼️ Ekspor PNG</button>
    <button class="btn btn-danger" onclick="window.__exportPDF('${id}')">📄 Ekspor PDF</button>
    <button class="btn btn-outline" onclick="window.print()">🖨️ Cetak</button>
  </div>`;
}

async function exportNodeToPNG(nodeId, filename){
  const node = document.getElementById(nodeId);
  const canvas = await html2canvas(node, {scale:2, backgroundColor:'#ffffff'});
  const link = document.createElement('a');
  link.download = filename + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
async function exportNodeToPDF(nodeId, filename){
  const node = document.getElementById(nodeId);
  const canvas = await html2canvas(node, {scale:2, backgroundColor:'#ffffff'});
  const imgData = canvas.toDataURL('image/png');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p','mm','a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = canvas.height * pageWidth / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData,'PNG',0,position,pageWidth,imgHeight);
  heightLeft -= pdf.internal.pageSize.getHeight();
  while(heightLeft > 0){
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData,'PNG',0,position,pageWidth,imgHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();
  }
  pdf.save(filename + '.pdf');
}
window.__exportPNG = (id)=> exportNodeToPNG(id, id).catch(()=>toast('Gagal ekspor PNG','error'));
window.__exportPDF = (id)=> exportNodeToPDF(id, id).catch(()=>toast('Gagal ekspor PDF','error'));

/* =========================================================
   LAPORAN HARIAN
   ========================================================= */
function renderLapHarian(){
  const tgl = $('#lapHarianTanggal').value || todayStr();
  const list = records.filter(r=>r.tanggal===tgl).sort((a,b)=>a.namaGuru.localeCompare(b.namaGuru));
  const s = summaryCounts(list);
  const rows = list.map((r,i)=>`<tr>
    <td>${i+1}</td><td>${r.namaGuru}</td><td>${r.jenis}</td>
    <td>${r.status}</td><td>${r.ketStatus||'-'}</td><td>${r.catatan||'-'}</td>
  </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;">Tidak ada data</td></tr>`;

  const html = `
  <div class="card report-doc" id="reportHarian">
    ${buildKopHTML('LAPORAN ABSENSI HARIAN GURU', fmtDate(tgl))}
    ${summaryHTML(s)}
    <div style="overflow-x:auto;"><table class="report-table">
      <thead><tr><th>No</th><th>Nama Guru</th><th>Jenis</th><th>Status</th><th>Keterangan</th><th>Catatan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${reportFooterHTML()}
  </div>
  ${exportButtonsHTML('reportHarian')}
  `;
  $('#lapHarianResult').innerHTML = html;
}

/* =========================================================
   LAPORAN RENTANG TANGGAL
   ========================================================= */
function renderLapRentang(){
  const dari = $('#lapRentangDari').value, sampai = $('#lapRentangSampai').value;
  if(!dari || !sampai){ toast('Pilih rentang tanggal','error'); return; }
  const list = records.filter(r=> r.tanggal>=dari && r.tanggal<=sampai)
    .sort((a,b)=> a.tanggal.localeCompare(b.tanggal) || a.namaGuru.localeCompare(b.namaGuru));
  const s = summaryCounts(list);
  const rows = list.map((r,i)=>`<tr>
    <td>${i+1}</td><td>${r.tanggal}</td><td>${r.namaGuru}</td><td>${r.jenis}</td>
    <td>${r.status}</td><td>${r.ketStatus||'-'}</td><td>${r.catatan||'-'}</td>
  </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;">Tidak ada data</td></tr>`;

  const html = `
  <div class="card report-doc" id="reportRentang">
    ${buildKopHTML('LAPORAN ABSENSI GURU', `Periode ${fmtDate(dari)} s/d ${fmtDate(sampai)}`)}
    ${summaryHTML(s)}
    <div style="overflow-x:auto;"><table class="report-table">
      <thead><tr><th>No</th><th>Tanggal</th><th>Nama Guru</th><th>Jenis</th><th>Status</th><th>Keterangan</th><th>Catatan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${reportFooterHTML()}
  </div>
  ${exportButtonsHTML('reportRentang')}
  `;
  $('#lapRentangResult').innerHTML = html;
}

/* =========================================================
   ANALISIS PER GURU
   ========================================================= */
let currentChart = null;
function renderLapGuru(){
  const guruId = $('#lapGuruSelect').value;
  const dari = $('#lapGuruDari').value, sampai = $('#lapGuruSampai').value;
  const guru = teachers.find(t=>t.id===guruId);
  if(!guru){ toast('Pilih guru terlebih dahulu','error'); return; }
  const list = records.filter(r=> r.guruId===guruId && r.tanggal>=dari && r.tanggal<=sampai)
    .sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
  const s = summaryCounts(list);
  const total = list.length || 1;
  const rows = list.map((r,i)=>`<tr>
    <td>${i+1}</td><td>${r.tanggal}</td><td>${r.jenis}</td><td>${r.status}</td><td>${r.ketStatus||'-'}</td><td>${r.catatan||'-'}</td>
  </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;">Tidak ada data</td></tr>`;

  const html = `
  <div class="card report-doc" id="reportGuru">
    ${buildKopHTML('LAPORAN ANALISIS KEHADIRAN GURU', `Periode ${fmtDate(dari)} s/d ${fmtDate(sampai)}`)}
    <p><b>Nama:</b> ${guru.nama} &nbsp; | &nbsp; <b>NIP:</b> ${guru.nip||'-'} &nbsp; | &nbsp; <b>NUPTK:</b> ${guru.nuptk||'-'}</p>
    ${summaryHTML(s)}
    <p style="font-size:13px;">Persentase Kehadiran: <b>${Math.round((s.Hadir/total)*100)}%</b> dari ${total} catatan.</p>
    <div class="chart-box"><canvas id="guruChart" width="380" height="260"></canvas></div>
    <div style="overflow-x:auto;"><table class="report-table">
      <thead><tr><th>No</th><th>Tanggal</th><th>Jenis</th><th>Status</th><th>Keterangan</th><th>Catatan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${reportFooterHTML()}
  </div>
  ${exportButtonsHTML('reportGuru')}
  `;
  $('#lapGuruResult').innerHTML = html;

  if(currentChart) currentChart.destroy();
  const ctx = document.getElementById('guruChart');
  currentChart = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels:['Hadir','Sakit','Izin','Alpa'],
      datasets:[{ data:[s.Hadir,s.Sakit,s.Izin,s.Alpa], backgroundColor:['#16a34a','#f59e0b','#0891b2','#dc2626'] }]
    },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });
}

/* =========================================================
   BACKUP / RESTORE
   ========================================================= */
function exportBackup(){
  const data = {
    teachers, records, kop,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `siabsen-backup-${todayStr()}.json`;
  link.click();
  toast('Cadangan berhasil diunduh','success');
}
function importBackup(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev)=>{
    try{
      const data = JSON.parse(ev.target.result);
      if(data.teachers) { teachers = data.teachers; setJSON(LS.TEACHERS, teachers); }
      if(data.records) { records = data.records; setJSON(LS.RECORDS, records); }
      if(data.kop) { kop = data.kop; setJSON(LS.KOP, kop); }
      fillTeacherSelects(); renderGuruTable(); renderRecentAbsensi(); renderDashboard(); updateSyncMini();
      toast('Cadangan berhasil dipulihkan','success');
    }catch(err){
      toast('File cadangan tidak valid','error');
    }
  };
  reader.readAsText(file);
}

/* ---------- Service worker (offline PWA support) ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
