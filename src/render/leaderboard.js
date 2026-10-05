// The leaderboard screen (race.leaderboard): the ORDER.PCX background, the tile font title and the rows of names, points and driver pictures.
import { decodePcxMember } from '../formats/pcx.js';
import { drawText } from './text.js';
import { drawTile, tileOf, loadTiles } from './menu.js';
import { boardBackground, boardPicture } from '../game/leaderboard.js';

const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on
const TILE = [15, 13]; // @math the tile font's glyph size (text.menu-observed)
const ADVANCE = 11; // @math the tile font's advance (text.menu-observed, race.leaderboard)
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames: 8 slots of 12 frames)

export function loadBoardArt(members) {
  return { background: decodePcxMember(members.get(boardBackground())), tiles: loadTiles(members.get('WFONT1.SP')), ofont: members.get('OFONT.SP'), cars: members.get('CARS.SP') };
}

const drawBig = (fb, tiles, text, x, y) => [...text].forEach((ch, k) => drawTile(fb, tiles[tileOf(ch)], x + ADVANCE * k, y, TILE));

// A slot's frame of CARS.SP, the size of the largest car picture.
function drawFrame(fb, cars, slot, frame, x, y) {
  const [w, h] = boardPicture(), at = (slot * SLOT_FRAMES + frame) * w * h;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = cars[at + i * h + j], px = x + i, py = y + j; if (v !== 0 && px >= 0 && px < SCREEN.width && py >= 0 && py < SCREEN.height) fb[py * SCREEN.width + px] = v; }
}

// The whole screen for a layout; `frame` is the slot frame of the human's picture. Returns the picture's palette (6-bit).
export function renderBoard(fb, art, layout, frame) {
  fb.set(art.background.indices);
  drawBig(fb, art.tiles, layout.title, layout.titleX, layout.titleY);
  layout.headerAt.forEach(([x, y]) => drawBig(fb, art.tiles, layout.header, x, y));
  for (const r of layout.rows) {
    drawText(fb, art.ofont, r.name, r.x, r.y);
    drawText(fb, art.ofont, r.points, r.pointsX, r.y);
    drawFrame(fb, art.cars, r.slot, r.human ? frame : 0, r.pictureX, r.y);
  }
  return art.background.vga;
}
