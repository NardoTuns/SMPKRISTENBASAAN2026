// Dokumen → Cetak / PDF / PNG / kirim ke WhatsApp. Dokumen (BAP, surat, laporan) dipotong menjadi halaman A4
// di kertas tak terlihat, dirasterisasi dengan html2canvas, lalu dirakit jsPDF. Kedua pustaka dimuat saat
// dibutuhkan saja dan ikut tersimpan offline oleh service worker.
import { h, icon, btn, iconBtn, sheet, toast, dialog, downloadBlob } from './dom.js';
import { signHtml, readSign } from './sign.js';
import { paperSize, paperCode, PAPER_OPTIONS } from './paper.js';
import { makeDocx } from './docx.js';

const scripts = new Map();

function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => { scripts.delete(src); rej(new Error('Pustaka PDF/PNG belum tersedia. Buka aplikasi sekali saat online, lalu coba lagi.')); };
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}
async function libs() {
  await Promise.all([loadScript('vendor/html2canvas.min.js'), loadScript('vendor/jspdf.umd.min.js')]);
  return { html2canvas: window.html2canvas, jsPDF: window.jspdf.jsPDF };
}

const cleanHtml = (html) => String(html).replace(/<style[\s\S]*?<\/style>/gi, '');
const safeName = (s) => String(s || 'dokumen').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 80);

// ------------------------------------------------------------------ pemotongan halaman
/** Susun isi .doc ke halaman-halaman .paper. Tabel panjang dipecah per baris (judul kolom diulang). */
function paginate(html, landscape, paper) {
  const [pw, ph] = paperSize(paper, landscape).px;
  const stage = h('div', { class: 'paper-stage' });
  document.body.append(stage);
  const src = h('div');
  src.innerHTML = cleanHtml(html);
  const pages = [];
  let page, holder, docClass = 'doc';
  const newPage = () => {
    page = h('div', { class: 'paper docs', style: { width: pw + 'px', height: ph + 'px' } });
    holder = h('div', { class: docClass }); // kelas dokumen (mis. "doc rpt" = laporan berwarna) ikut ke setiap halaman
    page.append(holder);
    stage.append(page);
    pages.push(page);
  };
  const fits = () => page.scrollHeight <= page.clientHeight + 1;
  // Judul bagian (h3) dan "tempat, tanggal" ikut pindah bersama elemen sesudahnya.
  const takeTrailing = () => {
    const out = [];
    for (let last = holder.lastElementChild; last && (last.tagName === 'H3' || last.matches('p.right')) && holder.children.length > 1; last = holder.lastElementChild) {
      out.unshift(last);
      holder.removeChild(last);
    }
    return out;
  };
  const cloneTable = (t) => { const c = t.cloneNode(false); if (t.tHead) c.append(t.tHead.cloneNode(true)); c.append(document.createElement('tbody')); return c; };

  for (const doc of src.querySelectorAll(':scope > .doc')) {
    docClass = doc.className.replace(/\bpage-break\b/, '').trim() || 'doc';
    newPage();
    for (const el of [...doc.children]) {
      holder.append(el);
      if (fits()) continue;
      holder.removeChild(el);
      const rows = el.matches('table.tbl-print') && el.tBodies[0] ? [...el.tBodies[0].rows] : null;
      if (rows && rows.length > 1) {
        let part = cloneTable(el);
        holder.append(part);
        for (const row of rows) {
          part.tBodies[0].append(row);
          if (fits()) continue;
          part.tBodies[0].removeChild(row);
          const carry = part.tBodies[0].rows.length ? [] : (holder.removeChild(part), takeTrailing());
          newPage();
          holder.append(...carry);
          part = cloneTable(el);
          holder.append(part);
          part.tBodies[0].append(row);
        }
        continue;
      }
      // Blok tanda tangan dipecah per baris; baris pertama tetap bersama "tempat, tanggal".
      const srows = el.matches('.sign-block') ? [...el.children] : null;
      if (srows && srows.length > 1) {
        let part = el.cloneNode(false);
        holder.append(part);
        for (const row of srows) {
          part.append(row);
          if (fits()) continue;
          part.removeChild(row);
          const carry = part.children.length ? [] : (holder.removeChild(part), takeTrailing());
          newPage();
          holder.append(...carry);
          part = el.cloneNode(false);
          holder.append(part);
          part.append(row);
        }
        continue;
      }
      const carry = takeTrailing();
      newPage();
      holder.append(...carry, el); // elemen lebih tinggi dari satu halaman tetap ditaruh (terpotong di bawah)
    }
  }
  return { stage, pages };
}

async function rasterize(html, { landscape = false, paper, scale = 2 } = {}) {
  const { html2canvas } = await libs();
  const { stage, pages } = paginate(html, landscape, paper);
  try {
    await Promise.all([...stage.querySelectorAll('img')].map((img) => img.decode?.().catch(() => {})));
    const out = [];
    for (const p of pages) {
      pages.forEach((x) => { x.style.display = x === p ? '' : 'none'; });
      out.push(await html2canvas(p, { scale, backgroundColor: '#ffffff', logging: false, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: p.offsetWidth, windowHeight: p.offsetHeight }));
    }
    return out;
  } finally {
    stage.remove();
  }
}

export async function makePdf(title, html, { landscape = false, paper } = {}) {
  const canvases = await rasterize(html, { landscape, paper, scale: 2 });
  const { jsPDF } = await libs();
  const orient = landscape ? 'landscape' : 'portrait';
  const { mm: [w, hgt] } = paperSize(paper, landscape);
  const fmt = [Math.min(w, hgt), Math.max(w, hgt)];
  const pdf = new jsPDF({ orientation: orient, unit: 'mm', format: fmt, compress: true });
  canvases.forEach((c, i) => {
    if (i) pdf.addPage(fmt, orient);
    pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, hgt, undefined, 'FAST');
  });
  pdf.setProperties({ title, creator: 'Aplikasi Tata Tertib' });
  return { blob: pdf.output('blob'), pages: canvases.length };
}

/** Satu PNG; dokumen beberapa halaman disusun ke bawah (skala disesuaikan agar tetap aman di HP). */
export async function makePng(title, html, { landscape = false, paper } = {}) {
  const [, pageH] = paperSize(paper, landscape).px;
  const n = countPages(html, landscape, paper);
  const scale = Math.max(1, Math.min(2, 15000 / (n * pageH)));
  const canvases = await rasterize(html, { landscape, paper, scale });
  let canvas = canvases[0];
  if (canvases.length > 1) {
    const gap = Math.round(16 * scale);
    canvas = document.createElement('canvas');
    canvas.width = Math.max(...canvases.map((c) => c.width));
    canvas.height = canvases.reduce((t, c) => t + c.height, 0) + gap * (canvases.length - 1);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d5dbe4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let y = 0;
    for (const c of canvases) { ctx.drawImage(c, 0, y); y += c.height + gap; }
  }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  return { blob, pages: canvases.length };
}

/** Jumlah halaman hasil pemotongan untuk ukuran kertas tertentu. */
export function countPages(html, landscape = false, paper) {
  const probe = paginate(html, landscape, paper);
  const n = probe.pages.length;
  probe.stage.remove();
  return n;
}

// ------------------------------------------------------------------ cetak, unduh, bagikan
export async function printNow(title, html, { landscape = false, paper } = {}) {
  html = withSignPrefs(html);
  const root = document.getElementById('print-root');
  const { mm: [w, hgt] } = paperSize(paper, landscape);
  root.innerHTML = `<style>@page { size: ${w}mm ${hgt}mm; margin: 12mm 15mm; }</style>${cleanHtml(html)}`;
  await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode?.().catch(() => {})));
  const old = document.title;
  document.title = title;
  const restore = () => { document.title = old; window.removeEventListener('afterprint', restore); };
  window.addEventListener('afterprint', restore);
  setTimeout(() => window.print(), 60);
}

let busy = null;
function busyOverlay(text) {
  busy?.remove();
  busy = h('div', { class: 'scrim middle busy', role: 'status', 'aria-live': 'polite' }, h('div', { class: 'dialog center' }, icon('spark', 'spin'), h('p', { text })));
  document.body.append(busy);
}
function busyDone() { busy?.remove(); busy = null; }

/**
 * action: 'pdf' | 'png' | 'docx' | 'wa-pdf' | 'wa-png' | 'print'.
 * opts: {landscape, fileBase, waNumber (62…), waText, waTo (nama penerima)}
 */
export async function runExport(action, title, html, opts = {}) {
  html = withSignPrefs(html);
  if (action === 'print') return printNow(title, html, opts);
  const kind = action.endsWith('png') ? 'png' : action.endsWith('docx') ? 'docx' : 'pdf';
  busyOverlay({ pdf: 'Menyiapkan PDF…', png: 'Menyiapkan gambar PNG…', docx: 'Menyiapkan dokumen Word…' }[kind]);
  let res;
  try {
    res = kind === 'pdf' ? await makePdf(title, html, opts) : kind === 'docx' ? await makeDocx(title, html, opts) : await makePng(title, html, opts);
  } catch (e) {
    busyDone();
    toast(e.message || 'Gagal membuat file.');
    return null;
  }
  busyDone();
  const name = `${safeName(opts.fileBase || title)}.${kind}`;
  window.__lastExport = { name, type: res.blob.type, size: res.blob.size, blob: res.blob, pages: res.pages };
  if (!action.startsWith('wa')) {
    downloadBlob(res.blob, name);
    toast(kind === 'docx' ? `Word tersimpan: ${name} — buka di Microsoft Word/WPS untuk diedit` : `${kind.toUpperCase()} tersimpan: ${name}${res.pages > 1 ? ` (${res.pages} halaman)` : ''}`);
    return name;
  }
  return shareToWhatsApp(res.blob, name, title, opts);
}

async function shareToWhatsApp(blob, name, title, opts) {
  const text = opts.waText || title;
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return name;
    } catch (e) {
      if (e.name === 'AbortError') return null;
    }
  }
  // Komputer / browser tanpa berbagi file: unduh dulu, lalu buka WhatsApp untuk dilampiri manual.
  downloadBlob(blob, name);
  const wa = `https://wa.me/${opts.waNumber || ''}?text=${encodeURIComponent(text)}`;
  dialog('Kirim lewat WhatsApp', h('div', { class: 'stack-sm' },
    h('p', { text: `File ${name} sudah diunduh. Buka WhatsApp${opts.waTo ? ` (ke ${opts.waTo})` : ''}, lalu lampirkan file tersebut (ikon klip 📎).` }),
    h('a', { class: 'btn wa', href: wa, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'Buka WhatsApp' }))),
  [{ label: 'Tutup', value: null }]);
  return name;
}

/** Pilih format untuk WhatsApp. */
export async function waExport(title, html, opts = {}) {
  const v = await dialog('Kirim ke WhatsApp', h('div', { class: 'stack-sm' },
    h('p', { class: 'muted small', text: 'PDF cocok untuk dicetak/diarsipkan; PNG (gambar) langsung terbaca di chat.' }),
    opts.waTo ? h('p', { class: 'small', text: `Penerima yang disarankan: ${opts.waTo}` }) : null),
  [{ label: 'Batal', value: null }, { label: 'Gambar PNG', value: 'wa-png' }, { label: 'PDF', value: 'wa-pdf', kind: 'wa' }]);
  if (v) return runExport(v, title, html, opts);
  return null;
}

// ------------------------------------------------------------------ penanda tangan (pratinjau)
const LS_TTD = 'tatib.ttd.v1';
const loadPrefs = () => { try { return JSON.parse(localStorage.getItem(LS_TTD) || '{}') || {}; } catch { return {}; } };
const savePrefs = (p) => { try { localStorage.setItem(LS_TTD, JSON.stringify(p)); } catch { /* penyimpanan tidak tersedia */ } };
/** Jenis blok = gabungan kunci bawaan; pilihan aktif/nonaktif diingat per jenis dokumen. */
const blockKind = (cols) => cols.filter((c) => !c.custom).map((c) => c.key).join('|');

/**
 * Dokumen yang dapat diedit penanda tangannya: blok .sign-block di HTML dibaca, diubah lewat panel,
 * lalu dirender ulang. html() selalu mengembalikan versi terbaru untuk pratinjau, PDF, PNG, WA, dan cetak.
 */
function signDoc(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = cleanHtml(html);
  const els = [...tpl.content.querySelectorAll('.sign-block')];
  const prefs = loadPrefs();
  const blocks = els.map((el, i) => {
    const base = readSign(el);
    const kind = blockKind(base);
    const saved = prefs[kind] || {};
    const cols = base.map((c) => (c.key in saved ? { ...c, on: !!saved[c.key] } : { ...c }));
    const docEl = el.closest('.doc');
    const title = (docEl?.querySelector('.doc-title')?.textContent || `Dokumen ${i + 1}`).replace(/\s+/g, ' ').trim();
    return { el, base, kind, cols, title };
  });
  const apply = (b) => {
    const fresh = document.createElement('template');
    fresh.innerHTML = signHtml(b.cols);
    const n = fresh.content.firstElementChild;
    b.el.replaceWith(n);
    b.el = n;
  };
  const remember = (b) => {
    const p = loadPrefs();
    p[b.kind] = Object.fromEntries(b.cols.filter((c) => !c.custom).map((c) => [c.key, c.on]));
    savePrefs(p);
  };
  blocks.forEach(apply);
  return { blocks, html: () => tpl.innerHTML, apply, remember };
}

function signPanel(sd, onChange) {
  if (!sd.blocks.length) return null;
  const list = h('div', { class: 'ttd-list' });
  const draw = () => {
    list.replaceChildren(...sd.blocks.map((b, bi) => {
      const changed = () => { sd.apply(b); sd.remember(b); onChange(); };
      const rows = b.cols.map((c, ci) => {
        const inp = (key, label, ph) => h('label', { class: 'ttd-f' }, h('span', { text: label }),
          h('input', { type: 'text', value: c[key] || '', placeholder: ph, disabled: !c.on, oninput: (e) => { c[key] = e.target.value; sd.apply(b); onChange(); } }));
        const chk = h('input', { type: 'checkbox', checked: c.on, 'aria-label': `Cetak tanda tangan ${c.role || 'penanda tangan'}`, onchange: (e) => { c.on = e.target.checked; changed(); draw(); } });
        return h('div', { class: 'ttd-row' + (c.on ? '' : ' off') },
          h('label', { class: 'ttd-on', title: c.on ? 'Ditampilkan di dokumen' : 'Tidak ditampilkan' }, chk, h('b', { text: c.role || 'Penanda tangan' })),
          h('div', { class: 'ttd-fields' },
            inp('top', 'Keterangan atas', 'mis. Mengetahui,'),
            inp('role', 'Jabatan / pihak', 'mis. Kepala Sekolah'),
            inp('name', 'Nama', 'Kosongkan untuk garis titik-titik'),
            inp('nip', c.nipLabel === 'NIS.' ? 'NIS' : 'NIP / NIY', 'Boleh dikosongkan')),
          c.custom ? iconBtn('trash', 'Hapus penanda tangan ini', () => { b.cols.splice(ci, 1); changed(); draw(); }) : null);
      });
      const on = b.cols.filter((c) => c.on).length;
      return h('div', { class: 'ttd-block' },
        sd.blocks.length > 1 ? h('div', { class: 'ttd-doc', text: `${bi + 1}. ${b.title}` }) : null,
        ...rows,
        h('div', { class: 'ttd-foot' },
          h('span', { class: 'muted small', text: `${on} dari ${b.cols.length} penanda tangan dicetak` }),
          btn('Tambah', () => { b.cols.push({ key: 'x' + Date.now().toString(36), top: '', role: 'Penanda tangan', name: '', nip: '', nipLabel: 'NIP.', materai: false, on: true, custom: true }); changed(); draw(); }, { ic: 'plus', small: true, kind: 'text' }),
          btn('Setelan awal', () => { b.cols = b.base.map((c) => ({ ...c })); changed(); draw(); }, { small: true, kind: 'text' })));
    }));
  };
  draw();
  const total = sd.blocks.reduce((t, b) => t + b.cols.length, 0);
  return h('details', { class: 'ttd-panel' },
    h('summary', null, icon('users'), h('span', { class: 'grow', text: 'Penanda tangan dokumen' }), h('span', { class: 'muted small', text: `${total} pihak · atur & edit nama` }), icon('down')),
    h('p', { class: 'muted small', text: 'Centang pihak yang ikut menandatangani, lalu ubah nama/jabatan bila perlu. Perubahan langsung terlihat di pratinjau dan dipakai saat unduh PDF/PNG, kirim WA, atau cetak. Pilihan centang diingat untuk dokumen sejenis berikutnya.' }),
    list);
}

/** Lembar dokumen: pratinjau + penanda tangan + Unduh PDF / Unduh PNG / Kirim WA / Cetak. */
export function openDoc(title, html, opts = {}) {
  opts = { ...opts, paper: paperCode(opts.paper) };
  let pw = paperSize(opts.paper, opts.landscape).px[0];
  const sd = signDoc(html);
  const cur = () => sd.html();
  sheet((b) => {
    const inner = h('div', { class: 'doc-preview-inner docs', style: { width: pw + 'px' } });
    const scaler = h('div', null, inner);
    const box = h('div', { class: 'doc-preview', 'aria-label': 'Pratinjau dokumen' }, scaler);
    const fit = () => {
      const s = Math.min(1, (box.clientWidth - 20) / pw);
      inner.style.transform = `scale(${s})`;
      scaler.style.height = inner.offsetHeight * s + 'px';
      scaler.style.width = pw * s + 'px';
    };
    const pagesInfo = h('span', { class: 'muted small paper-pages' });
    let countT;
    const recount = () => {
      clearTimeout(countT);
      countT = setTimeout(() => {
        const n = countPages(cur(), opts.landscape, opts.paper);
        pagesInfo.textContent = `${n} halaman ${opts.paper}${opts.landscape ? ' mendatar' : ''}`;
      }, 250);
    };
    const render = () => { inner.innerHTML = cur(); fit(); recount(); };
    render();
    const paperSel = h('select', { 'aria-label': 'Ukuran kertas', onchange: (e) => {
      opts.paper = e.target.value;
      pw = paperSize(opts.paper, opts.landscape).px[0];
      inner.style.width = pw + 'px';
      render();
    } }, ...PAPER_OPTIONS.map((o) => h('option', { value: o.value, text: o.label, selected: o.value === opts.paper })));
    b.append(box,
      h('div', { class: 'paper-row' }, h('label', { class: 'paper-pick' }, h('span', { text: 'Ukuran kertas' }), paperSel), pagesInfo),
      signPanel(sd, render),
      opts.waTo ? h('p', { class: 'muted small', text: `Penerima WhatsApp yang disarankan: ${opts.waTo}` }) : null,
      h('div', { class: 'doc-actions' },
        btn('Unduh PDF', () => runExport('pdf', title, cur(), opts), { ic: 'download', kind: 'primary' }),
        btn('Unduh PNG', () => runExport('png', title, cur(), opts), { ic: 'download' }),
        btn('Unduh Word (bisa diedit)', () => runExport('docx', title, cur(), opts), { ic: 'report', class: 'btn tonal wide word' }),
        btn('WA (PDF)', () => runExport('wa-pdf', title, cur(), opts), { ic: 'wa', kind: 'wa' }),
        btn('WA (PNG)', () => runExport('wa-png', title, cur(), opts), { ic: 'wa', kind: 'wa' }),
        btn('Cetak', () => printNow(title, cur(), opts), { ic: 'printer', kind: 'tonal', class: 'btn tonal wide' })));
    requestAnimationFrame(fit);
    new ResizeObserver(fit).observe(box);
  }, { title, wide: true });
}

/** HTML dokumen dengan pilihan penanda tangan tersimpan (untuk tombol PDF/PNG/WA langsung tanpa pratinjau). */
export const withSignPrefs = (html) => signDoc(html).html();
