// Uji modul inti (murni) di js/core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256Hex, deriveKey } from '../js/core/sha256.js';
import { buildSummaries, buildTindak, previewImpact, sortLevels, summarize } from '../js/core/points.js';
import { countBy, filterRecords, heat, periodRange, totals, trend, byDate } from '../js/core/stats.js';
import { canEditRecord, canTindak } from '../js/core/perm.js';
import { DEFAULT_SANKSI } from '../js/core/rules.js';
import { addDays, parseTable, toCSV, waNumber, weekStart, matches, cmpKelas } from '../js/core/util.js';
import { makeDemo } from '../js/core/demo.js';
import { makeEnv } from '../tools/gas-mock.mjs';

const LV = sortLevels(DEFAULT_SANKSI);

test('sha256 identik dengan node:crypto (termasuk batas blok & huruf non-ASCII)', () => {
  for (const s of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(119), 'Tata Tertib — é ü 你好 🎉', 'x'.repeat(1000)]) {
    assert.equal(sha256Hex(s), createHash('sha256').update(s, 'utf8').digest('hex'), JSON.stringify(s.slice(0, 20)));
  }
});

test('deriveKey sama dengan derive_ di Code.gs', () => {
  const env = makeEnv();
  for (const [u, p] of [['admin', 'krisba1234'], ['Bu.Ani', 'pässwörd'], ['x', '']]) {
    assert.equal(deriveKey('v', 'garam', u, p, 200), env.run(`derive_('v', 'garam', ${JSON.stringify(u)}, ${JSON.stringify(p)})`));
  }
});

test('contoh kasus Budi di dokumen: 20 → Lisan, 70 → SP 3, 120 → Dikeluarkan', () => {
  const recs = [
    { id: 'a', siswaId: 'b', tanggal: '2026-03-03', poin: 20 },
    { id: 'b', siswaId: 'b', tanggal: '2026-09-05', poin: 50 },
    { id: 'x', siswaId: 'b', tanggal: '2026-10-01', poin: 90, batal: true },
    { id: 'c', siswaId: 'b', tanggal: '2026-11-23', poin: 50 },
  ];
  const s1 = summarize(recs.slice(0, 1), LV);
  assert.equal(s1.level.kode, 'LISAN');
  assert.equal(s1.next.kode, 'SP1');
  assert.equal(s1.toNext, 10);
  const s2 = summarize(recs.slice(0, 3), LV);
  assert.equal(s2.total, 70, 'catatan batal tidak dihitung');
  assert.equal(s2.level.kode, 'SP3');
  const s3 = summarize(recs, LV);
  assert.equal(s3.total, 120);
  assert.equal(s3.level.kode, 'KELUAR');
  assert.deepEqual(s3.crossings.map((c) => `${c.level.kode}@${c.tanggal}`), ['LISAN@2026-03-03', 'SP1@2026-09-05', 'SP2@2026-09-05', 'SP3@2026-09-05', 'PK@2026-11-23', 'KELUAR@2026-11-23']);
  const imp = previewImpact(s2, 20, LV);
  assert.deepEqual([imp.before, imp.after, imp.lvAfter.kode, imp.crossed.map((l) => l.kode).join()], [70, 90, 'PK', 'PK']);
});

test('ringkasan semua siswa & daftar tindak lanjut (status tersimpan + yang tidak berlaku lagi)', () => {
  const siswa = [{ id: 's1', nama: 'A', kelas: '7A' }, { id: 's2', nama: 'B', kelas: '7B' }];
  const recs = [{ id: 1, siswaId: 's1', tanggal: '2026-10-01', poin: 35 }];
  const sums = buildSummaries(siswa, recs, LV);
  assert.equal(sums.get('s2').total, 0);
  assert.equal(sums.get('s2').next.kode, 'LISAN');
  const items = buildTindak(siswa, sums, [
    { id: 's1__SP1', siswaId: 's1', status: 'Selesai', nomorSurat: '01' },
    { id: 's2__SP2', siswaId: 's2', status: 'Dijadwalkan' },
  ]);
  assert.deepEqual(items.map((i) => `${i.id}:${i.status}:${i.berlaku}`), ['s1__LISAN:Belum:true', 's1__SP1:Selesai:true', 's2__SP2:Dijadwalkan:false']);
});

test('periode: semester, tahun ajaran, kustom, dan periode pembanding', () => {
  assert.deepEqual(periodRange('semester', '2026-10-26'), { from: '2026-07-01', to: '2026-12-31', label: 'Semester Ganjil', prev: { from: '2026-01-01', to: '2026-06-30' } });
  assert.equal(periodRange('semester', '2027-02-10').label, 'Semester Genap');
  assert.deepEqual([periodRange('ta', '2027-02-10').from, periodRange('ta', '2027-02-10').to], ['2026-07-01', '2027-06-30']);
  assert.deepEqual(periodRange('7h', '2026-10-26').prev, { from: '2026-10-13', to: '2026-10-19' });
  assert.equal(periodRange('kustom', '2026-10-26', { from: '2026-10-20', to: '2026-10-01' }).from, '2026-10-01');
  assert.equal(periodRange('semua').prev, null);
});

test('tren memilih harian/mingguan/bulanan dan mengisi hari kosong', () => {
  const recs = [{ tanggal: '2026-10-01' }, { tanggal: '2026-10-01' }, { tanggal: '2026-10-05' }];
  const d = trend(recs, '2026-10-01', '2026-10-07', '2026-10-26');
  assert.equal(d.gran, 'hari');
  assert.deepEqual(d.buckets.map((b) => b.value), [2, 0, 0, 0, 1, 0, 0]);
  const w = trend(recs, '2026-08-01', '2026-10-26', '2026-10-26');
  assert.equal(w.gran, 'minggu');
  assert.equal(w.buckets.reduce((t, b) => t + b.value, 0), 3);
  const m = trend(recs, '2025-07-01', '2026-10-26', '2026-10-26');
  assert.equal(m.gran, 'bulan');
  assert.equal(m.buckets.length, 16);
  assert.equal(weekStart('2026-10-25'), '2026-10-19');
});

test('filter, kelompok, total, heatmap, per tanggal', () => {
  const recs = [
    { id: 1, siswaId: 'a', tanggal: '2026-10-26', jam: '07:10', kelas: '7A', kategori: 'A', tingkat: 'Ringan', poin: 2, guru: 'ani', nama: 'Budi', uraian: 'Terlambat' },
    { id: 2, siswaId: 'a', tanggal: '2026-10-26', jam: '10:30', kelas: '7A', kategori: 'D', tingkat: 'Ringan', poin: 20, guru: 'ani', nama: 'Budi', uraian: 'Main HP' },
    { id: 3, siswaId: 'b', tanggal: '2026-10-20', jam: '', kelas: '8A', kategori: 'F', tingkat: 'Berat', poin: 70, guru: 'bk', nama: 'Citra', uraian: 'Berkelahi' },
    { id: 4, siswaId: 'b', tanggal: '2026-10-21', kelas: '8A', kategori: 'A', tingkat: 'Ringan', poin: 2, batal: true, nama: 'Citra', uraian: 'Terlambat' },
  ];
  assert.equal(filterRecords(recs).length, 3);
  assert.equal(filterRecords(recs, { batal: 'semua' }).length, 4);
  assert.equal(filterRecords(recs, { batal: 'batal' }).length, 1);
  assert.equal(filterRecords(recs, { q: 'budi hp' }).length, 1);
  assert.equal(filterRecords(recs, { from: '2026-10-21', kelas: '7A' }).length, 2);
  const t = totals(filterRecords(recs));
  assert.deepEqual([t.n, t.poin, t.siswa, t.berat], [3, 92, 2, 1]);
  const k = countBy(filterRecords(recs), (r) => r.kelas);
  assert.deepEqual(k.map((g) => [g.key, g.n, g.poin, g.nSiswa]), [['7A', 2, 22, 1], ['8A', 1, 70, 1]]);
  const h = heat(filterRecords(recs));
  assert.equal(h.tanpaJam, 1);
  assert.equal(h.grid[0][1], 1, 'Senin 07.xx');
  assert.equal(h.days.length, 6);
  const g = byDate(recs);
  assert.deepEqual(g.map((x) => [x.tanggal, x.list.length, x.poin]), [['2026-10-26', 2, 22], ['2026-10-21', 1, 0], ['2026-10-20', 1, 70]]);
  assert.equal(g[0].list[0].jam, '10:30');
});

test('hak akses: koreksi oleh pencatat dalam batas jam; wali kelas hanya kelasnya', () => {
  const rec = { guru: 'ani', createdAt: '2026-10-26 08:00:00' };
  const t0 = new Date(2026, 9, 26, 9).getTime();
  assert.equal(canEditRecord({ username: 'ani', peran: 'Guru' }, rec, { batasKoreksiJam: '24' }, t0), true);
  assert.equal(canEditRecord({ username: 'ani', peran: 'Guru' }, rec, { batasKoreksiJam: '24' }, t0 + 30 * 3600000), false);
  assert.equal(canEditRecord({ username: 'budi', peran: 'Guru' }, rec, {}, t0), false);
  assert.equal(canEditRecord({ username: 'x', peran: 'Guru BK' }, { ...rec, batal: true }, {}, t0), true);
  assert.equal(canTindak({ peran: 'Wali Kelas', kelasWali: '7A; 7B' }, '7b'), true);
  assert.equal(canTindak({ peran: 'Wali Kelas', kelasWali: '7A' }, '8A'), false);
});

test('utilitas: tempel dari Excel, CSV, nomor WA, pencarian, urutan kelas', () => {
  assert.deepEqual(parseTable('NIS\tNama\tKelas\r\n001\tBudi Santoso\t7A\n\n002\t"Citra, A"\t7B'), [['NIS', 'Nama', 'Kelas'], ['001', 'Budi Santoso', '7A'], ['002', 'Citra, A', '7B']]);
  assert.deepEqual(parseTable('a;b\n"x;""y""";z'), [['a', 'b'], ['x;"y"', 'z']]);
  assert.equal(toCSV([['a', 'b;c']]), '﻿a;"b;c"');
  assert.equal(waNumber('0812-3456-7890'), '6281234567890');
  assert.equal(waNumber('+62 812 3456 7890'), '6281234567890');
  assert.equal(waNumber('123'), '');
  assert.equal(matches('bud 7a', 'Budi Santoso', '7A'), true);
  assert.deepEqual(['9A', '10A', '7B', '7A'].sort(cmpKelas), ['7A', '7B', '9A', '10A']);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('data demo konsisten: setiap catatan merujuk siswa & jenis yang ada, login demo valid', () => {
  const d = makeDemo('2026-10-26');
  const ids = new Set(d.siswa.map((s) => s.id));
  const jenis = new Set(d.jenis.map((j) => j.kode));
  assert.ok(d.siswa.length >= 100);
  assert.ok(d.pelanggaran.length >= 150);
  assert.ok(d.pelanggaran.every((r) => ids.has(r.siswaId) && jenis.has(r.jenisKode) && r.tanggal <= '2026-10-26'));
  const sums = buildSummaries(d.siswa, d.pelanggaran, sortLevels(d.sanksi));
  const levels = new Set([...sums.values()].map((s) => s.level?.kode || 'AMAN'));
  for (const k of ['AMAN', 'LISAN', 'SP1', 'SP2']) assert.ok(levels.has(k), k);
  const admin = d.users.find((u) => u.username === 'admin');
  assert.equal(admin.v, deriveKey('v', d.salt, 'admin', 'demo123', d.iter));
});
