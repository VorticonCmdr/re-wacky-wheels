// The sky and the horizon strip of Stage 4 at a geometry G (geometry.js: a whole scale s, m margin columns a side; docs/enhancements.md, Stage
// 4 as built): the original's pictures read at each output pixel's reference cell, nearest and aligned top-left, so the output pixel
// (s (x + m), s y) is render/sky.js renderSky's and renderHorizon's (x, y) itself and the s x s pixels of a cell are its copies. The enhancer
// calls scene.js's own sky and strip at the reference geometry; these draw every other one.
// - The sky (rows 0..109): with a margin (the wide view, M8) its columns beyond the picture's 320 come from skyMargins, invented pixels made
//   from each row's own indices; the picture's 320 columns are always its own.
// - A demo's slide page (rows 0..129, drawn by the page into a 320 x 200 scratch first): a margin column would read the page's edge column, but a
//   slides demo is never wide (the page's frame context), so only the standard view's columns are ever drawn.
// - The strip (rows 110..129): the window starts round(offset x pixelsPerByte x s) / s pixels into the .PAR rows, so it scrolls in steps of
//   1/s of a pixel. In the standard view the start is clamped to the strip's offsets as drawHorizonFine clamps it and the window never runs
//   past its row; with a margin the window runs on modulo the strip's period (geometry.js stripPeriod), which the file must repeat with
//   (geometry.js stripRepeats), so the margins continue the panorama and the centre is the standard view's.
import { models } from './models.js';
import { stripPeriod, stripRepeats } from './geometry.js';
import { bayer } from './clouds.js';
import { SKY_MARGIN } from './config.js';

// The reference column of every output column, clamped to the picture (the edge column in the margins), per geometry.
const columns = new Map();
function edgeColumns(G) {
  let c = columns.get(G.key);
  if (c) return c;
  const last = models().sky.width - 1;
  c = Int32Array.from(G.colRef, u => Math.min(Math.max(u, 0), last));
  columns.set(G.key, c);
  return c;
}

// The first `rows` rows of a 320-wide picture (`src`: palette indices, row-major) into the output `fb` (G.W x G.H) at rows 0..s rows - 1:
// each output row of a reference row once, then copied down its cell. `from`: the first reference row drawn (a split screen's viewer, whose
// rows above its first are cut away).
export function upscaleRows(src, rows, fb, G, from = 0) {
  const S = models().sky, { s, W } = G, cols = edgeColumns(G);
  for (let y = from; y < rows; y++) {
    const from = y * S.width, o = s * y * W;
    for (let X = 0; X < W; X++) fb[o + X] = src[from + cols[X]];
    for (let q = 1; q < s; q++) fb.copyWithin(o + q * W, o, o + W);
  }
  return fb;
}

// The track's sky picture at refW = 320 + 2m columns (Stage 4, M8: the wide view's sky margins), rows 0..skyRows + horizonRows - 1 (the sky
// and the strip's background rows under it, whose indices the strip's sky-coloured pixels are drawn in): { pixels (rows x refW), refW, rows,
// dithered (a flag a row: its margins are made again rather than continued) }. Columns m..m + 319 are the picture's own 320. In the margins:
// - a row of a single index (every row of BACK3.PCX, a few of the others) is continued exactly;
// - a dithered row (most rows of BACK1.PCX and BACK2.PCX: two or three indices in no period, not a Bayer pattern) is made again from that
//   row's own indices in their proportions (SKY_MARGIN.mode 'redither'): the indices in ascending order, each taking its share of the row's
//   320 pixels as a band of thresholds, and the pixel at the reference column x the index whose band holds the ordered dither's threshold of its
//   cell, bayer(x, y + (x >> 2)): the 4 x 4 Bayer matrix stepped down a row every four columns, so that any 16 columns of one row take all 16
//   thresholds once and each index fills its share of them to within a pixel (test/stage4-wide.test.js). Or 'mirror': the row reflected at the
//   picture's edge. Either way only indices the row already holds are used, so the strip's sky-coloured indices (clouds.js stripSkyIndices)
//   and the rows' colours (skyRowColours), which are read from the 320 columns, hold for the margins too.
// The made pixels are invented, never the game's art (docs/enhancements.md). Kept per picture and margin.
const margins = new WeakMap();
export function skyMargins(sky, m, mode = SKY_MARGIN.mode) {
  let byMargin = margins.get(sky);
  if (!byMargin) { byMargin = new Map(); margins.set(sky, byMargin); }
  const key = `${m}:${mode}`, known = byMargin.get(key);
  if (known) return known;
  if (!SKY_MARGIN.modes.includes(mode)) throw new Error(`no sky margin mode '${mode}': ${SKY_MARGIN.modes.join(' or ')}`);
  const S = models().sky, w = S.width, rows = S.skyRows + S.horizonRows, refW = w + 2 * m, pixels = new Uint8Array(rows * refW), dithered = new Uint8Array(rows); // @math a margin on either side
  for (let y = 0; y < rows; y++) {
    const src = sky.subarray(y * w, y * w + w), o = y * refW, count = new Uint32Array(256); // @math a count for each palette index
    pixels.set(src, o + m);
    for (const v of src) count[v]++;
    const used = [];
    for (let v = 0; v < count.length; v++) if (count[v]) used.push(v);
    if (used.length === 1) { pixels.fill(used[0], o, o + m); pixels.fill(used[0], o + m + w, o + refW); continue; }
    dithered[y] = 1;
    for (let X = 0; X < refW; X++) {
      const x = X - m; // the reference column
      if (x >= 0 && x < w) continue;
      if (mode === 'mirror') { const r = x < 0 ? -1 - x : 2 * w - 1 - x, at = ((r % (2 * w)) + 2 * w) % (2 * w); pixels[o + X] = src[at < w ? at : 2 * w - 1 - at]; continue; } // @math reflected at the edge, and again past the other edge
      const t = bayer(x, y + (x >> 2)) * w; // @math the Bayer row steps every four columns
      let acc = 0, v = used[used.length - 1];
      for (const u of used) { acc += count[u]; if (t < acc) { v = u; break; } }
      pixels[o + X] = v;
    }
  }
  const out = { pixels, refW, rows, dithered };
  byMargin.set(key, out);
  return out;
}

// The track's sky picture (world.sky) at G: renderSky's rows from..skyRows - 1, its margins (m > 0) from skyMargins.
export function drawSkyAt(sky, fb, G, from = 0) {
  const S = models().sky;
  if (G.m === 0) return upscaleRows(sky, S.skyRows, fb, G, from);
  const { s, m, W, colRef } = G, ext = skyMargins(sky, m);
  for (let y = from; y < S.skyRows; y++) {
    const row = y * ext.refW + m, o = s * y * W;
    for (let X = 0; X < W; X++) fb[o + X] = ext.pixels[row + colRef[X]];
    for (let q = 1; q < s; q++) fb.copyWithin(o + q * W, o, o + W);
  }
  return fb;
}

// The horizon strip at a pixel offset (`offset` in strip bytes, a fraction allowed: the blend's) at G: rows horizonRow..horizonRow +
// horizonRows - 1 (above).
export function drawStripAt(par, offset, fb, G) {
  const S = models().sky, { s, m, W } = G, P = stripPeriod();
  if (par.length !== S.parBytes) throw new Error(`.PAR file of ${par.length} bytes, expected ${S.parBytes}`);
  if (m > 0 && !stripRepeats(par)) throw new Error(`a horizon strip that does not repeat every ${P} pixels has no wide view`);
  const a = Math.min(Math.max(Math.round(offset * S.pixelsPerByte * s), 0), S.offsetMax * S.pixelsPerByte * s), at = new Int32Array(W); // the window's start in 1/s pixels
  for (let X = 0; X < W; X++) { const p = Math.floor((a + X - s * m) / s); at[X] = m > 0 ? ((p % P) + P) % P : p; }
  for (let j = 0; j < S.horizonRows; j++) {
    const from = S.parRowPixels * j, o = s * (S.horizonRow + j) * W;
    for (let X = 0; X < W; X++) fb[o + X] = par[from + at[X]];
    for (let q = 1; q < s; q++) fb.copyWithin(o + q * W, o, o + W);
  }
  return fb;
}
