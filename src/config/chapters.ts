/**
 * Pacing and layout for the whole journey. This is the only file to edit when
 * tuning how the scroll feels — scroll length, camera keypoints, look-at
 * keypoints and the hold at each hero moment all live here.
 *
 * World convention matches src/config/models.js: Y-up, 1 unit = 1 metre,
 * everything rests on y = 0. The six chapters are regions of ONE continuous
 * world laid out along -Z, not six separate scenes, so the camera can fly from
 * the first to the last without a cut.
 */
import { MODELS_BY_ID } from './models.js';

export type Vec3 = [number, number, number];

/** A placeholder standing in for a real model, sized from its actual bounds. */
export interface PropPlacement {
  /** id in src/config/models.js — the box takes that model's worldSize. */
  modelId?: string;
  /** Explicit size when there is no model entry to measure. */
  size?: Vec3;
  shape?: 'box' | 'cylinder';
  position: Vec3;
  rotationY?: number;
  /** Marks the hero object of the chapter, drawn in gold. */
  hero?: boolean;
  /**
   * The real model is an opening the camera flies through (the paifang). A
   * solid box would read as a wall, so these are blocked out as a frame:
   * two uprights and a lintel, leaving the span clear.
   */
  hollow?: boolean;
  label?: string;
}

export interface Chapter {
  index: number;          // 1-based
  id: string;
  numeral: string;        // 一 二 三 …
  title: string;          // Chinese, set in Zhi Mang Xing
  subtitle: string;       // English, set in Cinzel Decorative
  /** Scroll length as a multiple of viewport height. Longer = slower. */
  scrollVh: number;
  /** Camera position keypoints, in order. Spline runs through these. */
  camera: Vec3[];
  /** Look-at keypoints. Independent of position, so the camera can orbit. */
  lookAt: Vec3[];
  /**
   * The hero beat.
   *
   * `on` is the KEYPOINT the camera should be sitting on when it slows —
   * not a scroll position. That distinction matters: slowing one window makes
   * everything outside it proportionally faster, so a hold "at 0.78 of the
   * scroll" lands at 0.91 of the path. Twice now that has silently put a hero
   * frame in the hand-off to the next chapter. Naming the keypoint and solving
   * for the scroll position (see resolveHoldAt) makes that impossible.
   *
   * `width` is how much of the chapter's scroll the hold occupies (0.3–0.4
   * reads as a real pause); `slow` is the speed multiplier inside it, where
   * 0.1 is almost stopped.
   */
  hold: { on: number; width: number; slow: number };
  props: PropPlacement[];
}

/** Resolve a placement's size, preferring the real model's measured bounds. */
export function propSize(p: PropPlacement): Vec3 {
  if (p.size) return p.size;
  if (p.modelId) {
    const m = MODELS_BY_ID[p.modelId];
    if (m) return m.worldSize as Vec3;
    console.warn(`[chapters] no model "${p.modelId}" in models.js`);
  }
  return [1, 1, 1];
}

export const CHAPTERS: Chapter[] = [
  {
    index: 1,
    id: 'ink-void',
    numeral: '一',
    title: '墨虚',
    subtitle: 'Ink Void',
    scrollVh: 156,   // 12%
    // Waking up. Starts low and close in the dark and barely moves: the first
    // third covers about four metres. The pull-up at the end is the only real
    // travel, and it doubles as the hand-off to the gate.
    camera: [[0, 1.55, 9], [0, 1.65, 5.2], [0, 1.9, -1.5], [0, 6.0, -16]],
    lookAt: [[0, 1.8, -5], [2.6, 2.0, -7.5], [4.2, 2.0, -7], [0, 2.6, -44]],
    // On keypoint 1 — the hold IS the opening, not a pause within it.
    hold: { on: 1, width: 0.4, slow: 0.11 },
    props: [
      // Offset from the camera line: the path runs down x = 0 toward chapter 2.
      { modelId: 'dragon_with_pearl', position: [4.6, 0, -6], rotationY: -0.6, hero: true,
        label: 'dragon statue' },
      { modelId: 'chinese_dragon_fan', position: [-3.2, 2.6, 4], rotationY: -0.5, label: 'fan' },
      { modelId: 'stylized_rock', position: [-7, 0, 10], label: 'rock' },
      { modelId: 'stylized_rock', position: [8.5, 0, 16], rotationY: 1.2, label: 'rock' },
    ],
  },
  {
    index: 2,
    id: 'mountain-gate',
    numeral: '二',
    title: '山门',
    subtitle: 'The Mountain Gate',
    scrollVh: 195,   // 15%
    // Eye height the whole way in, so the 5.5 m gate looms rather than being
    // looked down on. Five keypoints: the extra one is the pause between the
    // lions, which needs its own segment or the turn toward each is too quick
    // to register.
    camera: [[0, 1.7, -76], [0, 1.7, -95], [0, 1.68, -103], [0, 1.75, -109.5],
             [0, 2.3, -128]],
    // The two middle look-ats turn to each lion in turn, then recentre through
    // the opening for the hold.
    lookAt: [[0, 3.4, -110], [-2.6, 1.5, -102.5], [2.6, 1.5, -103.5],
             [0, 3.6, -118], [0, 3.0, -146]],
    // Keypoint 3: framed in the opening, just before pushing through.
    hold: { on: 3, width: 0.34, slow: 0.2 },
    props: [
      { modelId: 'torri_gate', position: [0, 0, -110], hero: true, hollow: true, label: 'paifang' },
      { modelId: 'stone_lion', position: [-3.6, 0, -103], rotationY: 0.12, label: 'lion' },
      { modelId: 'stone_lion', position: [3.6, 0, -103], rotationY: -0.12, label: 'lion' },
      { modelId: 'module_2_-_chinese_lantern', position: [-3.0, 3.4, -113], label: 'lantern' },
      { modelId: 'module_2_-_chinese_lantern', position: [3.0, 3.4, -113], label: 'lantern' },
      { modelId: 'stylized_rock', position: [-9, 0, -96], label: 'rock' },
      { modelId: 'stylized_rock', position: [8.5, 0, -118], rotationY: 0.8, label: 'rock' },
    ],
  },
  {
    index: 3,
    id: 'temple-ruins',
    numeral: '三',
    title: '废寺',
    subtitle: 'Temple Ruins',
    scrollVh: 286,   // 22% — the longest, it is the exploration chapter
    // A slow orbit that starts low and rises. Standoff matters: at 11 m an
    // 18 x 20 m building fills the frame and reads as a wall, so the orbit sits
    // around 40 m out and climbs to look down at the end.
    camera: [[-16, 3.0, -198], [-34, 4.8, -220], [-41, 11, -246], [-28, 20, -270],
             [-7, 29, -284]],
    // Holds the pagoda, then widens right at the end to take in the ginkgo at
    // x = +21 as well — that pairing is the reveal.
    lookAt: [[-6, 6, -232], [0, 8, -240], [1, 10, -241], [6, 11, -238],
             [11, 9, -235]],
    // Keypoint 4: the high framing that takes in both buildings.
    hold: { on: 4, width: 0.36, slow: 0.26 },
    props: [
      { modelId: 'chinese_pagoda', position: [0, 0, -240], hero: true, label: 'pagoda' },
      { modelId: 'fantasy_style_tree', position: [21, 0, -229], rotationY: 0.6, label: 'ginkgo' },
      // Close to the orbit so they sweep past the lens — at 20 m out they read
      // as scenery, at ~5 m clearance they read as parallax.
      { modelId: 'broken_medieval_column_set', position: [-19, 0, -215], rotationY: -0.35, label: 'columns' },
      { modelId: 'broken_medieval_column_set', position: [-33, 0, -252], rotationY: 1.1, label: 'columns' },
      { modelId: 'module_2_-_chinese_lantern', position: [6, 2.6, -224], label: 'lantern' },
      { modelId: 'stylized_rock', position: [13, 0, -248], label: 'rock' },
      { modelId: 'stylized_rock', position: [-24, 0, -205], rotationY: 2.1, label: 'rock' },
    ],
  },
  {
    index: 4,
    id: 'the-staff',
    numeral: '四',
    title: '金箍棒',
    subtitle: 'The Legendary Staff',
    scrollVh: 234,   // 18%
    // Drops to 0.65 m off the floor and looks up: a 1.8 m prop only reads as
    // monumental from below. Keypoint 4 is the sharp push-in after the hold,
    // keypoint 5 the exit — without an exit the spline swings wide toward
    // chapter 5's first keypoint 70 m away and clips the ground props.
    camera: [[0, 3.6, -340], [2.3, 1.5, -350], [1.8, 0.78, -354],
             [1.1, 0.66, -356.4], [0.48, 0.95, -358.9], [3.5, 4.5, -374]],
    // Aimed at the upper shaft throughout, so the frame is looking up at it.
    lookAt: [[0, 1.2, -358], [0, 1.5, -359.5], [0, 1.7, -360], [0, 1.75, -360],
             [0, 1.55, -360], [0, 2.5, -384]],
    // Narrow and very slow, landing on keypoint 4 (the low hold). What follows
    // is the point: the remaining third of the scroll has to cover the push-in
    // AND the exit, so the camera leaves fast. The speed profile only slows —
    // every "sudden" move on the site is a release out of a hold.
    hold: { on: 3, width: 0.34, slow: 0.11 },
    props: [
      // Thin 1.8 m cylinder: exactly where <JinguBang /> will stand.
      { shape: 'cylinder', size: [0.05, 1.8, 0.05], position: [0, 0, -360], hero: true,
        label: 'JinguBang' },
      { modelId: 'stylized_rock', position: [-5.0, 0, -354], label: 'rock' },
      { modelId: 'stylized_rock', position: [7.5, 0, -366], rotationY: 1.6, label: 'rock' },
      { modelId: 'broken_medieval_column_set', position: [-6, 0, -366], rotationY: 0.4, label: 'columns' },
    ],
  },
  {
    index: 5,
    id: 'the-guardian',
    numeral: '五',
    title: '守护者',
    subtitle: 'The Guardian Awakens',
    scrollVh: 234,   // 18%
    // Two halves. The first three keypoints stay low (about 2 m) and barely
    // move — the tension. Keypoints 4 and 5 are 24 m higher and 40 m back:
    // the whole reveal happens in the last third of the scroll, which is what
    // makes it the most violent move on the site.
    // The search runs ~13 m off the dragon's flank. Closer than that and a
    // 40 m body at 2 m eye height is a wall across the whole frame, which
    // gives the reveal away — nothing can "appear" if it was already filling
    // the shot.
    camera: [[22, 2.1, -436], [19, 2.0, -450], [16, 2.4, -462],
             [0, 26, -492], [-12, 36, -518]],
    // Searching: left, right, left again while low, then tilts up as the
    // camera is yanked backwards.
    lookAt: [[-6, 2.0, -452], [14, 1.8, -464], [-2, 2.2, -470],
             [0, 7, -478], [0, 4, -482]],
    // Keypoint 2: the end of the search, immediately before the pull-back.
    hold: { on: 2, width: 0.38, slow: 0.15 },
    props: [
      // 40 m along Z — the longest object in the world.
      { modelId: 'chinese_dragon', position: [0, 0, -470], hero: true, label: 'dragon' },
      { modelId: 'stylized_rock', position: [13.5, 0, -450], label: 'rock' },
      { modelId: 'stylized_rock', position: [-10, 0, -488], rotationY: 0.9, label: 'rock' },
      { modelId: 'broken_medieval_column_set', position: [14, 0, -478], rotationY: -0.8, label: 'columns' },
    ],
  },
  {
    index: 6,
    id: 'the-summit',
    numeral: '六',
    title: '塔顶',
    subtitle: 'The Summit',
    scrollVh: 195,   // 15%
    // A single unbroken rise, with the keypoints bunching toward the end so
    // the climb decelerates into stillness rather than stopping dead.
    camera: [[0, 19, -598], [0, 30, -626], [0, 42, -652], [0, 51, -670],
             [0, 56, -682]],
    lookAt: [[0, 18, -700], [0, 26, -762], [0, 36, -832], [0, 44, -882],
             [0, 47, -902]],
    // Late and very slow. This is the only hold placed at the chapter's end:
    // everywhere else the hold releases, here it is the ending, so the last
    // stretch of scroll buys almost no movement and the final frame sits still.
    hold: { on: 3, width: 0.34, slow: 0.1 },
    props: [
      // The 80 m scan, far back — only ever a fogged silhouette.
      // 82 x 80 x 102 m. Pushed far back: at 60 m it fills the frame and reads
      // as a wall, not a mountain temple.
      { modelId: 'jinshan_temple_cishou_pagoda_far', position: [0, 0, -900], hero: true,
        label: 'jinshan (far)' },
      { modelId: 'chinese_pagoda', position: [22, 0, -700], rotationY: -0.4, label: 'pagoda' },
      { modelId: 'module_2_-_chinese_lantern', position: [-6, 2.2, -636], label: 'lantern' },
      { modelId: 'module_2_-_chinese_lantern', position: [6, 2.2, -636], label: 'lantern' },
      { modelId: 'stylized_rock', position: [-16, 0, -618], label: 'rock' },
      { modelId: 'stylized_rock', position: [17, 0, -606], rotationY: 2.4, label: 'rock' },
    ],
  },
];


/**
 * How many segments a chapter's scroll covers. Every chapter but the last runs
 * through to the FIRST keypoint of the next one, so the transition between
 * chapters belongs to the outgoing chapter and the path has no gaps. That extra
 * segment is why a chapter's own last keypoint sits at (n-1)/n of its range,
 * not at 1.0.
 */
export function chapterSegments(i: number): number {
  const n = CHAPTERS[i].camera.length;
  return i === CHAPTERS.length - 1 ? n - 1 : n;
}

/**
 * Solve for the scroll position whose eased value lands on keypoint `hold.on`.
 *
 * The easing depends on where the hold is, and where the hold is depends on the
 * easing, so this is a fixed point. It converges in a handful of iterations
 * because the mapping is monotonic and close to the identity.
 */
export function resolveHoldAt(i: number): number {
  const c = CHAPTERS[i];
  const target = c.hold.on / chapterSegments(i);
  let at = target;
  for (let k = 0; k < 40; k++) {
    const v = easedAt(at, at, c.hold.width, c.hold.slow);
    const err = v - target;
    if (Math.abs(err) < 1e-4) break;
    at = Math.min(0.999, Math.max(0.001, at - err * 0.9));
  }
  return at;
}

/** The eased value at scroll position `u`, for a hold centred at `at`. */
function easedAt(u: number, at: number, width: number, slow: number): number {
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const speed = (x: number) => {
    const half = width / 2;
    const ramp = Math.max(1e-3, half * 0.6);
    const rise = smooth(at - half - ramp, at - half, x);
    const fall = 1 - smooth(at + half, at + half + ramp, x);
    return 1 - (1 - slow) * Math.min(rise, fall);
  };
  const N = 257;
  let acc = 0;
  const cum = [0];
  for (let k = 1; k < N; k++) {
    const a = (k - 1) / (N - 1), b = k / (N - 1);
    acc += ((speed(a) + speed(b)) / 2) * (b - a);
    cum.push(acc);
  }
  const idx = Math.min(N - 1, Math.max(0, Math.round(u * (N - 1))));
  return cum[idx] / (acc || 1);
}

export const TOTAL_SCROLL_VH = CHAPTERS.reduce((s, c) => s + c.scrollVh, 0);

/** Normalised [start, end] scroll range of each chapter, in 0–1 page progress. */
export const CHAPTER_RANGES: { start: number; end: number }[] = (() => {
  let acc = 0;
  return CHAPTERS.map((c) => {
    const start = acc / TOTAL_SCROLL_VH;
    acc += c.scrollVh;
    return { start, end: acc / TOTAL_SCROLL_VH };
  });
})();

/** Which chapter a global progress value falls in (0-based index). */
export function chapterAt(progress: number): number {
  for (let i = CHAPTER_RANGES.length - 1; i >= 0; i--) {
    if (progress >= CHAPTER_RANGES[i].start) return i;
  }
  return 0;
}

/** Global progress at a chapter's start / hold centre / end. Used by tests. */
export function chapterMarks(i: number) {
  const { start, end } = CHAPTER_RANGES[i];
  return {
    start,
    hold: start + (end - start) * resolveHoldAt(i),
    end: end - 1e-4,
  };
}

/** Reports where each hold resolves to, for the debug panel and checks. */
export function holdKeypoint(i: number): { at: number; keypoint: number } {
  return { at: resolveHoldAt(i), keypoint: CHAPTERS[i].hold.on };
}
