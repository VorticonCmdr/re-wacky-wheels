// The race HUD pictures as the game draws them over the finished frame: the place digit (a 22 x 29 frame of LAP.SP), the speedometer (the 42 x 19 panel
// of ICONS.SP with two 10 x 15 digits laid over it), both opaque, and the timer (seven 7 x 9 glyphs of GENEF.SP, zero pixels transparent). Frames are
// column-major, as sp.draw reads them.
import { K } from '../evidence/k.js';

const SPEED = () => K({ samples: 6, placeRect: [25, 12, 22, 29], placeFrameBytes: 0x27e, placeFramesAt: 0, placeFrameSize: [22, 29], speedRect: [0, 181, 42, 19], panelAt: 0xccc, panelSize: [42, 19], digitsAt: 0xfea, digitBytes: 0x96, digitSize: [10, 15], digitColumns: [3, 15], digitRow: 2, hudBase: 0x8426, placeWord: 0x84bc, speedShownWord: 0x8438, speedTargetWord: 0x8436, riseStep: 2, fallStep: 4, rising: 3, falling: 3, numbers: [52, 38, 60, 60, 32, 62] }, 'hud.place-speed-observed');
const TIMER = () => K({ samples: 5, x: 264, y: 112, advance: 7, glyphSize: [7, 9], glyphBytes: 63, glyphsAt: 13733, glyphs: 11, colon: 10, places: 7, tickWord: 0x1e71c, tenths: 10, secondsPerMinute: 60, cap: 36000, exact: 3, behind: 2 }, 'hud.timer-observed');
const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on (floor.model and every observation read 320 x 200)

// The members the HUD draws from, by their archive names.
export function loadHudArt(members) {
  const need = name => { const data = members.get(name); if (!data) throw new Error(`${name} is not in the archive`); return data; };
  return { lap: need('LAP.SP'), icons: need('ICONS.SP'), genef: need('GENEF.SP') };
}

// A column-major frame of `size` at `at` in `data`, drawn with its top left at (x, y); `opaque` stores the zero bytes too.
function blit(fb, data, at, [w, h], x, y, opaque) {
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    const v = data[at + i * h + j];
    if ((opaque || v !== 0) && x + i >= 0 && x + i < SCREEN.width && y + j >= 0 && y + j < SCREEN.height) fb[(y + j) * SCREEN.width + x + i] = v;
  }
}

export const placeBox = () => SPEED().placeRect;
export const speedBox = () => SPEED().speedRect;
export const timerBox = () => { const T = TIMER(); return [T.x, T.y, T.places * T.advance, T.glyphSize[1]]; }; // @math the places side by side, one glyph high

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

// The HUD of a frame: { place (1 to 8 or null), speed ([tens, units] or null), timer (text or null) }.
export function renderHud(fb, art, hud) {
  if (hud.place) drawPlace(fb, art, hud.place);
  if (hud.speed) drawSpeedometer(fb, art, hud.speed);
  if (hud.timer) drawTimer(fb, art, hud.timer);
}
