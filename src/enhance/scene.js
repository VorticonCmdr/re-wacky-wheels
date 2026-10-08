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
import { drawFloor, layerTemplate, projectFine, projectAt, roundWord, rowAt, KIND } from './project.js';
import { drawFloorAt, floorTemplateAt } from './caster.js';
import { blitAt, blitFlatAt, shapeOf, smoothSize, smoothMap } from './blit.js';
import { IDENTITY, standingRow, rowLaw } from './geometry.js';
import { drawSkyAt, drawStripAt, upscaleRows } from './sky-hd.js';
import { stampShadow, casterOf, castOf, castShadow, sunDirection, blurCast, boxBlurCast, shadowBox } from './shadows.js';
import { stripSkyIndices } from './clouds.js';
import { tileHook } from './art.js';
import { angleRecords } from './angles.js';
import { waterShader, sunGlitter } from './water.js';
import { groundLight, pictureLight, screenSun, paletteLuma } from './relief.js';
import { SUN, RENDER } from './config.js';
import { mergeOrder, recordKey } from './wide.js';
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
// With an artwork pack's picture (blit.js blitArt) the list also holds each pixel's brightness (`lumas`) and `art` is set.
export const createCollect = () => ({ drawn: new Int32Array(0), sources: new Int32Array(0), lumas: new Float32Array(0), count: 0, art: false });
function collectFor(collect, size) {
  if (collect.drawn.length < size) { collect.drawn = new Int32Array(size); collect.sources = new Int32Array(size); collect.lumas = new Float32Array(size); }
  collect.count = 0; collect.art = false;
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

// A record in smooth sizes (Stage 4, M7: RENDER.sizes 'smooth'), or null where it keeps its class (the own car, which stands on its own row
// at class 0 in both modes; a picture that is none of the world's shapes; a frame smaller than its shape's class 0): its whole frame drawn
// at the size blit.js smoothSize gives at the record's fine distance, Wout = max(1, round(s w(d))) by Hout = max(1, round(s h(d))) output
// pixels (blit.js smoothMap), with its ground anchor (the column floor(Wout / 2) of its bottom edge) on the fine column and on the floor's
// own row of the fine distance, never above the row table's last row 131 (geometry.js standingRow): left = round(s (colFine + m)) -
// floor(Wout / 2), top = round(s rowFine) - Hout (`place`, in output pixels; the blit cuts the picture per pixel). The fine column and
// distance are the game's whole-camera place, the record's column and distance (view.js projectPoint's, or wide.js's for a margin record),
// plus the shift of the record's point `a` between the fine and the whole camera's projections (project.js projectAt, the wide projection
// with a margin), unrounded: refine's and placeAt's dc, and the distance's. So at the tick (no shift) they are the game's own: the anchor
// is the classes place's column, and its row is within a reference row of the row table's at every distance (scripts/check-enhance.js
// section 10). The pinhole's unrounded projection alone is up to 7.7 columns and 2.8 units off the game's near the camera, which works with
// whole forward and lateral distances. A record that stands above its row-table row keeps that lift (none does today). The placed record's
// distance is the fine one: the depth layer's and the order's (smoothOrder).
export function placeSmooth(r, world, camF, camI, a, G) {
  const info = r.type === 0 ? null : shapeOf(world, r.picture);
  if (!info || info.W0 * info.H0 > r.frame.length) return null;
  const { s, m } = G, half = r.picture.w >> 1, col0 = r.left - r.firstColumn + half, lift = rowAt(world.rows, r.distance) - (r.top + r.picture.h); // the whole camera's column (refine's recovery) and the record's height above its row
  let dc = 0, dd = 0;
  if (a) {
    const f = projectAt(world, camF, a.x, a.y, G.m), i = projectAt(world, camI, roundWord(a.x), roundWord(a.y), G.m);
    if (f && i) { dc = f.column - i.column; dd = f.distance - i.distance; }
  }
  const d = r.distance + dd, size = smoothSize(info.shape, d), w = Math.max(1, Math.round(s * size.w)), h = Math.max(1, Math.round(s * size.h));
  const x = Math.round(s * (col0 + dc + m)) - (w >> 1), y = Math.round(s * (standingRow(world, d) - lift)) - h;
  return { ...r, left: col0 - half, firstColumn: 0, width: r.picture.w, height: r.picture.h, distance: d, place: { x, y }, smooth: { w, h, map: smoothMap(info.W0, info.H0, w, h) } };
}

// The draw order in smooth sizes (Stage 4, M7): farthest first by the records' fine distances, and records of one distance in the queue order
// of the frame routine (render/scene.js sceneRecords: the intro's human and the racers by index, the objects by index, the own car, the
// starter, the shots by index), told by what each record shows, so a margin record of the wide view (wide.js) takes its place in that queue
// too: one total order, whatever order the records come in. At the tick the fine distances are the game's whole ones and records of one
// distance are common; the game's selection sort (render/draw-list.js sortDrawList), which the classes keep, is not stable, so there the order
// of two such records may differ from the classes' (by design: overlapping pictures of one distance).
const queueGroup = r => (r.type === 0 ? 2 : r.shot !== undefined ? 4 : r.object >= 0 ? 1 : r.type === 1 ? 0 : 3); // @math the queue's groups: racers, objects, the own car, the starter, shots
const queueIndex = r => (r.shot !== undefined ? r.shot : r.object >= 0 ? r.object : r.type === 1 ? r.racer : 0);
export const smoothOrder = records => records.slice().sort((a, b) => b.distance - a.distance || queueGroup(a) - queueGroup(b) || queueIndex(a) - queueIndex(b));

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

// The checks' trace of a record drawn (opts.trace below), in output pixels: its picture's box, its ground anchor (the anchor column of its
// picture's bottom edge) and what it shows; with a place (above 1x, or in smooth sizes) the drawn picture's, else the reference record's.
function traceEntry(r, G) {
  const pw = r.smooth ? r.smooth.w : G.s * r.picture.w, ph = r.smooth ? r.smooth.h : G.s * r.picture.h, ax = r.smooth ? r.smooth.w >> 1 : G.s * (r.picture.w >> 1);
  const rect = r.place ? { x0: r.place.x, y0: r.place.y, x1: r.place.x + pw - 1, y1: r.place.y + ph - 1 } : { x0: r.left, y0: r.top, x1: r.left + r.width - 1, y1: r.top + r.height - 1 };
  const anchor = r.place ? { x: r.place.x + ax, y: r.place.y + ph } : { x: r.left - r.firstColumn + (r.picture.w >> 1), y: r.top + r.picture.h };
  return { margin: Boolean(r.margin), edge: Boolean(r.edge), rect, shade: null, cast: null, key: recordKey(r), anchor, distance: r.distance, smooth: Boolean(r.smooth) };
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
// boxes its contact shadow and its sun cast, blurred, can touch), key (wide.js recordKey: what it shows), anchor (its ground anchor: the
// anchor column of its picture's bottom edge), distance, smooth (drawn in smooth sizes) }, in output pixels, and the box of every skid mark
// quad (drawn on the soft layers' grid, in output pixels too). At the reference geometry the boxes are the 320 x 200 picture's.
// `opts.sizes` 'smooth' (Stage 4, M7: RENDER.sizes, at any geometry, the reference one included) draws every record but the own car at a
// size between the game's classes (placeSmooth: the whole frame at the size of its fine distance, its ground anchor on the floor's own row
// up to the row table's last row, geometry.js standingRow) through blit.js, in smoothOrder (the margin records of the wide view merged into
// it by what they show); their contact shadows and sun casts follow the drawn picture (its box on the shadows' grid) and the casts'
// corners, the skid marks and the particles (index.js) the floor's rows too, so the decals stay on the pictures. The floor is unchanged
// (drawFloor at the reference geometry).
// `opts.clock(stage)`, when given, is told as each stage ends (the stage times of createEnhancer({ stages })).
// `opts.art` (Stage 4, the artwork packs: index.js's bundle { provider (art.js createArtProvider), sky, strip } of the world's pack sky and strip,
// with the art layers in L.art, art.js createArtLayers) draws the packs' art: the floor through the general caster with the provider's tile hook
// where a sheet of the world has art, the sky and the strip through sky-hd.js (a pack sky and strip over the archive's, the strip pixels' sky
// flags), and every record and after-blit through blit.js (a pack's picture of its bytes where the provider has one: provider.frame), at any
// geometry, the reference one included (where the enhancer then takes the draw of a geometry: index.js). Without a pack's art for a picture the
// pictures are the archive's, through the general blit (at the reference geometry blitLayers' own picture).
// `opts.blits(bytes, width, height)` (the checks' region recorder, scripts/check-enhance.js section 5) is told every picture drawn: each record's
// frame with its shape's class 0 size, each after-blit's bytes with its size.
// With the art, the provider's kart angle sets (Stage 4, M4: angles.js angleRecords) give the records of CARS.SP's direction frames of their
// slots a set's picture (a shallow copy with `art`: the set and its index, picked by `opts.angles`, RENDER.angles, from the racer's direction
// against the floor's heading `camF`; the frames are the game's, chosen at the tick's heading as sceneRecords chose them), after the margin
// records are joined, so the wide view's margins are drawn from the sets too. `opts.angleLog` (the checks') is told each record drawn from a set.
export function renderEnhancedScene(P, fine, seat, fb, L, mode, sky, opts, G = IDENTITY) {
  const S = models().sky, at = !G.identity, width = at ? G.W : S.width, height = at ? G.H : fb.length / width, world = P.world, own = fine.seats[seat], force = opts.force ?? NO_FORCE, smooth = opts.sizes === 'smooth', clock = opts.clock ?? null;
  const art = opts.art ?? null, A = art ? L.art : null, tile = art ? tileHook(world, art.provider, A) : null; // the artwork packs' art (above)
  const general = { caster: at || force.caster || tile !== null, blit: at || force.blit || smooth || art !== null }, rows = general.blit ? opts.rows ?? null : null;
  const law = rowLaw(world, opts.sizes); // the decals' row law: the pictures' standing rows in smooth sizes, else the row table (null)
  const soft = at ? opts.soft ?? null : null, from = at ? opts.from ?? 0 : 0, o0 = from * G.s * width, refW = G.refW, refH = models().floor.height, r0 = from * refW; // the first output pixel and reference cell drawn
  const camI = sceneCamera(P), camF = opts.subPixel && own ? { x: own.cx, y: own.cy, heading: at ? fineHeading(own, camI, G, mode) : camI.heading } : camI, horizon = { from: S.horizonRow, to: S.horizonRow + S.horizonRows };
  const template = force.caster && !at ? floorTemplateAt(world, mode, !sky, horizon, IDENTITY, true) : at ? floorTemplateAt(world, mode, !sky, horizon, G) : layerTemplate(world, mode, !sky, horizon);
  if (!at) { fb.fill(0); L.kind.set(template.kind); L.depth.set(template.depth); L.shade.fill(0); L.cast.fill(0); L.mark.fill(0); L.wet.fill(0); }
  else {
    fb.fill(0, o0); L.kind.set(template.kind.subarray(o0), o0); L.depth.set(template.depth.subarray(o0), o0); L.wet.fill(0, o0);
    if (soft) { soft.shade.fill(0, r0); soft.cast.fill(0, r0); soft.mark.fill(0, r0); } else { L.shade.fill(0, o0); L.cast.fill(0, o0); L.mark.fill(0, o0); }
  }
  if (rows) rows.fill(0);
  if (A) { A.direct.fill(0, o0); A.strip = false; }
  if (!at && (!art || sky || (!art.sky && !art.strip))) { if (sky) sky(fb); else { renderSky(world.sky, fb); drawHorizonFine(world.par, own ? own.horizon : P.car.horizon, fb); } } // (at the reference geometry with no pack sky or strip, the reference's own)
  else if (sky) { const page = opts.page ?? new Uint8Array(S.width * models().floor.height); page.fill(0); sky(page); upscaleRows(page, S.horizonRow + S.horizonRows, fb, G, from); } // the slide's rows 0..129, drawn as the page draws them
  else {
    const stripSky = art?.stripSky ?? world.sky, pack = A ? { sky: art.sky, strip: art.strip, A, rows, flags: art.strip ? stripSkyIndices(stripSky === world.sky ? world : { sky: stripSky }) : null, back: stripSky } : null; // the strip against the track's own sky (the split screen's world draws the strips' background)
    if (pack?.sky) art.provider.hits.sky++;
    if (pack?.strip) { art.provider.hits.strip++; A.strip = true; }
    drawSkyAt(world.sky, fb, G, from, pack); drawStripAt(world.par, own ? own.horizon : P.car.horizon, fb, G, pack);
  }
  clock?.('clear');
  const W = opts.water, sunNow = W ? sunDirection(world, opts.sunAngle, camI.heading) : null, glitter = W ? (G.m ? { glitter: sunGlitter(sunNow, new Float32Array(refW), -G.m), x0: -G.m } : { glitter: sunGlitter(sunNow, new Float32Array(S.width)) }) : null; // the glitter of each reference column (the margins' too): the hooks run at the reference samples
  const liquid = W ? { texels: W.liquids.texels, wet: L.wet, wave: L.wave, shade: waterShader(world, { time: opts.now, strength: W.strength, beach: W.beach, ...glitter }) } : null;
  const R = opts.relief, light = R ? groundLight(world, R.ground, { sun: R.sun, strength: R.strength }, at) : null, relief = R ? (soft ? { ref: soft.relief, light } : { out: L.relief, light }) : null, collect = R ? collectFor(opts.collect ?? createCollect(), fb.length) : null;
  if (R) { if (soft) soft.relief.fill(1, r0); else L.relief.fill(1); } // (the reference look's pictures write the output's light of every pixel they draw)
  if (general.caster) drawFloorAt(world, camF, mode, fb, G, { liquid, relief, tile }, true); else drawFloor(world, camF, mode, fb, { liquid, relief });
  clock?.('floor');
  const records = [], frames = own ? { heading: own.tickHeading } : null, main = sceneRecords(P, camI, frames), trace = opts.trace ?? null; // the racers' direction frames stay on the tick's heading
  for (const r of main) {
    const a = camF !== camI ? anchorOf(r, P, fine, seat) : null, sized = smooth ? placeSmooth(r, world, camF, camI, a, G) : null;
    if (sized || at) { const placed = sized ?? placeAt(r, world, camF, camI, a, G); if (trace) placed.edge = r.left - r.firstColumn <= 0 || r.left - r.firstColumn + r.picture.w >= S.width; records.push(placed); continue; }
    const moved = a ? refine(r, world, camF, camI, a) : r;
    if (moved) { if (trace) moved.edge = r.left - r.firstColumn <= 0 || r.left - r.firstColumn + r.picture.w >= S.width; records.push(moved); }
  }
  const margins = at && G.m > 0 && opts.wide ? opts.wide.records(P, camI, frames, main, G, seat) : null; // the wide view's margins: the margin records, placed as the main ones
  const placeMargin = r => { const a = camF !== camI ? anchorOf(r, P, fine, seat) : null; return (smooth ? placeSmooth(r, world, camF, camI, a, G) : null) ?? placeAt(r, world, camF, camI, a, G); };
  let ordered;
  if (smooth) ordered = smoothOrder(margins ? [...records, ...margins.map(placeMargin)] : records); // one stable order by the fine distances, the margin records in the queue
  else { ordered = sortDrawList(records); if (margins) ordered = mergeOrder(ordered, sortDrawList(margins.map(placeMargin))); } // the game's sort; the margin records merged into it by distance
  if (art?.provider.angleSlots) ordered = angleRecords(ordered, { P, world, heading: frames?.heading ?? camI.heading, camera: camF.heading, mode: opts.angles ?? RENDER.defaults.angles, provider: art.provider, seat, log: opts.angleLog ?? null }); // the kart angle sets (the game's records untouched)
  const casters = [], casts = [], ground = playerGeometry(world).top + world.carShape[0].h; // the own car's ground row: the row-table bottom of its distance, before the jiggle and the jump
  const lightPictures = R ? { sun: screenSun(sunDirection(world, opts.sunAngle, camI.heading), R.length), luma: paletteLuma(world) } : null;
  const toOut = b => (soft ? { x0: G.s * b.x0, y0: G.s * b.y0, x1: G.s * b.x1 + G.s - 1, y1: G.s * b.y1 + G.s - 1 } : b); // a box of the soft layers' grid in output pixels
  for (const r of ordered) {
    if (!r.skip) {
      const entry = trace ? traceEntry(r, G) : null;
      if (entry) trace.records.push(entry);
      if (R) { collect.count = 0; collect.art = false; }
      const hit = r.art ? { art: r.art.asset, k: r.art.index } : art ? art.provider.frame(r.frame) : null; // a kart angle set's picture (angleRecords), or a pack's picture of the record's bytes
      if (hit) art.provider.hits[r.art ? 'angles' : 'frames']++;
      if (opts.blits) { const info = shapeOf(world, r.picture); opts.blits(r.frame, info?.W0 ?? r.picture.w, info?.H0 ?? r.picture.h); }
      const drawn = general.blit ? blitAt(fb, L, r, opts.band, G, { world, collect: R ? collect : null, rows, at: r.place ?? null, sampled: Boolean(soft), from: G.s * from, art: hit, luma: lightPictures?.luma ?? null }) : blitLayers(fb, L, r, opts.band, width, height, R ? collect : null);
      // The shadows' grid: the reference picture's (1x, a record with no place), the reference grid (the reference look: the picture's samples at
      // its place over s), or the output's; a picture in smooth sizes gives its drawn box on that grid and the row law its ground stands on.
      const grid = !r.place ? null : soft ? { x: r.place.x / G.s, y: r.place.y / G.s, u: 1, m: G.m } : { x: r.place.x, y: r.place.y, u: G.s, m: G.m }, shape = soft ? drawn?.sample ?? null : drawn;
      if (grid && r.smooth) { const k = grid.u / G.s; grid.box = { w: r.smooth.w * k, h: r.smooth.h * k, ax: (r.smooth.w >> 1) * k }; grid.row = law; } // grid pixels an output pixel
      const c = casterOf(r, P, shape?.foot, ground, opts, grid);
      if (R) pictureLight(L.relief, { drawn: collect.drawn, sources: collect.sources, count: collect.count, fb, width, luma: lightPictures.luma, sun: lightPictures.sun, strength: R.strength, heights: R.frameHeights?.(r.frame) ?? null, lumas: collect.art ? collect.lumas : null, ...(at ? { scale: G.s, frame: r.frame } : {}) });
      if (c) { casters.push(c); if (entry) entry.shade = toOut(shadowBox(c, soft ? 1 : G.s)); }
      if (opts.sunShadows) { const s = castOf(r, P, shape, ground, grid); if (s) { casts.push(s); if (entry) s.entry = entry; } }
    }
    if (r.after) for (const d of r.after) {
      if (opts.blits) opts.blits(d.bytes, d.width, d.height);
      const flatArt = art ? art.provider.frame(d.bytes) : null;
      if (flatArt) art.provider.hits.frames++;
      if (general.blit) blitFlatAt(fb, L, d, r.distance, G, Boolean(R), rows, G.s * from, flatArt); else blitFlatLayers(fb, L, d, r.distance, width, height, Boolean(R));
    }
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
    if (!at) opts.marks.stamp(L, world, camF, opts.now, width, height, null, L.kind, quads, law); else if (soft) opts.marks.stamp(soft, world, camF, opts.now, refW, refH, { s: 1, m: G.m }, null, quads, law); else opts.marks.stamp(L, world, camF, opts.now, width, height, G, L.kind, quads, law);
    if (quads) for (const q of quads) trace.marks.push(toOut({ x0: Math.floor(q.x0), y0: Math.floor(q.y0), x1: Math.ceil(q.x1), y1: Math.ceil(q.y1) }));
  }
  clock?.('marks');
  return camF;
}
