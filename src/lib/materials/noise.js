/**
 * Tileable procedural noise, generated once on a canvas and reused as a texture.
 *
 * Seamless in both axes: the value-noise lattice wraps modulo `grid`, so the
 * texture can repeat without visible seams — which matters because these are
 * sampled triplanar in world space, across surfaces with no UVs at all.
 */
import * as THREE from 'three';

function hash2(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** One octave of wrapping value noise sampled at (u, v) in [0,1). */
function valueNoise(u, v, grid, seed) {
  const x = u * grid, y = v * grid;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = fade(x - x0), fy = fade(y - y0);
  const xa = ((x0 % grid) + grid) % grid, xb = (xa + 1) % grid;
  const ya = ((y0 % grid) + grid) % grid, yb = (ya + 1) % grid;
  return lerp(
    lerp(hash2(xa, ya, seed), hash2(xb, ya, seed), fx),
    lerp(hash2(xa, yb, seed), hash2(xb, yb, seed), fx),
    fy,
  );
}

/**
 * Fractal (multi-octave) tileable noise as a THREE.CanvasTexture.
 * @param {object} [o]
 * @param {number} [o.size=512]     texture resolution
 * @param {number} [o.grid=8]       lattice cells at the base octave
 * @param {number} [o.octaves=5]
 * @param {number} [o.gain=0.5]     amplitude falloff per octave
 * @param {number} [o.seed=1]
 * @param {number} [o.contrast=1]   >1 pushes toward black/white
 */
export function createNoiseTexture({
  size = 512, grid = 8, octaves = 5, gain = 0.5, seed = 1, contrast = 1,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);

  let norm = 0;
  for (let o = 0; o < octaves; o++) norm += gain ** o;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 1, g = grid, v = 0;
      for (let o = 0; o < octaves; o++) {
        v += valueNoise(x / size, y / size, g, seed + o * 101) * amp;
        amp *= gain; g *= 2;
      }
      v /= norm;
      if (contrast !== 1) v = Math.min(1, Math.max(0, (v - 0.5) * contrast + 0.5));
      const i = (y * size + x) * 4;
      const b = v * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // data, not colour
  tex.needsUpdate = true;
  return tex;
}

let _shared = null;
/** A single shared noise texture, built lazily. */
export function sharedNoiseTexture() {
  if (!_shared) _shared = createNoiseTexture({ size: 512, grid: 8, octaves: 5, seed: 7 });
  return _shared;
}

/**
 * Convert a greyscale height canvas into a tangent-space normal map.
 * Sobel on the wrapped height field, so the result tiles like its source.
 */
export function heightToNormalTexture(heightCanvas, strength = 2.0) {
  const size = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const at = (x, y) => src[((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4] / 255;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const out = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))
               - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * strength, ny = -dy * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Greyscale height canvas of fractal noise — input for heightToNormalTexture. */
export function createNoiseCanvas({ size = 256, grid = 16, octaves = 4, gain = 0.5, seed = 3 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  let norm = 0;
  for (let o = 0; o < octaves; o++) norm += gain ** o;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let amp = 1, g = grid, v = 0;
      for (let o = 0; o < octaves; o++) {
        v += valueNoise(x / size, y / size, g, seed + o * 57) * amp;
        amp *= gain; g *= 2;
      }
      const i = (y * size + x) * 4;
      const b = (v / norm) * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

let _hammered = null;
/** Shared hammered-iron normal map: dense, shallow forge dimples. */
export function hammeredNormalTexture() {
  if (!_hammered) {
    _hammered = heightToNormalTexture(
      createNoiseCanvas({ size: 256, grid: 22, octaves: 3, gain: 0.45, seed: 11 }), 2.6);
  }
  return _hammered;
}
