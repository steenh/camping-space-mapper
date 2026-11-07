// Static and runtime checks on index.html: supply chain, disabled push, truthful labels, escaping.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const INDEX = process.env.CSM_INDEX_HTML || 'index.html';
const html = fs.readFileSync(INDEX, 'utf8');

const externalTags = () => {
  const tags = [];
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="(https?:[^"]+)"[^>]*>/g)) tags.push({ tag: m[0], url: m[1] });
  for (const m of html.matchAll(/<link\b[^>]*\bhref="(https?:[^"]+)"[^>]*>/g)) tags.push({ tag: m[0], url: m[1] });
  return tags;
};

test('supply chain: every external script/stylesheet is version-pinned and has SRI', () => {
  const tags = externalTags();
  assert.ok(tags.length >= 6, `expected the 6 CDN files, found ${tags.length}`);
  for (const { tag, url } of tags) {
    assert.match(url, /[@/]\d+\.\d+\.\d+\//, `not pinned to an exact version: ${url}`);
    assert.match(tag, /integrity="sha384-[A-Za-z0-9+/=]{64}"/, `missing sha384 integrity: ${url}`);
    assert.match(tag, /crossorigin="anonymous"/, `missing crossorigin: ${url}`);
  }
});

// Opt-in (needs network): CSM_NETWORK=1 npm test — verifies the hashes against the CDN files.
test('supply chain: SRI hashes match the CDN files', { skip: !process.env.CSM_NETWORK }, async () => {
  for (const { tag, url } of externalTags()) {
    const body = Buffer.from(await (await fetch(url)).arrayBuffer());
    const expected = tag.match(/integrity="(sha384-[^"]+)"/)[1];
    assert.equal(`sha384-${crypto.createHash('sha384').update(body).digest('base64')}`, expected, url);
  }
});

test('push: the destructive ArcGIS push is disabled by a code flag', () => {
  assert.match(html, /const ENABLE_ARCGIS_PUSH = false;/);
  assert.match(html, /async function pushToArcGIS\(\) \{\s*if \(!ENABLE_ARCGIS_PUSH\) \{/, 'guard must be the first statement');
  assert.match(html, /arcSyncArea'\)\.style\.display\s*=\s*\(ENABLE_ARCGIS_PUSH &&/, 'push UI must stay hidden');
});

test('push: calling pushToArcGIS() makes no network request', async () => {
  const start = html.indexOf('async function pushToArcGIS()');
  const end = html.indexOf('function clearAll()', start);
  const src = html.slice(start, end);
  const calls = [];
  let status = '';
  const fn = new Function('ENABLE_ARCGIS_PUSH', 'arcToken', 'document', 'fetch', 'setStatus', 'polyLayers',
    'getProductForPoly', 'turf', `${src}; return pushToArcGIS;`)(
    false, 'token', { getElementById: () => ({ value: 'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0' }) },
    (...args) => { calls.push(args); return Promise.resolve(new Response('{}')); },
    msg => { status = msg; }, new Map(), () => ({}), {});
  await fn();
  assert.equal(calls.length, 0, 'no request may be sent');
  assert.match(status, /disabled/i);
});

test('labels: no "optimal" claim for a best-found layout', () => {
  assert.doesNotMatch(html, />OPTIMAL</);
  assert.doesNotMatch(html, /`Optimal:/);
  assert.match(html, /BEST FOUND/);
});

test('escaping: user-typed product names are escaped before innerHTML', () => {
  assert.match(html, /function escapeHtml\(/);
  assert.doesNotMatch(html, /\$\{p\.name\}/, 'raw ${p.name} interpolation found');
});

test('engine region has the explicit extract marker', () => {
  assert.ok(html.includes('// @bench-extract-end'));
});
