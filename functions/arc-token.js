// Cloudflare Pages Function — proxies ArcGIS OAuth token exchange to avoid CORS.
// Accessible at /arc-token from the browser.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const body = await context.request.text();

  const upstream = await fetch(
    'https://maps.roskilde-festival.dk/portal/sharing/rest/oauth2/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  );

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
