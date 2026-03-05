// Cloudflare Pages Function — general proxy for ArcGIS REST API calls.
// Accepts a `target` query parameter with the full ArcGIS endpoint URL.
// Only forwards requests to the expected ArcGIS domain for safety.

const ALLOWED_HOST = 'maps.roskilde-festival.dk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const target = new URL(context.request.url).searchParams.get('target');
  if (!target) {
    return new Response(JSON.stringify({ error: 'Missing target parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  let targetUrl;
  try { targetUrl = new URL(target); } catch {
    return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (targetUrl.hostname !== ALLOWED_HOST) {
    return new Response(JSON.stringify({ error: 'Target host not allowed' }), {
      status: 403, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const body = await context.request.text();
  const upstream = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
