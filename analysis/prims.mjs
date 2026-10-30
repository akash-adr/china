import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  console.log('=== ' + file);
  const root = doc.getRoot();
  let i = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const idx = prim.getIndices();
      const tris = idx ? idx.getCount() / 3 : pos.getCount() / 3;
      const min = pos.getMin([]), max = pos.getMax([]);
      const dim = [max[0]-min[0], max[1]-min[1], max[2]-min[2]].map(v => +v.toFixed(1));
      const mat = prim.getMaterial();
      // flatness: how thin is the thinnest axis relative to the biggest
      const sorted = [...dim].sort((a,b)=>a-b);
      const flat = (sorted[0] / (sorted[2] || 1)).toFixed(3);
      console.log(`  [${i++}] mesh="${mesh.getName()||'?'}" mat="${mat?.getName()||'none'}" ` +
        `tris=${String(Math.round(tris)).padStart(8)} verts=${String(pos.getCount()).padStart(8)} ` +
        `dim=${dim.join('x')} flatness=${flat} minY=${min[1].toFixed(1)}`);
    }
  }
}
