// The name entry and the FAMOUS DRIVERS board (race.hall-of-fame): the LEAD.PCX picture with the entry's texts and cup, or the class box with the four records of a group.
import { decodePcxMember } from '../formats/pcx.js';
import { drawText } from './text.js';
import { drawBox } from './finish.js';
import { blitFlat } from './sprites.js';
import { loadTiles } from './menu.js';
import { hallFiles, hallEntryGeometry } from '../game/halloffame.js';
import { drawBig } from './trial.js';

const SCREEN = 320; // @math the screen is 320 columns wide
const CAR = [38, 28], WHEEL = [28, 23], CAR_BYTES = 38 * 28, WHEEL_BYTES = 0x284; // @math the CARS.SP frame and the GENEF.SP wheel pieces (cars.frames, race.rostrum)
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP

export function loadFamousArt(members) {
  return { picture: decodePcxMember(members.get(hallFiles().picture)), tiles: loadTiles(members.get('WFONT1.SP')), ofont: members.get('OFONT.SP'), cars: members.get('CARS.SP'), genef: members.get('GENEF.SP') };
}

// The entry screen for the typed state: over `picture` (default LEAD.PCX) with a title in the large font when given ({ text, y }, the time trial's). Returns the palette of the picture.
export function renderEntry(fb, art, entry, picture = art.picture, title = null) {
  const G = hallEntryGeometry();
  fb.set(picture.indices);
  if (title) drawBig(fb, art.tiles, title.text, Math.floor(Math.abs(SCREEN - 11 * title.text.length) / 2), title.y); // @math the large font advances 11; centred
  drawText(fb, art.ofont, G.prompt, G.promptAt[0], G.promptAt[1]);
  drawText(fb, art.ofont, entry.name, G.typedAt[0], G.typedAt[1]);
  const [w, h] = G.cup.size;
  blitFlat(fb, { bytes: art.genef.subarray(G.cup.offset, G.cup.offset + w * h), width: w, height: h, x: entry.cursor, y: G.typedAt[1] + G.cup.dy });
  return picture.vga;
}

// The board for a layout (hall.boardLayout). Returns the palette of the picture.
export function renderFamous(fb, art, layout) {
  fb.set(art.picture.indices);
  const b = layout.banner, width = 8 * layout.title.length + 8, x = Math.floor((SCREEN - width) / 2); // @math 8 columns a character and 8 more, centred
  drawBox(fb, x, b.y, width, b.height, b.border, b.fill);
  drawText(fb, art.ofont, layout.title, x + b.margin, b.y + b.margin);
  for (const r of layout.rows) {
    drawText(fb, art.ofont, r.name, r.nameX, r.nameY);
    const at = (r.slot * SLOT_FRAMES) * CAR_BYTES;
    blitFlat(fb, { bytes: art.cars.subarray(at, at + CAR_BYTES), width: CAR[0], height: CAR[1], x: r.carX, y: r.carY });
    drawText(fb, art.ofont, r.date, r.dateX, r.dateY);
    const piece = r.wheelPiece * WHEEL_BYTES;
    if (r.wheelPiece >= 0 && piece + WHEEL_BYTES <= art.genef.length) blitFlat(fb, { bytes: art.genef.subarray(piece, piece + WHEEL_BYTES), width: WHEEL[0], height: WHEEL[1], x: r.wheelX, y: r.wheelY });
    drawText(fb, art.ofont, r.points, r.pointsX, r.pointsY);
  }
  drawText(fb, art.ofont, layout.label.text, layout.label.x, layout.label.y);
  return art.picture.vga;
}
