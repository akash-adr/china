/**
 * Weathering materials applied as code-side overrides — the GLBs are never edited.
 *
 * These assets carry no UVs (the gate has zero textures), so every mask here is
 * sampled triplanar in world space. Wear is driven by three terms:
 *   - noise       : where the paint happened to survive
 *   - upness      : flat-up faces take the weather
 *   - silhouette  : grazing angles approximate exposed edges and corners
 * Paint survives in the recesses and undersides, which is what makes old
 * painted timber read as old rather than merely dirty.
 */
import * as THREE from 'three';
import { sharedNoiseTexture } from './noise.js';

const COMMON_VERT = /* glsl */`
  varying vec3 vWPos;
  varying vec3 vWNrm;
`;

const COMMON_FRAG = /* glsl */`
  varying vec3 vWPos;
  varying vec3 vWNrm;
  uniform sampler2D uNoise;
  uniform float uNoiseScale;
  uniform float uWear;
  uniform float uUpBias;
  uniform float uEdgeBias;
  uniform vec3  uWornColor;
  uniform float uWornRough;

  // Triplanar sample, so surfaces without UVs still get a coherent mask.
  float triSample(sampler2D m, vec3 p, vec3 n, float scale) {
    vec3 bw = pow(abs(n), vec3(4.0));
    bw /= max(bw.x + bw.y + bw.z, 1e-4);
    float x = texture2D(m, p.yz * scale).r;
    float y = texture2D(m, p.xz * scale).r;
    float z = texture2D(m, p.xy * scale).r;
    return x * bw.x + y * bw.y + z * bw.z;
  }

  // 0 = paint intact, 1 = worn back to the substrate.
  float wearMask() {
    vec3 n = normalize(vWNrm);
    float noise = triSample(uNoise, vWPos, n, uNoiseScale);
    float up = clamp(n.y, 0.0, 1.0);
    vec3 V = normalize(cameraPosition - vWPos);
    float edge = pow(1.0 - clamp(dot(V, n), 0.0, 1.0), 3.0);
    float exposure = noise + up * uUpBias + edge * uEdgeBias;
    return smoothstep(1.0 - uWear - 0.22, 1.0 - uWear + 0.22, exposure);
  }
`;

function injectWear(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${COMMON_VERT}`)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON_FRAG}`)
      .replace('#include <map_fragment>', /* glsl */`
        #include <map_fragment>
        float wear = wearMask();
        diffuseColor.rgb = mix(diffuseColor.rgb, uWornColor, wear);
      `)
      .replace('#include <roughnessmap_fragment>', /* glsl */`
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uWornRough, wearMask());
      `);
    material.userData.shader = shader;
  };
  // Distinguish this program from a stock MeshStandardMaterial.
  material.customProgramCacheKey = () => 'weathered-' + material.name;
  return material;
}

/**
 * Painted timber worn back to bare wood.
 * @param {object} o
 * @param {THREE.ColorRepresentation} o.paint    the surviving paint colour
 * @param {THREE.ColorRepresentation} o.timber   substrate showing through
 * @param {number} [o.wear=0.45]      0 = pristine, 1 = fully stripped
 * @param {number} [o.noiseScale=0.9] world-space repeats per metre
 */
export function createWornPaintMaterial({
  paint, timber, wear = 0.45, noiseScale = 0.9,
  roughness = 0.72, metalness = 0.0, wornRoughness = 0.86,
  upBias = 0.3, edgeBias = 0.45, name = 'wornPaint',
}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(paint), roughness, metalness, name,
  });
  return injectWear(mat, {
    uNoise: { value: sharedNoiseTexture() },
    uNoiseScale: { value: noiseScale },
    uWear: { value: wear },
    uUpBias: { value: upBias },
    uEdgeBias: { value: edgeBias },
    uWornColor: { value: new THREE.Color(timber) },
    uWornRough: { value: wornRoughness },
  });
}

/**
 * Glazed roof tile: a dark coloured glaze with grime settling into it.
 * Grime collects on up-facing surfaces, so upBias is high and edgeBias low.
 */
export function createGlazedTileMaterial({
  glaze = '#2b332c', grime = '#171a18', grimeAmount = 0.5,
  roughness = 0.42, noiseScale = 1.6, name = 'glazedTile',
}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(glaze), roughness, metalness: 0.08, name,
  });
  return injectWear(mat, {
    uNoise: { value: sharedNoiseTexture() },
    uNoiseScale: { value: noiseScale },
    uWear: { value: grimeAmount },
    uUpBias: { value: 0.55 },
    uEdgeBias: { value: 0.05 },
    uWornColor: { value: new THREE.Color(grime) },
    uWornRough: { value: 0.8 },
  });
}

/** Aged gold with tarnish pooling in the recesses. */
export function createAgedGoldMaterial({
  gold = '#C9A24A', tarnish = '#4a3a1c', tarnishAmount = 0.35,
  roughness = 0.34, noiseScale = 2.2, name = 'agedGold',
}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(gold), roughness, metalness: 1.0, name,
  });
  return injectWear(mat, {
    uNoise: { value: sharedNoiseTexture() },
    uNoiseScale: { value: noiseScale },
    uWear: { value: tarnishAmount },
    // Tarnish is the inverse of wear: it survives where light does not reach,
    // so bias away from up-facing and silhouette.
    uUpBias: { value: -0.25 },
    uEdgeBias: { value: -0.2 },
    uWornColor: { value: new THREE.Color(tarnish) },
    uWornRough: { value: 0.62 },
  });
}

/** Weathered stone, lightened where rain hits and darkened in shelter. */
export function createWeatheredStoneMaterial({
  stone = '#4a4845', bleach = '#6a6660', amount = 0.4,
  roughness = 0.88, noiseScale = 1.1, name = 'weatheredStone',
}) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(stone), roughness, metalness: 0.0, name,
  });
  return injectWear(mat, {
    uNoise: { value: sharedNoiseTexture() },
    uNoiseScale: { value: noiseScale },
    uWear: { value: amount },
    uUpBias: { value: 0.4 },
    uEdgeBias: { value: 0.3 },
    uWornColor: { value: new THREE.Color(bleach) },
    uWornRough: { value: 0.92 },
  });
}

/**
 * Swap materials on a loaded model by the GLB's own material names.
 * Returns {applied, missing} so a caller can assert the map still matches the
 * asset — material names are a contract with the file, and files change.
 *
 * @param {THREE.Object3D} target
 * @param {Record<string, THREE.Material>} overrides  material name -> replacement
 */
export function applyMaterialOverrides(target, overrides) {
  const seen = new Set();
  let applied = 0;
  target.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const next = list.map((m) => {
      if (!m) return m;
      seen.add(m.name);
      const repl = overrides[m.name];
      if (!repl) return m;
      applied++;
      return repl;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
  const missing = Object.keys(overrides).filter((k) => !seen.has(k));
  return { applied, missing, found: [...seen] };
}
