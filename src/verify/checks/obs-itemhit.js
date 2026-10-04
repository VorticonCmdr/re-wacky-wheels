import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ hit: expected('item.racer-hit-observed'), fire: expected('item.fire-observed'), mine: expected('item.mine-hit-observed'), steps: expected('ai.step-helpers'), init: expected('racer.init') });
const IDS = ['shot-1', 'shot-2', 'shot-3'];
const TOOL = { listAt: 0x1f2b0, recordBytes: 0x22, activeWord: 4, racerBase: 0xaa90, racerStride: 0x68, hitWord: 0x58 }; // @math what the --extra2 columns of the steps scenario read

const manhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function validate(dat, records, V, { distance = V.hit.hitDistance, stun = V.hit.stun } = {}) {
  const K = V.hit;
  assert.equal(records.length, K.records, 'the records');
  assert.deepEqual([K.listAt, K.recordBytes, K.activeWord, K.racerBase, K.racerStride, K.hitWordOffset], [TOOL.listAt, TOOL.recordBytes, TOOL.activeWord, TOOL.racerBase, TOOL.racerStride, TOOL.hitWord], 'what the tool read');
  assert.equal(K.recordBytes, V.fire.recordWords ? K.recordBytes : K.recordBytes, 'the record size');
  assert.deepEqual([K.racerBase, K.racerStride], [V.init.base, V.init.racerBytes], 'the racer records of racer.init');
  assert.deepEqual(K.limits, V.steps.hitLimits.slice(0, K.limits.length), 'the 0x21 and 0x32 limits of ai.step-helpers');
  assert.equal(K.stun[0], K.limits[0], 'the stun of word 1 is the limit 0x21 = 33'); // @math a limit of 33
  assert.equal(K.stun[1], K.limits[1], 'the stun of word 2 is the limit 0x32 = 50'); // @math a limit of 50
  assert.equal(V.mine.stunTicks, K.stun[0], 'the same 33 ticks as the mine of item.mine-hit-observed');
  records.forEach((r, n) => {
    assertArchive(r, dat);
    const c = Object.fromEntries(r.columns.map((name, i) => [name, i])), S = r.samples, racer = [S[0][c.r1x], S[0][c.r1y]];
    assert.deepEqual(racer, K.racerPos, 'racer 1 stands on the grid');
    assert.deepEqual([S[0][c.cameraX], S[0][c.cameraY]], K.cameraWrites, 'the position words written');
    assert.equal(S[0][c.held], K.items[n], 'the held item at the start');
    const quiet = S.find(s => s[c.tick] === K.quietUntil);
    assert.deepEqual([quiet[c.x], quiet[c.y]], K.carPos, 'the car stands where the written position words put it (the car words follow the camera words one update later)');
    assert.ok(S.every(s => s[c.r1x] === racer[0] && s[c.r1y] === racer[1]), 'racer 1 never moves');
    const firstWith = pred => S.find(pred), at = t => S.filter(s => s[c.tick] === t);
    const spawn = firstWith(s => s[c.shots] > 0);
    assert.equal(spawn[c.tick], K.spawnTick, 'the shots appear at the first call after the green light');
    assert.ok(S.filter(s => s[c.tick] <= K.quietUntil).every(s => s[c.held] === K.items[n] && s[c.shots] === 0), 'fire does nothing in the countdown');
    assert.equal(spawn[c.held], 0, 'the item is used up'); // @math nothing held
    assert.equal(spawn[c.shots], K.spawnShots[n], 'the shots made');
    assert.deepEqual([spawn[c.sAx], spawn[c.sAy]], [K.spawnX[0], K.spawnY], 'the first shot 20 ahead of the car');
    if (K.spawnShots[n] === 3) assert.deepEqual([spawn[c.sBx], spawn[c.sCx]], [K.spawnX[1], K.spawnX[2]], 'the fan'); // @math the three shots of item 3
    const hit = firstWith(s => s[c.h1] !== 0);
    assert.equal(hit[c.tick], K.hitTick, 'the hit comes one tick later');
    assert.equal(hit[c.h1], K.hitWords[n], 'the hit word');
    assert.equal(hit[c.collisionWord], K.collisionWord, 'the collision word is 3 at the hit');
    const shotsAtHit = [[hit[c.sAx], hit[c.sAy]], [hit[c.sBx], hit[c.sBy]], [hit[c.sCx], hit[c.sCy]]].slice(0, K.spawnShots[n]);
    shotsAtHit.forEach((p, k) => { assert.deepEqual(p, K.hitShots[k], `shot ${k} stopped`); assert.equal(manhattan(p, racer), distance, `shot ${k} stopped 17 from the racer`); });
    for (let k = 2; k <= 7; k++) assert.ok(S.every(s => s[c['h' + k]] === 0), `racer ${k} is not hit`); // @math racers 2 to 7
    assert.ok(S.filter(s => s[c.tick] >= K.removeTick).every(s => s[c.shots] === 0) && S.find(s => s[c.tick] === K.removeTick - 1)[c.shots] === K.spawnShots[n], 'the shots are gone at tick 39 and still there at 38'); // @math the tick before
    const reward = firstWith(s => s[c.tick] > K.spawnTick && s[c.held] !== 0);
    assert.deepEqual([reward[c.tick], reward[c.held]], [K.rewardTick, K.rewardItem], 'the item 8 comes 20 ticks after the shot');
    // The hit word over time: the ticks at which it takes a new value.
    const seq = []; let prev = 0; for (const s of S) if (s[c.h1] !== prev) { seq.push([s[c.tick], s[c.h1]]); prev = s[c.h1]; }
    if (n === 0) assert.deepEqual(seq, [[K.hitTick, 1], [K.endTicks[0], 0]], 'item 3: the word 1 for 33 ticks');
    if (n === 1) assert.deepEqual(seq, K.toggles, 'item 8: the word switches 2 and 3 and ends at 86');
    if (n === 2) assert.deepEqual(seq, [[K.hitTick, 1]], 'the counter shot: the word 1, the end not seen'); // @math the third record
    if (n === 0) assert.equal(K.endTicks[0] - K.hitTick, stun[0], 'the stun length');
    if (n === 1) assert.equal(K.endTicks[1] - K.hitTick, stun[1], 'the stun length');
    assert.equal(K.spawnTick - K.quietUntil, 1, 'the spawn is the first tick after the quiet ones'); // @math one tick
    assert.ok(at(K.spawnTick - 1).length > 0, 'a sample before the spawn');
  });
}

// probe-1: nothing held, no counter, Ctrl pressed at tick 33: nothing is fired, and the held word still becomes 8 at the same tick.
function probe(r, V, { rewardTick = V.hit.rewardTick } = {}) {
  const K = V.hit, c = Object.fromEntries(r.columns.map((name, i) => [name, i])), S = r.samples;
  assert.equal(S[0][c.held], 0, 'nothing held'); // @math nothing held
  assert.ok(S.every(s => s[c.shots] === 0), 'nothing was fired');
  const press = S.find(s => s[0] === 1); // @math the second phase presses Ctrl
  assert.equal(press[c.tick], K.probeTicks[0], 'Ctrl pressed at tick 33');
  const first = S.find(s => s[c.held] !== 0);
  assert.deepEqual([first[c.tick], first[c.held]], [rewardTick, K.rewardItem], 'the held word becomes 8 at tick 55 although nothing was fired');
  assert.equal(K.probeTicks[1], K.rewardTick, 'the same tick as after a shot');
}

export default {
  id: 'obs-itemhit',
  claims: ['item.racer-hit-observed'],
  obs: [...IDS, 'probe-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { const V = values(); validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), V); probe(ctx.obs('probe-1'), V); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), K = V.hit;
    return [
      { label: 'a stop distance of 16', fn: () => validate(dat, records, V, { distance: K.hitDistance - 1 }) },
      { label: 'a stun of 32', fn: () => validate(dat, records, V, { stun: [K.stun[0] - 1, K.stun[1]] }) },
      { label: 'a stun of 49', fn: () => validate(dat, records, V, { stun: [K.stun[0], K.stun[1] - 1] }) },
      { label: 'a hit word altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 36 ? s.map((x, k) => (k === r.columns.indexOf('h1') ? 1 : x)) : s)) } : r)), V) }, // @math the tick of the hit
      { label: 'a shot moved', fn: () => validate(dat, records.map((r, i) => (i === 0 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 36 ? s.map((x, k) => (k === r.columns.indexOf('sAy') ? x + 1 : x)) : s)) } : r)), V) }, // @math the tick of the hit
      { label: 'a reward at tick 54', fn: () => probe(ctx.obs('probe-1'), V, { rewardTick: K.rewardTick - 1 }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
