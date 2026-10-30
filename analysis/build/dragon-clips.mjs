// Produce two named clips in one GLB:
//   dragon_flyby — the 8.00s loop as cut, root motion intact
//   dragon_hover — same performance with the root translation pinned, so the
//                  dragon writhes in place instead of flying out of frame.
// The hover clip reuses the flyby's accessors for all 558 unchanged channels;
// only the root's translation gets new (2-keyframe, constant) data. Without
// that sharing a second clip would roughly double the file.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import path from 'node:path';

const [SRC, DST] = [process.argv[2], process.argv[3]];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const doc = await io.read(SRC);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const flyby = root.listAnimations()[0];

// The root motion node: by far the largest travel of any translation channel.
let rootCh = null, best = -1;
for (const ch of flyby.listChannels()) {
  if (ch.getTargetPath() !== 'translation') continue;
  const a = ch.getSampler().getOutput().getArray();
  const n = ch.getSampler().getOutput().getCount();
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const v = a[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v;
  }
  const travel = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (travel > best) { best = travel; rootCh = ch; }
}
console.log(`root motion node: "${rootCh.getTargetNode().getName()}" travels ${best.toFixed(0)} units`);

const duration = Math.max(...flyby.listSamplers().map((s) => {
  const t = s.getInput()?.getArray(); return t ? t[t.length - 1] : 0;
}));
flyby.setName('dragon_flyby');

// Pin the root to its first keyframe for the whole clip.
// Pinning the root's translation alone is not enough: the body is ~5000 units
// long, so the root's own rotation swings it right out of frame regardless.
// Both the translation and the rotation of that node have to be held.
const rootNode = rootCh.getTargetNode();
const rootRotCh = flyby.listChannels().find(
  (c) => c.getTargetNode() === rootNode && c.getTargetPath() === 'rotation');

const pinIn = doc.createAccessor('hover_root_time')
  .setArray(new Float32Array([0, duration])).setBuffer(buffer);

const firstT = Array.from(rootCh.getSampler().getOutput().getArray().slice(0, 3));
const pinT = doc.createAccessor('hover_root_translation')
  .setArray(new Float32Array([...firstT, ...firstT])).setType('VEC3').setBuffer(buffer);
console.log(`pinning root translation to [${firstT.map((v) => v.toFixed(1)).join(', ')}]`);

let pinR = null;
if (rootRotCh) {
  const firstR = Array.from(rootRotCh.getSampler().getOutput().getArray().slice(0, 4));
  pinR = doc.createAccessor('hover_root_rotation')
    .setArray(new Float32Array([...firstR, ...firstR])).setType('VEC4').setBuffer(buffer);
  console.log(`pinning root rotation to [${firstR.map((v) => v.toFixed(3)).join(', ')}]`);
} else {
  console.log('no rotation channel on the root node');
}

const hover = doc.createAnimation('dragon_hover');
let shared = 0, replaced = 0;
for (const ch of flyby.listChannels()) {
  const src = ch.getSampler();
  const pinned = ch === rootCh ? pinT : (pinR && ch === rootRotCh ? pinR : null);
  const sampler = doc.createAnimationSampler()
    .setInterpolation(src.getInterpolation())
    .setInput(pinned ? pinIn : src.getInput())     // same accessor object = shared data
    .setOutput(pinned ?? src.getOutput());
  if (pinned) replaced++; else shared++;
  hover.addSampler(sampler);
  hover.addChannel(doc.createAnimationChannel()
    .setTargetNode(ch.getTargetNode())
    .setTargetPath(ch.getTargetPath())
    .setSampler(sampler));
}
console.log(`dragon_hover: ${shared} channels sharing flyby accessors, ${replaced} replaced`);
console.log(`clips now: ${root.listAnimations().map((a) => a.getName()).join(', ')} (${duration.toFixed(2)}s each)`);
await io.write(DST, doc);
