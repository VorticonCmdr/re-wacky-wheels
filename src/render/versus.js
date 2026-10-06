// The split screen of the two player modes (versus.layout): the two viewers' pictures cut into their halves, and the strips between them (names, hog counters, the shoot-out's scores and the
// held items) drawn over the picture of BLANK.PCX.
import { LAYOUT, FLOW, RACE, TAUNT } from '../game/versus-rules.js';
import { drawText } from './text.js';
import { drawDigits, drawHeld, drawTimer, drawSpeedometer, drawPlace, drawLapText, drawFigure, drawWrongWay } from './hud.js';

const SCREEN = { width: 320, height: 200 }; // @math the VGA mode 13h screen the game draws on

// `first` and `second` are the viewers' pictures in the one screen rows (the sprites' rows computed as for a single player); the first keeps its rows from the strip down, the second goes
// up by 100 rows. Both are copied from the same row of their picture, which carries the strip's picture (the sprites that reach into it are in the picture too).
export function composeSplit(first, second, out) {
  const L = LAYOUT(), W = SCREEN.width;
  out.set(first.subarray(L.viewRow * W, SCREEN.height * W), L.viewRow * W);
  out.set(second.subarray(L.viewRow * W, SCREEN.height * W), (L.viewRow - L.shift) * W);
  return out;
}

const fillBox = (fb, x, y, [w, h], colour) => { for (let j = 0; j < h; j++) fb.fill(colour, (y + j) * SCREEN.width + x, (y + j) * SCREEN.width + x + w); };
const twoDigits = n => [...String(Math.min(n, 99)).padStart(2, '0')].map(Number); // @math two places, the counters' cap

// The strips of the two players (player one in the bottom half, index 0): `values` is [{ name, ammo, score, held }, ...]; `shoot` draws the SCORE panel of the shoot-out.
export function drawStrips(fb, art, values, { shoot = true } = {}) {
  const L = LAYOUT(), T = TAUNT();
  values.forEach((v, p) => { if (v.taunt) drawFigure(fb, art, v.taunt.draw, v.taunt.entry, T.rows[p], T.column); }); // a taunt's figure stands in the other player's half (versus.taunts)
  values.forEach((v, p) => {
    drawText(fb, art.ofont, v.name, L.names.x, L.names.y[p]);
    drawDigits(fb, art, twoDigits(v.ammo), L.counter.x, L.counter.y[p], L.counter.advance);
    fillBox(fb, L.score.x, L.score.y[p], L.score.box, L.score.boxColour);
    if (shoot) {
      drawText(fb, art.ofont, L.score.text, L.score.x, L.score.y[p]);
      L.score.digitsX.forEach((x, k) => drawDigits(fb, art, [twoDigits(v.score)[k]], x, L.score.digitsY[p], L.counter.advance));
    }
    if (v.held) drawHeld(fb, art, v.held, { x: L.held.x, y: L.held.y[p] });
  });
  return fb;
}

// The match end screen over ORDER.PCX: the lines and the cars' first frames (38 x 28, column-major, zero transparent); `art` is { background, ofont, cars }. Returns the background's palette.
export function renderWinner(fb, art, layout) {
  const [w, h] = FLOW().winner.size, slotBytes = w * h * SLOT_FRAMES;
  fb.set(art.background.indices);
  for (const l of layout.lines) drawText(fb, art.ofont, l.text, l.x, l.y);
  for (const c of layout.cars) for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) { const v = art.cars[c.slot * slotBytes + i * h + j]; if (v !== 0) fb[(c.y + j) * SCREEN.width + c.x + i] = v; }
  return art.background.vga;
}
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames: 8 slots of 12 frames)

// A viewer's rows upside down (obj1+0x26ec2): the 90 rows from the viewer's first row are copied bottom to top.
export function flipViewport(fb, seat) {
  const L = LAYOUT(), first = seat === 0 ? L.flip.first : L.flip.first - L.shift, rows = [];
  for (let r = 0; r < L.flip.rows; r++) rows.push(fb.slice((first + r) * SCREEN.width, (first + r + 1) * SCREEN.width));
  rows.reverse().forEach((row, r) => fb.set(row, (first + r) * SCREEN.width));
  return fb;
}

// The two player race's HUD of both halves over the strips (versus.race-rules): the place digit, the speedometer, the timer, the WRONG WAY sign (hud.wrong-way), the figure of a lap and the
// lap text, each half 100 rows from the other. `halves` is [{ timer, speed, place, wrongWay, lap, figure }, ...] for the players one and two, `gates` the race screen options.
export function drawRaceHud(fb, art, halves, gates) {
  const R = RACE().hud;
  halves.forEach((h, p) => {
    if (h.place) drawPlace(fb, art, h.place, { x: R.placeX, y: R.placeY[p], from: R.placeFrom });
    if (h.speed && gates.speedometer) drawSpeedometer(fb, art, h.speed, p * R.speedDy);
    if (h.timer && gates.timer) drawTimer(fb, art, h.timer, R.timerY[p]);
    if (h.wrongWay !== null && h.wrongWay !== undefined) drawWrongWay(fb, art, h.wrongWay, p === 1);
    if (h.figure) drawFigure(fb, art, h.figure.draw, h.figure.entry, R.figureRows[p]);
    if (h.lap) drawLapText(fb, art, h.lap, R.lapY[p]);
  });
  return fb;
}
