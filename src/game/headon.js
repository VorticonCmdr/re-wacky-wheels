// The head-on wreck of the human's car by a computer racer that faces it (race.head-on, STATIC): the contact routine's branch at the full throttle, the racer's crash pictures and the
// words the wreck sets. The wreck of the car itself (the call after it, the flight and the fall) is the obstacle crash's (car.crash-observed, effects.crash).
import { K } from '../evidence/k.js';
import { frameTable, racerFrame } from './racers.js';

const HEAD_ON = () => K({ routine: 0x13445, throttle: 100, frames: [0, 1, 7], sound: 13, racerState: 2, racerPicture: 0, crashPictures: 4, touchRange: 14 }, 'race.head-on');

// Whether the touch of the racer `racer` is a head-on wreck: the car at the full throttle and not wrecked, not in the pit state or the air, no kid mode, and the racer seen from the front.
export function headOnRacer(car, racer, heading, { child = false, pending = false } = {}) {
  const H = HEAD_ON();
  return car.throttle >= H.throttle && !car.crashed && !pending && car.special === 0 && car.jump === 0 && !child && H.frames.includes(racerFrame(heading, racer.compass, frameTable()));
}

// The words the wreck sets (obj1+0x13538 to +0x135fb): the car's throttle, hop and drift words and its pose are cleared (the crash word follows with `pending`), the racer is crashed with its first crash picture.
export function wreckByRacer(car, ai, n, straight) {
  const H = HEAD_ON();
  return {
    car: { ...car, throttle: 0, hop: 0, drift: 0, anim: straight },
    ai: { ...ai, racers: ai.racers.map((r, k) => (k === n ? { ...r, crashed: true, crashPic: H.racerPicture, hit: 0, crashShown: false } : r)) },
    sound: H.sound,
  };
}

// The crash pictures of the racers go on by one a frame while the word is not above the last (obj1+0x16288 to +0x162a9). A racer wrecked in a frame is still drawn as it was in that frame (the answer comes
// after its record is queued, a live test of the running game), so its crash pictures show from the next frame.
export function animateCrashes(ai) {
  const H = HEAD_ON();
  return ai.racers.some(r => r.crashed) ? { ...ai, racers: ai.racers.map(r => (r.crashed ? { ...r, crashShown: true, crashPic: r.crashPic <= H.crashPictures - 1 ? r.crashPic + 1 : r.crashPic } : r)) } : ai; // @math the word goes up to one above the last picture, where the racer is no longer drawn
}

// A racer that is not drawn any more: its crash picture word is above the last.
export const crashGone = racer => Boolean(racer.crashed) && racer.crashPic >= HEAD_ON().crashPictures;
