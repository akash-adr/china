// Per-chapter FPS and renderer stats, measured while the camera sits in each
// chapter's hold. Runs in capture mode so every chapter is mounted and the
// numbers are not distorted by streaming.
import { chromium } from 'playwright';
import fs from 'node:fs';

const b = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));

await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__gotoProgress && !!window.__sceneStats, { timeout: 60000 });
// Let every chapter's assets finish before measuring anything.
await p.waitForFunction(() => {
  const el = document.querySelector('.loading-screen');
  return el && el.dataset.done === 'true';
}, { timeout: 180000 });
await p.waitForTimeout(2500);

const chapters = await p.evaluate(() => window.__chapters);
const rows = [];

for (const c of chapters) {
  // Sample across the chapter, not just the hold: the heaviest frame is often
  // the entry, where the previous chapter is still in view.
  const samples = [c.marks.start, c.marks.hold, c.marks.end];
  const perSample = [];
  for (const sp of samples) {
    await p.evaluate((v) => window.__gotoProgress(v), sp);
    await p.waitForTimeout(900);
    perSample.push(await p.evaluate(async () => {
      const f = [];
      let last = performance.now();
      await new Promise((done) => {
        const t0 = performance.now();
        const loop = () => {
          const n = performance.now(); f.push(n - last); last = n;
          if (n - t0 < 2500) requestAnimationFrame(loop); else done();
        };
        requestAnimationFrame(loop);
      });
      const s = f.slice(4).sort((x, y) => x - y);
      const mean = s.reduce((x, y) => x + y, 0) / s.length;
      return {
        meanFps: 1000 / mean,
        minFps: 1000 / s[s.length - 1],
        ...window.__rendererInfo(),
      };
    }));
  }
  const meanFps = perSample.reduce((a, r) => a + r.meanFps, 0) / perSample.length;
  const minFps = Math.min(...perSample.map((r) => r.minFps));
  const peak = perSample.reduce((a, r) => (r.triangles > a.triangles ? r : a), perSample[0]);
  rows.push({
    chapter: c.index, title: c.subtitle,
    meanFps: +meanFps.toFixed(1), minFps: +minFps.toFixed(1),
    calls: peak.calls, triangles: peak.triangles,
    textures: peak.textures, geometries: peak.geometries, programs: peak.programs,
  });
  console.log(`ch${c.index} ${c.subtitle.padEnd(22)} ${meanFps.toFixed(1).padStart(5)} fps mean  ` +
    `${minFps.toFixed(1).padStart(5)} min  ${String(peak.calls).padStart(4)} calls  ` +
    `${peak.triangles.toLocaleString().padStart(10)} tris  ${String(peak.textures).padStart(3)} tex`);
}

fs.writeFileSync('analysis/data/phase2-perf.json', JSON.stringify(rows, null, 2));
await b.close();
