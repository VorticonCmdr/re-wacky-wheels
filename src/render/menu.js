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

const TILEMAP = () => K({ routine: 0x46d4, dispatch: 0x4758, tableAt: 0xa888, advance: 11, letterBase: 0x41, letterLast: 0x5a, digitFirst: 0x30, digitLast: 0x39, digitBase: 0x16, space: 0x24, punctuation: { 0x20: 0x24, 0x2e: 0x25, 0x3c: 0x26, 0x23: 0x27, 0x3e: 0x27, 0x21: 0x28, 0x3f: 0x29, 0x7e: 0x29 } }, 'text.tile-map');

// The tile of any character as the large text routine picks it (text.tile-map): the characters it has no tile for are drawn as the space.
export function bigTileOf(ch) {
  const T = TILEMAP(), code = ch.charCodeAt(0);
  if (code >= T.letterBase && code <= T.letterLast) return code - T.letterBase;
  if (code >= T.digitFirst && code <= T.digitLast) return code - T.digitBase;
  return T.punctuation[code] ?? T.space;
}

export function tileOf(ch) {
  const M = MAIN();
  if (ch === ' ') return M.spaceTile;
  if (ch === '-') return M.hyphenTile;
  if (ch === '\u2122') return M.tradeMarkTile;
  if (ch.length === 1 && ch >= '0' && ch <= '9') return M.spaceTile - 10 + Number(ch); // @math the ten digit tiles lie just below the space tile: 26 to 35 (text.menu-observed)
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

const SCREEN_MODEL = () => K({ background: 'CHECK.PCX', screenWidth: 320, items: { lead: 1, trail: 1 }, lions: { member: 'HANDLE.SP', size: [20, 23], frameBytes: 460, frames: [0, 4], above: 7, left: 18, rightBack: 1 }, cars: { member: 'CARS.SP', inf: '38X28.INF', frameBytes: 1064, slots: 8, slotFrames: 12, cycle: 8, centres: [27, 294], tops: [2, 3, 4, 6, 7, 8, 9, 10, 11, 12], bottomDelta: 168, layouts: { main: { centre: 130, cars: [[0, 0, 6], [1, 0, 7]] }, sub: { centre: 112, cars: [[0, 0, 4], [0, 1, 5], [1, 0, 6], [1, 1, 7]] } } } }, 'menu.screen-model');

// Where a menu's bars and icons go (menu.screen-model): the bars are centred across the screen by their text width, the block of rows about a centre row
// that depends on the variant (the main menu 130, the submenus 112). `items` are the item texts; the bars are all as long as the longest item.
export function layoutOf(kind, items, centre = null) {
  const S = SCREEN_MODEL(), M = MAIN(), max = Math.max(...items.map(t => [...t].length)), chars = max + S.items.lead + S.items.trail;
  return { max, x0: Math.floor((S.screenWidth - chars * M.step) / 2), y0: (centre ?? S.cars.layouts[kind].centre) - (M.lineStep * items.length) / 2, width: chars * M.step + (M.tile[0] - M.step) }; // @math the tiles overlap by their width less the step
}

// The row just below the last bar of a menu.
export const menuBottom = (kind, items, centre = null) => layoutOf(kind, items, centre).y0 + MAIN().lineStep * items.length;

// The row the selection icons rest at for a cursor (1-based).
export function lionTopFor(kind, items, cursor, centre = null) {
  const S = SCREEN_MODEL(), M = MAIN();
  return layoutOf(kind, items, centre).y0 - S.lions.above + M.lineStep * (cursor - 1); // @math the cursor counts from 1
}

// An item as the game draws it: a space tile in front, the text, then spaces up to the longest item and one more behind, so the bars are all one length.
export function drawItem(fb, tiles, text, x0, y, max) {
  const M = MAIN(), P = SCREEN_MODEL().items, chars = [...' '.repeat(P.lead), ...text, ...' '.repeat(max - [...text].length + P.trail)];
  chars.forEach((ch, k) => drawTile(fb, tiles[tileOf(ch)], x0 + M.step * k, y, M.tile));
}

// The menu's pictures, decoded once: the background, the font tiles, the lion frames and the car pictures with their ten sizes.
export function loadMenuArt(members) {
  const S = SCREEN_MODEL(), title = decodePcxMember(members.get(S.background));
  return { title, tiles: loadTiles(members.get(MAIN().member)), handle: members.get(S.lions.member), cars: members.get(S.cars.member), sizes: parseInf(members.get(S.cars.inf)) };
}

// The whole screen for a state: { kind ('main' or 'sub'), items (the texts), lionTop (the row of the selection icons), lionFrame (0 to 3),
// pair (the car slot pair), size (0 to 9), frame (0 to 7 within the cycle) }. Returns the picture's palette (6-bit, as the game's buffer).
export function renderMenu(fb, art, state) {
  const S = SCREEN_MODEL(), M = MAIN(), L = layoutOf(state.kind, state.items);
  fb.set(art.title.indices);
  state.items.forEach((text, m) => drawItem(fb, art.tiles, text, L.x0, L.y0 + M.lineStep * m, L.max));
  [L.x0 - S.lions.left, L.x0 + L.width - S.lions.rightBack].forEach((x, side) => {
    const f = S.lions.frames[side] + state.lionFrame, top = state.lionTop, [w, h] = S.lions.size;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = art.handle[f * S.lions.frameBytes + i * h + j]; if (v !== 0) fb[(top + j) * SCREEN.width + x + i] = v; }
  });
  const picture = art.sizes[state.size];
  S.cars.layouts[state.kind].cars.forEach(([side, bottom, offset]) => {
    const f = state.frame, slot = (state.pair + offset) % S.cars.slots, frame = slot * S.cars.slotFrames + (side === 0 ? f : S.cars.cycle - 1 - f); // the right cars are the mirror in the cycle
    blitRecord(fb, { picture, width: picture.w, height: picture.h, left: S.cars.centres[side] - (picture.w >> 1), top: S.cars.tops[state.size] + bottom * S.cars.bottomDelta, firstColumn: 0, skipRows: 0, frame: art.cars.subarray(frame * S.cars.frameBytes, (frame + 1) * S.cars.frameBytes) });
  });
  return art.title.vga;
}

// How many corner cars a menu variant shows.
export const carCount = kind => SCREEN_MODEL().cars.layouts[kind].cars.length;

// The bars and the selection icons of a menu drawn over the picture that is already in `fb` (the in-race menu, race.pause-menu): `state` is { items, centre, lionTop, lionFrame }.
export function renderMenuOverlay(fb, art, state) {
  const S = SCREEN_MODEL(), M = MAIN(), L = layoutOf(null, state.items, state.centre);
  state.items.forEach((text, m) => drawItem(fb, art.tiles, text, L.x0, L.y0 + M.lineStep * m, L.max));
  [L.x0 - S.lions.left, L.x0 + L.width - S.lions.rightBack].forEach((x, side) => {
    const f = S.lions.frames[side] + state.lionFrame, top = state.lionTop, [w, h] = S.lions.size;
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = art.handle[f * S.lions.frameBytes + i * h + j]; if (v !== 0) fb[(top + j) * SCREEN.width + x + i] = v; }
  });
}
