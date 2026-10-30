// 18 frames: start / hold / end of each of the six chapters.
// Runs with ?capture=1, which stops the scroll engine and hands progress to
// window.__gotoProgress, so each frame is the exact point on the path rather
// than the camera still easing toward it.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = 'analysis/site-shots';
fs.mkdirSync(OUT, { recursive: true });
const W = 900, H = 600;

const browser = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('  [err]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));

await page.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__gotoProgress, { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
// Wait for the real models: the loading screen dismisses itself once the
// manager is idle and a couple of frames have been drawn.
await page.waitForFunction(() => {
  const el = document.querySelector('.loading-screen');
  return el && el.dataset.done === 'true';
}, { timeout: 180000 });
await page.waitForTimeout(2000);

const chapters = await page.evaluate(() => window.__chapters);
const frames = [];
let fpsSum = 0, fpsN = 0;

for (const c of chapters) {
  for (const [kind, p] of [['start', c.marks.start], ['hold', c.marks.hold], ['end', c.marks.end]]) {
    await page.evaluate((v) => window.__gotoProgress(v), p);
    // A few frames so the title transition and any damping settle.
    await page.waitForTimeout(900);
    const buf = await page.screenshot();
    const cam = await page.evaluate(() => {
      const r = window.__chapters && document.title ? null : null;
      return r;
    });
    void cam;
    frames.push({ buf, label: `${c.index}. ${c.subtitle} — ${kind}`, p });
    console.log(`ch${c.index} ${kind.padEnd(5)} p=${p.toFixed(3)}`);
  }
}
void fpsSum; void fpsN;

fs.writeFileSync(`${OUT}/_frames.json`,
  JSON.stringify(frames.map((f) => ({ label: f.label, p: f.p })), null, 2));
frames.forEach((f, i) => fs.writeFileSync(
  `${OUT}/frame_${String(i).padStart(2, '0')}.png`, f.buf));

// Contact sheet: 3 columns (start / hold / end) x 6 rows (chapters).
const CW = 460, CH = 307;
const cells = await Promise.all(frames.map(async (f) => {
  const img = await sharp(f.buf).resize(CW, CH, { fit: 'cover' }).toBuffer();
  const svg = Buffer.from(
    `<svg width="${CW}" height="${CH}">
       <rect x="0" y="${CH - 26}" width="${CW}" height="26" fill="rgba(5,5,5,0.78)"/>
       <text x="9" y="${CH - 8}" font-family="monospace" font-size="13" fill="#C9A24A">${
         f.label.replace(/&/g, '&amp;')}</text>
       <text x="${CW - 9}" y="${CH - 8}" text-anchor="end" font-family="monospace"
         font-size="12" fill="#8A6A2F">p ${f.p.toFixed(3)}</text>
     </svg>`);
  return sharp(img).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
}));

await sharp({ create: { width: CW * 3, height: CH * 6, channels: 3, background: '#050505' } })
  .composite(cells.map((input, i) => ({
    input, left: (i % 3) * CW, top: Math.floor(i / 3) * CH })))
  .png().toFile(`${OUT}/_contact_sheet.png`);

await browser.close();
console.log('wrote', `${OUT}/_contact_sheet.png`);
