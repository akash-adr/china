import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__chapters, { timeout: 30000 });
await p.waitForTimeout(2000);

// Scroll the whole page over ~12s and sample the frame rate while it moves.
const result = await p.evaluate(async () => {
  const frames = [];
  let last = performance.now();
  let running = true;
  const loop = () => {
    const now = performance.now();
    frames.push(now - last);
    last = now;
    if (running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const total = document.body.scrollHeight - innerHeight;
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    const u = (performance.now() - t0) / 12000;
    window.scrollTo(0, total * u);
    await new Promise((r) => setTimeout(r, 16));
  }
  running = false;

  const sorted = frames.slice(10).sort((a, b) => a - b);
  const pct = (q) => sorted[Math.floor(sorted.length * q)];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return {
    samples: sorted.length,
    meanFps: +(1000 / mean).toFixed(1),
    p50Fps: +(1000 / pct(0.5)).toFixed(1),
    p95FrameMs: +pct(0.95).toFixed(1),
    worstFrameMs: +sorted[sorted.length - 1].toFixed(1),
  };
});
console.log(JSON.stringify(result, null, 2));
await b.close();
