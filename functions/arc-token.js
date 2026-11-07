// Cloudflare Pages Function — proxies the ArcGIS OAuth token exchange (POST /arc-token) because
// the portal's token endpoint does not answer cross-origin requests.
//
// Only the app's own PKCE authorization-code exchange is forwarded (DECISION-LOG B1):
//   - request from this site's own origin (or ALLOWED_ORIGINS, comma-separated),
//   - grant_type = authorization_code, an allowed public client_id, code + code_verifier present,
//   - redirect_uri on an allowed origin.
// Only the expected parameters are forwarded. Responses carry no CORS headers (same-origin use).

const TOKEN_URL = 'https://maps.roskilde-festival.dk/portal/sharing/rest/oauth2/token';

// Public PKCE client IDs (no secret). 'wDfGolINXTr1cgFD' is used on master; '2FXbDZ9xhc66sQ0r'
// is the planner's own OAuth app from branch fase0/f5a2-arcgis-client-id. Drop the old ID once
// that branch is merged. Can be overridden with ARCGIS_CLIENT_IDS (comma-separated).
const DEFAULT_CLIENT_IDS = ['wDfGolINXTr1cgFD', '2FXbDZ9xhc66sQ0r'];

const FORWARDED_PARAMS = ['client_id', 'code', 'grant_type', 'redirect_uri', 'code_verifier', 'f'];

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const list = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);

export async function onRequestPost(context) {
  const { request, env } = context;
  const origins = [new URL(request.url).origin, ...list(env && env.ALLOWED_ORIGINS)];
  const clientIds = list(env && env.ARCGIS_CLIENT_IDS).length ? list(env.ARCGIS_CLIENT_IDS) : DEFAULT_CLIENT_IDS;

  const origin = request.headers.get('Origin');
  if (!origin || !origins.includes(origin)) return json(403, { error: 'Origin not allowed' });

  const params = new URLSearchParams(await request.text());
  const redirect = params.get('redirect_uri') || '';
  let redirectOrigin = null;
  try { redirectOrigin = new URL(redirect).origin; } catch (_e) { redirectOrigin = null; }

  if (params.get('grant_type') !== 'authorization_code'
      || !clientIds.includes(params.get('client_id'))
      || !params.get('code') || !params.get('code_verifier')
      || !redirectOrigin || !origins.includes(redirectOrigin)) {
    return json(400, { error: 'Token request not allowed' });
  }

  const forward = new URLSearchParams();
  for (const key of FORWARDED_PARAMS) if (params.has(key)) forward.set(key, params.get(key));

  const upstream = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: forward.toString(),
  });

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
}
