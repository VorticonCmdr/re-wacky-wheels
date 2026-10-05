// The constants of the player car's straight-road step (car.model, PROVEN by port-carmodel), shared by car.js and control.js.
import { K } from '../evidence/k.js';

export const MODEL = () => K({ accelStep: 10, coastStep: 4, brakeStep: 8, cap: 100, rounding: 32768, fixedBits: 16, steerStep: 40, spinStep: 120, turn: 1920, velEntryBytes: 2, trigEntryBytes: 8, cameraBehind: 124, startBias: 992 }, 'car.model');

// The lean of the car's picture (car.lean-observed): one step a tick toward the side that steers, the state word 5 while it moves and 0 on arrival.
export const LEAN = () => K({ straight: 2, left: 0, right: 4, step: 1, movingState: 5, restState: 0, tickGap: 1 }, 'car.lean-observed');
