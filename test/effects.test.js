import test from 'node:test';
import assert from 'node:assert/strict';
import { stepEffects, effectsStart, clearFlame, startFlame } from '../src/game/effects.js';
import { entryNumber } from '../src/game/control.js';

// A synthetic world: three SDX records on the track 1 (the record 0 with both pictures, the record 1 with the 12 x 24 splash, the record 2 with flag bytes of 3, the record 3 with 0),
// the pit records 6 (flag 1) and an EFFECTS.SP whose bytes name their own offset.
function record({ first = null, second = null, flagFirst = 1, flagSecond = 1 } = {}) {
  const r = new Uint8Array(302), dv = new DataView(r.buffer);
  r[0] = flagFirst; r[0x80] = flagSecond;
  if (first) { dv.setUint32(0x100, first.offset, true); dv.setInt16(0x108, first.stride, true); dv.setInt16(0x10a, first.width, true); dv.setInt16(0x10c, first.height, true); dv.setInt16(0x112, first.frames, true); }
  if (second) { dv.setUint32(0x104, second.offset, true); dv.setInt16(0x114, second.stride, true); dv.setInt16(0x116, second.width, true); dv.setInt16(0x118, second.height, true); dv.setInt16(0x11e, second.frames, true); }
  return r;
}
const pic = (offset, width, height, frames) => ({ offset, stride: width * height, width, height, frames });
const records = Array.from({ length: 30 }, () => record({ flagFirst: 3, flagSecond: 3 }));
records[0] = record({ first: pic(0, 20, 12, 3), second: pic(720, 10, 9, 3) });
records[1] = record({ first: pic(990, 20, 12, 3), second: pic(2970, 12, 24, 2) });
records[2] = record({ flagFirst: 3, flagSecond: 3 });
records[3] = record({ first: pic(0, 20, 12, 3), second: pic(720, 10, 9, 3), flagFirst: 0, flagSecond: 0 });
records[6] = record({ first: pic(3546, 38, 28, 4), second: pic(7802, 32, 24, 8) });
const effects = new Uint8Array(30000).map((_, i) => (i % 250) + 1);
const world = { sdx: { records }, effects, hogmis: new Uint8Array(6084).map((_, i) => (i % 200) + 1), spark: new Uint8Array(360).map((_, i) => (i % 100) + 1) };
const ctx = (o = {}) => ({ world, track: 1, entryNumber: -1, racing: true, finished: false, geometry: { left: 141, top: 165 }, ...o });
const car = (o = {}) => ({ ...effectsStart(), surface: 0, stepWord: 40, throttle: 100, crashed: false, jump: 0, jumpHeight: 0, special: 0, specialShow: 0, specialRow: 0, spark: 0, sparkCount: 0, ...o });
const where = out => out.after.map(a => [a.width, a.height, a.x, a.y]);

test('the second picture is drawn twice below the car, its frame counter runs and a new id restarts it', () => {
  let c = car(), out = stepEffects(c, ctx());
  assert.deepEqual(where(out), [[10, 9, 141, 185], [10, 9, 169, 185]]); // 0 and 0x1c columns, 0x14 rows down, the stage 0 and the speed above 10: no rear picture
  assert.equal(out.after[0].bytes[0], effects[720]); assert.equal(out.car.fxCounter, 0);
  out = stepEffects(out.car, ctx()); assert.equal(out.after[0].bytes[0], effects[720 + 90]);
  out = stepEffects(out.car, ctx()); assert.equal(out.after[0].bytes[0], effects[720 + 180]);
  out = stepEffects(out.car, ctx()); assert.equal(out.after[0].bytes[0], effects[720]); // back to frame 0 at the frame count
  c = { ...out.car, surface: 1 }; out = stepEffects(c, ctx()); // the record 1: its splash picture, another id
  assert.equal(out.car.fxCounter, 0); assert.deepEqual(where(out), [[12, 24, 142, 169], [12, 24, 166, 169]]);
  assert.deepEqual(out.sounds, [{ id: 0x10, guard: true }]);
});

test('nothing moves while the step word is 0, in the countdown the puffs wait for the race mode 2, and the id word starts at 0xff', () => {
  assert.equal(effectsStart().fxId, 0xff);
  let out = stepEffects(car({ stepWord: 0, fxCounter: 2 }), ctx()); assert.deepEqual(where(out).filter(a => a[0] === 10), []); assert.equal(out.car.fxCounter, 0);
  out = stepEffects(car(), ctx({ racing: false })); assert.deepEqual(where(out), []); assert.equal(out.car.fxId, 720); assert.equal(out.up, 0); // no puffs, no jiggle
});

test('a flag byte of 3 keeps the last record and id; a flag byte of 0 draws nothing and says so', () => {
  let out = stepEffects(car(), ctx());
  out = stepEffects({ ...out.car, surface: 2 }, ctx()); // the record 2 keeps the record 0 and its counter runs on
  assert.equal(out.car.fxRecord, 0); assert.equal(out.car.fxCounter, 1); assert.equal(where(out).length, 2);
  out = stepEffects(car({ surface: 3 }), ctx());
  assert.deepEqual(where(out), []); assert.ok(out.unproven.some(u => /no picture loaded/.test(u)));
  out = stepEffects(car({ surface: 2 }), ctx()); // nothing cached yet: nothing to draw
  assert.deepEqual(where(out), []);
});

test('the first picture is drawn for the car frames of the table, at the word of its entry', () => {
  const shifts = { 1: 17, 2: 10, 3: 0, 5: 18, 6: 8, 7: 1 };
  for (const [entry, shift] of Object.entries(shifts)) {
    const out = stepEffects(car(), ctx({ entryNumber: Number(entry) }));
    assert.deepEqual(where(out), [[20, 12, 141 + shift, 181]], `entry ${entry}`); // 0x10 rows below the top; no rear pictures in this branch
    assert.equal(out.after[0].bytes[0], effects[0]);
  }
  assert.equal(where(stepEffects(car(), ctx({ entryNumber: 4 }))).length, 2); // the straight frame is not in the table
  assert.deepEqual([[ 'CARS.SP', 88 ], ['CARS.SP', 87], ['TIGER.SP', 2], ['CARS.SP', 20]].map(r => entryNumber(r, 7)), [4, 3, -1, -1]);
});

test('a glance that starts in the object pass of the call puts a frame of the bump table in the entry: the table compare fails and the puffs of the second branch are drawn', () => {
  const out = stepEffects(car(), ctx({ entryNumber: 3, glanceNow: true }));
  assert.deepEqual(where(out), [[10, 9, 141, 185], [10, 9, 169, 185]]);
  assert.equal(out.car.fxId, 720); // the id and counter of the second picture
});

test('a call does not change the car it is given or its tyre words: a dry run gives the result the real one gives', () => {
  const c = car({ tyreState: 1, tyreWords: [200, 190, 180], spark: 3, sparkCount: 1, flame: 2 }), before = JSON.stringify(c);
  const tyred = { ...world, lion: new Uint8Array(20000).map((_, i) => (i % 90) + 1) }, dry = stepEffects(c, ctx({ entryNumber: 4, world: tyred })), real = stepEffects(c, ctx({ entryNumber: 4, world: tyred }));
  assert.equal(JSON.stringify(c), before);
  assert.deepEqual(dry.car, real.car); assert.deepEqual(where(dry), where(real));
});

test('the car rises a row in every second call while the step word is above 0 and the race runs', () => {
  let out = stepEffects(car(), ctx()), rises = [out.up];
  for (let i = 0; i < 5; i++) { out = stepEffects(out.car, ctx()); rises.push(out.up); }
  assert.deepEqual(rises, [0, 1, 0, 1, 0, 1]);
  assert.deepEqual(stepEffects(car({ stepWord: 0 }), ctx()).up, 0);
  assert.deepEqual(stepEffects(car({ crashed: true }), ctx()).up, 0);
});

test('in the air, in the pit state and crashed the ground effects do nothing and keep the car\'s words', () => {
  for (const o of [{ drawnJump: 1 }, { crashed: true }]) {
    const out = stepEffects(car(o), ctx());
    assert.deepEqual(where(out), []); assert.equal(out.car.fxId, 0xff);
  }
});

test('the rear pictures: stage 0 at a crawl, the start stage with its sound, then none, the fast one above speed 100', () => {
  const rear = (o, c = {}) => stepEffects(car({ flame: 2, ...o }), ctx(c));
  let out = rear({ throttle: 5, stepWord: 4 }); assert.deepEqual(where(out).slice(0, 2), [[18, 13, 146, 176], [18, 13, 157, 176]]); assert.equal(out.after[0].bytes[0], world.hogmis[2574 + 2 * 234]);
  out = rear({ throttle: 50, flameStage: 1 }); assert.equal(out.after[0].bytes[0], world.hogmis[3510 + 2 * 234]); assert.deepEqual(out.sounds, [{ id: 0x18, guard: true }]);
  out = rear({ throttle: 50, flameStage: 1, special: 0 }, { finished: true }); assert.equal(where(out).filter(a => a[0] === 18).length, 0);
  out = rear({ throttle: 50, flameStage: 2 }); assert.equal(where(out).filter(a => a[0] === 18).length, 0);
  out = rear({ throttle: 120, flameStage: 5 }); assert.equal(out.after[0].bytes[0], world.hogmis[4446 + 2 * 234]);
  // the frame counts 0 to 3 and the stage goes up at each wrap
  let c = car({ flame: 2, flameStage: 1 }); const seen = [];
  for (let i = 0; i < 6; i++) { c = stepEffects(c, ctx()).car; seen.push([c.flame, c.flameStage]); }
  assert.deepEqual(seen, [[3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [0, 3]]);
  // the control routine's sites
  assert.equal(clearFlame({ flameStage: 3 }, false).flameStage, 0); assert.equal(clearFlame({ flameStage: 3 }, true).flameStage, 3); assert.equal(clearFlame({ flameStage: 2 }, false).flameStage, 2);
  assert.deepEqual([startFlame({ flameStage: 0, flame: 3 })].map(x => [x.flameStage, x.flame]), [[1, 0]]); assert.equal(startFlame({ flameStage: 4, flame: 3 }).flame, 3);
});

test('the sparks run four frames at the side the word names', () => {
  let c = car({ spark: 3, stepWord: 0 }), seen = [];
  for (let i = 0; i < 5; i++) { const out = stepEffects(c, ctx()); c = out.car; seen.push(out.after.filter(a => a.width === 10 && a.height === 9 && a.y === 181).map(a => [a.x, a.bytes[0]])); }
  assert.deepEqual(seen.slice(0, 4), [[[141, 1]], [[141, 91]], [[141, 81]], [[141, 71]]]); assert.deepEqual(seen[4], []); assert.equal(c.spark, 0);
  const right = stepEffects(car({ spark: 4, stepWord: 0 }), ctx()); assert.equal(right.after.find(a => a.height === 9 && a.y === 181).x, 171);
});

test('the pit surface: the splash hides the car for two rows, the pit picture follows and the state ends when the terrain changes', () => {
  let c = car({ special: 1, specialShow: 1, specialRow: 0, specialValue: 6, specialFrame: 0, surface: 6 }), out = stepEffects(c, ctx()), rows = [];
  assert.equal(out.hidden, true); assert.deepEqual(where(out).slice(0, 1), [[38, 28, 141, 168]]); assert.equal(out.after[0].bytes[0], effects[3546]);
  assert.equal(out.pit.width, 32); assert.equal(out.pit.bytes[0], effects[7802]); assert.deepEqual(out.sounds, [{ id: 0xe, guard: true }]);
  for (let i = 0; i < 4; i++) { rows.push(out.hidden); c = out.car; out = stepEffects(c, ctx()); }
  assert.deepEqual(rows, [true, true, false, false]); assert.equal(out.car.specialShow, 0);
  assert.equal(out.pit.bytes[0], effects[7802 + 4 * 768]); // the car frame counts 0 to 7
  // the end: any other terrain than the kept value and 3
  out = stepEffects(car({ special: 1, specialValue: 6, specialShow: 0, surface: 3 }), ctx()); assert.equal(out.car.special, 1);
  out = stepEffects(car({ special: 1, specialValue: 6, specialShow: 0, surface: 0 }), ctx());
  assert.deepEqual([out.car.special, out.car.specialShow, out.car.specialRow], [0, 2, 1]); // the overlay of the same call draws its frame 0 and counts on assert.ok(out.sounds.some(s => s === 0xf));
  assert.equal(out.pit.width, 32); // the call that ends it still draws the pit picture
  out = stepEffects(out.car, ctx()); assert.equal(out.hidden, false); assert.equal(out.after[0].width, 38); // the overlay runs once more with the car drawn
});

test('the crash: the flight counts eight frames up the screen, the hold lasts 11 ticks, the fall comes down by 4 and the car is gone until the try is lost', () => {
  let c = car(), tick = 40, out = stepEffects(c, ctx({ pending: true, tick, fallFrames: 1 }));
  assert.deepEqual([out.car.crashState, out.car.crashY, out.crash], [1, 165, null]); // the contact pass starts it; the car is drawn as it was
  const rows = [], tops = [];
  for (let i = 0; i < 9; i++) { tick += 1; out = stepEffects({ ...out.car, crashed: true }, ctx({ tick, fallFrames: 1 })); rows.push(out.crash.table + out.crash.row); tops.push(out.crash.top); }
  assert.deepEqual(rows, ['flight0', 'flight1', 'flight2', 'flight3', 'flight4', 'flight5', 'flight6', 'flight7', 'fall0']);
  assert.deepEqual(tops, [159, 153, 147, 141, 135, 129, 123, 117, 114]); // 0x72 is the stop
  assert.equal(out.car.crashState, 2); assert.equal(out.cracked, true); assert.deepEqual(out.sounds, [11]); // the crack comes with its sound, once
  const stamp = out.car.crashStamp;
  for (let i = 0; i < 20 && out.car.crashState === 2; i++) { tick += 1; out = stepEffects({ ...out.car, crashed: true }, ctx({ tick, fallFrames: 1 })); assert.deepEqual(out.sounds, []); }
  assert.equal(tick - stamp, 11); assert.equal(out.car.crashState, 3);
  const fallTops = [];
  while (out.car.crashState === 3) { tick += 1; out = stepEffects({ ...out.car, crashed: true }, ctx({ tick, fallFrames: 1 })); fallTops.push(out.crash.top); }
  assert.deepEqual([fallTops[0], fallTops.at(-1), out.car.crashState], [118, 199, 4]); // 4 rows a call, at most 0xc7
  const gone = out.car.crashStamp; let lost = false, hidden = 0;
  for (let i = 0; i < 20 && !lost; i++) { tick += 1; out = stepEffects({ ...out.car, crashed: true }, ctx({ tick, fallFrames: 1 })); hidden += out.hidden ? 1 : 0; lost = out.lifeLost; }
  assert.equal(tick - gone, 13); assert.ok(lost); assert.ok(hidden >= 12); assert.deepEqual(out.after, []);
});
