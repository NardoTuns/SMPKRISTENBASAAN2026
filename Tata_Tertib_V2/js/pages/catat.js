// Formulir pencatatan pelanggaran oleh guru (wajib login). Bisa banyak siswa sekaligus (mis. berkelahi
// bersama) dan banyak bentuk pelanggaran dalam satu kejadian. Tersimpan langsung di HP, lalu disinkronkan.
import { h, icon, btn, select, toast, dialog, confirmDialog } from '../ui/dom.js';
import { avatar, emptyState, levelBadge, pageHead, tingkatBadge, waLink, waRecordText } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { printBAP } from '../ui/print.js';
import { S, D, me, saveRows, deviceLabel } from '../store.js';
import { canEditRecord } from '../core/perm.js';
import { previewImpact } from '../core/points.js';
import { addDays, cmpNama, fmtNum, fmtTgl, hm, matches, stamp, uid, ymd, debounce } from '../core/util.js';
import { countBy } from '../core/stats.js';

export const meta = { title: 'Catat Pelanggaran', live: false };

let draft = null;
const blank = () => ({ siswa: [], jenis: [], tanggal: ymd(), jam: hm(), lokasi: '', kronologi: '', saksi: '', pelapor: '', tindakan: '', editId: '' });

export function render(view, route) {
  const u = me();
  if (!u) {
    view.append(emptyState('lock', 'Masuk untuk mencatat', 'Pencatatan pelanggaran hanya untuk guru yang sudah login.', btn('Masuk', () => go('login', { next: location.hash.slice(1) }), { kind: 'primary', ic: 'login' })));
    return;
  }
  const d = D();
  const editId = route.parts[1] === 'ubah' ? route.parts[2] : '';
  if (editId) {
    const r = S.d.pelanggaran.find((x) => x.id === editId);
    if (!r) { view.append(emptyState('clipboard', 'Catatan tidak ditemukan', '')); return; }
    if (!canEditRecord(u, r, S.settings)) { view.append(emptyState('lock', 'Tidak dapat diubah', 'Batas waktu koreksi sudah lewat atau Anda bukan pencatatnya. Hubungi Guru BK/Admin.')); return; }
    if (draft?.editId !== editId) {
      draft = { siswa: [r.siswaId], jenis: [{ kode: String(r.jenisKode), poin: Number(r.poin) }], tanggal: r.tanggal, jam: r.jam || '', lokasi: r.lokasi || '', kronologi: r.kronologi || '', saksi: r.saksi || '', pelapor: r.pelapor || '', tindakan: r.tindakanLangsung || '', editId };
    }
  } else if (!draft || draft.editId) draft = blank();
  if (route.query.siswa && !editId && !draft.siswa.includes(route.query.siswa) && d.siswaMap.has(route.query.siswa)) draft.siswa.push(route.query.siswa);
  if (!d.jenis.length || !S.d.siswa.length) {
    view.append(emptyState('database', 'Data belum lengkap', 'Daftar siswa atau jenis pelanggaran belum ada di HP ini. Sambungkan ke internet untuk sinkron, atau minta Admin melengkapi data.'));
    return;
  }

  const editing = !!draft.editId;
  view.append(pageHead(editing ? 'Ubah Catatan Pelanggaran' : 'Catat Pelanggaran', `Pencatat: ${u.nama} · tersimpan di HP & tersinkron otomatis`));

  const secSiswa = h('section', { class: 'card form-sec' });
  const secJenis = h('section', { class: 'card form-sec' });
  const secDetail = h('section', { class: 'card form-sec' });
  const secImpact = h('section', { class: 'card form-sec impact' });
  const footer = h('div', { class: 'form-footer' });
  view.append(h('div', { class: 'form-grid' }, h('div', { class: 'form-main' }, secSiswa, secJenis, secDetail), h('div', { class: 'form-side' }, secImpact)), footer);

  const refresh = () => { drawImpact(); drawFooter(); };

  // ---------------------------------------------------------------- 1. siswa
  let sq = '', sk = '';
  function drawSiswa() {
    const chosen = draft.siswa.map((id) => d.siswaMap.get(id)).filter(Boolean);
    const results = (sq || sk) ? d.aktif.filter((s) => (!sk || s.kelas === sk) && (!sq || matches(sq, s.nama, s.nis, s.kelas))).sort((a, b) => cmpNama(a.nama, b.nama)).slice(0, sk && !sq ? 60 : 25) : [];
    const inp = h('input', { type: 'search', placeholder: 'Ketik nama atau NIS siswa…', value: sq, 'aria-label': 'Cari siswa', autocomplete: 'off',
      oninput: debounce((e) => { sq = e.target.value; drawSiswa(); const el = secSiswa.querySelector('input[type=search]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 120) });
    secSiswa.replaceChildren(
      secTitle(1, 'Siswa', editing ? 'Siswa yang melanggar' : 'Bisa memilih lebih dari satu siswa'),
      chosen.length ? h('div', { class: 'chosen' }, ...chosen.map((s) => {
        const sum = d.summaries.get(s.id);
        return h('div', { class: 'chosen-item' }, avatar(s.nama, s.jk === 'P' ? 'f' : ''),
          h('div', { class: 'grow min0' }, h('div', { class: 'row-title ellipsis', text: s.nama }), h('div', { class: 'muted small', text: `Kelas ${s.kelas} · ${sum.total} poin` })),
          levelBadge(sum.level, { small: true }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Hapus ${s.nama}`, onclick: () => { draft.siswa = draft.siswa.filter((x) => x !== s.id); drawSiswa(); refresh(); } }, icon('x')));
      })) : null,
      editing && chosen.length ? null : h('div', { class: 'filters tight' },
        h('label', { class: 'fsel search grow' }, icon('search'), inp),
        h('label', { class: 'fsel' }, icon('school'), select([{ value: '', label: 'Pilih per kelas' }, ...d.kelasList.map((k) => ({ value: k, label: `Kelas ${k}` }))], sk, (v) => { sk = v; drawSiswa(); }, { 'aria-label': 'Tampilkan kelas' }))),
      results.length ? h('div', { class: 'pick-list' }, ...results.map((s) => {
        const on = draft.siswa.includes(s.id);
        return h('button', { class: 'pick' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => {
          if (on) draft.siswa = draft.siswa.filter((x) => x !== s.id);
          else if (editing) draft.siswa = [s.id];
          else draft.siswa.push(s.id);
          drawSiswa(); refresh();
        } }, h('span', { class: 'check' }, on ? icon('check') : null), h('span', { class: 'grow ellipsis', text: s.nama }), h('span', { class: 'muted small', text: `${s.kelas} · ${d.summaries.get(s.id).total} poin` }));
      })) : (sq ? h('p', { class: 'muted small', text: 'Tidak ada siswa aktif yang cocok.' }) : null));
  }

  // ---------------------------------------------------------------- 2. jenis pelanggaran
  let jq = '', jk = '';
  const sering = countBy(S.d.pelanggaran.filter((r) => !r.batal && r.tanggal >= addDays(ymd(), -90)), (r) => String(r.jenisKode)).slice(0, 6).map((g) => d.jenisMap.get(g.key)).filter((j) => j && j.aktif !== false);
  function toggleJenis(j) {
    const i = draft.jenis.findIndex((x) => x.kode === String(j.kode));
    if (i >= 0) draft.jenis.splice(i, 1);
    else if (editing) draft.jenis = [{ kode: String(j.kode), poin: j.zt ? 100 : Number(j.poin) }];
    else draft.jenis.push({ kode: String(j.kode), poin: j.zt ? 100 : Number(j.poin) });
    drawJenis(); refresh();
  }
  function drawJenis() {
    const active = d.jenis.filter((j) => j.aktif !== false);
    const list = active.filter((j) => (!jk || j.kategori === jk) && (!jq || matches(jq, j.uraian, j.kode)));
    const chosen = draft.jenis.map((x) => ({ x, j: d.jenisMap.get(x.kode) })).filter((c) => c.j);
    const inp = h('input', { type: 'search', placeholder: 'Cari bentuk pelanggaran… (mis. terlambat, HP, rokok)', value: jq, 'aria-label': 'Cari pelanggaran', autocomplete: 'off',
      oninput: debounce((e) => { jq = e.target.value; drawJenis(); const el = secJenis.querySelector('input[type=search]'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 120) });
    secJenis.replaceChildren(
      secTitle(2, 'Bentuk pelanggaran', editing ? 'Pilih satu' : 'Pilih satu atau lebih untuk kejadian yang sama'),
      chosen.length ? h('div', { class: 'chosen' }, ...chosen.map(({ x, j }) => h('div', { class: 'chosen-item jenis' },
        h('span', { class: 'rule-no', text: j.kode }),
        h('div', { class: 'grow min0' }, h('div', { class: 'small', text: j.uraian }), h('div', { class: 'row gap-sm' }, tingkatBadge(j.tingkat), j.zt ? h('span', { class: 'badge sm st-dark', text: 'Zero Tolerance' }) : null)),
        j.poinMaks && !j.zt ? h('label', { class: 'poin-input' }, h('span', { class: 'muted small', text: `Poin (${j.poin}–${j.poinMaks})` }),
          h('input', { type: 'number', min: j.poin, max: j.poinMaks, value: x.poin, inputmode: 'numeric', onchange: (e) => { x.poin = Math.min(Number(j.poinMaks), Math.max(Number(j.poin), Number(e.target.value) || Number(j.poin))); e.target.value = x.poin; refresh(); } }))
          : h('strong', { class: 'rule-pts', text: `+${x.poin}` }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Hapus pilihan', onclick: () => toggleJenis(j) }, icon('x'))))) : null,
      !chosen.length && sering.length && !jq && !jk ? h('div', null, h('p', { class: 'muted small', text: 'Sering dicatat (90 hari terakhir):' }),
        h('div', { class: 'chips' }, ...sering.map((j) => h('button', { class: 'chip', type: 'button', onclick: () => toggleJenis(j) }, h('span', { text: `${j.kode}. ${j.uraian.slice(0, 42)}${j.uraian.length > 42 ? '…' : ''}` }), h('strong', { text: `+${j.zt ? 100 : j.poin}` }))))) : null,
      h('div', { class: 'filters tight' }, h('label', { class: 'fsel search grow' }, icon('search'), inp)),
      h('div', { class: 'chips scroll' }, h('button', { class: 'chip' + (jk ? '' : ' on'), type: 'button', onclick: () => { jk = ''; drawJenis(); } }, h('span', { text: 'Semua' })),
        ...d.kategori.filter((k) => k.aktif !== false).map((k) => h('button', { class: 'chip' + (jk === k.kode ? ' on' : ''), type: 'button', title: k.nama, onclick: () => { jk = jk === k.kode ? '' : k.kode; drawJenis(); } }, h('strong', { text: k.kode }), h('span', { text: k.nama.split(/[,&(]/)[0].trim() })))),
      h('div', { class: 'pick-list tall' }, ...(list.length ? list.map((j) => {
        const on = draft.jenis.some((x) => x.kode === String(j.kode));
        return h('button', { class: 'pick jenis' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => toggleJenis(j) },
          h('span', { class: 'check' }, on ? icon('check') : null),
          h('span', { class: 'rule-no', text: j.kode }),
          h('span', { class: 'grow', text: j.uraian }),
          h('span', { class: 'pick-pts' }, h('strong', { text: j.zt ? '100' : `${j.poin}${j.poinMaks ? '–' + j.poinMaks : ''}` }), h('span', { class: `dot st-${{ Ringan: 'warn', Sedang: 'serious', Berat: 'critical' }[j.tingkat]}`, title: j.tingkat })));
      }) : [h('p', { class: 'muted small', text: 'Tidak ada bentuk pelanggaran yang cocok.' })])));
  }

  // ---------------------------------------------------------------- 3. detail kejadian
  function drawDetail() {
    const lokasiOpts = String(S.settings.lokasi || '').split(',').map((x) => x.trim()).filter(Boolean);
    const tindakanOpts = String(S.settings.tindakanCepat || '').split(',').map((x) => x.trim()).filter(Boolean);
    const bind = (key) => (e) => { draft[key] = e.target.value; if (key === 'tanggal') refresh(); };
    const tindakanInput = h('textarea', { rows: 2, placeholder: 'Mis. teguran lisan, membersihkan kelas…', oninput: bind('tindakan') });
    tindakanInput.value = draft.tindakan;
    const kron = h('textarea', { rows: 3, placeholder: 'Ceritakan singkat apa yang terjadi (untuk BAP)…', oninput: bind('kronologi') });
    kron.value = draft.kronologi;
    secDetail.replaceChildren(
      secTitle(3, 'Detail kejadian', 'Dipakai untuk Berita Acara Pemeriksaan (BAP)'),
      h('div', { class: 'form-row' },
        field('Tanggal', h('input', { type: 'date', value: draft.tanggal, max: ymd(), required: true, onchange: bind('tanggal') })),
        field('Jam', h('input', { type: 'time', value: draft.jam, onchange: bind('jam') }))),
      field('Lokasi', h('input', { type: 'text', list: 'dl-lokasi', value: draft.lokasi, placeholder: 'Pilih atau ketik lokasi', oninput: bind('lokasi') }), h('datalist', { id: 'dl-lokasi' }, ...lokasiOpts.map((x) => h('option', { value: x })))),
      field('Kronologi', kron),
      h('div', { class: 'form-row' },
        field('Saksi', h('input', { type: 'text', value: draft.saksi, placeholder: 'Nama saksi (guru/staf/siswa)', oninput: bind('saksi') })),
        field('Siswa pelapor', h('input', { type: 'text', value: draft.pelapor, placeholder: 'Bila ada', list: 'dl-siswa', oninput: bind('pelapor') }))),
      h('datalist', { id: 'dl-siswa' }, ...d.aktif.slice(0, 600).map((s) => h('option', { value: s.nama }))),
      field('Tindakan langsung', tindakanInput),
      h('div', { class: 'chips' }, ...tindakanOpts.map((t) => h('button', { class: 'chip', type: 'button', onclick: () => {
        const cur = tindakanInput.value.trim();
        if (!cur.toLowerCase().includes(t.toLowerCase())) { tindakanInput.value = cur ? `${cur}; ${t}` : t; draft.tindakan = tindakanInput.value; }
      } }, icon('plus'), h('span', { text: t })))));
  }

  // ---------------------------------------------------------------- 4. dampak
  function drawImpact() {
    const add = draft.jenis.reduce((t, x) => t + (Number(x.poin) || 0), 0);
    const chosen = draft.siswa.map((id) => d.siswaMap.get(id)).filter(Boolean);
    const editRec = editing ? S.d.pelanggaran.find((x) => x.id === draft.editId) : null;
    const items = chosen.map((s) => {
      const sum = d.summaries.get(s.id);
      const base = editRec && editRec.siswaId === s.id && !editRec.batal ? { ...sum, total: sum.total - Number(editRec.poin || 0) } : sum;
      const imp = previewImpact(base, add, d.levels);
      const dup = !editing && S.d.pelanggaran.filter((r) => !r.batal && r.siswaId === s.id && r.tanggal === draft.tanggal && draft.jenis.some((x) => x.kode === String(r.jenisKode)));
      return { s, imp, dup };
    });
    secImpact.replaceChildren(
      secTitle(4, 'Dampak pada akumulasi poin', 'Periksa sebelum menyimpan'),
      !items.length || !draft.jenis.length ? h('p', { class: 'muted small', text: 'Pilih siswa dan bentuk pelanggaran untuk melihat pratinjau.' }) :
        h('div', { class: 'stack-sm' }, ...items.map(({ s, imp, dup }) => h('div', { class: 'impact-item' },
          h('div', { class: 'row gap-sm' }, h('strong', { class: 'grow ellipsis', text: s.nama }), h('span', { class: 'muted small', text: s.kelas })),
          h('div', { class: 'impact-pts' }, h('span', { text: fmtNum(imp.before) }), icon('right'), h('strong', { text: fmtNum(imp.after) }), h('span', { class: 'muted small', text: 'poin' }), h('span', { class: 'grow' }), levelBadge(imp.lvAfter, { small: true })),
          imp.crossed.length ? (() => {
            const top = imp.crossed[imp.crossed.length - 1];
            const skipped = imp.crossed.slice(0, -1).map((l) => l.label);
            return h('div', { class: 'notice warn sm' }, icon('alert'), h('div', null, h('strong', { text: `Mencapai tahap: ${top.label}` }),
              h('p', { class: 'small', text: `${top.tindakan} (${top.pj})` }),
              skipped.length ? h('p', { class: 'small', text: `Sekaligus melewati: ${skipped.join(', ')}.` }) : null));
          })() : null,
          imp.after > d.batasSidang && imp.before <= d.batasSidang ? h('div', { class: 'notice critical sm' }, icon('gavel'), h('p', { class: 'small', text: `Akumulasi melewati ${d.batasSidang} poin — keputusan selanjutnya melalui Sidang Dewan Guru.` })) : null,
          dup && dup.length ? h('div', { class: 'notice info sm' }, icon('info'), h('p', { class: 'small', text: `Perhatian: pelanggaran yang sama sudah tercatat untuk siswa ini pada ${fmtTgl(draft.tanggal, { short: true })} (${dup.map((r) => r.guruNama || r.guru).join(', ')}). Pastikan tidak tercatat ganda.` })) : null))),
      h('p', { class: 'muted small', text: 'Sesuai tata tertib, poin yang sah tidak dapat dikurangi. Koreksi salah input hanya dalam batas waktu koreksi.' }));
  }

  function drawFooter() {
    const n = draft.siswa.length * draft.jenis.length;
    const add = draft.jenis.reduce((t, x) => t + (Number(x.poin) || 0), 0);
    footer.replaceChildren(
      h('div', { class: 'grow min0' }, h('strong', { text: n ? `${n} catatan` : 'Belum lengkap' }), h('span', { class: 'muted small', text: n ? ` · +${add} poin per siswa` : ' · pilih siswa & pelanggaran' })),
      btn('Batal', async () => { if (n && !(await confirmDialog('Batalkan pencatatan?', 'Isian formulir akan dihapus.', 'Ya, batalkan'))) return; draft = null; history.length > 1 ? history.back() : go(''); }, { kind: 'text' }),
      btn(editing ? 'Simpan perubahan' : 'Simpan', () => save(), { kind: 'primary', ic: 'check', disabled: !n }));
  }

  async function save() {
    if (!draft.siswa.length || !draft.jenis.length) return;
    if (!draft.tanggal || draft.tanggal > ymd()) { toast('Tanggal tidak valid (tidak boleh di masa depan).'); return; }
    const n = draft.siswa.length * draft.jenis.length;
    if (n > 1 && !(await confirmDialog('Simpan catatan?', `${n} catatan pelanggaran akan dibuat (${draft.siswa.length} siswa × ${draft.jenis.length} pelanggaran).`, 'Simpan'))) return;
    const rows = [];
    const now = stamp();
    for (const id of draft.siswa) {
      const s = d.siswaMap.get(id);
      for (const x of draft.jenis) {
        const j = d.jenisMap.get(x.kode);
        const old = editing ? S.d.pelanggaran.find((r) => r.id === draft.editId) : null;
        rows.push({
          ...(old || {}),
          id: old ? old.id : uid('p'), tanggal: draft.tanggal, jam: draft.jam, siswaId: s.id, nis: s.nis || '', nama: s.nama, kelas: s.kelas,
          jenisKode: String(j.kode), uraian: j.uraian, kategori: j.kategori, tingkat: j.tingkat, poin: j.zt ? 100 : Number(x.poin),
          lokasi: draft.lokasi.trim(), kronologi: draft.kronologi.trim(), saksi: draft.saksi.trim(), pelapor: draft.pelapor.trim(), tindakanLangsung: draft.tindakan.trim(),
          guru: old ? old.guru : u.username, guruNama: old ? old.guruNama : u.nama, createdAt: old ? old.createdAt : now,
          batal: false, alasanBatal: '', device: deviceLabel(),
        });
      }
    }
    const saved = await saveRows('pelanggaran', rows);
    const wasEdit = editing;
    draft = null;
    toast(wasEdit ? 'Perubahan tersimpan.' : `${saved.length} catatan tersimpan${S.online ? '' : ' di HP (akan dikirim saat online)'}.`);
    afterSave(saved, wasEdit);
  }

  drawSiswa(); drawJenis(); drawDetail(); refresh();
}

function afterSave(saved, wasEdit) {
  const d = D();
  const one = saved.length === 1 ? saved[0] : null;
  const siswa = one ? d.siswaMap.get(one.siswaId) : null;
  const wa = one && siswa ? waLink(siswa, waRecordText(one, siswa, d.summaries.get(siswa.id))) : '';
  dialog(wasEdit ? 'Perubahan tersimpan' : 'Pelanggaran tercatat', (finish) => h('div', { class: 'stack-sm' },
    h('p', { text: one ? `${one.nama} (${one.kelas}) · ${one.jenisKode}. ${one.uraian} · +${one.poin} poin` : `${saved.length} catatan untuk ${new Set(saved.map((r) => r.siswaId)).size} siswa.` }),
    h('div', { class: 'stack-sm' },
      one ? btn('Cetak BAP', () => printBAP(one), { ic: 'printer' }) : null,
      wa ? h('a', { class: 'btn tonal', href: wa, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'Kabari orang tua via WhatsApp' })) : null,
      one ? btn('Lihat riwayat siswa', () => finish('siswa'), { ic: 'user' }) : null,
      !wasEdit ? btn('Catat lagi', () => finish('again'), { ic: 'plus', kind: 'primary' }) : null)),
  [{ label: 'Selesai', value: 'done' }]).then((v) => {
    if (v === 'again') go('catat');
    else if (v === 'siswa') go('siswa', one.siswaId);
    else if (location.hash.startsWith('#/catat')) go(wasEdit && one ? 'riwayat' : '');
  });
}

const secTitle = (n, title, sub) => h('div', { class: 'sec-title' }, h('span', { class: 'sec-n', text: String(n) }), h('div', null, h('h2', { text: title }), sub ? h('p', { class: 'muted small', text: sub }) : null));
const field = (label, control, extra) => h('label', { class: 'field' }, h('span', { class: 'lbl', text: label }), control, extra || null);
