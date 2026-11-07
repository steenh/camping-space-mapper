// Probe tests for the critical geometry defects found in discovery (F02–F04) and input guards.
// Tolerances are measured and reported, not assumed: each test logs the largest measured value.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEngine, turf } from '../bench/lib/extract.mjs';
import {
  PRODUCTS, HOLE_ZONE, HOLE_RING, MULTI_ZONE, OVERLAP_ZONES, ROAD_EXCLUSION, polygonFeature, layerOf,
} from '../bench/lib/fixtures.mjs';
import { countSpaces, spacesOf, maxIntersection } from '../bench/lib/measure.mjs';

const INDEX = process.env.CSM_INDEX_HTML || 'index.html';
const TOL_M2 = 1e-4; // 1 cm², the V1/V3 tolerance proposed in discovery
const P = PRODUCTS.GAP_5x10;
const ALGS = ['runPlacement', 'runPlacementStraight'];

// Runs placement in a child process so an infinite loop fails the test instead of hanging the suite.
function runIsolated(body, timeoutMs = 10000) {
  const url = f => pathToFileURL(path.resolve(f)).href;
  const code = `
    import { loadEngine } from ${JSON.stringify(url('bench/lib/extract.mjs'))};
    import * as fx from ${JSON.stringify(url('bench/lib/fixtures.mjs'))};
    import { countSpaces } from ${JSON.stringify(url('bench/lib/measure.mjs'))};
    const engine = loadEngine(${JSON.stringify(path.resolve(INDEX))});
    const out = await (async () => { ${body} })();
    process.stdout.write(JSON.stringify(out));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { timeout: timeoutMs, encoding: 'utf8' });
  if (r.error && r.error.code === 'ETIMEDOUT') return { timedOut: true };
  if (r.status !== 0) return { error: r.stderr.slice(0, 500) };
  return { value: JSON.parse(r.stdout) };
}

test('F03 holes: no space intersects an inner ring', t => {
  const engine = loadEngine(INDEX);
  const zone = HOLE_ZONE();
  const hole = polygonFeature([HOLE_RING]);
  for (const alg of ALGS) for (const angle of [0, 17, 88]) {
    const r = engine[alg](layerOf(zone), angle, 0, 0, P);
    const m = maxIntersection(spacesOf(engine, r, P), [hole], TOL_M2);
    t.diagnostic(`${alg} @${angle}°: ${countSpaces(r)} spaces, max overlap with hole ${m.maxM2.toExponential(2)} m²`);
    assert.equal(m.countAboveTol, 0, `${alg} @${angle}°: ${m.countAboveTol} spaces intersect the hole`);
    assert.ok(countSpaces(r) > 0);
  }
});

test('F02 MultiPolygon: placement terminates and fills both parts, inside the zone', t => {
  const res = runIsolated(`
    const zone = fx.MULTI_ZONE();
    const out = {};
    for (const alg of ['runPlacement', 'runPlacementStraight']) {
      const r = engine[alg](fx.layerOf(zone), 0, 0, 0, fx.PRODUCTS.GAP_5x10);
      out[alg] = { spaces: countSpaces(r), xs: r.blocks.map(b => b.ox) };
    }
    return out;`);
  assert.ok(!res.timedOut, 'placement did not terminate within 10 s (infinite loop)');
  assert.ok(!res.error, res.error);
  const engine = loadEngine(INDEX);
  const zone = MULTI_ZONE();
  for (const alg of ALGS) {
    const r = engine[alg](layerOf(zone), 0, 0, 0, P);
    const spaces = spacesOf(engine, r, P);
    let maxOutside = 0;
    for (const s of spaces) {
      const d = turf.difference(s, zone);
      if (d) maxOutside = Math.max(maxOutside, turf.area(d));
    }
    const west = res.value[alg].xs.filter(x => x < 0).length, east = res.value[alg].xs.filter(x => x > 0).length;
    t.diagnostic(`${alg}: ${countSpaces(r)} spaces (blocks west ${west}, east ${east}), max area outside zone ${maxOutside.toExponential(2)} m²`);
    assert.ok(west > 0 && east > 0, `${alg}: both parts must get blocks`);
    assert.ok(maxOutside <= TOL_M2, `${alg}: a space extends ${maxOutside} m² outside the zone`);
  }
});

test('F04 overlapping zones: no two spaces share ground across zones', t => {
  const engine = loadEngine(INDEX);
  assert.equal(typeof engine.zoneOverlapExclusions, 'function', 'zoneOverlapExclusions() not implemented');
  const zones = OVERLAP_ZONES();
  for (const alg of ALGS) {
    const spaces = zones.map((z, i) => {
      const extra = engine.zoneOverlapExclusions(zones, i);
      return spacesOf(engine, engine[alg](layerOf(z), 0, 0, 0, P, extra), P);
    });
    const m = maxIntersection(spaces[0], spaces[1], TOL_M2);
    t.diagnostic(`${alg}: zone spaces ${spaces[0].length} + ${spaces[1].length}, max cross-zone overlap ${m.maxM2.toExponential(2)} m²`);
    assert.equal(m.countAboveTol, 0, `${alg}: ${m.countAboveTol} overlapping space pairs`);
    assert.ok(spaces[1].length > 0, 'second zone still gets spaces outside the overlap');
  }
});

test('F04 gross area is the union, not the sum', t => {
  const engine = loadEngine(INDEX);
  assert.equal(typeof engine.unionAreaM2, 'function', 'unionAreaM2() not implemented');
  const zones = OVERLAP_ZONES();
  const expected = turf.area(turf.union(zones[0], zones[1]));
  const sum = zones.reduce((s, z) => s + turf.area(z), 0);
  const got = engine.unionAreaM2(zones);
  t.diagnostic(`sum ${sum.toFixed(1)} m², union ${expected.toFixed(1)} m², app ${got.toFixed(1)} m²`);
  assert.ok(Math.abs(got - expected) < 0.01);
  assert.ok(sum - got > 9000, 'overlap of ~10,000 m² must not be counted twice');
});

test('exclusion zones are still respected (regression)', t => {
  const engine = loadEngine(INDEX);
  const road = ROAD_EXCLUSION();
  engine.setExclusions([layerOf(road)]);
  try {
    for (const alg of ALGS) {
      const zone = polygonFeature([[[-150, -100], [150, -100], [150, 100], [-150, 100]]]);
      const r = engine[alg](layerOf(zone), 0, 0, 0, P);
      const m = maxIntersection(spacesOf(engine, r, P), [road], TOL_M2);
      t.diagnostic(`${alg}: ${countSpaces(r)} spaces, max overlap with road ${m.maxM2.toExponential(2)} m²`);
      assert.equal(m.countAboveTol, 0);
    }
  } finally { engine.setExclusions([]); }
});

test('guard: invalid products and degenerate zones return quickly with no blocks', () => {
  const res = runIsolated(`
    const zone = fx.layerOf(fx.polygonFeature([fx.rect(100, 100, -50, -50)]));
    const bad = [
      { ...fx.PRODUCTS.GAP_5x10, spaceW: -5 },
      { ...fx.PRODUCTS.GAP_5x10, spaceH: 0 },
      { ...fx.PRODUCTS.GAP_5x10, pathW: -60 },
      { ...fx.PRODUCTS.GAP_5x10, maxCols: 0 },
      { ...fx.PRODUCTS.GAP_5x10, spaceW: NaN },
      { ...fx.PRODUCTS.GAP_5x10, spaceW: 0.001 },     // tiny step: would freeze the sweep
      { ...fx.PRODUCTS.GAP_5x10, maxCols: 1000000 },  // huge block search
      { ...fx.PRODUCTS.GAP_5x10, maxRows: 2.5 },
    ];
    const out = [];
    for (const p of bad) for (const alg of ['runPlacement', 'runPlacementStraight'])
      out.push(countSpaces(engine[alg](zone, 0, 0, 0, p)));
    const empty = { toGeoJSON: () => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [] } }) };
    out.push(countSpaces(engine.runPlacement(empty, 0, 0, 0, fx.PRODUCTS.GAP_5x10)));
    return { out, valid: engine.isValidProduct ? bad.map(engine.isValidProduct) : null };`);
  assert.ok(!res.timedOut, 'placement hung on invalid input');
  assert.ok(!res.error, res.error);
  assert.ok(res.value.out.every(n => n === 0), `expected 0 spaces for invalid input, got ${res.value.out}`);
  assert.deepEqual(res.value.valid, [false, false, false, false, false, false, false, false]);
});

test('guard: the products used in the app and the fixtures are valid', () => {
  const engine = loadEngine(INDEX);
  for (const p of Object.values(PRODUCTS)) assert.ok(engine.isValidProduct(p), p.name);
  // Edges of the allowed ranges (product dialog: space 0.5–50 m, cols ≤ 20, rows ≤ 10).
  assert.ok(engine.isValidProduct({ spaceW: 0.5, spaceH: 50, maxCols: 20, maxRows: 10, pathW: 0, spaceGap: 0 }));
  assert.ok(!engine.isValidProduct({ spaceW: 0.49, spaceH: 10, maxCols: 10, maxRows: 2, pathW: 5 }));
  assert.ok(!engine.isValidProduct({ spaceW: 5, spaceH: 10, maxCols: 21, maxRows: 2, pathW: 5 }));
});
