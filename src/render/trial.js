// The time trial's hall of fame screen and name entry (race.time-trial): the ORDER.PCX background, the lines in the large and the small font, the blinking markers and the message boxes.
import { decodePcxMember } from '../formats/pcx.js';
import { drawText } from './text.js';
import { drawBox } from './finish.js';
import { blitFlat } from './sprites.js';
import { loadTiles, drawTile, bigTileOf } from './menu.js';
import { trialFiles, trialMarker } from '../game/timetrial.js';
import { bannerOf } from '../game/cup.js';

const TILE = [15, 13], ADVANCE = 11; // @math the large font's glyph size and advance (text.menu-observed, text.tile-map)

export function loadTrialArt(members) {
  return { background: decodePcxMember(members.get(trialFiles().background)), tiles: loadTiles(members.get('WFONT1.SP')), ofont: members.get('OFONT.SP'), genef: members.get('GENEF.SP') };
}

export const drawBig = (fb, tiles, text, x, y) => [...text].forEach((ch, k) => drawTile(fb, tiles[bigTileOf(ch)], x + ADVANCE * k, y, TILE));

// The screen for a layout (timetrial.layout); `wiggle` is 0 or 1 (the markers move 2 left and 2 down on 1). Returns the palette of the background.
export function renderTrial(fb, art, layout, wiggle) {
  const M = trialMarker(), [w, h] = M.size;
  fb.set(art.background.indices);
  for (const l of layout.lines) (l.font === 'big' ? drawBig(fb, art.tiles, l.text, l.x, l.y) : drawText(fb, art.ofont, l.text, l.x, l.y));
  for (const m of layout.markers) blitFlat(fb, { bytes: art.genef.subarray(M.offset, M.offset + w * h), width: w, height: h, x: m.x - M.wiggle * wiggle, y: m.y + M.wiggle * wiggle });
  return art.background.vga;
}

// A message box over the screen (obj1+0x1a414: the loading card's box at its row).
export function drawMessage(fb, art, text) {
  const b = bannerOf(text);
  drawBox(fb, b.x, b.y, b.width, b.height, b.border, b.fill);
  drawText(fb, art.ofont, text, b.x + b.margin, b.y + b.margin);
}
