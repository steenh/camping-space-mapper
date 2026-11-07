// Independent layout validator (does not reuse the placement checks): every space must lie
// inside its own zone (holes excluded), outside every exclusion, and must not overlap any
// other space, within or across zones. Areas in m², tolerance TOL_M2.
import { turf } from './extract.mjs';
import { spacesOf } from './measure.mjs';

export const TOL_M2 = 1e-4; // 1 cm²

const bboxOverlap = (a, b) => !(a[0] > b[2] || a[2] < b[0] || a[1] > b[3] || a[3] < b[1]);
const interArea = (a, b) => { try { const x = turf.intersect(a, b); return x ? turf.area(x) : 0; } catch (_) { return Infinity; } };

// zones: GeoJSON features; layouts: [{ result, product }] per zone; exclusions: GeoJSON features.
export function validateLayouts(engine, zones, layouts, exclusions = []) {
  const all = []; // { zone, poly, bbox }
  const v = { spaces: 0, outsideZone: 0, inExclusion: 0, overlapsWithinZone: 0, overlapsAcrossZones: 0, maxViolationM2: 0 };
  layouts.forEach(({ result, product }, z) => {
    for (const poly of spacesOf(engine, result, product)) {
      v.spaces++;
      let out = 0;
      try { const d = turf.difference(poly, zones[z]); out = d ? turf.area(d) : 0; } catch (_) { out = Infinity; }
      if (out > TOL_M2) { v.outsideZone++; v.maxViolationM2 = Math.max(v.maxViolationM2, out); }
      for (const ex of exclusions) {
        const a = interArea(poly, ex);
        if (a > TOL_M2) { v.inExclusion++; v.maxViolationM2 = Math.max(v.maxViolationM2, a); }
      }
      all.push({ zone: z, poly, bbox: turf.bbox(poly) });
    }
  });
  all.sort((a, b) => a.bbox[0] - b.bbox[0]);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length && all[j].bbox[0] <= all[i].bbox[2]; j++) {
      if (!bboxOverlap(all[i].bbox, all[j].bbox)) continue;
      const a = interArea(all[i].poly, all[j].poly);
      if (a > TOL_M2) {
        if (all[i].zone === all[j].zone) v.overlapsWithinZone++; else v.overlapsAcrossZones++;
        v.maxViolationM2 = Math.max(v.maxViolationM2, a);
      }
    }
  }
  v.valid = v.outsideZone + v.inExclusion + v.overlapsWithinZone + v.overlapsAcrossZones === 0;
  return v;
}
