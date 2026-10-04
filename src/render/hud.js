// The race HUD pictures as the game draws them over the finished frame: the top banner (three pictures of LAP.SP, zero pixels transparent, with 10 x 9 digits
// of LAP.SP opaque), the place digit (a 22 x 29 frame of LAP.SP), the speedometer (the 42 x 19 panel of ICONS.SP with two 10 x 15 digits laid over it), both
// opaque, the timer (seven 7 x 9 glyphs of GENEF.SP, zero pixels transparent) and the texts of OFONT.SP (render/text.js). Frames are column-major, as sp.draw
// reads them.
import { K } from '../evidence/k.js';
import { drawText, nameAt } from './text.js';

const SPEED = () => K({ samples: 6, placeRect: [25, 12, 22, 29], placeFrameBytes: 0x27e, placeFramesAt: 0, placeFrameSize: [22, 29], speedRect: [0, 181, 42, 19], panelAt: 0xccc, panelSize: [42, 19], digitsAt: 0xfea, digitBytes: 0x96, digitSize: [10, 15], digitColumns: [3, 15], digitRow: 2, hudBase: 0x8426, placeWord: 0x84bc, speedShownWord: 0x8438, speedTargetWord: 0x8436, riseStep: 2, fallStep: 4, rising: 3, falling: 3, numbers: [52, 38, 60, 60, 32, 62] }, 'hud.place-speed-observed');
const BANNER = () => K({ records: 4, pictures: [{ at: 0x377c, size: [38, 41], where: [17, 6], exclude: [25, 12, 22, 29] }, { at: 0x3d92, size: [65, 19], where: [68, 6], exclude: [118, 11, 10, 9] }, { at: 0x4265, size: [61, 19], where: [146, 6], exclude: [181, 11, 20, 9] }], digitsAt: 0x46ec, digitBytes: 90, digitSize: [10, 9], row: 11, startDigit: [118], counterPlaces: [181, 191], counters: [7, 0, 42, 99], startDigitShown: 3, overwrittenWord: 5, counterWord: 0x847a, startWord: 0x847c }, 'hud.banner-observed');
const LAPTEXT = () => K({ member: 'OFONT.SP', x: 4, y: 164, advance: 8, lapWord: 0x84c2, totalWord: 0x28b9c, finishWord: 0x28c3c, total: 6, candidates: 41, cases: [{ text: 'LAP 2', lap: 2, flag: 0 }, { text: 'LAP 5', lap: 5, flag: 0 }, { text: 'LAST LAP!', lap: 6, flag: 0 }, { text: 'FINISHED!', lap: 6, flag: 1 }], exclamationSlot: 36 }, 'text.banner-observed');
const DEVIL = () => K({ member: 'GIGGLES.SP', frame: [38, 44], frames: 28, perDriver: 4, mov: 'GIG.MOV', columnBase: 0xfa, rowBase: 0x78, driverWord: 0x84f4, frameWord: 0x8504, stepWord: 0x8508, flagWord: 0x8500, visibleSamples: 18, firstStep: 8, lastStep: 76, driver: 1, lag: 1 }, 'devil.draw-observed');
const TIMER = () => K({ samples: 5, x: 264, y: 112, advance: 7, glyphSize: [7, 9], glyphBytes: 63, glyphsAt: 13733, glyphs: 11, colon: 10, places: 7, tickWord: 0x1e71c, tenths: 10, secondsPerMinute: 60, cap: 36000, exact: 3, behind: 2 }, 'hud.timer-observed');
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
export function drawFigure(fb, art, draw, entry) {
  if (draw.picture === null) return;
  const D = DEVIL(), [w, h] = D.frame;
  blit(fb, art.giggles, draw.picture * w * h, D.frame, D.columnBase + entry.x, D.rowBase + entry.y, false);
}

// The driver's name under the place panel, and the lap text at the bottom left.
export function drawName(fb, art) { const n = nameAt(); drawText(fb, art.ofont, n.text, n.x, n.y); }
export function drawLapText(fb, art, text) { const L = LAPTEXT(); drawText(fb, art.ofont, text, L.x, L.y); }

// The place digit: the frame number place - 1 of LAP.SP (place 1 to 8).
export function drawPlace(fb, art, place) {
  const S = SPEED();
  blit(fb, art.lap, S.placeFramesAt + S.placeFrameBytes * (place - 1), S.placeFrameSize, S.placeRect[0], S.placeRect[1], true);
}

// The speedometer: the panel, then the tens and units digit pictures over it.
export function drawSpeedometer(fb, art, [tens, units]) {
  const S = SPEED(), [x, y] = S.speedRect;
  blit(fb, art.icons, S.panelAt, S.panelSize, x, y, true);
  [tens, units].forEach((digit, k) => blit(fb, art.icons, S.digitsAt + S.digitBytes * digit, S.digitSize, x + S.digitColumns[k], y + S.digitRow, true));
}

// The timer text (the digits and colons of MM:SS:T), one glyph a place.
export function drawTimer(fb, art, text) {
  const T = TIMER(), chars = '0123456789:'; // @math the glyph order of the file: the digits, then the colon
  [...text].forEach((ch, k) => {
    const g = chars.indexOf(ch);
    if (g < 0) throw new Error(`no timer glyph for ${JSON.stringify(ch)}`);
    blit(fb, art.genef, T.glyphsAt + T.glyphBytes * g, T.glyphSize, T.x + T.advance * k, T.y, false);
  });
}

// The HUD of a frame: { figure ({ draw, entry } or null), banner ([tens, units] of the count label or null), name (draw the driver's name), lap (the lap text or null), place (1 to 8 or
// null), speed ([tens, units] or null), timer (text or null) }, drawn in the order of the game's HUD routine: the panel before the place digit, whose box it leaves free, the
// timer before the figure and the lap text.
export function renderHud(fb, art, hud) {
  if (hud.banner) drawBanner(fb, art, hud.banner);
  if (hud.name) drawName(fb, art);
  if (hud.place) drawPlace(fb, art, hud.place);
  if (hud.speed) drawSpeedometer(fb, art, hud.speed);
  if (hud.timer) drawTimer(fb, art, hud.timer);
  if (hud.figure) drawFigure(fb, art, hud.figure.draw, hud.figure.entry); // the figure and the lap text come last in the HUD routine, over the timer (figure.rules)
  if (hud.lap) drawLapText(fb, art, hud.lap);
}
