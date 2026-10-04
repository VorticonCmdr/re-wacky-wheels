// The player car on the straight road, as far as it is proven: car.step-observed (throttle, speed
// from VEL.TAB, the move per axis) and car.steer-step-observed (the heading). What the game does
// while a steering key is held (UNKNOWN_CAR_TURN_MOVE) is not decided here: the caller may pass
// `turnMove`, a hypothesis that returns the move for such a tick; without it the car stands still
// in a steering tick and the result says so in `unproven`.
import { K } from '../evidence/k.js';

const MODEL = () => K({ accelStep: 10, coastStep: 4, brakeStep: 8, cap: 100, rounding: 32768, fixedBits: 16, steerStep: 40, spinStep: 120, turn: 1920, velEntryBytes: 2, trigEntryBytes: 8, cameraBehind: 124, startBias: 992 }, 'car.model');

export const createCar = ({ x, y, heading }) => ({ x, y, heading, throttle: 0, speed: 0 });

// The straight step along a heading: (TRIG vector x speed + 0x8000) >> 16 for each axis.
export function straightMove(trig, heading, speed) {
  const C = MODEL(), half = C.trigEntryBytes / 2; // @math the second dword of a TRIG entry is half an entry on
  const vx = trig.getInt32(heading * C.trigEntryBytes, true), vy = trig.getInt32(heading * C.trigEntryBytes + half, true);
  const scale = 2 ** C.fixedBits; // @math 16.16 fixed point
  return { dx: Math.floor((vx * speed + C.rounding) / scale), dy: Math.floor((vy * speed + C.rounding) / scale) };
}

// input: {accelerate, brake, left, right, spin}. Returns the next car and the list of unproven things this tick relied on.
export function stepCar(car, input, world, { turnMove } = {}) {
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
  const steering = heading !== car.heading;
  let move = { dx: 0, dy: 0 };
  if (!steering) move = straightMove(world.trig, heading, speed);
  else if (speed !== 0) { if (turnMove) move = turnMove(car, heading, speed, world); else unproven.push('UNKNOWN_CAR_TURN_MOVE'); }
  return { car: { x: (car.x + move.dx) & 0xffff, y: (car.y + move.dy) & 0xffff, heading, throttle, speed }, unproven }; // @math 16-bit world words
}

// The camera: the car stands cameraBehind units ahead of it along the heading by the same rounded step as a move (grid and horizon frames:
// car minus camera is (TRIG vector x 0x7c + 0x8000) >> 16 on each axis), so the camera is the car less that step.
export function cameraOf(car, world) {
  const C = MODEL(), { dx, dy } = straightMove(world.trig, car.heading, C.cameraBehind);
  return { x: (car.x - dx) & 0xffff, y: (car.y - dy) & 0xffff, heading: car.heading }; // @math 16-bit world words
}
