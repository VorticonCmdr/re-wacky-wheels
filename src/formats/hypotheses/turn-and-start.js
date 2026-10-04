// Hypotheses the playable page plugs into the proven game code (src/game never imports this file):
// each calls noteStep for the UNKNOWN claim it stands in for, so the page can badge itself with its weakest step.
import { noteStep } from '../../evidence/k.js';
import { straightMove } from '../../game/car.js';

// UNKNOWN_CAR_TURN_MOVE: in a steering tick the car moves by the straight step of the heading it had before the turn. The observed positions differ by a few units.
export function turnMoveHypothesis(car, newHeading, speed, world) {
  noteStep('UNKNOWN_CAR_TURN_MOVE');
  return straightMove(world.trig, car.heading, speed);
}

// UNKNOWN_HORIZON_SCROLL: the strip's offset is not known; the left edge of the allowed range is used.
export function horizonOffsetHypothesis() {
  noteStep('UNKNOWN_HORIZON_SCROLL');
  return 0;
}
