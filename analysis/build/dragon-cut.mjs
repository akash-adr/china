import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import path from 'node:path';

const [STAGE, T0, T1] = [process.argv[2], +process.argv[3], +process.argv[4]];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const doc = await io.read('chinese_dragon.glb');
const buffer = doc.getRoot().listBuffers()[0];
const anim = doc.getRoot().listAnimations()[0];

function lerpAt(times, vals, stride, t) {
  let i = 0;
  while (i < times.length - 1 && times[i + 1] < t) i++;
  const j = Math.min(i + 1, times.length - 1);
  const t0 = times[i], t1 = times[j];
  const u = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
  const o = [];
  for (let k = 0; k < stride; k++) {
    const a = vals[i * stride + k], b = vals[j * stride + k];
    o.push(a + (b - a) * u);
  }
  return o;
}

const done = new Set();
let keptKeys = 0, srcKeys = 0;
for (const ch of anim.listChannels()) {
  const s = ch.getSampler();
  if (done.has(s)) continue;
  done.add(s);
  const input = s.getInput(), output = s.getOutput();
  const times = Array.from(input.getArray());
  const vals = output.getArray();
  const stride = output.getElementSize();
  srcKeys += times.length;

  const newT = [T0], newV = [lerpAt(times, vals, stride, T0)];
  for (let i = 0; i < times.length; i++) {
    if (times[i] > T0 + 1e-6 && times[i] < T1 - 1e-6) {
      newT.push(times[i]);
      newV.push(Array.from(vals.slice(i * stride, (i + 1) * stride)));
    }
  }
  newT.push(T1);
  newV.push(lerpAt(times, vals, stride, T1));

  // Seamless loop: final key exactly equals the first.
  newV[newV.length - 1] = newV[0].slice();

  const flatT = new Float32Array(newT.map(t => t - T0));
  const flatV = new Float32Array(newV.flat());
  keptKeys += newT.length;

  const ai = doc.createAccessor().setArray(flatT).setBuffer(buffer);
  const ao = doc.createAccessor().setArray(flatV).setType(output.getType()).setBuffer(buffer);
  s.setInput(ai).setOutput(ao);
  input.dispose(); output.dispose();
}
anim.setName(`dragon_loop_${(T1 - T0).toFixed(2)}s`);
console.log(`cut ${T0}s..${T1}s (${(T1-T0).toFixed(2)}s); keyframes ${srcKeys} -> ${keptKeys}`);
await io.write(path.join(STAGE, 'chinese_dragon.glb'), doc);
