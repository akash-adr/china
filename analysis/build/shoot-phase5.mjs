import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';

const OUT = 'analysis/final-shots';
fs.mkdirSync(OUT, { recursive: true });
const W = 1280, H = 860;

const browser = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('  [err]', m.text().slice(0, 160)); });
const ready = () => page.waitForFunction(() => window.__ready === true, { timeout: 180000 });
const shot = () => page.locator('#stage').screenshot();

await page.goto('http://localhost:5178/?clean=nohud', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__showOne, { timeout: 30000 });

const label = (buf, text, w, h, colour = '#f0c060') =>
  sharp(buf).resize(w, h, { fit: 'cover' }).composite([{
    input: Buffer.from(`<svg width="${w}" height="${h}"><text x="14" y="30"
      font-family="monospace" font-size="19" fill="${colour}">${text}</text></svg>`),
    top: 0, left: 0,
  }]).toBuffer();

async function strip(panels, file, cw = 640, ch = 430) {
  const cells = await Promise.all(panels.map((p) => label(p.buf, p.text, cw, ch)));
  const sheet = sharp({ create: {
    width: cw * cells.length, height: ch, channels: 3, background: '#0c0e11' } });
  await sheet.composite(cells.map((input, i) => ({ input, left: i * cw, top: 0 })))
    .png().toFile(`${OUT}/${file}`);
  console.log('wrote', file);
}

// ---- 1. gate before / after recolour (neutral studio, like for like)
await page.evaluate(() => window.__setCinematic(false));
await page.evaluate(() => window.__showOne('torri_gate'));
await ready();
await page.evaluate(() => window.__setView('three_quarter'));

await page.evaluate(() => window.__setRecolour(false));
await ready(); await page.waitForTimeout(700);
const gateBefore = await shot();

await page.evaluate(() => window.__setRecolour(true));
await ready(); await page.waitForTimeout(700);
const gateAfter = await shot();

await strip([
  { buf: gateBefore, text: 'BEFORE  stock GLB (tourist red)' },
  { buf: gateAfter, text: 'AFTER  weathered timber override' },
], '_gate_recolour.png');

// ---- 1b. the same dressing under the cinematic rig
await page.evaluate(() => window.__setCinematic(true));
await page.waitForTimeout(900);
fs.writeFileSync(`${OUT}/_gate_cinematic.png`, await shot());
console.log('wrote _gate_cinematic.png');

// ---- 2. staff: glow 0, glow 1, extend 1
// The staff is 4 cm across; with the 1.8 m human reference in shot the camera
// frames the figure and leaves the staff a sliver. Reference off for the two
// rest-length panels, back on for the extended one where it carries the point.
await page.evaluate(() => window.__setHuman(false));
await ready();
await page.evaluate(() => window.__showOne('jingu_bang'));
await ready();
await page.evaluate(() => window.__setView('front'));

await page.evaluate(() => window.__setStaff({ glow: 0, extend: 0, spin: 0 }));
await page.evaluate(() => window.__reframe());
await page.waitForTimeout(700);
const staff0 = await shot();

await page.evaluate(() => window.__setStaff({ glow: 1 }));
await page.waitForTimeout(700);
const staff1 = await shot();

await page.evaluate(() => window.__setHuman(true));
await ready();
await page.evaluate(() => window.__setStaff({ glow: 1, extend: 1 }));
await page.evaluate(() => window.__reframe());
await page.waitForTimeout(900);
const staffExt = await shot();

await strip([
  { buf: staff0, text: 'glow 0.0  extend 0' },
  { buf: staff1, text: 'glow 1.0  extend 0' },
  { buf: staffExt, text: 'glow 1.0  extend 1.0  (6x = 10.8 m)' },
], '_staff_states.png');

// Macro on the top cap: the engraved rings, cloud scroll and inscription are
// all sub-millimetre features on a 4 cm prop, so they need a close camera.
// Studio light for this pair: under the cinematic rig the metalwork is almost
// black and the engraving cannot be read at all.
await page.evaluate(() => window.__setCinematic(false));
await page.evaluate(() => window.__setHuman(false));
await ready();
await page.evaluate(() => window.__setStaff({ glow: 0, extend: 0 }));
// Top cap centre: 0.9 (half length) - 0.108 (half cap) + 0.9 (base offset).
await page.evaluate(() => window.__focusOn([0, 1.692, 0], 0.5, 25, 4));
await page.waitForTimeout(700);
const macroOff = await shot();

await page.evaluate(() => window.__setStaff({ glow: 1 }));
await page.waitForTimeout(700);
const macroOn = await shot();

await strip([
  { buf: macroOff, text: 'cap + shaft detail  glow 0' },
  { buf: macroOn, text: 'cap + shaft detail  glow 1' },
], '_staff_detail.png');

// ---- 3. dragon_hover filmstrip
await page.evaluate(() => window.__setCinematic(false));
await page.evaluate(() => window.__setHuman(true));
await ready();
await page.evaluate(() => window.__showOne('chinese_dragon', 'dragon_hover'));
await ready();
await page.evaluate(() => window.__setView('side'));
await page.waitForTimeout(600);

const DUR = 8.0, N = 9, CW = 420, CH = 282;
const frames = [];
for (let i = 0; i < N; i++) {
  const t = (DUR * i) / (N - 1);
  await page.evaluate((x) => window.__setTime(x), t);
  await page.waitForTimeout(240);
  frames.push({ t, buf: await shot() });
}
const cells = await Promise.all(frames.map((f, i) => label(
  f.buf,
  i === 0 ? '0.00s (start)' : i === N - 1 ? '8.00s (= start)' : `${f.t.toFixed(2)}s`,
  CW, CH, i === 0 || i === N - 1 ? '#f0c060' : '#ffffff')));
await sharp({ create: { width: CW * 3, height: CH * 3, channels: 3, background: '#16171b' } })
  .composite(cells.map((input, i) => ({ input, left: (i % 3) * CW, top: Math.floor(i / 3) * CH })))
  .png().toFile(`${OUT}/_dragon_hover_filmstrip.png`);
console.log('wrote _dragon_hover_filmstrip.png');

await browser.close();
console.log('done');
