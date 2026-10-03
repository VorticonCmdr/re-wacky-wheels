import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { rebuildStrip, stripRows } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ pit: expected('car.pit-observed'), collision: expected('car.collision-test'), sin: expected('sin.read'), sinLayout: expected('sin.layout'), map: expected('m.read'), sheet: expected('tiles.sheet-split') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));

function validate(dat, r, V) {
  const P = V.pit;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual([r.build.id, r.build.rows, r.build.cols, r.build.value, r.build.track], [P.strip.tile, P.strip.rows, P.strip.cols, P.terrain, P.track], 'the experiment built the strip and nothing else');
  assert.equal(P.terrain, V.collision.fallTerrain, 'the strip is the pit terrain of car.collision-test');
  rebuildStrip(dat, r, V);
  const [pitRow, pitEnd] = stripRows(r.build, V), S = r.samples;
  assert.equal(pitRow, P.pitRow, 'the first world row of the pit');
  const first = S.findIndex(s => s[C.carWordA] !== 0), fall = S.filter(s => s[C.carWordA] !== 0);
  assert.ok(first > 0);
  assert.equal(fall.length, P.fallSamples, 'the samples with the fall state');
  assert.ok(S.slice(first, first + fall.length).every(s => s[C.carWordA] !== 0), 'the fall samples are consecutive');
  const head = S[first];
  assert.deepEqual([head[C.row], head[C.terrain], head[C.word0xc], head[C.word0xe]], [P.pitRow, P.terrain, P.countdown, P.jump], 'the first fall sample: at the first row of the pit, terrain 10, the counters');
  assert.equal(head[C.carWordA], 1);
  assert.deepEqual(fall.map(s => s[C.word0xc]), P.ladder, 'the countdown');
  assert.deepEqual(fall.map(s => s[C.carWordA]), fall.map(s => (s[C.word0xc] > P.fallingBelow ? 1 : 2)), 'the fall state is 1 while the counter is above 4 and 2 after'); // @math the two states
  assert.deepEqual(S.slice(first, first + fall.length + 1).map(s => s[C.word0x10]), [...P.jumps, 0], 'the second counter rises to 40 and falls to 0'); // @math one more sample after the last
  assert.equal(Math.max(...S.map(s => s[C.word0x10])), P.peak, 'its peak');
  assert.ok(fall.every(s => s[C.word0xe] === P.jump), 'the third counter is 40 throughout');
  assert.equal(S[first + fall.length][C.word0xc], 0, 'the sample after has the counter 0');
  assert.equal(S[first + fall.length][C.carWordA], 0, 'and the fall state 0');
  const animated = S.filter(s => s[C.word0x18] === P.stateWord);
  assert.equal(animated.length, P.fallSamples - 1, 'the samples in the animation state 14'); // @math the state starts a sample after the fall begins and ends a sample after
  assert.deepEqual([Math.min(...animated.map(s => s[C.word0x1a])), Math.max(...animated.map(s => s[C.word0x1a]))], [1, P.frames], 'its frames run 1 to 7'); // @math the first frame is 1
  // The car is not stopped by the pit: the throttle stays, and the row rises through and past the strip.
  const upTo = first + fall.length + 1;
  assert.ok(S.slice(first, upTo).every(s => s[C.throttle] === P.throttle), 'the throttle stays 100');
  assert.ok(S.slice(first + 1, upTo).every(s => s[C.speed] === P.speed), 'the speed is 60 from the second fall sample to the one after the last');
  assert.equal(head[C.speed], P.speed - 20, 'and 40, the throttle\'s own, in the first'); // @math the first sample is still at the table speed
  for (let i = first + 1; i < upTo; i++) assert.ok(S[i][C.row] >= S[i - 1][C.row], 'the car keeps moving');
  assert.ok(S.every(s => s[C.collision] !== V.collision.codes.fall), 'the pit code is set and cleared within a call, never seen');
  assert.ok(S[upTo - 1][C.row] >= pitEnd, 'the car is past the pit by the end of the fall');
  assert.ok(S.slice(0, first).every(s => s[C.collision] === 0 && s[C.carWordA] === 0), 'nothing before the pit');
}

export default {
  id: 'obs-pit',
  claims: ['car.pit-observed'],
  obs: ['pit-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('pit-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('pit-1'), V = values();
    const edit = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const [K2, K3, K8] = [2, 3, 8], // @math sample offsets inside the fall
    first = r.samples.findIndex(s => s[C.carWordA] !== 0), p = patch => ({ ...V, pit: { ...V.pit, ...patch } });
    return [
      { label: 'a counter that rises', fn: () => validate(dat, edit(first + K3, { [C.word0xc]: V.pit.countdown }), V) },
      { label: 'a fall state of 1 late', fn: () => validate(dat, edit(first + K8, { [C.carWordA]: 1 }), V) },
      { label: 'a throttle cleared in the fall', fn: () => validate(dat, edit(first + K2, { [C.throttle]: 0 }), V) },
      { label: 'a speed of 40 in the fall', fn: () => validate(dat, edit(first + K2, { [C.speed]: V.pit.speed - 20 }), V) }, // @math the table speed of the throttle
      { label: 'a jump counter of 48', fn: () => validate(dat, edit(first + 4, { [C.word0x10]: V.pit.peak + 8 }), V) }, // @math one more step
      { label: 'a pit of the wall terrain', fn: () => validate(dat, r, p({ terrain: V.collision.wallTerrain })) },
      { label: 'a pit one row up', fn: () => validate(dat, { ...r, build: { ...r.build, rows: [r.build.rows[0] - 1, r.build.rows[1]] } }, V) },
      { label: 'a countdown from 9', fn: () => validate(dat, r, p({ countdown: V.pit.countdown + 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
