/**
 * Path audit: walks the camera path and reports where it intersects, or passes
 * too close to, a placeholder volume.
 *
 * Worth having permanently. The whole point of blocking out with boxes at true
 * scale is to find these before any real model is loaded, and eyeballing a
 * contact sheet only catches the egregious cases.
 */
import * as THREE from 'three';
import { CHAPTERS, CHAPTER_RANGES, propSize, type PropPlacement } from '@/config/chapters';
import { cameraAt } from './path';

export interface AuditHit {
  progress: number;
  chapter: number;
  prop: string;
  /** Negative when the camera is inside the box. */
  distance: number;
  camera: [number, number, number];
}

function boxFor(p: PropPlacement): THREE.Box3 {
  const [w, h, d] = propSize(p);
  const c = new THREE.Vector3(p.position[0], p.position[1] + h / 2, p.position[2]);
  // Rotation is ignored: an axis-aligned test is conservative enough for a
  // clearance check and keeps this cheap.
  return new THREE.Box3().setFromCenterAndSize(c, new THREE.Vector3(w, h, d));
}

export function auditPath(samples = 1200, clearance = 1.5): AuditHit[] {
  // Hollow props are openings the camera is meant to pass through, so their
  // full bounding box is not a solid to avoid.
  const boxes = CHAPTERS.flatMap((c, ci) =>
    c.props.filter((p) => !p.hollow)
      .map((p) => ({ ci, name: p.label ?? p.modelId ?? 'prop', box: boxFor(p) })));

  const hits: AuditHit[] = [];
  const pos = new THREE.Vector3();
  const closest = new THREE.Vector3();

  for (let i = 0; i <= samples; i++) {
    const progressValue = i / samples;
    cameraAt(progressValue, pos);
    let ci = CHAPTER_RANGES.length - 1;
    while (ci > 0 && progressValue < CHAPTER_RANGES[ci].start) ci--;

    for (const b of boxes) {
      const inside = b.box.containsPoint(pos);
      b.box.clampPoint(pos, closest);
      const dist = inside ? -closest.distanceTo(pos) - 0.001 : closest.distanceTo(pos);
      if (inside || dist < clearance) {
        hits.push({
          progress: +progressValue.toFixed(4),
          chapter: ci + 1,
          prop: b.name,
          distance: +dist.toFixed(2),
          camera: [+pos.x.toFixed(1), +pos.y.toFixed(1), +pos.z.toFixed(1)],
        });
      }
    }
  }
  return hits;
}

/** Collapse consecutive samples hitting the same prop into one span. */
export function auditSummary(samples = 1200, clearance = 1.5) {
  const hits = auditPath(samples, clearance);
  const spans: { prop: string; chapter: number; from: number; to: number; minDist: number }[] = [];
  for (const h of hits) {
    const last = spans[spans.length - 1];
    if (last && last.prop === h.prop && h.progress - last.to < 0.005) {
      last.to = h.progress;
      last.minDist = Math.min(last.minDist, h.distance);
    } else {
      spans.push({ prop: h.prop, chapter: h.chapter, from: h.progress, to: h.progress, minDist: h.distance });
    }
  }
  return spans;
}
