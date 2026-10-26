// Akun & aplikasi: profil, ganti password, sinkronisasi, alamat server, pembaruan, pemasangan, tema, penyimpanan.
import { h, icon, btn, toast, confirmDialog, dialog, select } from '../ui/dom.js';
import { avatar, pageHead } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import * as db from '../db.js';
import { S, D, me, bump, resetData, katNama } from '../store.js';
import { logout, applyNewPassword } from '../auth.js';
import { callAuthed, discardFailed, retryFailed, syncNow } from '../sync.js';
import { ping } from '../api.js';
import { PWA, applyUpdate, checkUpdate, install, isIOS, getTheme, setTheme } from '../pwa.js';
import { APP_VERSION, DEFAULT_SCRIPT_URL } from '../config.js';
import { fmtNum, relTime } from '../core/util.js';
import { makeDemo } from '../core/demo.js';

export const meta = { title: 'Akun & Aplikasi', live: true };

export async function enterDemo() {
  if (S.outbox.length && !S.demo) { toast('Masih ada data yang belum terkirim ke server. Sinkronkan dulu.'); return; }
  if (!(await confirmDialog('Masuk Mode Demo?', 'Aplikasi diisi data contoh (siswa & pelanggaran rekaan) agar Anda bisa mencoba semua fitur. Data demo tidak dikirim ke mana pun dan bisa dihapus kapan saja.', 'Coba sekarang'))) return;
  await resetData({ demo: makeDemo(new Date().toISOString().slice(0, 10)) });
  toast('Mode Demo aktif. Login dengan akun mana saja, password: demo123');
  go('');
}

async function exitDemo() {
  if (!(await confirmDialog('Keluar dari Mode Demo?', 'Semua data contoh di perangkat ini akan dihapus.', 'Keluar & hapus data demo', 'danger'))) return;
  await db.kvDel('demo');
  await resetData();
  toast('Mode Demo dimatikan.');
  syncNow({ full: true });
  go('');
}

export function render(view) {
  const u = me();
  view.append(pageHead('Akun & Aplikasi', `Versi ${APP_VERSION}${S.demo ? ' · Mode Demo' : ''}`));
  const grid = h('div', { class: 'dash-grid' });
  view.append(grid);

  // ---- profil
  grid.append(h('section', { class: 'card span-6 stack' },
    h('h3', { text: 'Akun' }),
    u ? h('div', { class: 'row gap' }, avatar(u.nama, 'lg'), h('div', { class: 'grow min0' }, h('strong', { class: 'block', text: u.nama }), h('span', { class: 'muted small', text: `@${u.username} · ${u.peran}${u.kelasWali ? ' · Wali ' + u.kelasWali : ''}` })))
      : h('p', { class: 'muted', text: 'Anda belum login. Dasbor, riwayat, dan laporan tetap bisa dilihat; mencatat pelanggaran memerlukan login.' }),
    h('div', { class: 'row gap-sm wrap' },
      u ? btn('Ganti password', () => changePassword(), { ic: 'key', disabled: S.demo }) : btn('Masuk', () => go('login'), { kind: 'primary', ic: 'login' }),
      u ? btn('Keluar', async () => {
        const mineLeft = S.outbox.filter((o) => o.by?.u === u.username).length;
        if (mineLeft && !(await confirmDialog('Keluar?', `${mineLeft} perubahan Anda belum terkirim. Perubahan tetap tersimpan di HP dan akan dikirim saat online.`, 'Keluar'))) return;
        await logout(); toast('Anda telah keluar.');
      }, { ic: 'logout' }) : null)));

  // ---- sinkronisasi
  const failed = D().failed;
  grid.append(h('section', { class: 'card span-6 stack' },
    h('h3', { text: 'Sinkronisasi data' }),
    S.demo ? h('p', { class: 'muted', text: 'Mode Demo — data hanya ada di perangkat ini dan tidak disinkronkan.' }) : h('div', { class: 'kv-list' },
      kv('Koneksi', S.online ? 'Online' : 'Offline (data tetap tersimpan di HP)'),
      kv('Terakhir tersinkron', S.sync.lastOk ? `${relTime(S.sync.lastOk)} (${new Date(S.sync.lastOk).toLocaleString('id-ID')})` : 'belum pernah'),
      kv('Menunggu dikirim', `${fmtNum(S.outbox.filter((o) => !o.failed).length)} perubahan`),
      kv('Data di HP', `${fmtNum(S.d.siswa.length)} siswa · ${fmtNum(S.d.pelanggaran.length)} catatan · ${fmtNum(S.d.users.length)} akun`),
      S.meta.server ? kv('Versi server', S.meta.server) : null),
    S.sync.authError ? h('div', { class: 'notice warn sm' }, icon('key'), h('p', { class: 'small', text: S.sync.authError })) : null,
    S.sync.error ? h('div', { class: 'notice critical sm' }, icon('alert'), h('p', { class: 'small', text: S.sync.error })) : null,
    failed.length ? h('div', { class: 'stack-sm' }, h('strong', { class: 'small', text: `${failed.length} perubahan ditolak server:` }),
      ...failed.map((o) => h('div', { class: 'failed-op' }, h('div', { class: 'grow min0' }, h('div', { class: 'small', text: describeOp(o) }), h('div', { class: 'error-text small', text: o.err })),
        btn('Buang', async () => { if (await confirmDialog('Buang perubahan ini?', 'Data akan dikembalikan sesuai server.', 'Buang', 'danger')) await discardFailed(o.opId); }, { kind: 'text', small: true }))),
      btn('Coba kirim ulang semua', () => retryFailed(), { small: true, ic: 'sync' })) : null,
    !S.demo ? h('div', { class: 'row gap-sm wrap' },
      btn(S.sync.running ? 'Menyinkronkan…' : 'Sinkron sekarang', async () => { await syncNow(); toast(S.sync.error ? 'Gagal: ' + S.sync.error : S.sync.msg); }, { kind: 'primary', ic: 'sync', disabled: S.sync.running || !S.serverUrl }),
      btn('Unduh ulang semua data', async () => { await syncNow({ full: true }); toast(S.sync.error ? 'Gagal: ' + S.sync.error : 'Semua data diunduh ulang.'); }, { ic: 'download', disabled: S.sync.running || !S.serverUrl })) : null));

  // ---- server
  const urlIn = h('input', { type: 'url', value: S.serverUrl, placeholder: 'https://script.google.com/macros/s/…/exec', 'aria-label': 'Alamat server', disabled: S.demo });
  grid.append(h('section', { class: 'card span-6 stack' },
    h('h3', { text: 'Server (Google Apps Script)' }),
    S.demo ? h('div', { class: 'notice info sm' }, icon('info'), h('p', { class: 'small', text: 'Sedang di Mode Demo. Keluar dari Mode Demo untuk memakai server sekolah.' })) : null,
    h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Alamat Web App (berakhiran /exec)' }), urlIn,
      h('span', { class: 'hint', text: DEFAULT_SCRIPT_URL ? 'Bawaan aplikasi sudah diisi Admin. Ubah hanya bila diminta.' : 'Admin dapat mengisi alamat ini sekali di js/config.js agar semua HP otomatis tersambung.' })),
    h('div', { class: 'row gap-sm wrap' },
      S.demo ? btn('Keluar dari Mode Demo', () => exitDemo(), { kind: 'danger-tonal', ic: 'logout' }) : btn('Uji & simpan', async (e) => {
        const url = urlIn.value.trim();
        if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return toast('Alamat harus URL Web App Apps Script yang berakhiran /exec.');
        const b = e.currentTarget;
        b.disabled = true;
        try {
          const r = await ping(url);
          if (url !== S.serverUrl && (S.d.siswa.length || S.d.pelanggaran.length)) {
            if (S.outbox.length) { toast('Masih ada perubahan yang belum terkirim ke server lama.'); return; }
            if (!(await confirmDialog('Ganti server?', 'Data di HP ini akan diganti dengan data dari server baru.', 'Ganti'))) return;
            S.serverUrl = url; await db.kvSet('serverUrl', url); await resetData();
          }
          S.serverUrl = url; await db.kvSet('serverUrl', url);
          toast(`Tersambung ke server v${r.server}. Mengunduh data…`);
          await syncNow({ full: true });
          bump();
        } catch (err) { toast(err.message); } finally { b.disabled = false; }
      }, { kind: 'primary', ic: 'check' }),
      !S.serverUrl && !S.demo ? btn('Coba Mode Demo', () => enterDemo(), { ic: 'spark' }) : null)));

  // ---- aplikasi
  const theme = getTheme();
  const storage = h('span', { class: 'muted small', text: 'menghitung…' });
  db.storageInfo().then((s) => { storage.textContent = `${(s.usage / 1048576).toFixed(1)} MB dipakai${s.persisted ? ' · penyimpanan permanen aktif' : ''}`; });
  grid.append(h('section', { class: 'card span-6 stack' },
    h('h3', { text: 'Aplikasi' }),
    h('div', { class: 'kv-list' }, kv('Versi terpasang', APP_VERSION), PWA.remoteVersion ? kv('Versi terbaru', PWA.remoteVersion) : null, kv('Penyimpanan', storage)),
    PWA.waiting ? h('div', { class: 'notice info' }, icon('download'), h('div', { class: 'grow' }, h('strong', { text: 'Versi baru siap dipasang' })), btn('Perbarui sekarang', () => applyUpdate(), { kind: 'primary', small: true })) : null,
    h('div', { class: 'row gap-sm wrap' },
      btn(PWA.checking ? 'Memeriksa…' : 'Periksa pembaruan', async () => toast(await checkUpdate(true)), { ic: 'sync', disabled: PWA.checking }),
      PWA.installEvt ? btn('Pasang aplikasi', () => install(), { ic: 'install', kind: 'primary' }) : null,
      !PWA.installEvt && !PWA.installed && isIOS() ? btn('Cara pasang di iPhone', () => dialog('Pasang di iPhone/iPad', 'Buka aplikasi ini di Safari → ketuk tombol Bagikan (kotak dengan panah ke atas) → pilih "Tambah ke Layar Utama" → Tambah.'), { ic: 'install' }) : null),
    h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Tema tampilan' }), select([{ value: 'auto', label: 'Otomatis (ikuti HP)' }, { value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }], theme, (v) => setTheme(v))),
    btn('Hapus semua data di perangkat ini', async () => {
      if (S.outbox.length && !S.demo) return dialog('Tidak bisa dihapus', `Masih ada ${S.outbox.length} perubahan yang belum terkirim ke server. Sinkronkan dulu agar tidak hilang.`);
      if (!(await confirmDialog('Hapus data di perangkat?', 'Data di HP ini dihapus (data di server tetap aman) lalu diunduh ulang saat online.', 'Hapus', 'danger'))) return;
      await db.kvDel('demo');
      await resetData();
      syncNow({ full: true });
      toast('Data perangkat dihapus.');
    }, { kind: 'danger-tonal', ic: 'trash', small: true })));

  grid.append(h('section', { class: 'card span-12 stack' },
    h('h3', { text: 'Tentang aplikasi' }),
    h('p', { class: 'muted', text: `Aplikasi Buku Kedisiplinan Siswa ${S.settings.namaSekolah}: mencatat pelanggaran tata tertib, menghitung akumulasi poin & tahap sanksi otomatis, menyiapkan BAP dan surat peringatan, serta menyajikan laporan. Berjalan offline; data tersimpan di HP dan disinkronkan ke Google Sheets sekolah.` })));
}

const kv = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted', text: k }), typeof v === 'string' ? h('span', { text: v }) : v);

function describeOp(o) {
  const r = o.row || {};
  if (o.table === 'pelanggaran') return `Catatan: ${r.nama || ''} (${r.kelas || ''}) – ${r.jenisKode}. ${String(r.uraian || '').slice(0, 50)}`;
  if (o.table === 'siswa') return `Data siswa: ${r.nama || o.key}`;
  if (o.table === 'jenis') return `${o.op === 'delete' ? 'Hapus' : 'Ubah'} jenis pelanggaran ${o.key}`;
  if (o.table === 'kategori') return `${o.op === 'delete' ? 'Hapus' : 'Ubah'} kategori ${katNama(o.key)}`;
  if (o.table === 'tindak') return `Tindak lanjut: ${r.nama || ''} – ${r.tahapLabel || ''}`;
  return `${o.table}: ${o.key}`;
}

async function changePassword() {
  const f = { a: '', b: '' };
  const v = await dialog('Ganti password', h('div', { class: 'stack-sm' },
    h('p', { class: 'muted small', text: 'Perlu internet. Password baru minimal 6 karakter dan berlaku di semua HP.' }),
    h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Password baru' }), h('input', { type: 'password', autocomplete: 'new-password', oninput: (e) => { f.a = e.target.value; } })),
    h('label', { class: 'field' }, h('span', { class: 'lbl', text: 'Ulangi password baru' }), h('input', { type: 'password', autocomplete: 'new-password', oninput: (e) => { f.b = e.target.value; } }))),
  [{ label: 'Batal', value: null }, { label: 'Simpan', value: 'ok', kind: 'primary' }]);
  if (v !== 'ok') return;
  if (f.a.length < 6) return toast('Password minimal 6 karakter.');
  if (f.a !== f.b) return toast('Ulangan password tidak sama.');
  try {
    await syncNow(); // kirim antrean dengan token lama dulu
    await callAuthed('password', { newPassword: f.a });
    await applyNewPassword(f.a);
    toast('Password berhasil diganti.');
  } catch (e) { toast(e.message); }
}
