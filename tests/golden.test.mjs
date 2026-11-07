// Golden regression test: simple polygons (no holes, single part, no overlap) must give
// exactly the same layouts as the unchanged master (859849b). Set CSM_INDEX_HTML to test another file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadEngine } from '../bench/lib/extract.mjs';
import { goldenCases } from '../bench/make-golden.mjs';

const INDEX = process.env.CSM_INDEX_HTML || 'index.html';
const baseline = JSON.parse(fs.readFileSync('bench/baseline/golden-859849b.json', 'utf8'));

test('golden: simple polygons give identical layouts to 859849b', () => {
  const current = goldenCases(loadEngine(INDEX));
  const keys = Object.keys(baseline.cases);
  assert.equal(Object.keys(current).length, keys.length, 'same number of cases');
  const diffs = keys.filter(k => current[k].spaces !== baseline.cases[k].spaces || current[k].hash !== baseline.cases[k].hash);
  assert.deepEqual(diffs.map(k => `${k}: ${baseline.cases[k].spaces} -> ${current[k].spaces}`), [],
    `${diffs.length} of ${keys.length} cases differ from baseline`);
});
