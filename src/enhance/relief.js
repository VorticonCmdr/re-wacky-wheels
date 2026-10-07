// The relief of the track lighting (docs/enhancements.md, Stage 3; RELIEF in config.js): height maps for the ground's tiles and for the
// pictures, lit by the track's sun. Every map is enhancement art, never something read from the game's files: a map the player made and
// imported in the asset garage (relief-store.js), or one made here from the original pictures (their brightness, the wall surface, the
// pictures' outlines). The ground is lit per floor sample from its texel's slope (project.js drawFloor's relief hook), the pictures per drawn
// pixel from their slope on the screen (scene.js); composite.js multiplies the colours by the light.
import { RELIEF } from './config.js';
import { liquidsOf } from './water.js';
import { headingVector } from './project.js';
import { tileSurfaces } from '../game/surface.js';
import { models } from './models.js';

// The brightness (0 to 1) of every palette index of a world's palette (6-bit components widened to 8; Rec. 601 weights).
const lumaCache = new WeakMap();
export function paletteLuma(world) {
  let t = lumaCache.get(world.palette);
  if (t) return t;
  const c = k => ((k << 2) | (k >> 4)) / 0xff; // @math 6 bits widened to 8, then to 0 to 1
  t = Float32Array.from({ length: 256 }, (_, i) => 0.299 * c(world.palette[i * 3]) + 0.587 * c(world.palette[i * 3 + 1]) + 0.114 * c(world.palette[i * 3 + 2])); // @math the Rec. 601 luma weights; three components an entry
  lumaCache.set(world.palette, t);
  return t;
}

// The ground's relief: per tile id and texel (id x tile bytes + the texel's offset in the tile) its height (0 to 1), its slope across and down
// (gx, gy: the rise in world units over a world unit, central differences) and its occlusion (how much lower it lies than the texels
// RELIEF.reach away diagonally), both taken inside the tile (groundLight takes them across the tile's edges for the texels near them), and
// `flat`: 1 for the generated map's liquids, which lie flat and keep their own light. `authored(member)` gives the player's map of a tile
// sheet ({ id, heights }: its tiles' heights in the floor's tile order, 0 to 255 a texel) or null; a sheet without one gets the generated map:
// the texel's brightness times RELIEF.detail, plus RELIEF.wall on the wall surface, liquids at RELIEF.liquid. Made once per track and set
// of maps (the sun is applied per sample, so it may change freely); a track keeps only its latest.
const groundCache = new WeakMap();
export function groundRelief(world, authored = null) {
  const F = models().floor, names = world.gam.tilesets.map(n => `${F.gamPrefix}${n}`.toUpperCase()), maps = names.map(n => authored?.(n) ?? null), key = maps.map(m => (m ? m.id : '-')).join('|');
  const kept = groundCache.get(world.tiles);
  if (kept?.key === key) return kept.out;
  const wall = models().special.wall, luma = paletteLuma(world), liquid = liquidsOf(world), pairs = tileSurfaces(world), ids = world.sin.length, T = F.tileBytes, S = F.sheetSize;
  const height = new Float32Array(ids * T), gx = new Float32Array(ids * T), gy = new Float32Array(ids * T), occlusion = new Float32Array(ids * T), flat = new Uint8Array(ids * T);
  for (let id = 0; id < ids; id++) {
    const sheet = Math.floor(id / F.sheetCount), base = (id % F.sheetCount) * T, map = maps[sheet], pixels = world.sheets[sheet], mask = world.maskSheets[sheet];
    for (let t = 0; t < T; t++) {
      const at = id * T + t;
      if (map) height[at] = map.heights[base + t] / 0xff; // @math 0 to 255 to 0 to 1
      else if (liquid.any && liquid.texels[at]) { height[at] = RELIEF.liquid; flat[at] = 1; }
      else height[at] = Math.min(luma[pixels[base + t]] * RELIEF.detail + (pairs[id][mask[base + t] === 0 ? 0 : 1] === wall ? RELIEF.wall : 0), 1);
    }
    const h = (x, y) => height[id * T + Math.min(Math.max(y, 0), S - 1) * S + Math.min(Math.max(x, 0), S - 1)], r = RELIEF.reach, depth = RELIEF.depth; // clamped to the tile
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const at = id * T + y * S + x, span = (x > 0 && x < S - 1 ? 2 : 1), down = (y > 0 && y < S - 1 ? 2 : 1); // @math a central difference spans two texels, a one-sided one
      if (flat[at]) continue;
      gx[at] = ((h(x + 1, y) - h(x - 1, y)) * depth) / span; gy[at] = ((h(x, y + 1) - h(x, y - 1)) * depth) / down;
      occlusion[at] = Math.max((h(x + r, y + r) + h(x - r, y + r) + h(x + r, y - r) + h(x - r, y - r)) / 4 - height[at], 0); // @math the four diagonal neighbours
    }
  }
  const out = { height, gx, gy, occlusion, flat };
  groundCache.set(world.tiles, { key, out });
  return out;
}

// The sun as a unit vector toward it in the world's axes (x, y as the map's, z up): `angle` a part of a turn (the shadows fall along its
// heading), `length` the shadow of a unit height (SUN.length or the track's own sun height).
export function sunVector(world, angle, length) {
  const [dx, dy] = headingVector(world, Math.round(angle * models().view.turn)), up = 1 / Math.hypot(1, length), across = length / Math.hypot(1, length); // the elevation's sine and cosine from its cotangent
  return [-dx * across, -dy * across, up];
}

// The ground's light for drawFloor's relief hook: light(at, x, y) of a tile texel (at: id x tile bytes + its offset; x, y: the world texel),
// from its slope and occlusion (groundRelief) under the sun (`sun` from sunVector): ambient and diffuse light against a flat ground's, mixed in
// by `strength`. A texel within RELIEF.reach of its tile's edge takes them from the heights around it through the map, so an edge between two
// tiles (a wall that ends where its tile does) has its slope as well; the generated map's liquids keep their light.
// With `table` (the floor above 1x, where a texel covers several output pixels and the hook runs for nearly every one) the light comes from
// tables kept per map, sun and strength: an interior texel's depends on its tile texel alone and is made for all of them at once; a texel near
// a tile's edge depends on its place on the map (its neighbours across the edge), so the map's cells keep theirs, each computed the first time
// it is drawn; the padding around the map is computed on the spot. The layer the light goes into is a Float32 one, so the value it stores is
// the one computed on the spot.
const lightTables = new WeakMap();
export function groundLight(world, ground, { sun, strength }, table = false) {
  const F = models().floor, T = F.tileBytes, tiles = world.tiles, { height, gx, gy, occlusion, flat } = ground, ambient = RELIEF.ambient, lit0 = ambient + (1 - ambient) * Math.max(sun[2], 0), [low, high] = RELIEF.range, k = RELIEF.occlusion, [sx, sy, sz] = sun; // @math the sun's third component is its height
  const r = RELIEF.reach, ring = Math.max(r, 1), last = F.tileMask - ring, depth = RELIEF.depth / 2; // @math the central difference spans two texels
  const h = (x, y) => {
    x &= 0xffff; y &= 0xffff; // @math world words are 16 bits
    const row = (y >> F.tileShift) - F.mapOrigin, col = (x >> F.tileShift) - F.mapOrigin, id = row >= 0 && row < F.mapRows && col >= 0 && col < F.mapColumns ? tiles[row * F.mapColumns + col] : 0; // the padding of the map is tile 0, as drawFloor has it
    return height[id * T + ((y & F.tileMask) << F.tileShift) + (x & F.tileMask)];
  };
  if (!table) {
    return (at, x, y) => {
      if (flat[at]) return 1;
      const tx = x & F.tileMask, ty = y & F.tileMask;
      let a, b, o;
      if (tx >= ring && tx <= last && ty >= ring && ty <= last) { a = gx[at]; b = gy[at]; o = occlusion[at]; }
      else { a = (h(x + 1, y) - h(x - 1, y)) * depth; b = (h(x, y + 1) - h(x, y - 1)) * depth; o = Math.max((h(x + r, y + r) + h(x - r, y + r) + h(x + r, y - r) + h(x - r, y - r)) / 4 - height[at], 0); } // @math the four diagonal neighbours
      const lit = (ambient + (1 - ambient) * Math.max((sz - a * sx - b * sy) / Math.sqrt(a * a + b * b + 1), 0)) / lit0; // the normal (-gx, -gy, 1) against the sun, against a flat ground's
      return Math.min(Math.max(1 + strength * (lit * (1 - k * o) - 1), low), high);
    };
  }
  // The same light, its interior texels from the table (shade and edge are the expressions above).
  const shade = (a, b, o) => {
    const lit = (ambient + (1 - ambient) * Math.max((sz - a * sx - b * sy) / Math.sqrt(a * a + b * b + 1), 0)) / lit0; // the normal (-gx, -gy, 1) against the sun, against a flat ground's
    return Math.min(Math.max(1 + strength * (lit * (1 - k * o) - 1), low), high);
  };
  const inside = (tx, ty) => tx >= ring && tx <= last && ty >= ring && ty <= last;
  const edge = (at, x, y) => shade((h(x + 1, y) - h(x - 1, y)) * depth, (h(x, y + 1) - h(x, y - 1)) * depth, Math.max((h(x + r, y + r) + h(x - r, y + r) + h(x + r, y - r) + h(x - r, y - r)) / 4 - height[at], 0)); // @math the four diagonal neighbours
  let byKey = lightTables.get(ground);
  if (!byKey) { byKey = new Map(); lightTables.set(ground, byKey); }
  const key = `${sun.join(',')}:${strength}`;
  let kept = byKey.get(key);
  if (!kept) {
    byKey.clear(); // a ground keeps only the tables of its latest sun and strength
    const lights = new Float32Array(height.length), slot = new Int16Array(T).fill(-1);
    let slots = 0;
    for (let t = 0; t < T; t++) if (!inside(t & F.tileMask, t >> F.tileShift)) slot[t] = slots++; // the edge texels of a tile, numbered
    for (let at = 0; at < height.length; at++) { const texel = at % T; lights[at] = flat[at] ? 1 : inside(texel & F.tileMask, texel >> F.tileShift) ? shade(gx[at], gy[at], occlusion[at]) : 0; }
    kept = { lights, slot, slots, edges: new Float32Array(F.mapRows * F.mapColumns * slots).fill(NaN) }; // NaN: not drawn yet
    byKey.set(key, kept);
  }
  const { lights, slot, slots, edges } = kept;
  return (at, x, y) => {
    const tx = x & F.tileMask, ty = y & F.tileMask;
    if (flat[at] || inside(tx, ty)) return lights[at];
    const row = (y >> F.tileShift) - F.mapOrigin, col = (x >> F.tileShift) - F.mapOrigin;
    if (row < 0 || row >= F.mapRows || col < 0 || col >= F.mapColumns) return edge(at, x, y);
    const e = (row * F.mapColumns + col) * slots + slot[(ty << F.tileShift) + tx];
    if (edges[e] !== edges[e]) edges[e] = edge(at, x, y); // NaN until computed
    return edges[e];
  };
}

// The sun in a picture's terms on the screen (x to the right, y down, z toward the viewer) for the shadows' direction in the camera's terms
// (shadows.js sunDirection: f ahead, l to the right) and the sun's height as in sunVector.
export function screenSun(direction, length) {
  const up = 1 / Math.hypot(1, length), across = length / Math.hypot(1, length);
  return [-direction.l * across, -up, direction.f * across]; // toward the sun: against the shadows, up, and toward the viewer as far as the shadows fall away from it
}

// The light of the pixels one picture drew: `drawn` its screen offsets (`count` of them, `sources` the source byte each was read from, or
// null), `fb` the screen's indices, `heights(source)` the player's map of the picture's frame (0 to 255 by source byte) or null. The
// heights are the map's, else a rounded body by the distance to the picture's edge mixed with the pixel's brightness (RELIEF.spriteDetail of
// it); the light is how far each pixel's slope leans toward the sun (`sun` from screenSun) against a flat picture's. Where the picture runs
// off the screen its cut edge is not an edge: the body goes on past it. Writes RELIEF's light into `out`. `scale` is the geometry's (Stage 4:
// the picture drawn at s output pixels a reference pixel, `width` the output's; HD.look 'reference'): above 1x the picture is lit on the
// reference grid (pictureLightAt below), so at its reference samples the light is the 1x picture's. `frame` (above 1x: the picture's source
// frame, which `sources` index) gives the pixels' indices instead of fb, for pixels listed where nothing was written (blit.js blitAt's `from`).
const scratch = { size: 0, mask: null, dist: null, height: null };
export function pictureLight(out, { drawn, sources, count, fb, width, luma, sun, strength, heights = null, scale = 1, frame = null }) {
  if (!count) return;
  if (scale > 1) { pictureLightAt(out, { drawn, sources, count, fb, width, luma, sun, strength, heights, scale, frame }); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let n = 0; n < count; n++) { const o = drawn[n], x = o % width, y = (o - x) / width; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = x1 - x0 + 3, bh = y1 - y0 + 3, size = bw * bh; // @math a border of one pixel around the box: outside the picture
  if (scratch.size < size) { scratch.size = size; scratch.mask = new Uint8Array(size); scratch.dist = new Float32Array(size); scratch.height = new Float32Array(size); }
  const { mask, dist, height } = scratch, at = o => { const x = o % width; return ((o - x) / width - y0 + 1) * bw + (x - x0 + 1); }; // @math into the box, past its border
  mask.fill(0, 0, size); height.fill(0, 0, size);
  for (let n = 0; n < count; n++) mask[at(drawn[n])] = 1;
  const R = RELIEF.round, rows = fb.length / width, open = [x0 === 0, x1 === width - 1, y0 === 0, y1 === rows - 1]; // the sides cut by the screen: left, right, top, bottom
  for (let i = 0; i < size; i++) dist[i] = mask[i] ? R : 0;
  const across = (fn) => { // each border cell of a cut side with the picture's cell inside it: fn(border, inside)
    if (open[0]) for (let y = 1; y < bh - 1; y++) fn(y * bw, y * bw + 1);
    if (open[1]) for (let y = 1; y < bh - 1; y++) fn(y * bw + bw - 1, y * bw + bw - 2); // @math the last column and the one before it
    if (open[2]) for (let x = 1; x < bw - 1; x++) fn(x, bw + x); // @math the first row of the box, the third side
    if (open[3]) for (let x = 1; x < bw - 1; x++) fn((bh - 1) * bw + x, (bh - 2) * bw + x); // @math the last row and the one before it
  };
  across((border, inside) => { if (mask[inside]) dist[border] = R; });
  for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) { const i = y * bw + x; if (mask[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - bw] + 1); } // the distance to the edge, down and right
  for (let y = bh - 2; y > 0; y--) for (let x = bw - 2; x > 0; x--) { const i = y * bw + x; if (mask[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + bw] + 1); } // @math then up and left, inside the border
  for (let n = 0; n < count; n++) {
    const o = drawn[n], i = at(o), mapped = heights && sources ? heights(sources[n]) : null;
    if (mapped !== null && mapped !== undefined) { height[i] = mapped / 0xff; continue; } // @math 0 to 255 to 0 to 1
    const t = Math.min(dist[i] / R, 1);
    height[i] = (1 - (1 - t) * (1 - t)) * (1 - RELIEF.spriteDetail) + luma[fb[o]] * RELIEF.spriteDetail; // @math eased toward the middle
  }
  across((border, inside) => { if (mask[inside]) height[border] = height[inside]; }); // no step down at a cut edge
  const depth = RELIEF.spriteDepth / 2, [low, high] = RELIEF.range; // @math the central difference spans two pixels
  for (let n = 0; n < count; n++) {
    const i = at(drawn[n]), gx = (height[i + 1] - height[i - 1]) * depth, gy = (height[i + bw] - height[i - bw]) * depth, len = Math.sqrt(gx * gx + gy * gy + 1);
    const lean = (-gx * sun[0] - gy * sun[1] + sun[2]) / len - sun[2]; // @math the normal (-gx, -gy, 1) against the sun, less a flat picture's
    out[drawn[n]] = Math.min(Math.max(1 + strength * RELIEF.spriteGain * lean, low), high);
  }
}

// A picture drawn at s output pixels a reference pixel (`width` the output's, a whole s times the reference grid's), lit on the reference grid:
// its reference samples (the pixels it drew at a cell's top-left output pixel, s x and s y: the INF's own bytes where blit.js's class maps
// draw it at s times its place) are lit as pictureLight lights a 1x picture, by their palette indices and source bytes, and every pixel it drew
// takes its cell's light. So the light at the samples is the 1x light, and the other pixels of a cell share it, as the ground's pixels share
// their texel's. A pixel whose cell's sample the picture leaves transparent (a texel between the INF's samples that a class map reads) takes
// the light of the drawn sample to its left, right, above or below, the first found, else none (1). A split viewer's picture lists its pixels
// above the viewer's first row too (blitAt's `from`), where fb holds the last frame's: their indices are read from `frame` by their source bytes
// (the same as fb's where the blit wrote), so the whole picture is lit as the 1x split screen lights it before its cut, with no rim at that row.
const grid = { size: 0, drawn: null, sources: null, fb: null, light: null, on: null };
function pictureLightAt(out, { drawn, sources, count, fb, width, luma, sun, strength, heights, scale: s, frame }) {
  const rw = width / s, rh = fb.length / width / s, size = rw * rh;
  if (grid.size < size) { grid.size = size; grid.drawn = new Int32Array(size); grid.sources = new Int32Array(size); grid.fb = new Uint8Array(size); grid.light = new Float32Array(size); grid.on = new Uint8Array(size); }
  const { light, on } = grid;
  let k = 0;
  for (let n = 0; n < count; n++) {
    const o = drawn[n], x = o % width, y = (o - x) / width;
    if (x % s || y % s) continue;
    const r = (y / s) * rw + x / s;
    grid.drawn[k] = r; if (sources) grid.sources[k] = sources[n]; grid.fb[r] = frame && sources ? frame[sources[n]] : fb[o]; on[r] = 1; k++;
  }
  pictureLight(light, { drawn: grid.drawn, sources: sources ? grid.sources : null, count: k, fb: grid.fb.subarray(0, size), width: rw, luma, sun, strength, heights });
  for (let n = 0; n < count; n++) {
    const o = drawn[n], x = o % width, y = (o - x) / width, cx = Math.floor(x / s), cy = Math.floor(y / s), r = cy * rw + cx;
    out[o] = on[r] ? light[r] : cx > 0 && on[r - 1] ? light[r - 1] : cx < rw - 1 && on[r + 1] ? light[r + 1] : cy > 0 && on[r - rw] ? light[r - rw] : cy < rh - 1 && on[r + rw] ? light[r + rw] : 1;
  }
  for (let j = 0; j < k; j++) on[grid.drawn[j]] = 0;
}

// ---- The asset garage's part: the generated maps as images the player can paint over, and a lit preview of a map.

// A tile sheet's generated heights (0 to 255, in the floor's tile order) from a track that uses it (`sheet` its first or second tile sheet):
// the map the race uses for it.
export function tileSheetHeights(world, sheet) {
  const F = models().floor, T = F.tileBytes, { height } = groundRelief(world), out = new Uint8Array(F.sheetCount * T);
  for (let t = 0; t < out.length; t++) out[t] = Math.round(Math.min(Math.max(height[sheet * F.sheetCount * T + t], 0), 1) * 0xff); // @math 0 to 1 to 0 to 255
  return out;
}

// Tile-order heights to the sheet's picture (`width` x `height`, the tiles in rows of the sheet's columns, as the game's sheets lie) and back.
export function tilesToSheet(tiles, width, height) {
  const F = models().floor, S = F.sheetSize, out = new Uint8Array(width * height);
  for (let k = 0; k < F.sheetCount; k++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) out[(Math.floor(k / F.sheetColumns) * S + y) * width + (k % F.sheetColumns) * S + x] = tiles[k * F.tileBytes + y * S + x];
  return out;
}
export function sheetToTiles(picture, width) {
  const F = models().floor, S = F.sheetSize, out = new Uint8Array(F.sheetCount * F.tileBytes);
  for (let k = 0; k < F.sheetCount; k++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) out[k * F.tileBytes + y * S + x] = picture[(Math.floor(k / F.sheetColumns) * S + y) * width + (k % F.sheetColumns) * S + x];
  return out;
}

// A sprite sheet's generated heights (0 to 255) for `frames` frames of `width` x `height` from `offset` bytes into `bytes`, each frame in the
// order of its own bytes (`columnMajor` as the frames lie): the rounded body by the distance to the frame's edge plus the brightness, as the
// race makes them for a picture drawn at its full size.
export function pictureHeights(bytes, { width, height, offset = 0, frames, columnMajor = true }, luma) {
  const size = width * height, out = new Uint8Array(frames * size), R = RELIEF.round, dist = new Float32Array((width + 2) * (height + 2)), bw = width + 2; // @math a border of one pixel
  const byteOf = (x, y) => (columnMajor ? x * height + y : y * width + x);
  for (let f = 0; f < frames; f++) {
    const base = offset + f * size;
    dist.fill(0);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[base + byteOf(x, y)] !== 0) dist[(y + 1) * bw + x + 1] = R;
    for (let y = 1; y <= height; y++) for (let x = 1; x <= width; x++) { const i = y * bw + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - bw] + 1); }
    for (let y = height; y >= 1; y--) for (let x = width; x >= 1; x--) { const i = y * bw + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + bw] + 1); }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const b = byteOf(x, y), pixel = bytes[base + b], t = Math.min(dist[(y + 1) * bw + x + 1] / R, 1);
      out[f * size + b] = pixel === 0 ? 0 : Math.round(((1 - (1 - t) * (1 - t)) * (1 - RELIEF.spriteDetail) + luma[pixel] * RELIEF.spriteDetail) * 0xff); // @math eased toward the middle; 0 to 1 to 0 to 255
    }
  }
  return out;
}

// A picture (RGBA, `width` x `height`) lit by its heights (0 to 255, row by row) from a light high in the upper left, for the garage's preview;
// `depth` how deep a height of 255 is against a pixel's width.
export function shadeByHeights(rgba, heights, width, height, depth) {
  const out = new Uint8ClampedArray(rgba), at = (x, y) => heights[Math.min(Math.max(y, 0), height - 1) * width + Math.min(Math.max(x, 0), width - 1)] / 0xff; // @math 0 to 255 to 0 to 1
  const light = [-0.5, -0.5, Math.SQRT1_2]; // @math from the upper left, 45 degrees up
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const gx = ((at(x + 1, y) - at(x - 1, y)) * depth) / 2, gy = ((at(x, y + 1) - at(x, y - 1)) * depth) / 2, len = Math.sqrt(gx * gx + gy * gy + 1); // @math central differences
    const f = Math.max((-gx * light[0] - gy * light[1] + light[2]) / len, 0) / light[2], o = (y * width + x) * 4; // @math against a flat surface's; four bytes a colour
    for (let k = 0; k < 3; k++) out[o + k] = rgba[o + k] * (RELIEF.ambient + (1 - RELIEF.ambient) * f); // @math the three components
  }
  return out;
}
