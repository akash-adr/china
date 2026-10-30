import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__chapters, { timeout: 30000 });
await p.waitForTimeout(2500);

const measure = (label) => p.evaluate(async (l) => {
  const f = [];
  let last = performance.now();
  await new Promise((done) => {
    const loop = () => {
      const now = performance.now();
      f.push(now - last); last = now;
      if (now - start < 4000) requestAnimationFrame(loop); else done();
    };
    const start = performance.now();
    requestAnimationFrame(loop);
  });
  const s = f.slice(5).sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return { label: l, frames: s.length, meanFps: +(1000/mean).toFixed(1), medianMs: +s[Math.floor(s.length/2)].toFixed(1) };
}, label);

console.log(JSON.stringify(await measure('idle at top'), null, 1));
await p.evaluate(() => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * 0.5));
await p.waitForTimeout(2500);
console.log(JSON.stringify(await measure('idle mid-page'), null, 1));

// renderer info
console.log(JSON.stringify(await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const gl = c?.getContext('webgl2') || c?.getContext('webgl');
  const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
  return {
    canvas: c ? `${c.width}x${c.height}` : null,
    dpr: window.devicePixelRatio,
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
  };
}), null, 1));
await b.close();
