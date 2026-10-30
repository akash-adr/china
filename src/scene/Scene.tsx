import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import * as THREE from 'three';
import { CameraRig } from './CameraRig';
import { Lights } from './Lights';
import { Placeholders, Ground } from './Placeholders';
import { SplineDebug } from './SplineDebug';
import { DebugBridge } from '@/ui/DebugBridge';
import { useDebugSettings } from '@/ui/debugStore';

/**
 * The one persistent canvas. It is mounted once for the life of the page and
 * never unmounts between chapters — the "six chapters" are regions of a single
 * world, so there is nothing to tear down and rebuild.
 */
export function Scene() {
  const { showSpline, showStats } = useDebugSettings();

  return (
    <div className="canvas-layer">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 42, near: 0.1, far: 2000, position: [0, 7.5, 30] }}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color('#050505');
          // Exponential fog hides the far end of a 740 m world and does most of
          // the atmosphere before any post-processing exists. Density is set
          // against the longest sightline that has to read — the 240 m look at
          // the Jinshan silhouette in chapter 6. At 0.0075 that view was 96%
          // fogged and the chapter went black.
          scene.fog = new THREE.FogExp2('#050505', 0.0022);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Lights />
        <Ground />
        <Placeholders />
        <CameraRig />
        <SplineDebug visible={showSpline} />
        <DebugBridge />
        {import.meta.env.DEV && showStats ? <Stats /> : null}
      </Canvas>
    </div>
  );
}
