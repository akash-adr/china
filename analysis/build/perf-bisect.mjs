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
      if (n - start < 3500) requestAnimationFrame(loop); else done(); };
    requestAnimationFrame(loop);
  });
  const s = f.slice(5).sort((a,b)=>a-b);
  return +(1000 / (s.reduce((a,b)=>a+b,0)/s.length)).toFixed(1);
});

console.log('baseline                        ', await measure(), 'fps');

await p.evaluate(() => {
  const st = document.createElement('style'); st.id = 'k1';
  st.textContent = '.gold-glow{filter:none !important}';
  document.head.appendChild(st);
});
await p.waitForTimeout(600);
console.log('drop-shadow filters off         ', await measure(), 'fps');

await p.evaluate(() => {
  const st = document.createElement('style'); st.id = 'k2';
  st.textContent = '.gold-glow{animation:none !important}';
  document.head.appendChild(st);
});
await p.waitForTimeout(600);
console.log('filters + shimmer/flicker off   ', await measure(), 'fps');

await p.evaluate(() => {
  document.getElementById('k1')?.remove();
});
await p.waitForTimeout(600);
console.log('filters ON, animation off       ', await measure(), 'fps');

await p.evaluate(() => {
  document.getElementById('k2')?.remove();
  const st = document.createElement('style'); st.id = 'k3';
  st.textContent = ".chapter-title:not([data-active='true']){visibility:hidden}";
  document.head.appendChild(st);
});
await p.waitForTimeout(600);
console.log('all on, inactive titles hidden  ', await measure(), 'fps');
await b.close();
