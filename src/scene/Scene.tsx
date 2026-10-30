import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import * as THREE from 'three';
import { Suspense } from 'react';
import { CameraRig } from './CameraRig';
import { ChapterLights } from './ChapterLights';
import { ChapterContent } from './ChapterContent';
import { Placeholders, Ground } from './Placeholders';
import { useChapterLoading } from '@/scroll/useChapterLoading';
import { CHAPTERS } from '@/config/chapters';
import { SplineDebug } from './SplineDebug';
import { DebugBridge } from '@/ui/DebugBridge';
import { useDebugSettings } from '@/ui/debugStore';

/**
 * The one persistent canvas. It is mounted once for the life of the page and
 * never unmounts between chapters — the "six chapters" are regions of a single
 * world, so there is nothing to tear down and rebuild.
 */
export function Scene() {
  const { showSpline, showStats, showPlaceholders } = useDebugSettings();
  // Capture mode jumps to arbitrary points on the path, so nothing can be
  // streamed in on the way there.
  const CAPTURE = new URLSearchParams(location.search).has('capture');
  const mounted = useChapterLoading(CAPTURE);

  return (
    <div className="canvas-layer">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 42, near: 0.1, far: 750, position: [0, 1.55, 9] }}
        onCreated={({ scene, gl }) => {
          scene.background = new THREE.Color('#050505');
          // Exponential fog hides the far end of a 740 m world and does most of
          // the atmosphere before any post-processing exists. Density is set
          // against the longest sightline that has to read — the 240 m look at
          // the Jinshan silhouette in chapter 6. At 0.0075 that view was 96%
          // fogged and the chapter went black.
          scene.fog = new THREE.FogExp2('#050505', 0.0022);
          // far is set against the fog, not the world. At density 0.0022 a
          // surface 750 m out is ~6% visible, so anything beyond that is paid
          // for and never seen — fog hides geometry, it does not cull it. With
          // far at 2000 chapter 1 was drawing the whole 900 m corridor
          // (1.75 M triangles); at 750 it draws what it can actually show.
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <ChapterLights />
        <Ground />
        {/* Each chapter suspends independently, so a later chapter still
            downloading never blanks the one being looked at. */}
        {CHAPTERS.map((c, i) => (mounted.has(i) ? (
          <Suspense key={c.id} fallback={null}>
            <ChapterContent index={i} />
          </Suspense>
        ) : null))}
        {showPlaceholders ? <Placeholders /> : null}
        <CameraRig />
        <SplineDebug visible={showSpline} />
        <DebugBridge />
        {import.meta.env.DEV && showStats ? <Stats /> : null}
      </Canvas>
    </div>
  );
}
