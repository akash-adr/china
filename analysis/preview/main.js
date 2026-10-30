// Visual confirmation harness: loads the finished assets in public/models/
// through src/config/models.js and src/lib/ModelStage.js, so what you see here
// is exactly what the site will get.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { MODELS, MODELS_BY_ID, CHAPTERS, chapterBudget, TOTAL_MB } from '@/config/models.js';
import { ModelStage, createLoader, loadModel } from '@/lib/ModelStage.js';
import { JinguBang } from '@/components/JinguBang.js';
import { applyGateMaterials } from '@/lib/presets/torriGate.js';

const stageEl = document.getElementById('stage');
const hud = document.getElementById('hud');
const statusEl = document.getElementById('status');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stageEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x4a4d55);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTexture;

const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(30, 50, 40); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
Object.assign(key.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 300 });
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(-40, 20, 25); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(-15, 30, -50); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.5));

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 4000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Cinematic rig: a single warm rim behind the subject, fog, and bloom. Kept
// separate from the neutral studio lights so the two looks can be compared.
const rimLight = new THREE.DirectionalLight(0xC9A24A, 0);
rimLight.position.set(-18, 14, -34);
scene.add(rimLight);

const NEUTRAL_BG = new THREE.Color(0x4a4d55);
const DARK_BG = new THREE.Color(0x0c0e11);
const studioLights = [key, fill, rim];
const studioBase = studioLights.map((l) => l.intensity);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.0, 0.7, 0.6);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let cinematic = false;
function setCinematic(on) {
  cinematic = on;
  scene.background = on ? DARK_BG : NEUTRAL_BG;
  scene.fog = on ? new THREE.FogExp2(0x0c0e11, 0.012) : null;
  scene.environment = on ? null : envTexture;
  studioLights.forEach((l, i) => { l.intensity = studioBase[i] * (on ? 0.16 : 1); });
  rimLight.intensity = on ? 6.5 : 0;
  bloom.strength = on ? 0.85 : 0.0;
  renderer.toneMappingExposure = on ? 1.15 : 1.0;
}


const helpers = new THREE.Group(); scene.add(helpers);
const content = new THREE.Group(); scene.add(content);

const loader = createLoader(THREE, { GLTFLoader, DRACOLoader, dracoPath: '/draco/' });
const clock = new THREE.Clock();
let mixers = [];
let focus = new THREE.Vector3();
let radius = 10;
let spin = false;

const opt = (id) => document.getElementById(id).checked;

function clearContent() {
  for (const child of [...content.children]) {
    if (child instanceof ModelStage) child.dispose();
    content.remove(child);
  }
  mixers = [];
}

// ---------------------------------------------------------------- helpers
function humanRef(x = 0, z = 0) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.6, transparent: true, opacity: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 1.1, 4, 12), mat);
  body.position.y = 0.76; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12), mat);
  head.position.y = 1.64; head.castShadow = true;
  g.add(body, head);
  g.position.set(x, 0, z);
  g.name = 'humanRef';
  return g; // 1.8 m total
}

function buildHelpers(extent) {
  helpers.clear();
  if (opt('grid')) {
    const span = Math.max(8, Math.ceil(extent * 1.3));
    const grid = new THREE.GridHelper(span * 2, span * 2, 0x6c6f78, 0x44474e);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    helpers.add(grid);
    helpers.add(new THREE.AxesHelper(Math.max(2, extent * 0.15)));
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002; floor.receiveShadow = true;
  helpers.add(floor);
}

// Union of stage bounds. ModelStage already knows its own box (measured, or
// taken from config for skinned assets), so prefer that over setFromObject.
function contentBox() {
  const box = new THREE.Box3();
  for (const child of content.children) {
    if (child instanceof ModelStage) {
      box.union(child.box.clone().translate(child.position));
    } else {
      box.union(new THREE.Box3().setFromObject(child));
    }
  }
  return box.isEmpty() ? new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)) : box;
}

const VIEWS = { front: [0, 0.22], side: [90, 0.22], three_quarter: [38, 0.30], top: [38, 0.8] };
let currentView = 'three_quarter';

function setView(name) {
  currentView = name in VIEWS ? name : currentView;
  const [azDeg, elev] = VIEWS[currentView];
  const az = azDeg * Math.PI / 180;
  camera.position.set(
    focus.x + Math.cos(elev) * Math.sin(az) * radius,
    focus.y + Math.sin(elev) * radius,
    focus.z + Math.cos(elev) * Math.cos(az) * radius,
  );
  controls.target.copy(focus);
  controls.update();
  window.__view = currentView;
}

function frameBox(box) {
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  focus.set(centre.x, Math.max(size.y * 0.45, centre.y), centre.z);
  const maxDim = Math.max(size.x, size.y, size.z);
  radius = (maxDim / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.35;
  camera.far = Math.max(2000, radius * 6);
  camera.near = Math.max(0.05, radius / 4000);
  camera.updateProjectionMatrix();
  setView(currentView);
}

function trackAnimation(stage, clipName) {
  if (!stage.animations?.length) return;
  const mixer = new THREE.AnimationMixer(stage.gltf.scene);
  const clip = (clipName && stage.animations.find((a) => a.name === clipName))
    || stage.animations[0];
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  mixers.push({ mixer, action, clips: stage.animations, stage });
}

const clipBox = document.getElementById('clipbox');
const clipSel = document.getElementById('clip');
function syncClipUI() {
  const clips = mixers[0]?.clips ?? [];
  clipBox.style.display = clips.length > 1 ? '' : 'none';
  if (clips.length > 1 && clipSel.options.length !== clips.length) {
    clipSel.innerHTML = clips.map((c) => `<option>${c.name}</option>`).join('');
  }
}
clipSel.onchange = () => { if (currentId) showOne(currentId, clipSel.value); };

// ---- procedural entries (no file to load)
let staff = null;
const staffBox = document.getElementById('staffbox');

function buildProcedural(entry) {
  if (entry.component === 'JinguBang') {
    const s = new JinguBang({ length: entry.worldSize[1] });
    s.glow = +document.getElementById('glow').value;
    s.extend = +document.getElementById('extend').value;
    s.spin = +document.getElementById('spinr').value;
    return s;
  }
  throw new Error('unknown procedural component: ' + entry.component);
}

/** Load a config entry, whether it comes from a file or from code. */
async function buildEntry(entry) {
  if (!entry.path) {
    const obj = buildProcedural(entry);
    const stage = new ModelStage(obj, { entry, mode: 'world' });
    stage.animations = [];
    staff = obj;
    return stage;
  }
  const stage = await loadModel(entry, loader);
  // The gate ships in tourist red; the weathering lives in code, not the GLB.
  if (entry.id === 'torri_gate' && opt('recolour')) {
    applyGateMaterials(stage.gltf.scene);
  }
  return stage;
}

// ---------------------------------------------------------------- loading
let currentId = null;

async function showLineup() {
  currentId = null;
  statusEl.style.display = ''; statusEl.textContent = 'Loading all models…';
  window.__ready = false;
  clearContent();
  document.getElementById('lineup').classList.add('on');
  document.querySelectorAll('.item').forEach((el) => el.classList.remove('on'));

  const GAP = 3;
  let cursor = 0;
  const placed = [];
  // Ascending footprint, so small props aren't lost beside the temple scan.
  let order = [...MODELS].sort((a, b) => a.worldSize[0] - b.worldSize[0]);
  // The 80 m scan is two orders of magnitude bigger than the props; hiding it
  // makes the rest legible at a glance without faking anyone's scale.
  if (opt('noscan')) order = order.filter((m) => m.id !== 'jinshan_temple_cishou_pagoda');
  for (const entry of order) {
    let stage;
    try {
      stage = await buildEntry(entry);
    } catch (e) {
      console.error('failed', entry.id, e);
      continue;
    }
    const w = stage.size.x;
    stage.position.x = cursor + w / 2;
    cursor += w + GAP;
    content.add(stage);
    trackAnimation(stage);
    placed.push(stage);
  }
  // Recentre the row on the origin.
  const shift = cursor / 2;
  for (const s of placed) s.position.x -= shift;
  if (opt('human')) content.add(humanRef(-shift - GAP, 0));

  window.__stages = placed;
  const box = contentBox();
  buildHelpers(Math.max(box.getSize(new THREE.Vector3()).x / 2, 20));
  frameBox(box);

  const tris = MODELS.reduce((s, m) => s + m.budget.triangles, 0);
  const bad = placed.filter((s) => s.measured && Math.abs(s.box.min.y) > 0.02);
  const drift = placed.filter((s) => Math.abs(s.baseOffsetDrift) > 0.01);
  hud.innerHTML =
    `<b>${placed.length} of ${MODELS.length} models — true world scale (1 unit = 1 m)</b><br>` +
    `${TOTAL_MB} MB · ${tris.toLocaleString()} triangles total<br>` +
    `gold figure = 1.8 m reference<br>` +
    (bad.length
      ? `<span class="warn">${bad.length} not seated on the floor: ${bad.map((s) => s.entry.id).join(', ')}</span>`
      : `all ${placed.length} seated on y = 0 ✓`) +
    (drift.length
      ? `<br><span class="warn">config baseOffset drift: ${drift.map((s) => s.entry.id).join(', ')}</span>`
      : '<br>config baseOffset matches measured seat ✓');
  statusEl.style.display = 'none';
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}

async function showOne(id, clipName) {
  const entry = MODELS_BY_ID[id];
  currentId = id;
  staff = null;
  statusEl.style.display = ''; statusEl.textContent = 'Loading ' + id + '…';
  window.__ready = false;
  clearContent();
  document.getElementById('lineup').classList.remove('on');
  document.querySelectorAll('.item').forEach((el) => el.classList.toggle('on', el.dataset.id === id));
  try {
    const stage = await buildEntry(entry);
    content.add(stage);
    window.__stages = [stage];
    trackAnimation(stage, clipName);
    syncClipUI();
    staffBox.style.display = staff ? '' : 'none';
    if (opt('human')) content.add(humanRef(stage.size.x / 2 + 1.2, 0));

    const box = contentBox();
    buildHelpers(Math.max(box.getSize(new THREE.Vector3()).x, 6));
    frameBox(box);

    const b = entry.budget;
    const seated = !stage.measured || Math.abs(stage.box.min.y) < 0.02;
    hud.innerHTML =
      `<b>${entry.label}</b> <span style="color:#8e8b84">${entry.id}</span><br>` +
      `chapter ${entry.chapter} — ${CHAPTERS[entry.chapter]}` +
      (entry.alsoIn?.length ? ` (also ${entry.alsoIn.join(', ')})` : '') + `<br>` +
      `world size ${stage.size.x.toFixed(2)} × ${stage.size.y.toFixed(2)} × ${stage.size.z.toFixed(2)} m ` +
      `· scale ×${entry.scale}<br>` +
      `${entry.path ? b.sizeMB + ' MB' : 'procedural, 0 MB'} · ${b.triangles.toLocaleString()} tris · ` +
      `${b.textureVramMB} MB VRAM · ${b.drawCalls} draw calls<br>` +
      (entry.animations?.length
        ? `clips: ${entry.animations.map((a) => `${a.name} (${a.duration}s)`).join(', ')}<br>` : '') +
      (seated ? 'seated on y = 0 ✓' : `<span class="warn">floating: min y = ${stage.box.min.y.toFixed(3)}</span>`) +
      (stage.measured ? '' : '<br><span style="color:#8e8b84">skinned — bounds from config, not measured</span>');
    statusEl.style.display = 'none';
  } catch (e) {
    statusEl.textContent = 'FAILED: ' + e.message;
    window.__error = String(e.message);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}

/**
 * Load an arbitrary .glb by URL, outside the config. Used to vet new candidate
 * assets before they earn a config row. Normalised ('fit') so anything frames
 * sensibly regardless of the 670x scale spread in raw downloads.
 */
async function showRaw(url, fitSize = 2, hide = []) {
  currentId = null;
  statusEl.style.display = ''; statusEl.textContent = 'Loading ' + url.split('/').pop() + '…';
  window.__ready = false;
  clearContent();
  document.getElementById('lineup').classList.remove('on');
  document.querySelectorAll('.item').forEach((el) => el.classList.remove('on'));
  try {
    const gltf = await loader.loadAsync(url);
    // Drop enclosing meshes (sky domes, backdrops) that would otherwise swallow
    // the subject and ruin both framing and the screenshot.
    const dropped = [];
    if (hide.length) {
      const kill = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const names = [o.name, o.material?.name, o.parent?.name].filter(Boolean).map((n) => n.toLowerCase());
        if (hide.some((h) => names.some((n) => n.includes(h)))) kill.push(o);
      });
      for (const o of kill) { dropped.push(o.name || o.material?.name || '?'); o.removeFromParent(); }
    }
    const stage = new ModelStage(gltf.scene, { mode: 'fit', fitSize });
    stage.gltf = gltf;
    stage.animations = gltf.animations ?? [];
    content.add(stage);
    window.__stages = [stage];
    trackAnimation(stage);

    const box = contentBox();
    buildHelpers(Math.max(box.getSize(new THREE.Vector3()).x, 4));
    frameBox(box);

    let tris = 0, meshes = 0, skinned = 0;
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (o.isSkinnedMesh) skinned++;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    hud.innerHTML =
      `<b>${url.split('/').pop()}</b> <span style="color:#8e8b84">(raw, normalised to ${fitSize} units)</span><br>` +
      `${Math.round(tris).toLocaleString()} tris · ${meshes} meshes` +
      (skinned ? ` · ${skinned} skinned` : '') + `<br>` +
      `animations: ${stage.animations.length
        ? stage.animations.map((a) => `${a.name} (${a.duration.toFixed(2)}s)`).join(', ') : 'none'}` +
      (dropped.length ? `<br><span style="color:#8e8b84">hidden: ${dropped.join(', ')}</span>` : '');
    statusEl.style.display = 'none';
  } catch (e) {
    statusEl.textContent = 'FAILED: ' + e.message;
    window.__error = String(e.message);
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__ready = true; }));
}

// ---------------------------------------------------------------- UI
const list = document.getElementById('list');
for (const m of MODELS) {
  const el = document.createElement('div');
  el.className = 'item'; el.dataset.id = m.id;
  el.innerHTML = `<span>${m.id}</span><span class="m">ch${m.chapter} · ${m.budget.sizeMB}MB</span>`;
  el.onclick = () => showOne(m.id);
  list.appendChild(el);
}
document.getElementById('lineup').onclick = () => showLineup();
document.querySelectorAll('[data-view]').forEach((b) => { b.onclick = () => setView(b.dataset.view); });
document.getElementById('spin').onchange = (e) => { spin = e.target.checked; };
document.getElementById('grid').onchange = () => reload();
document.getElementById('human').onchange = () => reload();
document.getElementById('noscan').onchange = () => reload();
document.getElementById('recolour').onchange = () => reload();
document.getElementById('cine').onchange = (e) => setCinematic(e.target.checked);

for (const [id, prop, fmt] of [['glow', 'glow', 2], ['extend', 'extend', 2], ['spinr', 'spin', 2]]) {
  const el = document.getElementById(id);
  const out = document.getElementById(id === 'spinr' ? 'spinv' : id + 'v');
  el.oninput = () => {
    const v = +el.value;
    out.textContent = v.toFixed(fmt);
    if (!staff) return;
    staff[prop] = v;
    // `extend` changes the staff's size, so its stage has to be seated again.
    if (prop === 'extend') window.__stages?.[0]?.reseat?.();
  };
}
document.getElementById('play').onchange = (e) => {
  for (const { action } of mixers) action.paused = !e.target.checked;
};

function reload() { return currentId ? showOne(currentId) : showLineup(); }

function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.resolution.set(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  for (const { mixer } of mixers) mixer.update(dt);
  if (staff) staff.update(dt);
  if (spin) content.rotation.y += 0.003;
  controls.update();
  composer.render();
});

// Playwright hooks
window.__showOne = (id, clip) => showOne(id, clip);
window.__showRaw = (url, fit, hide) => showRaw(url, fit, hide || []);
window.__showLineup = (noscan) => {
  if (noscan !== undefined) document.getElementById('noscan').checked = !!noscan;
  return showLineup();
};
window.__setView = setView;
window.__models = MODELS;
window.__budgets = [1, 2, 3, 4, 5, 6].map(chapterBudget);
// Scrub to an absolute time. A paused action is not advanced by mixer.update,
// so unpause, set the time, evaluate with a zero delta, then re-pause.
// Re-frame from live geometry. Needed after `extend` changes the staff's size,
// since ModelStage.box is measured once at construction.
window.__reframe = () => { frameBox(new THREE.Box3().setFromObject(content)); };
// Macro framing: look at a world point from a given distance. Needed for the
// staff, where a 4 cm prop framed at full length is only a couple of dozen
// pixels wide and no amount of lighting will show the engraving.
window.__focusOn = ([x, y, z], distance, azDeg = 25, elevDeg = 8) => {
  const az = azDeg * Math.PI / 180, el = elevDeg * Math.PI / 180;
  focus.set(x, y, z);
  radius = distance;
  camera.near = Math.max(0.005, distance / 500);
  camera.far = Math.max(50, distance * 200);
  camera.updateProjectionMatrix();
  camera.position.set(
    x + Math.cos(el) * Math.sin(az) * distance,
    y + Math.sin(el) * distance,
    z + Math.cos(el) * Math.cos(az) * distance,
  );
  controls.target.copy(focus);
  controls.update();
};
window.__setHuman = (on) => {
  document.getElementById('human').checked = !!on;
  return reload();
};
window.__setCinematic = (on) => {
  document.getElementById('cine').checked = !!on;
  setCinematic(!!on);
};
window.__setRecolour = (on) => {
  document.getElementById('recolour').checked = !!on;
  return reload();
};
window.__setStaff = (p) => {
  for (const [id, prop] of [['glow', 'glow'], ['extend', 'extend'], ['spinr', 'spin']]) {
    if (p[prop] === undefined) continue;
    const el = document.getElementById(id);
    el.value = String(p[prop]);
    el.dispatchEvent(new Event('input'));
  }
};
window.__setClip = (name) => {
  document.getElementById('clip').value = name;
  return showOne(currentId, name);
};
window.__setTime = (t) => {
  for (const { action, mixer } of mixers) {
    action.paused = false;
    action.time = t;
    mixer.update(0);
    action.paused = true;
  }
};

const q = new URLSearchParams(location.search);
if (q.has('clean')) {
  document.getElementById('side').style.display = 'none';
  if (q.get('clean') === 'nohud') hud.style.display = 'none';
}
if (q.get('raw')) showRaw(q.get('raw'));
else if (q.get('m')) showOne(q.get('m'));
else showLineup();
