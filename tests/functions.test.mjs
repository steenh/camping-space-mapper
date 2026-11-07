// Tests for the Cloudflare Pages Functions. global fetch is mocked: no request ever leaves the test.
// ArcGIS is read-only for this app (DECISION-LOG A9): the only function left is the OAuth token
// exchange, and it may never reach anything but the portal's token endpoint.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestPost as tokenPost } from '../functions/arc-token.js';

const SITE = 'https://pladser.example.test';
const TOKEN_URL = 'https://maps.roskilde-festival.dk/portal/sharing/rest/oauth2/token';

let calls = [];
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{"ok":true}', { status: 200 }); };
});
test.after(() => { globalThis.fetch = realFetch; });

const tokenReq = (params, { origin = SITE, env = {}, path = '/arc-token' } = {}) => {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (origin) headers.Origin = origin;
  return tokenPost({ request: new Request(`${SITE}${path}`, { method: 'POST', headers, body: new URLSearchParams(params).toString() }), env });
};
const VALID = { client_id: 'wDfGolINXTr1cgFD', code: 'abc', grant_type: 'authorization_code', redirect_uri: `${SITE}/`, code_verifier: 'v'.repeat(43), f: 'json' };

test('read-only: no server-side ArcGIS write path exists (only the token exchange function)', () => {
  const files = fs.readdirSync('functions').sort();
  assert.deepEqual(files, ['arc-token.js'], `unexpected functions: ${files}`);
  for (const f of files) {
    const src = fs.readFileSync(`functions/${f}`, 'utf8');
    assert.doesNotMatch(src, /addFeatures|updateFeatures|deleteFeatures|applyEdits|FeatureServer|MapServer|\btarget\b/i, `${f} must not reference ArcGIS edit endpoints or proxy targets`);
    assert.doesNotMatch(src, /export (async )?function onRequest(Get|Put|Patch|Delete)?\b(?!Post)/, `${f} must only handle POST`);
  }
});

test('read-only: arc-token never contacts anything but the token endpoint, whatever the request', async () => {
  const attempts = [
    [VALID, {}],
    [{ ...VALID, target: 'https://maps.roskilde-festival.dk/server/rest/services/Hosted/Space_mapping/FeatureServer/0/applyEdits' }, {}],
    [{ ...VALID, redirect_uri: `${SITE}/`, f: 'json', edits: '[{"adds":[]}]' }, {}],
    [VALID, { origin: 'https://evil.example' }],
    [VALID, { origin: null }],
    [VALID, { path: '/arc-token?target=https%3A%2F%2Fmaps.roskilde-festival.dk%2Fserver%2Frest%2Fservices%2FHosted%2FSpace_mapping%2FFeatureServer%2F0%2FdeleteFeatures' }],
    [{ ...VALID, grant_type: 'password', username: 'admin', password: 'x' }, {}],
  ];
  for (const [params, opts] of attempts) await tokenReq(params, opts);
  assert.ok(calls.length > 0);
  for (const c of calls) {
    assert.equal(c.url, TOKEN_URL);
    const sent = new URLSearchParams(c.init.body);
    assert.deepEqual([...sent.keys()].sort(), ['client_id', 'code', 'code_verifier', 'f', 'grant_type', 'redirect_uri'], 'only the expected parameters are forwarded');
  }
});

test('arc-token: rejects anything but the app\'s own PKCE code exchange', async () => {
  const cases = {
    'foreign origin': [VALID, { origin: 'https://evil.example' }, 403],
    'no origin': [VALID, { origin: null }, 403],
    'unknown client_id': [{ ...VALID, client_id: 'someoneElse' }, {}, 400],
    'password grant': [{ ...VALID, grant_type: 'password', username: 'u', password: 'p' }, {}, 400],
    'refresh grant': [{ ...VALID, grant_type: 'refresh_token', refresh_token: 'r' }, {}, 400],
    'client_credentials': [{ ...VALID, grant_type: 'client_credentials', client_secret: 's' }, {}, 400],
    'missing code': [{ ...VALID, code: '' }, {}, 400],
    'missing verifier': [{ ...VALID, code_verifier: '' }, {}, 400],
    'foreign redirect': [{ ...VALID, redirect_uri: 'https://evil.example/' }, {}, 400],
    'bad redirect': [{ ...VALID, redirect_uri: 'nonsense' }, {}, 400],
  };
  for (const [name, [params, opts, status]] of Object.entries(cases)) {
    assert.equal((await tokenReq(params, opts)).status, status, name);
  }
  assert.equal(calls.length, 0);
});

test('arc-token: forwards a valid exchange with only the expected parameters, no CORS, no redirects', async () => {
  const r = await tokenReq({ ...VALID, extra: 'dropped' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, TOKEN_URL);
  assert.equal(calls[0].init.redirect, 'manual');
});

test('arc-token: ALLOWED_ORIGINS adds origins, trailing slash tolerated', async () => {
  const env = { ALLOWED_ORIGINS: 'http://localhost:8788/ , https://other.example' };
  assert.equal((await tokenReq({ ...VALID, redirect_uri: 'http://localhost:8788/' }, { origin: 'http://localhost:8788', env })).status, 200);
});

test('arc-token: unreachable portal gives 502', async () => {
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  assert.equal((await tokenReq(VALID)).status, 502);
});

test('arc-token: accepts the client ID configured in index.html', async () => {
  const id = fs.readFileSync('index.html', 'utf8').match(/const ARCGIS_CLIENT_ID\s*=\s*'([^']+)'/)[1];
  assert.equal((await tokenReq({ ...VALID, client_id: id })).status, 200, `client ID ${id} from index.html must be allowed`);
  assert.equal((await tokenReq({ ...VALID, client_id: '2FXbDZ9xhc66sQ0r' })).status, 200, 'ID from origin/master (dbf2580) must be allowed');
});
