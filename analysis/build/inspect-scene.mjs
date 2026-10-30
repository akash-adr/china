import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0,200)));
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__sceneStats, { timeout: 60000 });
await p.waitForFunction(() => document.querySelector('.loading-screen')?.dataset.done === 'true', { timeout: 180000 });
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(() => window.__sceneStats()), null, 1));
// is the staff there?
console.log(JSON.stringify(await p.evaluate(() => {
  const out = [];
  // walk via the stats hook's scene by re-traversing
  return out;
})));
await b.close();
