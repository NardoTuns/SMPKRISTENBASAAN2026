// Panggilan ke Web App Google Apps Script. POST text/plain agar tidak memicu preflight CORS.

export class ApiError extends Error {
  constructor(message, code = 'ERROR') { super(message); this.code = code; }
}

export async function call(url, body, timeoutMs = 45000) {
  if (!url) throw new ApiError('Alamat server belum diatur.', 'NO_SERVER');
  if (!navigator.onLine) throw new ApiError('Tidak ada koneksi internet.', 'OFFLINE');
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl.signal, redirect: 'follow', cache: 'no-store' });
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Gagal menghubungi server. Periksa internet atau alamat server.', 'NETWORK');
  } finally {
    clearTimeout(tm);
  }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new ApiError(/<html/i.test(text)
      ? 'Server membalas halaman HTML, bukan data. Pastikan deployment Apps Script "Yang memiliki akses: Siapa saja" dan URL berakhiran /exec.'
      : 'Balasan server tidak dikenali.', 'BAD_RESPONSE');
  }
  if (!data.ok) throw new ApiError(data.error || 'Server menolak permintaan.', data.code || 'ERROR');
  return data;
}

/** Uji alamat server (dipakai di Pengaturan). */
export async function ping(url) {
  const r = await call(url, { action: 'ping' }, 20000);
  if (r.app !== 'tatib-krisba') throw new ApiError('Alamat ini bukan server Tata Tertib.', 'BAD_SERVER');
  return r;
}
