// Tests for the Cloudflare Pages Functions. global fetch is mocked: no request ever leaves the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestPost as proxyPost } from '../functions/arc-proxy.js';
import { onRequestPost as tokenPost } from '../functions/arc-token.js';

const SITE = 'https://pladser.example.test';
const ARC = 'https://maps.roskilde-festival.dk';
const ALLOWED_TARGET = `${ARC}/server/rest/services/Hosted/Space_mapping/FeatureServer/0/addFeatures`;

let calls = [];
const realFetch = globalThis.fetch;
test.beforeEach(() => {
  calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('{"ok":true}', { status: 200 }); };
});
test.after(() => { globalThis.fetch = realFetch; });

const proxyReq = (target, { origin = SITE, env = { ARC_PROXY_ENABLED: 'true' }, body = 'features=%5B%5D&token=t' } = {}) => {
  const url = target === null ? `${SITE}/arc-proxy` : `${SITE}/arc-proxy?target=${encodeURIComponent(target)}`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (origin) headers.Origin = origin;
  return proxyPost({ request: new Request(url, { method: 'POST', headers, body }), env });
};

test('arc-proxy: closed by default (no ARC_PROXY_ENABLED)', async () => {
  for (const env of [{}, { ARC_PROXY_ENABLED: 'false' }, { ARC_PROXY_ENABLED: '1' }]) {
    const r = await proxyReq(ALLOWED_TARGET, { env });
    assert.equal(r.status, 403);
  }
  assert.equal(calls.length, 0);
});

test('arc-proxy: rejects requests that are not from an allowed origin', async () => {
  assert.equal((await proxyReq(ALLOWED_TARGET, { origin: null })).status, 403);
  assert.equal((await proxyReq(ALLOWED_TARGET, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await proxyReq(ALLOWED_TARGET, { origin: 'http://pladser.example.test' })).status, 403);
  assert.equal(calls.length, 0);
});

test('arc-proxy: rejects every target outside the allowlist', async () => {
  const rejected = {
    'missing target': [null, 400],
    'not a URL': ['not a url', 400],
    'other host': ['https://evil.example/server/rest/services/Hosted/Space_mapping/FeatureServer/0/addFeatures', 403],
    'look-alike host': ['https://maps.roskilde-festival.dk.evil.example/server/rest/services/Hosted/Space_mapping/FeatureServer/0/addFeatures', 403],
    'plain http': [ALLOWED_TARGET.replace('https:', 'http:'), 403],
    'non-default port': [ALLOWED_TARGET.replace(ARC, `${ARC}:6443`), 403],
    'credentials in URL': [ALLOWED_TARGET.replace('https://', 'https://user:pw@'), 403],
    'query string': [`${ALLOWED_TARGET}?where=1%3D1`, 403],
    'generateToken': [`${ARC}/portal/sharing/rest/generateToken`, 403],
    'portal admin': [`${ARC}/portal/portaladmin/security/users`, 403],
    'other layer': [`${ARC}/server/rest/services/Hosted/Other/FeatureServer/0/addFeatures`, 403],
    'other operation': [`${ARC}/server/rest/services/Hosted/Space_mapping/FeatureServer/0/truncate`, 403],
    'path traversal': [`${ARC}/server/rest/services/Hosted/Space_mapping/FeatureServer/0/../../../../../portal/sharing/rest/generateToken`, 403],
    'encoded traversal': [`${ARC}/server/rest/services/Hosted/Space_mapping/FeatureServer/0/%2e%2e/%2e%2e/Other/FeatureServer/0/addFeatures`, 403],
  };
  for (const [name, [target, status]] of Object.entries(rejected)) {
    const r = await proxyReq(target);
    assert.equal(r.status, status, name);
  }
  assert.equal(calls.length, 0, 'nothing may be forwarded');
});

test('arc-proxy: forwards an allowed edit call unchanged, without CORS headers', async () => {
  for (const op of ['addFeatures', 'deleteFeatures', 'applyEdits']) {
    const target = ALLOWED_TARGET.replace('addFeatures', op);
    const r = await proxyReq(target);
    assert.equal(r.status, 200, op);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, ALLOWED_TARGET);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, 'features=%5B%5D&token=t');
  assert.equal(calls[0].init.headers.Referer, `${SITE}/`);
});

test('arc-proxy: ALLOWED_ORIGINS adds origins (e.g. local dev)', async () => {
  const r = await proxyReq(ALLOWED_TARGET, { origin: 'http://localhost:8788', env: { ARC_PROXY_ENABLED: 'true', ALLOWED_ORIGINS: 'http://localhost:8788' } });
  assert.equal(r.status, 200);
});

const tokenReq = (params, { origin = SITE, env = {} } = {}) => {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (origin) headers.Origin = origin;
  return tokenPost({ request: new Request(`${SITE}/arc-token`, { method: 'POST', headers, body: new URLSearchParams(params).toString() }), env });
};
const VALID = { client_id: 'wDfGolINXTr1cgFD', code: 'abc', grant_type: 'authorization_code', redirect_uri: `${SITE}/`, code_verifier: 'v'.repeat(43), f: 'json' };

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

test('arc-token: forwards a valid exchange with only the expected parameters', async () => {
  const r = await tokenReq({ ...VALID, extra: 'dropped' });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://maps.roskilde-festival.dk/portal/sharing/rest/oauth2/token');
  const sent = new URLSearchParams(calls[0].init.body);
  assert.deepEqual([...sent.keys()].sort(), ['client_id', 'code', 'code_verifier', 'f', 'grant_type', 'redirect_uri']);
});

test('arc-token: accepts the client ID configured in index.html', async () => {
  const id = fs.readFileSync('index.html', 'utf8').match(/const ARCGIS_CLIENT_ID\s*=\s*'([^']+)'/)[1];
  assert.equal((await tokenReq({ ...VALID, client_id: id })).status, 200, `client ID ${id} from index.html must be allowed`);
  assert.equal((await tokenReq({ ...VALID, client_id: '2FXbDZ9xhc66sQ0r' })).status, 200, 'ID from branch fase0/f5a2 must be allowed');
});
