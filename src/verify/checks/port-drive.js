import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { createCar, stepCar, carPosition } from '../../game/car.js';
import { createStart, stepStart } from '../../game/start.js';
import { terrainAt, surfaceRecord, slowedSpeed } from '../../game/surface.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ drive: expected('car.drive-observed'), start: expected('race.start-rules'), bounce: expected('car.bounce-rules'), model: expected('car.model') });
const COL = { tick: 1, throttle: 2, speed: 3, x: 4, y: 5, angle: 6, accelerate: 7, terrain: 13, collision: 14 }; // @math the columns of a steps record

const same = (a, b) => a.every((v, i) => v === b[i]);

// The port's drive for the recorded keys: the state after every frame counter value, from the countdown to the end of the record.
function drive(world, record, { ungated = false, noSlow = false, accelAt = null } = {}) {
  const w = noSlow ? { ...world, sdx: { ...world.sdx, records: world.sdx.records.map(r => new Uint8Array(r.length)) } } : world;
  const ticks = Math.max(...record.samples.map(s => s[COL.tick])), flags = new Map();
  for (const s of record.samples) flags.set(s[COL.tick], Math.max(flags.get(s[COL.tick]) ?? 0, s[COL.accelerate]));
  let car = createCar(world.start, w), start = createStart();
  const states = [], hits = [false];
  const read = (c, h) => ({ throttle: c.throttle, speed: c.speed, x: carPosition(c, w).x, y: carPosition(c, w).y, angle: c.heading, terrain: c.surface, collision: h ? 1 : 0 });
  states.push(read(car, false));
  for (let t = 1; t <= ticks; t++) {
    const out = stepStart(start); start = out.start;
    const key = accelAt === null ? flags.get(t) : (flags.get(t - accelAt) ?? 0);
    const step = stepCar(car, { accelerate: Boolean(key), brake: false, left: false, right: false, spin: false }, w, { racing: ungated ? true : out.racing });
    car = step.car; hits.push(Boolean(step.hit)); states.push(read(car, step.hit));
  }
  return { states, ticks };
}

function replay(dat, record, V, options = {}) {
  assertArchive(record, dat);
  const world = loadTrack(dat, '1'), { states, ticks } = drive(world, record, options), D = V.drive;
  assert.equal(record.samples.length, D.samples, 'the samples');
  assert.equal(ticks, D.ticks, 'the last frame counter value');
  let splits = 0;
  const seen = new Set();
  for (const s of record.samples) {
    const t = s[COL.tick], row = [s[COL.throttle], s[COL.speed], s[COL.x], s[COL.y], s[COL.angle], s[COL.terrain], s[COL.collision]], at = n => { const x = states[n]; return [x.throttle, x.speed, x.x, x.y, x.angle, x.terrain, x.collision]; };
    seen.add(t);
    if (same(row, at(t))) continue;
    assert.ok(t > 0 && same(row, at(t - 1)), `frame ${t}: the sample is the port's state ${JSON.stringify(at(t))}, not ${JSON.stringify(row)}`);
    splits++;
  }
  assert.equal(splits, D.splits, 'the samples that show the state of the call before');
  assert.equal(seen.size, ticks + 1, 'a sample for every frame counter value');
  return states;
}

// Facts of the record the claim names, read from the port's states.
function facts(dat, record, V, states) {
  const world = loadTrack(dat, '1'), D = V.drive, S = V.start;
  assert.equal(D.quiet, S.readyTicks, 'the car stands still up to the counter value the starter rule sets the mode on');
  assert.ok(states.slice(0, D.quiet + 1).every(x => x.y === states[0].y && x.x === states[0].x), 'the car stands still in the countdown');
  assert.equal(states[D.firstMove].y > states[D.firstMove - 1].y, true, 'the first move');
  assert.equal(states[D.firstMove - 1].y, states[0].y, 'the first move is the frame after the quiet one');
  const climbed = states.slice(1, D.rampCap / D.rampStep + 1).map(x => x.throttle);
  assert.deepEqual(climbed, Array.from({ length: D.rampCap / D.rampStep }, (_, i) => (i + 1) * D.rampStep), 'the throttle climbs by the step to the cap in the countdown');
  assert.equal(Math.max(...states.map(x => x.throttle)), D.rampCap, 'the cap');
  assert.ok(states.slice(D.firstMove, D.firstMove + 29).every(x => x.speed === D.road.speed), 'the road speed'); // @math the frames up to the one before the surface changes
  const off = states.findIndex(x => x.terrain === 1);
  assert.equal(states[off].y, D.road.offAt, 'the surface changes at this row');
  assert.equal(states[off].speed, D.road.speed, 'the speed word of the call that reaches the surface is still the road\'s');
  assert.equal(states[off + 1].speed, D.road.offSpeed, 'and the next call\'s is lowered');
  assert.equal(surfaceRecord(world, 1).fraction, D.road.fraction, 'the fraction of the surface');
  assert.equal(slowedSpeed(D.road.speed, D.road.fraction), D.road.offSpeed, 'the lowered speed');
  const W = V.bounce, first = states.findIndex(x => x.collision === 1);
  assert.equal(first, D.wall.bumpAt, 'the first call with the collision word');
  assert.equal(terrainAt(world, states[0].x, D.wall.row), W.wallTerrain, 'the first row of the wall');
  assert.notEqual(terrainAt(world, states[0].x, D.wall.row - 1), W.wallTerrain, 'and the row before it is not');
  assert.equal(D.wall.row - W.thrownBack, D.wall.thrownRow, 'the car is thrown back from the first row of the wall');
  assert.deepEqual(states.slice(first + 1, first + D.wall.cycle + 1).map(x => [x.throttle, x.speed, x.y]), D.wall.ladder, 'the ladder after the bump');
  const bumps = states.map((x, n) => (x.collision ? n : -1)).filter(n => n >= 0);
  assert.ok(bumps.every((n, i) => i === 0 || n - bumps[i - 1] === D.wall.cycle), 'a bump every five calls');
}

export default {
  id: 'port-drive',
  claims: ['car.drive-observed'],
  obs: ['hold-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), record = ctx.obs(V.drive.record);
    facts(dat, record, V, replay(dat, record, V));
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), record = ctx.obs(V.drive.record);
    const alter = (n, k, f) => ({ ...record, samples: record.samples.map((s, i) => (i === n ? s.map((v, j) => (j === k ? f(v) : v)) : s)) });
    return [
      { label: 'the car moving in the countdown', fn: () => replay(dat, record, V, { ungated: true }) },
      { label: 'no surface slowdown', fn: () => replay(dat, record, V, { noSlow: true }) },
      { label: 'the key down a frame later', fn: () => replay(dat, record, V, { accelAt: 1 }) }, // @math one frame
      { label: 'a recorded speed altered', fn: () => replay(dat, alter(150, COL.speed, v => v + 1), V) }, // @math the 150th sample
      { label: 'a recorded row altered', fn: () => replay(dat, alter(200, COL.y, v => v + 1), V) }, // @math the 200th sample
      { label: 'a recorded terrain value altered', fn: () => replay(dat, alter(120, COL.terrain, v => v + 1), V) }, // @math the 120th sample
    ];
  },
};
