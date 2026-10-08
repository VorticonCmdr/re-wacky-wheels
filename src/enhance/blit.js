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
import { frameCell } from './pack-format.js';
import { lumaOf } from './art.js';

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
export function blitAt(fb, L, rec, band, G, { world = null, collect = null, rows = null, at = null, sampled = false, from = 0, art = null, luma = null } = {}) {
  if (art) return blitArt(fb, L, rec, band, G, { world, collect, rows, at, sampled, from, art, luma });
  const { picture, frame, distance } = rec, { s, W, H } = G, sm = rec.smooth ?? null, map = sm ? sm.map : classMap(picture, s, shapeOf(world, picture)), direct = L.art?.direct ?? null; // `direct`: the art layers' flags (art.js), cleared where an indexed picture covers an RGBA one
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
        if (direct !== null) direct[o] = 0;
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
// `art` (art.js provider.frame's { art, k }: a pack's picture of these bytes) draws the pack's picture instead (blitFlatArt).
export function blitFlatAt(fb, L, d, distance, G, flat = false, rows = null, from = 0, art = null) {
  if (art) { blitFlatArt(fb, L, d, distance, G, flat, rows, from, art); return; }
  const { s, W, H } = G, ox = s * (d.x + G.m), oy = s * d.y, ow = d.width * s, oh = d.height * s, top = Math.max(from, 0), direct = L.art?.direct ?? null;
  for (let I = 0; I < ow; I++) {
    const x = ox + I, col = Math.floor(I / s) * d.height;
    if (x < 0 || x >= W) continue;
    for (let J = 0; J < oh; J++) {
      const y = oy + J, pixel = d.bytes[col + Math.floor(J / s)];
      if (pixel !== 0 && y >= top && y < H) { const o = y * W + x; fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = distance; if (flat) L.relief[o] = 1; if (rows) rows[y] = 1; if (direct !== null) direct[o] = 0; }
    }
  }
}

// ---- The artwork packs' pictures (Stage 4: docs/artpacks.md; art.js holds them). A pack's frame replaces a picture by its bytes: the logical
// box of the frame (the archive frame's w x h, p x p pack pixels an original pixel) is drawn where the archive's picture is, at its size class or
// smooth size and place, and the cell around the box (art overhanging it) around that. Sampling is nearest: an output pixel inside the box reads
// the pack pixel under its middle's continuous place in the frame, kept inside the p x p pack pixels of the archive texel the archive's picture
// reads there (the class map's, or the smooth map's), so at p = 1 every pixel is the pack's pixel of the archive's own texel (an identity pack
// draws the archive's picture exactly); between the samples (above 1x) and at p > 1 the place picks the pack's finer pixels. Outside the box
// (the overhang) the place goes on linearly at the picture's mean scale.
// What a pack pixel writes: an indexed pack its index (index 0 and the indices its tRNS makes transparent are not drawn); an RGBA pack (alpha 0 is
// not drawn) its colour into the art layers (L.art: px, direct, beneath), the index of the archive's own pixel kept in fb where the archive's
// picture is opaque there and the index beneath elsewhere (so the page's 320 x 200 index is the archive's wherever the pack and the archive
// pictures coincide), `beneath` the index the pixel had before (partial alpha blends over its colour). Every drawn pixel is the sprite's kind and
// the record's distance (the fog, the relief, the shadows and the grade apply), and the relief's list gets the pixel's logical source byte (the
// player's height maps apply by byte; -1 outside the box) and its brightness (collect.lumas: paletteLuma's for an index, art.js lumaOf for a
// colour). The footprint and the silhouette are the pack's opaque pixels inside the logical box's window (the shadows follow the pack's picture;
// art overhanging the box casts none beyond it).

// The pack pixel column (box-relative, in pack pixels) of each output column of a picture `ow` output pixels wide from its left edge, the
// overhang columns `over` either side included (index I + over), the archive texel column `tex` of each (-1 in the overhang).
function packAxis(n, over, p, place, texel) {
  const pack = new Int32Array(n + 2 * over), tex = new Int32Array(n + 2 * over); // @math the overhang on either side
  for (let I = -over; I < n + over; I++) {
    const k = I + over, inside = I >= 0 && I < n, u = place(I), T = inside ? texel(I) : -1;
    let c = Math.floor(u * p);
    if (inside) c = Math.min(Math.max(c, T * p), T * p + p - 1); // inside the archive texel's pack pixels
    pack[k] = c; tex[k] = T;
  }
  return { pack, tex };
}

function blitArt(fb, L, rec, band, G, { world = null, collect = null, rows = null, at = null, sampled = false, from = 0, art: hit, luma = null }) {
  const { picture, frame, distance } = rec, { s, W, H } = G, sm = rec.smooth ?? null, info = shapeOf(world, picture), map = sm ? sm.map : classMap(picture, s, info);
  const { art, k } = hit, e = art.entry, p = art.p, cell = frameCell(e, k), A = L.art, W0 = info?.W0 ?? e.width, H0 = info?.H0 ?? e.height;
  const owFull = sm ? sm.w : picture.w * s, ohFull = sm ? sm.h : picture.h * s, first = sm ? 0 : rec.firstColumn * s, ow = sm ? sm.w : rec.width * s, oh = sm ? sm.h : rec.height * s;
  const ox = (at ? at.x : s * (rec.left + G.m)) - first, oy = at ? at.y : s * rec.top, top = Math.max(from, 0); // the full picture's top left
  const kx = owFull / (W0 * p), ky = ohFull / (H0 * p), overL = Math.ceil(e.box[0] * kx), overR = Math.ceil((e.cell[0] - e.box[0] - W0 * p) * kx), overT = Math.ceil(e.box[1] * ky), overB = Math.ceil((e.cell[1] - e.box[1] - H0 * p) * ky);
  const over = Math.max(overL, overR), overY = Math.max(overT, overB), sep = map.separable, ms = sm ? 1 : s; // the overhang either side; the class map's columns a picture column
  // The continuous place and the archive texel of each output column and row (classes: U(i) + (r + 1/2)(U(i+1) - U(i)) / s inside the texel
  // the class map reads; smooth: (I + 1/2) W0 / w; the blocks: the texel's middle).
  const U = i => (i < picture.w ? map.cols[i * ms] / H0 : W0), V = j => (j < picture.h ? map.rows[j * ms] : H0);
  const colPlace = I => (I < 0 || I >= owFull ? ((I + 0.5) * W0) / owFull : sm ? ((I + 0.5) * W0) / owFull : sep ? U(Math.floor(I / s)) + ((I % s) + 0.5) * (U(Math.floor(I / s) + 1) - U(Math.floor(I / s))) / s : Math.floor(I / s) + ((I % s) + 0.5) / s); // @math the output pixel's middle
  const rowPlace = J => (J < 0 || J >= ohFull ? ((J + 0.5) * H0) / ohFull : sm ? ((J + 0.5) * H0) / ohFull : sep ? V(Math.floor(J / s)) + ((J % s) + 0.5) * (V(Math.floor(J / s) + 1) - V(Math.floor(J / s))) / s : Math.floor(J / s) + ((J % s) + 0.5) / s); // @math the output pixel's middle
  const cols = packAxis(owFull, over, p, colPlace, I => (sep || sm ? map.cols[I] / H0 : Math.floor(I / s))), rowsOf = packAxis(ohFull, overY, p, rowPlace, J => (sep || sm ? map.rows[J] : Math.floor(J / s))); // (the blocks' texels are found per pixel below)
  const hs = ohFull, rowMin = new Int16Array(hs).fill(W), rowMax = new Int16Array(hs).fill(-1), silhouette = { top: new Int16Array(ow).fill(-1), bottom: new Int16Array(ow).fill(-1) };
  const sw = sm ? Math.ceil(sm.w / s) : rec.width, sh = sm ? Math.ceil(sm.h / s) : picture.h;
  const sRowMin = sampled ? new Float64Array(sh).fill(Infinity) : null, sRowMax = sampled ? new Float64Array(sh).fill(-Infinity) : null, sCols = sampled ? { top: new Int16Array(sw).fill(-1), bottom: new Int16Array(sw).fill(-1) } : null;
  const rgba = art.rgba, px = art.px, ix = art.ix, clear = art.clear;
  let low = -1, sLow = -1;
  // Only the columns on the output, and the rows that can do anything: the overhang's rows above the output's first row draw nothing (the box's
  // own rows there still count for the footprint and the silhouette), the rows below its last row are the reference cut. A pack's cell may
  // overhang its box by far more than the screen: the loops never visit what cannot land on it.
  const I0 = Math.max(-over, -ox), I1 = Math.min(owFull + over, W - ox), J0 = Math.max(-overY, Math.min(0, -oy)), J1 = Math.min(ohFull + overY, H - oy);
  for (let I = I0; I < I1; I++) {
    const x = ox + I, ci = I + over, pc = cols.pack[ci] + e.box[0];
    if (pc < 0 || pc >= e.cell[0]) continue; // outside the cell
    const inWindow = I >= first && I < first + ow, wi = I - first, si = sampled && inWindow && wi % s === 0 ? wi / s : -1, xr = x / s, T = cols.tex[ci];
    for (let J = J0; J < J1; J++) {
      const y = oy + J;
      const ri = J + overY, R = rowsOf.tex[ri], inside = T >= 0 && R >= 0, source = inside ? (sep || sm ? map.cols[I] + map.rows[J] : map.src[Math.floor(I / s) * picture.h + Math.floor(J / s)]) : -1;
      let qc = pc, pr = rowsOf.pack[ri] + e.box[1];
      if (inside && !sep && !sm) { const tx = Math.floor(source / H0), ty = source - tx * H0; qc = tx * p + Math.floor((((I % s) + 0.5) * p) / s) + e.box[0]; pr = ty * p + Math.floor((((J % s) + 0.5) * p) / s) + e.box[1]; } // @math the blocks: the INF sample's texel, the output pixel's middle inside it
      if (pr < 0 || pr >= e.cell[1]) continue;
      const i = (cell.y + pr) * art.width + cell.x + qc;
      let v = -1, a = 0;
      if (ix !== null) { v = ix[i]; if (clear[v]) continue; } else { a = rgba[i * 4 + 3]; if (a === 0) continue; } // @math four bytes a colour, the alpha last
      const pixel = source >= 0 ? frame[source] : 0;
      if (inWindow && J >= 0 && J < oh) { // the window's footprint and silhouette, of the pack's opaque pixels
        if (x < rowMin[J]) rowMin[J] = x;
        if (x > rowMax[J]) rowMax[J] = x;
        if (J > low) low = J;
        if (silhouette.top[wi] < 0) silhouette.top[wi] = J;
        silhouette.bottom[wi] = J;
        if (si >= 0 && J % s === 0) { const j = J / s; if (xr < sRowMin[j]) sRowMin[j] = xr; if (xr > sRowMax[j]) sRowMax[j] = xr; if (j > sLow) sLow = j; if (sCols.top[si] < 0) sCols.top[si] = j; sCols.bottom[si] = j; }
      }
      const lumaValue = v >= 0 ? (luma ? luma[v] : 0) : lumaOf(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]); // @math four bytes a colour, the three components
      if (y >= top) {
        const o = y * W + x;
        if (v >= 0) { fb[o] = v; A.direct[o] = 0; }
        else { A.beneath[o] = fb[o]; if (pixel !== 0) fb[o] = pixel; A.px[o] = px[i]; A.direct[o] = 1; }
        L.kind[o] = KIND.sprite; L.depth[o] = distance;
        if (collect) { collect.drawn[collect.count] = o; collect.sources[collect.count] = source; collect.lumas[collect.count++] = lumaValue; }
        if (rows) rows[y] = 1;
      } else if (collect && y >= 0) { collect.drawn[collect.count] = y * W + x; collect.sources[collect.count] = source; collect.lumas[collect.count++] = lumaValue; } // above a split viewer's first row: for the picture's relief alone (blitAt)
    }
  }
  if (collect) collect.art = true;
  if (low < 0) return null;
  let minX = W, maxX = -1;
  for (let j = Math.max(low + 1 - Math.max(Math.round(hs * band), 1), 0); j <= low; j++) if (rowMax[j] >= 0) { minX = Math.min(minX, rowMin[j]); maxX = Math.max(maxX, rowMax[j]); }
  const out = { foot: { minX, maxX, lift: hs - 1 - low }, cols: silhouette };
  if (sampled) {
    let a = Infinity, b = -Infinity;
    for (let j = Math.max(sLow + 1 - Math.max(Math.round(sh * band), 1), 0); j <= sLow; j++) if (sRowMax[j] > -Infinity) { a = Math.min(a, sRowMin[j]); b = Math.max(b, sRowMax[j]); }
    out.sample = sLow < 0 ? null : { foot: { minX: a, maxX: b, lift: sh - 1 - sLow }, cols: sCols };
  }
  return out;
}

// blitFlatAt with a pack's picture of the bytes (`hit`: { art, k }): the frame's logical box as s x s blocks of the original's pixels at the
// effect's place, each output pixel the pack pixel under its middle inside its original pixel's p x p (the overhang around the box at s / p
// output pixels a pack pixel); written as blitArt writes (no relief list: an effect's light is 1 with `flat`).
function blitFlatArt(fb, L, d, distance, G, flat, rows, from, hit) {
  const { s, W, H } = G, { art, k } = hit, e = art.entry, p = art.p, cell = frameCell(e, k), A = L.art, top = Math.max(from, 0);
  const ox = s * (d.x + G.m), oy = s * d.y, ow = d.width * s, oh = d.height * s, kx = s / p;
  const overL = Math.ceil(e.box[0] * kx), overR = Math.ceil((e.cell[0] - e.box[0] - d.width * p) * kx), overT = Math.ceil(e.box[1] * kx), overB = Math.ceil((e.cell[1] - e.box[1] - d.height * p) * kx);
  const cols = packAxis(ow, Math.max(overL, overR), p, I => (I + 0.5) / s, I => Math.floor(I / s)), over = Math.max(overL, overR), overY = Math.max(overT, overB), rowsOf = packAxis(oh, overY, p, J => (J + 0.5) / s, J => Math.floor(J / s)); // @math the output pixel's middle
  for (let I = -over; I < ow + over; I++) {
    const x = ox + I, ci = I + over, pc = cols.pack[ci] + e.box[0], T = cols.tex[ci];
    if (x < 0 || x >= W || pc < 0 || pc >= e.cell[0]) continue;
    for (let J = -overY; J < oh + overY; J++) {
      const y = oy + J, ri = J + overY, pr = rowsOf.pack[ri] + e.box[1];
      if (y < top || y >= H || pr < 0 || pr >= e.cell[1]) continue;
      const i = (cell.y + pr) * art.width + cell.x + pc, o = y * W + x, R = rowsOf.tex[ri], pixel = T >= 0 && R >= 0 ? d.bytes[T * d.height + R] : 0;
      if (art.ix !== null) { const v = art.ix[i]; if (art.clear[v]) continue; fb[o] = v; A.direct[o] = 0; }
      else { if (art.rgba[i * 4 + 3] === 0) continue; A.beneath[o] = fb[o]; if (pixel !== 0) fb[o] = pixel; A.px[o] = art.px[i]; A.direct[o] = 1; } // @math four bytes a colour, the alpha last
      L.kind[o] = KIND.sprite; L.depth[o] = distance; if (flat) L.relief[o] = 1; if (rows) rows[y] = 1;
    }
  }
}
