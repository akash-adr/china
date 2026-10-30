import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
function mul(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function xf(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}

const doc = await io.read('fantasy_style_tree.glb');
const scene = doc.getRoot().getDefaultScene();
const bins = new Map(); const barkBins = new Map();
// also track horizontal spread of leaf tris per bin
const walk = (node, parent) => {
  const m = mul(parent, node.getMatrix());
  const mesh = node.getMesh();
  if (mesh) for (const prim of mesh.listPrimitives()) {
    const isLeaf = (prim.getMaterial()?.getName() || '').includes('Leaf');
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : pos.getCount();
    const tgt = isLeaf ? bins : barkBins;
    for (let i = 0; i < n; i += 3) {
      let sy = 0;
      for (let k = 0; k < 3; k++) {
        const vi = idx ? idx.getScalar(i + k) : i + k;
        const p = pos.getElement(vi, []);
        sy += xf(m, p)[1];
      }
      const y = sy / 3;
      const b = Math.floor(y * 4) / 4; // 0.25 bins
      tgt.set(b, (tgt.get(b) || 0) + 1);
    }
  }
  for (const ch of node.listChildren()) walk(ch, m);
};
for (const n of scene.listChildren()) walk(n, [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);

const keys = [...new Set([...bins.keys(), ...barkBins.keys()])].sort((a,b)=>a-b);
let cumLeaf = 0;
const totalLeaf = [...bins.values()].reduce((a,b)=>a+b,0);
console.log('  y      leafTris    cum%   barkTris');
for (const k of keys) {
  const l = bins.get(k) || 0; cumLeaf += l;
  if (k > 3) break;
  console.log(`${String(k).padStart(6)} ${String(l).padStart(10)} ${(cumLeaf/totalLeaf*100).toFixed(1).padStart(6)}% ${String(barkBins.get(k)||0).padStart(10)}`);
}
console.log('total leaf tris', totalLeaf, 'total bark tris', [...barkBins.values()].reduce((a,b)=>a+b,0));
