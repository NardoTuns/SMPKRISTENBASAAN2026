// Dokumen → Cetak / PDF / PNG / kirim ke WhatsApp. Dokumen (BAP, surat, laporan) dipotong menjadi halaman A4
// di kertas tak terlihat, dirasterisasi dengan html2canvas, lalu dirakit jsPDF. Kedua pustaka dimuat saat
// dibutuhkan saja dan ikut tersimpan offline oleh service worker.
import { h, icon, btn, sheet, toast, dialog, downloadBlob } from './dom.js';

const A4 = { portrait: [794, 1123], landscape: [1123, 794] };
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
function paginate(html, landscape) {
  const stage = h('div', { class: 'paper-stage' });
  document.body.append(stage);
  const src = h('div');
  src.innerHTML = cleanHtml(html);
  const pages = [];
  let page, holder;
  const newPage = () => {
    page = h('div', { class: 'paper docs' + (landscape ? ' landscape' : '') });
    holder = h('div', { class: 'doc' });
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
      const carry = takeTrailing();
      newPage();
      holder.append(...carry, el); // elemen lebih tinggi dari satu halaman tetap ditaruh (terpotong di bawah)
    }
  }
  return { stage, pages };
}

async function rasterize(html, { landscape = false, scale = 2 } = {}) {
  const { html2canvas } = await libs();
  const { stage, pages } = paginate(html, landscape);
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

export async function makePdf(title, html, { landscape = false } = {}) {
  const canvases = await rasterize(html, { landscape, scale: 2 });
  const { jsPDF } = await libs();
  const orient = landscape ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation: orient, unit: 'mm', format: 'a4', compress: true });
  const [w, hgt] = landscape ? [297, 210] : [210, 297];
  canvases.forEach((c, i) => {
    if (i) pdf.addPage('a4', orient);
    pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, hgt, undefined, 'FAST');
  });
  pdf.setProperties({ title, creator: 'Aplikasi Tata Tertib' });
  return { blob: pdf.output('blob'), pages: canvases.length };
}

/** Satu PNG; dokumen beberapa halaman disusun ke bawah (skala disesuaikan agar tetap aman di HP). */
export async function makePng(title, html, { landscape = false } = {}) {
  const [, pageH] = A4[landscape ? 'landscape' : 'portrait'];
  const probe = paginate(html, landscape);
  const n = probe.pages.length;
  probe.stage.remove();
  const scale = Math.max(1, Math.min(2, 15000 / (n * pageH)));
  const canvases = await rasterize(html, { landscape, scale });
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

// ------------------------------------------------------------------ cetak, unduh, bagikan
export async function printNow(title, html, { landscape = false } = {}) {
  const root = document.getElementById('print-root');
  root.innerHTML = `<style>@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 15mm; }</style>${cleanHtml(html)}`;
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
 * action: 'pdf' | 'png' | 'wa-pdf' | 'wa-png' | 'print'.
 * opts: {landscape, fileBase, waNumber (62…), waText, waTo (nama penerima)}
 */
export async function runExport(action, title, html, opts = {}) {
  if (action === 'print') return printNow(title, html, opts);
  const kind = action.endsWith('png') ? 'png' : 'pdf';
  busyOverlay(kind === 'pdf' ? 'Menyiapkan PDF…' : 'Menyiapkan gambar PNG…');
  let res;
  try {
    res = kind === 'pdf' ? await makePdf(title, html, opts) : await makePng(title, html, opts);
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
    toast(`${kind.toUpperCase()} tersimpan: ${name}${res.pages > 1 ? ` (${res.pages} halaman)` : ''}`);
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

/** Lembar dokumen: pratinjau + Unduh PDF / Unduh PNG / Kirim WA / Cetak. */
export function openDoc(title, html, opts = {}) {
  const [pw] = A4[opts.landscape ? 'landscape' : 'portrait'];
  sheet((b) => {
    const inner = h('div', { class: 'doc-preview-inner docs', style: { width: pw + 'px' } });
    inner.innerHTML = cleanHtml(html);
    const scaler = h('div', null, inner);
    const box = h('div', { class: 'doc-preview', 'aria-label': 'Pratinjau dokumen' }, scaler);
    const fit = () => {
      const s = Math.min(1, (box.clientWidth - 20) / pw);
      inner.style.transform = `scale(${s})`;
      scaler.style.height = inner.offsetHeight * s + 'px';
      scaler.style.width = pw * s + 'px';
    };
    b.append(box,
      opts.waTo ? h('p', { class: 'muted small', text: `Penerima WhatsApp yang disarankan: ${opts.waTo}` }) : null,
      h('div', { class: 'doc-actions' },
        btn('Unduh PDF', () => runExport('pdf', title, html, opts), { ic: 'download', kind: 'primary' }),
        btn('Unduh PNG', () => runExport('png', title, html, opts), { ic: 'download' }),
        btn('WA (PDF)', () => runExport('wa-pdf', title, html, opts), { ic: 'wa', kind: 'wa' }),
        btn('WA (PNG)', () => runExport('wa-png', title, html, opts), { ic: 'wa', kind: 'wa' }),
        btn('Cetak', () => printNow(title, html, opts), { ic: 'printer', kind: 'tonal', class: 'btn tonal wide' })));
    requestAnimationFrame(fit);
    new ResizeObserver(fit).observe(box);
  }, { title, wide: true });
}
