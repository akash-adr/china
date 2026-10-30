// Same capture process as analysis/shoot.mjs, pointed at the new candidates,
// which are served straight from disk via Vite's /@fs/ route.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/akash/Documents/vs/china';
const HIDE = { japanese_cherrybake: ['sky'] };
const FILES = [
  'ancient_ruins.glb',
  'broken_medieval_column_set.glb',
  'cool_staff.glb',
  'stylized_rock.glb',
  'stylized_rock-2.glb',
  'stylized_rock-3.glb',
  'torri_gate.glb',
  'black-myth-wukong-kangjinlongfrom-the-vault/source/kjwl.glb',
  'pagoda-and-cherry-blossom-game-scene-baked/source/japanese_cherrybake.glb',
];
const VIEWS = ['front', 'side', 'three_quarter'];
const OUT = 'analysis/screenshots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1.5 });
page.on('console', m => { if (m.type() === 'error') console.log('  [err]', m.text().slice(0, 160)); });

await page.goto('http://localhost:5178/?clean=nohud', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__showRaw, { timeout: 30000 });

const results = [];
for (const rel of FILES) {
  const name = path.basename(rel, '.glb');
  const url = '/@fs' + path.join(ROOT, rel);
  process.stdout.write(name + ' … ');
  const rec = { file: rel, name, shots: [] };
  const t0 = Date.now();
  try {
    await page.evaluate(([u, h]) => window.__showRaw(u, 2, h), [url, HIDE[name] || []]);
    await page.waitForFunction(() => window.__ready === true, { timeout: 240000 });
    rec.loadMs = Date.now() - t0;
    rec.error = await page.evaluate(() => window.__error || null);
    if (rec.error) throw new Error(rec.error);
    for (const v of VIEWS) {
      await page.evaluate(x => window.__setView(x), v);
      await page.waitForTimeout(650);
      const f = `${OUT}/${name}__${v}.png`;
      await page.locator('#stage').screenshot({ path: f });
      rec.shots.push(f);
    }
    console.log(`ok (${rec.loadMs}ms)`);
  } catch (e) {
    rec.error = String(e.message).slice(0, 300);
    console.log('FAILED:', rec.error);
  }
  await page.evaluate(() => { window.__error = null; });
  results.push(rec);
}
fs.writeFileSync('analysis/data/shots-batch2.json', JSON.stringify(results, null, 2));
await browser.close();
console.log('done');
