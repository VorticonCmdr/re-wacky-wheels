// The player's laps as far as they are known: the grid value under the car (pos.progress-live), the lap word counting the crossings of the line
// (pos.lap-observed) and the rest of the human racer's update that was read from the code (lap.rules, STATIC): nothing changes off the course, a
// backward crossing sets a flag that cancels the next forward one, and the race is finished by the crossing after the last lap.
import { K } from '../evidence/k.js';

const LIVE = () => K({ layout: { xWord: 0xaaa6, yWord: 0xaaa8, racerStride: 0x68, aiLapWord: 0xaab2, aiValueWord: 0xaab4, humanLapWord: 0x84c2, humanValueWord: 0x84be, structStride: 0x104, keyWord: 0x843a, key2Word: 0x843e, flagWord: 0x84c0 }, countOffset: 0x28c40, trailerOffset: 0x28ba2, racers: 0x08, origin: 0x400, maxOffset: 0x7ff, cellShift: 0x05, columns: 0x40, lapShift: 0x0a }, 'pos.progress-live');
const RULES = () => K({ updateRoutine: 0x2b44, shownWord: 0x84b4, driverWord: 0x84f4, lapWord: 0x84c2, valueWord: 0x84be, flagWord: 0x84c0, trailerWord: 0x28ba2, lapsWord: 0x28b9c, firstStep: 1, finishExtraLaps: 1, finishFlagWord: 0x28c3c, finishedFlag: 1, figureDriver: 7, lapsMenuCall: 0x55c0, lapsMenuChoices: 3, lapsByChoice: [6, 8, 10], classWord: 0x28bb2, timeTrialClass: 4, timeTrialLaps: 6 }, 'lap.rules');

// The WRONG WAY sign (hud.wrong-way): its words in the human's update and in the HUD routine, the two LAP.SP pictures and where they are drawn.
export const WRONG_WAY = () => K({ updateRoutine: 0x2b44, hudRoutine: 0x1a92c, signWord: 0x84b6, pictureWord: 0x84b8, stampWord: 0x84a2, gateWord: 0x84ba, gateValue: 0, counterWord: 0x1ec64, hold: 0x0a, member: 'LAP.SP', cutFrom: 0x13f0, cutFrameBytes: 0x27e, cutFrames: 10, pictureBytes: 0x550, pictures: [0x2cdc, 0x322c], size: [0x50, 0x11], x: 0x78, y: 0xb6, splitOffsetWord: 0x1ed30, splitOffset: 0x64, switchTable: 0x1eb80, modeWord: 0x1d998, drawMode: 0, shootWord: 0x28be2, duckWord: 0x1ec74, blit: 0x26fd0 }, 'hud.wrong-way');

// The grid value at a world position: 0 outside the 0x800 square that starts at the origin, else the .POS cell at row and column (offset >> 5).
export function gridValue(pos, x, y) {
  const P = LIVE(), dx = x - P.origin, dy = y - P.origin;
  if (dx < 0 || dx > P.maxOffset || dy < 0 || dy > P.maxOffset) return 0;
  return pos.grid[(dy >> P.cellShift) * P.columns + (dx >> P.cellShift)];
}

// The laps state of the player at a position: the lap word 0 (observed at the start), the previous value the grid gives there, the backward-crossing flag
// the word that lets the lap text be drawn (obj2+0x84b4, 0 until the first counted lap) and the ranking key obj2+0x843e (lap x trailer + value, the lap less 1
// while the flag is set), which the catch-up helper of the computer racers reads (lap.rules, ai.rules). The WRONG WAY sign starts clear (hud.wrong-way): `wrong` the sign word,
// `wrongSince` the counter when it came on, `wrongNext` the picture word and `wrongShown` the picture the HUD routine took in its last call (null for none).
export const createLaps = (pos, x, y) => ({ lap: 0, prev: gridValue(pos, x, y), flag: 0, shown: false, key1: gridValue(pos, x, y), key2: gridValue(pos, x, y), wrong: 0, wrongSince: 0, wrongNext: 0, wrongShown: null });

// One frame of the human racer's update for the grid value `value`, the laps word `total` and the race frame counter `tick` (lap.rules, hud.wrong-way). Returns the next state,
// whether the reaction figure starts (the lap word reaches the laps word) and what this frame relied on without proof.
export function stepLaps(laps, value, trailer, total, tick = 0) {
  const R = RULES(), W = WRONG_WAY(), unproven = [];
  if (value === 0) return { laps, started: false, unproven: ['the zero grid value off the course (nothing changes)'] };
  let { lap, prev, flag, shown } = laps, started = false;
  let wrong = laps.wrong ?? 0, wrongSince = laps.wrongSince ?? 0, wrongNext = laps.wrongNext ?? 0;
  const signOn = () => { if (wrong === 0) { wrongSince = tick; wrongNext = 0; } wrong = 1; }; // a new sign takes the counter and starts on the first picture
  if (value === R.firstStep && prev === trailer) {
    wrong = 0;
    if (flag !== 0) { flag = 0; unproven.push('a forward crossing cancelled by the backward-crossing flag'); } else {
      lap += R.firstStep;
      if (lap <= total) shown = true;
      if (lap === total) started = true;
    }
  } else if (value === trailer && prev === R.firstStep) {
    if (W.gateValue !== 0) signOn(); // the gate word is never set (hud.wrong-way): a backward crossing shows no sign
    flag = 1; unproven.push('the line crossed backwards (the flag)');
  } else if (value < prev) {
    if (W.gateValue === 0) signOn();
  } else if (wrong !== 0 && (value > prev || tick - wrongSince >= W.hold)) wrong = 0; // on again, or the value has stood still since the sign came on 10 frames ago
  const ranked = flag === 0 ? lap : lap - 1; // the keys use the lap less 1 while the backward-crossing flag is set
  return { laps: { lap, prev: value, flag, shown, key1: ranked * (1 << LIVE().lapShift) + value, key2: ranked * trailer + value, wrong, wrongSince, wrongNext, wrongShown: laps.wrongShown ?? null }, started, unproven };
}

// The HUD routine's call for the sign (hud.wrong-way): while the sign word is set the picture word gives this call's picture (0 the first, 1 the second) and flips, whether
// or not the sign is drawn; without it nothing is shown.
export function stepWrongWay(laps) {
  if (!laps.wrong) return { ...laps, wrongShown: null };
  const picture = laps.wrongNext ? 1 : 0;
  return { ...laps, wrongShown: picture, wrongNext: 1 - picture };
}

// The laps of a race from the laps menu's choice (1 to 3), and whether a lap word is the finish.
export const lapsTotal = choice => RULES().lapsByChoice[choice - 1]; // @math choices count from 1
export const isFinished = (lap, total) => lap === total + RULES().finishExtraLaps;

// The driver of the reaction figure that starts when the lap word reaches the laps word.
export const figureDriver = () => RULES().figureDriver;

// The frame routine's finish (lap.rules, obj1+0x21609; car.finish-observed): at the start of the call after the lap word reaches the laps word plus 1 it sets the finish flag, and from
// then on the player's keys are ignored (the key sampler zeroes the button words while the flag is set, obj1+0x1d7c6): the throttle coasts down and the car stops. `fresh` is the call
// that sets the flag (the call that stores the tick word as the final time).
export function stepFinish(finished, lap, total) {
  if (finished) return { finished: true, fresh: false };
  const now = isFinished(lap, total);
  return { finished: now, fresh: now };
}

// No key down.
export const NO_KEYS = Object.freeze({ accelerate: false, brake: false, left: false, right: false, spin: false, fire: false });
