/**
 * Debug settings shared between the leva panel (DOM) and the scene (canvas),
 * plus a mutable readout the scene writes to every frame.
 *
 * Settings go through useSyncExternalStore so toggling redraws the scene.
 * Readouts deliberately do NOT: they are written 60x a second and only ever
 * sampled by the panel at a low rate.
 */
import { useSyncExternalStore } from 'react';

export interface DebugSettings {
  showSpline: boolean;
  showStats: boolean;
}

let settings: DebugSettings = { showSpline: false, showStats: true };
const listeners = new Set<() => void>();

export function setDebugSettings(patch: Partial<DebugSettings>) {
  const next = { ...settings, ...patch };
  if (next.showSpline === settings.showSpline && next.showStats === settings.showStats) return;
  settings = next;
  for (const l of listeners) l();
}

export function useDebugSettings(): DebugSettings {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => settings,
    () => settings,
  );
}

/** Written every frame by DebugBridge; read on demand by the panel. */
export const readout = { x: 0, y: 0, z: 0, pathT: 0, fps: 0 };
