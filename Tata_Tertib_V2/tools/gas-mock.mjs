// Tiruan Google Apps Script + Spreadsheet untuk menjalankan apps-script/Code.gs di Node (uji tanpa Google).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE_PATH = new URL('../apps-script/Code.gs', import.meta.url);
const pad = (n) => String(n).padStart(2, '0');

class Range {
  constructor(sh, r, c, nr = 1, nc = 1) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) { const v = this.sh.rows[this.r - 1 + i]?.[this.c - 1 + j]; row.push(v === undefined ? '' : v); }
      out.push(row);
    }
    return out;
  }
  setValues(v) {
    if (v.length !== this.nr) throw new Error(`setValues: ${v.length} baris, rentang ${this.nr}`);
    v.forEach((row, i) => {
      if (row.length !== this.nc) throw new Error(`setValues: ${row.length} kolom, rentang ${this.nc}`);
      row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x));
    });
    this.sh.writes++;
    return this;
  }
  setValue(x) { this.sh.set(this.r, this.c, x); return this; }
  setFormula(f) { this.sh.set(this.r, this.c, f); return this; }
  getRow() { return this.r; } getColumn() { return this.c; } getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
  getSheet() { return this.sh; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; }
  setNumberFormat(f) { for (let j = 0; j < this.nc; j++) this.sh.formats[this.c + j] = f; return this; }
}

export class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.formats = {}; this.writes = 0; }
  getName() { return this.name; }
  set(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; }
  getLastRow() { for (let i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some((x) => x !== '' && x != null)) return i; return 0; }
  getLastColumn() { return this.rows.reduce((m, r) => { for (let i = r.length; i > 0; i--) if (r[i - 1] !== '' && r[i - 1] != null) return Math.max(m, i); return m; }, 0); }
  getMaxRows() { return 1000; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') { const m = /^([A-Z]+)(\d+)$/.exec(a); let col = 0; for (const ch of m[1]) col = col * 26 + ch.charCodeAt(0) - 64; return new Range(this, Number(m[2]), col); }
    return new Range(this, a, b, c, d);
  }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  setFrozenRows() {} setColumnWidth() {}
  /** Baris data sebagai objek {judul: nilai}. */
  objects() { const [head, ...rest] = this.rows; return rest.filter((r) => r.some((x) => x !== '')).map((r) => Object.fromEntries(head.map((hd, i) => [hd, r[i] ?? '']))); }
}

/** preset: {namaSheet: [[baris]]}. opts.realTime: pakai jam sungguhan (untuk server uji e2e). */
export function makeEnv(preset = {}, opts = {}) {
  const CODE = readFileSync(opts.code || CODE_PATH, 'utf8');
  const sheets = new Map(Object.entries(preset).map(([n, rows]) => { const s = new Sheet(n); s.rows = rows.map((r) => [...r]); return [n, s]; }));
  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = new Sheet(n); sheets.set(n, s); return s; },
    getSpreadsheetTimeZone: () => 'Asia/Makassar',
    getSheets: () => [...sheets.values()], deleteSheet: (s) => sheets.delete(s.name),
  };
  let now = opts.realTime ? null : new Date(2026, 9, 26, 8, 0, 0).getTime();
  const cache = new Map();
  const props = new Map();
  const counters = { digest: 0 };
  const fmt = (d, f) => f.replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
    .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()));
  const BaseDate = Date;
  const MockDate = now === null ? Date : class extends BaseDate {
    constructor(...a) { if (a.length) super(...a); else super(now); }
    static now() { return now; }
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('tanpa UI'); } },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v),
      getAll: (keys) => Object.fromEntries(keys.filter((k) => cache.has(k)).map((k) => [k, cache.get(k)])),
      putAll: (o) => { for (const [k, v] of Object.entries(o)) cache.set(k, v); },
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
    Utilities: {
      formatDate: (d, tz, f) => fmt(d, f),
      computeDigest: (alg, s) => { counters.digest++; return [...createHash('sha256').update(String(s), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)); },
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      getUuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    },
    Logger: { log() {} },
    Date: MockDate,
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx);
  for (const s of sheets.values()) s.rows = s.rows.map((r) => r.map((v) => (v && v.ymd ? new MockDate(...v.ymd) : v)));
  const fn = (name) => vm.runInContext(name, ctx);
  return {
    sheets, cache, counters,
    sheet: (n) => sheets.get(n),
    tick: (ms = 1000) => { if (now !== null) now += ms; },
    getRaw: (params) => fn('doGet')({ parameter: params }).s,
    postRaw: (text) => fn('doPost')({ postData: { contents: text } }).s,
    get(params) { return JSON.parse(this.getRaw(params)); },
    post(body) { return JSON.parse(this.postRaw(JSON.stringify(body))); },
    setup: () => fn('setup')(),
    onEdit: (e) => fn('onEdit')(e),
    run: (expr) => vm.runInContext(expr, ctx),
  };
}
