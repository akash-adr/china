import { chromium } from 'playwright';
import fs from 'node:fs';
const targets = process.argv.slice(2).map(Number);
const b = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:5180/?capture=1&clean=nohud', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__gotoProgress, { timeout: 60000 });
await p.waitForFunction(() => document.querySelector('.loading-screen')?.dataset.done === 'true', { timeout: 180000 });
await p.waitForTimeout(2000);
for (const t of targets) {
  await p.evaluate((v) => window.__gotoProgress(v), t);
  await p.waitForTimeout(1000);
  const f = `analysis/site-shots/spot_${String(t).replace('.', '_')}.png`;
  fs.writeFileSync(f, await p.screenshot());
  console.log('wrote', f, await p.evaluate((v) => JSON.stringify(window.__pathState(v)), t));
}
await b.close();
