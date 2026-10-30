import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__pathState, { timeout: 30000 });
const chapters = await p.evaluate(() => window.__chapters);
for (const c of chapters) {
  for (const [k, v] of [['start', c.marks.start], ['hold', c.marks.hold], ['end', c.marks.end]]) {
    const s = await p.evaluate((x) => window.__pathState(x), v);
    console.log(`ch${c.index} ${k.padEnd(5)} p=${s.progress.toFixed(3)} t=${s.pathT.toFixed(3)}  cam=[${s.camera.join(', ')}]  aim=[${s.lookAt.join(', ')}]`);
  }
}
await b.close();
