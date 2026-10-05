// The start of a race (race.start-rules, STATIC; race.start-observed and race.idle-observed for what the first frames of a run show): the race begins in the
// mode 1, a countdown of 34 frames with the starter lion (it shows its second picture from the 17th frame and its third from the 34th) and the cars idling on
// the grid; the 34th frame sets the mode 2, and the cars, the laps and the clock start in the frame after it.
import { K } from '../evidence/k.js';
import { carFrame } from './control.js';
import { racerRecord } from './racers.js';
import { viewSetup } from './view.js';

const RULES = () => K({ starterRoutine: 0x166a8, setupRoutine: 0x20e5c, counterWord: 0x1ec64, startWord: 0x1eba8, timerWord: 0x1e720, modeWord: 0x28c44, starterWord: 0x28c38, frameWord: 0x28c5e, positionWords: [0x28c4a, 0x28c4c], countdownMode: 1, racingMode: 2, lionStep: 0x11, readyTicks: 0x22, lionFrames: 3, lionDx: 0x28, lionDy: -10, lionTable: 0x1eb40, member: 'GENEF.SP', cut: { lights: 6, lightBytes: 0x284, tiles: 3, tileBytes: 0xc3, frameBytes: 0x428 }, sound: 10 }, 'race.start-rules');
const IDLE = () => K({ records: ['start-4', 'start-5', 'start-6'], base: 8, side: 2, rightMode: 4, period: 6, shift: 1, zero: 1, playerBase: 92, playerLast: 35, racersLast: 41, normalFrame: 4 }, 'race.idle-observed');

// The state after the race set-up: the frame counter 0 in the mode of the countdown, the starter showing its first picture.
export const createStart = () => ({ mode: RULES().countdownMode, tick: 0, lion: 0 });

// One frame: the counter goes up, the cars act only if the mode word was the racing one when the frame began, and the starter routine follows (obj1+0x166a8).
// Returns the next state and whether the cars, the laps and the clock run in this frame.
export function stepStart(start) {
  const R = RULES(), tick = start.tick + 1, racing = start.mode === R.racingMode;
  let { mode, lion } = start;
  if (mode === R.countdownMode) {
    if (tick >= R.readyTicks) { mode = R.racingMode; lion = R.lionFrames - 1; } // @math the last of the starter's frames
    else if (tick >= R.lionStep) lion = 1;
  }
  return { start: { mode, tick, lion }, racing };
}

// Whether the frame counter is in the part of the race where the race mode word is still 1.
export const counting = start => start.mode === RULES().countdownMode;

// The lateral word of a racer that waits with the side pictures (race.idle-observed).
export const sideMode = () => IDLE().rightMode;

// The picture index of a computer racer's idle frame while it waits at the start, or null when it shows its normal frame: 8 + 2 b + a (race.idle-observed).
export function idleFrame(tick, mode, lead = 0) { // `lead` the passes the animation ran before the first frame (the intro's, race.intro)
  const I = IDLE();
  if (tick > I.racersLast) return null;
  const a = (tick + lead + I.shift) % I.period <= I.zero ? 0 : 1;
  return I.base + (mode === I.rightMode ? I.side : 0) + a; // @math the side picture is two frames on
}

// The player's idle picture while the cars wait: the frame of CARS.SP (the slot of the Tigi car unless `slot` names another driver's), or null for the normal pictures.
export function idlePlayer(tick, slot = null, mode = 0, racer = false, lead = 0) { // `mode` the racer's lateral word: the second human of a two player race waits with the side pictures and as long as the computer racers (`racer`), as they do
  const I = IDLE();
  if (tick > (racer ? I.racersLast : I.playerLast)) return null;
  const a = (tick + lead + I.shift) % I.period <= I.zero ? 0 : 1; // @math a is 0 or 1
  return ['CARS.SP', slot === null && mode !== I.rightMode ? I.playerBase + a : carFrame(slot ?? 7, I.base + (mode === I.rightMode ? I.side : 0) + a)]; // the observed car is the slot 7, whose entry 8 is the frame 92 // @math the slot 7 is the default driver
}

// The idle picture of the state's own car: the waiting frames of the countdown, none in a game that has no countdown (the race mode word is 2 from the first frame: the shoot-out, versus.shootout-rules) and none in the intro, whose frames show the normal pictures (race.intro).
export const idleRef = (state, slot = null, ahead = 0) => (state.versus?.kind === 'shootout' || state.intro ? null : idlePlayer(state.tick + ahead, slot, state.versus ? state.versus.modes[state.versus.viewer] : 0, state.versus?.viewer === 1));

// The bytes of the member the starter's pictures are cut from (race.start-rules).
export const lionBytes = members => members.get(RULES().member);

// The picture bytes of the starter's frame `lion` (a piece of GENEF.SP, race.start-rules).
export function lionFrame(world, lion) {
  const R = RULES(), C = R.cut, at = C.lights * C.lightBytes + C.tiles * C.tileBytes + lion * C.frameBytes;
  return world.lion.subarray(at, at + C.frameBytes);
}

// The starter's draw record (type -1), or null: the world point 0x28 right of racer 0 and 10 above it, projected and clipped like a racer (obj1+0x16711 to +0x16a30).
export function starterRecord(world, view, camera, anchor, lion) {
  const R = RULES(), record = racerRecord(world, view, camera, { x: anchor.x + R.lionDx, y: anchor.y + R.lionDy, compass: 0, n: -1 }, 0, 0, null, { bytes: lionFrame(world, lion) });
  return record && { ...record, type: -1, racer: -1 };
}

// One pass of the starter routine for a viewer, as the draw calls it (obj1+0x34f0, +0x35f9): it runs only while the starter word `on` is set, clears the word first unless the mode word is 0 (the intro)
// and sets it again only where it queues the lion's record (obj1+0x166b0 to +0x166ba, +0x16a19). Returns { on, shown }: the word after the pass and whether this viewer's frame shows the lion; a lion that
// fails a test once stays off for the race, except in the intro, where the word is left as it was.
export function starterPass(on, world, camera, lion, mode = null) {
  if (!on) return { on: false, shown: false };
  const shown = Boolean(starterRecord(world, viewSetup(world, camera), camera, world.start, lion));
  return { on: mode === 0 ? on : shown, shown };
}
