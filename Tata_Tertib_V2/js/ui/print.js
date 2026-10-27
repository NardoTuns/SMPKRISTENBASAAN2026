// Dokumen A4: BAP, kartu kedisiplinan, surat tahap sanksi, laporan, ringkasan, dan tata tertib.
// Setiap dokumen dibuka di lembar "Bagikan": unduh PDF/PNG, kirim ke WhatsApp, atau cetak.
import { S, D, me, katNama } from '../store.js';
import { esc, fmtNum, fmtTgl, hariOf, ymd, addDays, waNumber } from '../core/util.js';
import { byTime } from '../core/points.js';
import { openDoc } from './export.js';

const st = () => S.settings;

/** opts: {landscape, fileBase, waNumber, waTo, waText} — lihat openDoc di export.js. */
export function printDoc(title, html, opts = {}) {
  openDoc(title, html, { fileBase: title, ...opts });
}

/** Tujuan WhatsApp orang tua siswa (bila nomor tersedia). */
function waOrtu(siswa, text) {
  const n = waNumber(siswa?.hpOrtu);
  return { waNumber: n, waTo: n ? `${siswa.ortu || 'Orang tua/wali'} (${siswa.hpOrtu})` : '', waText: text };
}

function kop() {
  const s = st();
  const info = [s.npsn ? `NPSN ${s.npsn}` : '', s.alamat, s.telepon ? `Telp. ${s.telepon}` : '', s.email].filter(Boolean).join(' · ');
  return `<div class="kop">${s.logo ? `<img class="kop-logo" src="${esc(s.logo)}" alt="">` : ''}
    <div class="kop-text">${s.yayasan ? `<div class="kop-yys">${esc(s.yayasan)}</div>` : ''}
    <div class="kop-nama">${esc(s.namaSekolah)}</div>${info ? `<div class="kop-info">${esc(info)}</div>` : ''}</div></div>`;
}

// Setiap kolom punya baris atas (boleh kosong) dan ruang tanda tangan setinggi sama → nama sejajar.
const sign = (cols) => `<table class="sign"><tr>${cols.map((c) => `<td><div>${c.top ? esc(c.top) : '&nbsp;'}</div><div>${esc(c.role)}</div>
  ${c.materai ? '<div class="materai">Materai<br>10.000</div>' : '<div class="sign-space"></div>'}
  <div class="sign-name">${c.name ? esc(c.name) : '(..............................................)'}</div><div>${c.nip ? `NIP/NIY. ${esc(c.nip)}` : '&nbsp;'}</div></td>`).join('')}</tr></table>`;

const tempatTanggal = (tgl = ymd()) => `${esc(st().kota || '')}${st().kota ? ', ' : ''}${fmtTgl(tgl)}`;

function identitas(s, extra = []) {
  const rows = [['Nama', s?.nama], ['NIS / NISN', [s?.nis, s?.nisn].filter(Boolean).join(' / ') || '-'], ['Kelas', s?.kelas], ['Jenis kelamin', s?.jk === 'P' ? 'Perempuan' : s?.jk === 'L' ? 'Laki-laki' : '-'], ['Orang tua / wali', s?.ortu || '-'], ...extra];
  return `<table class="ident">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>:</td><td>${esc(v || '-')}</td></tr>`).join('')}</table>`;
}

// Kronologi hanya untuk guru yang login (tanpa login, server memang tidak mengirim isian ini).
const showKron = () => !!me();
const kronLine = (r) => (r.kronologi ? `<div class="kron"><b>Kronologi:</b> ${esc(r.kronologi)}</div>` : '');

function rincian(sum, { upTo, kronologi = showKron() } = {}) {
  const tl = upTo?.tanggal ? sum.timeline.filter((t) => t.rec.tanggal <= upTo.tanggal) : sum.timeline;
  if (!tl.length) return '<p><em>Belum ada catatan pelanggaran.</em></p>';
  return `<table class="tbl-print"><thead><tr><th>No</th><th>Tanggal</th><th>Bentuk pelanggaran${kronologi ? ' &amp; kronologi' : ''}</th><th>Tingkat</th><th class="num">Poin</th><th class="num">Akumulasi</th></tr></thead><tbody>
    ${tl.map((t, i) => `<tr><td>${i + 1}</td><td class="nw">${fmtTgl(t.rec.tanggal, { short: true })}</td><td>${esc(t.rec.jenisKode)}. ${esc(t.rec.uraian)}${kronologi ? kronLine(t.rec) : ''}</td><td>${esc(t.rec.tingkat)}</td><td class="num">${t.rec.poin}</td><td class="num">${t.after}</td></tr>`).join('')}
  </tbody></table>`;
}

/** Catatan yang kronologinya diisi (bahan lampiran), urut waktu kejadian. Kosong bila belum login. */
export const kronOf = (recs) => (showKron() ? recs.filter((r) => !r.batal && String(r.kronologi || '').trim()).sort(byTime) : []);

/** Lampiran laporan: catatan pelanggaran yang kronologinya diisi guru (urut waktu kejadian). */
export function kronHtml(recs = []) {
  if (!recs.length) return '';
  return `<h3>Catatan kronologi kejadian</h3>
    <table class="tbl-print kron-tbl"><thead><tr><th>No</th><th>Tanggal</th><th>Siswa</th><th>Pelanggaran</th><th>Kronologi</th></tr></thead><tbody>
    ${recs.map((r, i) => `<tr><td>${i + 1}</td><td class="nw">${fmtTgl(r.tanggal, { short: true })}${r.jam ? `<br>${esc(r.jam)}` : ''}</td><td>${esc(r.nama)}<br>Kelas ${esc(r.kelas)}</td><td>${esc(r.jenisKode)}. ${esc(r.uraian)} (${esc(r.poin)} poin)</td><td>${esc(r.kronologi)}</td></tr>`).join('')}
    </tbody></table>`;
}

const docHead = (judul, nomor) => `${kop()}<h1 class="doc-title">${esc(judul)}</h1>${nomor !== undefined ? `<p class="doc-no">Nomor: ${nomor ? esc(nomor) : '........................................'}</p>` : ''}`;

// ------------------------------------------------------------------ BAP
export function printBAP(r) {
  const d = D();
  const s = d.siswaMap.get(r.siswaId) || { nama: r.nama, kelas: r.kelas, nis: r.nis };
  const sum = d.summaries.get(r.siswaId);
  const after = sum?.timeline.find((t) => t.rec.id === r.id);
  const lv = after ? d.levels.filter((l) => l.min <= after.after).pop() : null;
  const lines = (v) => (v ? esc(v) : '<span class="dots">..................................................................................................................</span><br><span class="dots">..................................................................................................................</span>');
  const html = `<div class="doc">${docHead('Berita Acara Pemeriksaan (BAP)\nPelanggaran Tata Tertib Siswa', '')}
    <p>Pada hari ini <b>${hariOf(r.tanggal)}</b>, tanggal <b>${fmtTgl(r.tanggal)}</b>${r.jam ? `, pukul <b>${esc(r.jam)} ${esc(st().zonaWaktu)}</b>` : ''}${r.lokasi ? `, bertempat di <b>${esc(r.lokasi)}</b>` : ''}, telah dilakukan pemeriksaan terhadap siswa:</p>
    ${identitas(s)}
    <h3>A. Pelanggaran</h3>
    <table class="ident"><tr><td>Kode / bentuk</td><td>:</td><td>${esc(r.jenisKode)}. ${esc(r.uraian)}</td></tr>
      <tr><td>Kategori</td><td>:</td><td>${esc(r.kategori)}. ${esc(katNama(r.kategori))}</td></tr>
      <tr><td>Tingkat / poin</td><td>:</td><td>Pelanggaran ${esc(r.tingkat)} · <b>${r.poin} poin</b></td></tr>
      <tr><td>Akumulasi poin</td><td>:</td><td>${after ? `<b>${after.after} poin</b>${lv ? ` → tahap <b>${esc(lv.label)}</b>` : ''}` : '-'}</td></tr></table>
    <h3>B. Kronologi kejadian</h3><p>${lines(r.kronologi)}</p>
    <h3>C. Keterangan</h3>
    <table class="ident"><tr><td>Saksi</td><td>:</td><td>${r.saksi ? esc(r.saksi) : '..........................................'}</td></tr>
      <tr><td>Siswa pelapor</td><td>:</td><td>${r.pelapor ? esc(r.pelapor) : '..........................................'}</td></tr>
      <tr><td>Tindakan langsung</td><td>:</td><td>${r.tindakanLangsung ? esc(r.tindakanLangsung) : '..........................................'}</td></tr></table>
    ${r.batal ? `<p class="stamp">DIBATALKAN — ${esc(r.alasanBatal)}</p>` : ''}
    <p>Demikian berita acara ini dibuat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.</p>
    <p class="right">${tempatTanggal(r.tanggal)}</p>
    ${sign([{ role: 'Siswa Pelapor', name: r.pelapor }, { role: 'Saksi', name: r.saksi }, { role: 'Siswa Pelanggar', name: r.nama }, { role: 'Guru Berwenang', name: r.guruNama }])}
  </div>`;
  printDoc(`BAP ${r.nama} ${r.tanggal}`, html, waOrtu(s, `Yth. Bapak/Ibu ${s.ortu || 'Orang Tua/Wali'}, terlampir Berita Acara Pemeriksaan pelanggaran tata tertib ananda ${r.nama} (kelas ${r.kelas}) tanggal ${fmtTgl(r.tanggal)}. — ${st().namaSekolah}`));
}

// ------------------------------------------------------------------ kartu kedisiplinan
export function printKartu(siswa) {
  const sum = D().summaries.get(siswa.id);
  printDoc(`Kartu Kedisiplinan ${siswa.nama}`, kartuHtml(siswa, sum), waOrtu(siswa, `Yth. Bapak/Ibu ${siswa.ortu || 'Orang Tua/Wali'}, terlampir kartu kendali kedisiplinan ananda ${siswa.nama} (kelas ${siswa.kelas}): akumulasi ${sum.total} poin${sum.level ? `, tahap ${sum.level.label}` : ''}. — ${st().namaSekolah}`));
}

/** Kartu kedisiplinan dari data siswa + ringkasan (summarize). Dipakai juga Halaman Siswa & Orang Tua (tanpa kronologi). */
export function kartuHtml(siswa, sum, { kronologi = showKron() } = {}) {
  const wali = S.d.users.find((u) => u.peran === 'Wali Kelas' && String(u.kelasWali).toLowerCase().split(/[,;]\s*/).includes(String(siswa.kelas).toLowerCase()));
  return `<div class="doc">${docHead('Kartu Kendali Kedisiplinan Siswa')}
    ${identitas(siswa, [['Tahun ajaran', `${st().tahunAjaran} · Semester ${st().semester}`]])}
    <div class="summary-box"><div><span>Total akumulasi poin</span><b>${fmtNum(sum.total)}</b></div><div><span>Jumlah pelanggaran</span><b>${sum.count}</b></div>
      <div><span>Tahap saat ini</span><b>${sum.level ? esc(sum.level.label) : 'Aman (belum ada tindakan)'}</b></div>
      <div><span>Tahap berikutnya</span><b>${sum.next ? `${esc(sum.next.label)} (${sum.next.min} poin, kurang ${sum.toNext})` : '-'}</b></div></div>
    <h3>Riwayat pelanggaran</h3>${rincian(sum, { kronologi })}
    <p class="small">Poin diakumulasikan selama siswa menempuh pendidikan dan tidak dapat dikurangi. Dicetak ${fmtTgl(ymd())}${me() ? ` oleh ${esc(me().nama)}` : ''}.</p>
    <p class="right">${tempatTanggal()}</p>
    ${sign([{ top: 'Mengetahui,', role: 'Orang Tua/Wali', name: siswa.ortu }, { role: 'Wali Kelas', name: wali?.nama, nip: wali?.nip }, { role: 'Guru BK', name: st().guruBK, nip: st().nipBK }])}
  </div>`;
}

// ------------------------------------------------------------------ surat tahap sanksi
/** o: {nomor, tanggal, hariTemu, jamTemu, tempat, mulai, selesai, sidang} */
export function printSurat(item, o = {}) {
  const d = D();
  const siswa = d.siswaMap.get(item.siswaId) || { nama: item.nama, kelas: item.kelas };
  const sum = d.summaries.get(item.siswaId);
  const level = item.level || d.levels.find((l) => l.kode === item.tahap);
  const kind = level?.surat || '';
  const s = st();
  const tgl = o.tanggal || ymd();
  const poin = item.poinSaat || sum.total;
  const wali = S.d.users.find((u) => u.peran === 'Wali Kelas' && String(u.kelasWali).toLowerCase().split(/[,;]\s*/).includes(String(siswa.kelas).toLowerCase()));
  const kepsek = { role: 'Kepala Sekolah', name: s.kepalaSekolah, nip: s.nipKepsek };
  const bk = { role: 'Guru BK / Komite Disiplin', name: s.guruBK, nip: s.nipBK };
  const ortu = /^(bapak|ibu|bpk|bp\.|sdr)/i.test(siswa.ortu || '') ? siswa.ortu : `Bapak/Ibu ${siswa.ortu || 'Orang Tua/Wali'}`;
  const temu = `<table class="ident"><tr><td>Hari, tanggal</td><td>:</td><td>${o.hariTemu ? `${hariOf(o.hariTemu)}, ${fmtTgl(o.hariTemu)}` : '..........................................'}</td></tr>
    <tr><td>Waktu</td><td>:</td><td>${o.jamTemu ? `${esc(o.jamTemu)} ${esc(s.zonaWaktu)} s/d selesai` : '..........................................'}</td></tr>
    <tr><td>Tempat</td><td>:</td><td>${esc(o.tempat || 'Ruang BK ' + s.namaSekolah)}</td></tr><tr><td>Menemui</td><td>:</td><td>Guru BK / Komite Disiplin</td></tr></table>`;
  const rinci = `<h3>Rincian pelanggaran</h3>${rincian(sum, { upTo: { tanggal: item.tanggalCapai } })}`;
  const lampiranRule = `<p>Ketentuan ini sesuai Tata Tertib dan Peraturan Sekolah ${esc(s.namaSekolah)} butir A (Prosedur Tindak Lanjut dan Akumulasi Poin): <em>${esc(level?.tindakan || '')}</em></p>`;
  let html = '';

  if (kind === 'SP1') {
    html = `<div class="doc">${docHead('Surat Peringatan 1 (SP 1)\nTeguran Tertulis', o.nomor)}
      <p>Kepala ${esc(s.namaSekolah)} dengan ini memberikan <b>Teguran Tertulis (Surat Peringatan 1)</b> kepada siswa:</p>${identitas(siswa)}
      <p>Berdasarkan Buku Kedisiplinan Siswa, yang bersangkutan telah mengumpulkan akumulasi <b>${poin} poin</b> pelanggaran tata tertib.</p>${lampiranRule}
      <p>Siswa wajib menandatangani Surat Komitmen Perbaikan Diri (terlampir). Apabila akumulasi poin mencapai ${nextMin(level)} poin, siswa akan dikenakan Surat Peringatan 2 disertai pemanggilan orang tua/wali.</p>
      ${rinci}<p class="right">${tempatTanggal(tgl)}</p>
      ${sign([{ top: 'Mengetahui,', role: 'Orang Tua/Wali', name: siswa.ortu }, { role: 'Wali Kelas', name: wali?.nama, nip: wali?.nip }, kepsek])}</div>
      <div class="doc page-break">${docHead('Surat Komitmen Perbaikan Diri')}
      <p>Saya yang bertanda tangan di bawah ini:</p>${identitas(siswa)}
      <p>dengan sesungguhnya menyatakan bahwa:</p>
      <ol><li>Saya mengakui telah melakukan pelanggaran tata tertib sekolah sebagaimana tercatat dalam Buku Kedisiplinan Siswa dengan akumulasi ${poin} poin.</li>
      <li>Saya berjanji tidak akan mengulangi pelanggaran tersebut dan akan memperbaiki sikap, perilaku, serta kedisiplinan saya.</li>
      <li>Saya bersedia dibina oleh Wali Kelas dan Guru BK.</li>
      <li>Apabila saya kembali melanggar, saya bersedia menerima sanksi sesuai Tata Tertib dan Peraturan Sekolah, termasuk pemanggilan orang tua/wali.</li></ol>
      <p>Demikian surat komitmen ini saya buat dengan sadar dan tanpa paksaan dari pihak mana pun.</p>
      <p class="right">${tempatTanggal(tgl)}</p>
      ${sign([{ role: 'Wali Kelas', name: wali?.nama, nip: wali?.nip }, { top: 'Mengetahui,', role: 'Orang Tua/Wali', name: siswa.ortu }, { role: 'Siswa yang berjanji', name: siswa.nama }])}</div>`;
  } else if (kind === 'SP2') {
    html = `<div class="doc">${docHead('Surat Peringatan 2 (SP 2)\ndan Panggilan Orang Tua/Wali', o.nomor)}
      <p>Kepada Yth.<br>${esc(ortu)}<br>di tempat</p><p>Dengan hormat,</p>
      <p>Bersama ini kami beritahukan bahwa putra/putri Bapak/Ibu:</p>${identitas(siswa)}
      <p>telah mengumpulkan akumulasi <b>${poin} poin</b> pelanggaran tata tertib sehingga dikenakan <b>Surat Peringatan 2 (SP 2)</b>.</p>${lampiranRule}
      <p>Sehubungan dengan hal tersebut, kami mengundang Bapak/Ibu untuk hadir di sekolah pada:</p>${temu}
      <p>Mengingat keputusan atas pelanggaran di atas ${esc(s.batasSidang)} poin diputuskan melalui Sidang Dewan Guru, kehadiran Bapak/Ibu sangat kami harapkan. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>
      ${rinci}<p class="right">${tempatTanggal(tgl)}</p>${sign([bk, kepsek])}</div>`;
  } else if (kind === 'SP3') {
    const mulai = o.mulai || addDays(tgl, 1);
    const selesai = o.selesai || addDays(mulai, 2);
    html = `<div class="doc">${docHead('Surat Peringatan 3 (SP 3)\ndan Pemberitahuan Skorsing', o.nomor)}
      <p>Kepada Yth.<br>${esc(ortu)}<br>di tempat</p><p>Dengan hormat,</p>
      <p>Berdasarkan Buku Kedisiplinan Siswa dan hasil Sidang Dewan Guru${o.sidang ? ` tanggal ${fmtTgl(o.sidang)}` : ''}, siswa:</p>${identitas(siswa)}
      <p>telah mengumpulkan akumulasi <b>${poin} poin</b> pelanggaran tata tertib sehingga dikenakan <b>Surat Peringatan 3 (SP 3)</b> disertai <b>skorsing selama 3 (tiga) hari</b>, yaitu tanggal <b>${fmtTgl(mulai)}</b> s/d <b>${fmtTgl(selesai)}</b>.</p>${lampiranRule}
      <p>Selama masa skorsing, siswa belajar mandiri di rumah di bawah pengawasan orang tua/wali dan mengerjakan tugas yang diberikan sekolah. Bapak/Ibu diminta hadir di sekolah pada:</p>${temu}
      <p>Apabila akumulasi poin mencapai ${nextMin(level)} poin, siswa akan dikenakan Peringatan Keras Terakhir dengan surat perjanjian bermaterai.</p>
      ${rinci}<p class="right">${tempatTanggal(tgl)}</p>${sign([bk, kepsek])}</div>`;
  } else if (kind === 'PK') {
    html = `<div class="doc">${docHead('Surat Perjanjian\nPeringatan Keras Terakhir', o.nomor)}
      <p>Pada hari ini ${hariOf(tgl)}, tanggal ${fmtTgl(tgl)}, kami yang bertanda tangan di bawah ini, orang tua/wali dari siswa:</p>${identitas(siswa)}
      <p>menyatakan telah menerima pemberitahuan bahwa siswa tersebut telah mengumpulkan akumulasi <b>${poin} poin</b> pelanggaran tata tertib dan dikenakan <b>Peringatan Keras Terakhir</b>. Dengan ini kami menyatakan:</p>
      <ol><li>Menerima keputusan bahwa siswa berada dalam <b>masa percobaan ketat</b> dan dibina bersama oleh sekolah dan orang tua/wali.</li>
      <li>Sanggup mengawasi dan membina anak kami agar tidak melakukan pelanggaran tata tertib lagi.</li>
      <li>Memahami bahwa poin pelanggaran tidak dapat dikurangi dengan cara apa pun.</li>
      <li>Menyetujui klausul berikut: <em>"Apabila siswa mencapai akumulasi 100 poin atau melakukan pelanggaran Zero-Tolerance (langsung 100 poin), orang tua/wali menerima keputusan pengembalian siswa kepada orang tua secara final tanpa hak untuk melakukan penuntutan hukum dalam bentuk apa pun kepada pihak sekolah."</em></li></ol>
      <p>Demikian surat perjanjian ini dibuat dengan penuh kesadaran tanpa paksaan dari pihak mana pun.</p>
      ${rinci}<p class="right">${tempatTanggal(tgl)}</p>
      ${sign([{ role: 'Orang Tua/Wali', name: siswa.ortu, materai: true }, { role: 'Siswa', name: siswa.nama }, { top: 'Mengetahui,', ...bk }, kepsek])}</div>`;
  } else if (kind === 'KELUAR') {
    html = `<div class="doc">${docHead('Surat Keputusan\nPengembalian Siswa kepada Orang Tua/Wali', o.nomor)}
      <p>Kepala ${esc(s.namaSekolah)}, setelah</p>
      <ol><li>memperhatikan Buku Kedisiplinan Siswa yang mencatat akumulasi <b>${poin} poin</b> pelanggaran tata tertib atas nama siswa di bawah ini;</li>
      <li>berdasarkan Tata Tertib dan Peraturan Sekolah: <em>"100 Poin: siswa dikeluarkan / dipindahkan. Akumulasi poin maksimal telah terpenuhi."</em>;</li>
      <li>berdasarkan hasil Sidang Dewan Guru${o.sidang ? ` tanggal ${fmtTgl(o.sidang)}` : ''} serta kesepakatan tata tertib yang telah ditandatangani orang tua/wali di atas materai;</li></ol>
      <p><b>MEMUTUSKAN</b> mengembalikan wewenang pendidikan siswa:</p>${identitas(siswa)}
      <p>sepenuhnya kepada orang tua/wali terhitung sejak tanggal ${fmtTgl(tgl)}. Keputusan ini bersifat final dan mengikat sesuai klausul pelepasan tuntutan dalam kesepakatan tata tertib. Sekolah akan menerbitkan surat pindah beserta dokumen akademik yang diperlukan.</p>
      ${rinci}<p class="right">${tempatTanggal(tgl)}</p>${sign([{ top: 'Diterima oleh,', role: 'Orang Tua/Wali', name: siswa.ortu }, kepsek])}</div>`;
  } else {
    html = `<div class="doc">${docHead('Catatan Pembinaan Siswa', o.nomor)}
      <p>Siswa berikut telah mencapai tahap <b>${esc(level?.label || item.tahapLabel)}</b> dengan akumulasi <b>${poin} poin</b>:</p>${identitas(siswa)}${lampiranRule}
      <h3>Pembinaan yang dilakukan</h3><p><span class="dots">..................................................................................................................</span><br><span class="dots">..................................................................................................................</span></p>
      ${rinci}<p class="right">${tempatTanggal(tgl)}</p>${sign([{ role: 'Siswa', name: siswa.nama }, { role: 'Guru Pembina', name: me()?.nama }])}</div>`;
  }
  printDoc(`${level?.label || 'Surat'} ${siswa.nama}`, html, waOrtu(siswa, `Yth. Bapak/Ibu ${siswa.ortu || 'Orang Tua/Wali'}, terlampir surat dari ${s.namaSekolah} perihal ${level?.label || 'pembinaan'} untuk ananda ${siswa.nama} (kelas ${siswa.kelas}). Mohon dibaca dan ditindaklanjuti. Terima kasih.`));
}
const nextMin = (level) => { const n = D().levels.find((l) => l.min > (level?.min || 0)); return n ? n.min : 100; };

// ------------------------------------------------------------------ laporan tabel
const dicetak = () => `Dibuat ${fmtTgl(ymd())}${me() ? ` oleh ${esc(me().nama)}` : ''} dari aplikasi Tata Tertib ${esc(st().namaSekolah)}.`;
const signPejabat = () => sign([{ role: 'Guru BK', name: st().guruBK, nip: st().nipBK }, { top: 'Mengetahui,', role: 'Kepala Sekolah', name: st().kepalaSekolah, nip: st().nipKepsek }]);

const tableHtml = (cols, rows, numeric = []) => `<table class="tbl-print"><thead><tr><th>No</th>${cols.map((c, i) => `<th class="${numeric.includes(i) ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map((r, i) => `<tr><td>${i + 1}</td>${r.map((v, j) => `<td class="${numeric.includes(j) ? 'num' : ''}">${esc(typeof v === 'number' ? fmtNum(v, 1) : v)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length + 1}"><em>Tidak ada data.</em></td></tr>`}</tbody></table>`;

/**
 * HTML laporan (dipakai lembar Bagikan maupun tombol PDF/PNG/WA langsung di halaman Laporan).
 * Opsional: tiles [[label, nilai]] (kotak angka), sections [{title, cols, rows, numeric}] (tabel tambahan),
 * kronologi [catatan] (lampiran "Catatan kronologi kejadian").
 */
export function reportHtml({ title, meta = [], cols, rows, numeric = [], note = '', tiles = [], sections = [], kronologi = [] }) {
  return `<div class="doc">${kop()}<h1 class="doc-title">${esc(title)}</h1>
    <p class="meta">${meta.map(esc).join(' · ')}</p>
    ${tiles.length ? `<div class="dsum-grid">${tiles.map(([l, v]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>` : ''}
    ${tableHtml(cols, rows, numeric)}
    ${sections.map((s) => `<h3>${esc(s.title)}</h3>${tableHtml(s.cols, s.rows, s.numeric)}`).join('')}
    ${note ? `<p class="small">${esc(note)}</p>` : ''}
    ${kronHtml(kronologi)}
    <p class="small">${dicetak()}</p>
    <p class="right">${tempatTanggal()}</p>${signPejabat()}</div>`;
}
export const reportOpts = (rep) => ({ landscape: !!rep.landscape, fileBase: rep.fileBase || `${rep.title} ${ymd()}`, waText: `${rep.title} — ${[...(rep.meta || [])].join(' · ')} (${st().namaSekolah})` });
export function printReport(rep) { printDoc(rep.title, reportHtml(rep), reportOpts(rep)); }

/**
 * Ringkasan bergaya dasbor: kotak angka + beberapa tabel berbatang.
 * spec: {title, meta[], tiles:[[label, value, sub]], sections:[{title, cols, rows, bar: indexKolomAngka}], kronologi:[catatan]}
 */
export function summaryHtml({ title, meta = [], tiles = [], sections = [], note = '', kronologi = [] }) {
  const table = (sec) => {
    const max = Math.max(1, ...sec.rows.map((r) => Number(r[sec.bar]) || 0));
    return `<h3>${esc(sec.title)}</h3><table class="tbl-print"><thead><tr>${sec.cols.map((c, i) => `<th class="${i === sec.bar ? 'num' : ''}">${esc(c)}</th>`).join('')}${sec.bar != null ? '<th style="width:28%"></th>' : ''}</tr></thead><tbody>
      ${sec.rows.length ? sec.rows.map((r) => `<tr class="dbar-row">${r.map((v, i) => `<td class="${i === sec.bar ? 'num' : ''}">${esc(typeof v === 'number' ? fmtNum(v, 1) : v)}</td>`).join('')}${sec.bar != null ? `<td><div class="dbar" style="width:${Math.round(((Number(r[sec.bar]) || 0) / max) * 100)}%"></div></td>` : ''}</tr>`).join('')
        : `<tr><td colspan="${sec.cols.length + 1}"><em>Tidak ada data.</em></td></tr>`}</tbody></table>`;
  };
  return `<div class="doc">${kop()}<h1 class="doc-title">${esc(title)}</h1><p class="meta">${meta.map(esc).join(' · ')}</p>
    ${tiles.length ? `<div class="dsum-grid">${tiles.map(([l, v, sub]) => `<div><span>${esc(l)}</span><b>${esc(v)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`).join('')}</div>` : ''}
    ${sections.map(table).join('')}
    ${note ? `<p class="small">${esc(note)}</p>` : ''}${kronHtml(kronologi)}<p class="small">${dicetak()}</p></div>`;
}
export function printSummary(spec) {
  printDoc(spec.title, summaryHtml(spec), { fileBase: `${spec.title} ${ymd()}`, waText: `${spec.title} — ${(spec.meta || []).join(' · ')} (${st().namaSekolah})` });
}

// ------------------------------------------------------------------ tata tertib
export function printAturan() {
  const d = D();
  const s = st();
  const html = `<div class="doc">${kop()}<h1 class="doc-title">Tata Tertib dan Peraturan Sekolah</h1>
    <h3>A. Prosedur tindak lanjut dan akumulasi poin</h3>
    <p>Setiap pelanggaran dicatat di Buku Kedisiplinan Siswa dan diberikan poin sesuai tabel. Poin dijumlahkan (diakumulasikan) selama siswa menempuh pendidikan di ${esc(s.namaSekolah)}.</p>
    <table class="tbl-print"><thead><tr><th>Akumulasi poin</th><th>Tahap</th><th>Tindakan</th><th>Penanggung jawab</th></tr></thead><tbody>
    ${d.levels.map((l, i) => `<tr><td>${l.min}${d.levels[i + 1] ? `–${d.levels[i + 1].min - 1}` : '+'}</td><td>${esc(l.label)}</td><td>${esc(l.tindakan)}</td><td>${esc(l.pj)}</td></tr>`).join('')}</tbody></table>
    <h3>Catatan penting</h3><ol><li>Poin siswa tidak bisa dikurangi dengan cara apa pun.</li><li>Pelanggaran Zero Tolerance langsung mendapatkan 100 poin.</li>
    <li>Keputusan atas pelanggaran di atas ${esc(s.batasSidang)} poin atau yang mengarah pada skorsing hingga dikeluarkan diputuskan melalui Sidang Dewan Guru.</li>
    <li>Setiap pelanggaran yang dikenakan poin didokumentasikan dalam Berita Acara Pemeriksaan (BAP).</li></ol>
    <h3>B. Bentuk pelanggaran dan poin</h3>
    <table class="tbl-print"><thead><tr><th>No</th><th>Bentuk pelanggaran</th><th class="num">Poin</th><th>Keterangan</th></tr></thead><tbody>
    ${d.kategori.filter((k) => k.aktif !== false).map((k) => `<tr class="grp"><td>${esc(k.kode)}</td><td colspan="3"><b>${esc(k.nama.toUpperCase())}</b></td></tr>` +
      d.jenis.filter((j) => j.kategori === k.kode && j.aktif !== false).map((j) => `<tr><td>${esc(j.kode)}</td><td>${esc(j.uraian)}</td><td class="num">${j.zt ? '100' : j.poinMaks ? `${j.poin}–${j.poinMaks}` : j.poin}</td><td>Pelanggaran ${esc(j.tingkat)}${j.zt ? ' · Zero Tolerance' : ''}</td></tr>`).join('')).join('')}
    </tbody></table>
    <p class="small">Dokumen ini wajib ditandatangani oleh Orang Tua/Wali Murid sebagai bukti persetujuan terhadap seluruh aturan yang berlaku.</p>
    <p class="right">${tempatTanggal()}</p>${sign([{ role: 'Orang Tua/Wali Murid', materai: true }, { role: 'Kepala Sekolah', name: s.kepalaSekolah, nip: s.nipKepsek }])}</div>`;
  printDoc('Tata Tertib ' + s.namaSekolah, html, { waText: `Tata Tertib dan Peraturan ${s.namaSekolah} beserta daftar poin pelanggaran. Mohon dibaca bersama ananda. Terima kasih.` });
}
