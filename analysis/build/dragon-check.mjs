import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text().slice(0,300)}`); });
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__sceneStats, { timeout: 60000 });
await p.waitForFunction(() => document.querySelector('.loading-screen')?.dataset.done === 'true', { timeout: 180000 });
await p.waitForTimeout(2000);

const net = await p.evaluate(async () => {
  const r = await fetch('/models/chinese_dragon.glb', { method: 'HEAD' });
  return { status: r.status, size: r.headers.get('content-length') };
});
console.log('chinese_dragon.glb HEAD:', JSON.stringify(net));
console.log('\nerrors/warnings:');
for (const e of [...new Set(errs)].slice(0, 12)) console.log(' -', e);
await b.close();
