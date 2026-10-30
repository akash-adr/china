import { useFrame, useThree } from '@react-three/fiber';
import { progress } from '@/scroll/progress';
import { pathT } from '@/scene/path';
import { readout } from './debugStore';

/** Lives inside the Canvas so it can read the live camera. Renders nothing. */
export function DebugBridge() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  // Scene inspection for the capture/perf harnesses.
  (window as unknown as Record<string, unknown>).__sceneStats = () => {
    let meshes = 0, instanced = 0, skinned = 0, visible = 0, lights = 0;
    const names: string[] = [];
    scene.traverse((o) => {
      const any = o as unknown as Record<string, boolean>;
      if (any.isLight) lights++;
      if (!any.isMesh) return;
      meshes++;
      if (any.isInstancedMesh) instanced++;
      if (any.isSkinnedMesh) skinned++;
      if (o.visible) visible++;
      if (names.length < 40) names.push(o.name || o.type);
    });
    const groups: Record<string, string[]> = {};
    scene.traverse((o) => {
      if (!o.name.startsWith('chapter-')) return;
      const list: string[] = [];
      o.traverse((c) => {
        const any = c as unknown as Record<string, boolean>;
        if (any.isInstancedMesh) list.push(`instanced:${c.name || 'mesh'}`);
        else if (any.isSkinnedMesh) list.push(`skinned:${c.name || 'mesh'}`);
        else if (any.isMesh) list.push(c.name || 'mesh');
        else if (c.name === 'JinguBang') list.push('JinguBang');
      });
      groups[o.name] = list;
    });
    return { meshes, instanced, skinned, visible, lights, groups, names };
  };

  // Confirms every staged model matches the size and seating the asset
  // harness measured, i.e. that swapping boxes for models moved nothing.
  (window as unknown as Record<string, unknown>).__verifySeating = () => {
    const out: unknown[] = [];
    scene.traverse((o) => {
      const stage = o as unknown as {
        entry?: { id: string; worldSize: number[] }; size?: { x: number; y: number; z: number };
        box?: { min: { y: number } }; measured?: boolean;
      };
      if (!stage.entry || !stage.size) return;
      const exp = stage.entry.worldSize;
      const got = [stage.size.x, stage.size.y, stage.size.z];
      const ok = got.every((v, i) => Math.abs(v - exp[i]) < Math.max(0.05, exp[i] * 0.02));
      out.push({
        id: stage.entry.id,
        size: got.map((v) => +v.toFixed(2)),
        expected: exp.map((v) => +v.toFixed(2)),
        baseY: +(stage.box?.min.y ?? 0).toFixed(3),
        measured: stage.measured,
        ok,
      });
    });
    return out;
  };
  let frames = 0;
  let last = performance.now();

  useFrame(() => {
    readout.x = camera.position.x;
    readout.y = camera.position.y;
    readout.z = camera.position.z;
    readout.pathT = pathT(progress.value);

    const info = gl.info;
    readout.calls = info.render.calls;
    readout.triangles = info.render.triangles;
    readout.textures = info.memory.textures;
    readout.geometries = info.memory.geometries;
    readout.programs = info.programs?.length ?? 0;

    frames++;
    const now = performance.now();
    if (now - last >= 500) {
      readout.fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
    }
  });
  return null;
}
