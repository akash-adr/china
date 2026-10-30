// Find the most loopable 6-8s window in the dragon's 57.5s clip, then cut it.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import fs from 'node:fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

const doc = await io.read('chinese_dragon.glb');
const anim = doc.getRoot().listAnimations()[0];
const channels = anim.listChannels();
const FPS = 30, MIN = 6, MAX = 8;

// Gather samplers with their time/value arrays.
const tracks = [];
for (const ch of channels) {
  const s = ch.getSampler();
  const input = s.getInput(), output = s.getOutput();
  if (!input || !output) continue;
  const times = input.getArray();
  const vals = output.getArray();
  const stride = output.getElementSize();
  tracks.push({ ch, sampler: s, times, vals, stride, path: ch.getTargetPath() });
}
const duration = Math.max(...tracks.map(t => t.times[t.times.length - 1]));
console.log(`clip "${anim.getName()}" duration ${duration.toFixed(2)}s, ${tracks.length} tracks`);

// Sample every track at a fixed rate (LINEAR, matching the source interpolation).
function sampleAt(tr, t) {
  const { times, vals, stride } = tr;
  let i = 0;
  while (i < times.length - 1 && times[i + 1] < t) i++;
  const t0 = times[i], t1 = times[Math.min(i + 1, times.length - 1)];
  const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
  const o = [];
  for (let k = 0; k < stride; k++) {
    const a = vals[i * stride + k], b = vals[Math.min(i + 1, times.length - 1) * stride + k];
    o.push(a + (b - a) * u);
  }
  return o;
}

const nFrames = Math.floor(duration * FPS) + 1;
const dim = tracks.reduce((a, t) => a + t.stride, 0);
const frames = new Float32Array(nFrames * dim);
// Weight rotations higher than translations - they carry the visible pose.
const weights = new Float32Array(dim);
{
  let o = 0;
  for (const tr of tracks) {
    const w = tr.path === 'rotation' ? 1.0 : tr.path === 'translation' ? 0.25 : 0.5;
    for (let k = 0; k < tr.stride; k++) weights[o + k] = w;
    o += tr.stride;
  }
}
for (let f = 0; f < nFrames; f++) {
  let o = f * dim;
  for (const tr of tracks) { const v = sampleAt(tr, f / FPS); for (const x of v) frames[o++] = x; }
}

// Pose distance between two frames.
function dist(f0, f1) {
  let s = 0;
  const a = f0 * dim, b = f1 * dim;
  for (let k = 0; k < dim; k++) { const d = (frames[a + k] - frames[b + k]) * weights[k]; s += d * d; }
  return Math.sqrt(s / dim);
}
// Velocity continuity: pose change entering t0 should match the change entering t1.
function velDist(f0, f1) {
  if (f0 === 0 || f1 === 0) return Infinity;
  let s = 0;
  const a = f0 * dim, b = f1 * dim, pa = (f0-1) * dim, pb = (f1-1) * dim;
  for (let k = 0; k < dim; k++) {
    const d = ((frames[a+k]-frames[pa+k]) - (frames[b+k]-frames[pb+k])) * weights[k];
    s += d * d;
  }
  return Math.sqrt(s / dim);
}

// Cumulative path length, so motion inside a window is a cheap difference.
const step = new Float64Array(nFrames);
for (let f = 1; f < nFrames; f++) step[f] = step[f-1] + dist(f-1, f);
const motionIn = (f0, f1) => step[f1] - step[f0];

const cands = [];
for (let f0 = 1; f0 + MIN * FPS < nFrames; f0++) {
  for (let len = MIN * FPS; len <= MAX * FPS; len++) {
    const f1 = f0 + len;
    if (f1 >= nFrames) break;
    const pose = dist(f0, f1), vel = velDist(f0, f1);
    cands.push({ f0, f1, len, pose, vel, seam: pose + vel * 0.5, motion: motionIn(f0, f1) });
  }
}
// A seamless loop of a near-static hold is useless for an "awakening" beat, so
// require a tight seam and then take the liveliest window that qualifies.
const SEAM_MAX = 0.5; // vs ~8.16 mean distance between arbitrary frames
const ok = cands.filter(c => c.seam < SEAM_MAX);
ok.sort((a, b) => b.motion - a.motion);
const bySeam = [...cands].sort((a, b) => a.seam - b.seam);

const table = (title, list) => {
  console.log('\n' + title);
  console.log('   start      end     len     seam      motion');
  const seen = [];
  for (const c of list) {
    if (seen.some(s => Math.abs(s.f0 - c.f0) < FPS * 2)) continue;
    seen.push(c);
    console.log(`  ${(c.f0/FPS).toFixed(2).padStart(6)}s ${(c.f1/FPS).toFixed(2).padStart(7)}s ` +
      `${(c.len/FPS).toFixed(2).padStart(6)}s ${c.seam.toFixed(5).padStart(9)} ${c.motion.toFixed(2).padStart(10)}`);
    if (seen.length >= 6) break;
  }
  return seen;
};
table('tightest seam (what we picked before - note the motion column):', bySeam);
const seen = table(`liveliest window with seam < ${SEAM_MAX}:`, ok);
console.log(`\n${ok.length} of ${cands.length} windows have a seam under ${SEAM_MAX}`);
// Reference: how different are two random frames, for scale?
let ref = 0; for (let i = 0; i < 200; i++) ref += dist((i*7)%nFrames, (i*23)%nFrames);
console.log(`\n(mean distance between arbitrary frames, for scale: ${(ref/200).toFixed(5)})`);
fs.writeFileSync('analysis/data/dragon-loop-candidates.json', JSON.stringify(seen, null, 2));
