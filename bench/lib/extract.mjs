// Extracts the pure geometry/placement code from index.html and evaluates it in Node,
// so benchmarks and tests run the app's own code instead of a copy.
//
// Region: from "// ── Coordinate helpers" to "// @bench-extract-end" (falls back to
// "function onToggleStraight" for versions before the marker existed, e.g. 859849b).
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const turf = require('@turf/turf');

const START = '// ── Coordinate helpers';
const END_MARKER = '// @bench-extract-end';
const END_FALLBACK = 'function onToggleStraight';

const EXPORTS = [
  'runPlacement', 'runPlacementStraight', 'getFactors', 'toGeo', 'toLocal',
  'spaceCorners', 'blockCorners', 'polygonsOverlap',
  // Added in fase 0 (absent in older versions):
  'zoneParts', 'zoneOverlapExclusions', 'unionAreaM2', 'isValidProduct', 'overlapUnusedM2',
  // Added in fase 0B:
  'candidateAngles', 'edgeAngles', 'optimizeZone',
];

export function extractRegion(html) {
  const start = html.indexOf(START);
  let end = html.indexOf(END_MARKER);
  if (end < 0) end = html.indexOf(END_FALLBACK);
  if (start < 0 || end < 0 || end <= start) throw new Error('extract markers not found in index.html');
  return html.slice(start, end);
}

// Loads the engine from an index.html path. Exclusions are injected per call via setExclusions().
export function loadEngine(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const code = extractRegion(html);
  let exclusions = [];
  const exportList = EXPORTS.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(',\n');
  const factory = new Function('turf', '__getExcl', `
    const __g = { get drawnExclusions() { return __getExcl(); } };
    ${code.replace(/\bdrawnExclusions\b/g, '__g.drawnExclusions')}
    return { ${exportList} };
  `);
  const engine = factory(turf, () => exclusions);
  engine.setExclusions = layers => { exclusions = layers; };
  engine.source = htmlPath;
  return engine;
}
