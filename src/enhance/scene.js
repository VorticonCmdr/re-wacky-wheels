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
import { drawFloor, layerTemplate, projectFine, roundWord, KIND } from './project.js';
import { stampShadow, casterOf, castOf, castShadow, sunDirection, blurCast } from './shadows.js';
import { models } from './models.js';

// The layers beside an indexed picture: the kind and the distance of every pixel, the contact shadows, the sun shadows and the skid marks
// on the ground, and a scratch buffer for the blur.
export function createLayers(size) {
  return { kind: new Uint8Array(size), depth: new Float32Array(size), shade: new Float32Array(size), cast: new Float32Array(size), mark: new Float32Array(size), scratch: new Float32Array(size) };
}
export const LAYER_KEYS = ['kind', 'depth', 'shade', 'cast', 'mark'];

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

// blitRecord of render/sprites.js, writing the kind and the distance of every pixel. Returns null for a picture with no opaque pixel, else
// { foot, cols }: the footprint the scenery shadows use (the leftmost and rightmost opaque columns of the `band` part of the picture's rows
// above its lowest opaque row, and how many rows that row stands above the picture's bottom: a bouncing object's frame), and for each drawn
// column the highest and lowest opaque picture row (-1 for none), the silhouette the sun shadows cast.
function blitLayers(fb, L, rec, band, width, height) {
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
        if (x >= 0 && x < width && y >= 0 && y < height) { const o = y * width + x; fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = rec.distance; }
      }
      source += picture.deltas[at++];
    }
  }
  if (low < 0) return null;
  let minX = width, maxX = -1;
  for (let j = Math.max(low + 1 - Math.max(Math.round(picture.h * band), 1), 0); j <= low; j++) if (rowMax[j] >= 0) { minX = Math.min(minX, rowMin[j]); maxX = Math.max(maxX, rowMax[j]); }
  return { foot: { minX, maxX, lift: picture.h - 1 - low }, cols };
}

// blitFlat of render/sprites.js with the layers (the effects drawn after the own car stand at its distance).
function blitFlatLayers(fb, L, d, distance, width, height) {
  for (let i = 0; i < d.width; i++) {
    const x = d.x + i;
    for (let j = 0; j < d.height; j++) {
      const y = d.y + j, pixel = d.bytes[i * d.height + j];
      if (pixel !== 0 && x >= 0 && x < width && y >= 0 && y < height) { const o = y * width + x; fb[o] = pixel; L.kind[o] = KIND.sprite; L.depth[o] = distance; }
    }
  }
}

// Draws the viewer's world into `fb` (indexed) and `L` (kind, depth, contact and sun shadows, skid marks). `P` is the present state with the viewer's seat swapped in,
// `fine` the blend with fractions, `seat` the viewer's seat, `mode` the detail level, `sky` the demo's sky (or null), `opts` the settings.
// Returns the camera the frame was drawn from (with fractions) for the particles.
export function renderEnhancedScene(P, fine, seat, fb, L, mode, sky, opts) {
  const S = models().sky, width = S.width, height = fb.length / width, world = P.world, own = fine.seats[seat];
  const camI = sceneCamera(P), camF = opts.subPixel && own ? { x: own.cx, y: own.cy, heading: camI.heading } : camI;
  const template = layerTemplate(world, mode, !sky, { from: S.horizonRow, to: S.horizonRow + S.horizonRows });
  fb.fill(0); L.kind.set(template.kind); L.depth.set(template.depth); L.shade.fill(0); L.cast.fill(0); L.mark.fill(0);
  if (sky) sky(fb); else { renderSky(world.sky, fb); drawHorizonFine(world.par, own ? own.horizon : P.car.horizon, fb); }
  drawFloor(world, camF, mode, fb);
  const records = [];
  for (const r of sceneRecords(P, camI, own ? { heading: own.tickHeading } : null)) { // the racers' direction frames stay on the tick's heading
    const a = camF !== camI ? anchorOf(r, P, fine, seat) : null, moved = a ? refine(r, world, camF, camI, a) : r;
    if (moved) records.push(moved);
  }
  const casters = [], casts = [], ground = playerGeometry(world).top + world.carShape[0].h; // the own car's ground row: the row-table bottom of its distance, before the jiggle and the jump
  for (const r of sortDrawList(records)) {
    if (!r.skip) {
      const drawn = blitLayers(fb, L, r, opts.band, width, height), c = casterOf(r, P, drawn?.foot, ground, opts);
      if (c) casters.push(c);
      if (opts.sunShadows) { const s = castOf(r, P, drawn, ground); if (s) casts.push(s); }
    }
    if (r.after) for (const d of r.after) blitFlatLayers(fb, L, d, r.distance, width, height);
  }
  for (const c of casters) stampShadow(L, c, width, height);
  if (casts.length) { // the sun shadows, softened
    const sun = sunDirection(world, opts.sunAngle, camI.heading), box = { x0: width, x1: -1, y0: height, y1: -1 };
    for (const c of casts) castShadow(L, c, world, sun, width, height, box);
    blurCast(L, box, width, height, L.scratch);
  }
  if (opts.marks) opts.marks.stamp(L, world, camF, opts.now, width, height); // the skid marks on the ground
  return camF;
}
