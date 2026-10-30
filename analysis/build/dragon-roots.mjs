import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const anim = root.listAnimations()[0];
console.log('clip:', anim.getName());

// depth of each node
const depth = new Map();
const scene = root.getDefaultScene() || root.listScenes()[0];
const walk = (n, d) => { depth.set(n, d); for (const c of n.listChildren()) walk(c, d + 1); };
for (const n of scene.listChildren()) walk(n, 0);

const byPath = {};
for (const ch of anim.listChannels()) {
  const p = ch.getTargetPath();
  (byPath[p] ??= []).push(ch);
}
console.log('channels by path:', Object.entries(byPath).map(([k, v]) => `${k}=${v.length}`).join(', '));

// translation channels, shallowest first, with how far each one travels
const rows = [];
for (const ch of byPath.translation ?? []) {
  const node = ch.getTargetNode();
  const out = ch.getSampler().getOutput();
  const a = out.getArray();
  const n = out.getCount();
  let min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const v = a[i*3+k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
  }
  const travel = Math.hypot(max[0]-min[0], max[1]-min[1], max[2]-min[2]);
  rows.push({ name: node.getName() || '?', depth: depth.get(node) ?? -1, keys: n, travel,
    range: [max[0]-min[0], max[1]-min[1], max[2]-min[2]] });
}
rows.sort((a, b) => b.travel - a.travel);
console.log('\ntranslation channels that actually move (top 10 by distance travelled):');
for (const r of rows.slice(0, 10)) {
  console.log(`  depth=${String(r.depth).padStart(2)} keys=${String(r.keys).padStart(5)} travel=${r.travel.toFixed(1).padStart(9)}  xyz span=[${r.range.map(v=>v.toFixed(1)).join(', ')}]  ${r.name}`);
}
const moving = rows.filter(r => r.travel > 1);
console.log(`\n${moving.length} of ${rows.length} translation channels move more than 1 unit`);
