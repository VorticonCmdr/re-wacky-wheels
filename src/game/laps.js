// The player's laps as far as they are known: the grid value under the car (pos.progress-live), the lap word counting the crossings of the line
// (pos.lap-observed) and the rest of the human racer's update that was read from the code (lap.rules, STATIC): nothing changes off the course, a
// backward crossing sets a flag that cancels the next forward one, and the race is finished by the crossing after the last lap.
import { K } from '../evidence/k.js';

const LIVE = () => K({ layout: { xWord: 0xaaa6, yWord: 0xaaa8, racerStride: 0x68, aiLapWord: 0xaab2, aiValueWord: 0xaab4, humanLapWord: 0x84c2, humanValueWord: 0x84be, structStride: 0x104, keyWord: 0x843a, key2Word: 0x843e, flagWord: 0x84c0 }, countOffset: 0x28c40, trailerOffset: 0x28ba2, racers: 0x08, origin: 0x400, maxOffset: 0x7ff, cellShift: 0x05, columns: 0x40, lapShift: 0x0a }, 'pos.progress-live');
const RULES = () => K({ updateRoutine: 0x2b44, shownWord: 0x84b4, driverWord: 0x84f4, lapWord: 0x84c2, valueWord: 0x84be, flagWord: 0x84c0, trailerWord: 0x28ba2, lapsWord: 0x28b9c, firstStep: 1, finishExtraLaps: 1, finishFlagWord: 0x28c3c, finishedFlag: 1, figureDriver: 7, lapsMenuCall: 0x55c0, lapsMenuChoices: 3, lapsByChoice: [6, 8, 10], classWord: 0x28bb2, timeTrialClass: 4, timeTrialLaps: 6 }, 'lap.rules');

// The grid value at a world position: 0 outside the 0x800 square that starts at the origin, else the .POS cell at row and column (offset >> 5).
export function gridValue(pos, x, y) {
  const P = LIVE(), dx = x - P.origin, dy = y - P.origin;
  if (dx < 0 || dx > P.maxOffset || dy < 0 || dy > P.maxOffset) return 0;
  return pos.grid[(dy >> P.cellShift) * P.columns + (dx >> P.cellShift)];
}

// The laps state of the player at a position: the lap word 0 (observed at the start), the previous value the grid gives there, the backward-crossing flag
// and the word that lets the lap text be drawn (obj2+0x84b4, 0 until the first counted lap).
export const createLaps = (pos, x, y) => ({ lap: 0, prev: gridValue(pos, x, y), flag: 0, shown: false });

// One frame of the human racer's update for the grid value `value` and the laps word `total` (lap.rules). Returns the next state, whether the reaction figure
// starts (the lap word reaches the laps word) and what this frame relied on without proof.
export function stepLaps(laps, value, trailer, total) {
  const R = RULES(), unproven = [];
  if (value === 0) return { laps, started: false, unproven: ['the zero grid value off the course (nothing changes)'] };
  let { lap, prev, flag, shown } = laps, started = false;
  if (value === R.firstStep && prev === trailer) {
    if (flag !== 0) { flag = 0; unproven.push('a forward crossing cancelled by the backward-crossing flag'); } else {
      lap += R.firstStep;
      if (lap <= total) shown = true;
      if (lap === total) started = true;
    }
  } else if (value === trailer && prev === R.firstStep) {
    flag = 1; unproven.push('the line crossed backwards (the flag)');
  }
  return { laps: { lap, prev: value, flag, shown }, started, unproven };
}

// The laps of a race from the laps menu's choice (1 to 3), and whether a lap word is the finish.
export const lapsTotal = choice => RULES().lapsByChoice[choice - 1]; // @math choices count from 1
export const isFinished = (lap, total) => lap === total + RULES().finishExtraLaps;

// The driver of the reaction figure that starts when the lap word reaches the laps word.
export const figureDriver = () => RULES().figureDriver;
