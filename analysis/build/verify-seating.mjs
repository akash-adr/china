import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('.loading-screen')?.dataset.done === 'true', { timeout: 180000 });
await p.waitForTimeout(2000);
const rows = await p.evaluate(() => window.__verifySeating());
for (const r of rows) {
  const flag = r.ok ? 'ok  ' : 'FAIL';
  console.log(`${flag} ${r.id.padEnd(32)} world=[${r.size.join(' x ')}] expected=[${r.expected.join(' x ')}] baseY=${r.baseY}`);
}
console.log(rows.every((r) => r.ok) ? '\nall models match config scale and seating' : '\nMISMATCHES ABOVE');
await b.close();
