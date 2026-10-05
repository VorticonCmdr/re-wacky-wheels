// What the player's car does with a touched .SPW object (atr.kind-effects, STATIC; pickup.kinds-observed, pickup.tyres-observed and car.object-observed for what a played race shows
// of it): the catalogue word +0 of the object's sprite is its kind. 0 is an obstacle (it wrecks a car at the throttle 100 or more, car.crash-observed), 1 a tyre stack (taken once the
// tyre screen effect is idle), 2 a counter pickup (+4, at most 99), 3 to 7 a held item (taken when none is held); the kinds 2 to 7 are skipped while the counter is at 99.
import { K } from '../evidence/k.js';
import { startTyres } from './effects.js';

const KINDS = () => K({ listAt: 105040, countWordAt: 166776, entryBytes: 40, staticMarker: 65535, spwTableAt: 80184, spwRecordBytes: 12, kindAt: 0, counterWord: 106, counterCap: 99, counterStep: 4, heldWord: 22, consumedWord: 2, consumed: 65535, crashWord: 126, crashSound: 13, speedWord: 66, crashSpeed: 100 }, 'atr.kind-effects');
const KIND_COUNTER = 2; // @math the kind of the counter pickup (atr.kind-effects)
const HIT = 1; // @math the hit marker the walk writes into the object's word +2 (car.collision-test)

// The live objects of a track: the .SPW records with their consumed words (0 until touched, 1 after a contact that took nothing, 0xffff when taken).
export const liveObjects = world => world.objects.map(o => ({ ...o }));

// One contact (the object pass after the move): returns the next car, the object's new consumed word and whether the car wrecks in the call after it.
export function touch(car, object, kind, { centered = true, child = false, top = 0, noCrash = false } = {}) { // `noCrash`: the duck game, the shoot-out and the two player race have no obstacle crash (obj1+0x1336e to +0x1338a)
  const K1 = KINDS();
  if (kind <= 0) return { car, consumed: HIT, wrecks: car.throttle >= K1.crashSpeed && !car.crashed && centered && !child && !noCrash }; // an obstacle: marked as hit, the crash needs the throttle at the cap, the obstacle on the car's column and not the kid mode (obj1+0x13397 to +0x133af)
  if (kind === 1) return car.tyreState === 0 ? { car: startTyres(car, top), consumed: K1.consumed, wrecks: false } : { car, consumed: HIT, wrecks: false }; // the screen effect must be idle (effects.tyres); its strips start at the stack's top row
  if (car.counter >= K1.counterCap) return { car, consumed: HIT, wrecks: false }; // skipped while the counter is full
  if (kind === KIND_COUNTER) return { car: { ...car, counter: Math.min(car.counter + K1.counterStep, K1.counterCap) }, consumed: K1.consumed, wrecks: false };
  if (car.held === 0) return { car: { ...car, held: kind }, consumed: K1.consumed, wrecks: false };
  return { car, consumed: HIT, wrecks: false }; // an item is held already
}
