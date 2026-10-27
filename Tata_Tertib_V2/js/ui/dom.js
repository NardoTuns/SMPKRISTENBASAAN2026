// Pembuat elemen DOM ringan. Teks selalu lewat textContent (aman dari injeksi HTML);
// innerHTML hanya dipakai untuk ikon SVG statis di bawah.

// append()/replaceChildren() bawaan browser mengubah null menjadi teks "null". Di aplikasi ini anak bernilai
// null/false berarti "tidak ditampilkan" (sama seperti di h()), jadi nilai kosong dilewati & larik diratakan.
for (const proto of [Element.prototype, DocumentFragment.prototype]) {
  for (const name of ['append', 'prepend', 'replaceChildren']) {
    const native = proto[name];
    proto[name] = function (...kids) { return native.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false)); };
  }
}

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'indeterminate') e[k] = v;
      else e.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(e, kids);
  return e;
}

function append(e, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clear = (e) => { while (e.firstChild) e.removeChild(e.firstChild); return e; };

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  school: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M12 10.5v.01"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  report: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6M9 9h1"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  checklist: '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5z"/><path d="m9.5 13.5 2 2 3.5-3.5"/>',
  cloudoff: '<path d="M7 18a4.5 4.5 0 0 1-.6-9M10 5.3A6 6 0 0 1 18 9.5a4 4 0 0 1 2.2 7.2M17 18H7M3 3l18 18"/>',
  cloudup: '<path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5"/><path d="M12 20v-7M9 15.5 12 12.5l3 3"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  printer: '<path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  alert: '<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"/>',
  wa: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8.4 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18h2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  gavel: '<path d="m14 13-7.5 7.5a2.1 2.1 0 0 1-3-3L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 21H12"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
};

export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
  s.innerHTML = ICONS[name] || '';
  return s;
}

export const iconBtn = (name, label, onclick, extra = {}) => h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick, ...extra }, icon(name));
export const btn = (label, onclick, { kind = 'tonal', ic, small, type = 'button', ...rest } = {}) =>
  h('button', { class: `btn ${kind}${small ? ' small' : ''}`, type, onclick, ...rest }, ic ? icon(ic) : null, label ? h('span', { text: label }) : null);

// ------------------------------------------------------------------ toast
let toastTimer;
export function toast(msg, { action, onAction, ms = 3200, kind = '' } = {}) {
  let wrap = $('.toast-wrap');
  if (!wrap) { wrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' }); document.body.append(wrap); }
  clear(wrap);
  const t = h('div', { class: 'toast ' + kind }, h('span', { class: 'grow', text: msg }),
    action ? h('button', { type: 'button', onclick: () => { clear(wrap); onAction?.(); }, text: action }) : null);
  wrap.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (t.parentNode) t.remove(); }, action ? Math.max(ms, 6000) : ms);
}

// ------------------------------------------------------------------ lapisan (lembar/dialog)
// Tombol "Kembali" HP menutup lapisan teratas, bukan meninggalkan halaman.
const openStack = [];
let ignorePop = 0;
let backWaiters = [];
function trapBack(close) {
  openStack.push(close);
  history.pushState({ overlay: openStack.length }, '');
}
function release(close) {
  const i = openStack.indexOf(close);
  if (i >= 0) { openStack.splice(i, 1); ignorePop++; history.back(); }
}
function backDone() { backWaiters.splice(0).forEach((r) => r()); }
window.addEventListener('popstate', (e) => {
  if (ignorePop > 0) { ignorePop--; e.stopImmediatePropagation(); if (!ignorePop) backDone(); return; }
  const close = openStack.pop();
  if (close) { e.stopImmediatePropagation(); close(true); }
});
/** Tunggu history.back() milik lapisan yang baru ditutup selesai, agar navigasi berikutnya tidak tertimpa. */
export function afterBack() {
  if (!ignorePop) return Promise.resolve();
  return new Promise((r) => { backWaiters.push(r); setTimeout(() => { ignorePop = 0; backDone(); }, 500); });
}
export const overlayOpen = () => openStack.length > 0;
/** Tutup semua lapisan saat pindah halaman (entri riwayat dibiarkan; tombol Kembali tetap wajar). */
export function closeAllOverlays() { while (openStack.length) openStack.pop()(true); }

/** Lembar (bottom sheet di HP, panel tengah di layar lebar). build(body, close). Mengembalikan close. */
export function sheet(build, { onClose, wide = false, title } = {}) {
  const body = h('div', { class: 'sheet' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Panel' });
  const scrim = h('div', { class: 'scrim' }, body);
  let closed = false;
  const close = (fromPop = false) => {
    if (closed) return;
    closed = true;
    scrim.classList.add('closing');
    setTimeout(() => scrim.remove(), 160);
    if (fromPop !== true) release(close);
    if (!openStack.length) document.body.classList.remove('no-scroll');
    onClose?.();
  };
  if (title) body.append(h('div', { class: 'sheet-head' }, h('h2', { text: title }), iconBtn('x', 'Tutup', () => close())));
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  scrim.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.body.append(scrim);
  document.body.classList.add('no-scroll');
  trapBack(close);
  build(body, close);
  setTimeout(() => (body.querySelector('[autofocus]') || body).focus?.(), 50);
  body.tabIndex = -1;
  return close;
}

/** Dialog. buttons: [{label, value, kind}] → Promise<value|null> */
export function dialog(title, content, buttons = [{ label: 'Tutup', value: null }]) {
  return new Promise((resolve) => {
    const box = h('div', { class: 'dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog', tabindex: '-1' });
    const scrim = h('div', { class: 'scrim middle' }, box);
    let done = false;
    const finish = (v, fromPop = false) => {
      if (done) return;
      done = true;
      scrim.remove();
      if (!fromPop) release(onPop);
      if (!openStack.length) document.body.classList.remove('no-scroll');
      resolve(v);
    };
    const onPop = () => finish(null, true);
    box.append(
      title ? h('h3', { text: title }) : null,
      typeof content === 'function' ? content(finish) : typeof content === 'string'
        ? h('div', { class: 'stack-sm' }, ...content.split('\n\n').map((p) => h('p', { class: 'pre', text: p }))) : content,
      buttons.length ? h('div', { class: 'actions' }, ...buttons.map((b) => h('button', {
        class: 'btn ' + (b.kind || 'text'), type: 'button', text: b.label, onclick: () => finish(b.value),
      }))) : null,
    );
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) finish(null); });
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(null); });
    document.body.append(scrim);
    document.body.classList.add('no-scroll');
    trapBack(onPop);
    setTimeout(() => (box.querySelector('input, textarea, select') || box.querySelector('.actions .btn:last-child') || box).focus(), 60);
  });
}

export const confirmDialog = (title, text, okLabel = 'Ya', kind = 'primary') =>
  dialog(title, text, [{ label: 'Batal', value: false }, { label: okLabel, value: true, kind }]).then((v) => v === true);

/** Dialog isian satu teks → string | null */
export function prompt(title, { label = '', value = '', type = 'text', placeholder = '', note = '', okLabel = 'Simpan', multiline = false, required = false } = {}) {
  let input;
  return dialog(title, (finish) => {
    input = multiline ? h('textarea', { rows: 4, placeholder }, value) : h('input', { type, value, placeholder, autocomplete: 'off' });
    if (multiline) input.value = value;
    if (!multiline) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish('__ok'); });
    return h('div', { class: 'stack-sm' }, note ? h('p', { class: 'muted small', text: note }) : null,
      h('label', { class: 'field' }, label ? h('span', { class: 'lbl', text: label }) : null, input));
  }, [{ label: 'Batal', value: null }, { label: okLabel, value: '__ok', kind: 'primary' }]).then((v) => {
    if (v !== '__ok') return null;
    if (required && !input.value.trim()) { toast(label ? `${label} wajib diisi.` : 'Isian wajib diisi.'); return null; }
    return input.value;
  });
}

export function pickFile({ accept = '*/*' } = {}) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

export function downloadBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name, style: { display: 'none' } });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
export const downloadText = (text, name, type = 'text/csv;charset=utf-8') => downloadBlob(new Blob([text], { type }), name);

/** Pilihan <select> dari [{value,label}] atau ['a','b']. */
export function select(options, value, onchange, attrs = {}) {
  const s = h('select', { onchange: (e) => onchange?.(e.target.value), ...attrs },
    ...options.map((o) => (typeof o === 'object' ? h('option', { value: o.value, text: o.label, selected: String(o.value) === String(value) }) : h('option', { value: o, text: o, selected: String(o) === String(value) }))));
  s.value = value ?? '';
  return s;
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'lbl', text: label }), control, hint ? h('span', { class: 'hint', text: hint }) : null);
}
