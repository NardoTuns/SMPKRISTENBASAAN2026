// Buat ikon PNG dari SVG memakai Chrome/Edge headless.  Jalankan: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Perisai putih bertanda centang hijau dengan pita emas, di atas latar navy (warna portal KRISBA).
// full = tanpa sudut membulat (maskable/apple); pad = ruang aman untuk ikon maskable.
const art = (full, pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173563"/><stop offset="1" stop-color="#0B1B33"/></linearGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6edf7"/></linearGradient>
  </defs>
  ${full ? '<rect width="512" height="512" fill="url(#bg)"/>' : '<rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)"/>'}
  <g transform="translate(256 256) scale(${(1 - pad).toFixed(3)}) translate(-256 -256)">
    <path d="M256 84 400 136v118c0 88-60 150-144 178-84-28-144-90-144-178V136z" fill="url(#sh)"/>
    <path d="M256 84 400 136v34H112v-34z" fill="#F2B33D"/>
    <path d="M178 268l52 52 104-112" fill="none" stroke="#059669" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const browser = await launchBrowser({ width: 512, height: 512 });
try {
  const page = await browser.newPage();
  await page.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  async function shot(svg, size, file) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    const html = `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
    await page.goto('data:text/html;base64,' + Buffer.from(html).toString('base64'));
    await page.screenshot(join(root, 'icons', file));
    console.log('ditulis icons/' + file);
  }
  await shot(art(false), 192, 'icon-192.png');
  await shot(art(false), 512, 'icon-512.png');
  await shot(art(true, 0.2), 512, 'maskable-512.png');
  await shot(art(true, 0.1), 180, 'apple-touch-icon.png');
  writeFileSync(join(root, 'icons', 'favicon.svg'), art(false).trim());
  console.log('ditulis icons/favicon.svg');
  page.close();
} finally {
  await browser.close();
}
