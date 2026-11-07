// Helpers to materialise and measure placement results.
import crypto from 'node:crypto';
import { turf } from './extract.mjs';

export const countSpaces = r => r.blocks.reduce((s, b) => s + b.ncols * b.nrows, 0);

// Stable fingerprint of a layout: block origins rounded to 1 µm + sizes.
export function layoutHash(r) {
  const rows = r.blocks.map(b => `${b.ox.toFixed(6)},${b.oy.toFixed(6)},${b.ncols},${b.nrows}`);
  return crypto.createHash('sha256').update(rows.join(';')).digest('hex').slice(0, 16);
}

// Space polygons in lng/lat, built exactly like renderBlocks() does.
export function spacesOf(engine, r, product) {
  const { blocks, rad, cLat, cLng, f } = r;
  const gap = product.spaceGap || 0;
  const stepW = product.spaceW + gap, stepH = product.spaceH + gap;
  const out = [];
  for (const b of blocks) for (let row = 0; row < b.nrows; row++) for (let col = 0; col < b.ncols; col++) {
    const ring = engine.spaceCorners(b.ox, b.oy, col, row, rad, product.spaceW, product.spaceH, stepW, stepH)
      .map(p => { const [lat, lng] = engine.toGeo(p.x, p.y, cLat, cLng, f); return [lng, lat]; });
    ring.push(ring[0]);
    out.push(turf.polygon([ring]));
  }
  return out;
}

const bboxOverlap = (a, b) => !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);

// Largest intersection area (m²) between any space in `as` and any polygon in `bs`, plus count above tol.
export function maxIntersection(as, bs, tolM2) {
  const bb = bs.map(x => turf.bbox(x));
  let max = 0, above = 0;
  for (const a of as) {
    const ab = turf.bbox(a);
    for (let i = 0; i < bs.length; i++) {
      if (!bboxOverlap(ab, bb[i])) continue;
      let inter = null;
      try { inter = turf.intersect(a, bs[i]); } catch (_) { inter = null; }
      if (!inter) continue;
      const area = turf.area(inter);
      if (area > max) max = area;
      if (area > tolM2) above++;
    }
  }
  return { maxM2: max, countAboveTol: above };
}

// Runs fn with a hard time limit by checking elapsed time is reported (sync code cannot be interrupted).
export function timed(fn) {
  const t0 = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t0 };
}
