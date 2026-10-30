/**
 * The camera path: two CatmullRom splines (position and look-at) running
 * through every chapter's keypoints as one continuous curve, plus the mapping
 * from scroll progress to curve parameter.
 *
 * The mapping is what makes the motion feel weighted rather than linear. Each
 * chapter declares a `hold` — a window where the camera slows to a fraction of
 * its pace so a hero moment can land. That is expressed as a speed profile and
 * integrated into a monotonic lookup, so scroll still maps one-to-one onto the
 * path (no stalling, no backtracking) while the *rate* varies.
 */
import * as THREE from 'three';
import { CHAPTERS, CHAPTER_RANGES, type Chapter } from '@/config/chapters';

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 1 normally, dipping to `slow` inside the hold window, with soft shoulders. */
function speedAt(u: number, hold: Chapter['hold']): number {
  const half = hold.width / 2;
  const ramp = Math.max(1e-3, half * 0.6);
  const rise = smoothstep(hold.at - half - ramp, hold.at - half, u);
  const fall = 1 - smoothstep(hold.at + half, hold.at + half + ramp, u);
  return 1 - (1 - hold.slow) * Math.min(rise, fall);
}

const LUT_SIZE = 257;

/** Monotonic u -> v lookup for one chapter, from its speed profile. */
function buildHoldLut(hold: Chapter['hold']): Float32Array {
  const lut = new Float32Array(LUT_SIZE);
  let acc = 0;
  for (let i = 1; i < LUT_SIZE; i++) {
    const u0 = (i - 1) / (LUT_SIZE - 1);
    const u1 = i / (LUT_SIZE - 1);
    acc += ((speedAt(u0, hold) + speedAt(u1, hold)) / 2) * (u1 - u0);
    lut[i] = acc;
  }
  for (let i = 0; i < LUT_SIZE; i++) lut[i] /= acc || 1;
  return lut;
}

function sampleLut(lut: Float32Array, u: number): number {
  const x = Math.min(1, Math.max(0, u)) * (LUT_SIZE - 1);
  const i = Math.min(LUT_SIZE - 2, Math.floor(x));
  const f = x - i;
  return lut[i] + (lut[i + 1] - lut[i]) * f;
}

function toVecs(points: readonly [number, number, number][]) {
  return points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
}

/** Where each chapter's keypoints sit on the shared curve parameter. */
function buildSpans(counts: number[]) {
  const total = counts.reduce((a, b) => a + b, 0);
  const lastIndex = total - 1;
  const spans: { t0: number; t1: number }[] = [];
  let idx = 0;
  for (let i = 0; i < counts.length; i++) {
    const start = idx;
    idx += counts[i];
    // Run each chapter up to the *next* chapter's first keypoint, so the
    // transition segment between them belongs to the outgoing chapter and the
    // whole curve is covered with no gaps.
    const end = i === counts.length - 1 ? lastIndex : idx;
    spans.push({ t0: start / lastIndex, t1: end / lastIndex });
  }
  return spans;
}

const counts = CHAPTERS.map((c) => c.camera.length);
const lookCounts = CHAPTERS.map((c) => c.lookAt.length);

export const cameraCurve = new THREE.CatmullRomCurve3(
  toVecs(CHAPTERS.flatMap((c) => c.camera)), false, 'catmullrom', 0.5);
export const lookCurve = new THREE.CatmullRomCurve3(
  toVecs(CHAPTERS.flatMap((c) => c.lookAt)), false, 'catmullrom', 0.5);

const cameraSpans = buildSpans(counts);
const lookSpans = buildSpans(lookCounts);
const holdLuts = CHAPTERS.map((c) => buildHoldLut(c.hold));

/**
 * Map global scroll progress to a curve parameter, applying the chapter's hold.
 * Exported so the debug panel can show the eased value next to the raw one.
 */
export function pathT(progressValue: number, spans = cameraSpans): number {
  const p = Math.min(1, Math.max(0, progressValue));
  let i = CHAPTER_RANGES.length - 1;
  while (i > 0 && p < CHAPTER_RANGES[i].start) i--;

  const { start, end } = CHAPTER_RANGES[i];
  const u = end > start ? (p - start) / (end - start) : 0;
  const v = sampleLut(holdLuts[i], u);
  const span = spans[i];
  return span.t0 + (span.t1 - span.t0) * v;
}

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

/** Camera position at a given scroll progress. */
export function cameraAt(progressValue: number, out = _pos): THREE.Vector3 {
  return cameraCurve.getPoint(pathT(progressValue, cameraSpans), out);
}

/** Look-at target at a given scroll progress. */
export function lookAtAt(progressValue: number, out = _look): THREE.Vector3 {
  return lookCurve.getPoint(pathT(progressValue, lookSpans), out);
}
