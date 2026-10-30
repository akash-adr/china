import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__auditSummary, { timeout: 30000 });
const spans = await p.evaluate(() => window.__auditSummary(1500, 2.0));
console.log('prop'.padEnd(16), 'ch', 'from'.padStart(7), 'to'.padStart(7), 'minDist'.padStart(8));
for (const s of spans) {
  const flag = s.minDist < 0 ? '  <-- INSIDE' : s.minDist < 1 ? '  <-- grazing' : '';
  console.log(s.prop.padEnd(16), String(s.chapter).padStart(2),
    s.from.toFixed(3).padStart(7), s.to.toFixed(3).padStart(7),
    s.minDist.toFixed(2).padStart(8) + flag);
}
console.log('\ntotal spans:', spans.length, '| inside:', spans.filter(s=>s.minDist<0).length);
await b.close();
