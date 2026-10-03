import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSdx } from '../../formats/static-tables.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ sp: expected('car.speed-observed'), st: expected('input.steer-observed'), model: expected('car.speed-model'), trig: expected('trig.layout'), asl: expected('ai.surface-slowdown') });

const col = (r, name) => r.columns.indexOf(name);

// car.speed-observed: in a played race the car's throttle indexes the loaded copy of VEL.TAB, and its speed is that entry lowered by the surface's fraction (the SDX dword the
// car record holds) with the arithmetic of ai.surface-slowdown; the samples where the throttle is already 0 hold the speed of an earlier throttle.
function checkSpeed(dat, r, V) {
  const S = V.sp, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), vel = view(members.get('VEL.TAB')), sdx = parseSdx(members.get('WACKY.SDX')).records;
  assertArchive(r, dat);
  const c = Object.fromEntries(r.columns.map((n, i) => [n, i]));
  let exact = 0, stale = 0;
  const throttles = new Set(), fractions = new Set();
  for (const s of r.samples) {
    const throttle = s[c.throttle], entry = vel.getInt16(throttle * 2, true), fraction = s[c.fraction]; // @math 16-bit table entries
    assert.equal(s[c.demoWord], 0, 'a played race, not a demo');
    assert.equal(s[c.engineWord], S.engineChoice, 'the engine choice of the run copy');
    assert.equal(s[c.tableEntry], entry, 'the loaded table holds VEL.TAB');
    assert.equal(view(sdx[s[c.surface]]).getUint32(V.asl.sdxDwordAt, true), fraction, 'the car holds the SDX fraction of its surface');
    const expectedSpeed = entry - ((entry * fraction) >> V.asl.shift);
    if (s[c.speed] === expectedSpeed) exact++;
    else { assert.equal(throttle, 0, 'a speed that does not match belongs to a throttle already cleared'); stale++; }
    throttles.add(throttle); fractions.add(fraction);
  }
  assert.equal(r.samples.length, S.samples, 'the samples');
  assert.equal(exact, S.exact, 'the samples whose speed is the slowed entry of the throttle');
  assert.equal(stale, S.stale, 'the samples with a cleared throttle');
  assert.deepEqual([...fractions].sort((a, b) => a - b), S.fractions, 'the fractions seen');
  assert.ok(Math.max(...throttles) <= V.model.throttleCap, 'the throttle never passes its cap');
  assert.equal(Math.max(...throttles), V.model.throttleCap, 'and reaches it');
}

const norm = (d, turn) => ((d % turn) + turn + turn / 2) % turn - turn / 2; // @math wrap to half a turn either side

// input.steer-observed: with the left key alone the left byte and word are set (and not the right ones) and the heading falls; with the right key alone the right ones are set and it rises.
function checkSteer(r1, r2, V, dat) {
  const T = V.st;
  assert.equal(T.turn, V.trig.entries, 'a turn is the 1920 entries of the TRIG table');
  assertArchive(r1, dat); assertArchive(r2, dat);
  const c = Object.fromEntries(r1.columns.map((n, i) => [n, i]));
  let left = 0, right = 0, none = 0;
  for (const s of r1.samples) {
    const l = s[c.keyLeft], rt = s[c.keyRight];
    if (l && !rt) { left++; assert.deepEqual([s[c.leftByte], s[c.leftWord], s[c.rightByte], s[c.rightWord], s[c.rightAmount]], [1, 1, 0, 0, 0], 'left key alone'); assert.ok(T.amounts.includes(s[c.leftAmount]), 'a steering amount'); }
    else if (rt && !l) { right++; assert.deepEqual([s[c.rightByte], s[c.rightWord], s[c.leftByte], s[c.leftWord], s[c.leftAmount]], [1, 1, 0, 0, 0], 'right key alone'); assert.ok(T.amounts.includes(s[c.rightAmount]), 'a steering amount'); }
    else if (!l && !rt) { none++; assert.deepEqual([s[c.leftByte], s[c.rightByte], s[c.leftWord], s[c.rightWord]], [0, 0, 0, 0], 'no steering key'); }
  }
  assert.deepEqual([left, right, none], [T.leftSamples, T.rightSamples, T.noneSamples], 'the samples of each kind');
  assert.ok(left > 0 && right > 0);
  let falls = 0, rises = 0, runStart = 0;
  const d = Object.fromEntries(r2.columns.map((n, i) => [n, i]));
  for (let i = 1; i < r2.samples.length; i++) {
    const a = r2.samples[i - 1], b = r2.samples[i], delta = norm(b[d.angle] - a[d.angle], T.turn);
    if (a[d.keyLeft] !== b[d.keyLeft] || a[d.keyRight] !== b[d.keyRight]) runStart = i; // a new key state: the car keeps turning the old way for a few samples (its hop and slide states)
    if (i - runStart < T.settle) continue;
    if (b[d.keyLeft] && !b[d.keyRight]) { assert.ok(delta <= 0 && delta % T.step === 0, `left lowers the heading (${delta})`); if (delta < 0) falls++; }
    if (b[d.keyRight] && !b[d.keyLeft]) { assert.ok(delta >= 0 && delta % T.step === 0, `right raises the heading (${delta})`); if (delta > 0) rises++; }
  }
  assert.deepEqual([falls, rises], [T.falls, T.rises], 'the heading changes seen');
}

export default {
  id: 'obs-drive',
  claims: ['car.speed-observed', 'input.steer-observed'],
  obs: ['drive-1', 'drive-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r1 = ctx.obs('drive-1'), r2 = ctx.obs('drive-2');
    checkSpeed(dat, r1, V); checkSteer(r1, r2, V, dat);
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r1 = ctx.obs('drive-1'), r2 = ctx.obs('drive-2'), c = Object.fromEntries(r1.columns.map((n, i) => [n, i]));
    const edit = (r, i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const first = r1.samples.findIndex(s => s[c.fraction] > 0 && s[c.throttle] > 0), lefty = r1.samples.findIndex(s => s[c.keyLeft] && !s[c.keyRight]);
    return [
      { label: 'a speed one more', fn: () => checkSpeed(dat, edit(r1, first, { [c.speed]: r1.samples[first][c.speed] + 1 }), V) },
      { label: 'a fraction changed', fn: () => checkSpeed(dat, edit(r1, first, { [c.fraction]: 0 }), V) },
      { label: 'a table entry changed', fn: () => checkSpeed(dat, edit(r1, first, { [c.tableEntry]: r1.samples[first][c.tableEntry] + 1 }), V) },
      { label: 'a rounding-up slowdown', fn: () => checkSpeed(dat, r1, { ...V, asl: { ...V.asl, shift: V.asl.shift - 1 } }) }, // @math one bit less
      { label: 'a left byte missing', fn: () => checkSteer(edit(r1, lefty, { [c.leftByte]: 0 }), r2, V, dat) },
      { label: 'the right word set with the left key', fn: () => checkSteer(edit(r1, lefty, { [c.rightWord]: 1 }), r2, V, dat) },
      { label: 'a heading that rises under the left key', fn: () => {
        const D = Object.fromEntries(r2.columns.map((n, i) => [n, i]));
        let runStart = 0, at = -1;
        for (let i = 1; i < r2.samples.length && at < 0; i++) {
          const a = r2.samples[i - 1], b = r2.samples[i];
          if (a[D.keyLeft] !== b[D.keyLeft] || a[D.keyRight] !== b[D.keyRight]) runStart = i;
          if (i - runStart >= V.st.settle && b[D.keyLeft] && !b[D.keyRight] && b[D.angle] !== a[D.angle]) at = i;
        }
        return checkSteer(r1, edit(r2, at, { [D.angle]: r2.samples[at - 1][D.angle] + V.st.step * 6 }), V, dat); // @math one 120-step the other way
      } },
      { label: 'a turn of 3840', fn: () => checkSteer(r1, r2, { ...V, st: { ...V.st, turn: V.st.turn * 2 } }, dat) }, // @math twice a turn
    ];
  },
};
