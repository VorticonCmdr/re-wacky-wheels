// The race HUD pictures as the game draws them over the finished frame: the top banner (three pictures of LAP.SP, zero pixels transparent, with 10 x 9 digits
// of LAP.SP opaque), the place digit (a 22 x 29 frame of LAP.SP), the speedometer (the 42 x 19 panel of ICONS.SP with two 10 x 15 digits laid over it), both
// opaque, the timer (seven 7 x 9 glyphs of GENEF.SP, zero pixels transparent) and the texts of OFONT.SP (render/text.js). Frames are column-major, as sp.draw
// reads them.
import { K } from '../evidence/k.js';
import { drawText, nameAt } from './text.js';
import { HUD as DUCK, PICTURES } from '../game/duck-rules.js';
import { minimapRect } from '../game/minimap.js';
import { WRONG_WAY } from '../game/laps.js';

const SPEED = () => K({ samples: 6, placeRect: [25, 12, 22, 29], placeFrameBytes: 0x27e, placeFramesAt: 0, placeFrameSize: [22, 29], speedRect: [0, 181, 42, 19], panelAt: 0xccc, panelSize: [42, 19], digitsAt: 0xfea, digitBytes: 0x96, digitSize: [10, 15], digitColumns: [3, 15], digitRow: 2, hudBase: 0x8426, placeWord: 0x84bc, speedShownWord: 0x8438, speedTargetWord: 0x8436, riseStep: 2, fallStep: 4, rising: 3, falling: 3, numbers: [52, 38, 60, 60, 32, 62] }, 'hud.place-speed-observed');
const BANNER = () => K({ records: 4, pictures: [{ at: 0x377c, size: [38, 41], where: [17, 6], exclude: [25, 12, 22, 29] }, { at: 0x3d92, size: [65, 19], where: [68, 6], exclude: [118, 11, 10, 9] }, { at: 0x4265, size: [61, 19], where: [146, 6], exclude: [181, 11, 20, 9] }], digitsAt: 0x46ec, digitBytes: 90, digitSize: [10, 9], row: 11, startDigit: [118], counterPlaces: [181, 191], counters: [7, 0, 42, 99], startDigitShown: 3, overwrittenWord: 5, counterWord: 0x847a, startWord: 0x847c }, 'hud.banner-observed');
const LAPTEXT = () => K({ member: 'OFONT.SP', x: 4, y: 164, advance: 8, lapWord: 0x84c2, totalWord: 0x28b9c, finishWord: 0x28c3c, total: 6, candidates: 41, cases: [{ text: 'LAP 2', lap: 2, flag: 0 }, { text: 'LAP 5', lap: 5, flag: 0 }, { text: 'LAST LAP!', lap: 6, flag: 0 }, { text: 'FINISHED!', lap: 6, flag: 1 }], exclamationSlot: 36 }, 'text.banner-observed');
const DEVIL = () => K({ member: 'GIGGLES.SP', frame: [38, 44], frames: 28, perDriver: 4, mov: 'GIG.MOV', columnBase: 0xfa, rowBase: 0x78, driverWord: 0x84f4, frameWord: 0x8504, stepWord: 0x8508, flagWord: 0x8500, visibleSamples: 18, firstStep: 8, lastStep: 76, driver: 1, lag: 1 }, 'devil.draw-observed');
const TIMER = () => K({ samples: 5, x: 264, y: 112, advance: 7, glyphSize: [7, 9], glyphBytes: 63, glyphsAt: 13733, glyphs: 11, colon: 10, places: 7, tickWord: 0x1e71c, tenths: 10, secondsPerMinute: 60, cap: 36000, exact: 3, behind: 2 }, 'hud.timer-observed');
const HELD = () => K({ index: 0, x: 256, y: 876, track: 1, hitRow: 1887, hitDistance: 13, throttle: 100, heading: 480, counter: { sprite: 1, kind: 2, before: 0, after: 4 }, held: { sprite: 0, kind: 3, after: 3 }, icon: { member: 'ICONS.SP', at: 0, size: [26, 21], x: 293, y: 178, pixels: 470, frameBytes: 546, item: 3 }, itemWord: 33830 }, 'pickup.kinds-observed');
const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on (floor.model and every observation read 320 x 200)

// The members the HUD draws from, by their archive names.
export function loadHudArt(members) {
  const need = name => { const data = members.get(name); if (!data) throw new Error(`${name} is not in the archive`); return data; };
  return { lap: need('LAP.SP'), icons: need('ICONS.SP'), genef: need('GENEF.SP'), ofont: need('OFONT.SP'), giggles: need('GIGGLES.SP') };
}

// A column-major frame of `size` at `at` in `data`, drawn with its top left at (x, y); `opaque` stores the zero bytes too.
function blit(fb, data, at, [w, h], x, y, opaque) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    const v = data[at + i * h + j];
    if ((opaque || v !== 0) && x + i >= 0 && x + i < SCREEN.width && y + j >= 0 && y + j < SCREEN.height) fb[(y + j) * SCREEN.width + x + i] = v;
  }
}

export const placeBox = () => SPEED().placeRect;
export const bannerPictures = () => BANNER().pictures;
export const speedBox = () => SPEED().speedRect;
export const timerBox = () => { const T = TIMER(); return [T.x, T.y, T.places * T.advance, T.glyphSize[1]]; }; // @math the places side by side, one glyph high

// The top banner: the panel (behind the place digit), the lap label and the count label, then the single digit of the lap label and the two digits of
// the count label (zero-padded decimal digits, [tens, units]), the digits opaque.
export function drawBanner(fb, art, counter) {
  const B = BANNER(), digit = (d, x) => blit(fb, art.lap, B.digitsAt + B.digitBytes * d, B.digitSize, x, B.row, true);
  B.pictures.forEach(p => blit(fb, art.lap, p.at, p.size, p.where[0], p.where[1], false));
  digit(B.startDigitShown, B.startDigit[0]);
  counter.forEach((d, k) => digit(d, B.counterPlaces[k]));
}

// The reaction figure: the GIGGLES.SP frame of a draw (figure.stepFigure) at the column and row of its GIG.MOV entry {x, y}, zero pixels transparent. A draw
// without a picture (the unidentified pictures of the figure's last calls) draws nothing.
export function drawFigure(fb, art, draw, entry, row = null, column = null) { // `row` and `column` replace the figure's base place (the halves of a split screen, a taunt)
  if (draw.picture === null) return;
  const D = DEVIL(), [w, h] = D.frame;
  blit(fb, art.giggles, draw.picture * w * h, D.frame, (column ?? D.columnBase) + entry.x, (row ?? D.rowBase) + entry.y, false);
}

// The driver's name under the place panel, and the lap text at the bottom left.
export function drawName(fb, art, text = null) { const n = nameAt(); drawText(fb, art.ofont, text ?? n.text, n.x, n.y); } // the observed driver is TIGI; another driver's name takes the same place (the demo's driver UNO was seen)
export function drawLapText(fb, art, text, y = null) { const L = LAPTEXT(); drawText(fb, art.ofont, text, L.x, y ?? L.y); }

// The place digit: the frame number place - 1 of LAP.SP (place 1 to 8).
export function drawPlace(fb, art, place, at = null) { // `at` { x, y, from } places the digit elsewhere and cuts it from another start of LAP.SP (a split screen's halves)
  const S = SPEED();
  blit(fb, art.lap, (at?.from ?? S.placeFramesAt) + S.placeFrameBytes * (place - 1), S.placeFrameSize, at?.x ?? S.placeRect[0], at?.y ?? S.placeRect[1], !at); // a split screen's digit is drawn with zero transparent (obj1+0x1af3e)
}

// The speedometer: the panel, then the tens and units digit pictures over it.
export function drawSpeedometer(fb, art, [tens, units], dy = 0) { // `dy` moves it up for the second player's half of a split screen
  const S = SPEED(), [x, y0] = S.speedRect, y = y0 - dy;
  blit(fb, art.icons, S.panelAt, S.panelSize, x, y, true);
  [tens, units].forEach((digit, k) => blit(fb, art.icons, S.digitsAt + S.digitBytes * digit, S.digitSize, x + S.digitColumns[k], y + S.digitRow, true));
}

// The held item's icon (pickup.kinds-observed): the 26 x 21 frame of ICONS.SP at (293, 178), the frame of the kind 3 being the first; the later kinds' frames are assumed to follow
// it in the file (the six frames before the speedometer panel), which is not observed.
export function drawHeld(fb, art, kind, place = null) { // `place` { x, y } moves the icon (the second player's half of a split screen)
  const H = HELD().icon;
  blit(fb, art.icons, H.at + H.frameBytes * (kind - H.item), H.size, place?.x ?? H.x, place?.y ?? H.y, false);
}

// The WRONG WAY sign (hud.wrong-way): the first or second of the two 80 x 17 LAP.SP pictures (`picture` 0 or 1), zero pixels transparent, at (120, 182); the second player's
// sign of a split screen 100 rows higher.
export function drawWrongWay(fb, art, picture, second = false) {
  const W = WRONG_WAY();
  blit(fb, art.lap, W.pictures[picture], W.size, W.x, W.y - (second ? W.splitOffset : 0), false);
}

// Zero padded decimal digits of the count label's pictures (LAP.SP, 10 x 9, opaque), side by side from (x, y) `advance` columns apart.
export function drawDigits(fb, art, digits, x, y, advance) {
  const B = BANNER();
  digits.forEach((d, k) => blit(fb, art.lap, B.digitsAt + B.digitBytes * d, B.digitSize, x + advance * k, y, true));
}

// The timer text (the digits and colons of MM:SS:T), one glyph a place.
export function drawTimer(fb, art, text, y = null) { // `y` replaces the row (the second half of a split screen)
  const T = TIMER(), chars = '0123456789:'; // @math the glyph order of the file: the digits, then the colon
  [...text].forEach((ch, k) => {
    const g = chars.indexOf(ch);
    if (g < 0) throw new Error(`no timer glyph for ${JSON.stringify(ch)}`);
    blit(fb, art.genef, T.glyphsAt + T.glyphBytes * g, T.glyphSize, T.x + T.advance * k, y ?? T.y, false);
  });
}

// The duck game's banner (duck.hud): the panel with the duck's head over it (transparent), the count label with the two digits of the hog counter, and the two digits of the score
// (opaque, in the panel's box where a race has the place digit).
export function drawDuckBanner(fb, art, ammo, score) {
  const B = BANNER(), D = DUCK(), I = PICTURES().icon, [panel, , label] = B.pictures, digit = (d, x, y) => blit(fb, art.lap, B.digitsAt + B.digitBytes * d, B.digitSize, x, y, true);
  for (const p of [panel, label]) blit(fb, art.lap, p.at, p.size, p.where[0], p.where[1], false);
  blit(fb, art.genef, I.at, [I.width, I.height], D.icon.x, D.icon.y, false);
  ammo.forEach((d, k) => digit(d, B.counterPlaces[k], B.row));
  score.forEach((d, k) => digit(d, D.score.x + D.score.advance * k, D.score.y));
}

// The HUD of a frame: { figure ({ draw, entry } or null), banner ([tens, units] of the count label or null), name (draw the driver's name), lap (the lap text or null), place (1 to 8 or
// null), speed ([tens, units] or null), timer (text or null), wrongWay (the WRONG WAY sign's picture, 0 or 1, or null) }, drawn in the order of the game's HUD routine: the panel
// before the place digit, whose box it leaves free, the timer and the sign before the figure and the lap text.
export function renderHud(fb, art, hud) {
  if (hud.duck) { // the duck game's HUD: no speedometer, place digit, lap text or figure (duck.hud)
    drawDuckBanner(fb, art, hud.duck.ammo, hud.duck.score);
    if (hud.name) drawName(fb, art, typeof hud.name === 'string' ? hud.name : null);
    if (hud.held) drawHeld(fb, art, hud.held);
    drawTimer(fb, art, hud.duck.timer);
    return;
  }
  if (hud.banner) drawBanner(fb, art, hud.banner);
  if (hud.name) drawName(fb, art, typeof hud.name === 'string' ? hud.name : null);
  if (hud.place) drawPlace(fb, art, hud.place);
  if (hud.speed) drawSpeedometer(fb, art, hud.speed);
  if (hud.held) drawHeld(fb, art, hud.held);
  if (hud.timer) drawTimer(fb, art, hud.timer);
  if (hud.wrongWay !== null && hud.wrongWay !== undefined) drawWrongWay(fb, art, hud.wrongWay); // after the counters, before the figure (obj1+0x1b077 to +0x1b15a)
  if (hud.figure) drawFigure(fb, art, hud.figure.draw, hud.figure.entry); // the figure and the lap text come last in the HUD routine, over the timer (figure.rules)
  if (hud.lap) drawLapText(fb, art, hud.lap);
}

// The overhead map (hud.minimap-draw): at the first frame the picture (column-major, 0 transparent) goes over the screen and the rectangle is kept; every frame the kept rectangle is drawn
// back, opaque, and the dots follow. `mm` is { picture, saved } and keeps the rectangle between the frames.
export function drawMinimap(fb, mm, dots) {
  const [x0, y0, w, h] = minimapRect();
  if (!mm.saved) {
    for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = mm.picture[i * h + j]; if (v !== 0) fb[(y0 + j) * SCREEN.width + x0 + i] = v; }
    mm.saved = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mm.saved[j * w + i] = fb[(y0 + j) * SCREEN.width + x0 + i];
  } else for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) fb[(y0 + j) * SCREEN.width + x0 + i] = mm.saved[j * w + i];
  for (const d of dots) fb[d.y * SCREEN.width + d.x] = d.colour;
}
