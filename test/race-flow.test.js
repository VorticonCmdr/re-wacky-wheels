import test from 'node:test';
import assert from 'node:assert/strict';
import { createStart, stepStart, idleFrame, idlePlayer, counting, starterPass } from '../src/game/start.js';
import { touch } from '../src/game/pickups.js';
import { stepFinish, NO_KEYS } from '../src/game/laps.js';

test('the countdown runs 34 frames: the mode is 1 until the counter reaches 34, the starter shows its pictures at 17 and 34, the cars run from the frame after', () => {
  let start = createStart();
  const log = [];
  for (let t = 1; t <= 36; t++) { const out = stepStart(start); start = out.start; log.push([t, start.mode, start.lion, out.racing]); }
  assert.deepEqual(log[0], [1, 1, 0, false]);
  assert.deepEqual(log[15], [16, 1, 0, false]);
  assert.deepEqual(log[16], [17, 1, 1, false]);
  assert.deepEqual(log[32], [33, 1, 1, false]);
  assert.deepEqual(log[33], [34, 2, 2, false]); // the mode word is 2 from this call on, the cars still wait in it
  assert.deepEqual(log[34], [35, 2, 2, true]); // the first call that moves them
  assert.equal(counting(createStart()), true);
});

test('a starter that is switched off is never asked again: the pass costs nothing and answers no', () => {
  assert.deepEqual(starterPass(false, null, null, 2), { on: false, shown: false }); // obj1+0x34f0: the draw does not call the routine while the starter word is 0
});

test('the waiting cars show frames 8 to 11 until the 41st frame, the player 92 or 93 (Tigi) until the 35th', () => {
  for (let t = 0; t <= 41; t++) { const j = idleFrame(t, 4); assert.ok(j >= 10 && j <= 11, `racer frame at ${t}`); assert.ok(idleFrame(t, 3) >= 8 && idleFrame(t, 3) <= 9); }
  assert.equal(idleFrame(42, 4), null);
  assert.deepEqual(idlePlayer(0)[0], 'CARS.SP');
  assert.ok([92, 93].includes(idlePlayer(35)[1]));
  assert.equal(idlePlayer(36), null);
  assert.deepEqual(idlePlayer(0, 7), idlePlayer(0)); assert.deepEqual(idlePlayer(35, 7), idlePlayer(35)); // the observed car is the slot 7
  assert.deepEqual([0, 3].map(slot => idlePlayer(0, slot)[1]), [8 + 12 * 0, 8 + 12 * 3].map(n => n + (idlePlayer(0)[1] - 92))); // another driver's slot has its own frames
});

test('pickups: the counter takes 4 up to 99, an item is taken only when none is held, tyres only while the effect is idle, an obstacle only wrecks at the throttle cap', () => {
  const car = { throttle: 100, counter: 0, held: 0, tyreState: 0, crashed: false };
  assert.equal(touch(car, {}, 2).car.counter, 4);
  assert.equal(touch({ ...car, counter: 98 }, {}, 2).car.counter, 99);
  assert.equal(touch({ ...car, counter: 99 }, {}, 2).consumed, 1); // skipped while the counter is full: only the hit marker
  assert.equal(touch(car, {}, 3).car.held, 3);
  assert.equal(touch({ ...car, held: 5 }, {}, 3).car.held, 5);
  assert.equal(touch(car, {}, 1, { top: 158 }).car.tyreState, 0xffff); assert.deepEqual(touch(car, {}, 1, { top: 158 }).car.tyreWords, [158, 169, 180]);
  assert.equal(touch({ ...car, tyreState: 1 }, {}, 1).consumed, 1);
  assert.equal(touch(car, {}, 0).wrecks, true);
  assert.equal(touch({ ...car, throttle: 90 }, {}, 0).wrecks, false);
});

test('the finish is set in the call after the lap word reaches the laps word plus 1, and the keys are ignored from then on', () => {
  assert.deepEqual(stepFinish(false, 6, 6), { finished: false, fresh: false });
  assert.deepEqual(stepFinish(false, 7, 6), { finished: true, fresh: true });
  assert.deepEqual(stepFinish(true, 7, 6), { finished: true, fresh: false });
  assert.equal(Object.values(NO_KEYS).some(Boolean), false);
});
