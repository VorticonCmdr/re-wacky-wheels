import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assertArchive } from '../obs-helpers.js';
import { replaceSpwRecords } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ shots: expected('item.shots-observed'), fire: expected('item.fire-observed') });

const COLUMNS = ['throttle', 'speed', 'column', 'row', 'heading', 'collision', 'carWordA', 'carWord7c', 'terrain', 'state0x44', 'state0x5a', 'word0xc', 'word0xe', 'word0x10', 'word0x18', 'word0x1a', 'objectHit', 'objectX', 'objectY', 'carWord7e', 'carHeld', 'carAmmo', 'activeShots', 'shotFlag'];
const C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));

// The samples at which a column changes, as [sample, new value] pairs.
const changes = (S, col, from) => { const out = []; let prev = from; S.forEach((s, i) => { if (s[col] !== prev) { out.push([i, s[col]]); prev = s[col]; } }); return out; };

function validate(dat, r, V) {
  const P = V.shots, W = P.recordWords, S = r.samples, L = r.lists, D = P.devils, M = P.mines;
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  assert.equal(S.length, P.samples, 'the samples');
  assert.deepEqual(r.fireAt, P.fireAt, 'the fire key presses');
  const [head, ...others] = P.records.map(([index, x, y, sprite]) => ({ index, x, y, sprite }));
  assert.deepEqual(r.build, { track: P.track, spw: head, also: others }, 'the experiment moved four objects and nothing else');
  const built = replaceSpwRecords(dat, { track: P.track, records: P.records.map(([index, x, y, sprite]) => ({ index, x, y, sprite })) });
  assert.equal(built.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(built).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  assert.deepEqual(changes(S, C.carHeld, 0), P.heldChanges, 'the items taken and used up'); // @math the held word starts at 0
  assert.deepEqual(changes(S, C.activeShots, 0), P.activeChanges, 'the number of active records'); // @math the count starts at 0
  assert.ok(S.every(s => s[C.shotFlag] === 0), 'nothing in flight in the racer word');
  assert.equal(S.at(-1)[C.activeShots], P.activeChanges.at(-1)[1], 'and none is gone by the end');
  S.forEach((s, i) => assert.equal(L[i].length, s[C.activeShots], 'the list holds the active records'));
  P.fireAt.forEach((at, k) => assert.equal(S[at][C.carHeld], 0, `the item is used up by the press before sample ${at}`));
  // The devils: two records of the type 1, going sideways, turning at the sides of the road.
  const first = P.fireAt[0], devils = i => L[i].filter(e => e[W.type] === D.type).sort((a, b) => a[W.x] - b[W.x]);
  assert.deepEqual(devils(first).map(e => e[W.x]), D.columns, 'the columns at the first sample');
  assert.deepEqual(devils(first).map(e => e[W.y]), [D.row, D.row], 'at the row');
  assert.equal(S[first][C.row], D.row, 'which is the car\'s row');
  const track = slot => { const out = []; let at = null; for (let i = first; i < S.length; i++) { const e = L[i].filter(x => x[W.type] === D.type)[slot]; if (!at || at[0] !== e[W.x] || at[1] !== e[W.heading]) { out.push({ x: e[W.x], heading: e[W.heading], step: e[W.step] }); at = [e[W.x], e[W.heading]]; } } return out; };
  const west = track(0), east = track(1); // the records keep their slots: the first starts at the lower column and goes west (heading 960, -x), the second east (heading 0, +x)
  for (const [states, from, bound, direction] of [[east, D.headings[1], D.bounds[1], 1], [west, D.headings[0], D.bounds[0], -1]]) {
    assert.ok(states.every(s => s.step === D.step), 'the step word is 16');
    const turn = states.findIndex(s => s.heading !== from);
    assert.ok(turn > 0, 'the shot turns round');
    assert.equal(states[turn - 1].x, bound, 'at its side of the road');
    for (let i = 1; i < turn; i++) assert.equal(states[i].x - states[i - 1].x, direction * D.step, 'a step of 16 towards the side');
    assert.ok(states.slice(turn).every(s => s.heading !== from), 'and does not turn again within the run');
    assert.ok(Math.sign(states.at(-1).x - states[turn - 1].x) === -direction, 'and ends on the other side of the turning point');
  }
  assert.equal(Math.max(...[...east, ...west].map(s => s.x)), D.bounds[1], 'no shot beyond the east side');
  assert.equal(Math.min(...[...east, ...west].map(s => s.x)), D.bounds[0], 'or the west side');
  // The mines: one record each, dropped behind the car, never moving.
  M.types.forEach((type, k) => {
    const press = P.fireAt[k + 1], all = i => L[i].filter(e => e[W.type] === type);
    assert.equal(S[press][C.row], M.pressRows[k], 'the car\'s row at the press');
    assert.equal(M.pressRows[k] - M.behind, M.rows[k], 'the record is 10 rows behind it');
    for (let i = press; i < S.length; i++) {
      assert.equal(all(i).length, 1, 'one record of the type');
      const e = all(i)[0];
      assert.deepEqual([e[W.x], e[W.y], e[W.step], e[W.heading]], [M.column, M.rows[k], M.step, M.heading], 'it stays where it was dropped');
    }
    assert.equal(all(press - 1).length, 0, 'it is not there before the press');
  });
}

export default {
  id: 'obs-shots',
  claims: ['item.shots-observed'],
  obs: ['fire-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('fire-2'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('fire-2'), V = values(), P = V.shots, W = P.recordWords;
    const editList = (i, fn) => ({ ...r, lists: r.lists.map((l, k) => (k === i ? l.map(fn) : l)) });
    const p = patch => ({ ...V, shots: { ...P, ...patch } });
    const late = P.fireAt[3] + 5; // @math a sample after the last press
    return [
      { label: 'a mine that moved', fn: () => validate(dat, editList(late, e => (e[W.type] === P.mines.types[0] ? e.map((v, j) => (j === W.y ? v + 1 : v)) : e)), V) },
      { label: 'a devil with another step', fn: () => validate(dat, editList(late, e => (e[W.type] === P.devils.type ? e.map((v, j) => (j === W.step ? v + 1 : v)) : e)), V) },
      { label: 'a devil that does not turn at its side', fn: () => validate(dat, r, p({ devils: { ...P.devils, bounds: [P.devils.bounds[0] + 16, P.devils.bounds[1]] } })) }, // @math one step
      { label: 'a step of 15', fn: () => validate(dat, r, p({ devils: { ...P.devils, step: P.devils.step - 1 } })) },
      { label: 'mines 9 rows behind', fn: () => validate(dat, r, p({ mines: { ...P.mines, behind: P.mines.behind - 1 } })) },
      { label: 'mines of other types', fn: () => validate(dat, r, p({ mines: { ...P.mines, types: [3, 2, 4] } })) }, // @math the first two types swapped
      { label: 'a held change one sample late', fn: () => validate(dat, r, p({ heldChanges: P.heldChanges.map(([i, v], k) => (k === 2 ? [i + 1, v] : [i, v])) })) }, // @math one sample
      { label: 'one more active record', fn: () => validate(dat, r, p({ activeChanges: P.activeChanges.map(([i, v], k) => (k === 3 ? [i, v + 1] : [i, v])) })) }, // @math one record
      { label: 'devils of type 2', fn: () => validate(dat, r, p({ devils: { ...P.devils, type: 2 } })) }, // @math the bomb type
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
