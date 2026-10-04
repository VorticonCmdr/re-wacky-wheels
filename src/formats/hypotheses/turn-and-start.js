// Hypotheses the playable page plugs into the proven game code (src/game never imports this file):
// each calls noteStep for the UNKNOWN claim it stands in for, so the page can badge itself with its weakest step.
import { K, noteStep } from '../../evidence/k.js';
import { straightMove } from '../../game/car.js';

// UNKNOWN_CAR_TURN_MOVE: in a steering tick the car moves by the straight step of the heading it had before the turn. The observed positions differ by a few units.
export function turnMoveHypothesis(car, newHeading, speed, world) {
  noteStep('UNKNOWN_CAR_TURN_MOVE');
  return straightMove(world.trig, car.heading, speed);
}

const DERIVED = () => K({ angleWord: 4, compassWord: 5, lengthWord: 6, turn: 1920, octant: 240, octantBias: 120, compassBase: 6, compassCount: 8, minLength: 30, tracks: 42, records: 2177, short: 3, lengthError: 1, ppm: 1000000, minCosinePpm: 999865 }, 'rd.derived-words');

// UNKNOWN_START_HEADING: the angle word of the first .RD record (480 on the tracks that were observed).
export function startHeadingHypothesis(world) {
  noteStep('UNKNOWN_START_HEADING');
  return world.route[0][DERIVED().angleWord];
}

// UNKNOWN_HORIZON_SCROLL: the strip's offset is not known; the left edge of the allowed range is used.
export function horizonOffsetHypothesis() {
  noteStep('UNKNOWN_HORIZON_SCROLL');
  return 0;
}
