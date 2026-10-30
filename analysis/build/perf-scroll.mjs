// Per-chapter numbers as actually experienced: normal mode (so lazy loading
// applies), scrolling the whole page once, bucketing every frame by chapter.
import { chromium } from 'playwright';
import fs from 'node:fs';

const b = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('  [pageerror]', String(e).slice(0, 200)));

await p.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__chapters && !!window.__rendererInfo, { timeout: 60000 });
await p.waitForTimeout(3000);

const DURATION = 45000;
const result = await p.evaluate(async (duration) => {
  const ranges = window.__chapters.map((c) => c.range);
  const chapterAt = (v) => {
    for (let i = ranges.length - 1; i >= 0; i--) if (v >= ranges[i].start) return i;
    return 0;
  };
  const buckets = ranges.map(() => ({ frames: [], calls: 0, tris: 0, tex: 0, geo: 0, prog: 0 }));

  let last = performance.now();
  let running = true;
  const loop = () => {
    const now = performance.now();
    const dt = now - last; last = now;
    const i = chapterAt(window.__progressValue());
    const bkt = buckets[i];
    bkt.frames.push(dt);
    const info = window.__rendererInfo();
    bkt.calls = Math.max(bkt.calls, info.calls);
    bkt.tris = Math.max(bkt.tris, info.triangles);
    bkt.tex = Math.max(bkt.tex, info.textures);
    bkt.geo = Math.max(bkt.geo, info.geometries);
    bkt.prog = Math.max(bkt.prog, info.programs);
    if (running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const total = document.body.scrollHeight - innerHeight;
  const t0 = performance.now();
  while (performance.now() - t0 < duration) {
    window.scrollTo(0, total * ((performance.now() - t0) / duration));
    await new Promise((r) => requestAnimationFrame(r));
  }
  running = false;

  return buckets.map((bkt, i) => {
    const s = bkt.frames.slice(3).sort((a, b) => a - b);
    const mean = s.reduce((a, b) => a + b, 0) / (s.length || 1);
    return {
      chapter: i + 1,
      title: window.__chapters[i].subtitle,
      frames: s.length,
      meanFps: +(1000 / mean).toFixed(1),
      minFps: +(1000 / (s[s.length - 1] || 1)).toFixed(1),
      p95Fps: +(1000 / (s[Math.floor(s.length * 0.95)] || 1)).toFixed(1),
      calls: bkt.calls, triangles: bkt.tris,
      textures: bkt.tex, geometries: bkt.geo, programs: bkt.prog,
    };
  });
}, DURATION);

for (const r of result) {
  console.log(`ch${r.chapter} ${r.title.padEnd(22)} mean ${String(r.meanFps).padStart(5)}  ` +
    `p95 ${String(r.p95Fps).padStart(5)}  min ${String(r.minFps).padStart(5)}  ` +
    `${String(r.calls).padStart(4)} calls  ${r.triangles.toLocaleString().padStart(10)} tris  ` +
    `${String(r.textures).padStart(3)} tex  ${r.frames} frames`);
}
fs.writeFileSync('analysis/data/phase2-scroll-perf.json', JSON.stringify(result, null, 2));
await b.close();
