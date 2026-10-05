import test from 'node:test';
import assert from 'node:assert/strict';
import { createControl, controlStep, animate, drawStep, startJump, entryOf, sourceOf, pictureOf, finishCar, steerRate } from '../src/game/control.js';

// A world with what the control routine reads: the speed table and one surface record with a fraction and a slide number.
const record = (fraction, slide) => { const b = new Uint8Array(302), dv = new DataView(b.buffer); dv.setUint32(288, fraction, true); dv.setUint32(292, slide, true); return b; };
const world = (slide = 18, fraction = 0) => ({ speeds: Array.from({ length: 200 }, (_, i) => Math.floor(i * 0.6)), sdx: { records: [record(fraction, slide)] }, name: '1' });
const car = (extra = {}) => ({ ...createControl(), surface: 0, throttle: 0, crashed: false, ...extra });
const KEYS = { accelerate: false, brake: false, left: false, right: false, spin: false, fire: false };
const ENV = (w, tick, extra = {}) => ({ world: w, tick, detail: 1, racing: true, finished: false, stunned: false, slot: 7, ...extra });

// One frame as stepCar runs it, without the move: the control routine, the animation states and the draw routine's step.
function frame(c, keys, w, tick, extra) {
  const env = ENV(w, tick, extra), out = controlStep(c, { ...KEYS, ...keys }, env);
  return { ...out, car: drawStep(animate(out.car, env)) };
}

test('the steering rate is 40, 36 or 32 by the detail level', () => {
  assert.deepEqual([1, 2, 3].map(steerRate), [40, 36, 32]);
});

test('the brake cancels the accelerate key while the throttle is above 0: both fall by 12; at 0 the accelerate step goes on', () => {
  const w = world();
  assert.equal(frame(car({ throttle: 50 }), { accelerate: true, brake: true }, w, 1).car.throttle, 38);
  assert.equal(frame(car({ throttle: 50 }), { brake: true }, w, 1).car.throttle, 38);
  assert.equal(frame(car({ throttle: 50 }), { accelerate: true }, w, 1).car.throttle, 60);
  assert.equal(frame(car({ throttle: 0 }), { accelerate: true, brake: true }, w, 1).car.throttle, 10);
  assert.equal(frame(car({ throttle: 50 }), {}, w, 1).car.throttle, 46);
});

test('the hand brake turn applies 120 on four calls, to the left unless the right key is down, and needs a throttle', () => {
  const w = world();
  let c = car({ throttle: 40 }), got = [];
  for (let t = 1; t <= 6; t++) { const out = frame(c, { spin: true }, w, t); c = out.car; got.push([out.left, out.right]); }
  assert.deepEqual(got.slice(0, 4), [[120, 0], [120, 0], [120, 0], [120, 0]]);
  assert.equal(got[4][0] + got[4][1] > 0, true, 'a held key starts the next turn'); // the key is still down: a second turn starts at once
  const right = frame(car({ throttle: 40 }), { spin: true, right: true }, w, 1);
  assert.deepEqual([right.left, right.right], [0, 120]);
  assert.equal(frame(car({ throttle: 0 }), { spin: true }, w, 1).left, 0, 'a standing car does not turn');
});

test('a steering key held for N calls at the throttle cap starts a slide; the slide ends after 13 calls, or turns into a hop when twice N calls are held first', () => {
  const road = world(18);
  let c = car({ throttle: 100 });
  for (let t = 1; t <= 17; t++) c = frame(c, { accelerate: true, left: true }, road, t).car;
  assert.equal(c.drift, 0);
  c = frame(c, { accelerate: true, left: true }, road, 18).car;
  assert.deepEqual([c.drift, c.anim, c.pic], [1, 3, { table: 'drift', row: 0 }]);
  let calls = 0;
  while (c.drift !== 0 && calls < 40) { c = frame(c, { accelerate: true, left: true }, road, 19 + calls).car; calls++; }
  assert.equal(calls, 13, 'the timer 120 falls by 10 a call and ends the slide below 0');
  assert.equal(c.hop, 0);
  const rough = world(4); // N = 4: twice N is 8 calls, inside the 13
  c = car({ throttle: 100 });
  for (let t = 1; t <= 4; t++) c = frame(c, { accelerate: true, left: true }, rough, t).car;
  assert.equal(c.drift, 1);
  for (let t = 5; t <= 12 && c.hop === 0; t++) c = frame(c, { accelerate: true, left: true }, rough, t).car;
  assert.deepEqual([c.hop, c.drift, c.anim], [1, 0, 1]);
});

test('a surface whose slide word is 0 hops at once', () => {
  const out = frame(car({ throttle: 100 }), { accelerate: true }, world(0), 1);
  assert.equal(out.car.hop, 1);
  assert.equal(out.car.pic.table, 'spin');
});

test('the lean walks one row a frame toward the target and returns to the straight pose (state 5, then 0)', () => {
  const w = world();
  let c = car(), rows = [];
  for (let t = 1; t <= 2; t++) { c = frame(c, { left: true }, w, t).car; rows.push([c.row, c.anim]); }
  assert.deepEqual(rows, [[1, 5], [0, 0]]);
  rows = [];
  for (let t = 3; t <= 4; t++) { c = frame(c, {}, w, t).car; rows.push([c.row, c.anim]); }
  assert.deepEqual(rows, [[1, 5], [2, 0]]);
});

test('the pit jump: height 16, 24, 32, 40, 32, 24, 16, 8, 0 over the frames and the count 8 down; spin rows 1 to 7, the last after the landing', () => {
  const w = world();
  let c = drawStep(startJump(car({ throttle: 100 }))), heights = [c.jumpHeight], counts = [c.jumpCount], rows = [];
  for (let t = 1; t <= 14 && (c.jump !== 0 || c.anim !== 0); t++) {
    const jumping = c.jump !== 0, out = frame(c, { accelerate: true }, w, t); c = out.car;
    if (jumping) { heights.push(c.jumpHeight); counts.push(c.jumpCount); assert.equal(out.speed, w.speeds[150]); }
    if (c.anim === 14) rows.push(c.row);
  }
  assert.deepEqual(heights, [16, 24, 32, 40, 32, 24, 16, 8, 0]);
  assert.deepEqual(counts.slice(0, 5), [8, 7, 6, 5, 4]);
  assert.deepEqual(rows, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual([c.jump, c.anim, c.row], [0, 0, 2]);
});

test('the picture tables name the slot\'s frames: the player (slot 7) leans through TIGER.SP 0 and 1, CARS.SP 88, TIGER.SP 2 and 3 and drifts as CARS.SP 87', () => {
  const lean = [0, 1, 2, 3, 4].map(r => sourceOf(entryOf('lean', r), 7));
  assert.deepEqual(lean, [{ file: 'driver', index: 0 }, { file: 'driver', index: 1 }, { file: 'cars', index: 88 }, { file: 'driver', index: 2 }, { file: 'driver', index: 3 }]);
  assert.deepEqual(sourceOf(entryOf('drift', 0), 7), { file: 'cars', index: 87 });
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(r => entryOf('spin', r)), [4, 5, 6, 7, 0, 1, 2, 3]);
  assert.equal(entryOf('spin', 16), 4);
  assert.deepEqual(pictureOf({ pic: { table: 'pose', row: 7 } }, 7), { file: 'driver', index: 12 + 1 + 2 }); // the pose rows 5 on are the driver's frames 12 + A on
  assert.equal(sourceOf(entryOf('pose', 5 + 4), 7), null, 'slot 7 has 4 finish frames (B)');
});

test('the finish: places 1 to 3 take the victory pose, the others the wobble, and the held counts, drift, hop and boost end', () => {
  const busy = car({ drift: 1, hop: 0, boost: 1, special: 1, heldLeft: 9 });
  const first = finishCar(busy, 1, 5), last = finishCar(busy, 8, 5);
  assert.deepEqual([first.anim, first.pic, first.drift, first.boost, first.special, first.heldLeft], [10, { table: 'pose', row: 0 }, 0, 0, 0, 0]);
  assert.deepEqual([last.anim, last.pic], [13, { table: 'wobble', row: 0 }]);
  // the pose advances one row a frame, from row 1 (frame 0 of the table is the first picture), and repeats the finish frames
  const w = world(); let c = first; const rows = [];
  for (let t = 6; t <= 14; t++) { c = animate(c, ENV(w, t, { finished: true, pose: 10 })); rows.push(c.row); }
  assert.deepEqual(rows, [1, 2, 3, 4, 5, 6, 7, 8, 5]); // B = 4 finish frames for slot 7: rows 5 to 8, then back to 5
});
