// Fase 0B.4: Optimize runs in a Web Worker. These tests run the REAL worker script — built by the
// app's own buildOptimizeWorkerSource() from the pinned Turf file (same SRI hash as the CDN tag)
// and the page's inline script — in a real thread (node:worker_threads, with a minimal `self`
// shim for postMessage/onmessage), and compare its messages with calling optimizeZone directly.
// Messages cross the thread boundary by structured clone, as with a browser Web Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { loadEngine, appScriptText, extractRegion, turf } from '../bench/lib/extract.mjs';
import { SIMPLE_SHAPES, PRODUCTS, polygonFeature, layerOf, OVERLAP_ZONES, MULTI_ZONE, ROAD_EXCLUSION } from '../bench/lib/fixtures.mjs';

const INDEX = process.env.CSM_INDEX_HTML || 'index.html';
const html = fs.readFileSync(INDEX, 'utf8');
const engine = loadEngine(INDEX);
const require = createRequire(import.meta.url);
const turfPath = path.join(path.dirname(require.resolve('@turf/turf/package.json')), 'turf.min.js');
const turfText = fs.readFileSync(turfPath, 'utf8');
// The app's builder, from the unmodified engine region (loadEngine rewrites drawnExclusions).
const buildOptimizeWorkerSource = new Function('turf', `let drawnExclusions = [];
${extractRegion(html)}
return buildOptimizeWorkerSource;`)(turf);

// Browser-worker stand-in: `self` with postMessage/onmessage. The script runs with exports,
// module and define hidden, so Turf's UMD wrapper sets the global `turf` as in a browser worker.
const SHIM = `const { parentPort } = require('node:worker_threads');
const self = { postMessage: m => parentPort.postMessage(m), set onmessage(fn) { parentPort.on('message', data => fn({ data })); } };
`;
function startWorker() {
  const src = buildOptimizeWorkerSource(turfText, appScriptText(html));
  return new Worker(`${SHIM}(function (exports, module, define) {
${src}
})();`, { eval: true });
}

// Posts one job; resolves with every message up to and including 'done' or 'error'.
function runJob(worker, msg) {
  return new Promise((resolve, reject) => {
    const posted = [];
    const onMsg = m => {
      posted.push(m);
      if (m.type === 'done' || m.type === 'error') { worker.off('message', onMsg); worker.off('error', reject); resolve(posted); }
    };
    worker.on('message', onMsg);
    worker.once('error', reject);
    worker.postMessage(msg);
  });
}

// Reference: optimizeZone called directly, as the main-thread fallback does.
function direct(zones, products, exclusions, placerName, targets) {
  engine.setExclusions(exclusions.map(layerOf));
  const placer = placerName === 'straight' ? engine.runPlacementStraight : engine.runPlacement;
  const out = targets.map((i, k) => engine.optimizeZone(layerOf(zones[i]), products[k], engine.zoneOverlapExclusions(zones, i), placer));
  engine.setExclusions([]);
  return out;
}

function message(zones, products, exclusions, placerName, targets) {
  engine.setExclusions([]);
  return {
    type: 'optimize', placer: placerName, exclusions,
    zones: targets.map((i, k) => ({ index: i, feature: zones[i], product: products[k], overlaps: engine.zoneOverlapExclusions(zones, i) })),
  };
}

test('the Turf file used for the worker is the one pinned by the SRI hash in index.html', () => {
  const tag = html.match(/<script src="https:\/\/unpkg\.com\/@turf\/turf@6\.5\.0\/turf\.min\.js"\s+integrity="(sha384-[^"]+)"/);
  assert.ok(tag, 'Turf script tag with integrity');
  const local = `sha384-${crypto.createHash('sha384').update(fs.readFileSync(turfPath)).digest('base64')}`;
  assert.equal(local, tag[1]);
});

test('optimizeZone: the progress hook does not change the result; runs <= planned; reaches the end', () => {
  const cases = [
    [SIMPLE_SHAPES.C_L_shape, PRODUCTS.SYN_6x8, engine.runPlacement],
    [SIMPLE_SHAPES.D_irregular, PRODUCTS.SYN_6x8, engine.runPlacement],          // many edge angles
    [SIMPLE_SHAPES.E_strip_62x400, PRODUCTS.SYN_6x8, engine.runPlacementStraight],
  ];
  for (const [rings, P, fn] of cases) {
    const layer = layerOf(polygonFeature(rings));
    const plain = engine.optimizeZone(layer, P, undefined, fn);
    const calls = [];
    const hooked = engine.optimizeZone(layer, P, undefined, fn, (runs, planned) => calls.push([runs, planned]));
    assert.deepEqual(hooked, plain);
    assert.equal(calls.length, plain.runs, 'one call per layout tried');
    calls.forEach(([runs, planned], n) => {
      assert.equal(runs, n + 1);
      assert.ok(planned >= runs, `progress over 100 %: ${runs}/${planned}`);
    });
    // The bound is not wildly pessimistic: the last stage is exact, so the end is >= 85 % of plan.
    const [lastRuns, lastPlanned] = calls[calls.length - 1];
    assert.ok(lastRuns / lastPlanned > 0.85, `${lastRuns}/${lastPlanned}`);
  }
});

test('worker protocol: same settings as optimizeZone on the main thread, with exclusions and overlaps', async t => {
  const worker = startWorker();
  t.after(() => worker.terminate());
  const zones = [...OVERLAP_ZONES(), MULTI_ZONE()];
  const exclusions = [ROAD_EXCLUSION()];
  // One worker serves both jobs in sequence (the app uses one worker per run; this also shows
  // that no state leaks from one job into the next).
  for (const [placerName, P, targets] of [['greedy', PRODUCTS.SYN_6x8, [0, 1, 2]], ['straight', PRODUCTS.GAP_5x10, [1, 2]]]) {
    const products = targets.map(() => P);
    const expected = direct(zones, products, exclusions, placerName, targets);
    const posted = await runJob(worker, message(zones, products, exclusions, placerName, targets));

    const zoneMsgs = posted.filter(m => m.type === 'zone');
    assert.deepEqual(zoneMsgs.map(m => m.result), expected, placerName);
    assert.deepEqual(zoneMsgs.map(m => [m.k, m.index]), targets.map((i, k) => [k, i]));
    assert.deepEqual(posted[posted.length - 1], { type: 'done', runs: expected.reduce((s, r) => s + r.runs, 0) });

    // Order: each zone's progress, then that zone's result, before the next zone starts. That is
    // what lets a cancel (worker.terminate) keep the zones already finished and nothing else.
    let k = 0, lastRuns = 0;
    for (const m of posted.slice(0, -1)) {
      if (m.type === 'zone') { assert.equal(m.k, k); k++; lastRuns = 0; continue; }
      assert.equal(m.type, 'progress');
      assert.equal(m.k, k);
      assert.equal(m.runs % 25, 0, 'progress every 25 layouts');
      assert.ok(m.runs > lastRuns && m.runs <= m.planned && m.runs <= expected[k].runs);
      lastRuns = m.runs;
    }
    assert.ok(posted.filter(m => m.type === 'progress').length >= targets.length * 10, 'progress within each zone');
  }
  // The exclusion really matters for these zones, so the comparison above covers it.
  const noExcl = direct(zones, [PRODUCTS.SYN_6x8], [], 'greedy', [0])[0];
  const withExcl = direct(zones, [PRODUCTS.SYN_6x8], exclusions, 'greedy', [0])[0];
  assert.ok(noExcl.spaces > withExcl.spaces, `${noExcl.spaces} vs ${withExcl.spaces}`);
});

test('worker protocol: invalid product gives an empty result; bad input reports an error; unknown messages are ignored', async t => {
  const worker = startWorker();
  t.after(() => worker.terminate());
  const zone = polygonFeature(SIMPLE_SHAPES.A_rect_300x200);
  const unknownReplies = [];
  const spy = m => unknownReplies.push(m);
  worker.on('message', spy);
  worker.postMessage({ type: 'unknown' });
  const err = await runJob(worker, { type: 'optimize', placer: 'greedy', exclusions: [], zones: null });
  worker.off('message', spy);
  assert.equal(unknownReplies.length, 1, 'only the error reply, nothing for the unknown message');
  assert.equal(err.length, 1);
  assert.equal(err[0].type, 'error');
  assert.match(err[0].message, /.+/);
  const msg = message([zone], [{ ...PRODUCTS.GAP_5x10, spaceW: -1 }], [], 'greedy', [0]);
  assert.deepEqual(await runJob(worker, msg), [
    { type: 'zone', k: 0, index: 0, result: { spaces: 0, angleDeg: 0, offX: 0, offY: 0, runs: 0 } },
    { type: 'done', runs: 0 },
  ]);
});

// Cancel = worker.terminate(): it stops the search mid-zone at once. The zones whose 'zone'
// message arrived before the cancel are the only ones the page applies (it ignores any message
// that arrives after optimizeRun was cleared); the others keep their previous layout.
test('cancel: terminate stops the worker promptly in the middle of a zone; finished zones were already reported', async () => {
  const worker = startWorker();
  const zones = [polygonFeature(SIMPLE_SHAPES.E_strip_62x400), polygonFeature(SIMPLE_SHAPES.D_irregular)];
  const msg = message(zones, [PRODUCTS.SYN_6x8, PRODUCTS.GAP_5x10], [], 'greedy', [0, 1]);
  const seen = [];
  const exited = new Promise(resolve => worker.once('exit', resolve));
  let tCancel;
  worker.on('message', m => {
    seen.push(m);
    // Cancel once zone 1 (the slow one, ~3 s) is a few progress steps in.
    if (m.type === 'progress' && m.k === 1 && m.runs === 100 && !tCancel) { tCancel = performance.now(); worker.terminate(); }
  });
  worker.postMessage(msg);
  await exited;
  const stopMs = performance.now() - tCancel;
  assert.ok(tCancel, 'cancel happened');
  assert.ok(stopMs < 1000, `worker stopped ${Math.round(stopMs)} ms after terminate`);
  const zoneMsgs = seen.filter(m => m.type === 'zone');
  assert.deepEqual(zoneMsgs.map(m => m.k), [0], 'only zone 0 finished');
  assert.ok(!seen.some(m => m.type === 'done'));
  const expected0 = direct(zones, [PRODUCTS.SYN_6x8], [], 'greedy', [0])[0];
  assert.deepEqual(zoneMsgs[0].result, expected0);
});

test('worker source: built from the engine region only, with no network or DOM access', () => {
  assert.throws(() => buildOptimizeWorkerSource(turfText, 'no markers here'), /engine code not found/);
  const src = buildOptimizeWorkerSource('/*turf*/', appScriptText(html));
  const region = src.slice(src.indexOf('let drawnExclusions = [];'));
  for (const forbidden of [/\bfetch\(/, /XMLHttpRequest/, /importScripts/, /sendBeacon/, /\bdocument\./, /\bwindow\./, /\bL\./, /arcgis/i]) {
    assert.doesNotMatch(region, forbidden, `worker code must not use ${forbidden}`);
  }
  assert.ok(region.trimEnd().endsWith('optimizeWorkerMain(self);'));
});
