import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium',
  args: ['--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await p.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__chapters, { timeout: 30000 });
await p.waitForTimeout(2000);

const measure = () => p.evaluate(async () => {
  const f = []; let last = performance.now();
  await new Promise((done) => {
    const start = performance.now();
    const loop = () => { const n = performance.now(); f.push(n - last); last = n;
      if (n - start < 3000) requestAnimationFrame(loop); else done(); };
    requestAnimationFrame(loop);
  });
  const s = f.slice(5).sort((a,b)=>a-b);
  return +(1000 / (s.reduce((a,b)=>a+b,0)/s.length)).toFixed(1);
});

const apply = async (css) => {
  await p.evaluate((c) => {
    document.getElementById('probe')?.remove();
    const st = document.createElement('style'); st.id = 'probe';
    st.textContent = c; document.head.appendChild(st);
  }, css);
  await p.waitForTimeout(700);
};

const cases = [
  ['baseline (both animations + filter)', ''],
  ['filter + shimmer only', '.gold-glow{animation:gold-shimmer 9s infinite !important}'],
  ['filter + flicker only', '.gold-glow{animation:ember-flicker 5.5s ease-in-out infinite !important}'],
  ['text-shadow glow + both animations',
   '.gold-glow{filter:none !important;text-shadow:0 0 .12em rgba(255,243,196,.35),0 0 .7em rgba(201,162,74,.28),0 0 1.9em rgba(255,138,61,.16) !important}'],
];
for (const [label, css] of cases) {
  await apply(css);
  console.log(label.padEnd(38), await measure(), 'fps');
}
await b.close();
