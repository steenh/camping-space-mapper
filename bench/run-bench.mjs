// Benchmark of the app as it is: the current optimize() search (18 angles × 3×3 offsets,
// one setting per zone here) on the synthetic fixtures, plus the defect probes.
// Writes bench/results/latest.json (deterministic), latest-timings.json and latest.md.
// Usage: npm run bench [-- <path-to-index.html>]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { loadEngine, turf } from './lib/extract.mjs';
import {
  SIMPLE_SHAPES, PRODUCTS, polygonFeature, layerOf, HOLE_ZONE, HOLE_RING, MULTI_ZONE, OVERLAP_ZONES,
} from './lib/fixtures.mjs';
import { countSpaces, spacesOf, maxIntersection } from './lib/measure.mjs';

const require = createRequire(import.meta.url);
const { Geodesic } = require('geographiclib-geodesic');

const INDEX = process.argv[2] || 'index.html';
const engine = loadEngine(INDEX);
const TOL_M2 = 1e-4;

// Same search as optimize() in index.html.
function currentSearch(fn, layer, product, extra) {
  let best = { spaces: -1 }, runs = 0;
  const t0 = performance.now();
  for (let a = 0; a < 90; a += 5) for (const ox of [0, 17, 34]) for (const oy of [0, 8, 16]) {
    const n = countSpaces(fn(layer, a, ox, oy, product, extra)); runs++;
    if (n > best.spaces) best = { spaces: n, angle: a, offX: ox, offY: oy };
  }
  return { ...best, runs, ms: performance.now() - t0 };
}

const geodesicArea = feature => {
  const p = Geodesic.WGS84.Polygon(false);
  feature.geometry.coordinates[0].slice(0, -1).forEach(([lng, lat]) => p.AddPoint(lat, lng));
  return Math.abs(p.Compute(false, true).area);
};
const latticeM2PerSpace = p => {
  const g = p.spaceGap || 0;
  return ((p.maxCols * (p.spaceW + g) - g + p.pathW) * (p.maxRows * (p.spaceH + g) - g + p.pathW)) / (p.maxCols * p.maxRows);
};

const results = { source: INDEX, search: '18 angles (0–85°, step 5) × offsets X[0,17,34] × Y[0,8,16]', fixtures: [], probes: {} };
const timings = { node: process.version, fixtures: [] };

for (const [shape, rings] of Object.entries(SIMPLE_SHAPES)) {
  const feature = polygonFeature(rings);
  const areaM2 = geodesicArea(feature);
  for (const [pname, product] of Object.entries(PRODUCTS)) {
    const row = { shape, product: pname, area_m2_geodesic: Math.round(areaM2),
                  lattice_reference: Math.round(areaM2 / latticeM2PerSpace(product)) };
    const t = { shape, product: pname };
    for (const [alg, fn] of [['greedy', engine.runPlacement], ['straight', engine.runPlacementStraight]]) {
      const r = currentSearch(fn, layerOf(feature), product);
      row[alg] = { spaces: r.spaces, angle: r.angle, offX: r.offX, offY: r.offY, runs: r.runs,
                   pct_of_lattice: +(100 * r.spaces / row.lattice_reference).toFixed(1) };
      t[`${alg}_ms`] = Math.round(r.ms);
    }
    results.fixtures.push(row);
    timings.fixtures.push(t);
  }
}

// Defect probes (all expected to be fixed from fase 0 on).
{
  const P = PRODUCTS.GAP_5x10;
  const hole = polygonFeature([HOLE_RING]);
  const rh = engine.runPlacement(layerOf(HOLE_ZONE()), 0, 0, 0, P);
  results.probes.hole = { spaces: countSpaces(rh), spaces_intersecting_hole: maxIntersection(spacesOf(engine, rh, P), [hole], TOL_M2).countAboveTol };

  const rm = engine.runPlacement(layerOf(MULTI_ZONE()), 0, 0, 0, P);
  results.probes.multipolygon = { spaces: countSpaces(rm), terminates: true };

  const zones = OVERLAP_ZONES();
  const sp = zones.map((z, i) => spacesOf(engine, engine.runPlacement(layerOf(z), 0, 0, 0, P,
    engine.zoneOverlapExclusions ? engine.zoneOverlapExclusions(zones, i) : undefined), P));
  const ov = maxIntersection(sp[0], sp[1], TOL_M2);
  results.probes.overlap = {
    spaces: [sp[0].length, sp[1].length], overlapping_pairs: ov.countAboveTol, max_overlap_m2: ov.maxM2,
    sum_area_m2: Math.round(zones.reduce((s, z) => s + turf.area(z), 0)),
    shown_area_m2: engine.unionAreaM2 ? Math.round(engine.unionAreaM2(zones)) : null,
  };
}

fs.mkdirSync('bench/results', { recursive: true });
fs.writeFileSync('bench/results/latest.json', JSON.stringify(results, null, 1) + '\n');
fs.writeFileSync('bench/results/latest-timings.json', JSON.stringify(timings, null, 1) + '\n');

const md = [
  `# Benchmark — nuværende app (${INDEX})`, '',
  `Søgning: ${results.search}. Gitterreference = areal / analytisk gittertæthed (ikke en øvre grænse).`, '',
  '| Zone | Produkt | Areal (m²) | Gitter-ref. | Greedy | % | Straight | % |', '|---|---|---:|---:|---:|---:|---:|---:|',
  ...results.fixtures.map(r => `| ${r.shape} | ${r.product} | ${r.area_m2_geodesic} | ${r.lattice_reference} | ${r.greedy.spaces} @${r.greedy.angle}° | ${r.greedy.pct_of_lattice} | ${r.straight.spaces} @${r.straight.angle}° | ${r.straight.pct_of_lattice} |`),
  '', '## Fejlprober', '', '```json', JSON.stringify(results.probes, null, 1), '```', '',
  `Tider (ikke deterministiske, ${timings.node}): se \`latest-timings.json\`.`, '',
];
fs.writeFileSync('bench/results/latest.md', md.join('\n'));
console.log(md.join('\n'));
