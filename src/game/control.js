// The player's controls as the control routine (obj1+0x190a0) and the input routine (obj1+0x124ec) of the game run them (car.control-rules, STATIC): the lean and the held counts of
// the steering keys, the brake and the throttle, the hand brake turn, the hop, the drift, the pit's jump, the boost, the special surface flag and the animation states with the
// picture tables they show. The car is a plain object whose words follow the game's car record; the move and its walk stay in car.js, which calls controlStep before the move and
// lookupEffects, boostAfterMove, animate and drawStep after it.
import { RULES as RULES_DUCK } from './duck-rules.js';
import { effectsStart, clearFlame, startFlame } from './effects.js';
import { K } from '../evidence/k.js';
import { surfaceRecord, slowedSpeed } from './surface.js';
import { MODEL, LEAN } from './car-model.js';
import { kid } from './classes.js';

const CLASS = () => K({ routine: 27808, detailWord: 166944, steerRateAt: 167036, steerRates: [40, 36, 32], steerOverride: 36, overrideWords: [166882, 126068], hopRateAt: 167034, fixedWord: 166996, fixed: 120, tableWords: 200, activeTableAt: 124720, slowTableAt: 124292, fastTableAt: 125124, slowSelectWordAt: 125528, slowSelect: 2, classAt: 126216, classCopyAt: 125532 }, 'race.class-setup');
const CTL = () => K({
  controlRoutine: 0x190a0, inputRoutine: 0x124ec, stateTable: 0x19068,
  keyBits: { left: 1, right: 2, accelerate: 4, fire: 8, brake: 0x10, handBrake: 0x20 },
  turn: { amount: 0x78, calls: 4, start: 1, ramp: 0x10, leftRow: 0, rightRow: 6, right: 2 },
  drift: { timer: 0x78, step: 10, hold: 2, exitRows: 3, speedZero: 0, left: 1, right: 2 },
  hop: { leftStart: 7, rightStart: 9, shown: 6, rightEnd: 0x10, rate: 0x78, left: 1, right: 2 },
  jump: { speedEntry: 150, count: 8, height: 8, max: 0x28, step: 8, fallAt: 4, spinFrom: 5, spinTo: 6, spinEnd: 8, terrainFall: 10, rising: 1, falling: 2, landed: 3 },
  boost: { throttle: 0xa0, calls: 0x10, terrain: 2 },
  special: { terrains: [6, 15], frames: 4 },
  finish: { places: [1, 3], voices: 3 },
  bump: { hold: 3, leftLast: 0, rightLast: 4, recoverLeftTo: 2, recoverRightTo: 2, leftStart: 1, rightStart: 3 },
  states: { straight: 0, hopLeft: 1, hopRight: 2, driftLeft: 3, driftRight: 4, lean: 5, bumpLeft: 6, bumpRight: 7, recoverLeft: 8, recoverRight: 9, pose: 10, wobble: 13, spin: 14 },
  tables: { lean: [12, 13, 4, 14, 15], drift: [3, 12, 13, 4, 14, 15, 5], bump: [9, 8, 4, 10, 11], wobble: [8, 9, 8, 4, 10, 11, 10, 4], pose: [4, 3, 2, 1, 0], spinEntries: 8, spinFirst: 4, spinRows: 17 },
  slots: [[4, 2], [4, 4], [4, 8], [4, 8], [2, 2], [1, 7], [2, 2], [1, 4]],
  entries: { cars: 12, lean: 12, flight: 16, fall: 24, pose: 28 },
}, 'car.control-rules');
const GATE = () => K({ gateRoutine: 9660, setupRoutine: 9448, trackWord: 124712, headingWord: 120276, carWord: 10, startRange: [125892, 126016], activeRange: [125896, 126020], west: { tracks: [6, 10, 13, 15, 25], range: [840, 1080] }, north: { tracks: [24, 29, 35], range: [1320, 1560] }, both: { tracks: [3, 4, 9], range: [1320, 1560] } }, 'car.boost-gate');

// The steering rate of a detail level (race.class-setup): 40, 36 or 32 for the levels 1 to 3, and half of it for the drift.
export const straightState = () => CTL().states.straight; // the pose word of the straight car
export const forcedRamp = () => CTL().turn.ramp; // the ramp word of a forced turn (obj1+0x13c82)
export const steerRate = detail => CLASS().steerRates[detail - 1]; // @math the detail levels count from 1

// One step of the lean of the picture (car.lean-observed): one row a call toward the target row, the state word 5 while it moves and 0 on arrival.
export function stepLean(lean, input) {
  const L = LEAN(), target = input.right ? L.right : input.left ? L.left : L.straight, next = lean + Math.sign(target - lean) * L.step;
  return { lean: next, state: next === target ? L.restState : L.movingState };
}

// The words a new car starts with (the race start, obj1+0x203ed to +0x20506): the straight pose, nothing running. `pic` names the picture table and row the car shows.
export function createControl() {
  const L = LEAN(), S = CTL().states;
  return {
    anim: S.straight, row: L.straight, target: L.straight, pic: { table: 'lean', row: L.straight }, lean: L.straight,
    bumpStamp: 0, turn: 0, turnCount: 0, hop: 0, hopEnded: 0, drift: 0, driftTimer: 0, heldLeft: 0, heldRight: 0, stamp: 0,
    jump: 0, jumpCount: 0, jumpHeight: 0, boost: 0, boostCount: 0, special: 0, specialShow: 0, specialRow: 0, poseRow: 0, wobbleRow: 0,
    inverted: 0, invertedAt: 0, fireLatch: 0, firePress: 0, held: 0, counter: 0, spark: 0, sparkCount: 0, voiceCount: 0, events: [],
    glance: 0, ...effectsStart(),
  };
}

// A sound the car asks for (audio.race-sounds): a number, or { id, guard } for the sites that wait for the last voice of the number to end first. The page plays them after the call.
const emit = (car, id, guard = false) => { car.events = [...car.events, guard ? { id, guard } : id]; return car; };
const SKID = 17, WARP = 12, SPLASH = 15, DROP = 23, DRIVER = 'driver'; // @math the sound numbers of SKID, WARP, SPLASH and DROP (audio.race-sounds); the driver's own voice has no number here

// obj1+0x12334 (inlined at the ends of the states): the straight pose, row 2 of the lean table, nothing running.
const straight = car => { const L = LEAN(); return { ...car, glance: 0, anim: CTL().states.straight, row: L.straight, target: L.straight, lean: L.straight, pic: { table: 'lean', row: L.straight } }; };
const show = (car, table, row) => ({ ...car, row, pic: { table, row }, lean: table === 'lean' ? row : car.lean });

// The entry of the driver's slot record a picture-table row shows (the loader obj1+0x73c4 to +0x7862): a CARS.SP frame of the slot (entries 0 to 11) or a frame of the driver's file.
export function entryOf(table, row) {
  const T = CTL().tables, E = CTL().entries;
  switch (table) {
    case 'lean': return T.lean[row];
    case 'drift': return T.drift[row];
    case 'spin': return (T.spinFirst + row) % T.spinEntries;
    case 'bump': return T.bump[row];
    case 'wobble': return T.wobble[row];
    case 'pose': return row < T.pose.length ? T.pose[row] : E.pose + (row - T.pose.length);
    case 'flight': return E.flight + row;
    case 'fall': return E.fall + row;
    default: throw new Error(`no picture table ${table}`);
  }
}

// The picture source of an entry for the driver's slot: { file: 'cars', index } (a frame of CARS.SP) or { file: 'driver', index } (a frame of the driver's file), null for an entry
// the slot does not have (the fall and finish pictures beyond A and B).
export function sourceOf(entry, slot) {
  const C = CTL(), E = C.entries, [A, B] = C.slots[slot];
  if (entry < E.cars) return { file: 'cars', index: slot * E.cars + entry };
  if (entry < E.fall) return { file: 'driver', index: entry - E.lean }; // the entries 12 to 23 are the driver frames 0 to 11
  if (entry < E.pose) return entry - E.fall < A ? { file: 'driver', index: entry - E.lean } : null; // the entries 24 to 27 are the frames 12 to 11 + A
  return entry - E.pose < B ? { file: 'driver', index: E.cars + A + entry - E.pose } : null;
}

// The source of the picture a car shows for the driver's slot.
// The CARS.SP frame an entry of a driver's slot record is (the slot's twelve frames follow each other).
export const carFrame = (slot, entry) => slot * CTL().entries.cars + entry;

// The entry of the driver's slot record a car frame ([file, index]) is: a CARS.SP frame of the slot is its entry 0 to 11, the driver's frames are not entries below 12; -1 for any other frame.
// The start of a bump picture sequence by the pass-by glance (obj1+0x13065 to +0x130a6, racer.blink): the state and its first row, the car's word +0 set, the stamp the frame counter.
export const startBump = (car, anim, row, tick) => ({ ...show(car, 'bump', row), anim, glance: 1, bumpStamp: tick });

// The number of fall frames the slot's driver file has (the A of the slot, the words +0x90 of its record).
export const fallFrames = slot => CTL().slots[slot][0];
// The number of pose frames the slot's driver file has (the B of the slot, the word +0x92 of its record).
export const slotCounts = slot => CTL().slots[slot];
export const entryNumber = (ref, slot) => { const E = CTL().entries; return ref[0] === 'CARS.SP' && ref[1] >= slot * E.cars && ref[1] < (slot + 1) * E.cars ? ref[1] - slot * E.cars : -1; };
export const pictureOf = (car, slot) => sourceOf(entryOf(car.pic.table, car.pic.row), slot);

// The keys the key sampler leaves (obj1+0x1d6d0 and +0x1d7bf): the brake, hand brake and fire keys are cleared unless the race mode is 2, and all of them while the car hops, after the
// finish, in a wreck, in a forced turn or with a stunned racer.
const NONE = { accelerate: false, brake: false, left: false, right: false, spin: false, fire: false };
export function sampleKeys(car, keys, env) {
  if (car.hop !== 0 || env.finished || car.crashed || car.turn !== 0 || env.stunned) return NONE;
  return env.racing ? keys : { ...keys, brake: false, spin: false, fire: false };
}

// One call of the control routine for the car (before its move). `keys` are { accelerate, brake, left, right, spin, fire }; `env` is { world, tick, detail, racing, finished, stunned }:
// `tick` the game's frame counter, `racing` whether the race mode is 2. Returns the car with its control words updated, the steering amounts (the words obj2+0x28b92 and +0x28b90) and
// the speed word of this call, and `unproven` names what the call relied on that no record shows.
export function controlStep(car0, keys, env) {
  const C = CTL(), M = MODEL(), L = LEAN(), S = C.states, world = env.world, unproven = [];
  const R = env.duck ? CLASS().steerOverride : steerRate(env.detail), half = R >> 1; // the duck game and the two player race steer at 36 whatever the detail (obj1+0x6ce7); // @math half the rate: the drift's amount (obj1+0x6d09, sar 1)
  let car = { ...car0 };
  const surf = surfaceRecord(world, car.surface), N = surf.slide;
  if (car.jump !== 0) { // the jump branch (obj1+0x191e2 to +0x192e8): no controls, the speed word the table's entry 150
    unproven.push('the pit\'s jump (observed as words in car.pit-observed; its picture and the landing are read, not observed)');
    const speed = world.speeds[C.jump.speedEntry];
    if (car.jumpCount > C.jump.fallAt && car.jumpCount <= C.jump.spinTo && car.anim !== S.spin) car = { ...show(car, 'spin', 0), anim: S.spin, stamp: env.tick };
    if (car.anim === S.spin) { const row = car.row + 1; car = row >= C.jump.spinEnd ? straight(car) : show(car, 'spin', row); }
    car.jumpCount -= 1;
    if (car.jumpCount <= C.jump.fallAt) car.jump = C.jump.falling;
    return { car, left: 0, right: 0, speed, unproven };
  }
  const kb = sampleKeys(car, keys, env);
  const resting = () => car.anim === S.straight || car.anim === S.lean;
  // the lean and the held counts (obj1+0x192ed to +0x194db)
  if (!kb.right && !kb.left && resting() && car.row !== L.straight) car = { ...car, anim: S.lean, target: L.straight };
  let leftWord = kb.left, rightWord = kb.right; // the steering flags; the inverted car swaps them (obj1+0x1934a to +0x1937d)
  if (car.inverted !== 0) { if (leftWord) { leftWord = false; rightWord = true; } else if (rightWord) { leftWord = true; rightWord = false; } }
  if (env.demo && car.stepWord === 0) { // in a demo race (the mode word not 0) a steering word is cancelled while the step word +0x26 is 0: only the car's lean picture follows the key (obj1+0x1939c to +0x19415; demo.flow)
    if (rightWord) { rightWord = false; if (resting()) car = { ...car, target: L.right, anim: S.lean }; }
    if (leftWord) { leftWord = false; if (resting()) car = { ...car, target: L.left, anim: S.lean }; }
  }
  if (leftWord) { car.heldRight = 0; car.heldLeft += 1; if (resting()) car = { ...car, target: L.left, anim: S.lean }; } else car.heldLeft = 0;
  if (rightWord) { car.heldLeft = 0; car.heldRight += 1; if (resting()) car = { ...car, target: L.right, anim: S.lean }; } else car.heldRight = 0;
  // the brake takes its step and cancels the accelerate key while the throttle is above 0; the coast or the accelerate step follows unless a boost runs (obj1+0x19553 to +0x196d5)
  let accelerate = kb.accelerate;
  if (kb.brake && car.throttle > 0) { accelerate = false; car.throttle = Math.max(car.throttle - M.brakeStep, 0); emit(car, SKID, true); }
  clearFlame(car, accelerate); // the stage word of the rear pictures (effects.car-rear)
  if (env.child && !env.finished) accelerate = true; // the kid mode holds the accelerate flag set until the finish (obj1+0x195ee)
  if (car.boost === 0) car.throttle = accelerate ? (env.child ? kid().throttle : Math.min(car.throttle + (env.duck ? RULES_DUCK().throttleStep : M.accelStep), M.cap)) : Math.max(car.throttle - M.coastStep, 0);
  if (car.boost === 0 && accelerate) startFlame(car);
  else { car.boostCount -= 1; if (car.boostCount <= 0) car.boost = 0; }
  let speed = world.speeds[car.throttle];
  car.stepWord = speed; // the step word +0x26 the draw tests (obj1+0x196c9)
  // the hand brake turn starts (obj1+0x196d9 to +0x197b0): the throttle not 0 and nothing running
  if (kb.spin && car.drift === 0 && car.hop === 0 && car.throttle !== 0 && car.turn === 0) {
    const right = rightWord;
    car = { ...car, turn: right ? C.turn.right : C.turn.start, turnCount: C.turn.start, stamp: env.tick, drift: right ? C.drift.right : C.drift.left };
    car = right ? { ...show(car, 'drift', C.turn.rightRow), anim: S.driftRight } : { ...show(car, 'drift', C.turn.leftRow), anim: S.driftLeft };
    emit(car, SKID);
  }
  if (car.surface === C.jump.terrainFall || !env.racing || env.stunned) return { car, left: 0, right: 0, speed, unproven }; // the input routine does nothing (obj1+0x197b9, +0x124fe, +0x1250c)
  let left = 0, right = 0;
  if (car.turn !== 0) { // the forced turn (obj1+0x1251f): the amount on each of 4 calls, no slowdown
    unproven.push('the hand brake turn past its first call (the amount 120 on 4 calls is read; one observed pair)');
    if (car.turn === C.turn.start) left = C.turn.amount; else right = C.turn.amount;
    car.turnCount += 1;
    if (car.turnCount > C.turn.calls) { car.turn = 0; car.drift = 0; }
    return { car, left, right, speed, unproven };
  }
  const slowed = v => (v > 0 && surf.fraction !== 0 ? Math.max(slowedSpeed(v, surf.fraction), 0) : v); // @math the speed word stays a speed
  const ends = c => ({ ...straight(c), hopEnded: 1, hop: 0, heldLeft: 0, heldRight: 0, throttle: 0 }); // the end of a hop (obj1+0x125d9 to +0x12609)
  if (car.hop !== 0) { // the hop (obj1+0x12574)
    unproven.push('the hop (read, not observed: its frames, its steering and its end)');
    if (env.tick - car.stamp >= 1) { // @math one frame since the stamp
      car.stamp = env.tick;
      if (car.hop === C.hop.left) { car.row -= 1; left = C.hop.rate; } else { car.row += 1; right = C.hop.rate; }
      const done = car.hop === C.hop.left ? car.row < 0 : car.row > C.hop.rightEnd; // @math the left hop ends when its row passes 0
      if (done) { car = ends(car); left = 0; right = 0; } else car = show(car, 'spin', car.row);
    }
    speed = slowed(speed);
    if (speed <= 0 && car.hopEnded !== 0 && car.hop !== 0) { car = ends(car); left = 0; right = 0; }
    return { car, left, right, speed, unproven };
  }
  if (car.drift !== 0) { // the drift (obj1+0x126f7)
    unproven.push('the slide (the drift: read, not observed)');
    const limit = N !== 0 ? 2 * N : 0; // @math the drift turns into a hop after twice the slide word (obj1+0x12709)
    if (leftWord) { left = half; if (car.drift === C.drift.right) { left = 0; if (car.heldLeft >= C.drift.hold && N !== 0) { car.drift = 0; return { car, left, right, speed, unproven }; } } }
    if (rightWord) { right = half; if (car.drift === C.drift.left) { right = 0; if (car.heldRight >= C.drift.hold && N !== 0) { car.drift = 0; return { car, left, right, speed, unproven }; } } }
    const hopFrom = (side, row, anim) => emit({ ...show({ ...car, drift: 0, hop: side, hopEnded: 0, stamp: env.tick }, 'spin', row), anim }, SKID);
    if (car.drift === C.drift.left) { if (car.heldLeft >= limit) { car = hopFrom(C.hop.left, C.hop.leftStart, S.hopLeft); left = C.hop.rate; } }
    else if (car.heldRight >= limit) { car = hopFrom(C.hop.right, C.hop.rightStart, S.hopRight); right = C.hop.rate; }
    car.driftTimer -= C.drift.step;
    if (car.driftTimer < 0) car.drift = 0;
    speed = slowed(speed); car.stepWord = speed; // the slowdown lowers the step word itself (obj1+0x128c2)
    if (speed > 0 && car.drift !== 0) return { car, left, right, speed, unproven };
    if (car.hop === 0) { left = 0; right = 0; }
    car.heldLeft = 0; car.heldRight = 0; car.drift = 0; speed = C.drift.speedZero; car.stepWord = speed; // the end of the slide zeroes the step word too (obj1+0x12933): the next call's steering words see it
    return { car, left, right, speed, unproven };
  }
  // the normal branch (obj1+0x12940)
  speed = slowed(speed);
  const allow = car.throttle >= M.cap && car.special === 0 && car.surface !== C.boost.terrain && !env.duck; // the throttle at its cap; the duck game and the two player race allow no slide (obj1+0x12986)
  if (leftWord) left = R;
  if (rightWord) { left = 0; right = R; }
  car.drift = 0; car.hop = 0;
  if (!allow) return { car, left, right, speed, unproven };
  const start = side => {
    left = 0; right = 0;
    if (side === C.drift.left ? leftWord : rightWord) { if (side === C.drift.left) left = half; else right = half; }
    const row = side === C.drift.left ? C.turn.leftRow : C.turn.rightRow, anim = side === C.drift.left ? S.driftLeft : S.driftRight;
    car = { ...show(car, 'drift', row), anim, drift: side, stamp: env.tick, driftTimer: C.drift.timer, heldRight: 0, heldLeft: 0 }; emit(car, SKID);
    if (N === 0) { // the slide word 0: a hop at once (obj1+0x12a8b)
      emit(car, SKID);
      car = { ...show(car, 'spin', side === C.drift.left ? C.hop.leftStart : C.hop.rightStart), anim: side === C.drift.left ? S.hopLeft : S.hopRight, drift: 0, hop: side, hopEnded: 0, stamp: env.tick };
      left = 0; right = 0;
    }
  };
  if (car.heldLeft >= N) { unproven.push('the slide start (read, not observed)'); start(C.drift.left); }
  else if (car.heldRight >= N) { unproven.push('the slide start (read, not observed)'); start(C.drift.right); }
  return { car, left, right, speed, unproven };
}

// The finish (obj1+0x21609 to +0x21773), once the finish flag is set: the special flag, the held counts, the drift, the hop and the boost end, and the car takes the victory pose
// (a place from 1 to 3: the pose table from its row 0, state 10) or the wobble (the other places: its table from its row 0, state 13).
export function finishCar(car, place, tick) {
  const C = CTL(), S = C.states, victory = place >= C.finish.places[0] && place <= C.finish.places[1];
  const posed = { ...car, special: 0, heldLeft: 0, heldRight: 0, drift: 0, hop: 0, boost: 0, stamp: tick, anim: victory ? S.pose : S.wobble, voiceCount: 0 };
  if (victory) emit(posed, SKID); // the finish plays SKID for the places 1 to 3 (obj1+0x2172c)
  return victory ? { ...show(posed, 'pose', 0), poseRow: 0 } : { ...show(posed, 'wobble', 0), wobbleRow: 0 };
}

// The terrain lookup's effect after the move (obj1+0x141d1 to +0x1428e): the special surfaces 6 and 15 set the car's special flag and start their short picture.
export function lookupEffects(car, env) {
  const C = CTL();
  if (!C.special.terrains.includes(car.surface) || car.jump !== 0 || car.special !== 0 || car.crashed) return car;
  return emit({ ...car, special: 1, specialShow: 1, specialRow: 0, specialValue: car.surface, specialFrame: 0 }, SPLASH); // @math the flag's value 1 (+0x44 and +0x5a)
}

// The terrain-2 boost after the move (obj1+0x197f3 to +0x19869): the gate needs the heading in the track's range (car.boost-gate); a started boost sets the throttle 0xa0 for 16 calls;
// the boost flag falls when the throttle is 0 or below on any other surface.
export function boostAfterMove(car, env, speeds) {
  const C = CTL(), G = GATE(), track = Number(env.world.name);
  if (car.surface !== C.boost.terrain) return car.throttle > 0 ? car : { ...car, boost: 0 };
  if (car.boost !== 0) return car.throttle > 0 ? car : { ...car, boost: 0 };
  const range = G.west.tracks.includes(track) ? G.west.range : G.north.tracks.includes(track) || G.both.tracks.includes(track) ? G.north.range : [0, 0]; // @math the other tracks leave the words 0
  if (car.heading < range[0] || car.heading > range[1]) return { ...car, boost: 0 };
  return emit({ ...car, boost: 1, throttle: C.boost.throttle, boostCount: C.boost.calls, speed: speeds[C.boost.throttle] }, WARP);
}

// The animation states (obj1+0x1989b to +0x19e0a), one step a frame (the lean state every call), after the move; `env.pose` is the finish state (10 or 13) once the finish flag is set.
export function animate(car0, env) {
  const C = CTL(), S = C.states, T = C.tables, L = LEAN();
  if (car0.jump !== 0) return car0;
  let car = env.finished ? { ...car0, anim: env.pose } : car0;
  if (car.anim === S.straight) return car;
  if (!(env.tick - car.stamp >= 1 || car.anim === S.lean)) return car; // @math one frame since the stamp
  car = { ...car, stamp: env.tick };
  const B = C.slots[env.slot][1];
  switch (car.anim) {
    case S.hopLeft: { if (car.hop !== 0) return car; const row = car.row - 1; return row > C.hop.shown ? show(car, 'spin', row) : straight({ ...car, row }); }
    case S.hopRight: { if (car.hop !== 0) return car; const row = car.row + 1; return row < C.hop.shown ? show(car, 'spin', row) : straight({ ...car, row }); }
    case S.driftLeft: { if (car.drift !== 0) return car; const row = car.row + 1; return row < C.drift.exitRows ? show(car, 'drift', row) : straight({ ...car, row }); }
    case S.driftRight: { if (car.drift !== 0) return car; const row = car.row - 1; return row > C.drift.exitRows ? show(car, 'drift', row) : straight({ ...car, row }); }
    case S.lean: {
      const row = car.row < car.target ? car.row + L.step : car.row > car.target ? car.row - L.step : car.row;
      return { ...show(car, 'lean', row), anim: row === car.target ? S.straight : S.lean };
    }
    case S.bumpLeft: {
      if (car.row !== C.bump.leftLast) { const row = car.row - 1; return { ...show(car, 'bump', row), bumpStamp: row === C.bump.leftLast ? env.tick : car.bumpStamp }; }
      return env.tick - car.bumpStamp >= C.bump.hold ? { ...show(car, 'bump', car.row), anim: S.recoverLeft } : show(car, 'bump', car.row);
    }
    case S.bumpRight: {
      if (car.row !== C.bump.rightLast) { const row = car.row + 1; return { ...show(car, 'bump', row), bumpStamp: row === C.bump.rightLast ? env.tick : car.bumpStamp }; }
      return env.tick - car.bumpStamp >= C.bump.hold ? { ...show(car, 'bump', car.row), anim: S.recoverRight } : show(car, 'bump', car.row);
    }
    case S.recoverLeft: { const row = car.row + 1; return row < C.bump.recoverLeftTo ? show(car, 'bump', row) : straight({ ...car, row }); }
    case S.recoverRight: { const row = car.row - 1; return row > C.bump.recoverRightTo ? show(car, 'bump', row) : straight({ ...car, row }); }
    case S.pose: { // the finish pose of the places 1 to 3: the rows 1 to 4, then the driver's B finish frames repeating
      let row = car.poseRow + 1;
      if (car.voiceCount <= C.finish.voices) { car = emit({ ...car, voiceCount: car.voiceCount + 1 }, DRIVER, true); } // the driver's voice, up to four starts while the last one has ended (obj1+0x19cb6)
      if (row === B + T.pose.length) row = T.pose.length;
      return { ...show(car, 'pose', row), poseRow: row };
    }
    case S.wobble: { let row = car.wobbleRow + 1; if (row === T.wobble.length) row = 0; return { ...show(car, 'wobble', row), wobbleRow: row }; }
    case S.spin: { const row = car.row + 1; return row >= C.jump.spinEnd ? straight({ ...car, row }) : show(car, 'spin', row); }
    default: return car;
  }
}

// What the draw routine does to the car's jump once a frame (obj1+0x14c61 to +0x14cd1, +0x153be): the height ladder (up by 8 while rising to the limit, down by 8 while falling; landing at 0
// clears the jump). The special surface's picture and the sparks are counted by effects.js, which reads them first.
export function drawStep(car) {
  const C = CTL(), J = C.jump;
  let { jumpHeight: height, jump } = car;
  if (jump === J.rising) height = Math.min(height + J.step, J.max);
  else if (jump === J.falling) { height -= J.step; if (height <= 0) { height = 0; jump = J.landed; } }
  const next = { ...car, jumpHeight: height, jump: jump === J.landed ? 0 : jump, drawnJump: jump }; // the ground effects see the word 3 on the landing frame (obj1+0x14e6a)
  if (jump === J.landed) emit(next, DROP, true); // the landing: DROP unless it still sounds (obj1+0x14ccc)
  return next;
}

// The start of the pit's jump (obj1+0x116d4 to +0x1173f): the car word +0xa is 1, the count 8, the height 8, the limit 0x28; a special flag is cleared.
export function startJump(car) {
  const J = CTL().jump;
  return emit({ ...car, jump: J.rising, jumpCount: J.count, jumpHeight: J.height, special: 0, specialShow: 0 }, WARP);
}

// A shot or mine that hits the human (obj1+0x11cbe to +0x11d86): the spin-out starts the left hop from the row 7 (8 calls, half a turn); the type 4 inverts the steering from now on.
export function spinOut(car, tick) {
  const C = CTL();
  return { ...show({ ...car, drift: 0, hop: C.hop.left, hopEnded: 0, stamp: tick }, 'spin', C.hop.leftStart), anim: C.states.hopLeft };
}
export const invertSteering = (car, tick) => (car.inverted !== 0 ? car : { ...car, inverted: 1, invertedAt: tick });
