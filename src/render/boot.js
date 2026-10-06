// The start-up screens as the game draws them (boot.notice, boot.intro): the notice's texts over CHECK.PCX; the Apogee scene (the high detail floor through a table of
// APOG1.PCX's tiles, the band of APOG1's rows above it and the ACTION.SP strip in its ten sizes); BEAVIS.PCX; WINTRO.PCX with the cars driving away into it.
import { decodePcxMember } from '../formats/pcx.js';
import { floorModel } from './floor.js';
import { parseInf, blitPicture } from './sprites.js';
import { drawText } from './text.js';
import { buildRowTable } from '../game/view.js';
import { introModel, logoPixelAt, sizeClass, carDrawn } from '../game/boot.js';

const asView = b => new DataView(b.buffer, b.byteOffset, b.byteLength);

// The members the start-up draws from, by their archive names.
export function loadBootArt(members) {
  const I = introModel(), need = name => { const data = members.get(name); if (!data) throw new Error(`${name} is not in the archive`); return data; };
  const picture = name => decodePcxMember(need(name));
  return {
    notice: picture('CHECK.PCX'), logo: picture(I.logo), picture: picture(I.picture), title: picture(I.title), ofont: need('OFONT.SP'),
    strip: need(I.strip.member), stripSizes: parseInf(need(I.strip.sizes)), cars: need(I.cars.member), carSizes: parseInf(need(I.cars.sizes)),
    rows: buildRowTable(), world: { trig: asView(need('TRIG.DAT')), ndist: asView(need('NDIST')) },
  };
}

// The notice: CHECK.PCX and the lines of noticeLines.
export function renderNotice(fb, art, lines) {
  fb.set(art.notice.indices);
  for (const l of lines) drawText(fb, art.ofont, l.text, l.x, l.y);
  return fb;
}

// The floor of the scene (floor.render-loop's high detail loop): every column casts the angle heading - 0xa0 + column through the 70 NDIST distances, and each hit takes
// the pixel of APOG1's tile at that point; the rows run up from the bottom row.
function drawLogoFloor(fb, art, camera) {
  const F = floorModel(), half = F.trigEntryBytes / 2, { trig, ndist } = art.world, logo = art.logo.indices; // @math the second dword of a TRIG entry
  let angle = (((camera.heading - F.angleBias) % F.wrap) + F.wrap) % F.wrap;
  for (let c = 0; c < F.columns; c++) {
    const v0 = trig.getUint32(angle * F.trigEntryBytes, true), v1 = trig.getUint32(angle * F.trigEntryBytes + half, true);
    for (let k = 0; k < F.steps; k++) {
      const n = ndist.getUint32((c * F.groupDwords + k) * F.ndistDwordBytes, true);
      const x = ((Math.imul(v0, n) >>> F.fixedBits) + camera.x) & 0xffff, y = ((Math.imul(v1, n) >>> F.fixedBits) + camera.y) & 0xffff; // @math the low 32 bits shifted, 16-bit sums
      const at = logoPixelAt(x, y);
      fb[(F.bottomRow - k) * F.width + c] = at < 0 ? 0 : logo[at];
    }
    angle++;
    if (angle >= F.wrap) angle = F.resetTo;
  }
}

// A picture of the size class of `distance` from an .INF table, centred on `column`, its bottom on the row table's row for the distance less `raise`.
function drawScaled(fb, art, sizes, frame, distance, column, raise = 0) {
  const picture = sizes[sizeClass(distance)], top = art.rows[distance] - picture.h - raise;
  blitPicture(fb, picture, frame, column - (picture.w >> 1), top); // @math half the width
  return top;
}

// One pass of the scene: the cleared page, the floor, APOG1's rows from 0x36 in the band's rows, the strip when it is on.
export function renderScene(fb, art, scene) {
  const I = introModel(), F = floorModel();
  fb.fill(0);
  drawLogoFloor(fb, art, { x: scene.x, y: scene.y, heading: scene.heading });
  fb.set(art.logo.indices.subarray(I.band.sourceRow * F.width, (I.band.sourceRow + scene.height) * F.width), scene.top * F.width);
  if (scene.strip) drawScaled(fb, art, art.stripSizes, art.strip, scene.distance, I.strip.column, scene.raise);
  return fb;
}

// BEAVIS.PCX.
export function renderPicture(fb, art) { fb.set(art.picture.indices); return fb; }

// WINTRO.PCX and the started cars (frame 4 of each slot of CARS.SP, 38 x 28) at their distances, centred; a car whose top is below the last row is not drawn.
export function renderTitle(fb, art, cars) {
  const C = introModel().cars, bytes = art.cars.length / (C.count * SLOT_FRAMES); // @math the frames of CARS.SP are equal in size
  fb.set(art.title.indices);
  if (!cars) return fb;
  cars.list.forEach((c, k) => {
    if (!carDrawn(c)) return;
    const picture = art.carSizes[sizeClass(c.d)], top = art.rows[c.d] - picture.h;
    if (top > C.maxRow) return;
    const at = (k * SLOT_FRAMES + C.frame) * bytes;
    blitPicture(fb, picture, art.cars.subarray(at, at + bytes), C.centre - (picture.w >> 1), top); // @math half the width
  });
  return fb;
}
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames: 8 slots of 12 frames)
