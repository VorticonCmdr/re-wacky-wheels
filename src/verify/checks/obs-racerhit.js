import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ hit: expected('car.racer-hit-observed'), init: expected('racer.init'), model: expected('car.move-step') });
const IDS = ['steps-4', 'steps-5', 'steps-6', 'steps-7', 'steps-8'];
const TOOL = { collision: 0x28bae, position: 0x28b0a, racerBase: 0xaa90, racerStride: 0x68, flagBase: 0x848c, flagStride: 0x104 }; // @math the words the --extra columns of the steps scenario read

function validate(dat, records, grid, V, { limit = V.hit.limit } = {}) {
  const K = V.hit;
  assert.equal(records.length, K.records, 'the records');
  assert.deepEqual([K.collisionWord, K.positionWord, K.racerBase, K.racerStride, K.racerFlagBase, K.racerFlagStride], [TOOL.collision, TOOL.position, TOOL.racerBase, TOOL.racerStride, TOOL.flagBase, TOOL.flagStride], 'the words the tool read');
  assert.deepEqual([K.racerBase, K.racerStride], [V.init.base, V.init.racerBytes], 'the racer records of racer.init');
  assert.equal(K.positionWord, V.model.positionWords[0], 'the position word of car.move-step');
  assert.equal(K.turn, V.model.wallTurn, 'the turn of 0x12 as the wall turn of car.move-step');
  assert.equal(K.startHeading, grid.heading, 'the heading of the start grid frame');
  assert.equal(grid.camera.y, K.startY, 'the camera row of the start grid frame');
  const others = [2, 3, 4, 5, 6].map(k => grid.camera.racers[k]); // @math the racers 2 to 6, stationary on the grid
  let samples = 0, hits = 0, snapshots = 0, maxTick = 0; const distances = [], hitDistances = new Set(), missDistances = new Set(), finals = [];
  records.forEach((r, n) => {
    assertArchive(r, dat);
    assert.deepEqual(r.columns, K.columns, 'the columns the tool writes');
    const c = Object.fromEntries(r.columns.map((name, i) => [name, i])), first = r.samples[0];
    distances.push(Math.min(Math.abs(first[c.x] - first[c.r1x]) + Math.abs(first[c.y] - first[c.r1y]), Math.abs(first[c.x] - first[c.r7x]) + Math.abs(first[c.y] - first[c.r7y]))); // @math Manhattan distance to the nearest of the racers 1 and 7
    let finalHeading = first[c.angle], finalY = first[c.cameraY];
    for (const s of r.samples) {
      assert.ok(s[c.tick] <= K.lastTick, 'every sample is before the green light');
      maxTick = Math.max(maxTick, s[c.tick]);
      samples++;
      const near = [[s[c.r1x], s[c.r1y]], [s[c.r7x], s[c.r7y]], ...others].map(([x, y]) => Math.abs(s[c.x] - x) + Math.abs(s[c.y] - y)), d = Math.min(...near), hit = s[c.collisionWord] === K.code;
      assert.equal(hit, d < limit, `${r.id} tick ${s[c.tick]}: the collision word is ${K.code} exactly when a racer is closer than ${limit} (distance ${d})`);
      if (hit) { hits++; hitDistances.add(d); } else missDistances.add(d);
      if (s[c.collisionA] === 1) { snapshots++; assert.deepEqual([s[c.collisionWord], s[c.r1w2], s[c.angle]], [K.code, 1, K.startHeading], 'a snapshot between the detection and the turn'); } // @math the flag set, racer 1's word +2 set, the heading not yet turned
      assert.ok(s[c.accelerate] === 1 && !(hit && s[c.throttle] === 0), 'the throttle is not cleared by the hit'); // @math the accelerate word is set
      finalHeading = s[c.angle]; finalY = s[c.cameraY];
      assert.equal((s[c.angle] - K.startHeading) % K.turn, 0, 'the heading moves in steps of 0x12');
      assert.equal(s[c.cameraY] - K.startY, (s[c.angle] - K.startHeading) / K.turn * K.cameraMove, 'the position word y moves one unit per turn');
    }
    finals.push([finalHeading, finalY]);
    assert.ok(r.samples.every((s, i) => i === 0 || s[c.throttle] >= r.samples[i - 1][c.throttle]), 'the throttle never falls'); // @math the first sample has no predecessor
    assert.equal(r.samples[0][c.cameraX], K.cameraWrites[n], 'the position word written');
  });
  assert.deepEqual(distances, K.distances, 'the starting distances');
  assert.equal(samples, K.samples, 'the samples before the green light');
  assert.equal(maxTick, K.lastTick, 'the last tick seen');
  assert.equal(hits, K.hits, 'the samples with a hit');
  assert.equal(snapshots, K.snapshots, 'the snapshots between the detection and the turn');
  assert.deepEqual(finals.map(f => f[0]), K.finalHeadings, 'the final headings');
  assert.deepEqual(finals.map(f => f[1]), K.finalCameraY, 'the final position rows');
  assert.ok(Math.max(...hitDistances) < limit && Math.min(...missDistances) >= limit, 'the hit and miss distances are on either side of the limit');
  assert.equal(Math.max(...hitDistances), K.limit - 1, 'a hit is seen one unit below the limit'); // @math the largest hit distance is 13
  assert.ok(missDistances.has(K.limit), 'and a miss at the limit itself');
}

export default {
  id: 'obs-racerhit',
  claims: ['car.racer-hit-observed'],
  obs: [...IDS, 'grid-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), ctx.obs('grid-1').horizon, values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), grid = ctx.obs('grid-1').horizon, V = values(), K = V.hit, k = patch => ({ ...V, hit: { ...K, ...patch } });
    return [
      { label: 'a limit of 15 (within 14)', fn: () => validate(dat, records, grid, V, { limit: K.limit + 1 }) },
      { label: 'a limit of 13', fn: () => validate(dat, records, grid, V, { limit: K.limit - 1 }) },
      { label: 'a turn of 17', fn: () => validate(dat, records, grid, k({ turn: K.turn - 1 })) },
      { label: 'a hit count of 9', fn: () => validate(dat, records, grid, k({ hits: K.hits + 1 })) },
      { label: 'a collision word altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map((s, n) => (n === 2 ? s.map((x, j) => (j === r.columns.indexOf('collisionWord') ? 3 : x)) : s)) } : r)), grid, V) }, // @math the third sample of the record at distance 14
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, grid, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
