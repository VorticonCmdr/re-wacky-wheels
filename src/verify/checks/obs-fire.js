import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertArchive } from '../obs-helpers.js';
import { replaceSpwRecord } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ fire: expected('item.fire-observed'), kinds: expected('atr.kind-effects'), spwRead: expected('spw.read') });

const TOOL = { racerBase: 0xaa90, flightOffset: 0x12 }; // @math what tools/dosbox/strip-run.mjs reads: the first racer record (obj2+0xaa90) and its word +0x12
const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e', 'carHeld', 'carAmmo', 'activeShots', 'shotFlag'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));

function validate(dat, r, V, { fanSign = [0, 1, -1] } = {}) {
  const F = V.fire, W = F.recordWords, S = r.samples, L = r.lists;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.deepEqual(r.fireAt, F.fireAt, 'the fire key was pressed before these samples');
  assert.deepEqual(r.build, { track: F.track, spw: { index: F.index, x: F.x, y: F.y, sprite: F.sprite } }, 'the experiment moved one object and gave it a sprite');
  const built = replaceSpwRecord(dat, { track: F.track, index: F.index, x: F.x, y: F.y, sprite: F.sprite });
  assert.equal(built.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(built).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  assert.equal(F.flightWord, TOOL.racerBase + TOOL.flightOffset, 'the in-flight word the tool read');
  assert.equal(L.length, S.length, 'a list per sample');
  assert.ok(L.every(list => list.every(e => e[W.active] !== 0)), 'every listed record has its active word set');
  const [first, last] = F.shotSamples, [flagFrom, flagTo] = F.flagSamples, press = F.fireAt[0];
  assert.equal(first, press + 1, 'the shots appear in the sample after the press'); // @math the sample right after the press
  for (let i = 0; i < S.length; i++) {
    const s = S[i], inFlight = i >= first && i <= last;
    assert.equal(s[C.activeShots], inFlight ? F.shots : 0, `the active shots of sample ${i}`);
    assert.equal(L[i].length, s[C.activeShots], 'the list holds the active records');
    assert.equal(s[C.shotFlag], i >= flagFrom && i <= flagTo ? F.flagValue : 0, `the in-flight word of sample ${i}`);
    if (i >= first) assert.equal(s[C.carHeld], 0, 'the item is used up'); // @math the held word is 0 when nothing is held
    assert.ok(s[C.throttle] <= F.throttle, 'the throttle stays within its cap');
  }
  assert.ok(S.slice(0, press).some(s => s[C.carHeld] === F.held) && S.slice(0, press + 1).every((s, i) => i < 10 || s[C.carHeld] === F.held), 'the item is held from the pickup until the press'); // @math the pickup is at sample 10
  assert.equal(S.slice(0, first).filter(s => s[C.carHeld] === F.held).length, press + 1 - 10, 'for the samples 10 to the press'); // @math the pickup sample
  // The fan and its travel.
  let previous = null, states = 0, lingering = 0;
  for (let i = first; i <= last; i++) {
    const recs = [...L[i]].sort((a, b) => a[W.fan] - b[W.fan]);
    assert.deepEqual(recs.map(e => e[W.fan]), F.fanOffsets, 'the three shots of the fan');
    const col = S[first][C.column];
    for (const e of recs) {
      assert.equal(e[W.limit], F.limit, 'the distance limit');
      assert.equal(e[W.step], F.throttle, 'the word +0x16 is 100');
      assert.equal(e[W.y], recs[0][W.y], 'the three shots are at the same row');
      assert.equal(e[W.travel], recs[0][W.travel], 'and have gone the same distance');
    }
    const travel = recs[0][W.travel];
    if (travel <= F.finalTravel - F.step) { // before the end of the road
      assert.equal(recs[0][W.y] - F.rowBase, travel, 'the row is the base plus the distance travelled');
      assert.equal(recs[0][W.x], col, 'the centre shot keeps the column');
      recs.forEach((e, k) => assert.equal(e[W.x] - col, fanSign[k] * (F.startLateral + (travel - F.startTravel) / F.step * F.lateralPerStep), `the sideways offset of shot ${k}`));
    } else lingering++;
    if (!previous || previous.travel !== travel) { if (previous) assert.equal(travel - previous.travel, F.step, 'each new state is 100 farther'); states++; }
    previous = { travel };
  }
  assert.equal(previous.travel, F.finalTravel, 'the shots stop at the final distance');
  assert.equal(recs0(L[last])[W.y], F.finalRow, 'at the end of the road');
  assert.equal(lingering, F.lingerSamples, 'and stay that many samples before they are removed');
  // The second press, with nothing held and no counter, spawns nothing.
  assert.ok(S.slice(last + 1).every(s => s[C.activeShots] === 0 && s[C.carHeld] === 0 && s[C.carAmmo] === 0), 'nothing after the shots are gone, also after the second press');
  assert.ok(F.fireAt[1] > last, 'the second press comes after the shots are gone');
}
const recs0 = list => list[0];

export default {
  id: 'obs-fire',
  claims: ['item.fire-observed'],
  obs: ['fire-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('fire-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('fire-1'), V = values(), F = V.fire, W = F.recordWords;
    const editSample = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const editList = (i, fn) => ({ ...r, lists: r.lists.map((l, k) => (k === i ? l.map(fn) : l)) });
    const f = patch => ({ ...V, fire: { ...F, ...patch } });
    const mid = F.shotSamples[0] + 3; // @math a sample inside the flight
    return [
      { label: 'a fourth shot', fn: () => validate(dat, editSample(mid, { [C.activeShots]: F.shots + 1 }), V) },
      { label: 'the item not used up', fn: () => validate(dat, editSample(mid, { [C.carHeld]: F.held }), V) },
      { label: 'a flag of 2', fn: () => validate(dat, editSample(mid, { [C.shotFlag]: 2 }), V) }, // @math another flag value
      { label: 'a shot off its row', fn: () => validate(dat, editList(mid, e => e.map((v, j) => (j === W.y ? v + 1 : v))), V) },
      { label: 'a fan the other way', fn: () => validate(dat, r, V, { fanSign: [0, -1, 1] }) },
      { label: 'a fan of 5 per 100', fn: () => validate(dat, r, f({ lateralPerStep: F.lateralPerStep / 2 })) }, // @math half the spread
      { label: 'a step of 99', fn: () => validate(dat, r, f({ step: F.step - 1 })) },
      { label: 'a limit of 999', fn: () => validate(dat, r, f({ limit: F.limit - 1 })) },
      { label: 'a row base of 2096', fn: () => validate(dat, r, f({ rowBase: F.rowBase - 1 })) },
      { label: 'a longer linger', fn: () => validate(dat, r, f({ lingerSamples: F.lingerSamples + 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
