// The horizon strip's offset (horizon.scroll): it only moves in a frame in which the car steers, by the steering ramp of that side, wrapping
// from one end to the other once when it sits exactly on the end bound and held at the end bound otherwise.
import { K } from '../evidence/k.js';

const SCROLL = () => K({ base: 687360, bounds: [0, 80, 160, 240], boundWords: [120868, 120872, 120876, 120880], pointerAt: 120928, modeWord: 121240, modes: [0, 3], routine: 84020, calls: [81231, 81516], leftRamp: 82, rightRamp: 84, rampCap: 4, initial: 80, initAt: [157577, 157587, 157597, 157607, 157617], carPointer: 120240 }, 'horizon.scroll');

export const horizonStart = () => SCROLL().initial;

// The bounds the offset wraps between (0 to 160 and 240 to 80): the strip repeats every bounds[2] - bounds[0] offsets.
export const horizonBounds = () => SCROLL().bounds;

// One steering frame: `side` is 'left' or 'right', `ramp` the side's ramp word after its increase for this frame.
export function scrollHorizon(offset, side, ramp) {
  const H = SCROLL(), [first, second, third, fourth] = H.bounds;
  if (side === 'right') { let p = offset === fourth ? second : offset; p += ramp; return Math.min(p, fourth); }
  let p = offset === first ? third : offset; p -= ramp; return Math.max(p, first);
}

// The ramp of a side for the next frame: up by one to the cap while that side steers, down by one to 0 otherwise.
export function nextRamp(ramp, steering) {
  const H = SCROLL();
  return steering ? Math.min(ramp + 1, H.rampCap) : Math.max(ramp - 1, 0);
}
