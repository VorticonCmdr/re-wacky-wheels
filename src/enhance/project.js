// The projection adapter of the Enhanced presentation: the floor and the sprite projection of the reconstructed renderer (render/floor.js,
// game/view.js) with the camera's position kept to a fraction of a world unit. At a whole-unit camera the floor is the original one pixel
// for pixel (test/enhance.test.js, scripts/check-enhance.js); the heading stays a whole TRIG entry, one screen column.
// Every pixel the floor writes also gets its distance, in the unit the game sorts its sprites by (the row table's distance): the NDIST
// distance of the column and step scaled by the column's VIEW word, which puts the floor and the sprites on one depth scale.
import { models } from './models.js';
import { cosT } from './geometry.js';

export const KIND = { sky: 0, horizon: 1, floor: 2, sprite: 3 }; // @math the kinds of pixel

const wrap16 = v => v - 65536 * Math.round(v / 65536); // @math world words are 16 bits: the shortest signed difference
export const roundWord = v => ((Math.round(v) % 65536) + 65536) % 65536; // @math world positions are 16-bit words

// Per world: the depth of every floor sample (column x step), and the floor's farthest depth at the screen's centre column.
const depthCache = new WeakMap();
export function floorDepths(world) {
  let d = depthCache.get(world.ndist);
  if (d) return d;
  const F = models().floor, V = models().view, table = new Float32Array(F.columns * F.steps);
  for (let c = 0; c < F.columns; c++) {
    const scale = world.view.getUint32(c * V.viewBytes, true) / 2 ** V.viewShift; // @math the VIEW word is a 2.14 fixed-point scale
    for (let k = 0; k < F.steps; k++) table[c * F.steps + k] = world.ndist.getUint32((c * F.groupDwords + k) * F.ndistDwordBytes, true) * (scale || 1);
  }
  d = { table, far: table[V.center * F.steps + F.steps - 1] };
  depthCache.set(world.ndist, d);
  return d;
}

// The layers of a screen before its sprites (per world, detail level and sky): the sky rows, the horizon strip's rows unless the sky
// covers them (a demo's page), and the floor's rows with the depth of the sample each pixel is filled from.
const templateCache = new WeakMap();
export function layerTemplate(world, mode, plainSky, horizon) {
  let byKey = templateCache.get(world.ndist);
  if (!byKey) { byKey = new Map(); templateCache.set(world.ndist, byKey); }
  const key = `${mode}:${plainSky}`;
  let t = byKey.get(key);
  if (t) return t;
  const F = models().floor, step = F.columnSteps[mode - 1], depths = floorDepths(world).table, size = F.width * F.height;
  t = { kind: new Uint8Array(size), depth: new Float32Array(size).fill(Infinity) };
  if (plainSky) t.kind.fill(KIND.horizon, horizon.from * F.width, horizon.to * F.width);
  for (let c = 0; c < F.columns; c += step) for (let k = 0; k < F.steps; k++) {
    const at = (F.bottomRow - k) * F.width + c;
    t.kind.fill(KIND.floor, at, at + step); t.depth.fill(depths[c * F.steps + k], at, at + step);
  }
  byKey.set(key, t);
  return t;
}

// The floor of render/floor.js for a camera whose x and y may hold fractions: the texel of a sample is the floor of the exact sum, so a
// whole-unit camera reproduces the original's 16-bit sums (the kind and depth of its pixels are layerTemplate's). The hooks write layers
// beside the picture, which they never change: with `liquid` ({ texels, wet, wave, shade }: water.js) every sample on a liquid texel also
// marks its pixels in `wet` with the liquid's kind (texels: per tile and texel 0, 1 or 2) and fills `wave` with shade(kind, x, y, column,
// step); with `relief` ({ out, light }: relief.js) every sample fills `out` with light(id x tile bytes + texel, x, y) of its tile texel and world texel.
export function drawFloor(world, camera, mode, fb, { liquid = null, relief = null } = {}) {
  const F = models().floor, step = F.columnSteps[mode - 1], half = F.trigEntryBytes / 2, scale = 2 ** F.fixedBits; // @math the second dword of a TRIG entry is half an entry on
  const ix = Math.floor(camera.x), iy = Math.floor(camera.y), fx = (camera.x - ix) * scale, fy = (camera.y - iy) * scale;
  let angle = (((camera.heading - F.angleBias) % F.wrap) + F.wrap) % F.wrap;
  const texels = liquid ? liquid.texels : null, lit = relief ? relief.out : null;
  for (let c = 0; c < F.columns; c += step) {
    const v0 = world.trig.getUint32(angle * F.trigEntryBytes, true), v1 = world.trig.getUint32(angle * F.trigEntryBytes + half, true);
    for (let k = 0; k < F.steps; k++) {
      const n = world.ndist.getUint32((c * F.groupDwords + k) * F.ndistDwordBytes, true);
      const x = (Math.floor((Math.imul(v0, n) + fx) / scale) + ix) & 0xffff, y = (Math.floor((Math.imul(v1, n) + fy) / scale) + iy) & 0xffff; // @math the exact product (it fits 31 bits) plus the fraction, then the 16-bit sum
      const row = (y >> F.tileShift) - F.mapOrigin, col = (x >> F.tileShift) - F.mapOrigin;
      const inside = row >= 0 && row < F.mapRows && col >= 0 && col < F.mapColumns;
      const id = inside ? world.tiles[row * F.mapColumns + col] : 0, sheet = Math.floor(id / F.sheetCount), texel = ((y & F.tileMask) << F.tileShift) + (x & F.tileMask);
      const pixel = world.sheets[sheet][(id % F.sheetCount) * F.tileBytes + texel];
      const at = (F.bottomRow - k) * F.width + c;
      fb.fill(pixel, at, at + step);
      if (texels !== null) { const kind = texels[id * F.tileBytes + texel]; if (kind !== 0) { const light = liquid.shade(kind, x, y, c, k); for (let j = at; j < at + step; j++) { liquid.wet[j] = kind; liquid.wave[j] = light; } } }
      if (lit !== null) { const light = relief.light(id * F.tileBytes + texel, x, y); for (let j = at; j < at + step; j++) lit[j] = light; }
    }
    angle += step;
    if (angle >= F.wrap) angle = F.resetTo;
  }
  return fb;
}

// The screen row of a distance, between the entries of the row table.
export function rowAt(rows, d) {
  const x = Math.min(Math.max(d, 0), rows.length - 1), i = Math.floor(x), t = x - i;
  return t === 0 ? rows[i] : rows[i] * (1 - t) + rows[i + 1] * t;
}

// The unit vector of a TRIG entry (16.16): x and y of the heading.
export function headingVector(world, heading) {
  const V = models().view, scale = 2 ** V.fixedBits, h = ((Math.round(heading) % V.turn) + V.turn) % V.turn; // @math 16.16 fixed point
  return [world.trig.getInt32(h * V.trigEntryBytes, true) / scale, world.trig.getInt32(h * V.trigEntryBytes + V.trigEntryBytes / 2, true) / scale]; // @math the second dword is half an entry on
}

// The heading vector at a fractional TRIG entry (Stage 4: the fine heading of a world drawn above 1x, round(h s) / s): the entries at
// floor(h) and the one after it, read as signed words and lerped, never renormalized, as the floor caster lerps its rays (caster.js). At a
// whole heading it is headingVector itself.
export function headingVectorAt(world, heading) {
  if (Number.isInteger(heading)) return headingVector(world, heading);
  const f = Math.floor(heading), t = heading - f, a = headingVector(world, f), b = headingVector(world, f + 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// A world point in the camera's terms: f ahead along the heading, l to the right (view.js's forward and lateral distances, unrounded). A
// fractional heading (Stage 4's fine heading) turns the camera between two TRIG entries (headingVectorAt).
export function toCamera(world, camera, x, y) {
  const [a, b] = headingVectorAt(world, camera.heading), dx = wrap16(x - camera.x), dy = wrap16(y - camera.y);
  return { f: a * dx + b * dy, l: a * dy - b * dx };
}

// The column, the distance and the bottom row of a point of the camera's ground (f ahead, l to the right); null behind the camera.
// `flip` is view.js's sign test of the world row, true whenever the camera's row is above 0 (every track).
export function fromCamera(world, f, l, flip = true) {
  if (f <= 0) return null;
  const V = models().view, div = ((f * V.tan) / 2 ** V.fixedBits) * (flip ? -1 : 1); // @math the tangent is 16.16
  const column = V.center - (l * V.center) / div, root = Math.hypot(f, l);
  const viewWord = world.view.getUint32(Math.min(Math.max(Math.round(column), 0), V.maxColumn) * V.viewBytes, true);
  const distance = viewWord ? (root * viewWord) / 2 ** V.viewShift : root; // @math the VIEW word is a 2.14 fixed-point scale
  return { column, distance, bottom: rowAt(world.rows, distance) };
}

// The point of the camera's ground a screen column and a distance stand for (fromCamera inverted, the VIEW word of the column).
export function cameraPoint(world, column, distance) {
  const V = models().view, r = ((column - V.center) * V.tan) / (V.center * 2 ** V.fixedBits); // @math the lateral over the forward distance at the column
  const viewWord = world.view.getUint32(Math.min(Math.max(Math.round(column), 0), V.maxColumn) * V.viewBytes, true);
  const root = viewWord ? (distance * 2 ** V.viewShift) / viewWord : distance, f = root / Math.hypot(1, r); // @math the VIEW word is a 2.14 fixed-point scale
  return { f, l: r * f };
}

// The projection of view.js's projectPoint without its rounding and culling: the column, the distance and the bottom row of a world point
// for a camera (x and y may hold fractions, the heading is a TRIG entry, or between two above 1x); null behind the camera.
export function projectFine(world, camera, x, y) {
  const { f, l } = toCamera(world, camera, x, y);
  return fromCamera(world, f, l, wrap16(y - camera.y) < wrap16(y)); // the routine's sign test (view.js)
}

// Stage 4's wide view (M8: docs/enhancements.md, Stage 4 as built), the projection with m margin columns a side. Inside the reference fan
// (a point at most te TRIG entries off the heading, te the fan's edge: atan(tan / 2^16) in entries, 159.9992) it is the pinhole above
// (fromCamera, cameraPoint), unrounded. Only with a margin (m > 0) does a point outside the fan continue equiangularly, one column a TRIG
// entry as the floor's rays go (caster.js): column = centre + sigma sign(t) (centre + |t| - te), t = atan2(l, f) in entries and sigma the
// pinhole's own sign (its flip test), so the column is continuous at the fan's edge (both are 0 and 320 there) and is the column the floor
// gives that ray (to te's 8e-4 of an entry). A pinhole would put a point at 40 degrees about 19 columns off its ground. The distance outside
// the fan is root VIEW(u) / 2^viewShift with the VIEW word continued past the table as the floor continues it (caster.js): VIEW[e] cosT(u -
// centre) / cosT(e - centre), e the edge column 0 or 319. At m = 0 these are fromCamera, cameraPoint and projectFine themselves (the pinhole
// everywhere with its VIEW clamp), so nothing of the standard view moves.
const RADIAN = () => models().view.turn / (2 * Math.PI); // @math TRIG entries a radian
let edge = null;
export const fanEdge = () => (edge ??= Math.atan(models().view.tan / 2 ** models().view.fixedBits) * RADIAN()); // @math the tangent is 16.16
// The VIEW word of a reference column outside the table (u < 0 or u > maxColumn), continued from the edge column through the TRIG cosine; a
// word of 0 is a scale of 1.0, as floorDepths and the caster have it.
function viewWordAt(world, u) {
  const V = models().view, e = u < 0 ? 0 : V.maxColumn, word = world.view.getUint32(e * V.viewBytes, true) || 2 ** V.viewShift; // @math the VIEW word is a 2.14 fixed-point scale
  return (word * cosT(world.trig, u - V.center)) / cosT(world.trig, e - V.center);
}
// fromCamera with m margin columns a side.
export function fromCameraAt(world, f, l, flip = true, m = 0) {
  if (m === 0) return fromCamera(world, f, l, flip);
  if (f <= 0) return null;
  const V = models().view, t = Math.atan2(l, f) * RADIAN(), te = fanEdge();
  if (Math.abs(t) <= te) return fromCamera(world, f, l, flip);
  const column = V.center + (flip ? 1 : -1) * Math.sign(t) * (V.center + Math.abs(t) - te), distance = (Math.hypot(f, l) * viewWordAt(world, column)) / 2 ** V.viewShift; // @math the VIEW word is a 2.14 fixed-point scale
  return { column, distance, bottom: rowAt(world.rows, distance) };
}
// cameraPoint with m margin columns a side: the pinhole's inverse inside the fan (columns 0 to 320), the equiangular one outside it.
export function cameraPointAt(world, column, distance, m = 0) {
  const V = models().view;
  if (m === 0 || (column >= 0 && column <= 2 * V.center)) return cameraPoint(world, column, distance); // @math the fan's columns, both edges
  const a = (Math.abs(column - V.center) - V.center + fanEdge()) / RADIAN(), root = (distance * 2 ** V.viewShift) / viewWordAt(world, column); // @math the VIEW word is a 2.14 fixed-point scale
  return { f: root * Math.cos(a), l: Math.sign(column - V.center) * root * Math.sin(a) };
}
// projectFine with m margin columns a side.
export function projectAt(world, camera, x, y, m = 0) {
  if (m === 0) return projectFine(world, camera, x, y);
  const { f, l } = toCamera(world, camera, x, y);
  return fromCameraAt(world, f, l, wrap16(y - camera.y) < wrap16(y), m); // the routine's sign test (view.js)
}
// The lateral over the forward distance of a screen column's ray (cameraPoint's r): the pinhole's inside the fan (columns 0 to 320), the
// equiangular continuation's outside it (the wide view's margins: the water's sun glitter there, water.js sunGlitter).
export function rayRatio(column) {
  const V = models().view;
  if (column >= 0 && column <= 2 * V.center) return ((column - V.center) * V.tan) / (V.center * 2 ** V.fixedBits); // @math the fan's columns, both edges; the tangent is 16.16
  return Math.sign(column - V.center) * Math.tan((Math.abs(column - V.center) - V.center + fanEdge()) / RADIAN());
}

// Screen pixels per world unit at a distance (the lateral scale of the projection; the camera's height makes the vertical one the same).
export function pixelsPerUnit(d) {
  const V = models().view;
  return (V.center * 2 ** V.fixedBits) / (V.tan * Math.max(d, 1)); // @math centre columns over the tangent's run at the distance
}

// The floor's palette index at a world point (the tile lookup of the floor).
export function texelAt(world, x, y) {
  const F = models().floor, xi = roundWord(x), yi = roundWord(y), row = (yi >> F.tileShift) - F.mapOrigin, col = (xi >> F.tileShift) - F.mapOrigin;
  const id = row >= 0 && row < F.mapRows && col >= 0 && col < F.mapColumns ? world.tiles[row * F.mapColumns + col] : 0;
  return world.sheets[Math.floor(id / F.sheetCount)][(id % F.sheetCount) * F.tileBytes + ((yi & F.tileMask) << F.tileShift) + (xi & F.tileMask)];
}

// The 8-bit colour of a palette index of the track (6-bit VGA components widened as rgbaPalette does).
export function paletteColor(world, index) {
  return [0, 1, 2].map(k => { const v = world.palette[index * 3 + k]; return (v << 2) | (v >> 4); }); // @math three components; 6 bits widened to 8 by repeating the top bits
}
