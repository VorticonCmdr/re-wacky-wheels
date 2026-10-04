// The main menu screen as the game draws it (menu.main-observed, text.menu-observed): the title picture, then the nine items drawn one 15 x 13 tile
// of WFONT1.SP per character, 11 columns apart, 12 rows apart. The tile carries the character and the piece of the black bar behind it.
import { K } from '../evidence/k.js';
import { decodePcxMember } from '../formats/pcx.js';
import { parseInf, blitRecord } from './sprites.js';

const MAIN = () => K({ member: 'WFONT1.SP', tile: [15, 13], tiles: 42, x0: 50, y0: 76, step: 11, lineStep: 12, items: ['SINGLE PLAYER RACING', 'TWO PLAYER RACE', 'TWO PLAYER SHOOT OUT', 'WACKY DUCK SHOOT', 'COMM-BAT\u2122 PLAY', 'GAME OPTIONS', 'WACKY WHEELS INFO', 'ORDERING INFO', 'LEAVE GAME'], letterBase: 0x41, spaceTile: 36, hyphenTile: 39, tradeMarkTile: 41, positions: 137 }, 'menu.main-observed');

export const menuItems = () => MAIN().items;

// The tiles of the font file: each a column-major 15 x 13 block, zero bytes transparent.
export function loadTiles(data) {
  const M = MAIN(), tileBytes = M.tile[0] * M.tile[1];
  if (data.length !== tileBytes * M.tiles) throw new Error(`${M.member} has ${data.length} bytes, not ${M.tiles} tiles`);
  return Array.from({ length: M.tiles }, (_, t) => data.subarray(t * tileBytes, (t + 1) * tileBytes));
}

export function tileOf(ch) {
  const M = MAIN();
  if (ch === ' ') return M.spaceTile;
  if (ch === '-') return M.hyphenTile;
  if (ch === '\u2122') return M.tradeMarkTile;
  const t = ch.charCodeAt(0) - M.letterBase;
  if (t < 0 || t >= M.spaceTile - 10 || ch.length !== 1) throw new Error(`no proven tile for the character ${JSON.stringify(ch)}`); // @math the letters A to Z are the tiles 0 to 25: the space tile less the ten digit tiles
  return t;
}

export function drawTile(fb, tile, x, y, [w, h]) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    const v = tile[i * h + j];
    if (v !== 0 && x + i >= 0 && x + i < SCREEN.width && y + j >= 0 && y + j < SCREEN.height) fb[(y + j) * SCREEN.width + x + i] = v;
  }
}
const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on (floor.model and every observation read 320 x 200)

const SCREEN_MODEL = () => K({ background: 'CHECK.PCX', items: { lead: 1, trail: 1, width: 20 }, lions: { member: 'HANDLE.SP', size: [20, 23], frameBytes: 460, frames: [0, 4], x: [21, 284], top: 69, step: 12 }, cars: { member: 'CARS.SP', inf: '38X28.INF', frameBytes: 1064, slots: 8, slotFrames: 12, cycle: 8, pairSlots: [6, 7], centres: [27, 294], tops: [2, 3, 4, 6, 7, 8, 9, 10, 11, 12] } }, 'menu.screen-model');

// An item as the game draws it: a space tile in front, the text, then spaces up to the width of the longest item and one more behind, so the bars are all the same length.
export function drawItem(fb, tiles, text, m) {
  const M = MAIN(), P = SCREEN_MODEL().items, chars = [...' '.repeat(P.lead), ...text, ...' '.repeat(P.width - [...text].length + P.trail)];
  chars.forEach((ch, k) => drawTile(fb, tiles[tileOf(ch)], M.x0 + M.step * (k - P.lead), M.y0 + M.lineStep * m, M.tile));
}

// The menu's pictures, decoded once: the background, the font tiles, the lion frames and the car pictures with their ten sizes.
export function loadMenuArt(members) {
  const S = SCREEN_MODEL(), title = decodePcxMember(members.get(S.background));
  return { title, tiles: loadTiles(members.get(MAIN().member)), handle: members.get(S.lions.member), cars: members.get(S.cars.member), sizes: parseInf(members.get(S.cars.inf)) };
}

// The whole screen for a state: { lionTop (the row the selection icons are drawn at), lionFrame (0 to 3), pair (the car slot pair), size (0 to 9), frame (0 to 7 within the cycle) }.
// Returns the picture's palette (6-bit, as the game's buffer).
export function renderMenu(fb, art, state) {
  const S = SCREEN_MODEL();
  fb.set(art.title.indices);
  menuItems().forEach((text, m) => drawItem(fb, art.tiles, text, m));
  S.lions.x.forEach((x, side) => {
    const f = S.lions.frames[side] + state.lionFrame, top = state.lionTop, [w, h] = S.lions.size;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = art.handle[f * S.lions.frameBytes + i * h + j]; if (v !== 0) fb[(top + j) * SCREEN.width + x + i] = v; }
  });
  const picture = art.sizes[state.size], slots = [(state.pair + S.cars.pairSlots[0]) % S.cars.slots, (state.pair + S.cars.pairSlots[1]) % S.cars.slots];
  slots.forEach((slot, side) => {
    const frame = slot * S.cars.slotFrames + (side === 0 ? state.frame : S.cars.cycle - 1 - state.frame); // the right car is the mirror in the cycle
    blitRecord(fb, { picture, width: picture.w, height: picture.h, left: S.cars.centres[side] - (picture.w >> 1), top: S.cars.tops[state.size], firstColumn: 0, skipRows: 0, frame: art.cars.subarray(frame * S.cars.frameBytes, (frame + 1) * S.cars.frameBytes) });
  });
  return art.title.vga;
}
