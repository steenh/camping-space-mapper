// Fase 0B: the per-zone search must never find fewer spaces than the old Optimize grid for the
// same zone and inputs, must be deterministic, and must produce valid layouts.
// Full comparison (capacity, validity, time) incl. a multi-zone site: node bench/compare-0b.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from '../bench/lib/extract.mjs';
import { SIMPLE_SHAPES, PRODUCTS, polygonFeature, layerOf } from '../bench/lib/fixtures.mjs';
import { countSpaces } from '../bench/lib/measure.mjs';
import { validateLayouts } from '../bench/lib/validate.mjs';

const engine = loadEngine(process.env.CSM_INDEX_HTML || 'index.html');
const P = PRODUCTS.GAP_5x10;

const oldBest = (layer, fn) => {
  let best = -1;
  for (let a = 0; a < 90; a += 5) for (const ox of [0, 17, 34]) for (const oy of [0, 8, 16]) best = Math.max(best, countSpaces(fn(layer, a, ox, oy, P)));
  return best;
};

test('candidate angles cover 0–175° and include edge directions', () => {
  const layer = layerOf(polygonFeature(SIMPLE_SHAPES.A_rect_300x200));
  const angles = engine.candidateAngles(layer.toGeoJSON());
  for (let a = 0; a < 180; a += 5) assert.ok(angles.includes(a), `missing ${a}°`);
  // A UTM-aligned rectangle is ~2.5° off true north in the app's frame: its edges must be candidates.
  assert.ok(angles.some(a => Math.abs(a - 177.45) < 0.1) && angles.some(a => Math.abs(a - 87.45) < 0.1), angles.join(','));
});

test('never fewer spaces than the old Optimize grid (greedy, all fixtures; straight, strip)', t => {
  const cases = Object.entries(SIMPLE_SHAPES).map(([s, r]) => [s, r, 'greedy', engine.runPlacement]);
  cases.push(['E_strip_62x400', SIMPLE_SHAPES.E_strip_62x400, 'straight', engine.runPlacementStraight]);
  for (const [shape, rings, alg, fn] of cases) {
    const layer = layerOf(polygonFeature(rings));
    const before = oldBest(layer, fn);
    const after = engine.optimizeZone(layer, P, undefined, fn);
    t.diagnostic(`${shape} ${alg}: ${before} -> ${after.spaces} (${after.runs} runs)`);
    assert.ok(after.spaces >= before, `${shape} ${alg}: ${after.spaces} < ${before}`);
  }
});

test('deterministic and valid', () => {
  const zone = polygonFeature(SIMPLE_SHAPES.C_L_shape);
  const a = engine.optimizeZone(layerOf(zone), PRODUCTS.SYN_6x8, undefined, engine.runPlacement);
  const b = engine.optimizeZone(layerOf(zone), PRODUCTS.SYN_6x8, undefined, engine.runPlacement);
  assert.deepEqual(a, b);
  const r = engine.runPlacement(layerOf(zone), a.angleDeg, a.offX, a.offY, PRODUCTS.SYN_6x8);
  assert.equal(countSpaces(r), a.spaces);
  const v = validateLayouts(engine, [zone], [{ result: r, product: PRODUCTS.SYN_6x8 }]);
  assert.ok(v.valid, JSON.stringify(v));
});

test('invalid product or empty zone: no search, no spaces', () => {
  const zone = layerOf(polygonFeature(SIMPLE_SHAPES.A_rect_300x200));
  assert.deepEqual(engine.optimizeZone(zone, { ...P, spaceW: -1 }, undefined, engine.runPlacement).runs, 0);
  const empty = { toGeoJSON: () => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [] } }) };
  assert.equal(engine.optimizeZone(empty, P, undefined, engine.runPlacement).spaces, 0);
});
