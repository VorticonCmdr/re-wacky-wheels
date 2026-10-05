import test from 'node:test';
import assert from 'node:assert/strict';
import { blinkStart, markFlags, objectPass } from '../src/game/blink.js';
import { createControl } from '../src/game/control.js';

const player = { left: 141, top: 165, width: 38, height: 28 }; // bottom row 192, centre column 159
const racer = (o = {}) => ({ n: 1, hit: 0, compass: 0, blink: { ...blinkStart(), flag: 1 }, ...o });
const record = (o = {}) => ({ racer: 1, left: 150, top: 150, width: 20, height: 15, sizeClass: 1, distance: 200, type: 1, ...o }); // bottom row 164, centre 159: farther than the car, in its column
const ctx = (o = {}) => ({ player, records: [record()], tick: 100, racing: true, slots: [7, 3], finished: false, ...o });

test('a racer in front of the player that is seen from behind glances back: the frames 8, 9, 9, 9, 9, 8 and the voice of its slot', () => {
  let racers = [{ n: 0 }, racer()], car = createControl(), shown = [], sounds = [];
  for (let i = 0; i < 6; i++) { const out = objectPass(racers, car, ctx({ tick: 100 + i })); racers = out.racers; shown.push(out.racers[1].blink.shown); sounds.push(out.sounds); }
  assert.deepEqual(shown, [8, 9, 9, 9, 9, 8]);
  assert.deepEqual(sounds[0], [{ id: 3, guard: true }]); assert.deepEqual(sounds.slice(1).flat(), []);
  assert.equal(racers[1].blink.phase, 0);
});

test('the racer to the left of the player\'s column blinks with the frames 10 and 11; a racer in the countdown or too far or hit does not blink at all', () => {
  let racers = [{ n: 0 }, racer()], shown = [];
  for (let i = 0; i < 6; i++) { const out = objectPass(racers, createControl(), ctx({ tick: 100 + i, records: [record({ left: 100 })] })); racers = out.racers; shown.push(out.racers[1].blink.shown); }
  assert.deepEqual(shown, [10, 11, 11, 11, 11, 10]);
  for (const [name, r, rec, c] of [['far', racer(), record({ sizeClass: 3 }), {}], ['hit', racer({ hit: 1 }), record(), {}], ['no flag', racer({ blink: blinkStart() }), record(), {}], ['wrecked car', racer(), record(), { crashed: true }]]) {
    const out = objectPass([{ n: 0 }, r], { ...createControl(), ...c }, ctx({ records: [rec] }));
    assert.equal(out.racers[1].blink.shown, null, name);
  }
  assert.deepEqual(objectPass([{ n: 0 }, racer()], createControl(), ctx({ racing: false })).sounds, []); // the voice only in the race mode 2
});

test('the flag marks a racer seen exactly from behind while it is not blinking', () => {
  const frames = [0, 1, 2, 3, 4, 5, 6, 7].map(compass => markFlags([{ n: 0 }, { ...racer(), compass, blink: blinkStart() }], 0)[1].blink.flag);
  assert.equal(frames.reduce((a, b) => a + b, 0), 1);
  assert.equal(markFlags([{ n: 0 }, { ...racer(), blink: { ...blinkStart(), phase: 2, flag: 0 } }], 0)[1].blink.flag, 0);
});

test('the player glances at a racer that is level with or nearer than the car: the bump pictures, once, with the sound PASS', () => {
  const level = record({ top: 165, height: 28, left: 141, width: 38 }), near = record({ top: 178, height: 15 }); // bottom rows 192 and 192: level; or below
  let out = objectPass([{ n: 0 }, racer({ blink: blinkStart() })], createControl(), ctx({ records: [level] }));
  assert.deepEqual([out.car.anim, out.car.row, out.car.glance, out.car.bumpStamp], [6, 1, 1, 100]); assert.deepEqual(out.sounds, [{ id: 8, guard: true }]); // a racer in the car's column: the left glance
  out = objectPass([{ n: 0 }, racer({ blink: blinkStart() })], createControl(), ctx({ records: [record({ top: 190, left: 200, height: 10 })] })); // nearer than the car, right of its column
  assert.deepEqual([out.car.anim, out.car.row], [7, 3]);
  const again = objectPass([{ n: 0 }, racer({ blink: blinkStart() })], out.car, ctx({ records: [level] })); // the word +0 holds it until the pose is straight again
  assert.deepEqual(again.sounds, []); assert.equal(again.car, out.car);
  out = objectPass([{ n: 0 }, racer({ blink: blinkStart() })], { ...createControl(), jump: 1 }, ctx({ records: [level] })); // in the air: the sound only
  assert.deepEqual([out.car.anim, out.sounds.length], [0, 1]);
  out = objectPass([{ n: 0 }, racer({ blink: blinkStart() })], { ...createControl(), special: 1 }, ctx({ records: [level] })); assert.deepEqual(out.sounds, []);
  assert.equal(near.top, 178);
});
