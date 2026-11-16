// Dokumen → Microsoft Word (.docx) yang dapat diedit. Dibuat langsung di HP/komputer (offline, tanpa pustaka luar):
// HTML dokumen (.doc) dibaca elemen demi elemen lalu disusun ulang sebagai WordprocessingML asli —
// paragraf, tabel bergaris, tabel identitas, kop surat, dan blok tanda tangan tetap rapi & mudah diubah di Word.
import { paperSize } from './paper.js';

// ------------------------------------------------------------------ ZIP (tanpa kompresi) + CRC32
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const enc = new TextEncoder();

function zip(files) {
  const parts = [], central = [];
  let off = 0;
  const now = new Date();
  const dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;
  for (const [name, data] of files) {
    const nm = enc.encode(name);
    const body = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(body);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, dt, true); loc.setUint16(12, dd, true); loc.setUint32(14, crc, true);
    loc.setUint32(18, body.length, true); loc.setUint32(22, body.length, true); loc.setUint16(26, nm.length, true); loc.setUint16(28, 0, true);
    parts.push(new Uint8Array(loc.buffer), nm, body);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, dt, true); cen.setUint16(14, dd, true); cen.setUint32(16, crc, true); cen.setUint32(20, body.length, true); cen.setUint32(24, body.length, true);
    cen.setUint16(28, nm.length, true); cen.setUint32(42, off, true);
    central.push(new Uint8Array(cen.buffer), nm);
    off += 30 + nm.length + body.length;
  }
  const cenSize = central.reduce((t, p) => t + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ------------------------------------------------------------------ WordprocessingML
const FONT = 'Times New Roman';
const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const TW = (mm) => Math.round(mm * 56.6929); // milimeter → twip

function rPr(f = {}) {
  return `<w:rPr>${f.b ? '<w:b/><w:bCs/>' : ''}${f.i ? '<w:i/><w:iCs/>' : ''}${f.u ? '<w:u w:val="single"/>' : ''}${f.caps ? '<w:caps/>' : ''}${f.color ? `<w:color w:val="${f.color}"/>` : ''}${f.spacing ? `<w:spacing w:val="${f.spacing}"/>` : ''}${f.sz ? `<w:sz w:val="${f.sz}"/><w:szCs w:val="${f.sz}"/>` : ''}</w:rPr>`;
}
const run = (text, f = {}) => `<w:r>${rPr(f)}<w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
const brRun = '<w:r><w:br/></w:r>';

/** p: {align, before, after, line, ind:{left,hanging,firstLine}, keepNext, border, pageBreak, sz (tanda paragraf)} */
function para(runs, p = {}) {
  const sp = `<w:spacing w:before="${p.before ?? 0}" w:after="${p.after ?? 100}" w:line="${p.line ?? 264}" w:lineRule="auto"/>`;
  const ind = p.ind ? `<w:ind${p.ind.left != null ? ` w:left="${p.ind.left}"` : ''}${p.ind.hanging ? ` w:hanging="${p.ind.hanging}"` : ''}${p.ind.right ? ` w:right="${p.ind.right}"` : ''}/>` : '';
  return `<w:p><w:pPr>${p.keepNext ? '<w:keepNext/>' : ''}${p.keepLines ? '<w:keepLines/>' : ''}${p.pageBreak ? '<w:pageBreakBefore/>' : ''}${p.border || ''}${p.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${p.shade}"/>` : ''}${sp}${ind}<w:jc w:val="${p.align || 'both'}"/>${p.sz ? rPr({ sz: p.sz }) : ''}</w:pPr>${runs || ''}</w:p>`;
}

const B1 = (side, sz = 6, val = 'single') => `<w:${side} w:val="${val}" w:sz="${sz}" w:space="0" w:color="000000"/>`;
const NOB = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>';
const ALLB = `<w:tblBorders>${B1('top')}${B1('left')}${B1('bottom')}${B1('right')}${B1('insideH')}${B1('insideV')}</w:tblBorders>`;

/** rows: [[{xml, w?, shade?, vAlign?, span?}]] ; widths: twip per kolom */
function table(rows, widths, { borders = false, indent = 0, header = false, cellMar = [40, 80], cantSplit = true } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const tr = rows.map((cells, ri) => {
    let col = 0;
    const tcs = cells.map((c) => {
      const span = c.span || 1;
      const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
      col += span;
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}${c.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${c.shade}"/>` : ''}<w:vAlign w:val="${c.vAlign || 'top'}"/></w:tcPr>${c.xml || para('', { after: 0 })}</w:tc>`;
    }).join('');
    return `<w:tr><w:trPr>${cantSplit ? '<w:cantSplit/>' : ''}${header && ri === 0 ? '<w:tblHeader/>' : ''}</w:trPr>${tcs}</w:tr>`;
  }).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${indent ? `<w:tblInd w:w="${indent}" w:type="dxa"/>` : ''}${borders ? ALLB : NOB}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${cellMar[0]}" w:type="dxa"/><w:left w:w="${cellMar[1]}" w:type="dxa"/><w:bottom w:w="${cellMar[0]}" w:type="dxa"/><w:right w:w="${cellMar[1]}" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${tr}</w:tbl>`;
}

// ------------------------------------------------------------------ teks dalam elemen (tebal, miring, baris baru)
function inline(node, f = {}) {
  let out = '';
  for (const n of node.childNodes) {
    if (n.nodeType === 3) {
      const t = n.textContent.replace(/\s+/g, ' ');
      if (t) out += run(t, f);
    } else if (n.nodeType === 1) {
      const tag = n.tagName;
      if (tag === 'BR') { out += brRun; continue; }
      if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'IMG') continue;
      const g = { ...f };
      if (tag === 'B' || tag === 'STRONG' || n.classList.contains('pill')) g.b = true;
      if (tag === 'I' || tag === 'EM') g.i = true;
      if (tag === 'U') g.u = true;
      if (n.classList.contains('kron')) { out += brRun; g.sz = Math.min(f.sz || 24, 20); g.i = true; }
      if (n.classList.contains('dbar')) { out += bar(parseFloat(n.style.width) || 0); continue; }
      out += inline(n, g);
    }
  }
  return out.replace(/^(<w:r>(?:(?!<\/w:r>).)*?<w:t xml:space="preserve">) /, '$1');
}
const bar = (pct) => (pct > 0 ? run('█'.repeat(Math.max(1, Math.round(pct / 4))), { color: '595959', sz: 18 }) : '');
const plain = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ elemen dokumen
function convert(doc, ctx) {
  const out = [];
  const W = ctx.cw;
  for (const el of doc.children) {
    const cls = el.classList;
    const tag = el.tagName;
    if (cls.contains('kop')) out.push(kop(el, ctx));
    else if (cls.contains('kop-rule')) out.push(para('', { after: 200, line: 240, sz: 4, border: `<w:pBdr>${B1('bottom', 24, 'thickThinSmallGap')}</w:pBdr>` }));
    else if (cls.contains('rpt-head')) {
      const k = el.querySelector('.rpt-kicker'); const t = el.querySelector('.doc-title'); const m = el.querySelectorAll('.rpt-meta span');
      if (k) out.push(para(run(plain(k), { b: true, caps: true, spacing: 40, sz: 21 }), { align: 'center', after: 0 }));
      if (t) out.push(...title(t));
      if (m.length) out.push(para(run([...m].map(plain).join('  ·  '), { sz: 21 }), { align: 'center', after: 160 }));
    } else if (tag === 'H1') out.push(...title(el));
    else if (tag === 'H3') out.push(para(run(plain(el), { b: true }), { before: 160, after: 60, keepNext: true, align: 'left' }));
    else if (tag === 'P') {
      if (!plain(el)) continue;
      const small = cls.contains('small');
      const f = { sz: small ? 20 : undefined, i: cls.contains('foot') || cls.contains('note') };
      if (cls.contains('stamp')) out.push(para(run(plain(el), { b: true, sz: 24 }), { align: 'left', border: `<w:pBdr>${B1('top', 12)}${B1('left', 12)}${B1('bottom', 12)}${B1('right', 12)}</w:pBdr>` }));
      else if (cls.contains('right')) out.push(para(inline(el, f), { align: 'right', before: 200, after: 120, keepNext: true }));
      else if (cls.contains('doc-no')) out.push(para(inline(el, f), { align: 'center', after: 220 }));
      else out.push(para(inline(el, f), { after: 100, align: el.querySelector('br') ? 'left' : 'both' }));
    } else if (tag === 'OL' || tag === 'UL') {
      [...el.children].forEach((li, i) => out.push(para(run(tag === 'OL' ? `${i + 1}.\t` : '•\t') + inline(li), { ind: { left: 400, hanging: 400 }, after: 40 })));
    } else if (tag === 'TABLE' && cls.contains('ident')) out.push(ident(el, W));
    else if (tag === 'TABLE') out.push(grid(el, W));
    else if (cls.contains('box-text')) out.push(para(inline(el), { after: 120, border: `<w:pBdr>${B1('top', 6)}${B1('left', 6)}${B1('bottom', 6)}${B1('right', 6)}</w:pBdr>`, ind: { left: 80, right: 80 } }));
    else if (cls.contains('summary-box') || cls.contains('rpt-tiles') || cls.contains('dsum-grid')) out.push(tiles(el, W));
    else if (cls.contains('rpt-comp')) {
      const items = [...el.querySelectorAll('.rpt-legend > span')].map(plain);
      out.push(para(run('Tingkat pelanggaran: ', { b: true }) + run(items.join('   ·   ')), { after: 140, border: `<w:pBdr>${B1('top')}${B1('left')}${B1('bottom')}${B1('right')}</w:pBdr>`, ind: { left: 80, right: 80 } }));
    } else if (cls.contains('rpt-chart')) out.push(chart(el, W));
    else if (cls.contains('sign-block')) out.push(sign(el, W));
    else if (tag === 'DIV' && el.children.length) out.push(convert(el, ctx));
    else if (plain(el)) out.push(para(inline(el)));
  }
  return out.join('');
}

const title = (el) => el.textContent.split('\n').map((t) => t.trim()).filter(Boolean)
  .map((t, i, a) => para(run(t.toUpperCase(), { b: true, u: true, sz: 26 }), { align: 'center', after: i === a.length - 1 ? 60 : 0, keepNext: true }));

function kop(el, ctx) {
  const lines = [];
  const yys = el.querySelector('.kop-yys'); const nama = el.querySelector('.kop-nama'); const info = el.querySelector('.kop-info');
  if (yys) lines.push(para(run(plain(yys).toUpperCase(), { b: true, sz: 24 }), { align: 'center', after: 0 }));
  if (nama) lines.push(para(run(plain(nama).toUpperCase(), { b: true, sz: 36 }), { align: 'center', after: 0, line: 240 }));
  if (info) lines.push(para(run(plain(info), { i: true, sz: 19 }), { align: 'center', after: 40 }));
  const logo = ctx.logo;
  if (!logo) return lines.join('');
  const L = 1500;
  const img = `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${logo.cx}" cy="${logo.cy}"/><wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${logo.cx}" cy="${logo.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  return table([[{ xml: img, vAlign: 'center' }, { xml: lines.join(''), vAlign: 'center' }, { xml: para('', { after: 0 }) }]], [L, ctx.cw - 2 * L, L], { cellMar: [0, 40] });
}

function ident(el, W) {
  const rows = [...el.rows].map((tr) => [...tr.cells]);
  const w0 = 2600, w1 = 240, ind = 360;
  return table(rows.map((cells) => cells.map((c, i) => ({ xml: para(inline(c), { align: i === 2 ? 'both' : 'left', after: 20 }) }))).filter((r) => r.length === 3),
    [w0, w1, W - ind - w0 - w1], { indent: ind, cellMar: [0, 60] }) + para('', { after: 60, sz: 8 });
}

/**
 * Lebar kolom dari isi: setiap kolom minimal selebar kata terpanjangnya (agar kata tidak terpotong),
 * sisa lebar dibagi menurut panjang teks — kolom uraian/kronologi mendapat ruang paling lebar.
 */
function colWidths(rows, n, W) {
  const word = Array(n).fill(2), len = Array(n).fill(2);
  rows.forEach((r) => { let c = 0; r.forEach((cell) => {
    const t = plain(cell);
    if (c < n && (cell.colSpan || 1) === 1) {
      word[c] = Math.max(word[c], ...(cell.classList?.contains('nw') ? [t.length] : t.split(' ').map((w) => w.length)));
      len[c] = Math.max(len[c], t.length);
    }
    c += cell.colSpan || 1;
  }); });
  const min = word.map((w) => Math.min(2600, Math.round(w * 118 + 220)));
  let free = W - min.reduce((a, b) => a + b, 0);
  if (free < 0) { const k = W / (W - free); return fit(min.map((m) => Math.round(m * k)), W); }
  const extra = len.map((l, i) => Math.max(0, l - word[i]) + min[i] / 120);
  const sum = extra.reduce((a, b) => a + b, 0) || 1;
  return fit(min.map((m, i) => m + Math.round((extra[i] / sum) * free)), W);
}
const fit = (w, W) => { w[w.indexOf(Math.max(...w))] += W - w.reduce((a, b) => a + b, 0); return w; };

function grid(el, W) {
  const head = el.tHead ? [...el.tHead.rows] : [];
  const body = [...el.tBodies].flatMap((b) => [...b.rows]);
  const all = [...head, ...body];
  if (!all.length) return '';
  const n = Math.max(...all.map((r) => [...r.cells].reduce((t, c) => t + (c.colSpan || 1), 0)));
  const widths = colWidths(all.map((r) => [...r.cells]), n, W);
  const rows = all.map((tr, ri) => [...tr.cells].map((c) => {
    const isHead = ri < head.length;
    const num = c.classList.contains('num');
    return {
      span: c.colSpan || 1, shade: isHead ? 'E6E6E6' : tr.classList.contains('grp') ? 'F0F0F0' : undefined, vAlign: isHead ? 'center' : 'top',
      xml: para(inline(c, { sz: 21, b: isHead || undefined }), { align: isHead ? 'center' : num ? 'right' : c.classList.contains('no') ? 'center' : 'left', after: 0, line: 240 }),
    };
  }));
  return table(rows, widths, { borders: true, header: head.length > 0, cellMar: [30, 80] }) + para('', { after: 60, sz: 8 });
}

function tiles(el, W) {
  const cells = [...el.children];
  if (!cells.length) return '';
  const w = Math.floor(W / cells.length);
  const widths = cells.map((_, i) => (i === cells.length - 1 ? W - w * (cells.length - 1) : w));
  const row = cells.map((c) => {
    const lab = c.querySelector('span'); const val = c.querySelector('b'); const sub = c.querySelector('em');
    return { xml: para(run(plain(lab), { sz: 19 }), { align: 'center', after: 0 }) + para(run(plain(val), { b: true, sz: 28 }), { align: 'center', after: 0 }) + (sub ? para(run(plain(sub), { i: true, sz: 18 }), { align: 'center', after: 0 }) : '') };
  });
  return table([row], widths, { borders: true, cellMar: [60, 80] }) + para('', { after: 80, sz: 8 });
}

function chart(el, W) {
  const head = el.querySelector('.rpt-chart-h');
  const rows = [...el.querySelectorAll('.rb')].map((rb) => {
    const pct = parseFloat(rb.querySelector('.rb-t > span')?.style.width) || 0;
    return [{ xml: para(run(plain(rb.querySelector('.rb-l')), { sz: 20 }), { align: 'left', after: 0 }) },
      { xml: para(bar(pct), { align: 'left', after: 0, line: 240 }), vAlign: 'center' },
      { xml: para(run(plain(rb.querySelector('.rb-v')), { b: true, sz: 20 }), { align: 'right', after: 0 }) }];
  });
  const w0 = Math.round(W * 0.34), w2 = 900;
  return para(run(plain(head?.querySelector('b')), { b: true }) + (head?.querySelector('span') ? run(`  (${plain(head.querySelector('span'))})`, { i: true, sz: 20 }) : ''), { before: 80, after: 40, keepNext: true, align: 'left' })
    + table(rows, [w0, W - w0 - w2, w2], { cellMar: [10, 60] }) + para('', { after: 80, sz: 8 });
}

function sign(el, W) {
  return [...el.querySelectorAll('.sign-row')].map((row) => {
    const cols = [...row.querySelectorAll('.sign-col')];
    const solo = row.classList.contains('solo');
    const n = solo ? 2 : cols.length;
    const w = Math.floor(W / n);
    const widths = Array.from({ length: n }, (_, i) => (i === n - 1 ? W - w * (n - 1) : w));
    const cell = (c) => {
      const top = plain(c.querySelector('.sign-top')); const role = plain(c.querySelector('.sign-role'));
      const name = plain(c.querySelector('.sign-name')); const nip = plain(c.querySelector('.sign-nip'));
      const materai = c.querySelector('.materai');
      return { xml: (top ? para(run(top), { align: 'center', after: 0 }) : para('', { after: 0 }))
        + para(run(role), { align: 'center', after: materai ? 120 : 1000, keepNext: true })
        + (materai ? para(run('Meterai 10.000', { sz: 16, color: '777777' }), { align: 'center', after: 300 }) : '')
        + para(run(name, { b: true, u: true }), { align: 'center', after: 0, keepNext: true })
        + (nip ? para(run(nip, { sz: 22 }), { align: 'center', after: 0 }) : '') };
    };
    const cells = solo ? [{ xml: para('', { after: 0 }) }, cell(cols[0])] : cols.map(cell);
    return table([cells], widths, { cellMar: [0, 60] }) + para('', { after: 120, sz: 8 });
  }).join('');
}

// ------------------------------------------------------------------ paket .docx
async function logoOf(src) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(src || '');
  if (!m) return null;
  const bin = atob(m[2]); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const img = new Image(); img.src = src;
  try { await img.decode(); } catch { return null; }
  const max = 78 * 9525, r = img.naturalWidth / img.naturalHeight || 1;
  return { ext: m[1].toLowerCase() === 'png' ? 'png' : 'jpeg', data: u8, cx: Math.round(r >= 1 ? max : max * r), cy: Math.round(r >= 1 ? max / r : max) };
}

/** HTML dokumen (satu atau beberapa .doc) → Blob .docx. opts: {landscape, paper, title} */
export async function makeDocx(title, html, { landscape = false, paper } = {}) {
  const src = document.createElement('div');
  src.innerHTML = String(html).replace(/<style[\s\S]*?<\/style>/gi, '');
  const { mm: [pw, ph] } = paperSize(paper, landscape);
  const mx = TW(18), my = TW(15);
  const ctx = { cw: TW(pw) - 2 * mx, logo: await logoOf(src.querySelector('.kop-logo:not(.kop-pad)')?.getAttribute('src')) };
  const docs = [...src.querySelectorAll(':scope > .doc')];
  const bodyXml = docs.map((d, i) => {
    const xml = convert(d, ctx);
    return (i ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '') + xml;
  }).join('');
  const sect = `<w:sectPr><w:pgSz w:w="${TW(pw)}" w:h="${TW(ph)}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${my}" w:right="${mx}" w:bottom="${my}" w:left="${mx}" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>`;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const document_ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}${sect}</w:body></w:document>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="400"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const logoRel = ctx.logo ? `<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${ctx.logo.ext === 'png' ? 'png' : 'jpeg'}"/>` : '';
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>'],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(title)}</dc:title><dc:creator>Aplikasi Tata Tertib</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created></cp:coreProperties>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${logoRel}</Relationships>`],
    ['word/document.xml', document_],
    ['word/styles.xml', styles],
    ['word/settings.xml', settings],
  ];
  if (ctx.logo) files.push([`word/media/logo.${ctx.logo.ext === 'png' ? 'png' : 'jpeg'}`, ctx.logo.data]);
  return { blob: zip(files), pages: docs.length };
}
