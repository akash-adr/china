import { useMemo } from 'react';
import * as THREE from 'three';
import { CHAPTERS, propSize, type PropPlacement } from '@/config/chapters';

/**
 * Stand-ins for the real models, sized from the measured bounds in
 * models.js, so the camera path is being tuned against true dimensions and
 * swapping a real model in later is a drop-in.
 *
 * Boxes sit on y = 0 like the real assets do (ModelStage guarantees that), so
 * each one is lifted by half its height.
 */
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);

/**
 * Blocks a hollow prop out as a frame: two uprights and a lintel. The camera
 * flies through the paifang, so a solid box would both read as a wall and give
 * a false collision in the path audit.
 */
function HollowProp({ p }: { p: PropPlacement }) {
  const [w, h, d] = propSize(p);
  const post = Math.min(w * 0.11, 1.1);
  const lintel = h * 0.26;
  const mat = (
    <meshStandardMaterial
      color="#7d6434" roughness={0.55} metalness={0.35}
      emissive="#8A6A2F" emissiveIntensity={0.07}
    />
  );
  return (
    <group position={[p.position[0], p.position[1], p.position[2]]} rotation={[0, p.rotationY ?? 0, 0]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (w / 2 - post / 2), (h - lintel) / 2, 0]}>
          <boxGeometry args={[post, h - lintel, d]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[0, h - lintel / 2, 0]}>
        <boxGeometry args={[w, lintel, d]} />
        {mat}
      </mesh>
    </group>
  );
}

function Prop({ p }: { p: PropPlacement }) {
  if (p.hollow) return <HollowProp p={p} />;
  const [w, h, d] = propSize(p);
  const geometry = p.shape === 'cylinder' ? CYL : BOX;
  // A cylinder's radius is baked into x/z; a box scales on all three.
  const scale: [number, number, number] =
    p.shape === 'cylinder' ? [w, h, w] : [w, h, d];

  return (
    <mesh
      geometry={geometry}
      position={[p.position[0], p.position[1] + h / 2, p.position[2]]}
      rotation={[0, p.rotationY ?? 0, 0]}
      scale={scale}
    >
      <meshStandardMaterial
        color={p.hero ? '#7d6434' : '#4a443c'}
        roughness={p.hero ? 0.55 : 0.9}
        metalness={p.hero ? 0.35 : 0.05}
        emissive={p.hero ? '#8A6A2F' : '#000000'}
        emissiveIntensity={p.hero ? 0.07 : 0}
      />
    </mesh>
  );
}

export function Placeholders() {
  const props = useMemo(
    () => CHAPTERS.flatMap((c) => c.props.map((p, i) => ({ p, key: `${c.id}-${i}` }))),
    [],
  );
  return (
    <group name="placeholders">
      {props.map(({ p, key }) => <Prop key={key} p={p} />)}
    </group>
  );
}

/**
 * A ground plane, dark enough to read as "floor" without competing. The world
 * is ~740 m long, so this is deliberately huge.
 */
export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -360]} receiveShadow>
      <planeGeometry args={[400, 1000]} />
      <meshStandardMaterial color="#0E0D0B" roughness={1} metalness={0} />
    </mesh>
  );
}
