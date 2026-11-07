// Reproduces the search-strategy comparison from DISCOVERY-OPTIMIZATION §4 with the app's own
// placement code. Slow (several minutes). Writes bench/results/discovery-compare.json.
// Strategies: current (18×3×3), old (90×5×5, before 859849b), wide (0–180° step 2 × product-period
// offsets) + local refinement, and edge-seeded angles (zone edge directions and perpendiculars).
// Usage: npm run bench:discovery [-- <path-to-index.html>]
import fs from 'node:fs';
import { loadEngine } from './lib/extract.mjs';
import { SIMPLE_SHAPES, PRODUCTS, polygonFeature, layerOf } from './lib/fixtures.mjs';
import { countSpaces } from './lib/measure.mjs';

const engine = loadEngine(process.argv[2] || 'index.html');
const range = (a, b, s) => { const r = []; for (let v = a; v < b - 1e-9; v += s) r.push(+v.toFixed(3)); return r; };
const period = p => {
  const g = p.spaceGap || 0;
  return [p.maxCols * (p.spaceW + g) - g + p.pathW, p.maxRows * (p.spaceH + g) - g + p.pathW];
};

function sweep(fn, layer, product, angles, xs, ys) {
  let best = { n: -1 }, runs = 0;
  const t0 = performance.now();
  for (const a of angles) for (const ox of xs) for (const oy of ys) {
    const n = countSpaces(fn(layer, a, ox, oy, product)); runs++;
    if (n > best.n) best = { n, a, ox, oy };
  }
  return { ...best, runs, ms: Math.round(performance.now() - t0) };
}

function edgeAngles(feature) {
  const g = feature.geometry.coordinates[0];
  const f = engine.getFactors(g[0][1]);
  const set = new Set();
  for (let i = 0; i < g.length - 1; i++) {
    const dx = (g[i + 1][0] - g[i][0]) * f.mPerLng, dy = (g[i + 1][1] - g[i][1]) * f.mPerLat;
    const a = ((Math.atan2(dy, dx) * 180 / Math.PI) % 180 + 180) % 180;
    for (const d of [0, 90]) set.add(+(((a + d) % 180)).toFixed(2));
  }
  return [...set];
}

const out = [];
for (const [pname, P] of Object.entries(PRODUCTS)) for (const [sname, rings] of Object.entries(SIMPLE_SHAPES)) {
  const feature = polygonFeature(rings), layer = layerOf(feature);
  const [px, py] = period(P);
  const row = { product: pname, shape: sname };
  for (const [alg, fn] of [['greedy', engine.runPlacement], ['straight', engine.runPlacementStraight]]) {
    const cur = sweep(fn, layer, P, range(0, 90, 5), [0, 17, 34], [0, 8, 16]);
    const old = sweep(fn, layer, P, range(0, 90, 1), [0, 11, 22, 33, 44], [0, 5, 10, 15, 20]);
    const wide = sweep(fn, layer, P, range(0, 180, 2), range(0, px, px / 6), range(0, py, py / 5));
    const ref = sweep(fn, layer, P, range(wide.a - 2, wide.a + 2.01, 0.5), range(0, px, px / 12), range(0, py, py / 10));
    const edge = sweep(fn, layer, P, edgeAngles(feature), range(0, px, px / 12), range(0, py, py / 10));
    row[alg] = { current: cur, old, wide, wide_refine: ref.n > wide.n ? ref : wide, edge_seeded: edge };
  }
  out.push(row);
  console.error(`${pname} ${sname}: greedy ${row.greedy.current.n} -> best ${Math.max(row.greedy.wide_refine.n, row.greedy.edge_seeded.n)}, straight ${row.straight.current.n} -> best ${Math.max(row.straight.wide_refine.n, row.straight.edge_seeded.n)}`);
}
fs.writeFileSync('bench/results/discovery-compare.json', JSON.stringify(out, null, 1) + '\n');
console.error('written bench/results/discovery-compare.json');
