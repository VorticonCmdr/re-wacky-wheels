import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtr } from '../../formats/atr.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { replaceSpwRecords } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ hog: expected('item.hedgehog-observed'), shots: expected('item.shots-observed'), fire: expected('item.fire-observed'), kinds: expected('atr.kind-effects'), collision: expected('car.collision-test'), spwRead: expected('spw.read') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e', 'carHeld', 'carAmmo', 'activeShots', 'shotFlag'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));
const runsOf = (S, pred) => { const out = []; let start = null; S.forEach((s, i) => { if (pred(s)) { if (start === null) start = i; } else if (start !== null) { out.push([start, i - 1]); start = null; } }); if (start !== null) out.push([start, S.length - 1]); return out; };

function validate(dat, r, V, { sprites } = {}) {
  const H = V.hog, W = H.recordWords, S = r.samples, L = r.lists, bias = V.spwRead.coordBias;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual([W.type, W.x, W.y, W.step], [V.shots.recordWords.type, V.shots.recordWords.x, V.shots.recordWords.y, V.shots.recordWords.step], 'the record words of item.shots-observed');
  assert.equal(W.travel, V.fire.recordWords.travel, 'the travel word of item.fire-observed');
  assert.deepEqual([r.fireAt, r.hold], [H.fireAt, H.hold], 'the key presses');
  const [head, ...others] = H.records.map(([index, x, y, sprite]) => ({ index, x, y, sprite }));
  assert.deepEqual(r.build, { track: H.track, spw: head, also: others }, 'the experiment moved two objects');
  const built = replaceSpwRecords(dat, { track: H.track, records: H.records.map(([index, x, y, sprite]) => ({ index, x, y, sprite })) });
  assert.equal(built.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(built).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), atr = parseAtr(members.get('SPRITE.ATR'));
  const kind = id => view(atr.find(e => e.id === id).raw).getUint16(V.kinds.kindAt, true);
  assert.deepEqual((sprites ?? H.records.map(rec => rec[3])).map(kind), [2, 1], 'the sprites are a kind-2 and a kind-1 object'); // @math the kinds of the two sprites; the sprite is the last field of a record
  assert.equal(S.length, Number(r.samples.length));
  // the counter and the held word
  const ammo = []; let prev = 0; S.forEach((s, i) => { if (s[C.carAmmo] !== prev) { ammo.push([i, s[C.carAmmo]]); prev = s[C.carAmmo]; } }); // @math the counter starts at 0
  assert.deepEqual(ammo, H.ammoChanges, 'the counter');
  assert.ok(S.every(s => s[C.carHeld] === H.held && s[C.throttle] <= H.throttle), 'nothing held, the throttle within its cap');
  // the shots
  assert.deepEqual(runsOf(S, s => s[C.activeShots] > 0), H.shotRuns, 'the samples with a record');
  assert.deepEqual(runsOf(S, s => s[C.shotFlag] !== 0), H.flagRuns, 'the samples with the in-flight word');
  assert.ok(S.every(s => s[C.activeShots] <= 1), 'at most one record at a time');
  assert.ok(S.every(s => s[C.shotFlag] === 0 || s[C.shotFlag] === H.flagValue), 'the in-flight word is 0 or 1');
  S.forEach((s, i) => { if (s[C.activeShots]) { const e = L[i][0]; assert.equal(e[W.type], H.shotType, 'the type 0'); assert.equal(e[W.step], H.throttle, 'the word +0x16 is 100'); assert.equal(e[W.x], S[H.shotRuns[0][0]][C.column], 'the car\'s column'); } });
  const first = H.shotRuns[0], second = H.shotRuns[1];
  assert.deepEqual(L.slice(first[0], first[1] + 1).map(l => l[0][W.y]), [S[first[0]][C.row] + H.ahead, ...Array(first[1] - first[0]).fill(H.firstRows[1])], 'the first shot: 20 ahead of the car, then at the stop row'); // @math the later states all hold the stop row
  assert.equal(L[first[0]][0][W.y], H.firstRows[0], 'the first row');
  assert.equal(H.stackRow - H.touch, H.stopRow, 'the shot stops 13 before the tyre stack');
  assert.equal(H.stackRow, H.records[1][2] + bias, 'the tyre stack\'s row'); // @math the second record's y
  assert.equal(H.touch, Math.abs(H.stopRow - H.stackRow), 'the touch distance');
  assert.ok(H.touch < V.collision.touchDistance, 'below the touch distance');
  assert.deepEqual(S.map((s, i) => [s[C.collision], i]).filter(([c]) => c === V.collision.codes.object).map(([, i]) => i), H.collisionSamples, 'the samples with the object code');
  assert.deepEqual(L.slice(second[0], second[1] + 1).map(l => l[0][W.y]), H.secondRows, 'the second shot to the end of the road');
  assert.equal(L[second[1]][0][W.travel], H.endTravel, 'its travel at the end');
  assert.equal(Math.max(...H.secondRows), H.endRow);
  assert.equal(S[second[0]][C.row] + H.ahead, H.secondRows[0], 'it starts 20 ahead of the car');
  // the travel counter: 10, then 110 ... in steps of 100 per distinct state
  const travels = [...new Set(L.slice(second[0], second[1] + 1).map(l => l[0][W.travel]))];
  travels.slice(1).forEach((t, k) => assert.equal(t - travels[k], H.step, 'a step of 100'));
}

export default {
  id: 'obs-hedgehog',
  claims: ['item.hedgehog-observed'],
  obs: ['hedgehog-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('hedgehog-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('hedgehog-1'), V = values(), H = V.hog, h = patch => ({ ...V, hog: { ...H, ...patch } });
    const edit = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    return [
      { label: 'a counter that is not spent', fn: () => validate(dat, edit(H.fireAt[0], { [C.carAmmo]: H.ammoChanges[0][1] }), V) },
      { label: 'an item held', fn: () => validate(dat, edit(H.shotRuns[1][0] + 3, { [C.carHeld]: 3 }), V) }, // @math a held item three samples in
      { label: 'the stack 12 ahead', fn: () => validate(dat, r, h({ stackRow: H.stackRow + 1 })) },
      { label: 'a touch distance of 14', fn: () => validate(dat, r, h({ touch: H.touch + 1 })) },
      { label: 'a shot 21 ahead', fn: () => validate(dat, r, h({ ahead: H.ahead + 1 })) },
      { label: 'a step of 99', fn: () => validate(dat, r, h({ step: H.step - 1 })) },
      { label: 'the second shot to 3041', fn: () => validate(dat, r, h({ endRow: H.endRow + 1 })) },
      { label: 'the sprites swapped', fn: () => validate(dat, r, V, { sprites: [23, 1] }) }, // @math the two sprites swapped
      { label: 'a flag run one sample short', fn: () => validate(dat, r, h({ flagRuns: [H.flagRuns[0], [H.flagRuns[1][0], H.flagRuns[1][1] - 1]] })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
