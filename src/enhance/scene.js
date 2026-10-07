// The Enhanced presentation's picture of the world for the present state's viewer: the same sky, horizon strip, floor and draw list as
// render/scene.js (the records come from its sceneRecords), with the camera and the moving things a fraction of a unit apart from the whole
// units the records were built at, and with layers beside the indexed picture: the kind and the distance of every pixel and the shadows on
// the ground. Nothing of the state is changed.
import { sceneCamera, sceneRecords } from '../render/scene.js';
import { sortDrawList } from '../render/draw-list.js';
import { renderSky } from '../render/sky.js';
import { clipPicture } from '../game/objects.js';
import { playerGeometry } from '../game/player-car.js';
import { starterPoint } from '../game/start.js';
import { drawFloor, layerTemplate, projectFine, projectAt, roundWord, KIND } from './project.js';
import { drawFloorAt, floorTemplateAt } from './caster.js';
import { blitAt, blitFlatAt } from './blit.js';
import { IDENTITY } from './geometry.js';
import { drawSkyAt, drawStripAt, upscaleRows } from './sky-hd.js';
import { stampShadow, casterOf, castOf, castShadow, sunDirection, blurCast, boxBlurCast, shadowBox } from './shadows.js';
import { waterShader, sunGlitter } from './water.js';
import { groundLight, pictureLight, screenSun, paletteLuma } from './relief.js';
import { SUN } from './config.js';
import { mergeOrder } from './wide.js';
import { models } from './models.js';

// The layers beside an indexed picture: the kind and the distance of every pixel, the contact shadows, the sun shadows and the skid marks
// on the ground, the liquid under a floor pixel and its light (water.js), the relief's light (relief.js), and a scratch buffer for the blur.
export function createLayers(size) {
  return { kind: new Uint8Array(size), depth: new Float32Array(size), shade: new Float32Array(size), cast: new Float32Array(size), mark: new Float32Array(size), wet: new Uint8Array(size), wave: new Float32Array(size), relief: new Float32Array(size).fill(1), scratch: new Float32Array(size) };
}
export const LAYER_KEYS = ['kind', 'depth', 'shade', 'cast', 'mark', 'wet', 'wave', 'relief'];

// The soft layers of the reference look (config.js HD.look 'reference') above 1x: the contact shadows, the sun shadows (and a scratch buffer
// for their blur), the skid marks and the ground's relief light on the reference grid (refW x 200 cells), drawn there as at 1x and read by
// compositeAt at each output pixel's reference cell. The layers of the output keep the kind, the depth, the liquids and the pictures' light.
export const SOFT_KEYS = ['shade', 'cast', 'mark', 'relief'];
export const createSoftLayers = size => ({ shade: new Float32Array(size), cast: new Float32Array(size), mark: new Float32Array(size), relief: new Float32Array(size).fill(1), scratch: new Float32Array(size) });
// The output layers a frame of the reference look writes and reads (its soft layers are on the reference grid).
export const OUTPUT_KEYS = ['kind', 'depth', 'wet', 'wave', 'relief'];

// The horizon strip at a pixel offset (sky.js draws it in steps of four pixels: `offset` x pixelsPerByte).
function drawHorizonFine(par, offset, fb) {
  const S = models().sky, at = Math.min(Math.max(Math.round(offset * S.pixelsPerByte), 0), S.offsetMax * S.pixelsPerByte);
  if (par.length !== S.parBytes) throw new Error(`.PAR file of ${par.length} bytes, expected ${S.parBytes}`);
  for (let j = 0; j < S.horizonRows; j++) {
    const from = S.parRowPixels * j + at;
    fb.set(par.subarray(from, from + S.width), (S.horizonRow + j) * S.width);
  }
}

// The world point a record was projected from, as the blend has it with its fractions: the racers, the humans, the shots, the static
// objects and the starter; null for the own car (always in the middle of the screen).
function anchorOf(r, P, fine, seat) {
  if (r.shot !== undefined) return fine.shots[r.shot] ?? null;
  if (r.object >= 0) return P.player.objects[r.object] ?? null;
  if (r.type === 1) {
    if (P.intro && r.racer === 0) return { x: fine.seats[seat].px, y: fine.seats[seat].py }; // the human in the camera's fly-in (scene.js introHuman)
    if (P.versus && r.racer === 1) { const other = fine.seats[1 - seat]; return other ? { x: other.px, y: other.py } : null; } // the other human of a two player game (versus.js viewRacers)
    return fine.racers[r.racer] ?? null;
  }
  if (r.type === -1 && r.racer === -1) return starterPoint(P.world.start);
  return null;
}

// A record moved to where its point projects from the fine camera: the shift of the column and the bottom row between the fine and the whole
// projections, then the clipping of the object pass at the new place (null when nothing of it is left on the screen).
function refine(r, world, camF, camI, a) {
  const f = projectFine(world, camF, a.x, a.y), i = projectFine(world, camI, roundWord(a.x), roundWord(a.y));
  if (!f || !i) return r;
  const dc = Math.round(f.column - i.column), db = Math.round(f.bottom - i.bottom);
  if (!dc && !db) return r;
  const clip = clipPicture({ column: r.left - r.firstColumn + (r.picture.w >> 1) + dc, bottom: r.top + r.picture.h + db }, r.picture); // @math the column is the left edge plus half the width, rounded down
  return clip ? { ...r, ...clip } : null;
}

// blitRecord of render/sprites.js, writing the kind and the distance of every pixel (and, with `collect`, listing each pixel it draws and the
// source byte it read in collect.drawn and collect.sources, counting them in collect.count). Returns null for a picture with no opaque pixel, else
// { foot, cols }: the footprint the scenery shadows use (the leftmost and rightmost opaque columns of the `band` part of the picture's rows
// above its lowest opaque row, and how many rows that row stands above the picture's bottom: a bouncing object's frame), and for each drawn
// column the highest and lowest opaque picture row (-1 for none), the silhouette the sun shadows cast.
export function blitLayers(fb, L, rec, band, width, height, collect = null) {
  const { picture } = rec, rowMin = new Int16Array(picture.h).fill(width), rowMax = new Int16Array(picture.h).fill(-1);
  const cols = { top: new Int16Array(rec.width).fill(-1), bottom: new Int16Array(rec.width).fill(-1) };
  let low = -1;
  for (let i = 0; i < rec.width; i++) {
    const x = rec.left + i;
    let at = (rec.firstColumn + i) * (picture.h + 1), source = picture.deltas[at++];
    for (let j = 0; j < rec.height; j++) {
      const y = rec.top + j, pixel = rec.frame[source];
      if (pixel !== 0) {
        if (x < rowMin[j]) rowMin[j] = x;
        if (x > rowMax[j]) rowMax[j] = x;
        if (j > low) low = j;
        if (cols.top[i] < 0) cols.top[i] = j;
        cols.bottom[i] = j;
        if (x >= 0 && x < width && y >= 0 && y < height) { const o = y * width + x; fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = rec.distance; if (collect) { collect.drawn[collect.count] = o; collect.sources[collect.count++] = source; } }
      }
      source += picture.deltas[at++];
    }
  }
  if (low < 0) return null;
  let minX = width, maxX = -1;
  for (let j = Math.max(low + 1 - Math.max(Math.round(picture.h * band), 1), 0); j <= low; j++) if (rowMax[j] >= 0) { minX = Math.min(minX, rowMin[j]); maxX = Math.max(maxX, rowMax[j]); }
  return { foot: { minX, maxX, lift: picture.h - 1 - low }, cols };
}

// The list of the pixels a picture draws and the source bytes it read, for its relief (pictureLight): empty until a picture is drawn, then as
// long as the largest screen drawn so far (a picture never draws more pixels than its screen has).
export const createCollect = () => ({ drawn: new Int32Array(0), sources: new Int32Array(0), count: 0 });
function collectFor(collect, size) {
  if (collect.drawn.length < size) { collect.drawn = new Int32Array(size); collect.sources = new Int32Array(size); }
  collect.count = 0;
  return collect;
}

// blitFlat of render/sprites.js with the layers (the effects drawn after the own car stand at its distance; `flat` their relief's light).
export function blitFlatLayers(fb, L, d, distance, width, height, flat = false) {
  for (let i = 0; i < d.width; i++) {
    const x = d.x + i;
    for (let j = 0; j < d.height; j++) {
      const y = d.y + j, pixel = d.bytes[i * d.height + j];
      if (pixel !== 0 && x >= 0 && x < width && y >= 0 && y < height) { const o = y * width + x; fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = distance; if (flat) L.relief[o] = 1; }
    }
  }
}

const NO_FORCE = { caster: false, blit: false };

// A record above 1x (Stage 4, M6): the whole picture (the window of all its columns and rows, cut per pixel by blit.js) at its finer place in
// output pixels, `place` { x, y }: s times the whole camera's place (the unclipped picture's left and top, m added to the column) plus the
// shift of its point between the fine and the whole camera's projections, unrounded and then rounded to output pixels, round(s dc) and
// round(s db) (at s = 1 that is refine's arithmetic; refine also clips again, which the per-pixel cut does here). `a` is the record's world
// point (anchorOf), null for the own car and when the frame is drawn at the tick's camera: then the place is s times the whole one. With a
// margin (the wide view) the shift is the wide projection's (project.js projectAt: the pinhole inside the reference fan, as at m = 0).
export function placeAt(r, world, camF, camI, a, G) {
  const { s, m } = G, left = r.left - r.firstColumn;
  let dx = 0, dy = 0;
  if (a) {
    const f = projectAt(world, camF, a.x, a.y, m), i = projectAt(world, camI, roundWord(a.x), roundWord(a.y), m);
    if (f && i) { dx = Math.round(s * (f.column - i.column)); dy = Math.round(s * (f.bottom - i.bottom)); }
  }
  return { ...r, left, firstColumn: 0, width: r.picture.w, height: r.picture.h, place: { x: s * (left + m) + dx, y: s * r.top + dy } };
}

// The fine camera's heading above 1x in detail mode 1 (Stage 4, M6): the blend's heading rounded to 1/s of a TRIG entry, round(h s) / s, so
// the floor turns one output column at a time and the pictures with it (project.js headingVectorAt); in modes 2 and 3 (whose column blocks
// are gameplay) and at 1x the whole heading of the tick's camera.
export function fineHeading(own, camI, G, mode) {
  if (G.s === 1 || mode !== 1) return camI.heading;
  const turn = models().view.turn;
  let h = Math.round(own.heading * G.s) / G.s;
  while (h < 0) h += turn; // a blend is within a turn of the table (MOTION.snapTurn): one step puts it back, with no remainder's rounding
  while (h >= turn) h -= turn;
  return h;
}

// Draws the viewer's world into `fb` (indexed) and `L` (kind, depth, contact and sun shadows, skid marks, liquids). `P` is the present state with the viewer's seat swapped in,
// `fine` the blend with fractions, `seat` the viewer's seat, `mode` the detail level, `sky` the demo's sky (or null), `opts` the settings
// (`water`: null, or the track's liquids (water.js liquidsOf), its water's strength and whether the game cycles its water's palette; `relief`:
// null, or { ground (relief.js groundRelief), sun (sunVector), length (the sun's shadow length), strength, frameHeights(frame) (the
// player's map of a picture's frame by its bytes, or null) }).
// Returns the camera the frame was drawn from (with fractions) for the particles.
// `opts.collect` (createCollect) holds the pixels of the picture being drawn for its relief: each enhancer has its own, so previews and the page
// never share it; it grows to the size of `fb` when a picture larger than any before is drawn.
// `opts.force` ({ caster, blit }: the checks' forced general paths, Stage 4) draws the floor and its layer template through caster.js and the
// pictures through blit.js at IDENTITY instead of drawFloor, layerTemplate, blitLayers and blitFlatLayers (the same picture and layers,
// scripts/check-enhance.js section 6); `opts.rows` (one flag an output row, or null) is cleared and given the rows the general blit writes.
// `G` (geometry.js, Stage 4) is the geometry `fb` and `L` are drawn at (G.W x G.H output pixels). At IDENTITY, the default, every step is
// the one above, today's functions called as they always were. At any other geometry:
// - the floor and its template through caster.js (the liquid and relief hooks at the reference density, the ground's light from relief.js's
//   per-texel table), the camera's heading in mode 1 above 1x the blend's to 1/s of an entry (fineHeading);
// - the sky and the strip through sky-hd.js (a demo's slide page drawn by the page at 320 x 200 and enlarged);
// - the records (sceneRecords) through blit.js, whole, at their finer places (placeAt), the own car at s times its place with its
//   after-blits as s x s blocks (the state's 320 x 200 rows and columns of the tyres, the pit overlay, the crash, the hop and the jiggle,
//   taken s times, never recomputed), the pictures' relief lit on the reference grid;
// - the soft layers: with `opts.soft` (the reference look, scene.js createSoftLayers: refW x 200) the contact shadows, the sun casts (blurred
//   by blurCast as at 1x), the skid marks and the ground's relief light on the reference grid, from the pictures' reference samples (blitAt's
//   `sample`: at a whole place the 1x footprint and silhouette); without it (the 'full' look) in output pixels, the casts softened by a
//   running-sum box blur of SUN.blur x s pixels;
// - `opts.rows` (G.H flags) always takes the blit's rows, `opts.page` (320 x 200, or a scratch of its own) takes a slide's page, and
//   `opts.from` (a reference row: the split screen's viewers, whose rows above their first are cut away) is the first row drawn (a picture
//   across it is still lit as a whole, as at 1x before the cut: blitAt lists its pixels above for the relief alone).
// With a margin (m > 0: the wide view, M8) the sky's margins come from sky-hd.js skyMargins, the strip runs on modulo its period, the water's
// glitter and dither go on along the margins' own columns, the records of the reference fan are joined by the margin records of `opts.wide`
// (wide.js createWide: the things the margins show, found with aimed probes of sceneRecords, so every game filter applies; merged into the
// game's sorted order by distance), and every record, shadow, cast, mark and particle is placed through the wide projection (project.js
// projectAt, fromCameraAt and cameraPointAt: the pinhole inside the fan, its equiangular continuation outside it), so the pictures cut at the
// reference columns 0 and 319 show whole in the margins.
// `opts.trace` ({ records: [], marks: [] }, the checks') gets, for every record drawn, { margin (a margin record), edge (the reference picture
// reaches column 0 or 319: the standard view cuts it there or its relief sees an open side), rect (its picture's box), shade and cast (the
// boxes its contact shadow and its sun cast, blurred, can touch) }, in output pixels, and the box of every skid mark quad (drawn on the soft
// layers' grid, in output pixels too). At the reference geometry the boxes are the 320 x 200 picture's.
// `opts.clock(stage)`, when given, is told as each stage ends (the stage times of createEnhancer({ stages })).
export function renderEnhancedScene(P, fine, seat, fb, L, mode, sky, opts, G = IDENTITY) {
  const S = models().sky, at = !G.identity, width = at ? G.W : S.width, height = at ? G.H : fb.length / width, world = P.world, own = fine.seats[seat], force = opts.force ?? NO_FORCE, general = { caster: at || force.caster, blit: at || force.blit }, rows = general.blit ? opts.rows ?? null : null, clock = opts.clock ?? null;
  const soft = at ? opts.soft ?? null : null, from = at ? opts.from ?? 0 : 0, o0 = from * G.s * width, refW = G.refW, refH = models().floor.height, r0 = from * refW; // the first output pixel and reference cell drawn
  const camI = sceneCamera(P), camF = opts.subPixel && own ? { x: own.cx, y: own.cy, heading: at ? fineHeading(own, camI, G, mode) : camI.heading } : camI, horizon = { from: S.horizonRow, to: S.horizonRow + S.horizonRows };
  const template = force.caster && !at ? floorTemplateAt(world, mode, !sky, horizon, IDENTITY, true) : at ? floorTemplateAt(world, mode, !sky, horizon, G) : layerTemplate(world, mode, !sky, horizon);
  if (!at) { fb.fill(0); L.kind.set(template.kind); L.depth.set(template.depth); L.shade.fill(0); L.cast.fill(0); L.mark.fill(0); L.wet.fill(0); }
  else {
    fb.fill(0, o0); L.kind.set(template.kind.subarray(o0), o0); L.depth.set(template.depth.subarray(o0), o0); L.wet.fill(0, o0);
    if (soft) { soft.shade.fill(0, r0); soft.cast.fill(0, r0); soft.mark.fill(0, r0); } else { L.shade.fill(0, o0); L.cast.fill(0, o0); L.mark.fill(0, o0); }
  }
  if (rows) rows.fill(0);
  if (!at) { if (sky) sky(fb); else { renderSky(world.sky, fb); drawHorizonFine(world.par, own ? own.horizon : P.car.horizon, fb); } }
  else if (sky) { const page = opts.page ?? new Uint8Array(S.width * models().floor.height); page.fill(0); sky(page); upscaleRows(page, S.horizonRow + S.horizonRows, fb, G, from); } // the slide's rows 0..129, drawn as the page draws them
  else { drawSkyAt(world.sky, fb, G, from); drawStripAt(world.par, own ? own.horizon : P.car.horizon, fb, G); }
  clock?.('clear');
  const W = opts.water, sunNow = W ? sunDirection(world, opts.sunAngle, camI.heading) : null, glitter = W ? (G.m ? { glitter: sunGlitter(sunNow, new Float32Array(refW), -G.m), x0: -G.m } : { glitter: sunGlitter(sunNow, new Float32Array(S.width)) }) : null; // the glitter of each reference column (the margins' too): the hooks run at the reference samples
  const liquid = W ? { texels: W.liquids.texels, wet: L.wet, wave: L.wave, shade: waterShader(world, { time: opts.now, strength: W.strength, beach: W.beach, ...glitter }) } : null;
  const R = opts.relief, light = R ? groundLight(world, R.ground, { sun: R.sun, strength: R.strength }, at) : null, relief = R ? (soft ? { ref: soft.relief, light } : { out: L.relief, light }) : null, collect = R ? collectFor(opts.collect ?? createCollect(), fb.length) : null;
  if (R) { if (soft) soft.relief.fill(1, r0); else L.relief.fill(1); } // (the reference look's pictures write the output's light of every pixel they draw)
  if (general.caster) drawFloorAt(world, camF, mode, fb, G, { liquid, relief }, true); else drawFloor(world, camF, mode, fb, { liquid, relief });
  clock?.('floor');
  const records = [], frames = own ? { heading: own.tickHeading } : null, main = sceneRecords(P, camI, frames), trace = opts.trace ?? null; // the racers' direction frames stay on the tick's heading
  for (const r of main) {
    const a = camF !== camI ? anchorOf(r, P, fine, seat) : null;
    if (at) { const placed = placeAt(r, world, camF, camI, a, G); if (trace) placed.edge = r.left - r.firstColumn <= 0 || r.left - r.firstColumn + r.picture.w >= S.width; records.push(placed); continue; }
    const moved = a ? refine(r, world, camF, camI, a) : r;
    if (moved) { if (trace) moved.edge = r.left - r.firstColumn <= 0 || r.left - r.firstColumn + r.picture.w >= S.width; records.push(moved); }
  }
  let ordered = sortDrawList(records);
  if (at && G.m > 0 && opts.wide) { // the wide view's margins: the margin records, placed as the main ones, merged into the game's order by distance
    const extra = opts.wide.records(P, camI, frames, main, G, seat).map(r => placeAt(r, world, camF, camI, camF !== camI ? anchorOf(r, P, fine, seat) : null, G));
    ordered = mergeOrder(ordered, sortDrawList(extra));
  }
  const casters = [], casts = [], ground = playerGeometry(world).top + world.carShape[0].h; // the own car's ground row: the row-table bottom of its distance, before the jiggle and the jump
  const lightPictures = R ? { sun: screenSun(sunDirection(world, opts.sunAngle, camI.heading), R.length), luma: paletteLuma(world) } : null;
  const toOut = b => (soft ? { x0: G.s * b.x0, y0: G.s * b.y0, x1: G.s * b.x1 + G.s - 1, y1: G.s * b.y1 + G.s - 1 } : b); // a box of the soft layers' grid in output pixels
  for (const r of ordered) {
    if (!r.skip) {
      const entry = trace ? { margin: Boolean(r.margin), edge: Boolean(r.edge), rect: r.place ? { x0: r.place.x, y0: r.place.y, x1: r.place.x + G.s * r.picture.w - 1, y1: r.place.y + G.s * r.picture.h - 1 } : { x0: r.left, y0: r.top, x1: r.left + r.width - 1, y1: r.top + r.height - 1 }, shade: null, cast: null } : null;
      if (entry) trace.records.push(entry);
      if (R) collect.count = 0;
      const drawn = general.blit ? blitAt(fb, L, r, opts.band, G, { world, collect: R ? collect : null, rows, at: r.place ?? null, sampled: Boolean(soft), from: G.s * from }) : blitLayers(fb, L, r, opts.band, width, height, R ? collect : null);
      // The shadows' grid: the reference picture's (1x), the reference grid (the reference look: the picture's samples at its place over s), or the output's.
      const grid = !at ? null : soft ? { x: r.place.x / G.s, y: r.place.y / G.s, u: 1, m: G.m } : { x: r.place.x, y: r.place.y, u: G.s, m: G.m }, shape = soft ? drawn?.sample ?? null : drawn;
      const c = casterOf(r, P, shape?.foot, ground, opts, grid);
      if (R) pictureLight(L.relief, { drawn: collect.drawn, sources: collect.sources, count: collect.count, fb, width, luma: lightPictures.luma, sun: lightPictures.sun, strength: R.strength, heights: R.frameHeights?.(r.frame) ?? null, ...(at ? { scale: G.s, frame: r.frame } : {}) });
      if (c) { casters.push(c); if (entry) entry.shade = toOut(shadowBox(c, soft ? 1 : G.s)); }
      if (opts.sunShadows) { const s = castOf(r, P, shape, ground, grid); if (s) { casts.push(s); if (entry) s.entry = entry; } }
    }
    if (r.after) for (const d of r.after) { if (general.blit) blitFlatAt(fb, L, d, r.distance, G, Boolean(R), rows, G.s * from); else blitFlatLayers(fb, L, d, r.distance, width, height, Boolean(R)); }
  }
  clock?.('records');
  const target = soft ?? L, gw = soft ? refW : width, gh = soft ? refH : height; // where the soft layers are drawn
  for (const c of casters) { if (at && !soft) stampShadow(L, c, width, height, G.s); else stampShadow(target, c, gw, gh); }
  clock?.('contact');
  if (casts.length) { // the sun shadows, softened
    const sun = sunDirection(world, opts.sunAngle, camI.heading, opts.sunLength), box = { x0: gw, x1: -1, y0: gh, y1: -1 };
    for (const c of casts) {
      if (!c.entry) { castShadow(target, c, world, sun, gw, gh, box); continue; }
      const b = castShadow(target, c, world, sun, gw, gh, { x0: gw, x1: -1, y0: gh, y1: -1 }), blur = at && !soft ? SUN.blur * G.s : SUN.blur; // its own box (the checks' trace), then the frame's
      box.x0 = Math.min(box.x0, b.x0); box.x1 = Math.max(box.x1, b.x1); box.y0 = Math.min(box.y0, b.y0); box.y1 = Math.max(box.y1, b.y1);
      if (b.x1 >= b.x0) c.entry.cast = toOut({ x0: b.x0 - blur, y0: b.y0 - blur, x1: b.x1 + blur, y1: b.y1 + blur });
    }
    clock?.('sun');
    if (at && !soft && G.s > 1) boxBlurCast(L, box, width, height, L.scratch, SUN.blur * G.s); else blurCast(target, box, gw, gh, target.scratch);
  }
  clock?.('blur');
  if (opts.marks) { // the skid marks on the ground
    const quads = trace ? [] : null;
    if (!at) opts.marks.stamp(L, world, camF, opts.now, width, height, null, L.kind, quads); else if (soft) opts.marks.stamp(soft, world, camF, opts.now, refW, refH, { s: 1, m: G.m }, null, quads); else opts.marks.stamp(L, world, camF, opts.now, width, height, G, L.kind, quads);
    if (quads) for (const q of quads) trace.marks.push(toOut({ x0: Math.floor(q.x0), y0: Math.floor(q.y0), x1: Math.ceil(q.x1), y1: Math.ceil(q.y1) }));
  }
  clock?.('marks');
  return camF;
}
