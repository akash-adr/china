import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const MODELS = JSON.parse(fs.readFileSync('analysis/preview/models.json', 'utf8'));
const VIEWS = ['front', 'side', 'three_quarter'];
const OUT = 'analysis/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1.5 });
page.on('console', m => { if (m.type() === 'error') console.log('  [console]', m.text().slice(0, 200)); });

await page.goto('http://localhost:5178/?clean', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__loadModel, { timeout: 30000 });

const results = [];
for (const name of MODELS) {
  process.stdout.write(`${name} … `);
  const t0 = Date.now();
  const rec = { model: name, shots: [] };
  try {
    await page.evaluate(n => window.__loadModel(n), name);
    await page.waitForFunction(() => window.__ready === true, { timeout: 180000 });
    rec.loadMs = Date.now() - t0;
    rec.error = await page.evaluate(() => window.__error || null);
    for (const v of VIEWS) {
      await page.evaluate(x => window.__setView(x), v);
      await page.waitForTimeout(700);
      const file = path.join(OUT, `${name}__${v}.png`);
      await page.locator('#stage').screenshot({ path: file });
      rec.shots.push(file);
    }
    console.log(`ok (${rec.loadMs}ms)`);
  } catch (e) {
    rec.error = String(e.message).slice(0, 300);
    console.log('FAILED:', rec.error);
  }
  await page.evaluate(() => { window.__error = null; });
  results.push(rec);
}
fs.writeFileSync('analysis/data/shots.json', JSON.stringify(results, null, 2));
await browser.close();
console.log('done');
