// Cloudflare Pages Function — narrow proxy for ArcGIS REST edit calls (POST /arc-proxy?target=…).
//
// Closed by default (DECISION-LOG B1): every request gets 403 unless the Pages environment sets
// ARC_PROXY_ENABLED = "true". Its only caller, pushToArcGIS() in index.html, is disabled too
// (ENABLE_ARCGIS_PUSH = false). When enabled, a request is forwarded only if:
//   - it comes from this site's own origin (or one listed in ALLOWED_ORIGINS, comma-separated),
//   - the target is https on the default port of the ArcGIS host, without credentials or query,
//   - the path is one of the allowed edit operations on the Space_mapping layer.
// Responses carry no CORS headers: the proxy is for same-origin use only.

const ALLOWED_HOST = 'maps.roskilde-festival.dk';
const ALLOWED_PATH = /^\/server\/rest\/services\/Hosted\/Space_mapping\/FeatureServer\/0\/(addFeatures|deleteFeatures|applyEdits)$/;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function allowedOrigins(request, env) {
  const self = new URL(request.url).origin;
  const extra = String((env && env.ALLOWED_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  return [self, ...extra];
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env || env.ARC_PROXY_ENABLED !== 'true') {
    return json(403, { error: 'ArcGIS proxy is disabled' });
  }

  const origin = request.headers.get('Origin');
  if (!origin || !allowedOrigins(request, env).includes(origin)) {
    return json(403, { error: 'Origin not allowed' });
  }

  const target = new URL(request.url).searchParams.get('target');
  if (!target) return json(400, { error: 'Missing target parameter' });

  let targetUrl;
  try { targetUrl = new URL(target); } catch (_e) {
    return json(400, { error: 'Invalid target URL' });
  }

  // The URL parser has already resolved "." / ".." segments, so the path checked is the path fetched.
  if (targetUrl.protocol !== 'https:' || targetUrl.hostname !== ALLOWED_HOST || targetUrl.port !== ''
      || targetUrl.username || targetUrl.password || targetUrl.search || targetUrl.hash
      || !ALLOWED_PATH.test(targetUrl.pathname)) {
    return json(403, { error: 'Target not allowed' });
  }

  const body = await request.text();
  const upstream = await fetch(targetUrl.href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': origin + '/' },
    body,
  });

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
}
