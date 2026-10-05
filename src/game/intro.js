// The intro before the countdown of a single player race and the demos (race.intro, STATIC): the camera comes in from the side and swings round to the start. Nothing else moves and the frame
// counter stays 0 while it runs, so it is a state of its own that `stepRace` walks before the first frame of the race.
import { K } from '../evidence/k.js';
import { pivotOffset } from './car.js';
import { scrollHorizon } from './horizon.js';

const INTRO = () => K({ routine: 0x20865, loadAt: 0x2075d, enableAt: 0x1fde4, startHeading: 0x3c0, slideX: 0x708, offset: 0x84, slideStep: 0x40, headingStep: 0x28, endHeading: 0x1e0, rampCap: 4, noClass: 4, savedWords: [0x28c92, 0x28c94], flameLead: 2, flamePeriod: 4, animDemo: 1, animRace: 2 }, 'race.intro');

const wrap16 = v => ((v + 0x8000) & 0xffff) - 0x8000; // @math a camera word is a signed 16-bit word

// Whether a race has the intro: not the duck game, the shoot-out or the two player race (`versus`), not the class 4 (the time trial) (obj1+0x1fde4 to +0x1fe0b).
export const introEnabled = ({ duck, versus, cls }) => !duck && !versus && cls !== INTRO().noClass;

// The start of the intro: the camera at the column 0x708, the row of the race's camera plus 0x84 and the heading 0x3c0, with what the loop remembers (obj1+0x2075d to +0x207a0).
// Returns the car with that camera and the intro state.
export function startIntro(car) {
  const I = INTRO();
  return { car: { ...car, cx: I.slideX, cy: wrap16(car.cy + I.offset), heading: I.startHeading }, intro: { phase: 'slide', savedX: wrap16(car.cx + I.offset), savedY: car.cy } };
}

// One pass of the loop after its frame is drawn (obj1+0x20954 to +0x20a50): the slide moves the camera x down by 0x40 until it is at or below the saved column (then the same pass swings), the swing turns the
// heading down by 0x28 about the pivot with the left ramp and the horizon, and the pass that would take the heading to 0x1e0 or below puts the camera at the race's own place and ends the intro.
// Returns { car, intro } where intro is null when it has ended.
export function stepIntro(world, car, intro) {
  const I = INTRO();
  let { cx, cy, heading, rampLeft, horizon } = car, { phase } = intro;
  if (phase === 'slide') {
    cx = wrap16(cx - I.slideStep);
    if (cx > intro.savedX) return { car: { ...car, cx }, intro };
    cx = intro.savedX; phase = 'swing';
  }
  const before = pivotOffset(world, heading);
  rampLeft = Math.min(rampLeft + 1, I.rampCap);
  heading -= I.headingStep;
  if (heading > I.endHeading) {
    const after = pivotOffset(world, heading);
    cx = wrap16(cx + before[0] - after[0]); cy = wrap16(cy + before[1] - after[1]);
    horizon = scrollHorizon(horizon, 'left', rampLeft);
    return { car: { ...car, cx, cy, heading, rampLeft, horizon }, intro: { ...intro, phase } };
  }
  return { car: { ...car, cx: wrap16(intro.savedX - I.offset), cy: intro.savedY, heading: I.endHeading, rampLeft: 0, horizon }, intro: null };
}

// The frame word of the rear pictures the first draw after the intro shows: the passes of the intro less 2, round the four frames (race.intro).
export const flameAfter = passes => { const I = INTRO(); return ((passes - I.flameLead) % I.flamePeriod + I.flamePeriod) % I.flamePeriod; };

// The offset of the object animation after the intro: the passes plus 1 in a demo race and plus 2 in a race of the menu (grabs of the running game: 18 passes on track 5 show the frame (counter + 19) in a demo
// and object.animation observed (counter + 20) in a played race).
export const animationOffset = (passes, demo) => { const I = INTRO(); return passes + (demo ? I.animDemo : I.animRace); };
