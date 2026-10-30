import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { ImageUtils } from '@gltf-transform/core';
import fs from 'node:fs';
import path from 'node:path';

import draco3d from 'draco3d';
import { MeshoptDecoder } from 'meshoptimizer';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.decoder': MeshoptDecoder,
});
const files = process.argv.slice(2);
const out = [];

function triCount(prim) {
  const mode = prim.getMode();
  const idx = prim.getIndices();
  const pos = prim.getAttribute('POSITION');
  const n = idx ? idx.getCount() : (pos ? pos.getCount() : 0);
  switch (mode) {
    case 4: return Math.floor(n / 3);        // TRIANGLES
    case 5: case 6: return Math.max(0, n - 2); // STRIP / FAN
    default: return 0;                        // points/lines
  }
}

for (const file of files) {
  const rec = { file: path.basename(file), path: file, warnings: [] };
  rec.sizeMB = +(fs.statSync(file).size / 1048576).toFixed(2);
  let doc;
  try {
    doc = await io.read(file);
  } catch (e) {
    rec.error = String(e.message || e);
    out.push(rec); continue;
  }
  const root = doc.getRoot();
  rec.generator = root.getAsset().generator || null;
  rec.extensions = doc.getRoot().listExtensionsUsed().map(e => e.extensionName);

  // meshes / prims
  const meshes = root.listMeshes();
  let rawTris = 0, rawVerts = 0, prims = 0;
  const modes = new Set();
  for (const m of meshes) for (const p of m.listPrimitives()) {
    prims++; modes.add(p.getMode());
    rawTris += triCount(p);
    const pos = p.getAttribute('POSITION');
    if (pos) rawVerts += pos.getCount();
  }
  rec.meshes = meshes.length;
  rec.primitives = prims;
  rec.primitiveModes = [...modes];
  rec.rawTriangles = rawTris;
  rec.rawVertices = rawVerts;

  // scene-instanced counts (a mesh used by N nodes renders N times)
  const useCount = new Map();
  for (const node of root.listNodes()) {
    const m = node.getMesh();
    if (m) useCount.set(m, (useCount.get(m) || 0) + 1);
  }
  let sceneTris = 0, sceneVerts = 0;
  for (const [m, c] of useCount) {
    for (const p of m.listPrimitives()) {
      sceneTris += triCount(p) * c;
      const pos = p.getAttribute('POSITION');
      if (pos) sceneVerts += pos.getCount() * c;
    }
  }
  rec.sceneTriangles = sceneTris;
  rec.sceneVertices = sceneVerts;
  rec.nodes = root.listNodes().length;
  rec.drawCalls = [...useCount.entries()].reduce((a, [m, c]) => a + m.listPrimitives().length * c, 0);

  // materials
  const mats = root.listMaterials();
  rec.materials = mats.length;
  rec.materialNames = mats.slice(0, 40).map(m => m.getName() || '(unnamed)');
  rec.alphaModes = [...new Set(mats.map(m => m.getAlphaMode()))];
  rec.doubleSided = mats.filter(m => m.getDoubleSided()).length;
  const slots = new Set();
  for (const m of mats) {
    if (m.getBaseColorTexture()) slots.add('baseColor');
    if (m.getNormalTexture()) slots.add('normal');
    if (m.getMetallicRoughnessTexture()) slots.add('metallicRoughness');
    if (m.getOcclusionTexture()) slots.add('occlusion');
    if (m.getEmissiveTexture()) slots.add('emissive');
  }
  rec.textureSlots = [...slots];

  // textures
  const texs = root.listTextures();
  rec.textures = texs.length;
  let texBytes = 0, vramBytes = 0;
  rec.textureList = texs.map(t => {
    const img = t.getImage();
    const mime = t.getMimeType();
    let size = null;
    try { size = img ? ImageUtils.getSize(img, mime) : null; } catch { size = null; }
    const bytes = img ? img.byteLength : 0;
    texBytes += bytes;
    if (size) vramBytes += size[0] * size[1] * 4 * 1.33; // rgba + mips
    if (!img) rec.warnings.push(`texture "${t.getName() || '?'}" has no image data`);
    return {
      name: t.getName() || '(unnamed)',
      mime, res: size ? `${size[0]}x${size[1]}` : 'unknown',
      px: size ? size[0] * size[1] : 0,
      kb: +(bytes / 1024).toFixed(0),
      npot: size ? !(isPow2(size[0]) && isPow2(size[1])) : null,
    };
  }).sort((a, b) => b.px - a.px);
  rec.textureBytesMB = +(texBytes / 1048576).toFixed(2);
  rec.textureVramMB = +(vramBytes / 1048576).toFixed(1);
  rec.maxTextureRes = rec.textureList[0]?.res ?? 'none';

  // animations & skinning
  const anims = root.listAnimations();
  rec.animations = anims.map(a => {
    let dur = 0;
    for (const s of a.listSamplers()) {
      const inp = s.getInput();
      if (!inp) continue;
      const arr = inp.getArray();
      if (arr && arr.length) dur = Math.max(dur, arr[arr.length - 1]);
    }
    return {
      name: a.getName() || '(unnamed)',
      duration: +dur.toFixed(2),
      channels: a.listChannels().length,
      interpolations: [...new Set(a.listSamplers().map(s => s.getInterpolation()))],
    };
  });
  rec.skins = root.listSkins().length;
  rec.jointCount = root.listSkins().reduce((a, s) => Math.max(a, s.listJoints().length), 0);
  rec.skinned = rec.skins > 0;
  rec.morphTargets = meshes.reduce((a, m) =>
    a + m.listPrimitives().reduce((b, p) => b + p.listTargets().length, 0), 0);

  // bounds (world space, default scene)
  const scene = root.getDefaultScene() || root.listScenes()[0];
  try {
    const b = getBounds(scene);
    const dim = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const center = [(b.max[0] + b.min[0]) / 2, (b.max[1] + b.min[1]) / 2, (b.max[2] + b.min[2]) / 2];
    rec.bbox = { min: b.min.map(r3), max: b.max.map(r3), dim: dim.map(r3), center: center.map(r3) };
    const maxDim = Math.max(...dim);
    rec.maxDim = r3(maxDim);
    // pivot analysis: where is origin relative to bbox
    const rel = {
      x: (0 - b.min[0]) / (dim[0] || 1),
      y: (0 - b.min[1]) / (dim[1] || 1),
      z: (0 - b.min[2]) / (dim[2] || 1),
    };
    rec.originRel = { x: r3(rel.x), y: r3(rel.y), z: r3(rel.z) };
    const near = (v, t) => Math.abs(v - t) < 0.08;
    const inside = v => v >= -0.05 && v <= 1.05;
    let pivot;
    if (!inside(rel.x) || !inside(rel.y) || !inside(rel.z)) pivot = 'offset outside bounds';
    else if (near(rel.y, 0) && near(rel.x, 0.5) && near(rel.z, 0.5)) pivot = 'at base, horizontally centered';
    else if (near(rel.y, 0.5) && near(rel.x, 0.5) && near(rel.z, 0.5)) pivot = 'fully centered';
    else if (near(rel.y, 0)) pivot = 'at base, horizontally offset';
    else pivot = 'offset inside bounds';
    rec.pivot = pivot;
    // up axis heuristic: tallest axis among y/z for an upright object
    rec.upAxisGuess = dim[1] >= dim[2] ? 'Y (glTF standard)' : 'possibly Z-up (depth > height)';
    rec.scaleNote = scaleNote(maxDim);
  } catch (e) {
    rec.warnings.push('bounds failed: ' + e.message);
  }

  // top-level transforms
  rec.rootNodes = scene.listChildren().map(n => ({
    name: n.getName() || '(unnamed)',
    t: n.getTranslation().map(r3), r: n.getRotation().map(r3), s: n.getScale().map(r3),
  })).slice(0, 10);

  // integrity checks
  for (const m of mats) {
    for (const [slot, tex] of [['baseColor', m.getBaseColorTexture()], ['normal', m.getNormalTexture()],
      ['metallicRoughness', m.getMetallicRoughnessTexture()], ['emissive', m.getEmissiveTexture()],
      ['occlusion', m.getOcclusionTexture()]]) {
      if (tex && !tex.getImage()) rec.warnings.push(`material "${m.getName()}" ${slot} texture missing image`);
    }
  }
  for (const m of meshes) for (const p of m.listPrimitives()) {
    if (!p.getAttribute('POSITION')) rec.warnings.push('primitive without POSITION');
    if (!p.getAttribute('NORMAL')) rec.warnings.push(`mesh "${m.getName()}" primitive has no NORMAL (flat shading)`);
    if (p.getMaterial() == null) rec.warnings.push(`mesh "${m.getName()}" primitive has no material`);
  }
  const npot = rec.textureList.filter(t => t.npot).length;
  if (npot) rec.warnings.push(`${npot} non-power-of-two texture(s)`);
  const huge = rec.textureList.filter(t => t.px >= 4096 * 4096).length;
  if (huge) rec.warnings.push(`${huge} texture(s) at 4K or larger`);
  rec.warnings = [...new Set(rec.warnings)];

  out.push(rec);
}

function isPow2(n) { return (n & (n - 1)) === 0; }
function r3(n) { return Math.round(n * 1000) / 1000; }
function scaleNote(maxDim) {
  if (maxDim < 0.2) return `tiny (${maxDim.toFixed(3)} units) — likely cm/mm authored, needs scaling up`;
  if (maxDim < 3) return `human/prop scale (${maxDim.toFixed(2)} units ≈ metres)`;
  if (maxDim < 60) return `architectural scale (${maxDim.toFixed(1)} units ≈ metres)`;
  return `very large (${maxDim.toFixed(0)} units) — likely cm units or oversized, scale down`;
}

fs.writeFileSync('analysis/data/inspect.json', JSON.stringify(out, null, 2));
console.log('wrote analysis/data/inspect.json for', out.length, 'files');
for (const r of out) console.log(`${r.file.padEnd(46)} ${String(r.sizeMB).padStart(7)}MB  tris=${String(r.sceneTriangles).padStart(9)}  mat=${String(r.materials).padStart(3)}  tex=${String(r.textures).padStart(3)}  anim=${r.animations?.length ?? 0}  warn=${r.warnings.length}${r.error ? '  ERROR: ' + r.error : ''}`);
