// Generates the golden baseline for simple polygons from a given index.html.
// Usage: node bench/make-golden.mjs <path-to-index.html> <output.json> <label>
// The committed baseline was generated from the unchanged master (859849b):
//   git show 859849b:index.html > /tmp/index-859849b.html
//   node bench/make-golden.mjs /tmp/index-859849b.html bench/baseline/golden-859849b.json 859849b
import fs from 'node:fs';
import { loadEngine } from './lib/extract.mjs';
import { SIMPLE_SHAPES, PRODUCTS, GOLDEN_PARAMS, polygonFeature, layerOf, ROAD_EXCLUSION } from './lib/fixtures.mjs';
import { countSpaces, layoutHash } from './lib/measure.mjs';

export function goldenCases(engine) {
  const out = {};
  const road = ROAD_EXCLUSION();
  for (const exclusionSet of ['none', 'road']) {
    engine.setExclusions(exclusionSet === 'road' ? [layerOf(road)] : []);
    for (const [shape, rings] of Object.entries(SIMPLE_SHAPES)) {
      const layer = layerOf(polygonFeature(rings));
      for (const [pname, product] of Object.entries(PRODUCTS)) {
        for (const [alg, fn] of [['greedy', engine.runPlacement], ['straight', engine.runPlacementStraight]]) {
          for (const [a, ox, oy] of GOLDEN_PARAMS) {
            const r = fn(layer, a, ox, oy, product);
            out[`${exclusionSet}|${shape}|${pname}|${alg}|${a},${ox},${oy}`] = { spaces: countSpaces(r), hash: layoutHash(r) };
          }
        }
      }
    }
  }
  engine.setExclusions([]);
  return out;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('make-golden.mjs')) {
  const [src, outPath, label] = process.argv.slice(2);
  if (!src || !outPath) { console.error('usage: make-golden.mjs <index.html> <out.json> <label>'); process.exit(2); }
  const cases = goldenCases(loadEngine(src));
  fs.writeFileSync(outPath, JSON.stringify({ source: label || src, cases }, null, 1) + '\n');
  console.log(`${Object.keys(cases).length} golden cases written to ${outPath}`);
}
