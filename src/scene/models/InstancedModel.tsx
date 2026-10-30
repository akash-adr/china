import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ModelStage } from '@/lib/ModelStage.js';
import { MODELS_BY_ID } from '@/config/models.js';
import type { PropPlacement } from '@/config/chapters';
import { cloneModelScene, useModelGLTF } from './useModel';

/**
 * Many copies of one model in a single draw call.
 *
 * Used for the rocks and lanterns, which repeat along the whole path. The
 * transform ModelStage would apply (config scale, footprint centring, seating
 * on y = 0) is baked into each instance matrix instead, by building one stage
 * off-screen and reading back the transform it produced. That keeps instanced
 * placements identical to staged ones rather than approximating them.
 *
 * Only models that resolve to a single mesh can be instanced this way; anything
 * else falls back to the caller rendering StagedModel per placement.
 */
export function InstancedModel({
  modelId,
  placements,
  dressMaterial,
}: {
  modelId: string;
  placements: PropPlacement[];
  /** Clone/adjust the material once, before instancing. */
  dressMaterial?: (m: THREE.Material) => THREE.Material;
}) {
  const entry = MODELS_BY_ID[modelId];
  if (!entry) throw new Error(`no model "${modelId}" in models.js`);
  const gltf = useModelGLTF(entry);
  const ref = useRef<THREE.InstancedMesh>(null);

  const built = useMemo(() => {
    // Staging re-parents the scene, so clone per memo run rather than reusing.
    const stage = new ModelStage(cloneModelScene(gltf), { entry, mode: 'world' });
    stage.updateWorldMatrix(true, true);

    const meshes: THREE.Mesh[] = [];
    stage.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    if (meshes.length !== 1) {
      console.warn(
        `[InstancedModel] ${modelId} has ${meshes.length} meshes; instancing the first only`);
    }
    const mesh = meshes[0];
    // Stage root is not parented, so matrixWorld here is the transform from the
    // stage's own origin — exactly what a StagedModel would apply.
    const local = mesh.matrixWorld.clone();
    const material = dressMaterial
      ? dressMaterial((mesh.material as THREE.Material).clone())
      : (mesh.material as THREE.Material);
    return { geometry: mesh.geometry, material, local };
  }, [gltf, entry, modelId, dressMaterial]);

  useLayoutEffect(() => {
    const inst = ref.current;
    if (!inst) return;
    const m = new THREE.Matrix4();
    const place = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    placements.forEach((p, i) => {
      pos.set(p.position[0], p.position[1], p.position[2]);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rotationY ?? 0);
      place.compose(pos, q, one);
      m.multiplyMatrices(place, built.local);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
  }, [placements, built]);

  // No disposal yet (see StagedModel): a StrictMode remount would reuse this
  // built material after the first pass had already disposed it.

  if (!placements.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[built.geometry, built.material, placements.length]}
      castShadow
      receiveShadow
      frustumCulled
    />
  );
}
