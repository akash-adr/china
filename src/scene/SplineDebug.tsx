import { useMemo } from 'react';
import * as THREE from 'three';
import { CHAPTERS } from '@/config/chapters';
import { cameraCurve, lookCurve } from './path';

/** Draws the camera and look-at splines plus their keypoints, for tuning. */
export function SplineDebug({ visible }: { visible: boolean }) {
  const { camLine, lookLine, camPoints, lookPoints } = useMemo(() => {
    const mk = (curve: THREE.CatmullRomCurve3, color: string) => {
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(600));
      return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    };
    return {
      camLine: mk(cameraCurve, '#C9A24A'),
      lookLine: mk(lookCurve, '#7A1414'),
      camPoints: CHAPTERS.flatMap((c) => c.camera),
      lookPoints: CHAPTERS.flatMap((c) => c.lookAt),
    };
  }, []);

  if (!visible) return null;
  return (
    <group name="spline-debug">
      <primitive object={camLine} />
      <primitive object={lookLine} />
      {camPoints.map((p, i) => (
        <mesh key={`c${i}`} position={p}>
          <sphereGeometry args={[0.45, 10, 8]} />
          <meshBasicMaterial color="#F2D488" />
        </mesh>
      ))}
      {lookPoints.map((p, i) => (
        <mesh key={`l${i}`} position={p}>
          <sphereGeometry args={[0.32, 8, 6]} />
          <meshBasicMaterial color="#FF8A3D" />
        </mesh>
      ))}
    </group>
  );
}
