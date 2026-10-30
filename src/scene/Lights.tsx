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
      {/* Cool counter-light. Raised from 0.45 to 0.95 after chapter 5's hold
          came out black: the key sits at +x, so any prop the camera looks at
          from its -x side shows only shadowed faces. This is the fill that
          stops those reading as silhouettes, and it keeps the shadow side
          cool against the warm key rather than flattening it. */}
      <directionalLight position={[-30, 20, -40]} intensity={0.95} color="#3d4654" />
    </>
  );
}
