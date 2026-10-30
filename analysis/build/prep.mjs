// Pre-passes that the gltf-transform CLI can't express.
// Reads originals read-only; writes intermediates to the staging dir given in argv[2].
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplifyPrimitive, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3d';
import path from 'node:path';

const STAGE = process.argv[2];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
await MeshoptSimplifier.ready;

const log = (...a) => console.log('   ', ...a);

function mul(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function xf(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];}
const I4 = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

function eachPrim(doc, fn) {
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const walk = (node, parent) => {
    const m = mul(parent, node.getMatrix());
    const mesh = node.getMesh();
    if (mesh) for (const prim of mesh.listPrimitives()) fn(prim, m, mesh);
    for (const ch of node.listChildren()) walk(ch, m);
  };
  for (const n of scene.listChildren()) walk(n, I4);
}

function triCount(prim) {
  const idx = prim.getIndices();
  return Math.round((idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3);
}
function totalTris(doc) {
  let t = 0; eachPrim(doc, p => { t += triCount(p); }); return t;
}

// Rebuild a primitive's index buffer from a keep-predicate over triangles.
function filterTriangles(doc, prim, keep) {
  const idx = prim.getIndices();
  const pos = prim.getAttribute('POSITION');
  const n = idx ? idx.getCount() : pos.getCount();
  const src = idx ? idx.getArray() : null;
  const out = [];
  for (let i = 0; i < n; i += 3) {
    const a = src ? src[i] : i, b = src ? src[i+1] : i+1, c = src ? src[i+2] : i+2;
    if (keep(a, b, c, i / 3)) out.push(a, b, c);
  }
  if (out.length === n) return 0;
  const removed = (n - out.length) / 3;
  if (!out.length) { prim.dispose(); return removed; }
  const Arr = pos.getCount() > 65535 ? Uint32Array : Uint16Array;
  const acc = doc.createAccessor().setArray(new Arr(out)).setBuffer(doc.getRoot().listBuffers()[0]);
  prim.setIndices(acc);
  if (idx) idx.dispose();
  return removed;
}

// Union-find over a primitive's triangles, joined where they share a vertex index.
// Each connected component of a leaf mesh is one leaf card.
function components(prim) {
  const idx = prim.getIndices();
  const pos = prim.getAttribute('POSITION');
  const n = idx ? idx.getCount() : pos.getCount();
  const src = idx ? idx.getArray() : null;
  const parent = new Int32Array(pos.getCount()).fill(-1);
  const find = x => { while (parent[x] >= 0) { if (parent[parent[x]] >= 0) parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (let i = 0; i < n; i += 3) {
    const a = src ? src[i] : i, b = src ? src[i+1] : i+1, c = src ? src[i+2] : i+2;
    union(a, b); union(b, c);
  }
  return { find, src, n };
}

// Deterministic hash so a run is reproducible.
function hash32(x) { x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }

// ---------------------------------------------------------------- pagoda
async function pagoda() {
  const doc = await io.read('chinese_pagoda.glb');
  const before = totalTris(doc);
  let removed = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if ((prim.getMaterial()?.getName() || '') === 'BaotaHLLDZ_1001') {
        removed += triCount(prim); prim.dispose();
      }
    }
  }
  log(`ground slab removed: ${removed} tris; ${before} -> ${totalTris(doc)}`);
  await io.write(path.join(STAGE, 'chinese_pagoda.glb'), doc);
}

// ---------------------------------------------------------------- tree
async function tree() {
  const doc = await io.read('fantasy_style_tree.glb');
  const before = totalTris(doc);

  // 1. Delete the fallen-leaf carpet: leaf triangles in the flat slab at ground level.
  const LO = -0.05, HI = 0.24;
  let carpet = 0;
  eachPrim(doc, (prim, m) => {
    if (!(prim.getMaterial()?.getName() || '').includes('Leaf')) return;
    const pos = prim.getAttribute('POSITION');
    carpet += filterTriangles(doc, prim, (a, b, c) => {
      let y = 0;
      for (const v of [a, b, c]) y += xf(m, pos.getElement(v, []))[1];
      y /= 3;
      return !(y > LO && y < HI);
    });
  });
  log(`leaf carpet removed: ${carpet} tris`);

  // 2. Thin remaining leaf cards by dropping whole connected components.
  let leafTris = 0;
  eachPrim(doc, p => { if ((p.getMaterial()?.getName() || '').includes('Leaf')) leafTris += triCount(p); });
  const LEAF_TARGET = 150000;
  const keepFrac = Math.min(1, LEAF_TARGET / leafTris);
  let dropped = 0;
  if (keepFrac < 1) {
    eachPrim(doc, prim => {
      if (!(prim.getMaterial()?.getName() || '').includes('Leaf')) return;
      const { find } = components(prim);
      dropped += filterTriangles(doc, prim, a => hash32(find(a) + 1) < keepFrac);
    });
  }
  log(`leaf cards thinned: keep ${(keepFrac*100).toFixed(1)}%, ${dropped} tris dropped -> ${leafTris - dropped} leaf tris`);

  // 3. Simplify bark only (sculpted geometry simplifies well; leaf cards do not).
  let barkTris = 0;
  eachPrim(doc, p => { if (!(p.getMaterial()?.getName() || '').includes('Leaf')) barkTris += triCount(p); });
  const BARK_TARGET = 200000;
  const barkRatio = Math.min(1, BARK_TARGET / barkTris);
  await doc.transform(weld());
  const barkPrims = [];
  eachPrim(doc, p => { if (!(p.getMaterial()?.getName() || '').includes('Leaf')) barkPrims.push(p); });
  for (const prim of barkPrims) {
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: barkRatio, error: 0.004 });
  }
  let barkAfter = 0;
  eachPrim(doc, p => { if (!(p.getMaterial()?.getName() || '').includes('Leaf')) barkAfter += triCount(p); });
  log(`bark simplified: ratio ${barkRatio.toFixed(3)}, ${barkTris} -> ${barkAfter} tris`);
  log(`tree total: ${before} -> ${totalTris(doc)}`);
  await io.write(path.join(STAGE, 'fantasy_style_tree.glb'), doc);
}

// ---------------------------------------------------------------- fan
async function fan() {
  const doc = await io.read('chinese_dragon_fan.glb');
  const root = doc.getRoot();

  // 1. Drop placeholder textures (near-empty images still allocating full VRAM).
  let stripped = 0;
  for (const tex of root.listTextures()) {
    const img = tex.getImage();
    if (img && img.byteLength < 5000) {
      for (const mat of root.listMaterials()) {
        for (const [get, set] of [
          ['getBaseColorTexture', 'setBaseColorTexture'],
          ['getNormalTexture', 'setNormalTexture'],
          ['getMetallicRoughnessTexture', 'setMetallicRoughnessTexture'],
          ['getOcclusionTexture', 'setOcclusionTexture'],
          ['getEmissiveTexture', 'setEmissiveTexture'],
        ]) if (mat[get]() === tex) mat[set](null);
      }
      tex.dispose(); stripped++;
    }
  }
  log(`placeholder textures stripped: ${stripped}`);

  // 2. Fix the pivot: origin to horizontal centre, base at y = 0.
  let lo = [Infinity,Infinity,Infinity], hi = [-Infinity,-Infinity,-Infinity];
  eachPrim(doc, (prim, m) => {
    const pos = prim.getAttribute('POSITION');
    const a = pos.getMin([]), b = pos.getMax([]);
    for (let i = 0; i < 8; i++) {
      const c = xf(m, [i&1?b[0]:a[0], i&2?b[1]:a[1], i&4?b[2]:a[2]]);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], c[k]); hi[k] = Math.max(hi[k], c[k]); }
    }
  });
  const shift = [-(lo[0]+hi[0])/2, -lo[1], -(lo[2]+hi[2])/2];
  const scene = root.getDefaultScene() || root.listScenes()[0];
  for (const n of scene.listChildren()) {
    const t = n.getTranslation();
    n.setTranslation([t[0]+shift[0], t[1]+shift[1], t[2]+shift[2]]);
  }
  log(`pivot shifted by [${shift.map(v=>v.toFixed(2)).join(', ')}] (was min y ${lo[1].toFixed(2)})`);
  await io.write(path.join(STAGE, 'chinese_dragon_fan.glb'), doc);
}

const JOBS = { pagoda, tree, fan };
for (const name of process.argv.slice(3)) {
  console.log('>> ' + name);
  await JOBS[name]();
}
