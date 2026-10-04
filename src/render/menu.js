// The main menu screen as the game draws it (menu.main-observed, text.menu-observed): the title picture, then the nine items drawn one 15 x 13 tile
// of WFONT1.SP per character, 11 columns apart, 12 rows apart. The tile carries the character and the piece of the black bar behind it.
import { K } from '../evidence/k.js';
import { UNKNOWN } from '../evidence/unknown.js';
import { decodePcxMember } from '../formats/pcx.js';

const MAIN = () => K({ member: 'WFONT1.SP', tile: [15, 13], tiles: 42, x0: 50, y0: 76, step: 11, lineStep: 12, items: ['SINGLE PLAYER RACING', 'TWO PLAYER RACE', 'TWO PLAYER SHOOT OUT', 'WACKY DUCK SHOOT', 'COMM-BAT\u2122 PLAY', 'GAME OPTIONS', 'WACKY WHEELS INFO', 'ORDERING INFO', 'LEAVE GAME'], letterBase: 0x41, spaceTile: 36, hyphenTile: 39, tradeMarkTile: 41, positions: 137 }, 'menu.main-observed');
const TITLE = 'WINTRO.PCX'; // boot.pictures-observed: the picture the menu is drawn over

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

export function drawItem(fb, tiles, text, m) {
  const M = MAIN();
  [...text].forEach((ch, k) => drawTile(fb, tiles[tileOf(ch)], M.x0 + M.step * k, M.y0 + M.lineStep * m, M.tile));
}

// The whole screen: the picture's indexes, then every item in order. Returns the picture's palette (6-bit, as the game's buffer).
export function renderMenu(fb, title, tiles) {
  fb.set(title.indices);
  menuItems().forEach((text, m) => drawItem(fb, tiles, text, m));
  return fb;
}

export const loadTitle = members => decodePcxMember(members.get(TITLE));

// The selected item's look (the highlight, the lion icons) is not observed: a visible placeholder box in the left margin stands in for it
// (menu.selection-look is UNKNOWN), drawn in the palette's brightest colour.
export function brightest(vga) {
  let best = 0, bestSum = -1;
  for (let i = 0; i < vga.length / 3; i++) { const s = vga[i * 3] + vga[i * 3 + 1] + vga[i * 3 + 2]; if (s > bestSum) { bestSum = s; best = i; } } // @math three components an entry
  return best;
}

export function drawPlaceholder(fb, selected, color) {
  UNKNOWN('UNKNOWN_MENU_SELECTION_LOOK'); // noted as a step of the frame
  const M = MAIN(), x = M.x0 - 10, y = M.y0 + M.lineStep * selected + 3; // @math ten columns left of the item, three rows down: a marker beside the bar
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if ((i + j) % 2 === 0 || i === 0 || j === 0 || i === 6 || j === 6) fb[(y + j) * SCREEN.width + x + i] = color; // @math a hatched 7 x 7 box
}
