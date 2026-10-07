// The general picture blit of Stage 4 (docs/enhancements.md, Stage 4 as built): scene.js blitLayers (render/sprites.js blitRecord with the
// layers beside the picture) for any geometry G (geometry.js), the pictures at the size of the game's size classes ('classes'). A picture of
// an .INF shape reads its column-major source frame of W0 x H0 bytes (the size of the shape's class 0) through the INF's offsets; the
// picture is separable when it reads one source column per picture column and one row map shared by all its columns, src(i, j) =
// U(i) H0 + V(j), with U(i) = floor(src(i, 0) / H0) and V(j) = src(0, j) mod H0 (and U(w) = W0, V(h) = H0 past the last ones). At scale s the
// output pixel (i s + r, j s + q) of a separable picture reads the source texel (U(i) + floor(r (U(i+1) - U(i)) / s), V(j) + floor(q (V(j+1) -
// V(j)) / s)): at r = q = 0 the INF's own byte (an exact subset of the original picture), between the samples the source texels the INF
// skipped (more of the original's detail, nothing invented; class 0 at s = 2 is a nearest copy at twice the size). A picture that is not
// separable, or that is no picture of the world's shapes, is drawn as s x s blocks of the INF's samples. The maps are kept per picture and
// scale. The blit draws the record's own window of the picture (its columns from firstColumn on, `width` of them, and `height` rows: the
// reference clip) at an output place (by default s times the record's place, m added to its column) and clips per pixel to [0, W) x [0, H);
// at IDENTITY it is blitLayers byte for byte, its layers, footprint, silhouette and relief list included (test/general-paths.test.js,
// scripts/check-enhance.js section 6). Above 1x the scene hands it the whole picture (the window of every column and row) at the record's
// finer place (scene.js placeAt: s times the whole camera's place plus the fine shift rounded to output pixels), and the per-pixel clip makes
// the cuts at the screen's edges; at a whole place that is the reference window's set of pixels s times over.
// In smooth sizes (Stage 4, M7: RENDER.sizes 'smooth') a picture is its whole frame drawn at the size of smoothSize, Wout x Hout output
// pixels, through smoothMap (nearest and symmetric), placed by scene.js placeSmooth; blitAt draws it like any other picture.
import { KIND } from './project.js';
import { SIZES } from './config.js';
import { models } from './models.js';

// The shape of a picture of a world: { shape (its ten pictures), k (its size class), W0, H0 (the class 0 size, the frame's own) }, or null
// for a picture that is none of the world's shapes (the cars', the shots', the pit's and every shape of the world's objects).
const shapeInfo = new WeakMap(), walked = new WeakSet();
export function shapeOf(world, picture) {
  if (world && !walked.has(world)) {
    walked.add(world);
    for (const shape of [world.carShape, world.shotShape, world.pitShape, ...(world.shapes ? world.shapes.values() : [])]) {
      if (!Array.isArray(shape) || !shape.length) continue;
      shape.forEach((p, k) => { if (!shapeInfo.has(p)) shapeInfo.set(p, { shape, k, W0: shape[0].w, H0: shape[0].h }); });
    }
  }
  return shapeInfo.get(picture) ?? null;
}

// The source map of a picture at a scale: { separable, why (when not), cols (per output column of the picture: the source column times H0),
// rows (per output row: the source row), src (the INF's offset of every picture pixel, column-major, for the blocks) }. `info` is shapeOf's
// (a picture's is always the same, or null when no world given so far holds it); the blocks map of a picture asked without its shape is the
// same at every scale and is kept apart (key 0), so such a call never takes the place of the picture's class map once its world is given.
const maps = new WeakMap();
export function classMap(picture, s, info) {
  let byScale = maps.get(picture);
  if (!byScale) { byScale = new Map(); maps.set(picture, byScale); }
  const key = info ? s : 0, known = byScale.get(key);
  if (known) return known;
  const { w, h, deltas } = picture, src = new Int32Array(w * h);
  for (let i = 0; i < w; i++) { let at = i * (h + 1), o = deltas[at++]; for (let j = 0; j < h; j++) { src[i * h + j] = o; o += deltas[at++]; } }
  let why = info ? null : 'no shape of the world';
  const W0 = info?.W0 ?? w, H0 = info?.H0 ?? h, U = new Int32Array(w + 1), V = new Int32Array(h + 1);
  if (!why && h > 0) {
    for (let i = 0; i < w; i++) U[i] = Math.floor(src[i * h] / H0);
    for (let j = 0; j < h; j++) V[j] = ((src[j] % H0) + H0) % H0;
    U[w] = W0; V[h] = H0;
    for (let i = 0; i < w && !why; i++) {
      if (U[i] < 0 || U[i] >= W0) why = `column ${i} reads outside the frame`;
      for (let j = 0; j < h && !why; j++) if (src[i * h + j] !== U[i] * H0 + V[j]) why = `pixel ${i},${j} is off its column's row map`;
    }
  }
  const map = { separable: !why, why, cols: null, rows: null, src, w, h };
  if (!why) {
    map.cols = new Int32Array(w * s); map.rows = new Int32Array(h * s);
    for (let i = 0; i < w; i++) for (let r = 0; r < s; r++) map.cols[i * s + r] = (U[i] + Math.floor((r * (U[i + 1] - U[i])) / s)) * H0;
    for (let j = 0; j < h; j++) for (let q = 0; q < s; q++) map.rows[j * s + q] = V[j] + Math.floor((q * (V[j + 1] - V[j])) / s);
  }
  byScale.set(key, map);
  return map;
}

// The size of a picture of `shape` (its ten pictures, one a size class) at the distance d in smooth sizes (Stage 4, M7): the game's size law
// (view.js projectPoint: the class trunc((d - sizeBase) / sizeStep), clamped to 0..maxSize) made continuous. Each class k stands for the
// middle of its band of distances, d_k = sizeBase + sizeStep (k + 1/2), where the width and the height are the class's own (w_k, h_k);
// between two band middles they go linearly from one class to the next, before the first middle and past the last they stay the first
// class's and the last's. So it is the game's own law, which is not a perspective one (a perspective would make the far things up to 2.6
// times smaller), without its steps; no fitted rate a class is used. { w, h } in reference pixels, with fractions.
export function smoothSize(shape, d) {
  const V = models().view, last = Math.min(V.maxSize, shape.length - 1), x = (d - V.sizeBase) / V.sizeStep - 0.5; // @math the band's middle: x is k at d_k
  if (!(x > 0)) return { w: shape[0].w, h: shape[0].h };
  if (x >= last) return { w: shape[last].w, h: shape[last].h };
  const k = Math.floor(x), t = x - k, a = shape[k], b = shape[k + 1];
  return { w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

// The source map of a frame of W0 x H0 bytes (column-major: a shape's class 0 size) drawn at w x h output pixels in smooth sizes: each output
// pixel (I, J) reads the texel nearest its middle, U = floor((I + 1/2) W0 / w) and V = floor((J + 1/2) H0 / h), nearest and symmetric (the
// same texels counted from either edge; at w = W0 the frame itself). In classMap's form: `cols` per output column the source column times H0,
// `rows` per output row the source row. It depends on the four sizes alone, so the maps are kept by them, the last SIZES.maps used (a least
// recently used list; at a hit the map moves to the end).
const smoothMaps = new Map();
export function smoothMap(W0, H0, w, h) {
  const key = `${W0}x${H0}:${w}x${h}`, known = smoothMaps.get(key);
  if (known) { smoothMaps.delete(key); smoothMaps.set(key, known); return known; }
  const map = { separable: true, why: null, cols: new Int32Array(w), rows: new Int32Array(h), src: null, w, h };
  for (let I = 0; I < w; I++) map.cols[I] = Math.floor(((2 * I + 1) * W0) / (2 * w)) * H0; // @math (I + 1/2) W0 / w in whole numbers
  for (let J = 0; J < h; J++) map.rows[J] = Math.floor(((2 * J + 1) * H0) / (2 * h)); // @math (J + 1/2) H0 / h in whole numbers
  smoothMaps.set(key, map);
  if (smoothMaps.size > SIZES.maps) smoothMaps.delete(smoothMaps.keys().next().value); // the least recently used
  return map;
}
// How many smooth maps are kept (the tests of the list's cap).
export const smoothMapsKept = () => smoothMaps.size;

// The pictures of a world's shapes (the cars', the shots', the pit's and its objects') that are drawn as blocks at a scale, for the checks'
// report: [{ k, w, h, why }]. A drawn picture that is none of them takes blocks too but is not listed here.
export function blockPictures(world, s) {
  const out = [];
  for (const shape of [world.carShape, world.shotShape, world.pitShape, ...(world.shapes ? world.shapes.values() : [])]) {
    if (!Array.isArray(shape)) continue;
    shape.forEach((p, k) => { const map = classMap(p, s, shapeOf(world, p)); if (!map.separable) out.push({ k, w: p.w, h: p.h, why: map.why }); });
  }
  return out;
}

// Draws a draw record into `fb` (G.W x G.H palette indices) and the layers `L` (kind and depth) at the output place `at` ({ x, y }: the top
// left of the record's first drawn column; by default s (left + m), s top), clipped per pixel to the output. `world` finds the picture's shape,
// `collect` (scene.js createCollect) lists every pixel drawn and the source byte it read (for the relief of the picture), `rows` (one flag a
// output row) marks the rows written (the composite's sky-band fast path), `from` is the first output row written (the split screen's viewers,
// whose rows above it are cut away: nothing is written there, the footprint and the silhouette are found as without it, and `collect` still
// lists the picture's pixels there, so that its relief lights the whole picture: relief.js pictureLight reads their indices from the frame by
// their source bytes, since fb is not written there). Returns null for a
// picture with no opaque pixel on the output's columns, else blitLayers' { foot, cols } in output pixels: the footprint of the `band` part of
// the picture's rows above its lowest opaque row and how many rows that row stands above the picture's bottom, and per output column of the
// window its highest and lowest opaque output row (-1 for none). Only the pixels on the output's columns and above its last row count, as
// blitLayers counts the reference window's (which clipPicture keeps on the screen's columns and above its last row, its rows above the top
// included): so an unclipped picture cut per pixel (M6: the records at their finer places) has the footprint and the silhouette of the part
// the screen shows, and at the reference geometry, with the reference window, the result is blitLayers' byte for byte.
// With `sampled` (the shadows of the reference look, which lie on the reference grid) it also returns `sample`: the same for the record's
// reference samples alone (the output pixels s i, s j of its window, at r = q = 0 the INF's own bytes, whatever the place), the footprint's
// columns on the reference grid (the place over s plus the sample's column: a fraction where the place is a fine one) and per picture column
// its highest and lowest opaque picture row, as blitLayers finds them for the 1x picture of the same window.
// A record in smooth sizes (`rec.smooth`: { w, h, map }, scene.js placeSmooth) is its whole frame drawn at w x h output pixels through its
// smooth map, at `at`; its reference samples are the output pixels s i, s j of the picture from its top left (ceil(w / s) x ceil(h / s) of
// them: no INF samples to keep, the picture as the reference grid sees it), with the footprint's lift and band counted in those rows.
export function blitAt(fb, L, rec, band, G, { world = null, collect = null, rows = null, at = null, sampled = false, from = 0 } = {}) {
  const { picture, frame, distance } = rec, { s, W, H } = G, sm = rec.smooth ?? null, map = sm ? sm.map : classMap(picture, s, shapeOf(world, picture));
  const ox = at ? at.x : s * (rec.left + G.m), oy = at ? at.y : s * rec.top, ow = sm ? sm.w : rec.width * s, oh = sm ? sm.h : rec.height * s, hs = sm ? sm.h : picture.h * s, first = sm ? 0 : rec.firstColumn * s, top = Math.max(from, 0);
  const sw = sm ? Math.ceil(sm.w / s) : rec.width, sh = sm ? Math.ceil(sm.h / s) : picture.h; // the sampled columns of the window and rows of the picture
  const rowMin = new Int16Array(hs).fill(W), rowMax = new Int16Array(hs).fill(-1), cols = { top: new Int16Array(ow).fill(-1), bottom: new Int16Array(ow).fill(-1) };
  const sRowMin = sampled ? new Float64Array(sh).fill(Infinity) : null, sRowMax = sampled ? new Float64Array(sh).fill(-Infinity) : null, sCols = sampled ? { top: new Int16Array(sw).fill(-1), bottom: new Int16Array(sw).fill(-1) } : null;
  const { cols: colMap, rows: rowMap, src } = map;
  let low = -1, sLow = -1;
  for (let I = 0; I < ow; I++) {
    const x = ox + I;
    if (x < 0 || x >= W) continue; // off the output's columns: neither drawn nor counted
    const P = first + I, base = colMap ? colMap[P] : Math.floor(P / s) * picture.h, i = sampled && I % s === 0 ? I / s : -1, xr = x / s;
    for (let J = 0; J < oh; J++) {
      const y = oy + J;
      if (y >= H) break; // below the output's last row: the reference cut
      const source = colMap ? base + rowMap[J] : src[base + Math.floor(J / s)], pixel = frame[source];
      if (pixel === 0) continue;
      if (x < rowMin[J]) rowMin[J] = x;
      if (x > rowMax[J]) rowMax[J] = x;
      if (J > low) low = J;
      if (cols.top[I] < 0) cols.top[I] = J;
      cols.bottom[I] = J;
      if (i >= 0 && J % s === 0) { // a reference sample of the window
        const j = J / s;
        if (xr < sRowMin[j]) sRowMin[j] = xr;
        if (xr > sRowMax[j]) sRowMax[j] = xr;
        if (j > sLow) sLow = j;
        if (sCols.top[i] < 0) sCols.top[i] = j;
        sCols.bottom[i] = j;
      }
      if (y >= top) { // on the output (and below the viewer's first row)
        const o = y * W + x;
        fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = distance;
        if (collect) { collect.drawn[collect.count] = o; collect.sources[collect.count++] = source; }
        if (rows) rows[y] = 1;
      } else if (collect && y >= 0) { collect.drawn[collect.count] = y * W + x; collect.sources[collect.count++] = source; } // above a split viewer's first row: listed for the picture's relief alone, which lights the whole picture as the 1x split screen does before its cut
    }
  }
  if (low < 0) return null;
  let minX = W, maxX = -1;
  for (let j = Math.max(low + 1 - Math.max(Math.round(hs * band), 1), 0); j <= low; j++) if (rowMax[j] >= 0) { minX = Math.min(minX, rowMin[j]); maxX = Math.max(maxX, rowMax[j]); }
  const out = { foot: { minX, maxX, lift: hs - 1 - low }, cols };
  if (sampled) {
    let a = Infinity, b = -Infinity;
    for (let j = Math.max(sLow + 1 - Math.max(Math.round(sh * band), 1), 0); j <= sLow; j++) if (sRowMax[j] > -Infinity) { a = Math.min(a, sRowMin[j]); b = Math.max(b, sRowMax[j]); }
    out.sample = sLow < 0 ? null : { foot: { minX: a, maxX: b, lift: sh - 1 - sLow }, cols: sCols };
  }
  return out;
}

// scene.js blitFlatLayers at a geometry: a plain transparent picture (`d.bytes` column-major, `d.width` x `d.height` at the reference place
// d.x, d.y: the effects drawn after the own car, at the 320 x 200 places the state holds, the tyre rows and the pit overlay among them) as
// s x s blocks at s (d.x + m), s d.y, at `distance`; `flat` makes their relief's light 1; nothing above the output row `from` (blitAt's).
export function blitFlatAt(fb, L, d, distance, G, flat = false, rows = null, from = 0) {
  const { s, W, H } = G, ox = s * (d.x + G.m), oy = s * d.y, ow = d.width * s, oh = d.height * s, top = Math.max(from, 0);
  for (let I = 0; I < ow; I++) {
    const x = ox + I, col = Math.floor(I / s) * d.height;
    if (x < 0 || x >= W) continue;
    for (let J = 0; J < oh; J++) {
      const y = oy + J, pixel = d.bytes[col + Math.floor(J / s)];
      if (pixel !== 0 && y >= top && y < H) { const o = y * W + x; fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = distance; if (flat) L.relief[o] = 1; if (rows) rows[y] = 1; }
    }
  }
}
