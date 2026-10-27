// Formulir pencatatan pelanggaran (wajib login), dibuat bertahap agar ringkas di HP:
//   1. Siswa (boleh lebih dari satu) → 2. Pelanggaran (poin bisa disesuaikan) → 3. Detail & simpan.
// Poin di dokumen tata tertib adalah perkiraan; guru dapat menambah/mengurangi saat mencatat.
// Catatan tersimpan langsung di HP lalu disinkronkan.
import { h, icon, btn, toast, dialog, confirmDialog } from '../ui/dom.js';
import { avatar, emptyState, levelBadge, tingkatBadge, waLink, waRecordText, TINGKAT_WARNA } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { printBAP } from '../ui/print.js';
import { S, D, me, saveRows, deviceLabel } from '../store.js';
import { canEditRecord } from '../core/perm.js';
import { previewImpact } from '../core/points.js';
import { countBy } from '../core/stats.js';
import { addDays, cmpNama, fmtNum, fmtTgl, hm, matches, stamp, uid, ymd, debounce } from '../core/util.js';

export const meta = { title: 'Catat Pelanggaran', live: false };

const POIN_MAX = 100;
let draft = null;
const blank = () => ({ step: 1, siswa: [], items: [], tanggal: ymd(), jam: hm(), lokasi: '', tindakan: '', kronologi: '', saksi: '', pelapor: '', more: false, editId: '' });
const defaultPoin = (j) => (j.zt ? 100 : Number(j.poin) || 0);
const clampPoin = (v) => Math.max(0, Math.min(POIN_MAX, Math.round(Number(v) || 0)));

export function render(view, route) {
  const u = me();
  if (!u) {
    view.append(emptyState('lock', 'Masuk untuk mencatat', 'Pencatatan pelanggaran hanya untuk guru yang sudah login.', btn('Masuk', () => go('login', { next: 'catat' }), { kind: 'primary', ic: 'login' })));
    return;
  }
  const d = D();
  if (!d.jenis.length || !S.d.siswa.length) {
    view.append(emptyState('database', 'Data belum lengkap', 'Daftar siswa atau jenis pelanggaran belum ada di HP ini. Sambungkan ke internet untuk sinkron, atau minta Admin melengkapi data.'));
    return;
  }
  const editId = route.parts[1] === 'ubah' ? route.parts[2] : '';
  if (editId) {
    const r = S.d.pelanggaran.find((x) => x.id === editId);
    if (!r) { view.append(emptyState('clipboard', 'Catatan tidak ditemukan', '')); return; }
    if (!canEditRecord(u, r, S.settings)) { view.append(emptyState('lock', 'Tidak dapat diubah', 'Batas waktu koreksi sudah lewat atau Anda bukan pencatatnya. Hubungi Guru BK/Admin.')); return; }
    if (draft?.editId !== editId) {
      draft = { ...blank(), step: 3, siswa: [r.siswaId], items: [{ kode: String(r.jenisKode), poin: Number(r.poin) }], tanggal: r.tanggal, jam: r.jam || '', lokasi: r.lokasi || '', tindakan: r.tindakanLangsung || '', kronologi: r.kronologi || '', saksi: r.saksi || '', pelapor: r.pelapor || '', more: !!(r.kronologi || r.saksi || r.pelapor), editId };
    }
  } else if (!draft || draft.editId) draft = blank();
  const pre = route.query.siswa;
  if (pre && !editId && d.siswaMap.has(pre) && !draft.siswa.includes(pre)) { draft.siswa.push(pre); if (draft.step === 1) draft.step = 2; }

  const editing = !!draft.editId;
  const head = h('div', { class: 'wiz-head' });
  const steps = h('div', { class: 'wiz-steps', role: 'tablist', 'aria-label': 'Langkah pencatatan' });
  const body = h('div', { class: 'wiz-body' });
  const footer = h('div', { class: 'form-footer wiz-footer' });
  view.append(head, steps, body, footer);
  head.append(h('h1', { text: editing ? 'Ubah Catatan' : 'Catat Pelanggaran' }), h('p', { class: 'muted small', text: `Pencatat: ${u.nama}` }));

  const canGo = (n) => n === 1 || (n === 2 && draft.siswa.length > 0) || (n === 3 && draft.siswa.length > 0 && draft.items.length > 0);
  const goStep = (n) => { if (!canGo(n)) return; draft.step = n; draw(); window.scrollTo(0, 0); };

  function draw() {
    const labels = ['Siswa', 'Pelanggaran', 'Simpan'];
    steps.replaceChildren(...labels.map((l, i) => {
      const n = i + 1;
      const done = n < draft.step && canGo(n + 1);
      return h('button', { type: 'button', role: 'tab', class: `wiz-step${draft.step === n ? ' on' : ''}${done ? ' done' : ''}`, 'aria-selected': String(draft.step === n), disabled: !canGo(n), onclick: () => goStep(n) },
        h('span', { class: 'n' }, done ? icon('check') : String(n)), h('span', { text: l }));
    }));
    if (draft.step === 1) stepSiswa(); else if (draft.step === 2) stepJenis(); else stepSimpan();
  }

  // ---------------------------------------------------------------- 1. siswa
  let sq = '', sk = '';
  function stepSiswa() {
    const chosen = draft.siswa.map((id) => d.siswaMap.get(id)).filter(Boolean);
    const toggle = (s) => {
      const on = draft.siswa.includes(s.id);
      if (on) draft.siswa = draft.siswa.filter((x) => x !== s.id);
      else if (editing) draft.siswa = [s.id];
      else draft.siswa.push(s.id);
      drawList(); drawChosen(); drawFooter();
    };
    const chosenBox = h('div');
    const listBox = h('div');
    const drawChosen = () => chosenBox.replaceChildren(draft.siswa.length ? h('div', { class: 'chips' }, ...draft.siswa.map((id) => d.siswaMap.get(id)).filter(Boolean).map((s) =>
      h('button', { class: 'chip on', type: 'button', 'aria-label': `Hapus ${s.nama}`, onclick: () => toggle(s) }, h('span', { text: `${s.nama} · ${s.kelas}` }), icon('x')))) : null);
    const recent = () => {
      const seen = new Set();
      return S.d.pelanggaran.filter((r) => r.guru === u.username).sort((a, b) => ((b.createdAt || '') > (a.createdAt || '') ? 1 : -1))
        .map((r) => d.siswaMap.get(r.siswaId)).filter((s) => s && (s.status || 'Aktif') === 'Aktif' && !seen.has(s.id) && seen.add(s.id)).slice(0, 8);
    };
    const drawList = () => {
      const searching = sq || sk;
      const list = searching ? d.aktif.filter((s) => (!sk || s.kelas === sk) && (!sq || matches(sq, s.nama, s.nis, s.kelas))).sort((a, b) => cmpNama(a.nama, b.nama)).slice(0, sk && !sq ? 80 : 40) : recent();
      listBox.replaceChildren(
        !searching ? h('p', { class: 'muted small list-label', text: list.length ? 'Terakhir Anda catat:' : 'Ketik nama/NIS siswa, atau pilih kelas di atas.' }) : null,
        list.length ? h('div', { class: 'pick-list big' }, ...list.map((s) => {
          const on = draft.siswa.includes(s.id);
          const sum = d.summaries.get(s.id);
          return h('button', { class: 'pick' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => toggle(s) },
            avatar(s.nama, s.jk === 'P' ? 'f' : ''),
            h('span', { class: 'grow min0' }, h('span', { class: 'block ellipsis pick-name', text: s.nama }), h('span', { class: 'muted small', text: `Kelas ${s.kelas} · ${sum.total} poin` })),
            sum.level ? levelBadge(sum.level, { small: true }) : null,
            h('span', { class: 'check round' }, on ? icon('check') : null));
        })) : searching ? h('p', { class: 'muted small', text: 'Tidak ada siswa aktif yang cocok.' }) : null);
    };
    const inp = h('input', { type: 'search', placeholder: 'Cari nama atau NIS siswa…', value: sq, 'aria-label': 'Cari siswa', autocomplete: 'off', enterkeyhint: 'search',
      oninput: debounce((e) => { sq = e.target.value; drawList(); }, 120) });
    body.replaceChildren(
      h('label', { class: 'fsel search big block' }, icon('search'), inp),
      h('div', { class: 'chips scroll' },
        h('button', { class: 'chip' + (sk ? '' : ' on'), type: 'button', onclick: () => { sk = ''; stepSiswa(); } }, h('span', { text: 'Semua kelas' })),
        ...d.kelasList.map((k) => h('button', { class: 'chip' + (sk === k ? ' on' : ''), type: 'button', onclick: () => { sk = sk === k ? '' : k; stepSiswa(); } }, h('span', { text: k })))),
      chosenBox, listBox);
    drawChosen(); drawList(); drawFooter();
  }

  // ---------------------------------------------------------------- 2. pelanggaran
  let jq = '', jk = '';
  const sering = countBy(S.d.pelanggaran.filter((r) => !r.batal && r.tanggal >= addDays(ymd(), -90)), (r) => String(r.jenisKode)).slice(0, 6)
    .map((g) => d.jenisMap.get(g.key)).filter((j) => j && j.aktif !== false);
  function stepJenis() {
    const selBox = h('div', { class: 'stack-sm' });
    const listBox = h('div');
    const toggle = (j) => {
      const i = draft.items.findIndex((x) => x.kode === String(j.kode));
      if (i >= 0) draft.items.splice(i, 1);
      else if (editing) draft.items = [{ kode: String(j.kode), poin: defaultPoin(j) }];
      else draft.items.push({ kode: String(j.kode), poin: defaultPoin(j) });
      drawSel(); drawList(); drawFooter();
    };
    const drawSel = () => selBox.replaceChildren(...draft.items.map((x) => {
      const j = d.jenisMap.get(x.kode);
      if (!j) return null;
      const def = defaultPoin(j);
      const val = h('input', { type: 'number', inputmode: 'numeric', min: 0, max: POIN_MAX, value: x.poin, 'aria-label': `Poin untuk ${j.uraian}`,
        oninput: (e) => { x.poin = clampPoin(e.target.value); note.textContent = noteText(); drawFooter(); },
        onblur: (e) => { e.target.value = x.poin; } });
      const step = (dv) => { x.poin = clampPoin(x.poin + dv); val.value = x.poin; note.textContent = noteText(); drawFooter(); };
      const noteText = () => `Poin bawaan ${def}${j.poinMaks && !j.zt ? ` (rentang ${j.poin}–${j.poinMaks})` : ''}${x.poin !== def ? ` · disesuaikan ${x.poin > def ? '+' : ''}${x.poin - def}` : ''}`;
      const note = h('span', { class: 'muted small', text: noteText() });
      return h('div', { class: 'sel-card' },
        h('div', { class: 'row gap-sm' }, h('span', { class: 'rule-no', text: j.kode }), h('span', { class: 'grow sel-title', text: j.uraian }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Hapus pilihan', onclick: () => toggle(j) }, icon('x'))),
        h('div', { class: 'row gap-sm wrap' }, tingkatBadge(j.tingkat), j.zt ? h('span', { class: 'badge sm st-dark', text: 'Zero Tolerance' }) : null, note),
        h('div', { class: 'stepper' },
          h('button', { type: 'button', 'aria-label': 'Kurangi poin', onclick: () => step(-1) }, h('span', { text: '−' })),
          val,
          h('button', { type: 'button', 'aria-label': 'Tambah poin', onclick: () => step(1) }, h('span', { text: '+' })),
          h('span', { class: 'muted small', text: 'poin' }),
          x.poin !== def ? h('button', { class: 'btn text small', type: 'button', onclick: () => { x.poin = def; drawSel(); drawFooter(); } }, h('span', { text: 'Kembalikan' })) : null));
    }));
    const drawList = () => {
      const list = d.jenis.filter((j) => j.aktif !== false && (!jk || j.kategori === jk) && (!jq || matches(jq, j.uraian, j.kode)));
      listBox.replaceChildren(
        !jq && !jk && sering.length ? h('div', null, h('p', { class: 'muted small list-label', text: 'Sering dicatat:' }),
          h('div', { class: 'chips' }, ...sering.map((j) => h('button', { class: 'chip' + (draft.items.some((x) => x.kode === String(j.kode)) ? ' on' : ''), type: 'button', onclick: () => toggle(j) },
            h('span', { text: `${j.uraian.slice(0, 34)}${j.uraian.length > 34 ? '…' : ''}` }), h('strong', { text: `+${defaultPoin(j)}` }))))) : null,
        h('div', { class: 'pick-list big' }, ...(list.length ? list.map((j) => {
          const on = draft.items.some((x) => x.kode === String(j.kode));
          return h('button', { class: 'pick jenis' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on), onclick: () => toggle(j) },
            h('span', { class: 'rule-no', text: j.kode }),
            h('span', { class: 'grow', text: j.uraian }),
            h('span', { class: 'pick-pts' }, h('strong', { text: String(defaultPoin(j)) }), h('span', { class: `dot st-${TINGKAT_WARNA[j.tingkat] || 'warn'}`, title: j.tingkat })),
            h('span', { class: 'check round' }, on ? icon('check') : null));
        }) : [h('p', { class: 'muted small pad', text: 'Tidak ada bentuk pelanggaran yang cocok.' })])));
    };
    const inp = h('input', { type: 'search', placeholder: 'Cari: terlambat, HP, rokok, seragam…', value: jq, 'aria-label': 'Cari pelanggaran', autocomplete: 'off', enterkeyhint: 'search',
      oninput: debounce((e) => { jq = e.target.value; drawList(); }, 120) });
    body.replaceChildren(
      selBox,
      h('label', { class: 'fsel search big block' }, icon('search'), inp),
      h('div', { class: 'chips scroll' },
        h('button', { class: 'chip' + (jk ? '' : ' on'), type: 'button', onclick: () => { jk = ''; stepJenis(); } }, h('span', { text: 'Semua' })),
        ...d.kategori.filter((k) => k.aktif !== false).map((k) => h('button', { class: 'chip' + (jk === k.kode ? ' on' : ''), type: 'button', title: k.nama, onclick: () => { jk = jk === k.kode ? '' : k.kode; stepJenis(); } },
          h('strong', { text: k.kode }), h('span', { text: k.nama.split(/[,&(]/)[0].trim() })))),
      listBox);
    drawSel(); drawList(); drawFooter();
  }

  // ---------------------------------------------------------------- 3. detail & simpan
  function stepSimpan() {
    const used = (field) => [...new Set(S.d.pelanggaran.filter((r) => r.guru === u.username && r[field]).map((r) => String(r[field]).trim()))].slice(0, 12);
    const opts = (setting, field) => [...new Set([...String(S.settings[setting] || '').split(',').map((x) => x.trim()).filter(Boolean), ...used(field)])];
    const bind = (key, after) => (e) => { draft[key] = e.target.value; after?.(); };
    const chosen = draft.siswa.map((id) => d.siswaMap.get(id)).filter(Boolean);
    const items = draft.items.map((x) => ({ x, j: d.jenisMap.get(x.kode) })).filter((c) => c.j);
    const impactBox = h('div', { class: 'stack-sm' });
    const kron = h('textarea', { rows: 3, placeholder: 'Ceritakan singkat kejadiannya (untuk BAP)…', oninput: bind('kronologi') });
    kron.value = draft.kronologi;
    const moreBox = h('div', { class: 'stack-sm', hidden: !draft.more },
      field('Kronologi', kron),
      field('Saksi', h('input', { type: 'text', value: draft.saksi, placeholder: 'Nama saksi (guru/staf/siswa)', oninput: bind('saksi') })),
      field('Siswa pelapor', h('input', { type: 'text', value: draft.pelapor, placeholder: 'Bila ada', list: 'dl-siswa', oninput: bind('pelapor') })),
      h('datalist', { id: 'dl-siswa' }, ...d.aktif.slice(0, 600).map((s) => h('option', { value: s.nama }))));
    const moreBtn = h('button', { class: 'btn text small more-btn', type: 'button', 'aria-expanded': String(draft.more), onclick: () => {
      draft.more = !draft.more; moreBox.hidden = !draft.more; moreBtn.setAttribute('aria-expanded', String(draft.more));
      moreBtn.replaceChildren(icon(draft.more ? 'down' : 'plus'), h('span', { text: draft.more ? 'Sembunyikan keterangan tambahan' : 'Kronologi, saksi & pelapor (opsional)' }));
    } }, icon(draft.more ? 'down' : 'plus'), h('span', { text: draft.more ? 'Sembunyikan keterangan tambahan' : 'Kronologi, saksi & pelapor (opsional)' }));

    body.replaceChildren(
      h('section', { class: 'card summary-card' },
        h('div', { class: 'sum-row' }, h('span', { class: 'sum-ic' }, icon('users')),
          h('div', { class: 'grow min0' }, h('div', { class: 'muted small', text: `${chosen.length} siswa` }), h('div', { class: 'sum-text', text: chosen.map((s) => `${s.nama} (${s.kelas})`).join(', ') })),
          h('button', { class: 'btn text small', type: 'button', onclick: () => goStep(1) }, h('span', { text: 'Ubah' }))),
        h('div', { class: 'sum-row' }, h('span', { class: 'sum-ic' }, icon('clipboard')),
          h('div', { class: 'grow min0' }, ...items.map(({ x, j }) => h('div', { class: 'sum-text' }, h('strong', { text: `+${x.poin} ` }), `${j.kode}. ${j.uraian}`))),
          h('button', { class: 'btn text small', type: 'button', onclick: () => goStep(2) }, h('span', { text: 'Ubah' })))),
      h('section', { class: 'card stack-sm' },
        h('div', { class: 'form-row two' },
          field('Tanggal', h('input', { type: 'date', value: draft.tanggal, max: ymd(), required: true, onchange: bind('tanggal', drawImpact) })),
          field('Jam', h('input', { type: 'time', value: draft.jam, onchange: bind('jam') }))),
        field('Lokasi', h('input', { type: 'text', list: 'dl-lokasi', value: draft.lokasi, placeholder: 'Ketik atau pilih dari saran', autocomplete: 'off', oninput: bind('lokasi') }),
          h('datalist', { id: 'dl-lokasi' }, ...opts('lokasi', 'lokasi').map((x) => h('option', { value: x })))),
        field('Tindakan langsung', h('input', { type: 'text', list: 'dl-tindakan', value: draft.tindakan, placeholder: 'Ketik atau pilih dari saran (mis. teguran lisan)', autocomplete: 'off', oninput: bind('tindakan') }),
          h('datalist', { id: 'dl-tindakan' }, ...opts('tindakanCepat', 'tindakanLangsung').map((x) => h('option', { value: x })))),
        moreBtn, moreBox),
      h('section', { class: 'card stack-sm' }, h('h3', { text: 'Dampak pada poin siswa' }), impactBox));
    drawImpact();
    drawFooter();

    function drawImpact() {
      const add = draft.items.reduce((t, x) => t + (Number(x.poin) || 0), 0);
      const editRec = editing ? S.d.pelanggaran.find((x) => x.id === draft.editId) : null;
      impactBox.replaceChildren(...chosen.map((s) => {
        const sum = d.summaries.get(s.id);
        const base = editRec && editRec.siswaId === s.id && !editRec.batal ? { ...sum, total: sum.total - Number(editRec.poin || 0) } : sum;
        const imp = previewImpact(base, add, d.levels);
        const dup = !editing && S.d.pelanggaran.filter((r) => !r.batal && r.siswaId === s.id && r.tanggal === draft.tanggal && draft.items.some((x) => x.kode === String(r.jenisKode)));
        const top = imp.crossed[imp.crossed.length - 1];
        return h('div', { class: 'impact-item' },
          h('div', { class: 'row gap-sm' }, h('strong', { class: 'grow ellipsis', text: s.nama }),
            h('span', { class: 'impact-pts' }, h('span', { text: fmtNum(imp.before) }), icon('right'), h('strong', { text: fmtNum(imp.after) })), levelBadge(imp.lvAfter, { small: true })),
          top ? h('div', { class: 'notice warn sm' }, icon('alert'), h('div', null, h('strong', { text: `Mencapai tahap ${top.label}` }), h('p', { class: 'small', text: `${top.tindakan} (${top.pj})` }))) : null,
          imp.after > d.batasSidang && imp.before <= d.batasSidang ? h('div', { class: 'notice critical sm' }, icon('gavel'), h('p', { class: 'small', text: `Melewati ${d.batasSidang} poin — keputusan berikutnya melalui Sidang Dewan Guru.` })) : null,
          dup && dup.length ? h('div', { class: 'notice info sm' }, icon('info'), h('p', { class: 'small', text: `Pelanggaran yang sama sudah tercatat untuk siswa ini pada ${fmtTgl(draft.tanggal, { short: true })} (${dup.map((r) => r.guruNama || r.guru).join(', ')}). Pastikan tidak ganda.` })) : null);
      }));
    }
  }

  function drawFooter() {
    const n = draft.siswa.length * draft.items.length;
    const add = draft.items.reduce((t, x) => t + (Number(x.poin) || 0), 0);
    const back = draft.step > 1 ? btn('Kembali', () => goStep(draft.step - 1), { kind: 'text', ic: 'left' })
      : btn('Batal', async () => {
        if ((draft.siswa.length || draft.items.length) && !(await confirmDialog('Batalkan pencatatan?', 'Isian akan dihapus.', 'Ya, batalkan'))) return;
        draft = null;
        go('');
      }, { kind: 'text' });
    const info = draft.step === 1 ? `${draft.siswa.length} siswa dipilih`
      : draft.step === 2 ? (draft.items.length ? `${draft.items.length} pelanggaran · +${add} poin` : 'Pilih pelanggaran')
        : `${n} catatan · +${add} poin per siswa`;
    const next = draft.step < 3
      ? btn('Lanjut', () => goStep(draft.step + 1), { kind: 'primary', ic: 'right', disabled: !canGo(draft.step + 1) })
      : btn(editing ? 'Simpan perubahan' : 'Simpan', () => save(), { kind: 'primary', ic: 'check', disabled: !n });
    footer.replaceChildren(back, h('span', { class: 'grow small footer-info', text: info }), next);
  }

  async function save() {
    if (!draft.siswa.length || !draft.items.length) return;
    if (!draft.tanggal || draft.tanggal > ymd()) { toast('Tanggal tidak valid (tidak boleh di masa depan).'); return; }
    const n = draft.siswa.length * draft.items.length;
    if (n > 1 && !(await confirmDialog('Simpan catatan?', `${n} catatan pelanggaran akan dibuat (${draft.siswa.length} siswa × ${draft.items.length} pelanggaran).`, 'Simpan'))) return;
    const rows = [];
    const now = stamp();
    const old = editing ? S.d.pelanggaran.find((r) => r.id === draft.editId) : null;
    for (const id of draft.siswa) {
      const s = d.siswaMap.get(id);
      for (const x of draft.items) {
        const j = d.jenisMap.get(x.kode);
        rows.push({
          ...(old || {}),
          id: old ? old.id : uid('p'), tanggal: draft.tanggal, jam: draft.jam, siswaId: s.id, nis: s.nis || '', nama: s.nama, kelas: s.kelas,
          jenisKode: String(j.kode), uraian: j.uraian, kategori: j.kategori, tingkat: j.tingkat, poin: clampPoin(x.poin),
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

  draw();
}

function afterSave(saved, wasEdit) {
  const d = D();
  const one = saved.length === 1 ? saved[0] : null;
  const siswa = one ? d.siswaMap.get(one.siswaId) : null;
  const wa = one && siswa ? waLink(siswa, waRecordText(one, siswa, d.summaries.get(siswa.id))) : '';
  dialog(wasEdit ? 'Perubahan tersimpan' : 'Pelanggaran tercatat', (finish) => h('div', { class: 'stack-sm' },
    h('p', { text: one ? `${one.nama} (${one.kelas}) · ${one.jenisKode}. ${one.uraian} · +${one.poin} poin` : `${saved.length} catatan untuk ${new Set(saved.map((r) => r.siswaId)).size} siswa.` }),
    h('div', { class: 'stack-sm' },
      one ? btn('BAP · PDF / WA / Cetak', () => printBAP(one), { ic: 'report' }) : null,
      wa ? h('a', { class: 'btn tonal', href: wa, target: '_blank', rel: 'noopener' }, icon('wa'), h('span', { text: 'Kabari orang tua via WhatsApp' })) : null,
      one ? btn('Lihat riwayat siswa', () => finish('siswa'), { ic: 'user' }) : null,
      !wasEdit ? btn('Catat lagi', () => finish('again'), { ic: 'plus', kind: 'primary' }) : null)),
  [{ label: 'Selesai', value: 'done' }]).then((v) => {
    if (v === 'again') go('catat', { t: Date.now() });
    else if (v === 'siswa') go('siswa', one.siswaId);
    else if (location.hash.startsWith('#/catat')) go(wasEdit && one ? 'riwayat' : '');
  });
}

const field = (label, control, extra) => h('label', { class: 'field' }, h('span', { class: 'lbl', text: label }), control, extra || null);
