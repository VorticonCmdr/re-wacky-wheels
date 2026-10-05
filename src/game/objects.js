// The static objects of a track (the .SPW records), their frames and the draw records the object pass makes of them (obj1+0x15a78).
import { K } from '../evidence/k.js';
import { projectPoint } from './view.js';

const MODEL = () => K({ fixedBits: 16, tan: 37837, center: 160, maxColumn: 319, viewShift: 14, viewRound: 8096, minDistance: 80, maxDistance: 1122, sizeBase: 124, sizeStep: 70, maxSize: 9, maxRow: 199, worldOffset: 1024, fanHalf: 160, fanReach: 1122, rowFirst: 240, rowNumerator: 18000, rowMinimum: 21, rowMaximum: 240, rowBase: 120, rowEntries: 4096, trigEntryBytes: 8, turn: 1920, slopeBytes: 4, viewBytes: 4, rounding: 32768 }, 'view.model');
const ANIMATION = () => K({ offset: 20, step: 1, counter: 0, lag: 1 }, 'object.animation');
const CONSUMED = 0xffff; // @math the consumed marker of atr.kind-effects

// The part of a picture that lies on the screen (the clipping of the object pass): the visible width and height, the left and top, the columns and rows skipped; null when nothing shows.
export function clipPicture(hit, picture) {
  const V = MODEL();
  let width = picture.w, height = picture.h, left = hit.column - (picture.w >> 1), top = hit.bottom - picture.h, skipRows = 0, firstColumn = 0; // @math half the width, rounded down
  if (top > V.maxRow) return null;
  if (left < 0) { firstColumn = -left; width -= firstColumn; if (width <= 0) return null; left = 0; }
  else if (left + picture.w - 1 > V.maxColumn) { width -= left + picture.w - 1 - V.maxColumn; if (width <= 0) return null; }
  if (top + picture.h - 1 > V.maxRow) { const cut = top + picture.h - 1 - V.maxRow; height -= cut; if (height <= 0) return null; skipRows = cut; }
  return { width, height, left, top, firstColumn, skipRows };
}

// One draw record of a static object, or null: the picture of its shape and size class, clipped to the screen as the routine does.
export function objectRecord(world, view, camera, index, object) {
  if (object.consumed === CONSUMED || object.consumed === -1) return null; // @math the word is read as 0xffff or -1
  const hit = projectPoint(world, view, camera, object.x, object.y, world.rows);
  if (!hit) return null;
  const sprite = world.sprites[object.id], picture = world.shapes.get(sprite.shape)[hit.sizeClass], clip = clipPicture(hit, picture);
  if (!clip) return null;
  const frameBytes = sprite.width * sprite.height;
  return { ...clip, picture, frame: sprite.data.subarray(object.frame * frameBytes, (object.frame + 1) * frameBytes), distance: hit.distance, sizeClass: hit.sizeClass, type: -1, racer: -1, object: index };
}

// The records of all objects, in the order of the table.
export function objectRecords(world, view, camera, objects = world.objects) {
  const out = [];
  objects.forEach((o, i) => { const r = objectRecord(world, view, camera, i, o); if (r) out.push(r); });
  return out;
}

// The frame an object shows after `ticks` frames of the race (object.animation): every object advances one frame a tick through the frames of its sprite, from the common phase 20.
export function objectFrame(world, id, ticks, offset = null) { // `offset` replaces the common phase 20 of a race that starts with the camera's fly-by (the shoot-out has none: versus.shootout-rules)
  const A = ANIMATION(), frames = world.sprites[id].frames;
  return (ticks * A.step + (offset ?? A.offset)) % frames;
}
