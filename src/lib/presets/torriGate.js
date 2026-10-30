/**
 * Weathered-timber dressing for torri_gate.glb.
 *
 * The GLB ships in tourist colours — bright orange-red columns, clean grey
 * tiles, bright brass bells. This recolours it in code against the ten material
 * names the file carries, so the asset itself is never edited.
 *
 * Material name -> what it actually colours, read off the GLB:
 *   u_leg      #e61000  the columns              -> timber + oxblood
 *   legs       #420000  flared column feet       -> timber + oxblood (darker)
 *   material   #b62423  beams and lintel         -> timber + oxblood
 *   name_board #be2f2e  the name board           -> timber + oxblood
 *   decor      #6e0d00  dougong bracket sets     -> aged gold  (see note)
 *   thread     #562c1c  cord                     -> bare dark timber, no paint
 *   roof       #191919  the tiles (50,939 tris)  -> dark grey-green glaze + grime
 *   pipe       #5c616b  pale eave edging         -> weathered stone
 *   base       #5e5e5e  stone footings           -> weathered stone
 *   bell       #e6c100  eave bells               -> aged gold
 *
 * NOTE on `decor`: it is the bracket woodwork, the second-largest material at
 * 9,622 triangles — gilding it is a lot of gold. Historically plausible for
 * imperial work, but if it reads as too much, move it to TIMBER below.
 */
import {
  createWornPaintMaterial, createGlazedTileMaterial,
  createAgedGoldMaterial, createWeatheredStoneMaterial,
  applyMaterialOverrides,
} from '../materials/weathered.js';

export const GATE_PALETTE = {
  oxblood: '#6e2a24',   // faded, not fresh
  timber:  '#3a2e26',   // dark aged wood showing through
  glaze:   '#2f3a33',   // dark grey-green roof glaze
  grime:   '#15191a',
  gold:    '#C9A24A',
  tarnish: '#4a3a1c',
  stone:   '#4a4845',
};

/** Build the override map. Separate from apply() so it can be tuned/inspected. */
export function createGateMaterials(p = GATE_PALETTE) {
  const timberPaint = (wear, paint = p.oxblood, name = 'gateTimber') =>
    createWornPaintMaterial({
      paint, timber: p.timber, wear, noiseScale: 1.1,
      roughness: 0.72, wornRoughness: 0.88, upBias: 0.3, edgeBias: 0.5, name,
    });

  const gold = (tarnishAmount, name) =>
    createAgedGoldMaterial({
      gold: p.gold, tarnish: p.tarnish, tarnishAmount, roughness: 0.34, name,
    });

  return {
    // Columns take the most weather; beams and board slightly less.
    u_leg:      timberPaint(0.50, p.oxblood, 'gate_columns'),
    legs:       timberPaint(0.58, '#5a241f', 'gate_column_feet'),
    material:   timberPaint(0.44, p.oxblood, 'gate_beams'),
    name_board: timberPaint(0.38, p.oxblood, 'gate_name_board'),
    thread:     createWornPaintMaterial({
      paint: p.timber, timber: '#2a211b', wear: 0.5,
      noiseScale: 2.4, roughness: 0.9, name: 'gate_cord',
    }),

    decor: gold(0.42, 'gate_brackets'),
    bell:  gold(0.3, 'gate_bells'),

    roof: createGlazedTileMaterial({
      glaze: p.glaze, grime: p.grime, grimeAmount: 0.5,
      roughness: 0.4, noiseScale: 1.4, name: 'gate_roof',
    }),
    pipe: createWeatheredStoneMaterial({
      stone: '#55575a', bleach: '#6e7073', amount: 0.42, name: 'gate_eave_trim',
    }),
    base: createWeatheredStoneMaterial({
      stone: p.stone, bleach: '#6a6660', amount: 0.45, name: 'gate_footings',
    }),
  };
}

/**
 * Apply the dressing to a loaded torri_gate scene.
 * Throws if the GLB's material names no longer match — better a loud failure
 * than a gate that silently ships in tourist red.
 */
export function applyGateMaterials(target, palette = GATE_PALETTE) {
  const overrides = createGateMaterials(palette);
  const result = applyMaterialOverrides(target, overrides);
  if (result.missing.length) {
    throw new Error(
      `torri_gate material names changed; no match for: ${result.missing.join(', ')}. ` +
      `Found: ${result.found.join(', ')}`);
  }
  return result;
}
