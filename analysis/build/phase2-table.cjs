const fs = require('fs');
const perf = JSON.parse(fs.readFileSync('analysis/data/phase2-scroll-perf.json'));
const models = JSON.parse(fs.readFileSync('analysis/data/inspect-final.json'));
const byId = Object.fromEntries(models.map((m) => [m.file.replace(/\.glb$/, ''), m]));

// Model ids per chapter, read out of the config source so the table cannot
// drift from what the scene actually mounts.
const src = fs.readFileSync('src/config/chapters.ts', 'utf8');
const chunks = src.split(/\n  \{\n    index: /).slice(1);
const perChapter = chunks.map((c) => {
  const body = c.split('props: [')[1] || '';
  return [...new Set([...body.matchAll(/modelId: '([^']+)'/g)].map((m) => m[1]))];
});

const seen = new Set();
let cum = 0;
const rows = perf.map((r, i) => {
  const ids = perChapter[i] || [];
  const fresh = ids.filter((id) => !seen.has(id));
  fresh.forEach((id) => seen.add(id));
  const chapterVram = ids.reduce((s, id) => s + (byId[id] ? byId[id].textureVramMB : 0), 0);
  cum += fresh.reduce((s, id) => s + (byId[id] ? byId[id].textureVramMB : 0), 0);
  return { ...r, models: ids.length, chapterVram: +chapterVram.toFixed(1), cumVram: +cum.toFixed(1) };
});

console.log('| Chapter | FPS mean / p95 / min | Draw calls | Triangles | Texture VRAM (chapter / cumulative) |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.chapter}. ${r.title} | ${r.meanFps} / ${r.p95Fps} / ${r.minFps} | ${r.calls} | ${r.triangles.toLocaleString()} | ${r.chapterVram} MB / ${r.cumVram} MB |`);
}
fs.writeFileSync('analysis/data/phase2-table.json', JSON.stringify(rows, null, 2));
