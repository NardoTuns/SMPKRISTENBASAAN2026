// Tata tertib: tahap sanksi, catatan penting, SOP, dan daftar bentuk pelanggaran beserta poinnya (publik).
import { h, icon, btn } from '../ui/dom.js';
import { pageHead, tingkatBadge, levelBadge, emptyState } from '../ui/widgets.js';
import { go } from '../ui/nav.js';
import { printAturan } from '../ui/print.js';
import { S, D, me } from '../store.js';
import { canRules } from '../core/perm.js';
import { debounce, matches } from '../core/util.js';

export const meta = { title: 'Tata Tertib', live: true };
let q = '';

/** opts.publik: dipakai Halaman Siswa & Orang Tua (tanpa tombol kelola). */
export function render(view, route, opts = {}) {
  const d = D();
  const s = S.settings;
  view.append(pageHead('Tata Tertib & Peraturan Sekolah', s.namaSekolah,
    btn(opts.publik ? 'Unduh / bagikan' : 'PDF / WA / Cetak', () => printAturan(), { ic: 'report', kind: opts.publik ? 'tonal' : 'text' }),
    !opts.publik && canRules(me()) ? btn('Kelola aturan', () => go('kelola', 'jenis'), { ic: 'edit', kind: 'tonal' }) : null));

  if (!d.jenis.length) { view.append(emptyState('book', 'Aturan belum diunduh', 'Sambungkan ke internet untuk mengunduh tata tertib dari server.')); return; }

  view.append(h('section', { class: 'card' },
    h('h3', { text: 'A. Prosedur tindak lanjut & akumulasi poin' }),
    h('p', { class: 'muted', text: `Setiap pelanggaran dicatat di Buku Kedisiplinan Siswa dan diberi poin. Poin dijumlahkan selama siswa menempuh pendidikan di ${s.namaSekolah}. Tindakan disiplin diberikan berdasarkan total akumulasi poin:` }),
    h('div', { class: 'ladder' }, ...d.levels.map((l, i) => h('div', { class: 'ladder-step' },
      h('div', { class: 'ladder-range' }, h('strong', { text: `${l.min}${d.levels[i + 1] ? '–' + (d.levels[i + 1].min - 1) : '+'}` }), h('span', { class: 'muted small', text: 'poin' })),
      h('div', { class: 'grow' }, levelBadge(l), h('p', { text: l.tindakan }), h('p', { class: 'muted small', text: `Penanggung jawab: ${l.pj || '-'}` })))))));

  view.append(h('div', { class: 'dash-grid' },
    h('section', { class: 'card span-6' }, h('h3', { text: 'Catatan penting' }),
      h('ol', { class: 'rules-list' },
        h('li', { text: 'Poin siswa tidak bisa dikurangi dengan cara apa pun.' }),
        h('li', null, h('strong', { text: 'Pelanggaran Zero Tolerance' }), ' adalah pelanggaran yang langsung mendapatkan 100 poin.'),
        h('li', { text: 'Contoh: siswa bolos (20 poin), lalu menentang guru dengan kasar (50 poin) → total 70 poin = SP 3. Bila kemudian berkelahi (70 poin) → total 140 poin = dikeluarkan/dipindahkan.' }))),
    h('section', { class: 'card span-6' }, h('h3', { text: 'B. SOP due process & resolusi konflik' }),
      h('ol', { class: 'rules-list' },
        h('li', null, h('strong', { text: 'Sidang Dewan Guru: ' }), `keputusan pelanggaran di atas ${s.batasSidang} poin atau yang mengarah pada skorsing hingga dikeluarkan diputuskan melalui sidang Dewan Guru.`),
        h('li', null, h('strong', { text: 'Berita Acara Pemeriksaan (BAP): ' }), 'setiap pelanggaran yang dikenakan poin didokumentasikan dalam BAP yang ditandatangani siswa pelapor, saksi, pelanggar, dan guru berwenang (BAP dapat dicetak dari detail catatan).'),
        h('li', null, h('strong', { text: 'Klausul pelepasan tuntutan: ' }), 'orang tua/wali menandatangani kesepakatan tata tertib di atas materai; bila siswa mencapai 100 poin atau melakukan pelanggaran Zero Tolerance, keputusan pengembalian siswa kepada orang tua bersifat final.')))));

  const search = h('input', { type: 'search', placeholder: 'Cari bentuk pelanggaran…', value: q, 'aria-label': 'Cari pelanggaran', oninput: debounce((e) => { q = e.target.value; drawList(); }, 150) });
  const listWrap = h('div', { class: 'stack' });
  view.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h3', { class: 'grow', text: 'Bentuk pelanggaran & poin' }), h('label', { class: 'fsel search' }, icon('search'), search)),
    listWrap));
  function drawList() {
    const groups = d.kategori.filter((k) => k.aktif !== false).map((k) => ({ k, items: d.jenis.filter((j) => j.kategori === k.kode && j.aktif !== false && (!q || matches(q, j.uraian, j.kode, k.nama))) })).filter((g) => g.items.length);
    listWrap.replaceChildren(...(groups.length ? groups.map(({ k, items }) => h('details', { class: 'rule-group', open: true },
      h('summary', null, h('span', { class: 'rule-kat', text: k.kode }), h('span', { class: 'grow', text: k.nama }), h('span', { class: 'muted small', text: `${items.length} butir` })),
      h('div', { class: 'rule-items' }, ...items.map((j) => h('div', { class: 'rule-item' },
        h('span', { class: 'rule-no', text: j.kode }),
        h('span', { class: 'grow', text: j.uraian }),
        h('span', { class: 'rule-meta' }, tingkatBadge(j.tingkat), j.zt ? h('span', { class: 'badge sm st-dark', text: 'Zero Tolerance' }) : null,
          h('strong', { class: 'rule-pts', text: `${j.zt ? 100 : j.poin}${j.poinMaks ? '–' + j.poinMaks : ''}` }))))))) : [h('p', { class: 'muted', text: 'Tidak ada yang cocok.' })]));
  }
  drawList();
}
