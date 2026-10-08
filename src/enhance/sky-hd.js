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
import { SKY_MARGIN, ART } from './config.js';

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

// The track's sky picture (world.sky) at G: renderSky's rows from..skyRows - 1, its margins (m > 0) from skyMargins. `pack` (while an artwork
// pack is drawn, scene.js: { sky: a pack sky's art or null, A: the art layers, rows: the output rows' flags }) draws a pack sky over it
// (drawPackSky).
export function drawSkyAt(sky, fb, G, from = 0, pack = null) {
  const S = models().sky;
  if (G.m === 0) upscaleRows(sky, S.skyRows, fb, G, from);
  else {
    const { s, m, W, colRef } = G, ext = skyMargins(sky, m);
    for (let y = from; y < S.skyRows; y++) {
      const row = y * ext.refW + m, o = s * y * W;
      for (let X = 0; X < W; X++) fb[o + X] = ext.pixels[row + colRef[X]];
      for (let q = 1; q < s; q++) fb.copyWithin(o + q * W, o, o + W);
    }
  }
  if (pack?.sky) drawPackSky(pack.sky, fb, G, from, 0, S.skyRows, pack);
  return fb;
}

// The pixels of a pack sky (art.js: (320 + 2 margin) p x 130 p) over rows y0..y1 - 1 (reference rows) of the output: each output pixel the pack
// pixel at its reference place times p (nearest: (u + margin) p, v p, with u = X / s - m and v = Y / s), where the picture reaches (a margin of
// the pack narrower than the view's leaves the made margins there). Indexed: its index (an index its tRNS makes transparent keeps the
// archive's); RGBA: its colour in the art layers over the archive's index, which fb and `beneath` keep (alpha 0 keeps the archive's pixel). At
// p > 1 a reference cell holds several pack pixels: its rows are flagged, so that compositeAt composes them per pixel (its sky-band fast path
// takes a cell as one value).
export function drawPackSky(art, fb, G, from, y0, y1, pack) {
  const { s, m, W } = G, p = art.p, margin = art.entry.margin ?? 0, A = pack.A, flag = p > 1 && pack.rows;
  for (let Y = s * Math.max(y0, from); Y < s * y1; Y++) {
    const py = Math.floor((Y / s) * p), o0 = Y * W;
    if (flag) pack.rows[Y] = 1;
    for (let X = 0; X < W; X++) {
      const px = Math.floor((X / s - m + margin) * p);
      if (px < 0 || px >= art.width) continue;
      const i = py * art.width + px, o = o0 + X;
      if (art.ix) { const v = art.ix[i]; if (!art.clear[v]) fb[o] = v; continue; }
      if (art.rgba[i * 4 + 3] === 0) continue; // @math four bytes a colour, the alpha last
      A.px[o] = art.px[i]; A.direct[o] = 1; A.beneath[o] = fb[o];
    }
  }
}

// The horizon strip at a pixel offset (`offset` in strip bytes, a fraction allowed: the blend's) at G: rows horizonRow..horizonRow +
// horizonRows - 1 (above). `pack` (while an artwork pack is drawn: { strip, sky, A, flags (clouds.js stripSkyIndices), sky picture `back`
// (the track's own sky picture, the strip's background rows under it) }) with a pack strip sets the art layers' `through` of every strip
// pixel (the archive's sky indices') and draws the pack strip over the archive's (drawPackStrip).
export function drawStripAt(par, offset, fb, G, pack = null) {
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
  if (pack?.strip) { // the strip pixels' sky flags (the archive's sky indices'), then the pack strip over them
    const { A, flags } = pack;
    for (let Y = s * S.horizonRow; Y < s * (S.horizonRow + S.horizonRows); Y++) { const j = Math.floor(Y / s) - S.horizonRow; for (let o = Y * W, end = o + W; o < end; o++) A.through[o] = flags[j * 256 + fb[o]]; } // @math a flag for each palette index
    drawPackStrip(pack.strip, fb, G, a, pack);
  }
  return fb;
}

// A pack strip (art.js: P p x 20 p, one panorama of the strip's period P) over the archive's strip: the output pixel of the window's place
// (a + X - s m) / s (the strip's pixels, in steps of 1/s) reads the pack pixel at that place times p, modulo the panorama, on the row of its
// reference row times p. A pixel that says 'sky here' (RGBA: alpha below ART.alphaCut; indexed: an index its tRNS makes transparent) keeps the
// archive's strip pixel where that is one of the strip's sky indices (so the archive's own dither stays), else takes the sky picture's pixel of
// that strip row (the pack sky's rows 110..129 where a pack sky reaches, else the archive sky's, its margins made as the wide view makes them);
// either way it is sky to the composite (`through` 1: the tint and the far range go on over it). Any other pixel is the pack's scenery: an
// index (its `through` the archive's flag of that index, as an archive pixel of it has) or a colour in the art layers over the archive's index
// (`through` 0).
export function drawPackStrip(art, fb, G, a, pack) {
  const S = models().sky, { s, m, W, colRef } = G, p = art.p, period = art.width, A = pack.A, flags = pack.flags, cut = ART.alphaCut;
  const back = pack.back, ext = m > 0 ? skyMargins(back, m) : null, sky = pack.sky, skyMargin = sky?.entry.margin ?? 0;
  for (let Y = s * S.horizonRow; Y < s * (S.horizonRow + S.horizonRows); Y++) {
    const j = Math.floor(Y / s) - S.horizonRow, py = Math.floor(((Y / s) - S.horizonRow) * p), o0 = Y * W, row = S.horizonRow + j;
    for (let X = 0; X < W; X++) {
      const px = ((Math.floor(((a + X - s * m) / s) * p) % period) + period) % period, i = py * art.width + px, o = o0 + X;
      let here;
      if (art.ix) { const v = art.ix[i]; here = art.clear[v] === 1; if (!here) { fb[o] = v; A.direct[o] = 0; A.through[o] = flags[j * 256 + v]; continue; } } // @math a flag for each palette index
      else { const alpha = art.rgba[i * 4 + 3]; here = alpha < cut; if (!here) { A.px[o] = art.px[i]; A.direct[o] = 1; A.beneath[o] = fb[o]; A.through[o] = 0; continue; } } // @math four bytes a colour, the alpha last
      A.through[o] = 1;
      if (flags[j * 256 + fb[o]]) { A.direct[o] = 0; continue; } // @math a flag for each palette index: the archive's own sky pixel
      const sx = sky ? Math.floor((X / s - m + skyMargin) * sky.p) : -1, si = sx >= 0 && sx < sky.width ? Math.floor((Y / s) * sky.p) * sky.width + sx : -1;
      if (si >= 0 && (sky.ix ? !sky.clear[sky.ix[si]] : sky.rgba[si * 4 + 3] !== 0)) { // @math four bytes a colour, the alpha last
        if (sky.ix) { fb[o] = sky.ix[si]; A.direct[o] = 0; } else { A.beneath[o] = fb[o]; A.px[o] = sky.px[si]; A.direct[o] = 1; }
        continue;
      }
      fb[o] = ext ? ext.pixels[row * ext.refW + colRef[X] + m] : back[row * S.width + Math.min(Math.max(colRef[X], 0), S.width - 1)]; A.direct[o] = 0; // the archive sky's pixel of the strip row
    }
  }
}
