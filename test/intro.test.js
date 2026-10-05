import test from 'node:test';
import assert from 'node:assert/strict';
import { introEnabled, startIntro, stepIntro } from '../src/game/intro.js';

// A world whose pivot offset is 0 (the first NDIST dword 0): only the slide, the heading, the ramp and the horizon of the intro show.
const world = { ndist: new DataView(new ArrayBuffer(8)), trig: new DataView(new ArrayBuffer(1920 * 8)) };
const car = { cx: 1000, cy: 2000, heading: 480, rampLeft: 0, horizon: 80 };

test('the intro starts with the camera at the column 1800, the row 132 below the race\'s and the heading 960', () => {
  const { car: first, intro } = startIntro(car);
  assert.deepEqual([first.cx, first.cy, first.heading], [1800, 2132, 960]);
  assert.deepEqual(intro, { phase: 'slide', savedX: 1132, savedY: 2000 });
});

test('the slide takes the column down by 64 a pass, the swing 40 off the heading a pass with the left ramp and the horizon, and the last pass puts the camera at the race\'s own place', () => {
  let { car: c, intro } = startIntro(car);
  const xs = [c.cx], headings = [c.heading], horizons = [c.horizon];
  let passes = 0;
  while (intro) { ({ car: c, intro } = stepIntro(world, c, intro)); passes++; xs.push(c.cx); headings.push(c.heading); horizons.push(c.horizon); }
  assert.deepEqual(xs.slice(0, 4), [1800, 1736, 1672, 1608]);
  assert.deepEqual(headings.slice(10, 14), [960, 920, 880, 840]); // 11 slide frames; the pass that takes the column to or below the saved one swings at once
  assert.deepEqual([1, 2, 3, 4].map(k => horizons[10 + k] - horizons[9 + k]), [-1, -2, -3, -4]);
  assert.equal(passes, 11 + 11); // the slide frames 1800 to 1160, the swing frames 920 to 520 and the pass that ends it
  assert.deepEqual([c.cx, c.cy, c.heading, c.rampLeft], [1000, 2000, 480, 0]);
  assert.equal(horizons[0] - c.horizon, 1 + 2 + 3 + 4 * 8); // eleven swing passes: the ramp goes 1, 2, 3 and then stays at 4
});

test('the intro is for single player races and the demos: not the duck game, the two player games or the time trial', () => {
  assert.equal(introEnabled({ duck: false, versus: false, cls: 1 }), true);
  assert.equal(introEnabled({ duck: true, versus: false, cls: 1 }), false);
  assert.equal(introEnabled({ duck: false, versus: true, cls: 1 }), false);
  assert.equal(introEnabled({ duck: false, versus: false, cls: 4 }), false);
});
