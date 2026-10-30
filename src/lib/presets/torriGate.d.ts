import type { Object3D } from 'three';

export interface GatePalette {
  oxblood: string; timber: string; glaze: string;
  grime: string; gold: string; tarnish: string; stone: string;
}
export declare const GATE_PALETTE: GatePalette;
export declare function createGateMaterials(p?: GatePalette): Record<string, import('three').Material>;
/** Throws if the GLB's material names no longer match the preset. */
export declare function applyGateMaterials(
  target: Object3D, palette?: GatePalette,
): { applied: number; missing: string[]; found: string[] };
