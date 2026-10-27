// Grafik ringan tanpa pustaka (SVG/HTML), warna dari token CSS (--series-1, --seq-*, --st-*) agar
// mengikuti tema terang/gelap. Setiap grafik punya tooltip (hover & fokus keyboard) dan tampilan tabel.
import { h, icon, clear } from './dom.js';
import { fmtNum } from '../core/util.js';

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const k of kids.flat()) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}

// ------------------------------------------------------------------ tooltip tunggal
let tip;
function tipEl() {
  if (!tip) { tip = h('div', { class: 'chart-tip', role: 'tooltip' }); document.body.append(tip); }
  return tip;
}
/** rows: [{value, label, swatch?}] — nilai tebal di depan, label sekunder. */
export function showTip(x, y, title, rows) {
  const t = tipEl();
  clear(t);
  if (title) t.append(h('div', { class: 'tip-title', text: title }));
  for (const r of rows) {
    t.append(h('div', { class: 'tip-row' },
      r.swatch ? h('span', { class: 'tip-key', style: { background: r.swatch } }) : null,
      h('strong', { text: r.value }), h('span', { class: 'muted', text: r.label || '' })));
  }
  t.classList.add('show');
  const w = t.offsetWidth, ht = t.offsetHeight;
  const left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2));
  const top = y - ht - 12 < 8 ? y + 16 : y - ht - 12;
  t.style.left = left + 'px';
  t.style.top = top + 'px';
}
export function hideTip() { tip?.classList.remove('show'); }
window.addEventListener('scroll', hideTip, { passive: true });

function bindTip(el, getContent) {
  const show = (x, y) => { const c = getContent(); showTip(x, y, c.title, c.rows); };
  el.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', () => { const r = el.getBoundingClientRect(); show(r.left + r.width / 2, r.top); });
  el.addEventListener('blur', hideTip);
}

function niceMax(v) {
  if (v <= 4) return Math.max(1, Math.ceil(v));
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function ticks(max) {
  const n = max <= 4 ? max : 4;
  return Array.from({ length: n + 1 }, (_, i) => Math.round((max / n) * i * 100) / 100);
}

/** Ukur lebar wadah lalu gambar; gambar ulang saat ukuran berubah. */
function responsive(wrap, draw) {
  let lastW = 0;
  const render = () => {
    const w = Math.round(wrap.clientWidth);
    if (!w || w === lastW) return;
    lastW = w;
    clear(wrap);
    draw(w);
  };
  const ro = new ResizeObserver(() => requestAnimationFrame(render));
  ro.observe(wrap);
  requestAnimationFrame(render);
  return wrap;
}

// ------------------------------------------------------------------ kolom (deret waktu)
/** buckets: [{label, full, value}] */
export function columnChart(buckets, { height = 190, unit = 'pelanggaran', onPick } = {}) {
  const wrap = h('div', { class: 'chart col-chart' });
  return responsive(wrap, (W) => {
    const padL = 30, padR = 8, padT = 18, axisH = 24;
    const H = height + axisH;
    const max = niceMax(Math.max(1, ...buckets.map((b) => b.value)));
    const n = buckets.length || 1;
    const band = (W - padL - padR) / n;
    const bw = Math.max(2, Math.min(24, band * 0.62));
    const y = (v) => padT + (height - padT) * (1 - v / max);
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Grafik ${unit}` });
    for (const t of ticks(max)) {
      svg.append(s('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }));
      svg.append(s('text', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, fmtNum(t)));
    }
    const every = Math.max(1, Math.ceil(n / Math.floor((W - padL) / 46)));
    const maxV = Math.max(...buckets.map((b) => b.value));
    let maxLabeled = false;
    buckets.forEach((b, i) => {
      const cx = padL + band * i + band / 2;
      const g = s('g', { class: 'mark', tabindex: '0', role: 'img', 'aria-label': `${b.full}: ${b.value} ${unit}` });
      g.append(s('rect', { x: padL + band * i, y: padT - 6, width: band, height: height - padT + 6, class: 'hit' }));
      if (b.value > 0) {
        const top = y(b.value), x0 = cx - bw / 2, r = Math.min(4, bw / 2, height - top);
        g.append(s('path', { class: 'bar', d: `M${x0},${height} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${height} Z` }));
        if (b.value === maxV && !maxLabeled) {
          maxLabeled = true;
          g.append(s('text', { x: cx, y: top - 5, 'text-anchor': 'middle', class: 'val' }, fmtNum(b.value)));
        }
      }
      bindTip(g, () => ({ title: b.full, rows: [{ value: fmtNum(b.value), label: unit }] }));
      if (onPick) g.addEventListener('click', () => onPick(b));
      svg.append(g);
      if (i % every === 0) svg.append(s('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: 'tick' }, b.label));
    });
    wrap.append(svg);
  });
}

// ------------------------------------------------------------------ daftar batang horizontal
/** items: [{label, value, sub?, onClick?, badge?}] — label di atas batang, nilai di ujung. */
export function barList(items, { max, fmt = fmtNum, unit = '', empty = 'Belum ada data.' } = {}) {
  if (!items.length) return h('p', { class: 'muted small empty-chart', text: empty });
  const m = max || Math.max(1, ...items.map((i) => i.value));
  return h('div', { class: 'barlist' }, ...items.map((it) => {
    const row = h(it.onClick ? 'button' : 'div', { class: 'barrow', type: it.onClick ? 'button' : null, onclick: it.onClick || null, tabindex: it.onClick ? null : '0' },
      h('div', { class: 'barrow-head' },
        h('span', { class: 'barrow-label', text: it.label }),
        it.badge || null,
        h('span', { class: 'barrow-val', text: fmt(it.value) })),
      h('div', { class: 'barrow-track' }, h('div', { class: 'barrow-fill', style: { width: `${Math.max(it.value > 0 ? 1.5 : 0, (it.value / m) * 100)}%` } })),
      it.sub ? h('div', { class: 'barrow-sub', text: it.sub }) : null);
    bindTip(row, () => ({ title: it.label, rows: [{ value: fmt(it.value), label: unit }, ...(it.sub ? [{ value: '', label: it.sub }] : [])] }));
    return row;
  }));
}

// ------------------------------------------------------------------ batang bertumpuk (komposisi)
/** parts: [{label, value, color}] warna = var CSS. */
/** legend: false bila halaman sudah menampilkan satu legenda bersama untuk beberapa batang. */
export function stackBar(parts, { unit = 'pelanggaran', legend: showLegend = true } = {}) {
  const total = parts.reduce((t, p) => t + p.value, 0);
  const bar = h('div', { class: 'stackbar' });
  for (const p of parts) {
    if (!p.value) continue;
    const seg = h('div', { class: 'stack-seg', tabindex: '0', style: { flexGrow: p.value, background: p.color }, 'aria-label': `${p.label}: ${p.value}` });
    bindTip(seg, () => ({ title: p.label, rows: [{ value: fmtNum(p.value), label: `${unit} · ${total ? Math.round((p.value / total) * 100) : 0}%` }] }));
    bar.append(seg);
  }
  if (!total) bar.append(h('div', { class: 'stack-empty' }));
  if (!showLegend) return h('div', { class: 'stack-wrap' }, bar);
  const legend = h('div', { class: 'legend' }, ...parts.map((p) => h('span', { class: 'legend-item' },
    h('span', { class: 'swatch', style: { background: p.color } }),
    h('span', { text: p.label }), h('strong', { text: fmtNum(p.value) }),
    h('span', { class: 'muted', text: total ? `(${Math.round((p.value / total) * 100)}%)` : '' }))));
  return h('div', { class: 'stack-wrap' }, bar, legend);
}

// ------------------------------------------------------------------ peta panas hari × jam
const SEQ = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)'];
export function heatGrid({ rowLabels, colLabels, grid, unit = 'pelanggaran', colTitle = (c) => c, rowTitle = (r) => r }) {
  const max = Math.max(0, ...grid.flat());
  const step = (v) => (v <= 0 || !max ? null : SEQ[Math.min(4, Math.floor((v / max) * 4.999))]);
  const table = h('div', { class: 'heat', style: { gridTemplateColumns: `auto repeat(${colLabels.length}, minmax(0, 1fr))` } });
  table.append(h('span'));
  colLabels.forEach((c) => table.append(h('span', { class: 'heat-col', text: c })));
  grid.forEach((row, ri) => {
    table.append(h('span', { class: 'heat-row', text: rowLabels[ri] }));
    row.forEach((v, ci) => {
      const bg = step(v);
      const cell = h('span', { class: 'heat-cell' + (bg ? '' : ' zero'), tabindex: '0', style: bg ? { background: bg } : null, 'aria-label': `${rowTitle(rowLabels[ri])} ${colTitle(colLabels[ci])}: ${v}` });
      bindTip(cell, () => ({ title: `${rowTitle(rowLabels[ri])}, ${colTitle(colLabels[ci])}`, rows: [{ value: fmtNum(v), label: unit }] }));
      table.append(cell);
    });
  });
  const legend = h('div', { class: 'heat-legend' }, h('span', { class: 'muted small', text: 'Sedikit' }),
    h('span', { class: 'heat-cell zero sm' }), ...SEQ.map((c) => h('span', { class: 'heat-cell sm', style: { background: c } })),
    h('span', { class: 'muted small', text: `Banyak (maks. ${fmtNum(max)})` }));
  return h('div', { class: 'heat-wrap' }, table, legend);
}

// ------------------------------------------------------------------ akumulasi poin siswa
/** points: [{x: label tanggal, full, value: kumulatif, add, text}], levels: [{min,label}] */
export function cumChart(points, levels, { height = 220 } = {}) {
  const wrap = h('div', { class: 'chart cum-chart' });
  return responsive(wrap, (W) => {
    const padL = 30, padR = 92, padT = 12, axisH = 22;
    const H = height + axisH;
    const last = points.length ? points[points.length - 1].value : 0;
    const max = Math.max(110, Math.ceil((last + 12) / 10) * 10);
    const n = points.length;
    const x = (i) => padL + (n <= 1 ? (W - padL - padR) / 2 : ((W - padL - padR) * i) / (n - 1));
    const y = (v) => padT + (height - padT) * (1 - v / max);
    const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Grafik akumulasi poin' });
    svg.append(s('line', { x1: padL, x2: W - padR, y1: y(0), y2: y(0), class: 'axis' }));
    svg.append(s('text', { x: padL - 6, y: y(0) + 4, 'text-anchor': 'end', class: 'tick' }, '0'));
    // Garis tiap tahap selalu digambar; label dimulai dari tahap tertinggi dan dilewati bila terlalu rapat.
    let lastLabelY = -Infinity;
    for (const l of [...levels].reverse()) {
      if (l.min > max) continue;
      const ly = y(l.min);
      svg.append(s('line', { x1: padL, x2: W - padR, y1: ly, y2: ly, class: 'grid' }));
      if (ly - lastLabelY < 13 || y(0) - ly < 13) continue;
      lastLabelY = ly;
      svg.append(s('text', { x: padL - 6, y: ly + 4, 'text-anchor': 'end', class: 'tick' }, l.min));
      svg.append(s('text', { x: W - padR + 6, y: ly + 4, class: 'tick' }, l.short || l.label));
    }
    if (n) {
      let d = `M${x(0)},${y(0)}`;
      points.forEach((p, i) => { d += ` L${x(i)},${y(i === 0 ? 0 : points[i - 1].value)} L${x(i)},${y(p.value)}`; });
      svg.append(s('path', { d: d + ` L${x(n - 1)},${y(0)} Z`, class: 'area' }));
      svg.append(s('path', { d, class: 'line' }));
      points.forEach((p, i) => svg.append(s('circle', { cx: x(i), cy: y(p.value), r: 4, class: 'dot' })));
      svg.append(s('text', { x: x(n - 1), y: y(last) - 9, 'text-anchor': n > 1 ? 'end' : 'middle', class: 'val' }, `${fmtNum(last)} poin`));
      svg.append(s('text', { x: x(0), y: H - 5, 'text-anchor': n > 1 ? 'start' : 'middle', class: 'tick' }, points[0].x));
      if (n > 1) svg.append(s('text', { x: x(n - 1), y: H - 5, 'text-anchor': 'end', class: 'tick' }, points[n - 1].x));
      // Lapisan crosshair: arahkan ke mana saja, menempel ke catatan terdekat.
      const cross = s('line', { y1: padT, y2: height, class: 'crosshair', visibility: 'hidden' });
      const hit = s('rect', { x: padL - 10, y: 0, width: W - padL - padR + 20, height, class: 'hit', tabindex: '0', 'aria-label': 'Detail per catatan' });
      svg.append(cross, hit);
      let focusI = n - 1;
      const showAt = (i, cx, cy) => {
        const p = points[i];
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
        showTip(cx, cy, p.full, [{ value: `${fmtNum(p.value)} poin`, label: 'akumulasi' }, { value: `+${fmtNum(p.add)}`, label: p.text }]);
      };
      hit.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const px = e.clientX - r.left;
        let best = 0;
        points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
        focusI = best;
        showAt(best, r.left + x(best), r.top + y(points[best].value));
      });
      hit.addEventListener('pointerleave', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); });
      hit.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        focusI = Math.max(0, Math.min(n - 1, focusI + (e.key === 'ArrowRight' ? 1 : -1)));
        const r = svg.getBoundingClientRect();
        showAt(focusI, r.left + x(focusI), r.top + y(points[focusI].value));
      });
      hit.addEventListener('focus', () => { const r = svg.getBoundingClientRect(); showAt(focusI, r.left + x(focusI), r.top + y(points[focusI].value)); });
      hit.addEventListener('blur', () => { hideTip(); cross.setAttribute('visibility', 'hidden'); });
    } else {
      svg.append(s('text', { x: (W - padR + padL) / 2, y: height / 2, 'text-anchor': 'middle', class: 'tick' }, 'Belum ada pelanggaran'));
    }
    wrap.append(svg);
  });
}

// ------------------------------------------------------------------ meter poin 0–100
export function pointsMeter(total, levels, { compact = false } = {}) {
  const max = 100;
  const pct = Math.min(100, (total / max) * 100);
  let warna = 'ok';
  for (const l of levels) if (total >= l.min) warna = l.warna || 'warn';
  const m = h('div', { class: `meter${compact ? ' compact' : ''}`, role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(total), 'aria-label': `${total} dari ${max} poin` },
    h('div', { class: `meter-fill st-${warna}`, style: { width: pct + '%' } }));
  if (!compact) for (const l of levels) if (l.min > 0 && l.min < max) m.append(h('span', { class: 'meter-tick', style: { left: l.min + '%' }, title: `${l.label} (${l.min})` }));
  return m;
}

// ------------------------------------------------------------------ kartu grafik + tampilan tabel
/** table: {cols: [..], rows: [[..]]} — tombol "Tabel" menukar grafik dengan tabel datanya. */
export function chartCard({ title, sub, chart, table, actions, cls = '' }) {
  const body = h('div', { class: 'chart-body' }, chart);
  let showingTable = false;
  const toggle = table ? h('button', { class: 'chip-btn', type: 'button', 'aria-pressed': 'false' }, icon('table'), h('span', { text: 'Tabel' })) : null;
  toggle?.addEventListener('click', () => {
    showingTable = !showingTable;
    toggle.setAttribute('aria-pressed', String(showingTable));
    toggle.lastChild.textContent = showingTable ? 'Grafik' : 'Tabel';
    clear(body).append(showingTable ? dataTable(table.cols, table.rows) : chart);
  });
  return h('section', { class: 'card chart-card ' + cls },
    h('div', { class: 'card-head' },
      h('div', { class: 'grow' }, h('h3', { text: title }), sub ? h('p', { class: 'muted small', text: sub }) : null),
      actions || null, toggle),
    body);
}

export function dataTable(cols, rows, { numeric = [] } = {}) {
  const isNum = (i) => numeric.includes(i) || rows.every((r) => typeof r[i] === 'number');
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', null, h('tr', null, ...cols.map((c, i) => h('th', { class: isNum(i) ? 'num' : '', text: c })))),
    h('tbody', null, ...(rows.length ? rows.map((r) => h('tr', null, ...r.map((v, i) => h('td', { class: isNum(i) ? 'num' : '' }, typeof v === 'number' ? fmtNum(v, 1) : v)))) : [h('tr', null, h('td', { colspan: cols.length, class: 'muted', text: 'Belum ada data.' }))]))));
}
