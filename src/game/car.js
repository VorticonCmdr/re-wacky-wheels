// The player car on the straight road, as far as it is proven: car.step-observed (throttle, speed from VEL.TAB, the move per axis),
// car.steer-step-observed (the heading) and car.turn-move (the camera turns about the point NDIST[0] ahead of it).
// The state is the camera words (the position the game moves) and the heading; the car record's position is the camera plus the
// rounded step of 0x7c along the heading.
import { K } from '../evidence/k.js';
import { horizonStart, nextRamp, scrollHorizon } from './horizon.js';

const MODEL = () => K({ accelStep: 10, coastStep: 4, brakeStep: 8, cap: 100, rounding: 32768, fixedBits: 16, steerStep: 40, spinStep: 120, turn: 1920, velEntryBytes: 2, trigEntryBytes: 8, cameraBehind: 124, startBias: 992 }, 'car.model');

// The lean of the car's picture (car.lean-observed): one step a tick toward the side that steers, the state word 5 while it moves and 0 on arrival.
const LEAN = () => K({ straight: 2, left: 0, right: 4, step: 1, movingState: 5, restState: 0, tickGap: 1 }, 'car.lean-observed');
const LEAN_STRAIGHT = LEAN().straight;

export function stepLean(lean, input) {
  const L = LEAN(), target = input.right ? L.right : input.left ? L.left : L.straight, next = lean + Math.sign(target - lean) * L.step;
  return { lean: next, state: next === target ? L.restState : L.movingState };
}

const wrap16 = v => ((v % 0x10000) + 0x10000) % 0x10000; // @math 16-bit world words

// The rounded step along a heading: (TRIG vector x distance + 0x8000) >> 16 for each axis (signed).
export function straightMove(trig, heading, distance) {
  const C = MODEL(), half = C.trigEntryBytes / 2; // @math the second dword of a TRIG entry is half an entry on
  const vx = trig.getInt32(heading * C.trigEntryBytes, true), vy = trig.getInt32(heading * C.trigEntryBytes + half, true);
  const scale = 2 ** C.fixedBits; // @math 16.16 fixed point
  return { dx: Math.floor((vx * distance + C.rounding) / scale), dy: Math.floor((vy * distance + C.rounding) / scale) };
}

// The pivot offset of the turn (the routine obj1+0x27a21): the low 16 bits of (TRIG vector x the first NDIST dword + 0x8000) >> 16, per axis.
export function pivotOffset(world, heading) {
  const C = MODEL(), half = C.trigEntryBytes / 2, first = world.ndist.getUint32(0, true); // @math the first NDIST dword
  const lo = (v) => Number(((BigInt(v) * BigInt(first) + BigInt(C.rounding)) & 0xffffffffn) >> BigInt(C.fixedBits)); // @math the low 32 bits of the product, shifted right
  return [lo(world.trig.getInt32(heading * C.trigEntryBytes, true)), lo(world.trig.getInt32(heading * C.trigEntryBytes + half, true))];
}

// The camera of a car: the car record's position less the rounded step of 0x7c along the heading.
export function cameraOf(car, world) {
  const C = MODEL(), { dx, dy } = straightMove(world.trig, car.heading, C.cameraBehind);
  return { x: wrap16(car.x - dx), y: wrap16(car.y - dy), heading: car.heading };
}

// A car from its record position and heading (the throttle and the speed start at 0 unless given).
export function createCar({ x, y, heading, throttle = 0, speed = 0, rampLeft = 0, rampRight = 0, horizon = horizonStart(), lean = LEAN_STRAIGHT }, world) {
  const camera = cameraOf({ x, y, heading }, world);
  return { cx: camera.x, cy: camera.y, heading, throttle, speed, rampLeft, rampRight, horizon, lean };
}

// The car record's position of a car.
export function carPosition(car, world) {
  const C = MODEL(), { dx, dy } = straightMove(world.trig, car.heading, C.cameraBehind);
  return { x: wrap16(car.cx + dx), y: wrap16(car.cy + dy) };
}

// input: {accelerate, brake, left, right, spin}. Returns the next car and the list of unproven things this tick relied on.
export function stepCar(car, input, world) {
  const C = MODEL(), unproven = [];
  let throttle = car.throttle;
  if (input.accelerate && !input.brake) throttle = Math.min(throttle + C.accelStep, C.cap);
  else if (input.brake && !input.accelerate) throttle = Math.max(throttle - (C.coastStep + C.brakeStep), 0);
  else if (!input.accelerate && !input.brake) throttle = Math.max(throttle - C.coastStep, 0);
  else unproven.push('accelerate and brake together'); // not observed: the throttle is left as it was
  const speed = throttle === 0 ? 0 : world.speeds[throttle];
  let heading = car.heading;
  if (input.spin) heading -= C.spinStep;
  else if (input.right) heading += C.steerStep; // right wins with both keys (input.steer-flags)
  else if (input.left) heading -= C.steerStep;
  heading = ((heading % C.turn) + C.turn) % C.turn;
  const leftTurn = Boolean(input.spin || (input.left && !input.right)), rightTurn = Boolean(input.right && !input.spin);
  // the steering ramps and the horizon strip (horizon.scroll): the left side first, then the right
  const rampLeft = nextRamp(car.rampLeft, leftTurn), rampRight = nextRamp(car.rampRight, rightTurn);
  let horizon = car.horizon;
  if (leftTurn) horizon = scrollHorizon(horizon, 'left', rampLeft);
  if (rightTurn) horizon = scrollHorizon(horizon, 'right', rampRight);
  // the move along the old heading, then the camera swings about the pivot: it moves by the pivot offset of the old heading less that of the new
  const move = straightMove(world.trig, car.heading, speed), before = pivotOffset(world, car.heading), after = pivotOffset(world, heading);
  const dx = move.dx + (before[0] - after[0]), dy = move.dy + (before[1] - after[1]);
  const { lean } = stepLean(car.lean, input);
  return { car: { cx: wrap16(car.cx + dx), cy: wrap16(car.cy + dy), heading, throttle, speed, rampLeft, rampRight, horizon, lean, spin: Boolean(input.spin) }, unproven };
}
