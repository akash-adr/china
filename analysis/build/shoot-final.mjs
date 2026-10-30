import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = 'analysis/final-shots';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('  [err]', m.text().slice(0, 160)); });

const ready = () => page.waitForFunction(() => window.__ready === true, { timeout: 180000 });

// ---- 1. lineup
await page.goto('http://localhost:5178/?clean', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__showLineup, { timeout: 30000 });
await ready();
for (const [noscan, tag] of [[false, 'all'], [true, 'noscan']]) {
  await page.evaluate(n => window.__showLineup(n), noscan);
  await ready();
  for (const v of ['front', 'three_quarter']) {
    await page.evaluate(x => window.__setView(x), v);
    await page.waitForTimeout(600);
    await page.locator('#stage').screenshot({ path: `${OUT}/_lineup_${tag}__${v}.png` });
  }
}
console.log('lineup captured');

// ---- 2. each model, 3/4 + front
const ids = await page.evaluate(() => window.__models.map(m => m.id));
for (const id of ids) {
  await page.evaluate(i => window.__showOne(i), id);
  await ready();
  for (const v of ['three_quarter', 'front']) {
    await page.evaluate(x => window.__setView(x), v);
    await page.waitForTimeout(500);
    await page.locator('#stage').screenshot({ path: `${OUT}/${id}__${v}.png` });
  }
  console.log('captured', id);
}

// ---- 3. dragon loop filmstrip
const DUR = 8.00, N = 9;
await page.evaluate(() => window.__showOne('chinese_dragon'));
await ready();
await page.evaluate(() => window.__setView('side'));
await page.waitForTimeout(500);
const frames = [];
for (let i = 0; i < N; i++) {
  const t = (DUR * i) / (N - 1); // includes both 0 and DUR
  await page.evaluate(x => window.__setTime(x), t);
  await page.waitForTimeout(220);
  const buf = await page.locator('#stage').screenshot();
  frames.push({ t, buf });
  fs.writeFileSync(`${OUT}/loop_frame_${String(i).padStart(2, '0')}.png`, buf);
}
console.log('loop frames captured');
await browser.close();

// Compose the filmstrip: 3x3 contact sheet, each cell labelled with its time.
const CW = 420, CH = 282;
const cells = await Promise.all(frames.map(async (f, i) => {
  const img = await sharp(f.buf).resize(CW, CH, { fit: 'cover' }).toBuffer();
  const label = i === 0 ? '0.00s  (loop start)'
    : i === N - 1 ? `${f.t.toFixed(2)}s  (loop end = start)`
    : `${f.t.toFixed(2)}s`;
  const svg = Buffer.from(
    `<svg width="${CW}" height="${CH}"><text x="10" y="22" font-family="monospace" font-size="15"
     fill="${i === 0 || i === N - 1 ? '#f0c060' : '#ffffff'}">${label}</text></svg>`);
  return sharp(img).composite([{ input: svg, top: 0, left: 0 }]).toBuffer();
}));
const sheet = sharp({ create: { width: CW * 3, height: CH * 3, channels: 3, background: '#16171b' } });
await sheet.composite(cells.map((input, i) => ({
  input, left: (i % 3) * CW, top: Math.floor(i / 3) * CH,
}))).png().toFile(`${OUT}/_dragon_loop_filmstrip.png`);

// Side-by-side proof that the loop closes.
const first = await sharp(frames[0].buf).resize(620, 420, { fit: 'cover' }).toBuffer();
const last = await sharp(frames[N - 1].buf).resize(620, 420, { fit: 'cover' }).toBuffer();
await sharp({ create: { width: 1240, height: 420, channels: 3, background: '#16171b' } })
  .composite([{ input: first, left: 0, top: 0 }, { input: last, left: 620, top: 0 },
    { input: Buffer.from(`<svg width="1240" height="420">
      <text x="12" y="26" font-family="monospace" font-size="17" fill="#f0c060">t = 0.00s</text>
      <text x="632" y="26" font-family="monospace" font-size="17" fill="#f0c060">t = 7.97s (wraps to 0)</text>
      <line x1="620" y1="0" x2="620" y2="420" stroke="#c9a24a" stroke-width="2"/></svg>`), top: 0, left: 0 }])
  .png().toFile(`${OUT}/_dragon_loop_seam.png`);
console.log('filmstrip + seam written');
