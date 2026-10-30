import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ModelStage } from '@/lib/ModelStage.js';
import { MODELS_BY_ID } from '@/config/models.js';
import { JinguBang } from '@/components/JinguBang.js';
import type { PropPlacement } from '@/config/chapters';
import { useModelGLTF } from './useModel';

/** A material shared by every untextured placeholder-ish surface in chapter 1. */
export const FLAT_BLACK = new THREE.MeshStandardMaterial({
  color: '#070707', roughness: 0.82, metalness: 0.05, name: 'temp_flat_black',
});

/**
 * The fan, drifting. Chapter 1 is almost motionless, so this is the only thing
 * moving in it — small amplitude and a long period, or it reads as a bug.
 */
export function FloatingProp({
  placement, children, amplitude = 0.22, period = 11, spin = 0.035,
}: {
  placement: PropPlacement;
  children: React.ReactNode;
  amplitude?: number;
  period?: number;
  spin?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const base = placement.position[1];
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.position.y = base + Math.sin((t / period) * Math.PI * 2) * amplitude;
    g.rotation.y = (placement.rotationY ?? 0) + Math.sin(t * spin * Math.PI) * 0.35;
  });
  return (
    <group ref={ref} position={[placement.position[0], base, placement.position[2]]}>
      {children}
    </group>
  );
}

/**
 * The dragon, playing dragon_hover in place.
 *
 * Skinned, so the clone has to rebind to its own skeleton and ModelStage falls
 * back to the config's bounds — Box3 cannot measure a skinned mesh before its
 * bones have been driven.
 */
export function AnimatedDragon({ placement }: { placement: PropPlacement }) {
  const entry = MODELS_BY_ID[placement.modelId!];
  const gltf = useModelGLTF(entry);

  // Clone and stage in ONE memo. ModelStage re-parents what it is given, and
  // under StrictMode the factory runs twice over the same object: the second
  // stage steals the scene out of the first, and React keeps one of them — so
  // whichever it keeps, half the time the dragon has no geometry in it. Pairing
  // them means each invocation gets its own clone and neither can take the
  // other's. Same failure mode as dressing a memoized scene in place.
  const { scene, stage } = useMemo(() => {
    const s = cloneSkeleton(gltf.scene);
    return { scene: s, stage: new ModelStage(s, { entry, mode: 'world' }) };
  }, [gltf, entry]);

  const { actions } = useAnimations(gltf.animations, scene);

  useEffect(() => {
    const action = actions['dragon_hover'] ?? Object.values(actions)[0];
    if (!action) {
      console.warn('[AnimatedDragon] no dragon_hover clip; clips:', Object.keys(actions));
      return;
    }
    action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    return () => { action.stop(); };
  }, [actions]);

  return (
    <primitive
      object={stage}
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
    />
  );
}

/**
 * The Ruyi Jingu Bang, built in code. Phase 2 state: unlit, unextended, a slow
 * idle spin. glow and extend are driven in the hero-moments phase.
 */
export function Staff({
  placement, glow = 0, extend = 0, spin = 0.12,
}: {
  placement: PropPlacement;
  glow?: number;
  extend?: number;
  spin?: number;
}) {
  const entry = MODELS_BY_ID['jingu_bang'];

  const { staff, stage } = useMemo(() => {
    const s = new JinguBang({ length: entry?.worldSize?.[1] ?? 1.8 });
    return { staff: s, stage: new ModelStage(s, { entry, mode: 'world' }) };
  }, [entry]);

  useEffect(() => { staff.glow = glow; }, [staff, glow]);
  useEffect(() => { staff.extend = extend; stage.reseat(); }, [staff, stage, extend]);
  useEffect(() => { staff.spin = spin; }, [staff, spin]);

  useFrame((_, dt) => staff.update(dt));

  return (
    <primitive
      object={stage}
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
    />
  );
}
