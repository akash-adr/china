import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CHAPTERS, CHAPTER_RANGES } from '@/config/chapters';
import { progress } from '@/scroll/progress';

/**
 * One cool ambient and one warm key that travels between the chapters' key
 * positions, rimming whichever hero is on screen.
 *
 * Six separate lights would cost every shader in the scene and no two are ever
 * visible together, so this interpolates a single light instead — across the
 * chapter boundary it crossfades, which also smooths the hand-off.
 *
 * The photogrammetry models (chinese_pagoda, jinshan) carry baked lighting and
 * ignore this entirely. That is left alone: fog does the work for them.
 */
export function ChapterLights() {
  const key = useRef<THREE.DirectionalLight>(null);
  const target = useRef<THREE.Object3D>(null);

  const pos = useRef(new THREE.Vector3(...CHAPTERS[0].keyLight.position));
  const aim = useRef(new THREE.Vector3(...CHAPTERS[0].keyLight.target));
  const intensity = useRef(CHAPTERS[0].keyLight.intensity);

  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const p = progress.value;
    let i = CHAPTER_RANGES.length - 1;
    while (i > 0 && p < CHAPTER_RANGES[i].start) i--;

    // Blend into the next chapter's key over the last 15% of this one, so the
    // light is already moving before the camera arrives.
    const { start, end } = CHAPTER_RANGES[i];
    const u = end > start ? (p - start) / (end - start) : 0;
    const next = Math.min(CHAPTERS.length - 1, i + 1);
    const t = u < 0.85 ? 0 : (u - 0.85) / 0.15;

    const from = CHAPTERS[i].keyLight;
    const to = CHAPTERS[next].keyLight;
    a.current.set(...from.position).lerp(b.current.set(...to.position), t);
    const wantPos = a.current.clone();
    a.current.set(...from.target).lerp(b.current.set(...to.target), t);
    const wantAim = a.current.clone();
    const wantIntensity = from.intensity + (to.intensity - from.intensity) * t;

    const k = 1 - Math.pow(0.1, delta * 60);
    pos.current.lerp(wantPos, k);
    aim.current.lerp(wantAim, k);
    intensity.current += (wantIntensity - intensity.current) * k;

    if (key.current) {
      if (target.current && key.current.target !== target.current) {
        key.current.target = target.current;
      }
      key.current.position.copy(pos.current);
      key.current.intensity = intensity.current;
    }
    if (target.current) {
      target.current.position.copy(aim.current);
      target.current.updateMatrixWorld();
    }
  });

  return (
    <>
      {/* Dim and cool, so nothing is pure black but nothing is described by it. */}
      <ambientLight intensity={0.5} color="#6f7782" />
      {/* The target has to live in the scene graph for its matrixWorld to be
          updated; the light is pointed at it once both refs exist. */}
      <object3D ref={target} />
      <directionalLight ref={key} color="#C9A24A" intensity={2.6} />
      {/* Low cool fill: the key sits behind the hero, so without this the whole
          front of every model is unreadable. */}
      <directionalLight position={[-26, 16, 30]} intensity={0.55} color="#46505e" />
    </>
  );
}
