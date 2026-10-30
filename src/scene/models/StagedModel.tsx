import { useMemo } from 'react';
import type { Material, Object3D } from 'three';
import { ModelStage } from '@/lib/ModelStage.js';
import { MODELS_BY_ID } from '@/config/models.js';
import type { PropPlacement } from '@/config/chapters';
import { cloneModelScene, useModelGLTF } from './useModel';

export interface StagedModelProps {
  placement: PropPlacement;
  /** Mutate the cloned scene before it is staged (materials, visibility). */
  dress?: (scene: Object3D) => void;
  /** Replace every material in the subtree. */
  material?: Material;
}

/**
 * One real model, placed exactly where its placeholder box stood.
 *
 * ModelStage is the same wrapper the asset harness uses: it applies the
 * config's scale and rotation fix, centres the model on its own footprint and
 * seats it on y = 0. Because the placeholders were built from the same
 * worldSize values and positioned by the same convention, swapping a box for
 * its model does not move anything, and the tuned camera path still frames it.
 */
export function StagedModel({ placement, dress, material }: StagedModelProps) {
  const entry = placement.modelId ? MODELS_BY_ID[placement.modelId] : undefined;
  if (!entry) throw new Error(`no model "${placement.modelId}" in models.js`);

  const gltf = useModelGLTF(entry);

  // Clone inside this memo, not outside it: dressing mutates the clone, and a
  // memo that re-runs over an already-mutated scene is a different result.
  const stage = useMemo(() => {
    const scene = cloneModelScene(gltf);
    if (dress) dress(scene);
    if (material) {
      scene.traverse((o) => {
        const mesh = o as Object3D & { isMesh?: boolean; material?: Material };
        if (mesh.isMesh) mesh.material = material;
      });
    }
    return new ModelStage(scene, { entry, mode: 'world' });
  }, [gltf, entry, dress, material]);

  // No disposal yet, deliberately. Beyond the brief saying so, ModelStage.dispose
  // calls clear(): under StrictMode the mount/unmount/remount cycle runs the
  // cleanup on the first pass and empties the very stage the second pass reuses,
  // so the model silently renders nothing.

  return (
    <primitive
      object={stage}
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
    />
  );
}
