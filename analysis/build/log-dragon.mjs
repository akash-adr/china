import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', (m) => { const t = m.text(); if (t.includes('AnimatedDragon') || m.type()==='error') console.log(`[${m.type()}]`, t.slice(0,300)); });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0,300)));
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('.loading-screen')?.dataset.done === 'true', { timeout: 180000 });
await p.waitForTimeout(2500);
await b.close();
