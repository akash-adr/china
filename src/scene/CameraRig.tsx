import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { progress } from '@/scroll/progress';
import { cameraAt, lookAtAt } from './path';

/**
 * Drives the single camera along the path each frame.
 *
 * Reads `progress.value` directly rather than through React state: this runs
 * every frame and must not trigger renders. The extra damping on top of
 * ScrollTrigger's scrub is deliberate — it smooths the spline's own curvature
 * changes at chapter joins, which otherwise read as a flick.
 */
export function CameraRig({ damping = 0.085 }: { damping?: number }) {
  const camera = useThree((s) => s.camera);
  const pos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const started = useRef(false);
  const seenSnap = useRef(-1);

  useFrame((_, delta) => {
    const target = cameraAt(progress.value, new THREE.Vector3());
    const aim = lookAtAt(progress.value, new THREE.Vector3());

    if (seenSnap.current !== progress.snapToken) {
      seenSnap.current = progress.snapToken;
      started.current = false;
    }

    if (!started.current) {
      pos.current.copy(target);
      look.current.copy(aim);
      started.current = true;
    } else {
      // Frame-rate independent damping, so the feel does not change with fps.
      const k = 1 - Math.pow(damping, delta * 60);
      pos.current.lerp(target, k);
      look.current.lerp(aim, k);
    }

    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}
