/**
 * ModelStage — the auto-centre / base-to-floor wrapper, extracted from the
 * analysis preview harness so the site and the preview share one implementation.
 *
 * The source assets disagree about scale (670x spread), about where the origin
 * sits relative to the geometry, and about whether the origin is even inside the
 * bounding box. This wrapper hides all of that behind one Object3D whose
 * contract is simple: it stands on y = 0 at its configured world size, centred
 * on its own footprint.
 *
 * Two modes:
 *   'world' — honour the config's scale/baseOffset/rotationFix. Real metres,
 *             so models are correct relative to each other. Use this in the site.
 *   'fit'   — ignore the config and normalise to `fitSize` units tall-ish,
 *             for inspecting one model on its own.
 */
import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _centre = new THREE.Vector3();

export class ModelStage extends THREE.Group {
  /**
   * @param {THREE.Object3D} scene     the loaded gltf.scene
   * @param {object}  [options]
   * @param {'world'|'fit'} [options.mode='world']
   * @param {object}  [options.entry]        config row from src/config/models.js
   * @param {number}  [options.fitSize=2]    target size in 'fit' mode
   * @param {boolean} [options.centre=true]  centre horizontally on the footprint
   * @param {boolean} [options.shadows=true]
   */
  constructor(scene, options = {}) {
    super();
    const {
      mode = 'world', entry = null, fitSize = 2,
      centre = true, shadows = true,
    } = options;

    this.name = `ModelStage:${entry?.id ?? scene.name ?? 'model'}`;
    this.entry = entry;
    this.mode = mode;

    // Inner group carries the asset's own offset; `this` carries world placement,
    // so callers can move/rotate `this` freely without disturbing the centring.
    this.inner = new THREE.Group();
    this.inner.name = 'ModelStage.inner';
    this.inner.add(scene);
    this.add(this.inner);

    if (shadows) {
      scene.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
    }

    // Rotation fix first — it changes what "lowest point" means.
    if (mode === 'world' && entry?.rotationFix) {
      this.inner.rotation.set(...entry.rotationFix);
    }

    const scale = mode === 'world'
      ? (entry?.scale ?? 1)
      : fitSize / (this.#measure(_size).toArray().reduce((a, b) => Math.max(a, b), 0) || 1);
    this.inner.scale.setScalar(scale);

    // Re-measure after scale+rotation, then seat it on the floor.
    // inner.position is still (0,0,0) here, so these deltas are absolute.
    this.#measure(_size, _centre);

    // A skinned mesh's rendered shape comes from its bones, and neither
    // Box3.setFromObject nor SkinnedMesh.computeBoundingBox reports it reliably
    // before the skeleton has been driven (the dragon measures 19 units against
    // a true 4969). The config carries bounds measured offline from the file
    // itself, so for skinned assets those are the trustworthy numbers.
    this.measured = !(this.skinned && mode === 'world' && entry);

    if (this.measured) {
      this._centreXZ = centre;
      this.reseat();
      this.baseOffsetDrift = mode === 'world' && entry
        ? this.inner.position.y - entry.baseOffset : 0;
    } else {
      this.inner.position.set(0, entry.baseOffset, 0);
      this.baseOffsetDrift = 0;
      this.size = new THREE.Vector3(...entry.worldSize);
      this.box = new THREE.Box3(
        new THREE.Vector3(-entry.worldSize[0] / 2, 0, -entry.worldSize[2] / 2),
        new THREE.Vector3(entry.worldSize[0] / 2, entry.worldSize[1], entry.worldSize[2] / 2),
      );
    }
  }

  /**
   * Re-measure and re-seat: footprint centred on the origin, lowest point on
   * y = 0. The constructor calls this once, but anything that changes the
   * subtree's size afterwards — the staff's `extend`, a swapped LOD — must call
   * it again, or the object keeps the seating of the size it used to be.
   */
  reseat() {
    if (!this.measured) return this;
    this.inner.position.set(0, 0, 0);
    this.#measure(_size, _centre);
    this.inner.position.set(
      this._centreXZ ? -_centre.x : 0,
      -_box.min.y,
      this._centreXZ ? -_centre.z : 0,
    );
    this.#measure(_size, _centre);
    this.size = _size.clone();
    this.box = _box.clone();
    return this;
  }

  /**
   * Measure the subtree into the shared _box.
   *
   * precise=true walks real vertex positions, so a model carrying a rotation
   * (the dragon statue is tilted ~28 degrees) is not overestimated the way
   * transforming a local AABB's corners would be — that cost 0.21 m of seat
   * error. It still cannot bound a skinned mesh whose shape comes from bones,
   * which the constructor handles by falling back to the config.
   */
  #measure(sizeOut, centreOut) {
    this.inner.updateWorldMatrix(true, true);
    let sawSkinned = false;
    this.inner.traverse((o) => { if (o.isSkinnedMesh) sawSkinned = true; });
    this.skinned = sawSkinned;

    if (sawSkinned) {
      // Box3's precise path routes through SkinnedMesh.getVertexPosition, which
      // applies bone transforms and — before the skeleton has been driven —
      // collapses to a fraction of the real extent. Fall back to the rest-pose
      // bounds: each geometry's own AABB through its node's world matrix. That
      // matches what offline tools report, and is good enough to frame by.
      _box.makeEmpty();
      const b = new THREE.Box3();
      this.inner.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (o.geometry.boundingBox) _box.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      });
      if (_box.isEmpty()) _box.setFromObject(this.inner, true);
    } else {
      _box.setFromObject(this.inner, true);
    }

    if (sizeOut) _box.getSize(sizeOut);
    if (centreOut) _box.getCenter(centreOut);
    return sizeOut ?? _box;
  }

  /** Free geometry, materials and textures owned by this subtree. */
  dispose() {
    this.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry?.dispose();
      for (const m of [].concat(o.material || [])) {
        for (const k of Object.keys(m)) {
          const v = m[k];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose?.();
      }
    });
    this.clear();
  }
}

/** Convenience factory mirroring the class constructor. */
export function createModelStage(scene, options) {
  return new ModelStage(scene, options);
}

/**
 * A GLTFLoader wired for these assets (Draco geometry, WebP textures).
 * `dracoPath` must serve three's draco decoder; public/draco/ holds a copy.
 */
export function createLoader(THREE_NS, { GLTFLoader, DRACOLoader, dracoPath = '/draco/' } = {}) {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(dracoPath);
  loader.setDRACOLoader(draco);
  loader.dracoLoader = draco;
  return loader;
}

/** Load one config entry and return a staged, floor-seated Object3D. */
export async function loadModel(entry, loader, options = {}) {
  const gltf = await loader.loadAsync(entry.path);
  const stage = new ModelStage(gltf.scene, { entry, mode: 'world', ...options });
  stage.gltf = gltf;
  stage.animations = gltf.animations ?? [];
  return stage;
}
