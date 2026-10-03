import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { rebuildStrip, stripRows } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ wall: expected('car.wall-observed'), collision: expected('car.collision-test'), move: expected('car.move-step'), model: expected('car.speed-model'), sin: expected('sin.read'), sinLayout: expected('sin.layout'),
  map: expected('m.read'), sheet: expected('tiles.sheet-split') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain'], C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));

function validate(dat, r, V) {
  const W = V.wall;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual([r.build.id, r.build.rows, r.build.cols, r.build.value, r.build.track], [W.strip.tile, W.strip.rows, W.strip.cols, W.terrain, W.track], 'the experiment built the strip and nothing else');
  assert.equal(W.terrain, V.collision.wallTerrain, 'the strip is the wall terrain of car.collision-test');
  assert.equal(W.terrain, V.move.wallTerrain);
  rebuildStrip(dat, r, V);
  const [wallRow] = stripRows(r.build, V), samples = r.samples;
  assert.equal(wallRow, W.wallRow, 'the first world row of the wall');
  assert.equal(wallRow - W.thrownBack, W.restRow, 'the car rests 32 units before it');
  assert.equal(Math.max(...samples.map(s => s[C.row])), W.maxRow, 'the car never gets into the wall');
  assert.ok(W.maxRow < wallRow);
  let bumpSamples = 0, bumps = 0;
  samples.forEach((s, i) => {
    assert.ok(s[C.collision] === 0 || s[C.collision] === V.collision.codes.wall, 'the collision word is 0 or the wall code');
    assert.equal(s[C.heading], W.heading, 'the heading never changes');
    assert.equal(s[C.terrain], 0, 'the car is on road when sampled');
    if (s[C.collision] === V.collision.codes.wall) {
      bumpSamples++;
      assert.equal(s[C.throttle], 0, 'the throttle is cleared');
      assert.equal(s[C.row], W.restRow, 'the car is thrown back 32 units before the wall');
      const before = samples[i - 1];
      if (before[C.collision] === 0) { bumps++; assert.ok(before[C.row] + before[C.speed] >= wallRow, 'the move before reaches the wall'); }
    } else assert.ok(s[C.throttle] > 0 || i === 0, 'a throttle above 0 outside a bump');
  });
  assert.equal(bumpSamples, W.bumpSamples, 'the samples with the wall code');
  assert.equal(bumps, W.bumps, 'the bumps');
  // After a bump the throttle climbs in tens up to the next bump.
  const seen = new Set();
  samples.forEach((s, i) => { if (i && samples[i - 1][C.collision] === V.collision.codes.wall && s[C.collision] === 0) seen.add(s[C.throttle]); });
  assert.ok([...seen].every(t => t % V.model.accelStep === 0 && t <= W.ladder.at(-1)), 'the first throttle after a bump is a multiple of 10 within the ladder');
  const climbs = samples.filter((s, i) => i && s[C.collision] === 0 && samples[i - 1][C.collision] === 0 && samples[i - 1][C.throttle] < W.ladder.at(-1) && s[C.throttle] > 0 && s[C.row] <= W.maxRow && samples[i - 1][C.row] >= W.restRow);
  for (const s of climbs) assert.ok(W.ladder.includes(s[C.throttle]), 'a throttle of the ladder after a bump');
}

export default {
  id: 'obs-wall',
  claims: ['car.wall-observed'],
  obs: ['wall-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('wall-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('wall-1'), V = values();
    const edit = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const bump = r.samples.findIndex(s => s[C.collision] === 1), plain = r.samples.findIndex((s, i) => i > bump && s[C.collision] === 0);
    const w = patch => ({ ...V, wall: { ...V.wall, ...patch } });
    return [
      { label: 'a bump with the throttle not cleared', fn: () => validate(dat, edit(bump, { [C.throttle]: V.wall.ladder[0] }), V) },
      { label: 'a bump 8 units too far back', fn: () => validate(dat, edit(bump, { [C.row]: V.wall.restRow - 8 }), V) }, // @math a different throw-back
      { label: 'a car inside the wall', fn: () => validate(dat, edit(plain, { [C.row]: V.wall.wallRow }), V) },
      { label: 'a turned heading', fn: () => validate(dat, edit(plain, { [C.heading]: V.wall.heading + V.move.wallTurn }), V) },
      { label: 'a collision word of 2', fn: () => validate(dat, edit(bump, { [C.collision]: V.collision.codes.object }), V) },
      { label: 'a throw-back of 16', fn: () => validate(dat, r, w({ thrownBack: V.wall.thrownBack / 2 })) }, // @math half the distance
      { label: 'a wall one row up', fn: () => validate(dat, { ...r, build: { ...r.build, rows: [r.build.rows[0] - 1, r.build.rows[1]] } }, V) },
      { label: 'one bump more', fn: () => validate(dat, r, w({ bumps: V.wall.bumps + 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
