// The reaction figure of the player at the right of the race screen (figure.rules, STATIC; devil.draw-observed and devil.finish-observed for phase 0): it
// starts when the lap word reaches the laps word, plays the entries of GIG.MOV with the frames of its driver's block of GIGGLES.SP, and ends after three more
// calls whose pictures are not identified.
import { K } from '../evidence/k.js';

const RULES = () => K({ routine: 0x1a740, driverWord: 0x84f4, endWord: 0x84fc, phaseWord: 0x8500, frameWord: 0x8504, stepWord: 0x8508, playerStride: 0x104, blockTableAt: 0x1b210, frameBytes: 0x688, frames: 4, movTableAt: 0x1b548, countWord: 0x28b80, xBase: 0xfa, yBase: 0x78, widthWord: 0x26, heightA: 0x2c, heightB: 0x1c, rowShiftB: 8, pictureTableB: 0xa538, callSite: 0x1b15a }, 'figure.rules');
const DRAW = () => K({ member: 'GIGGLES.SP', frame: [38, 44], frames: 28, perDriver: 4, mov: 'GIG.MOV', columnBase: 0xfa, rowBase: 0x78, driverWord: 0x84f4, frameWord: 0x8504, stepWord: 0x8508, flagWord: 0x8500, visibleSamples: 18, firstStep: 8, lastStep: 76, driver: 1, lag: 1 }, 'devil.draw-observed');

// The figure of a driver (1 to 7) the moment it starts: phase 0, frame 0, step 0.
export const startFigure = driver => ({ driver, phase: 0, frame: 0, step: 0 });

// The entries of a GIG.MOV member: the count word, then the x and y words of count + 1 entries (static.read).
export function parseMov(data) {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength), count = dv.getUint16(0, true), entries = [];
  for (let e = 0; e <= count; e++) entries.push({ x: dv.getInt16(2 + 4 * e, true), y: dv.getInt16(4 + 4 * e, true) }); // @math the count word, then two words an entry
  return { count, entries };
}

// One call of the figure routine: what it draws (phase 0: the GIGGLES.SP frame number and the GIG.MOV entry; phase 1: a picture of the table at obj2+0xa538,
// not identified, so `picture` is null) and the figure after the call, null when it ended.
export function stepFigure(fig, movCount) {
  const R = RULES(), D = DRAW(), draw = fig.phase === 0 ? { picture: (fig.driver - 1) * D.perDriver + fig.frame, entry: fig.step, phase: 0 } : { picture: null, entry: fig.step, phase: 1 };
  let { phase, step } = fig;
  if (phase !== 1) { step++; if (movCount < step) { step = 0; phase = 1; } }
  const frame = fig.frame + 1;
  if (frame >= R.frames) { if (phase !== 0) return { fig: null, draw }; return { fig: { ...fig, phase, step, frame: 0 }, draw }; }
  return { fig: { ...fig, phase, step, frame }, draw };
}
