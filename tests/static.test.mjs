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

// ── ArcGIS is read-only (DECISION-LOG A9) ──────────────────────────────────────
const region = (() => {
  const a = html.indexOf('// @arcgis-readonly-begin'), b = html.indexOf('// @arcgis-readonly-end');
  assert.ok(a > 0 && b > a, 'read-only region markers missing');
  return html.slice(a, b);
})();
const loadReadOnly = () => new Function(`${region}; return { isArcgisWriteRequest, installArcgisReadOnlyGuard, disableEsriEditing, classifyArcLayerResult };`)();

const WRITE_URLS = [
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/addFeatures',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/deleteFeatures?where=1%3D1&token=x',
  'https://maps.roskilde-festival.dk/arcgis/rest/services/AllEditables_GODKENDT_V3_PRO/FeatureServer/835/updateFeatures',
  'https://maps.roskilde-festival.dk/arcgis/rest/services/AllEditables_GODKENDT_V3_PRO/FeatureServer/applyEdits',
  'https://other-host.example/arcgis/rest/services/X/FeatureServer/0/applyEdits',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/APPLYEDITS',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/%61ddFeatures',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/addFeatures/',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/truncate',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/append',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/calculate',
  'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/12/addAttachment',
  'https://maps.roskilde-festival.dk/server/rest/admin/services/Hosted/Space_mapping/FeatureServer/updateDefinition',
  '/arc-proxy/../server/rest/services/X/FeatureServer/0/addFeatures',
];
const READ_URLS = [
  'https://maps.roskilde-festival.dk/arcgis/rest/services/AllEditables_GODKENDT_V3_PRO/FeatureServer/835?f=json&token=x',
  'https://maps.roskilde-festival.dk/arcgis/rest/services/AllEditables_GODKENDT_V3_PRO/FeatureServer/835/query?where=1%3D1&returnCountOnly=true&f=json',
  'https://maps.roskilde-festival.dk/portal/sharing/rest/oauth2/authorize?client_id=x',
  '/arc-token',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/1/2',
];

test('read-only: no push code, write proxy or write UI remains', () => {
  for (const pattern of [/pushToArcGIS/, /ENABLE_ARCGIS_PUSH/, /arcSyncArea/, /arcLayerWriteUrl/, /\/arc-proxy\?/, /proxyPost/, /Space_mapping/, /rollbackOnFailure/]) {
    assert.doesNotMatch(html, pattern, `found ${pattern}`);
  }
  // Write operation names may only appear inside the read-only guard itself.
  const outside = html.replace(region, '');
  assert.doesNotMatch(outside, /addFeatures|updateFeatures|deleteFeatures|applyEdits/, 'write operation referenced outside the guard');
  assert.match(html, /installArcgisReadOnlyGuard\(window\);\s*disableEsriEditing\(L\.esri\);/, 'guard must be installed at start-up');
});

test('read-only: the guard recognises every ArcGIS write operation (any host, case, encoding) and no reads', () => {
  const { isArcgisWriteRequest } = loadReadOnly();
  for (const u of WRITE_URLS) assert.equal(isArcgisWriteRequest(u), true, u);
  for (const u of READ_URLS) assert.equal(isArcgisWriteRequest(u), false, u);
  assert.equal(isArcgisWriteRequest(new Request(WRITE_URLS[0])), true, 'Request objects');
});

test('read-only: fetch, XMLHttpRequest and sendBeacon refuse write requests whatever the token or headers', async () => {
  const { installArcgisReadOnlyGuard } = loadReadOnly();
  const sent = [];
  class FakeXHR { open(method, url) { sent.push(['xhr', method, url]); } }
  const win = {
    fetch: async (input, init) => { sent.push(['fetch', String(input && input.url ? input.url : input), init && init.headers]); return new Response('{}'); },
    XMLHttpRequest: FakeXHR,
    navigator: { sendBeacon: url => { sent.push(['beacon', url]); return true; } },
  };
  installArcgisReadOnlyGuard(win);
  for (const u of WRITE_URLS) {
    for (const headers of [{}, { Origin: 'https://pladser.campops.net' }, { Authorization: 'Bearer admin-token', 'X-Esri-Authorization': 'Bearer x' }]) {
      await assert.rejects(win.fetch(u, { method: 'POST', headers, body: 'features=[]&token=admin' }), /read-only/);
    }
    assert.throws(() => new win.XMLHttpRequest().open('POST', u), /read-only/);
    assert.equal(win.navigator.sendBeacon(u, 'x'), false);
  }
  for (const u of READ_URLS) { await win.fetch(u); new win.XMLHttpRequest().open('GET', u); }
  assert.equal(sent.length, READ_URLS.length * 2, 'only the read requests went through');
});

test('read-only: esri-leaflet editing methods are disabled', () => {
  const { disableEsriEditing } = loadReadOnly();
  const mk = () => { const C = function () {}; for (const m of ['addFeature', 'addFeatures', 'updateFeature', 'updateFeatures', 'deleteFeature', 'deleteFeatures', 'applyEdits', 'query']) C.prototype[m] = () => 'called'; return C; };
  const esri = { FeatureLayer: mk(), FeatureLayerService: mk(), FeatureManager: mk() };
  disableEsriEditing(esri);
  for (const cls of Object.values(esri)) {
    for (const m of ['addFeature', 'addFeatures', 'updateFeature', 'updateFeatures', 'deleteFeature', 'deleteFeatures', 'applyEdits']) {
      assert.throws(() => new cls()[m](), /read-only/, m);
    }
    assert.equal(new cls().query(), 'called', 'reading still works');
  }
});

test('layer status: empty layer, authorization error and loading error are told apart (KB-02)', () => {
  const { classifyArcLayerResult: c } = loadReadOnly();
  assert.deepEqual(c(null, 0), { state: 'empty', count: 0 });
  assert.deepEqual(c(null, 1234), { state: 'ok', count: 1234 });
  for (const err of [{ code: 498, message: 'Invalid Token' }, { code: 499, message: 'Token Required' }, { code: 403, message: 'You do not have permissions to access this resource or perform this operation.' }, { error: { code: 498, message: 'Invalid token.' } }]) {
    assert.equal(c(err).state, 'auth', JSON.stringify(err));
  }
  for (const err of [{ code: 500, message: 'XMLHttpRequest error' }, { code: 400, message: 'Unable to complete operation.' }, { message: 'Could not parse response as JSON.' }]) {
    assert.equal(c(err).state, 'error', JSON.stringify(err));
  }
  assert.equal(c(null, undefined).state, 'error', 'missing count is an error, not an empty layer');
  assert.equal(c(null, NaN).state, 'error');
});

test('layer status: the count check sends the token (esri-leaflet ignores options.token on L.esri.query)', () => {
  const fn = html.slice(html.indexOf('function checkArcLayer()'), html.indexOf('function setArcLayerStatus('));
  assert.match(fn, /\.token\(arcToken\)/, 'checkArcLayer must call .token(arcToken)');
  assert.doesNotMatch(html, /L\.esri\.query\(\{[^}]*\btoken\s*:/, 'never pass the token only in L.esri.query options');
});

test('layer status: UI shows each state distinctly and ends the session on authorization errors', () => {
  assert.match(html, /id="arcLayerStatus"/);
  assert.match(html, /id="arcAuthMessage"/);
  assert.match(html, /The layer is empty: it contains 0 features\./);
  assert.match(html, /Could not load the layer/);
  assert.match(html, /Not authorized.*ArcGIS rejected your session/);
  assert.match(html, /arcFeatureLayer\.on\('requesterror'/);
  assert.match(html, /Your ArcGIS session has expired/);
  assert.match(html, /Login failed: ArcGIS did not issue a token/);
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
