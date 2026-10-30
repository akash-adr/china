import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chromium', args: ['--use-gl=angle','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await p.goto('http://localhost:5180/?capture=1', { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__sceneStats, { timeout: 60000 });
await p.waitForTimeout(3000);

const out = await p.evaluate(async () => {
  const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
  const loader = new GLTFLoader();
  const d = new DRACOLoader();
  d.setDecoderPath('/draco/');
  loader.setDRACOLoader(d);
  try {
    const gltf = await loader.loadAsync('/models/chinese_dragon.glb');
    let meshes = 0, skinned = 0;
    const names = [];
    gltf.scene.traverse((o) => {
      if (o.isSkinnedMesh) skinned++;
      if (o.isMesh) { meshes++; if (names.length < 8) names.push(o.name || o.type); }
    });
    return { ok: true, meshes, skinned, names,
      clips: gltf.animations.map((a) => `${a.name}:${a.duration.toFixed(2)}`),
      children: gltf.scene.children.length };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
});
console.log(JSON.stringify(out, null, 1));
await b.close();
