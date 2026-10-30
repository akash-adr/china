import { useRef } from 'react';
import * as THREE from 'three';

/**
 * Phase 1 lighting: just enough to read the placeholder volumes. One dim
 * ambient so nothing is pure black, one warm key from the side so boxes have a
 * lit face and a shadowed face and the forms read at all.
 */
export function Lights() {
  const key = useRef<THREE.DirectionalLight>(null);
  return (
    <>
      <ambientLight intensity={0.55} color="#7d848c" />
      <directionalLight
        ref={key}
        position={[40, 60, 20]}
        intensity={1.7}
        color="#C9A24A"
      />
      {/* A cool counter-light, very low, to keep the dark sides from going flat. */}
      <directionalLight position={[-30, 20, -40]} intensity={0.45} color="#3d4654" />
    </>
  );
}
