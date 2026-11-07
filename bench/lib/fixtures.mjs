// Synthetic test zones. Defined in metres in ETRS89 / UTM 32N (EPSG:25832) around a reference
// point at Dyrskuepladsen, converted to WGS84 like an ArcGIS/GeoJSON source would deliver them.
// No RF data: every shape below is invented for testing.
import { createRequire } from 'node:module';
import { turf } from './extract.mjs';

const require = createRequire(import.meta.url);
const proj4 = require('proj4');
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

export const REF_LNG = 12.0760, REF_LAT = 55.6270;
const [REF_E, REF_N] = proj4('EPSG:4326', 'EPSG:25832', [REF_LNG, REF_LAT]);

export const toLL = ([x, y]) => proj4('EPSG:25832', 'EPSG:4326', [REF_E + x, REF_N + y]);
export const rect = (w, h, dx = 0, dy = 0) => [[dx, dy], [dx + w, dy], [dx + w, dy + h], [dx, dy + h]];
export const rot = (pts, deg) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
};
const closeLL = ring => { const c = ring.map(toLL); c.push(c[0]); return c; };

// Polygon from metre rings (first = outer, rest = holes).
export const polygonFeature = (ringsM, properties = {}) => turf.polygon(ringsM.map(closeLL), properties);
export const multiPolygonFeature = (partsM, properties = {}) =>
  turf.multiPolygon(partsM.map(rings => rings.map(closeLL)), properties);

// Minimal stand-in for a Leaflet layer: the placement code only calls toGeoJSON().
export const layerOf = feature => ({ toGeoJSON: () => feature });

// Simple polygons: results must be identical before and after fase 0 (golden test).
export const SIMPLE_SHAPES = {
  A_rect_300x200: [rect(300, 200, -150, -100)],
  B_rect_rot23:   [rot(rect(300, 200, -150, -100), 23)],
  C_L_shape:      [[[-150, -100], [150, -100], [150, 0], [0, 0], [0, 100], [-150, 100]]],
  D_irregular:    [[[-180, -90], [40, -130], [170, -60], [210, 40], [120, 70], [90, 150], [-40, 120], [-110, 160], [-200, 60], [-150, 0]]],
  E_strip_62x400: [rect(62, 400, -31, -200)],
  F_trapezoid:    [[[-200, -80], [200, -80], [90, 90], [-60, 90]]],
};

// Defect probes from discovery (F02–F04).
export const HOLE_OUTER = rect(300, 200, -150, -100);
export const HOLE_RING = rect(80, 60, -40, -30);
export const HOLE_ZONE = () => polygonFeature([HOLE_OUTER, HOLE_RING.slice().reverse()]);
export const MULTI_ZONE = () => multiPolygonFeature([[rect(100, 100, -150, -50)], [rect(100, 100, 50, -50)]]);
export const OVERLAP_ZONES = () => [polygonFeature([rect(200, 200, -200, -100)]), polygonFeature([rect(200, 200, -50, -100)])];
export const ROAD_EXCLUSION = () => polygonFeature([rect(300, 12, -150, -6)]);

export const PRODUCTS = {
  GAP_5x10: { id: 1, name: 'Get a Place (app default)', spaceW: 5, spaceH: 10, maxCols: 10, maxRows: 2, pathW: 5, spaceGap: 0, shape: 'rect' },
  SYN_6x8:  { id: 2, name: 'Synthetic 6x8 1-row', spaceW: 6, spaceH: 8, maxCols: 6, maxRows: 1, pathW: 6, spaceGap: 1, shape: 'rect' },
};

// Parameter sets for the golden test: deliberately not multiples of 5°, incl. >90°.
export const GOLDEN_PARAMS = [[0, 0, 0], [17, 0, 0], [45, 11, 7], [88, 34, 16], [133, 5, 3]];
