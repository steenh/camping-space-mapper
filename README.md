# Camping Space Mapper

A browser-based tool for planning and optimising camping space layouts on satellite imagery. Draw area polygons, configure product types, and let the algorithm place blocks of camping spaces as efficiently as possible.

## Features

- **Satellite map** — Esri World Imagery with label overlay
- **Polygon drawing** — draw one or more area polygons directly on the map. Areas may have holes or several parts (e.g. from a concave hull); where areas overlap, the shared ground is filled only once, by the earlier area, and the gross area shown is the union
- **Product types** — define different space sizes (width × height, max columns/rows, path width, colour) per area
- **Two placement algorithms**
  - *Greedy row-by-row* — maximises spaces per row, variable row heights
  - *Straight walking paths* — adaptive column slots with aligned corridors
- **Optimiser** — sweeps 18 rotation angles (0–85° in 5° steps) × 3×3 offsets with one shared setting for all areas, and shows the best layout *found* (not a proven optimum; see `DISCOVERY-OPTIMIZATION.md` for the measured gap)
- **Exclusion zones** — draw red-dashed polygons over roads and obstacles; the algorithm skips any block that overlaps them
- **Space selection** — click individual spaces, double-click a block, box-select an area, or "Select all" per polygon; re-run Calculate/Optimize on the selection only
- **ArcGIS Enterprise integration**
  - OAuth 2.0 Authorization Code + PKCE login (no client secret in source)
  - Load restricted feature layers onto the map (click, box, or polygon select)
  - Create area polygons from selected features using a concave hull
  - **Read-only:** the app never writes to ArcGIS (`DECISION-LOG.md`, A9). There is no push, no write proxy, and a browser-side guard refuses every ArcGIS edit operation. The layer panel tells an empty layer, an authorization error and a loading error apart
- **GeoJSON export** — download the full layout with `product_type`, `area_index`, and `block_key` attributes

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | Map rendering & drawing |
| [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) | 1.0.4 | Polygon / rectangle draw tools |
| [Turf.js](https://turfjs.org/) | 6.5.0 | Geometry (area, centroid, concave hull, intersection) |
| [esri-leaflet](https://developers.arcgis.com/esri-leaflet/) | 3.0.19 | ArcGIS feature layer loading |

All loaded from CDN at exact versions with Subresource Integrity (`integrity="sha384-…"`) — no build step required. To upgrade a library, change the URL and recompute its hash (`CSM_NETWORK=1 npm test` verifies all hashes against the CDN).

## Deployment

The app is a single `index.html` file deployed via **Cloudflare Pages** with one serverless function in `functions/` (there is no write proxy: the app only reads from ArcGIS):

| Function | Path | Purpose |
|---|---|---|
| `arc-token.js` | `/arc-token` | Proxies the ArcGIS OAuth token exchange (the portal's token endpoint has no CORS). Forwards only the app's own PKCE authorization-code exchange: same origin, allowed public client IDs, redirect URI on an allowed origin |

It is a Cloudflare Pages Function (ES module format) that only ever calls the portal's token endpoint and sends no CORS headers (same-origin use only).

| Environment variable | Default | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | — | Extra allowed origins, comma-separated (the site's own origin is always allowed) |
| `ARCGIS_CLIENT_IDS` | built-in list | Public OAuth client IDs accepted by `/arc-token`, comma-separated |

### Local development

```bash
npx wrangler pages dev .
```

> Opening `index.html` directly as a `file://` URL will break the OAuth redirect and the proxy functions. Always use a local HTTP server.

## ArcGIS setup

1. Create an application in your ArcGIS Enterprise portal and note the **Client ID**.
2. Register the redirect URI for every domain the app runs on (e.g. your Cloudflare Pages domain and `http://localhost:8788`). The redirect URI used in code is `window.location.origin + window.location.pathname` — no code changes needed when the domain changes.
3. Set `ARCGIS_CLIENT_ID` near the top of `index.html` to your Client ID, and make sure it is in the allowed list in `functions/arc-token.js` (or `ARCGIS_CLIENT_IDS`). A test fails if it is not.

## Configuration

All configurable constants are at the top of the `<script>` block in `index.html`:

```js
const ARCGIS_CLIENT_ID  = 'your-client-id';
const ARCGIS_PORTAL_URL = 'https://your-portal.example.com/portal';
const ARCGIS_LAYER_URL  = 'https://your-server.example.com/arcgis/rest/services/.../FeatureServer/N';
```

There is no write target: results leave the app only as a GeoJSON download.

## How to use

1. **Draw areas** — use the polygon tool on the map, or log in to ArcGIS and select features to create a polygon automatically.
2. **Assign a product type** to each area in the Areas section, then set your rotation and offset in Layout settings.
3. **Draw exclusion zones** (optional) — mark roads and obstacles where spaces won't be placed.
4. **Calculate** places blocks · **Optimize** finds the best rotation and offset automatically.
5. **Select spaces** to re-run only part of the layout — click a space, double-click for the whole block, Select area to box-select, Select all for a full area.
6. **Export** the result as GeoJSON and hand it to Team GIS.

## Development: tests and benchmarks

Node ≥ 20 is needed for the tooling only; the app itself has no build step.

```bash
npm ci
npm test                 # all tests (golden regression, geometry probes, functions, static checks)
CSM_NETWORK=1 npm test   # also verifies the SRI hashes against the CDN files
npm run bench            # benchmark of the current optimiser on synthetic zones -> bench/results/latest.*
npm run bench:discovery  # slow: reproduces the search comparison from DISCOVERY-OPTIMIZATION.md
node bench/compare-0b.mjs   # old vs per-zone Optimize; bench/results/fase0b-compare.json must stay byte-identical
npm run bench:browser    # static server on 127.0.0.1:8790 for bench/browser/worker-bench.html (main thread vs Web Worker)
```

- `bench/lib/extract.mjs` loads the pure geometry/placement code straight from `index.html` (from `// ── Coordinate helpers` to `// @bench-extract-end`), so tests run the app's own code.
- `tests/golden.test.mjs` checks that simple polygons give exactly the same layouts as the baseline in `bench/baseline/` (generated from commit `859849b`). Regenerate the baseline only on purpose, with a recorded reason.
- Fixtures are synthetic (`bench/lib/fixtures.mjs`). Do not commit real RF zone data.
- Optimize runs in a Web Worker (fase 0B.4). `tests/worker.test.mjs` runs the real worker script (built by the app's `buildOptimizeWorkerSource`) in a Node worker thread and compares it with `optimizeZone` on the main thread. For browser timings open `http://127.0.0.1:8790/bench/browser/worker-bench.html?auto=1` in Chrome after `npm run bench:browser`; its fixtures are `bench/fixtures/worker-bench.json` (`node bench/make-worker-fixtures.mjs`).

## Planning documents

`DISCOVERY-*.md` describe the current state and the next generation; `DECISION-LOG.md` records decisions and approval gates.
