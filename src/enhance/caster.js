// The general floor caster of Stage 4 (docs/enhancements.md, Stage 4 as built): the floor of project.js drawFloor (render/floor.js with the
// camera's fractions) for any geometry G (geometry.js: a whole scale s and m margin columns a side), driven by tables. The output pixel
// (X, Y) stands for the reference column u = X/s - m and the row v = Y/s. Its ray is the TRIG pair of the angle h - angleBias + u, lerped
// between two entries read as signed words and never renormalized (an entry that repeats the one before stays flat); its distance n is
// NDIST's, interpolated as 1/n (linear in the screen row on a ground plane) down the rows and across the columns, extrapolated for the s - 1
// rows under row 199 (1/n[-1] = 2/n[0] - 1/n[1]) and continued outside the columns 0..319 from the edge column e through the TRIG cosine,
// n(u) = n[e] cosT(e - centre) / cosT(u - centre), so the forward distance n cos stays the edge column's; its distance on the sprites' scale
// is n VIEW(u) / 2^viewShift, VIEW lerped inside the table and continued the same way outside it. The texel is floor((vx n + fx) / 2^16) + ix
// (and likewise y) in 16-bit words, tile 0 outside the map's cells, so at whole (u, v) the product is drawFloor's own and the sample is
// drawFloor's. Detail modes 2 and 3 keep drawFloor's column blocks, which are gameplay (the steering rate, the link's setup bytes), never a
// resolution: the rays of the reference columns 0, step, 2 step... in drawFloor's own angle sequence (with its reset past the end of the
// table), the margins continuing the blocks with an ordinary wrap, every output column of a block on its ray and on that column's distances,
// the rows still refined. At a whole-unit camera and a whole heading the pixel (s(x + m), s y) is drawFloor's sample (x, y) itself at any
// scale; at IDENTITY (s = 1, m = 0) the whole floor is drawFloor's, its hooks' calls included (test/general-paths.test.js,
// scripts/check-enhance.js section 6). drawFloorAt and floorTemplateAt call project.js drawFloor and layerTemplate at IDENTITY unless forced.
//
// The hooks are drawFloor's: `liquid` ({ texels, wet, wave, shade }: water.js) and `relief` ({ out, light }: relief.js), called with
// drawFloor's arguments at the reference samples. A reference sample is a cell of the output (one ray block's output columns by s output
// rows); the hooks run at its top-left output pixel, which is the sample itself, and its other pixels follow at the reference density:
// - liquid: a liquid pixel takes the anchor's light when the anchor is the same liquid, and is shaded on the spot otherwise (a dry anchor or
//   another liquid); the hook's column is the cell's reference column, the edge column in the margins (the distance tables of the margins are
//   the edge column's: see above), and a sixth argument gives the cell's own reference column, never left of the picture's first (-m; the
//   first block of modes 2 and 3 may start there) (the wide view's sun glitter and dither there, water.js waterShader; drawFloor's five
//   arguments are the same calls inside the table).
// - relief: light(id x tile bytes + texel, x, y) of each pixel's own texel, computed once per texel of the cell (the light depends only on
//   the texel), so the ground's light is blocky per texel as its texture is ({ out, light }: the 'full' look). With `ref` instead of `out`
//   (the reference look: config.js HD.look, a refW x 200 layer) only the sample is lit, once a cell, into the reference cells of its block
//   (the block's reference columns, as drawFloor fills a block at 1x): at a whole camera and heading that is drawFloor's own relief layer.
// - tile(id, texel, fu, fv, o) (optional, for an artwork pack's tiles): the palette index to write at the output pixel o instead of the
//   sheet's, or a negative number for the sheet's; fu and fv are the sample's place inside its texel (0 to 1), the fractions of
//   (vx n + fx) / 2^16 and (vy n + fy) / 2^16 the texel drops. A floor with a tile hook always takes the general path.
import { models } from './models.js';
import { drawFloor, layerTemplate, KIND } from './project.js';
import { cosT } from './geometry.js';

// Per world: the TRIG pairs read as signed words, NDIST's distances (column x step), the VIEW words (a word of 0 is a scale of 1.0, as
// project.js floorDepths has it) and the tile sheets in one array (tile id x tile bytes + texel).
const trigs = new WeakMap(), ndists = new WeakMap(), views = new WeakMap(), flats = new WeakMap();
function trigOf(trig) {
  let t = trigs.get(trig);
  if (t) return t;
  const F = models().floor, half = F.trigEntryBytes / 2; // @math the second dword of a TRIG entry is half an entry on
  t = new Float64Array(F.wrap * 2); // @math x and y of every entry
  for (let e = 0; e < F.wrap; e++) { t[2 * e] = trig.getInt32(e * F.trigEntryBytes, true); t[2 * e + 1] = trig.getInt32(e * F.trigEntryBytes + half, true); } // @math x and y of an entry
  trigs.set(trig, t);
  return t;
}
function ndistOf(ndist) {
  let t = ndists.get(ndist);
  if (t) return t;
  const F = models().floor;
  t = new Float64Array(F.columns * F.steps);
  for (let c = 0; c < F.columns; c++) for (let k = 0; k < F.steps; k++) t[c * F.steps + k] = ndist.getUint32((c * F.groupDwords + k) * F.ndistDwordBytes, true);
  ndists.set(ndist, t);
  return t;
}
function viewOf(view) {
  let t = views.get(view);
  if (t) return t;
  const F = models().floor, V = models().view;
  t = new Float64Array(F.columns);
  for (let c = 0; c < F.columns; c++) t[c] = view.getUint32(c * V.viewBytes, true) || 2 ** V.viewShift; // @math the VIEW word is a 2.14 fixed-point scale
  views.set(view, t);
  return t;
}
function flatOf(sheets) {
  let t = flats.get(sheets);
  if (t) return t;
  const F = models().floor, size = F.sheetCount * F.tileBytes;
  t = new Uint8Array(sheets.length * size);
  sheets.forEach((sheet, i) => t.set(sheet.subarray(0, size), i * size));
  flats.set(sheets, t);
  return t;
}

// The plan of a floor for a world, a geometry and a detail level (per world.ndist; rebuilt when the world's VIEW or TRIG table is another):
// the ray blocks in drawFloor's order (the reference column of each and its output columns), and for every floor pixel its distance n and
// its depth; `rx` and `ry` hold each output column's ray for the frame being drawn.
const plans = new WeakMap();
function planOf(world, G, mode) {
  let byKey = plans.get(world.ndist);
  if (!byKey) { byKey = new Map(); plans.set(world.ndist, byKey); }
  const key = `${G.key}:${mode}`, known = byKey.get(key);
  if (known && known.view === world.view && known.trig === world.trig) return known;
  const F = models().floor, V = models().view, step = F.columnSteps[mode - 1], { s, m, W } = G, last = F.columns - 1, top = s * (F.bottomRow - F.steps + 1), rows = s * F.steps;
  const nd = ndistOf(world.ndist), view = viewOf(world.view), scale = 2 ** V.viewShift; // @math the VIEW word is a 2.14 fixed-point scale
  const first = step * Math.floor(-m / step), count = Math.floor((last + m - first) / step) + 1, blockC = new Int32Array(count), blockX0 = new Int32Array(count), blockX1 = new Int32Array(count);
  for (let b = 0; b < count; b++) { const c = first + b * step; blockC[b] = c; blockX0[b] = Math.max(s * (c + m), 0); blockX1[b] = Math.min(s * (c + step + m), W); }
  // The distance of a reference column of the table between the steps kA and kA - 1, t of the way down (the step under the last is extrapolated).
  const rowN = (c, kA, t) => {
    const a = nd[c * F.steps + kA];
    if (t === 0) return a;
    const below = kA > 0 ? 1 / nd[c * F.steps + kA - 1] : 2 / nd[c * F.steps] - 1 / nd[c * F.steps + 1]; // @math under row 199: 1/n continued by its last difference
    return 1 / ((1 - t) / a + t * below);
  };
  const n = new Float64Array(W * rows), depth = new Float32Array(W * rows);
  for (let X = 0; X < W; X++) {
    const u = step === 1 ? X / s - m : first + Math.floor((X / s - m - first) / step) * step; // the column's reference column (a block's own in modes 2 and 3)
    const inside = u >= 0 && u <= last, c0 = inside ? Math.floor(u) : u < 0 ? 0 : last, w = inside ? u - c0 : 0;
    const ratio = inside ? 1 : cosT(world.trig, c0 - V.center) / cosT(world.trig, u - V.center), vw = inside ? (w === 0 ? view[c0] : view[c0] * (1 - w) + view[c0 + 1] * w) : view[c0] / ratio;
    for (let j = 0; j < rows; j++) {
      const v = (top + j) / s, r0 = Math.floor(v), t = v - r0, kA = F.bottomRow - r0;
      let d = rowN(c0, kA, t);
      if (w !== 0) d = 1 / ((1 - w) / d + w / rowN(c0 + 1, kA, t));
      else if (!inside) d *= ratio;
      n[j * W + X] = d; depth[j * W + X] = (d * vw) / scale;
    }
  }
  const plan = { view: world.view, trig: world.trig, step, top, rows, blockC, blockX0, blockX1, n, depth, rx: new Float64Array(W), ry: new Float64Array(W), templates: new Map() };
  byKey.set(key, plan);
  return plan;
}

// The TRIG entry pair at a fractional entry `a` (any sign): the lerp between floor(a) and the entry after it, into rx[X] and ry[X].
function rayAt(T, a, rx, ry, X) {
  const F = models().floor, wrapped = ((a % F.wrap) + F.wrap) % F.wrap;
  let e0 = Math.floor(wrapped);
  if (e0 >= F.wrap) e0 -= F.wrap; // a wrap a rounding put on the table's end
  const t = wrapped - e0, e1 = e0 + 1 === F.wrap ? 0 : e0 + 1;
  rx[X] = t === 0 ? T[2 * e0] : T[2 * e0] + (T[2 * e1] - T[2 * e0]) * t; // @math x of the entry
  ry[X] = t === 0 ? T[2 * e0 + 1] : T[2 * e0 + 1] + (T[2 * e1 + 1] - T[2 * e0 + 1]) * t; // @math y of the entry
}

// The general floor: drawFloor's picture for the geometry G into `fb` (G.W x G.H palette indices, the floor's rows only), with `hooks`
// (above). `camera` { x, y, heading }: x and y may hold fractions; in mode 1 so may the heading (the rays are lerped), in modes 2 and 3 it is
// taken whole, as their blocks are.
export function castFloor(world, camera, mode, fb, G, { liquid = null, relief = null, tile = null } = {}) {
  const F = models().floor, p = planOf(world, G, mode), T = trigOf(world.trig), sheets = flatOf(world.sheets), tiles = world.tiles, { s, W } = G, last = F.columns - 1, unit = 2 ** F.fixedBits; // @math 16.16 fixed point
  const ix = Math.floor(camera.x), iy = Math.floor(camera.y), fx = (camera.x - ix) * unit, fy = (camera.y - iy) * unit, { rx, ry, n: N, blockC, blockX0, blockX1, top } = p;
  if (p.step === 1) { const base = camera.heading - F.angleBias - G.m; for (let X = 0; X < W; X++) rayAt(T, base + X / s, rx, ry, X); }
  else { // drawFloor's angles of the blocks of the table, an ordinary wrap in the margins
    const start = (((Math.round(camera.heading) - F.angleBias) % F.wrap) + F.wrap) % F.wrap;
    let angle = start;
    for (let b = 0; b < blockC.length; b++) {
      const c = blockC[b];
      let e;
      if (c >= 0 && c <= last) { e = angle; angle += p.step; if (angle >= F.wrap) angle = F.resetTo; }
      else e = (((start + c) % F.wrap) + F.wrap) % F.wrap;
      for (let X = blockX0[b]; X < blockX1[b]; X++) rayAt(T, e, rx, ry, X);
    }
  }
  const texels = liquid ? liquid.texels : null, lit = relief ? relief.out ?? null : null, grid = relief ? relief.ref ?? null : null, refW = G.refW;
  for (let b = 0; b < blockC.length; b++) {
    const c = blockC[b], X0 = blockX0[b], X1 = blockX1[b], hc = c < 0 ? 0 : c > last ? last : c, uc = Math.max(c, -G.m); // the hooks' column: the block's own, the edge column's in the margins; the block's first reference column in the picture (the first block of modes 2 and 3 may start left of it)
    if (X1 <= X0) continue;
    const g0 = Math.max(c + G.m, 0), g1 = Math.min(c + p.step + G.m, refW); // the block's reference columns on the grid of the reference look
    for (let k = 0; k < F.steps; k++) {
      const Y0 = s * (F.bottomRow - k), j0 = Y0 - top;
      let anchor = true, aKind = 0, aWave = 0, lx = -1, ly = -1, light = 1;
      for (let q = 0; q < s; q++) { // along each output row of the cell: neighbours along a row share a texel more often than down a column (the relief's light is asked once a run)
        for (let X = X0; X < X1; X++, anchor = false) {
          const d = N[(j0 + q) * W + X], o = (Y0 + q) * W + X, sx = rx[X] * d + fx, sy = ry[X] * d + fy, hx = Math.floor(sx / unit), hy = Math.floor(sy / unit);
          const x = (hx + ix) & 0xffff, y = (hy + iy) & 0xffff; // @math the 16-bit sums
          const row = (y >> F.tileShift) - F.mapOrigin, col = (x >> F.tileShift) - F.mapOrigin;
          const id = row >= 0 && row < F.mapRows && col >= 0 && col < F.mapColumns ? tiles[row * F.mapColumns + col] : 0, texel = ((y & F.tileMask) << F.tileShift) + (x & F.tileMask), at = id * F.tileBytes + texel;
          let pixel = sheets[at];
          if (tile !== null) { const own = tile(id, texel, sx / unit - hx, sy / unit - hy, o); if (own >= 0) pixel = own; }
          fb[o] = pixel;
          if (texels !== null) {
            const kind = texels[at];
            if (anchor) { aKind = kind; if (kind !== 0) aWave = liquid.shade(kind, x, y, hc, k, uc); }
            if (kind !== 0) { liquid.wet[o] = kind; liquid.wave[o] = kind === aKind ? aWave : liquid.shade(kind, x, y, hc, k, uc); }
          }
          if (lit !== null) {
            if (anchor || x !== lx || y !== ly) { light = relief.light(at, x, y); lx = x; ly = y; }
            lit[o] = light;
          } else if (grid !== null && anchor) { const v = relief.light(at, x, y), row = (F.bottomRow - k) * refW; for (let gx = g0; gx < g1; gx++) grid[row + gx] = v; } // the sample's light on its reference cells, as drawFloor fills its block
        }
      }
    }
  }
  return fb;
}

// The floor at a geometry: drawFloor at IDENTITY with no tile hook unless `force` (the checks' forced general path), else castFloor.
export function drawFloorAt(world, camera, mode, fb, G, hooks = {}, force = false) {
  if (G.identity && !force && !hooks.tile) return drawFloor(world, camera, mode, fb, hooks);
  return castFloor(world, camera, mode, fb, G, hooks);
}

// The layers of a screen before its sprites at a geometry (project.js layerTemplate's): the sky rows, the horizon strip's rows unless the sky
// covers them (`plainSky` false: a demo's page), and the floor's rows with the depth of each pixel's own distance. layerTemplate at IDENTITY
// unless `force`. Kept per world, geometry, detail level and sky; read, never written.
export function floorTemplateAt(world, mode, plainSky, horizon, G, force = false) {
  if (G.identity && !force) return layerTemplate(world, mode, plainSky, horizon);
  const p = planOf(world, G, mode), key = `${plainSky}`, known = p.templates.get(key);
  if (known) return known;
  const { s, W, H } = G, t = { kind: new Uint8Array(W * H), depth: new Float32Array(W * H).fill(Infinity) };
  if (plainSky) t.kind.fill(KIND.horizon, s * horizon.from * W, s * horizon.to * W);
  t.kind.fill(KIND.floor, p.top * W, H * W); t.depth.set(p.depth, p.top * W);
  p.templates.set(key, t);
  return t;
}
