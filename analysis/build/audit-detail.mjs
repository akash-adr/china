import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__auditPath, { timeout: 30000 });
const hits = await p.evaluate(() => window.__auditPath(1500, 2.0));
for (const h of hits) console.log(JSON.stringify(h));
await b.close();
