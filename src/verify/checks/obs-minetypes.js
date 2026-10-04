import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ mine: expected('item.mine-types-observed'), hit: expected('item.racer-hit-observed'), old: expected('item.mine-hit-observed'), shots: expected('item.shots-observed') });
const IDS = ['mine-5', 'mine-6', 'mine-7'];
const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function validate(dat, records, V, { behind = V.mine.behind, stun = V.mine.stun } = {}) {
  const K = V.mine;
  assert.equal(records.length, K.records, 'the records');
  assert.equal(K.listAt, V.hit.listAt, 'the list of item.racer-hit-observed');
  assert.equal(K.stun, V.old.stunTicks, 'the stun of item.mine-hit-observed');
  assert.equal(K.collisionWord, V.hit.collisionWord, 'the collision word at a hit');
  assert.equal(K.rewardTick, V.hit.rewardTick, 'the tick of the held 8');
  assert.equal(K.carPos[1] - behind, K.dropPos[1], 'the record is 10 behind the car');
  assert.deepEqual([K.carPos[0], K.dropPos[0]], [K.racerPos[0], K.racerPos[0]], 'in line with the racer'); // @math the car and the drop point share the racer's column
  assert.ok(manhattan(K.dropPos, K.racerPos) < V.hit.hitDistance - 3, 'the drop point is closer to the racer than the collision limit 14'); // @math the limit of car.racer-hit-observed is 14 and the stop distance 17 is 3 more
  records.forEach((r, n) => {
    assertArchive(r, dat);
    const c = Object.fromEntries(r.columns.map((name, i) => [name, i])), S = r.samples;
    assert.equal(S.length, K.samples[n], 'the samples');
    assert.equal(S[0][c.held], K.items[n], 'the held item');
    assert.deepEqual([S[0][c.cameraX], S[0][c.cameraY]], K.cameraWrites, 'the position words written');
    assert.deepEqual([S[0][c.r1x], S[0][c.r1y]], K.racerPos, 'racer 1 on the grid');
    assert.ok(S.every(s => s[c.r1x] === K.racerPos[0] && s[c.r1y] === K.racerPos[1]), 'racer 1 never moves');
    const quiet = S.filter(s => s[c.tick] < K.dropTick);
    assert.ok(quiet.every(s => s[c.shots] === 0 && s[c.h1] === 0 && s[c.held] === K.items[n]), 'nothing happens before the green light');
    const drop = S.find(s => s[c.shots] > 0);
    assert.equal(drop[c.tick], K.dropTick, 'the drop');
    assert.deepEqual([drop[c.held], drop[c.shots], drop[c.sAx], drop[c.sAy], drop[c.sAtravel]], [0, 1, ...K.dropPos, 0], 'one record, 10 behind the car, not moving'); // @math nothing held, one record, travel 0
    assert.equal(manhattan([drop[c.sAx], drop[c.sAy]], K.racerPos), K.carPos[1] - K.racerPos[1] - behind, 'the drop point is 10 from the racer'); // @math the drop point lies on the racer's column
    assert.equal(drop[c.h1], K.hitWord, 'the racer is hit in the same call');
    assert.equal(drop[c.collisionWord], K.collisionWord, 'the collision word is 3 for that call');
    assert.ok(S.filter(s => s[c.tick] >= K.removeTick).every(s => s[c.shots] === 0), 'gone at tick 38');
    assert.equal(S.find(s => s[c.tick] === K.removeTick - 1)[c.shots], 1, 'still there at tick 37'); // @math the tick before
    for (let k = 2; k <= 7; k++) assert.ok(S.every(s => s[c['h' + k]] === 0), `racer ${k} is not hit`); // @math racers 2 to 7
    if (n > 0) { // the two long records
      const seq = []; let prev = 0; for (const s of S) if (s[c.h1] !== prev) { seq.push([s[c.tick], s[c.h1]]); prev = s[c.h1]; }
      assert.deepEqual(seq, [[K.dropTick, K.hitWord], [K.endTick, 0]], 'the hit word 1 for 33 ticks');
      assert.equal(K.endTick - K.dropTick, stun, 'the stun length');
      const reward = S.find(s => s[c.tick] > K.dropTick && s[c.held] !== 0);
      assert.deepEqual([reward[c.tick], reward[c.held]], [K.rewardTick, K.rewardItem], 'the held 8 at tick 55');
    }
  });
}

export default {
  id: 'obs-minetypes',
  claims: ['item.mine-types-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), K = V.mine;
    return [
      { label: 'a record 11 behind', fn: () => validate(dat, records, V, { behind: K.behind + 1 }) },
      { label: 'a stun of 34', fn: () => validate(dat, records, V, { stun: K.stun + 1 }) },
      { label: 'a hit word altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 35 ? s.map((x, k) => (k === r.columns.indexOf('h1') ? 2 : x)) : s)) } : r)), V) }, // @math the tick of the drop
      { label: 'a record moved', fn: () => validate(dat, records.map((r, i) => (i === 2 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 35 ? s.map((x, k) => (k === r.columns.indexOf('sAy') ? x + 1 : x)) : s)) } : r)), V) }, // @math the tick of the drop
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
