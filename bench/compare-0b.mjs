// Fase 0B benchmark: the old Optimize (one shared setting, 18 angles 0–85° × 3×3 offsets) against
// the new per-zone search (optimizeZone) with identical inputs: same zones, products, exclusions,
// overlap rules and placement code. Measures capacity, validity (independent validator) and time.
// Writes bench/results/fase0b-compare.json (deterministic) and .md (incl. timings).
// Usage: node bench/compare-0b.mjs [index.html]
import fs from 'node:fs';
import { loadEngine } from './lib/extract.mjs';
import {
  SIMPLE_SHAPES, PRODUCTS, polygonFeature, multiPolygonFeature, layerOf, rect, rot, ROAD_EXCLUSION,
} from './lib/fixtures.mjs';
import { countSpaces } from './lib/measure.mjs';
import { validateLayouts } from './lib/validate.mjs';

const engine = loadEngine(process.argv[2] || 'index.html');
if (typeof engine.optimizeZone !== 'function') throw new Error('optimizeZone() not found in index.html');

// Old Optimize, as in fase 0 / master: one setting for all zones, maximising the sum.
function oldOptimize(zones, products, overlaps, fn) {
  let best = { spaces: -1 }, runs = 0;
  for (let a = 0; a < 90; a += 5) for (const ox of [0, 17, 34]) for (const oy of [0, 8, 16]) {
    let n = 0;
    zones.forEach((z, i) => { n += countSpaces(fn(layerOf(z), a, ox, oy, products[i], overlaps[i])); runs++; });
    if (n > best.spaces) best = { spaces: n, angleDeg: a, offX: ox, offY: oy };
  }
  const settings = zones.map(() => ({ angleDeg: best.angleDeg, offX: best.offX, offY: best.offY }));
  return { settings, runs };
}

function newOptimize(zones, products, overlaps, fn) {
  let runs = 0;
  const settings = zones.map((z, i) => {
    const r = engine.optimizeZone(layerOf(z), products[i], overlaps[i], fn);
    runs += r.runs;
    return { angleDeg: r.angleDeg, offX: r.offX, offY: r.offY };
  });
  return { settings, runs };
}

function evaluate(name, zones, products, exclusions, fn, optimizer) {
  engine.setExclusions(exclusions.map(layerOf));
  const overlaps = zones.map((_, i) => engine.zoneOverlapExclusions(zones, i));
  const t0 = performance.now();
  const { settings, runs } = optimizer(zones, products, overlaps, fn);
  const ms = performance.now() - t0;
  const results = zones.map((z, i) => fn(layerOf(z), settings[i].angleDeg, settings[i].offX, settings[i].offY, products[i], overlaps[i]));
  const validity = validateLayouts(engine, zones, results.map((result, i) => ({ result, product: products[i] })), exclusions);
  engine.setExclusions([]);
  return { name, spaces: results.reduce((s, r) => s + countSpaces(r), 0), perZone: results.map(countSpaces),
           settings, runs, ms: Math.round(ms), validity };
}

// Cases: every single-zone fixture, plus a mixed multi-zone site.
const cases = [];
for (const [shape, rings] of Object.entries(SIMPLE_SHAPES)) for (const [pname, P] of Object.entries(PRODUCTS))
  cases.push({ id: `${shape}|${pname}`, zones: [polygonFeature(rings)], products: [P], exclusions: [] });

const site = [
  polygonFeature([rect(250, 150, -650, 0)]),                                        // grid-aligned
  polygonFeature([rot(rect(250, 150, -300, 0), 30)]),                               // rotated 30°
  polygonFeature([rot(rect(200, 120, 300, 250), 62)]),                              // rotated 62°
  polygonFeature([rect(200, 200, -650, -320)]),                                     // overlaps the next one by 50 m
  polygonFeature([rect(200, 200, -500, -320)]),
  polygonFeature([rect(300, 200, 0, -350), rect(80, 60, 110, -280).reverse()]),     // with a hole
  multiPolygonFeature([[rect(100, 100, 400, -350)], [rect(100, 100, 550, -350)]]),  // two parts
];
const siteExcl = [polygonFeature([rect(300, 12, 0, -256)])];                        // road across the holed zone
for (const [pname, P] of Object.entries(PRODUCTS))
  cases.push({ id: `SITE_MIX(7 zones)|${pname}`, zones: site, products: site.map(() => P), exclusions: siteExcl });

const rows = [];
for (const c of cases) for (const [alg, fn] of [['greedy', engine.runPlacement], ['straight', engine.runPlacementStraight]]) {
  const before = evaluate('old', c.zones, c.products, c.exclusions, fn, oldOptimize);
  const after = evaluate('new', c.zones, c.products, c.exclusions, fn, newOptimize);
  rows.push({ case: c.id, alg, before, after,
              gainPct: +(100 * (after.spaces - before.spaces) / Math.max(1, before.spaces)).toFixed(1) });
  console.error(`${c.id} ${alg}: ${before.spaces} -> ${after.spaces} (${before.ms} -> ${after.ms} ms) valid ${before.validity.valid}/${after.validity.valid}`);
}

const strip = r => ({ ...r, before: { ...r.before, ms: undefined }, after: { ...r.after, ms: undefined } });
fs.writeFileSync('bench/results/fase0b-compare.json', JSON.stringify(rows.map(strip), null, 1) + '\n');

const gains = rows.map(r => r.gainPct).sort((a, b) => a - b);
const median = gains[Math.floor(gains.length / 2)];
const md = [
  '# Fase 0B — gammel vs. ny Optimize (identiske inputs)', '',
  `Gammel: én fælles indstilling for alle zoner, 0–85° i 5°-trin × X[0,17,34] × Y[0,8,16]. Ny: optimizeZone pr. zone (se index.html).`,
  `Gyldighed: uafhængig validator (bench/lib/validate.mjs), tolerance 1 cm². Node ${process.version}.`, '',
  '| Case | Algoritme | Gammel | Ny | Gevinst | Gammel tid | Ny tid | Kørsler gammel/ny | Gyldig gammel/ny |',
  '|---|---|---:|---:|---:|---:|---:|---:|---|',
  ...rows.map(r => `| ${r.case} | ${r.alg} | ${r.before.spaces} | ${r.after.spaces} | ${r.gainPct >= 0 ? '+' : ''}${r.gainPct} % | ${r.before.ms} ms | ${r.after.ms} ms | ${r.before.runs}/${r.after.runs} | ${r.before.validity.valid ? '✔' : '✖'} / ${r.after.validity.valid ? '✔' : '✖'} |`),
  '',
  `Gevinst: min ${gains[0]} %, median ${median} %, maks ${gains[gains.length - 1]} %. Ny < gammel i ${rows.filter(r => r.after.spaces < r.before.spaces).length} af ${rows.length} tilfælde.`,
  `Gyldighed: ${rows.filter(r => r.after.validity.valid).length}/${rows.length} nye og ${rows.filter(r => r.before.validity.valid).length}/${rows.length} gamle layouts uden overtrædelser.`,
  `Tid (ny): maks ${Math.max(...rows.map(r => r.after.ms))} ms pr. case; maks pr. zone ${Math.max(...rows.filter(r => !r.case.startsWith('SITE')).map(r => r.after.ms))} ms (enkeltzone-fixtures).`, '',
];
fs.writeFileSync('bench/results/fase0b-compare.md', md.join('\n'));
console.log(md.join('\n'));
