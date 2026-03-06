# Camping Space Mapper

A browser-based tool for planning and optimising camping space layouts on satellite imagery. Draw area polygons, configure product types, and let the algorithm place blocks of camping spaces as efficiently as possible.

## Features

- **Satellite map** — Esri World Imagery with label overlay
- **Polygon drawing** — draw one or more area polygons directly on the map
- **Product types** — define different space sizes (width × height, max columns/rows, path width, colour) per area
- **Two placement algorithms**
  - *Greedy row-by-row* — maximises spaces per row, variable row heights
  - *Straight walking paths* — adaptive column slots with aligned corridors
- **Optimiser** — sweeps 90 rotation angles × 5×5 offset combinations to find the best fit
- **Exclusion zones** — draw red-dashed polygons over roads and obstacles; the algorithm skips any block that overlaps them
- **Space selection** — click individual spaces, double-click a block, box-select an area, or "Select all" per polygon; re-run Calculate/Optimize on the selection only
- **ArcGIS Enterprise integration**
  - OAuth 2.0 Authorization Code + PKCE login (no client secret in source)
  - Load restricted feature layers onto the map (click, box, or polygon select)
  - Create area polygons from selected features using a concave hull
  - Push the final layout directly to an ArcGIS hosted feature layer
- **GeoJSON export** — download the full layout with `product_type`, `area_index`, and `block_key` attributes

## Tech stack

| Library | Version | Purpose |
|---|---|---|
| [Leaflet](https://leafletjs.com/) | 1.9.4 | Map rendering & drawing |
| [Leaflet.draw](https://github.com/Leaflet/Leaflet.draw) | 1.0.4 | Polygon / rectangle draw tools |
| [Turf.js](https://turfjs.org/) | 6.5.0 | Geometry (area, centroid, concave hull, intersection) |
| [esri-leaflet](https://developers.arcgis.com/esri-leaflet/) | 3 | ArcGIS feature layer loading |

All loaded from CDN — no build step required.

## Deployment

The app is a single `index.html` file deployed via **Cloudflare Pages** with two serverless proxy functions in `functions/`:

| Function | Path | Purpose |
|---|---|---|
| `arc-token.js` | `/arc-token` | Proxies the ArcGIS OAuth token exchange (avoids CORS) |
| `arc-proxy.js` | `/arc-proxy` | Proxies ArcGIS REST API calls (deleteFeatures, addFeatures) |

Both functions are Cloudflare Pages Functions (ES module format). The proxy only forwards requests to `maps.roskilde-festival.dk`.

### Local development

```bash
npx wrangler pages dev .
```

> Opening `index.html` directly as a `file://` URL will break the OAuth redirect and the proxy functions. Always use a local HTTP server.

## ArcGIS setup

1. Create an application in your ArcGIS Enterprise portal and note the **Client ID**.
2. Register the redirect URI for every domain the app runs on (e.g. your Cloudflare Pages domain and `http://localhost:8788`). The redirect URI used in code is `window.location.origin + window.location.pathname` — no code changes needed when the domain changes.
3. Set `ARCGIS_CLIENT_ID` near the top of `index.html` to your Client ID.

## Configuration

All configurable constants are at the top of the `<script>` block in `index.html`:

```js
const ARCGIS_CLIENT_ID  = 'your-client-id';
const ARCGIS_PORTAL_URL = 'https://your-portal.example.com/portal';
const ARCGIS_LAYER_URL  = 'https://your-server.example.com/arcgis/rest/services/.../FeatureServer/N';
```

The target layer write URL for the Push feature is a dropdown in the Export / Sync section — add options directly in the HTML.

## How to use

1. **Draw areas** — use the polygon tool on the map, or log in to ArcGIS and select features to create a polygon automatically.
2. **Assign a product type** to each area in the Areas section, then set your rotation and offset in Layout settings.
3. **Draw exclusion zones** (optional) — mark roads and obstacles where spaces won't be placed.
4. **Calculate** places blocks · **Optimize** finds the best rotation and offset automatically.
5. **Select spaces** to re-run only part of the layout — click a space, double-click for the whole block, Select area to box-select, Select all for a full area.
6. **Export** the result as GeoJSON or push directly to an ArcGIS feature layer.
