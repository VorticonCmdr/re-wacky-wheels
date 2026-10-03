import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { replaceSpwRecord } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ speedCap: expected('car.speed-model').throttleCap, mine: expected('item.mine-hit-observed'), shots: expected('item.shots-observed'), kinds: expected('atr.kind-effects'), collision: expected('car.collision-test'), spwRead: expected('spw.read') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e', 'carHeld', 'carAmmo', 'activeShots', 'shotFlag'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));
const TOOL = { words: [0x04, 0x08, 0x0a, 0x16, 0x18, 0x26, 0x58, 0x4c, 0x4e], firstRacer: 1 }; // @math the racer words tools/dosbox/strip-run.mjs --racers reads, for the racers 1 to 7
const X = 3, Y = 4; // @math the x and y words are the fourth and fifth of the racer word list
const dword = (w, at) => (w[at] & 0xffff) + (w[at + 1] & 0xffff) * 65536; // @math a dword from two words

function validate(dat, r, V, { sprite } = {}) {
  const M = V.mine, S = r.samples, R = r.racers, T = r.ticks.map(x => x[1]), L = r.lists, W = TOOL.words, at = name => W.indexOf(M[name]);
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual(r.racerWords, W, 'the racer words');
  assert.equal(S.length, M.samples, 'the samples');
  assert.deepEqual(r.build, { track: M.track, spw: { index: M.index, x: M.x, y: M.y, sprite: sprite ?? M.sprite } }, 'the experiment moved one object');
  const built = replaceSpwRecord(dat, { track: M.track, index: M.index, x: M.x, y: M.y, sprite: sprite ?? M.sprite });
  assert.equal(built.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(built).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  const kind = view(parseAtr(new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('SPRITE.ATR')).find(e => e.id === (sprite ?? M.sprite)).raw).getUint16(V.kinds.kindAt, true);
  assert.equal(kind, M.kind, 'the sprite is a kind-5 object');
  // the drop: 10 rows behind the car at the press
  assert.deepEqual(r.fireAt, [M.fireAt], 'the fire key');
  assert.equal(S[M.fireAt][C.row], M.carRowAtFire, 'the car\'s row at the press');
  assert.equal(M.carRowAtFire - M.behind, M.mineRow, 'the record is 10 rows behind');
  const mineFirst = S.findIndex(s => s[C.activeShots] > 0), shotEntry = L[mineFirst][0];
  assert.deepEqual([shotEntry[V.shots.recordWords.x], shotEntry[V.shots.recordWords.y], shotEntry[V.shots.recordWords.type]], [V.shots.mines.column, M.mineRow, V.shots.mines.types[0]], 'the bomb record at the mine row, type 2');
  assert.equal(M.mineRow - M.carRowAtFire + M.behind, 0, 'consistent'); // @math the drop distance again
  assert.equal(mineFirst, M.fireAt, 'it appears at the press');
  assert.ok(S.slice(0, M.releaseAt).every(s => s[C.throttle] <= V.speedCap) && S[M.releaseAt - 1][C.throttle] === V.speedCap && S[M.releaseAt][C.throttle] < V.speedCap, 'the throttle is at its cap until the release and below it from the next sample');
  assert.equal(S.at(-1)[C.throttle], 0, 'the throttle is 0 at the end'); // @math the throttle of a stopped car
  assert.equal(S.at(-1)[C.row], M.carStopRow, 'the car stopped');
  // the racer
  const n = M.racer - TOOL.firstRacer, hitWord = i => R[i][n][at('wordHit')];
  const hit = S.findIndex((s, i) => hitWord(i) !== 0);
  assert.equal(T[hit], M.hitTick, 'the tick of the hit');
  assert.equal(hitWord(hit), 1, 'the hit word is 1'); // @math the hit state
  assert.equal(dword(R[hit][n], at('wordStart')), M.hitTick, 'the start tick word');
  const px = R[hit][n][X], py = R[hit][n][Y];
  assert.deepEqual([px, py], M.standsAt, 'where the racer stands');
  assert.equal(Math.abs(px - V.shots.mines.column) + Math.abs(py - M.mineRow), M.distance, 'its distance from the record');
  assert.ok(M.distance < V.collision.touchDistance, 'below the touch distance');
  const stunned = S.map((s, i) => i).filter(i => hitWord(i) !== 0);
  assert.deepEqual([T[stunned[0]], T[stunned.at(-1)]], [M.hitTick, M.lastStunnedTick], 'the first and last samples with the hit word');
  assert.ok(stunned.every((i, k) => i === stunned[0] + k), 'the hit samples are consecutive');
  assert.ok(stunned.every(i => R[i][n][X] === px && R[i][n][Y] === py), 'the racer does not move while hit');
  const free = stunned.at(-1) + 1;
  assert.equal(T[free], M.freeTick, 'the tick the hit word is 0 again');
  assert.equal(M.freeTick - M.hitTick, M.stunTicks, 'the stun lasts 33 ticks');
  assert.ok(T[stunned.at(-1)] - M.hitTick < M.stunTicks, 'the last hit sample is before the 33rd tick');
  assert.deepEqual([R[free + 1][n][Y], T[free + 1]], [M.nextRow, M.nextTick], 'the racer goes on afterwards');
  assert.ok(stunned.every(i => R[i][n][at('wordState')] === M.state && R[i][n][at('wordSpeed')] === M.speed), 'its state and speed words are unchanged');
  // the record's life and the others
  const mineSamples = S.map((s, i) => i).filter(i => S[i][C.activeShots] > 0);
  assert.deepEqual([T[mineSamples.at(-1)], T[mineSamples.at(-1) + 1]], [M.mineLastTick, M.mineGoneTick], 'the record is last seen and then gone');
  for (let k = 0; k < R[0].length; k++) if (k !== n) assert.ok(S.every((s, i) => R[i][k][at('wordHit')] === 0), `racer ${k + TOOL.firstRacer} is not hit`);
}

export default {
  id: 'obs-minehit',
  claims: ['item.mine-hit-observed'],
  obs: ['mine-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('mine-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('mine-1'), V = values(), M = V.mine, m = patch => ({ ...V, mine: { ...M, ...patch } });
    const hitIdx = r.ticks.findIndex(x => x[1] === M.hitTick);
    const racersEdit = fn => ({ ...r, racers: r.racers.map((rs, i) => rs.map((rw, k) => fn(rw, i, k))) });
    return [
      { label: 'a stun of 32 ticks', fn: () => validate(dat, r, m({ stunTicks: M.stunTicks - 1 })) },
      { label: 'a hit one tick later', fn: () => validate(dat, r, m({ hitTick: M.hitTick + 1 })) },
      { label: 'the racer moving while hit', fn: () => validate(dat, racersEdit((rw, i, k) => (i === hitIdx + 3 && k === M.racer - TOOL.firstRacer ? rw.map((v, j) => (j === 4 ? v + 1 : v)) : rw)), V) }, // @math three samples after the hit; word 4 is the y word
      { label: 'another racer hit', fn: () => validate(dat, racersEdit((rw, i, k) => (i === hitIdx + 2 && k === 0 ? rw.map((v, j) => (j === 6 ? 1 : v)) : rw)), V) }, // @math word 6 is the hit word
      { label: 'a record that stays', fn: () => validate(dat, r, m({ mineGoneTick: M.mineGoneTick + 1 })) },
      { label: 'a racer 4', fn: () => validate(dat, r, m({ racer: M.racer - 1 })) },
      { label: 'a mine row of 2236', fn: () => validate(dat, r, m({ mineRow: M.mineRow - 1 })) },
      { label: 'a bomb of another sprite', fn: () => validate(dat, r, V, { sprite: 12 }) }, // @math the kind-4 sprite
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
