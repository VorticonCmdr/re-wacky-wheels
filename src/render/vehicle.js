// The vehicle screen picture (menu.vehicle-screen): the menu background, the texts, the ring of cars, the marker and the selected driver's name.
import { drawText } from './text.js';
import { drawTile, bigTileOf } from './menu.js';
import { vehicleLayout, driverTexts, selectedSlot } from '../game/vehicle.js';
import { FLOW } from '../game/versus-rules.js';
import { helpBox, helpLines } from '../game/help.js';

const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on
const TILE = [15, 13]; // @math the tile font's glyph size (text.menu-observed)
const PICTURE = [38, 28]; // @math the largest car picture (view.player-car-draw)
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames: 8 slots of 12 frames)

// A 38 x 28 column-major picture at (x, y), zero transparent.
function blit(fb, data, at, x, y) {
  const [w, h] = PICTURE;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = data[at + i * h + j], px = x + i, py = y + j; if (v !== 0 && px >= 0 && px < SCREEN.width && py >= 0 && py < SCREEN.height) fb[py * SCREEN.width + px] = v; }
}

// The art: the menu background, the fonts, CARS.SP, the marker's AJ.SP and the puffs of PUF.SP.
export const loadVehicleArt = (menuArt, members) => ({ background: menuArt.title, tiles: menuArt.tiles, ofont: members.get('OFONT.SP'), cars: members.get('CARS.SP'), marker: members.get('AJ.SP'), puff: members.get('PUF.SP'), genef: members.get('GENEF.SP') });

export function renderVehicle(fb, art, v) {
  const L = vehicleLayout(), bytes = PICTURE[0] * PICTURE[1];
  fb.set(art.background.indices);
  const title = v.player === null ? L.title.text : FLOW().titles[v.player]; // a two player game's titles are PLAYER ONE and PLAYER TWO (versus.flow)
  drawText(fb, art.ofont, title, Math.floor((L.title.screen - L.title.glyph * title.length) / 2), L.title.y); // @math the title is centred
  drawText(fb, art.ofont, L.controller.text, L.controller.x, L.controller.y);
  drawText(fb, art.ofont, L.help.text, L.help.x, L.help.y);
  if (v.phase === 'intro') { // the puffs at the nine places (the eight cars and the marker)
    for (const e of v.entries) blit(fb, art.puff, Math.min(v.pass, 3) * bytes, e.x, e.y); // @math the last puff frame
    blit(fb, art.puff, Math.min(v.pass, 3) * bytes, L.marker.x, L.marker.y); // @math the last puff frame
    return art.background.vga;
  }
  for (const e of v.entries) blit(fb, art.cars, (e.slot * SLOT_FRAMES + ((e.frame % 8 + 8) % 8 === e.frame ? e.frame : ((e.frame % 8) + 8) % 8)) * bytes, e.x, e.y); // @math the frame words wrap through the eight compass frames
  const X = FLOW().cross;
  if (v.taken !== null) for (const e of v.entries) if (e.slot === v.taken) { // the car player one took is crossed out for player two (obj1+0x469b to +0x46b8)
    const at = X.at; for (let i = 0; i < X.width; i++) for (let j = 0; j < X.height; j++) { const c = art.genef[at + i * X.height + j], px = e.x + i, py = e.y + j; if (c !== 0 && px >= 0 && px < SCREEN.width && py >= 0 && py < SCREEN.height) fb[py * SCREEN.width + px] = c; }
  }
  blit(fb, art.marker, (v.marker + (v.player === 1 ? FLOW().marker.pair[1] : FLOW().marker.pair[0])) * bytes, L.marker.x, L.marker.y); // the second player's marker is the second pair of AJ.SP
  const slot = v.chosen ? v.chosen.slot : selectedSlot(v);
  if (slot !== null) driverTexts(slot).forEach((text, k) => [...text].forEach((ch, c) => drawTile(fb, art.tiles[bigTileOf(ch)], L.names.x + L.names.advance * c, L.names.y[k], TILE)));
  return art.background.vga;
}

// The controls screen (menu.controls-help): the framed box over the whole screen, then the lines of the routine. `opts` are the arguments of helpLines.
export function renderControlsHelp(fb, art, opts) {
  const B = helpBox();
  for (let y = 0; y < B.height; y++) for (let x = 0; x < B.width; x++) fb[(B.y + y) * SCREEN.width + B.x + x] = x === 0 || y === 0 || x === B.width - 1 || y === B.height - 1 ? B.border : B.fill; // @math the framed box: the border on the four edges, the fill inside
  for (const l of helpLines(opts)) drawText(fb, art.ofont, l.text, l.x, l.y);
  return art.background.vga;
}
