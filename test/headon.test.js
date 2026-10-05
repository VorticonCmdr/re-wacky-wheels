import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headOnRacer, wreckByRacer, animateCrashes, crashGone } from '../src/game/headon.js';

const car = { throttle: 100, crashed: false, special: 0, jump: 0, anim: 3, hop: 1, drift: 2 };

test('a racer that faces the car at the full throttle wrecks it, a racer seen from behind does not', () => {
  // the frame of a racer is its compass relative to the camera: the same heading is seen from behind (frame 4), the opposite from the front (frame 0)
  assert.equal(headOnRacer(car, { compass: 4 }, 480, {}), headOnRacer(car, { compass: 4 }, 480, {}));
  const facing = [0, 1, 2, 3, 4, 5, 6, 7].filter(c => headOnRacer(car, { compass: c }, 480, {}));
  assert.ok(facing.length >= 1 && facing.length <= 3, `${facing.length} compass values face the car`);
  assert.ok(!headOnRacer({ ...car, throttle: 99 }, { compass: facing[0] }, 480, {}), 'below the throttle cap');
  assert.ok(!headOnRacer({ ...car, crashed: true }, { compass: facing[0] }, 480, {}), 'a wrecked car');
  assert.ok(!headOnRacer({ ...car, jump: 1 }, { compass: facing[0] }, 480, {}), 'in the air');
  assert.ok(!headOnRacer(car, { compass: facing[0] }, 480, { child: true }), 'the kid mode');
  assert.ok(!headOnRacer(car, { compass: facing[0] }, 480, { pending: true }), 'already wrecked');
});

test('the wreck clears the car words and crashes the racer; its pictures go on and it is gone after the fourth', () => {
  const ai = { racers: [{ n: 0 }, { n: 1, crashed: false, hit: 1 }, { n: 2 }] };
  const hit = wreckByRacer(car, ai, 1, 0);
  assert.deepEqual([hit.car.throttle, hit.car.hop, hit.car.drift, hit.car.anim, hit.sound], [0, 0, 0, 0, 13]);
  assert.deepEqual([hit.ai.racers[1].crashed, hit.ai.racers[1].crashPic, hit.ai.racers[1].hit], [true, 0, 0]);
  assert.equal(hit.ai.racers[2].crashed, undefined);
  let now = hit.ai; const seen = [];
  for (let i = 0; i < 6; i++) { seen.push([now.racers[1].crashPic, crashGone(now.racers[1])]); now = animateCrashes(now); }
  assert.deepEqual(seen, [[0, false], [1, false], [2, false], [3, false], [4, true], [4, true]]);
});
