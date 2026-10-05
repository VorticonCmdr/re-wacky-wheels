// The credits screen (menu.credits): the menu picture, the cells of text the car has passed and the car, as the routine obj1+0xefb0 builds them.
import { creditsModel, pageLines } from '../game/credits.js';
import { drawText } from './text.js';
import { blitFlat } from './sprites.js';

const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on

// The art: the menu picture (its palette and indices), the small font and CARS.SP; the text layer of a page (the picture with all twelve lines drawn) is made once.
export const loadCreditsArt = (menuArt, members) => ({ picture: menuArt.title, ofont: members.get('OFONT.SP'), cars: members.get('CARS.SP'), layers: new Map() });

function layerOf(art, page) {
  if (!art.layers.has(page)) {
    const layer = Uint8Array.from(art.picture.indices);
    for (const row of pageLines(page)) if (row.text) drawText(layer, art.ofont, row.text, row.x, row.y);
    art.layers.set(page, layer);
  }
  return art.layers.get(page);
}

// The picture for the state `c` (page, line, x, slot, frame, cells): returns the palette of the picture.
export function renderCredits(fb, art, c) {
  const M = creditsModel(), layer = layerOf(art, c.page), rows = pageLines(c.page), cell = M.glyph; // the cell is as wide and tall as a glyph
  fb.set(art.picture.indices);
  for (const { x, y } of c.cells) {
    for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) {
      const px = x + i, py = y + j;
      if (px >= 0 && px < SCREEN.width && py >= 0 && py < SCREEN.height) fb[py * SCREEN.width + px] = layer[py * SCREEN.width + px];
    }
  }
  const at = c.slot * M.car.slotBytes + c.frame * M.car.frameBytes;
  blitFlat(fb, { bytes: art.cars.subarray(at, at + M.car.frameBytes), width: M.car.width, height: M.car.height, x: c.x, y: rows[c.line - 1].y - M.car.above });
  return art.picture.vga;
}
