/**
 * Model loading for the site.
 *
 * Everything in public/models/ is Draco-compressed with WebP textures. The
 * decoder is served from public/draco/ (a copy of three's) rather than a CDN,
 * so the site has no third-party runtime dependency and works offline.
 */
import { useGLTF } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Object3D } from 'three';
import type { ModelEntry } from '@/config/models';

export const DRACO_PATH = '/draco/';

/** Load a config entry's GLB. Suspends until ready. */
export function useModelGLTF(entry: ModelEntry) {
  if (!entry.path) throw new Error(`${entry.id} has no path; it is built in code`);
  return useGLTF(entry.path, DRACO_PATH);
}

/**
 * A fresh copy of a loaded model's scene graph.
 *
 * Every placement needs its own: two stone lions cannot share one Object3D.
 * SkeletonUtils.clone is used rather than Object3D.clone because it rebinds
 * skinned meshes to the copied skeleton — a plain clone leaves them driving
 * the original's bones, so two dragons would animate as one.
 *
 * Deliberately NOT a hook. Callers clone inside the same useMemo that mutates
 * the result (swapping materials, staging it), because those mutations are not
 * idempotent: under StrictMode the memo runs twice, and a second pass over an
 * already-dressed scene either double-applies or throws.
 */
export function cloneModelScene(gltf: { scene: Object3D }): Object3D {
  return cloneSkeleton(gltf.scene);
}

/** Warm the cache for a set of entries without rendering them. */
export function preloadModels(entries: ModelEntry[]) {
  for (const e of entries) {
    if (e.path) useGLTF.preload(e.path, DRACO_PATH);
  }
}
