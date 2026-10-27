// Login guru: pilih nama dari daftar → ketik password. Berjalan offline (hash password tersimpan di HP).
import { h, icon, btn } from '../ui/dom.js';
import { avatar, emptyState } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { S, me } from '../store.js';
import { login, logout, loginLockedFor } from '../auth.js';
import { syncNow } from '../sync.js';
import { ROLES } from '../core/rules.js';
import { cmpNama, debounce, matches } from '../core/util.js';
import { DEMO_PASSWORD } from '../core/demo.js';
import { enterDemo } from './akun.js';

// Tampilan diperbarui saat data berubah, kecuali ketika guru sedang mengetik password.
export const meta = { title: 'Masuk', live: () => !picked };
let picked = '';
let q = '';

export function render(view, route) {
  const next = route.query.next || '';
  const box = h('div', { class: 'login-wrap' });
  view.append(box);
  const u = me();
  if (u) {
    box.append(h('section', { class: 'card login-card center' }, avatar(u.nama, 'lg'), h('h2', { text: u.nama }), h('p', { class: 'muted', text: `${u.peran}${u.kelasWali ? ' · Wali kelas ' + u.kelasWali : ''}` }),
      h('div', { class: 'row gap-sm center wrap' }, btn('Catat pelanggaran', () => go('catat'), { kind: 'primary', ic: 'plus' }), btn('Keluar', async () => { await logout(); }, { ic: 'logout' }))));
    return;
  }
  const users = S.d.users.filter((x) => x.aktif !== false);
  box.append(h('div', { class: 'login-hero' }, h('div', { class: 'login-logo' }, S.settings.logo ? h('img', { src: S.settings.logo, alt: '' }) : icon('shield')),
    h('h1', { text: 'Masuk Guru' }), h('p', { class: 'muted', text: `${S.settings.namaSekolah} · pilih nama Anda lalu masukkan password` })));

  if (!users.length) {
    if (!S.serverUrl && !S.demo) { box.append(emptyState('database', 'Server belum diatur', 'Daftar guru diunduh dari Google Sheets. Atur alamat server atau coba Mode Demo.', h('div', { class: 'row gap-sm center wrap' }, btn('Coba Mode Demo', () => enterDemo(), { kind: 'primary', ic: 'spark' }), btn('Atur server', () => go('akun'), { ic: 'settings' })))); return; }
    box.append(emptyState('cloudoff', 'Daftar guru belum diunduh', S.online ? 'Ketuk tombol di bawah untuk mengunduh daftar akun dari server.' : 'Sambungkan HP ke internet sekali untuk mengunduh daftar akun. Setelah itu login bisa dilakukan tanpa internet.',
      btn(S.sync.running ? 'Mengunduh…' : 'Unduh sekarang', () => syncNow({ full: true }), { kind: 'primary', ic: 'sync', disabled: S.sync.running || !S.online })));
    if (S.sync.error) box.append(h('p', { class: 'center small error-text', text: S.sync.error }));
    return;
  }

  if (picked && !users.some((x) => x.username === picked)) picked = '';
  if (picked) {
    const u2 = users.find((x) => x.username === picked);
    const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Password', 'aria-label': 'Password', autofocus: true, enterkeyhint: 'go' });
    const err = h('p', { class: 'error-text small', role: 'alert' });
    const eye = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tampilkan password', onclick: () => { pw.type = pw.type === 'password' ? 'text' : 'password'; eye.replaceChildren(icon(pw.type === 'password' ? 'eye' : 'eyeoff')); } }, icon('eye'));
    const submit = h('button', { class: 'btn primary block', type: 'submit' }, icon('login'), h('span', { text: 'Masuk' }));
    const form = h('form', { class: 'card login-card', onsubmit: async (e) => {
      e.preventDefault();
      if (!pw.value) { err.textContent = 'Masukkan password.'; return; }
      submit.disabled = true; submit.lastChild.textContent = 'Memeriksa…';
      try {
        await login(picked, pw.value);
        picked = '';
        go(next ? '#/' + next : '#/');
      } catch (ex) {
        err.textContent = ex.message; pw.select();
        submit.disabled = false; submit.lastChild.textContent = 'Masuk';
        if (loginLockedFor()) setTimeout(() => { err.textContent = ''; }, loginLockedFor());
      }
    } },
      h('button', { class: 'btn text small back', type: 'button', onclick: () => { picked = ''; view.replaceChildren(); render(view, route); } }, icon('left'), h('span', { text: 'Ganti nama' })),
      h('div', { class: 'center stack-sm' }, avatar(u2.nama, 'lg'), h('h2', { text: u2.nama }), h('p', { class: 'muted', text: `${u2.peran}${u2.kelasWali ? ' · ' + u2.kelasWali : ''} · @${u2.username}` })),
      h('div', { class: 'pw-field' }, pw, eye), err, submit,
      S.demo ? h('p', { class: 'muted small center', text: `Mode Demo — password semua akun: ${DEMO_PASSWORD}` }) : h('p', { class: 'muted small center', text: 'Lupa password? Hubungi Admin sekolah.' }));
    box.append(form);
    setTimeout(() => pw.focus(), 80);
    return;
  }

  const listWrap = h('div');
  box.append(h('section', { class: 'card login-card' },
    users.length > 8 ? h('label', { class: 'fsel search block' }, icon('search'), h('input', { type: 'search', placeholder: 'Cari nama…', value: q, 'aria-label': 'Cari nama guru', oninput: debounce((e) => { q = e.target.value; draw(); }, 120) })) : null,
    listWrap,
    S.demo ? h('p', { class: 'muted small center', text: `Mode Demo — password semua akun: ${DEMO_PASSWORD}` }) : null));
  box.append(h('a', { class: 'btn tonal block', href: 'DashboardSiswa.html' }, icon('users'), h('span', { text: 'Siswa / orang tua? Buka Halaman Siswa & Orang Tua' })));
  function draw() {
    const groups = ROLES.map((r) => ({ r, list: users.filter((x) => x.peran === r && (!q || matches(q, x.nama, x.username, x.kelasWali))).sort((a, b) => cmpNama(a.nama, b.nama)) })).filter((g) => g.list.length);
    listWrap.replaceChildren(...groups.map((g) => h('div', { class: 'user-group' }, h('p', { class: 'muted small group-label', text: g.r }),
      h('div', { class: 'user-grid' }, ...g.list.map((x) => h('button', { class: 'user-pick', type: 'button', onclick: () => { picked = x.username; view.replaceChildren(); render(view, route); } },
        avatar(x.nama), h('span', { class: 'grow min0' }, h('span', { class: 'ellipsis block', text: x.nama }), h('span', { class: 'muted small', text: x.kelasWali ? `Wali ${x.kelasWali}` : `@${x.username}` })), icon('right')))))));
    if (!groups.length) listWrap.append(h('p', { class: 'muted center', text: 'Nama tidak ditemukan.' }));
  }
  draw();
}
