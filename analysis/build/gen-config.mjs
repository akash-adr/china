// Emits src/config/models.js from measured bounds + chosen real-world sizes.
import fs from 'node:fs';

const data = Object.fromEntries(
  JSON.parse(fs.readFileSync('analysis/data/inspect-final.json', 'utf8')).map(r => [r.file, r]));

// realWorld: the dimension we are pinning, and its size in metres.
// axis 'y' = height, 'x'/'z' = that horizontal extent.
const SPEC = {
  'chinese_pagoda.glb': {
    chapter: 6, alsoIn: [3], axis: 'y', metres: 20,
    label: 'Four-tier octagonal pagoda', note: 'Ground slab removed. Close-approach hero building.' },
  'jinshan_temple_cishou_pagoda_far.glb': {
    chapter: 6, alsoIn: [], axis: 'y', metres: 80,
    label: 'Jinshan temple complex (far LOD)',
    note: 'Far LOD: 208K tris / 1024 textures, down from 909K / 2048. Only ever a '
      + 'fogged silhouette, so the full-res version is not shipped.' },
  'fantasy_style_tree.glb': {
    chapter: 3, alsoIn: [1], axis: 'y', metres: 18,
    label: 'Golden ginkgo', note: 'Leaf carpet removed, leaf cards thinned 31.5%, bark simplified.' },
  'dragon_with_pearl.glb': {
    chapter: 1, alsoIn: [2], axis: 'y', metres: 4,
    label: 'Dragon-and-pearl statue', note: 'Untextured — needs a material in code. Decimated to 150K.' },
  'chinese_dragon.glb': {
    chapter: 5, alsoIn: [], axis: 'z', metres: 40,
    label: 'Serpentine dragon (animated)', note: 'Skinned, not simplified. 7.97s seamless loop.' },
  'torri_gate.glb': {
    chapter: 2, alsoIn: [], axis: 'x', metres: 9.75,
    label: 'Paifang gate',
    note: 'A Chinese paifang despite the filename. Untextured — 10 named materials '
      + '(roof, legs, base, bell, decor, name_board...) so each part retints separately. '
      + 'Ships tourist-red; wants weathered timber and faded oxblood.' },
  'broken_medieval_column_set.glb': {
    chapter: 3, alsoIn: [], axis: 'y', metres: 3.5,
    label: 'Broken stone columns (x4)',
    note: 'Four separate stumps — scatter them individually rather than placing the '
      + 'set as authored. 1024 textures: at 2048 these cost 255 MB VRAM.' },
  'stylized_rock.glb': {
    chapter: 1, alsoIn: [2, 3, 4, 5, 6], axis: 'y', metres: 1.5,
    label: 'Parallax boulder',
    note: 'Foreground parallax in every chapter. 660 tris, one draw call — instance '
      + 'it, do not clone it. Authored at 22 cm, hence the large scale factor.' },
  'stone_lion.glb': {
    chapter: 2, alsoIn: [], axis: 'y', metres: 2.5,
    label: 'Guardian lion (shishi)', note: 'Mirror for a flanking pair. 1024 textures.' },
  'chinese_dragon_fan.glb': {
    chapter: 1, alsoIn: [], axis: 'x', metres: 0.45,
    label: 'Folding dragon fan', note: 'Pivot recentred, placeholder textures stripped.' },
  'module_2_-_chinese_lantern.glb': {
    chapter: 2, alsoIn: [3, 6], axis: 'y', metres: 1.2,
    label: 'Palace lantern', note: 'Merged to one mesh / one draw call. Instance freely.' },
  // staff_placeholder.glb removed 2026-10-26: it was the Genshin Impact Staff of
  // Homa, a commercial game rip, and is now in _rejected/. Chapter 4 has no asset
  // until a licensable Ruyi Jingu Bang is sourced.
};

const CHAPTERS = {
  1: 'Ink Void opening', 2: 'Mountain Gate', 3: 'Temple Ruins',
  4: 'The Legendary Staff', 5: 'The Guardian awakening', 6: 'The Summit pagoda finale',
};

// Entries built in code rather than loaded from a file. They still get a config
// row so chapter budgets, labels and world scale stay in one table.
const PROCEDURAL = {
  jingu_bang: {
    chapter: 4, alsoIn: [], component: 'JinguBang',
    module: '@/components/JinguBang.js',
    label: 'Ruyi Jingu Bang (procedural)',
    worldSize: [0.0512, 1.8, 0.0512],
    budget: { sizeMB: 0, triangles: 3584, textureVramMB: 2.1, drawCalls: 5 },
    note: 'Built in code — no external model. Every licensable staff we found was '
      + 'the wrong weapon. Animatable: glow, extend (up to 6x), spin.',
  },
};

const r5 = n => +n.toFixed(5);
const entries = [];
for (const [file, spec] of Object.entries(SPEC)) {
  const rec = data[file];
  if (!rec) throw new Error('missing inspection data for ' + file);
  const dim = { x: rec.bbox.dim[0], y: rec.bbox.dim[1], z: rec.bbox.dim[2] };
  const scale = r5(spec.metres / dim[spec.axis]);
  entries.push({
    id: file.replace(/\.glb$/, ''),
    file, spec, rec, scale,
    baseOffset: r5(-rec.bbox.min[1] * scale),
    sizeMB: rec.sizeMB,
    tris: rec.sceneTriangles,
    vram: rec.textureVramMB,
    draws: rec.drawCalls,
    worldDim: [r5(dim.x * scale), r5(dim.y * scale), r5(dim.z * scale)],
    anim: rec.animations[0] || null,
  });
}
for (const [id, p] of Object.entries(PROCEDURAL)) {
  entries.push({
    id, procedural: true, spec: p, scale: 1, baseOffset: p.worldSize[1] / 2,
    sizeMB: p.budget.sizeMB, tris: p.budget.triangles, vram: p.budget.textureVramMB,
    draws: p.budget.drawCalls, worldDim: p.worldSize, anim: null,
  });
}
entries.sort((a, b) => a.spec.chapter - b.spec.chapter || a.id.localeCompare(b.id));

const renderProcedural = (e) => `  {
    id: '${e.id}',
    path: null,                       // built in code, nothing to download
    component: '${e.spec.component}',
    module: '${e.spec.module}',
    label: ${JSON.stringify(e.spec.label)},

    // Authored directly in metres, so no conversion is needed.
    scale: 1,
    // Centred on its own origin; lift by half its length to stand it on the floor.
    baseOffset: ${e.baseOffset},
    rotationFix: [0, 0, 0],

    chapter: ${e.spec.chapter},
    worldSize: [${e.worldDim.join(', ')}],
    animations: [],

    budget: { sizeMB: ${e.sizeMB}, triangles: ${e.tris}, textureVramMB: ${e.vram}, drawCalls: ${e.draws} },
    note: ${JSON.stringify(e.spec.note)},
  },`;

const body = entries.map(e => e.procedural ? renderProcedural(e) : `  {
    id: '${e.id}',
    path: '${'/models/' + e.file}',
    label: ${JSON.stringify(e.spec.label)},

    // Multiply the loaded scene by this to reach world scale (1 unit = 1 metre).
    // Pinned so the model's ${e.spec.axis} extent reads as ${e.spec.metres} m.
    scale: ${e.scale},
    // Add to y AFTER scaling so the model's lowest point rests on the floor.
    baseOffset: ${e.baseOffset},
    // Euler XYZ in radians. All nine assets already load Y-up and upright.
    rotationFix: [0, 0, 0],

    chapter: ${e.spec.chapter},${e.spec.alsoIn.length ? `\n    alsoIn: [${e.spec.alsoIn.join(', ')}],` : ''}
    worldSize: [${e.worldDim.join(', ')}], // metres, after scale
    ${e.rec.animations.length
      ? `animations: [\n${e.rec.animations.map(a => `      { name: '${a.name}', duration: ${a.duration}, loop: true },`).join('\n')}\n    ],`
      : 'animations: [],'}

    budget: { sizeMB: ${e.sizeMB}, triangles: ${e.tris}, textureVramMB: ${e.vram}, drawCalls: ${e.draws} },
    note: ${JSON.stringify(e.spec.note)},
  },`).join('\n');

const out = `// Generated by analysis/build/gen-config.mjs — regenerate rather than hand-editing.
// Measured from the finished assets in public/models/.
//
// World convention: Y-up, 1 unit = 1 metre, models rest on y = 0.
// To place a model correctly:
//
//   const g = new THREE.Group();
//   g.add(gltf.scene);
//   g.scale.setScalar(entry.scale);
//   g.rotation.set(...entry.rotationFix);
//   g.position.y = entry.baseOffset;
//
// ...or just use createModelStage() from src/lib/ModelStage.js, which does this
// and can also auto-centre horizontally.

export const CHAPTERS = ${JSON.stringify(CHAPTERS, null, 2).replace(/"(\d)":/g, '$1:')};

export const MODELS = [
${body}
];

/** Lookup by id. */
export const MODELS_BY_ID = Object.fromEntries(MODELS.map((m) => [m.id, m]));

/** Entries backed by a file in public/models/. */
export const FILE_MODELS = MODELS.filter((m) => m.path);

/** Entries built in code (no download); 'component' names the export to construct. */
export const PROCEDURAL_MODELS = MODELS.filter((m) => !m.path);

/** Every model used by a chapter, primary assignment plus shared reuse. */
export function modelsForChapter(chapter) {
  return MODELS.filter((m) => m.chapter === chapter || (m.alsoIn ?? []).includes(chapter));
}

/** Download weight of a chapter, counting each file once. */
export function chapterDownloadMB(chapter) {
  return +modelsForChapter(chapter)
    .reduce((sum, m) => sum + m.budget.sizeMB, 0).toFixed(2);
}

/** Download weight if a chapter is entered with nothing cached yet. */
export function chapterBudget(chapter) {
  const models = modelsForChapter(chapter);
  return {
    chapter,
    title: CHAPTERS[chapter],
    models: models.map((m) => m.id),
    sizeMB: +models.reduce((s, m) => s + m.budget.sizeMB, 0).toFixed(2),
    triangles: models.reduce((s, m) => s + m.budget.triangles, 0),
    textureVramMB: +models.reduce((s, m) => s + m.budget.textureVramMB, 0).toFixed(1),
    drawCalls: models.reduce((s, m) => s + m.budget.drawCalls, 0),
  };
}

export const TOTAL_MB = +MODELS.reduce((s, m) => s + m.budget.sizeMB, 0).toFixed(2);
`;
fs.mkdirSync('src/config', { recursive: true });
fs.writeFileSync('src/config/models.js', out);
console.log('wrote src/config/models.js —', entries.length, 'models');
for (const e of entries) {
  console.log(`  ch${e.spec.chapter} ${e.id.padEnd(32)} scale=${String(e.scale).padStart(9)} ` +
    `baseOffset=${String(e.baseOffset).padStart(8)} world=${e.worldDim.join('x')}m`);
}
