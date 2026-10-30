import { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { applyGateMaterials } from '@/lib/presets/torriGate.js';
import { CHAPTERS, type PropPlacement } from '@/config/chapters';
import { StagedModel } from './models/StagedModel';
import { InstancedModel } from './models/InstancedModel';
import { AnimatedDragon, FloatingProp, Staff, FLAT_BLACK } from './models/specials';

/** Models repeated often enough to be worth a single draw call. */
const INSTANCED = new Set(['stylized_rock', 'module_2_-_chinese_lantern']);

/**
 * Everything in one chapter's region of the world.
 *
 * Placement comes from src/config/chapters.ts — the same table the placeholder
 * boxes used — so the tuned camera path frames the real models exactly as it
 * framed the blocks. Only material and behaviour are decided here.
 */
export function ChapterContent({ index }: { index: number }) {
  const chapter = CHAPTERS[index];

  // Warm lantern paper. The optimized lantern is one palette-textured material,
  // so emissiveMap = the base map makes the pale panels glow more than the dark
  // lacquer rather than lighting the whole object evenly.
  const dressLantern = useCallback((m: THREE.Material) => {
    const std = m as THREE.MeshStandardMaterial;
    std.emissive = new THREE.Color('#C9A24A');
    std.emissiveIntensity = 0.75;
    if (std.map) std.emissiveMap = std.map;
    std.toneMapped = true;
    return std;
  }, []);

  const dressGate = useCallback((scene: THREE.Object3D) => {
    applyGateMaterials(scene);
  }, []);

  const { instanced, singles } = useMemo(() => {
    const groups = new Map<string, PropPlacement[]>();
    const rest: PropPlacement[] = [];
    for (const p of chapter.props) {
      if (p.modelId && INSTANCED.has(p.modelId)) {
        const list = groups.get(p.modelId) ?? [];
        list.push(p);
        groups.set(p.modelId, list);
      } else {
        rest.push(p);
      }
    }
    return { instanced: [...groups.entries()], singles: rest };
  }, [chapter]);

  return (
    <group name={`chapter-${chapter.index}-${chapter.id}`}>
      {instanced.map(([modelId, placements]) => (
        <InstancedModel
          key={modelId}
          modelId={modelId}
          placements={placements}
          dressMaterial={modelId === 'module_2_-_chinese_lantern' ? dressLantern : undefined}
        />
      ))}

      {singles.map((p, i) => {
        const key = `${chapter.id}-${p.modelId ?? p.shape}-${i}`;

        // The staff is built in code, not loaded.
        if (!p.modelId) return <Staff key={key} placement={p} />;

        switch (p.modelId) {
          case 'dragon_with_pearl':
            // Untextured sculpt; flat black until it gets a real material.
            return <StagedModel key={key} placement={p} material={FLAT_BLACK} />;

          case 'chinese_dragon_fan':
            return (
              <FloatingProp key={key} placement={p}>
                <StagedModel placement={{ ...p, position: [0, 0, 0], rotationY: 0 }} />
              </FloatingProp>
            );

          case 'torri_gate':
            return <StagedModel key={key} placement={p} dress={dressGate} />;

          case 'chinese_dragon':
            return <AnimatedDragon key={key} placement={p} />;

          default:
            return <StagedModel key={key} placement={p} />;
        }
      })}
    </group>
  );
}
