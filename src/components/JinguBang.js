/**
 * JinguBang — the Ruyi Jingu Bang, built procedurally. No external model.
 *
 * Chapter 4's hero prop. Every licensable staff we found was the wrong weapon,
 * so this is modelled in code: a plain dark-iron rod with gold end-caps, which
 * is simple enough geometrically that authoring it beats sourcing it — and it
 * gains animatable extension, which no downloaded mesh would have.
 *
 * Built along +Y, centred on the origin, in metres to match src/config/models.js.
 *
 *   const staff = new JinguBang();
 *   staff.glow = 0.8;        // inscription and cap rims light up
 *   staff.extend = 0.5;      // shaft grows; caps stay at the ends
 *   staff.spin = 1.5;        // rad/sec about its own axis
 *   staff.update(dt);        // call per frame
 *
 * This is a plain THREE.Group subclass rather than a React component because
 * the project is vanilla three.js; wrapping it in JSX is a few lines if the
 * site later moves to react-three-fiber.
 */
import * as THREE from 'three';
import { hammeredNormalTexture } from '../lib/materials/noise.js';

const GOLD = '#C9A24A';
const IRON = '#15161a';

/** Gold Chinese inscription on a transparent strip, for the shaft. */
function createInscriptionTexture({ width = 256, height = 2048, text = '如意金箍棒' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  // The strip wraps the full circumference (~12.6 cm at the default radius), so a
  // glyph at 62% of width would wrap most of the way round and never be legible
  // from one viewpoint. A third of the circumference keeps a whole character on
  // the face that is turned toward camera.
  const glyph = Math.floor(width * 0.33);
  ctx.font = `${glyph}px "Songti SC", "SimSun", "Noto Serif CJK SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd98a';
  ctx.shadowColor = '#ffbf5a';
  ctx.shadowBlur = glyph * 0.22;

  // Repeat the phrase down the strip with even spacing.
  const chars = [...text];
  const step = glyph * 1.35;
  const count = Math.floor(height / step);
  for (let i = 0; i < count; i++) {
    ctx.fillText(chars[i % chars.length], width / 2, step * (i + 0.5));
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Faint ruyi cloud-scroll band, as a height canvas for engraving the caps. */
function createCloudScrollCanvas({ size = 256 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#f0f0f0';
  ctx.lineCap = 'round';
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const cy = size * ((r + 0.5) / rows);
    ctx.lineWidth = size * 0.016;
    for (let i = 0; i < 6; i++) {
      const cx = size * ((i + 0.5) / 6);
      const s = size * 0.055;
      // A ruyi head: a spiral curl closing back on itself.
      ctx.beginPath();
      ctx.arc(cx, cy, s, Math.PI * 0.15, Math.PI * 1.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + s * 0.55, cy, s * 0.45, Math.PI * 1.1, Math.PI * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 1.0, cy + s * 0.5);
      ctx.quadraticCurveTo(cx, cy + s * 1.15, cx + s * 1.0, cy + s * 0.5);
      ctx.stroke();
    }
  }
  return canvas;
}

export class JinguBang extends THREE.Group {
  /**
   * @param {object} [o]
   * @param {number} [o.length=1.8]       resting length, metres
   * @param {number} [o.radius=0.02]      shaft radius (0.04 m diameter)
   * @param {number} [o.capFraction=0.12] each cap, as a fraction of resting length
   * @param {number} [o.maxExtend=6]      multiplier at extend = 1
   * @param {number} [o.radialSegments=32]
   */
  constructor({
    length = 1.8, radius = 0.02, capFraction = 0.12,
    maxExtend = 6, radialSegments = 32,
  } = {}) {
    super();
    this.name = 'JinguBang';
    this.baseLength = length;
    this.radius = radius;
    this.capLength = length * capFraction;
    this.maxExtend = maxExtend;

    this._glow = 0;
    this._extend = 0;
    this.spin = 0;

    this._disposables = [];

    // ---------------------------------------------------------------- shaft
    const hammered = hammeredNormalTexture();
    this.shaftMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(IRON),
      metalness: 0.65,          // forged iron: metallic but not a mirror
      roughness: 0.6,
      normalMap: hammered,
      normalScale: new THREE.Vector2(0.7, 0.7),
      name: 'jingubang_iron',
    });
    hammered.repeat.set(3, 18);

    // Unit-height cylinder so extension is a single scale.y.
    const shaftGeo = new THREE.CylinderGeometry(radius, radius, 1, radialSegments, 1, true);
    this.shaft = new THREE.Mesh(shaftGeo, this.shaftMaterial);
    this.shaft.castShadow = this.shaft.receiveShadow = true;
    this.add(this.shaft);
    this._disposables.push(shaftGeo);

    // ---------------------------------------------------- gold inscription
    this.inscriptionTexture = createInscriptionTexture();
    this.inscriptionMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(GOLD),
      metalness: 1.0,
      roughness: 0.28,
      map: this.inscriptionTexture,
      transparent: true,
      alphaMap: this.inscriptionTexture,
      emissive: new THREE.Color(GOLD),
      emissiveMap: this.inscriptionTexture,
      emissiveIntensity: 0,
      depthWrite: false,
      name: 'jingubang_inscription',
    });
    // A hair above the shaft so it never z-fights.
    const inscGeo = new THREE.CylinderGeometry(
      radius * 1.004, radius * 1.004, 1, radialSegments, 1, true);
    this.inscription = new THREE.Mesh(inscGeo, this.inscriptionMaterial);
    this.add(this.inscription);
    this._disposables.push(inscGeo);

    // ---------------------------------------------------------- gold caps
    const scrollCanvas = createCloudScrollCanvas();
    // Engraving: shallow, so the cloud scroll reads as faint tooling.
    const scrollNormal = new THREE.CanvasTexture(scrollCanvas);
    scrollNormal.wrapS = scrollNormal.wrapT = THREE.RepeatWrapping;
    scrollNormal.colorSpace = THREE.NoColorSpace;

    this.capMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(GOLD),
      metalness: 1.0,
      roughness: 0.3,
      bumpMap: scrollNormal,
      bumpScale: 0.0016,
      emissive: new THREE.Color(GOLD),
      emissiveIntensity: 0,
      name: 'jingubang_gold',
    });
    this._disposables.push(scrollNormal);

    const capR = radius * 1.28;
    const capGeo = new THREE.CylinderGeometry(capR, capR, this.capLength, radialSegments, 1);
    this.capTop = new THREE.Mesh(capGeo, this.capMaterial);
    this.capBottom = new THREE.Mesh(capGeo, this.capMaterial);
    for (const c of [this.capTop, this.capBottom]) {
      c.castShadow = c.receiveShadow = true;
      this.add(c);
    }
    this._disposables.push(capGeo);

    // Three engraved rings per cap, as raised bands.
    this.rings = [];
    const ringGeo = new THREE.TorusGeometry(capR * 1.02, radius * 0.07, 8, radialSegments);
    this._disposables.push(ringGeo);
    for (const cap of [this.capTop, this.capBottom]) {
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(ringGeo, this.capMaterial);
        ring.rotation.x = Math.PI / 2;
        // Spread across the cap, inset from both ends.
        ring.position.y = this.capLength * (-0.3 + i * 0.3);
        cap.add(ring);
        this.rings.push(ring);
      }
    }

    // Thin gold band at the centre grip.
    const bandGeo = new THREE.CylinderGeometry(
      radius * 1.14, radius * 1.14, length * 0.035, radialSegments, 1);
    this.gripBand = new THREE.Mesh(bandGeo, this.capMaterial);
    this.gripBand.castShadow = true;
    this.add(this.gripBand);
    this._disposables.push(bandGeo);

    this._layout();
  }

  /** Current overall length in metres, including caps. */
  get length() {
    return this.baseLength * (1 + this._extend * (this.maxExtend - 1));
  }

  /** 0–1. Drives the inscription and the cap rims. */
  get glow() { return this._glow; }
  set glow(v) {
    this._glow = THREE.MathUtils.clamp(v, 0, 1);
    // Inscription carries most of it; the gold only picks up a rim.
    this.inscriptionMaterial.emissiveIntensity = this._glow * 4.5;
    this.capMaterial.emissiveIntensity = this._glow * 0.55;
    this.shaftMaterial.color.setHex(0x15161a).lerp(new THREE.Color('#2a2026'), this._glow * 0.5);
  }

  /** 0–1. Grows the shaft up to maxExtend; the caps stay at the ends. */
  get extend() { return this._extend; }
  set extend(v) {
    this._extend = THREE.MathUtils.clamp(v, 0, 1);
    this._layout();
  }

  _layout() {
    const total = this.length;
    const shaftLen = Math.max(0.001, total - this.capLength * 2);

    this.shaft.scale.y = shaftLen;
    this.inscription.scale.y = shaftLen;

    // Keep glyphs a constant physical size as the shaft grows.
    const repeats = Math.max(1, Math.round(shaftLen / this.baseLength * 4));
    this.inscriptionTexture.repeat.set(1, repeats);
    this.shaftMaterial.normalMap.repeat.set(3, Math.max(4, Math.round(shaftLen * 10)));

    const capCentre = total / 2 - this.capLength / 2;
    this.capTop.position.y = capCentre;
    this.capBottom.position.y = -capCentre;
    this.capBottom.rotation.z = Math.PI; // mirror, so the rings read symmetrically
    this.gripBand.position.y = 0;
  }

  /** Advance spin. Call once per frame with seconds elapsed. */
  update(dt) {
    if (this.spin) this.rotation.y += this.spin * dt;
  }

  /** Bounding size in metres, for config/placement. */
  getSize() {
    return new THREE.Vector3(this.radius * 2.56, this.length, this.radius * 2.56);
  }

  dispose() {
    for (const d of this._disposables) d.dispose?.();
    this.inscriptionTexture.dispose();
    for (const m of [this.shaftMaterial, this.inscriptionMaterial, this.capMaterial]) m.dispose();
    this.clear();
  }
}

export function createJinguBang(options) {
  return new JinguBang(options);
}
