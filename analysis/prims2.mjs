import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

function mul(a, b) { // 4x4 column-major multiply
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) o[c*4+r] += a[k*4+r] * b[c*4+k];
  return o;
}
function xf(m, p) {
  return [
    m[0]*p[0] + m[4]*p[1] + m[8]*p[2] + m[12],
    m[1]*p[0] + m[5]*p[1] + m[9]*p[2] + m[13],
    m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14],
  ];
}

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  console.log('=== ' + file);
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const rows = [];
  const walk = (node, parent) => {
    const m = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const lo = pos.getMin([]), hi = pos.getMax([]);
      // transform all 8 corners
      let wmin = [Infinity,Infinity,Infinity], wmax = [-Infinity,-Infinity,-Infinity];
      for (let i = 0; i < 8; i++) {
        const c = xf(m, [i&1?hi[0]:lo[0], i&2?hi[1]:lo[1], i&4?hi[2]:lo[2]]);
        for (let a = 0; a < 3; a++) { wmin[a] = Math.min(wmin[a], c[a]); wmax[a] = Math.max(wmax[a], c[a]); }
      }
      const idx = prim.getIndices();
      rows.push({
        mesh: mesh.getName() || '?', mat: prim.getMaterial()?.getName() || 'none',
        tris: Math.round(idx ? idx.getCount()/3 : pos.getCount()/3),
        y0: wmin[1], y1: wmax[1],
        dim: [wmax[0]-wmin[0], wmax[1]-wmin[1], wmax[2]-wmin[2]],
      });
    }
    for (const ch of node.listChildren()) walk(ch, m);
  };
  for (const n of scene.listChildren()) walk(n, [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  rows.forEach((r, i) => {
    const h = r.dim[1], foot = Math.max(r.dim[0], r.dim[2]);
    console.log(`  [${i}] ${r.mesh.padEnd(26)} ${r.mat.padEnd(14)} tris=${String(r.tris).padStart(7)} ` +
      `worldY=[${r.y0.toFixed(2)}..${r.y1.toFixed(2)}] h=${h.toFixed(2)} footprint=${foot.toFixed(2)} ` +
      `h/foot=${(h/foot).toFixed(3)}`);
  });
}
