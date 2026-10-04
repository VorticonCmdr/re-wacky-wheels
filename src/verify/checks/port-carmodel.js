import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { createCar, stepCar, cameraOf } from '../../game/car.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['steps-1', 'steps-2', 'steps-3'], CAMERA = ['grid-1', 'grid-7', 'horizon-14'];
const values = () => ({ car: expected('car.model'), step: expected('car.step-observed'), steer: expected('car.steer-step-observed'), table: expected('floor.table-use'), gam: expected('gam.read'), floor: expected('floor.model') });

// car.model is every leaf read from the claims that observed it.
function model(V) {
  const C = V.car;
  assert.deepEqual(C, {
    accelStep: V.step.accelStep, coastStep: V.step.coastStep, brakeStep: V.step.brakeTotal - V.step.coastStep, cap: V.step.cap, rounding: V.step.rounding, fixedBits: V.floor.fixedBits,
    steerStep: V.steer.step, spinStep: V.steer.spinStep, turn: V.steer.turn, velEntryBytes: C.velEntryBytes, trigEntryBytes: V.floor.trigEntryBytes, cameraBehind: V.table.aheadDistance, startBias: V.gam.startBias,
  }, 'car.model equals its sources, leaf by leaf');
}

// The port's own stepCar replays every observed pair of samples exactly one tick apart on the road: the straight-road pairs (same keys,
// no steering) must reproduce throttle, speed and position, the steering pairs the heading.
function replay(dat, records, V, { skipVel = false } = {}) {
  const world = loadTrack(dat, '1'), counts = { straight: 0, steer: 0, still: 0 };
  assert.equal(world.speeds.length * V.car.velEntryBytes, 400, 'VEL.TAB is 400 bytes'); // @math the member's size, small.read
  for (const r of records) {
    assertArchive(r, dat);
    const c = Object.fromEntries(r.columns.map((n, i) => [n, i]));
    for (let i = 1; i < r.samples.length; i++) {
      const a = r.samples[i - 1], b = r.samples[i];
      if (b[c.tick] - a[c.tick] !== 1) continue; // @math exactly one tick apart
      if (a[c.terrain] !== 0 || b[c.terrain] !== 0 || a[c.collisionA] || a[c.collisionB] || b[c.collisionA] || b[c.collisionB]) continue;
      if (a[c.accelerate] !== b[c.accelerate] || a[c.brake] !== b[c.brake]) continue;
      const input = { accelerate: b[c.accelerate] !== 0, brake: b[c.brake] !== 0, left: b[c.leftAmount] !== 0, right: b[c.rightAmount] !== 0, spin: b[c.leftAmount] === V.car.spinStep };
      if (input.accelerate && input.brake) continue;
      const before = { ...createCar({ x: a[c.x], y: a[c.y], heading: a[c.angle] }), throttle: a[c.throttle], speed: a[c.speed] };
      const { car, unproven } = stepCar(before, input, skipVel ? { ...world, speeds: world.speeds.map(() => 0) } : world);
      const turned = b[c.angle] !== a[c.angle];
      if (b[c.throttle] === 0 && a[c.throttle] > V.car.brakeStep + V.car.coastStep + V.car.cap) continue; // a cleared throttle: a crash, not this model
      assert.equal(car.throttle, b[c.throttle], `${r.id} ${i}: throttle`);
      assert.equal(car.heading, b[c.angle], `${r.id} ${i}: heading`);
      if (b[c.throttle] !== 0) assert.equal(car.speed, b[c.speed], `${r.id} ${i}: speed`);
      if (!turned) { assert.deepEqual([car.x, car.y], [b[c.x], b[c.y]], `${r.id} ${i}: position`); counts.straight++; }
      else { assert.ok(unproven.includes('UNKNOWN_CAR_TURN_MOVE') || car.speed === 0, 'a steering tick with speed is reported as unproven'); counts.steer++; }
      if (!turned && !input.left && !input.right && car.speed === 0) counts.still++;
    }
  }
  return counts;
}

// The camera of every recorded frame that also holds the player's car (the grid frames and one horizon frame): the camera is the car less the rounded step of 0x7c along the heading.
function camera(dat, records, V) {
  const half = V.car.trigEntryBytes / 2; // @math the second dword of a TRIG entry is half an entry on
  let seen = 0;
  for (const r of records) {
    assertArchive(r, dat);
    const h = r.horizon, cam = h.camera, trig = loadTrack(dat, h.track).trig, car = cam.racers[0];
    const heading = [...Array(V.floor.wrap).keys()].find(a => trig.getInt32(a * V.car.trigEntryBytes, true) === cam.a && trig.getInt32(a * V.car.trigEntryBytes + half, true) === cam.b);
    assert.ok(heading !== undefined, `${r.id}: the heading vector words are a TRIG entry`);
    const got = cameraOf(createCar({ x: car[0], y: car[1], heading }), loadTrack(dat, h.track));
    assert.deepEqual([got.x, got.y], [cam.x, cam.y], `${r.id}: the camera is the car less the step of 0x7c`);
    seen++;
  }
  assert.equal(seen, records.length);
}

export default {
  id: 'port-carmodel',
  claims: ['car.model'],
  obs: [...IDS, ...CAMERA],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    model(V);
    const counts = replay(dat, IDS.map(id => ctx.obs(id)), V);
    assert.ok(counts.straight >= V.step.moves && counts.steer > 0, `the replay covers the straight pairs and the steering pairs (${JSON.stringify(counts)})`);
    camera(dat, CAMERA.map(id => ctx.obs(id)), V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), recs = IDS.map(id => ctx.obs(id));
    return [
      { label: 'a speed table of zeros', fn: () => replay(dat, recs, V, { skipVel: true }) },
      { label: 'another accelerate step', fn: () => model({ ...V, car: { ...V.car, accelStep: V.car.accelStep + 1 } }) },
      { label: 'another camera distance', fn: () => model({ ...V, car: { ...V.car, cameraBehind: V.car.cameraBehind + 1 } }) },
    ];
  },
};
