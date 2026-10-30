/** Types for src/lib/ModelStage.js, which stays plain JS (shared with the asset harness). */
import * as THREE from 'three';
import type { ModelEntry } from '@/config/models';

export interface ModelStageOptions {
  mode?: 'world' | 'fit';
  entry?: ModelEntry | null;
  fitSize?: number;
  centre?: boolean;
  shadows?: boolean;
}

export declare class ModelStage extends THREE.Group {
  constructor(scene: THREE.Object3D, options?: ModelStageOptions);
  inner: THREE.Group;
  entry: ModelEntry | null;
  mode: 'world' | 'fit';
  /** False when bounds came from config because the subtree is skinned. */
  measured: boolean;
  skinned: boolean;
  size: THREE.Vector3;
  box: THREE.Box3;
  baseOffsetDrift: number;
  gltf?: unknown;
  animations?: THREE.AnimationClip[];
  reseat(): this;
  dispose(): void;
}

export declare function createModelStage(
  scene: THREE.Object3D, options?: ModelStageOptions): ModelStage;
