import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { expected } from '../expect.js';

const values = () => ({ trig: expected('trig.layout'), ndist: expected('ndist.layout') });
// Cross-check with the loader's claim: the byte sizes the game reads are these tables' sizes.

async function members(ctx) {
  const by = new Map(parseDatDirectory(await ctx.open('WACKY.DAT')).map(e => [e.name, e.data]));
  assert.ok(by.has('TRIG.DAT') && by.has('NDIST'), 'both tables are archive members');
  return by;
}

// TRIG.DAT: `entries` pairs of signed 32-bit values that are unit vectors in fixed point, going once around the circle.
function validateTrig(data, T) {
  assert.equal(data.length, T.entries * T.entryBytes, 'the file is exactly the entries');
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength), half = T.entryBytes / 2, one = 2 ** T.fixedBits; // @math one dword is half an entry; 1.0 in fixed point
  const pair = k => [dv.getInt32(k * T.entryBytes, true), dv.getInt32(k * T.entryBytes + half, true)];
  let turn = 0, worstNorm = 0, last = Math.atan2(...pair(0).reverse());
  for (let k = 0; k < T.entries; k++) {
    const [a, b] = pair(k);
    worstNorm = Math.max(worstNorm, Math.abs(Math.hypot(a, b) - one));
    const angle = Math.atan2(b, a);
    let step = angle - last; if (step < -Math.PI) step += 2 * Math.PI; // @math wrap an angle difference into (-pi, pi]
    if (k === T.duplicateAt) assert.ok(a === pair(k - 1)[0] && b === pair(k - 1)[1], `entry ${k} repeats the one before`);
    else if (k > 0) { const entries = step * T.entries / (2 * Math.PI); assert.ok(entries >= T.minStep && entries <= T.maxStep, `entry ${k} turns on from the one before by ${entries.toFixed(3)} entries`); } // @math one circle is two pi
    turn += k === 0 ? 0 : step; last = angle;
  }
  assert.equal(Math.ceil(worstNorm * 100) / 100, T.normError, 'the worst length error, to two decimals'); // @math hundredths
  const quarter = T.entries / 4, miss = (k, ex, ey) => { const [a, b] = pair(k % T.entries); return Math.max(Math.abs(a - ex * one), Math.abs(b - ey * one)); }; // @math a quarter turn; the circle has four quarters
  const worstAxis = Math.max(miss(0, 1, 0), miss(quarter, 0, 1), miss(2 * quarter, -1, 0), miss(3 * quarter, 0, -1)); // @math the half and three-quarter marks
  assert.equal(worstAxis, T.axisError, 'the worst miss of the four axis points');
  assert.ok(Math.abs(turn + (2 * Math.PI) / T.entries - 2 * Math.PI) < 0.01, 'the entries go once around the circle'); // @math one step closes the loop
}

// NDIST: `groups` runs of `groupLength` positive dwords, each run non-decreasing, and every boundary between runs is a drop.
function validateNdist(data, N) {
  assert.equal(data.length, N.groups * N.groupLength * N.dwordBytes, 'the file is exactly the groups');
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength), at = i => dv.getInt32(i * N.dwordBytes, true), total = N.groups * N.groupLength;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < total; i++) {
    const v = at(i); min = Math.min(min, v); max = Math.max(max, v);
    if (i === 0) continue;
    if (i % N.groupLength === 0) assert.ok(v < at(i - 1), `the boundary before dword ${i} is a drop`);
    else assert.ok(v >= at(i - 1), `dword ${i} does not decrease within its run`);
  }
  assert.equal(min, N.min); assert.equal(max, N.max);
  assert.ok(min > 0, 'all factors are positive');
}

export default {
  id: 'trig-ndist',
  claims: ['trig.layout', 'ndist.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const by = await members(ctx), V = values(), loaded = expected('static.read');
    validateTrig(by.get('TRIG.DAT'), V.trig); validateNdist(by.get('NDIST'), V.ndist);
    assert.equal(loaded.trig.bytes, V.trig.entries * V.trig.entryBytes, 'the loader reads the whole TRIG.DAT');
    assert.equal(loaded.ndist.bytes, V.ndist.groups * V.ndist.groupLength * V.ndist.dwordBytes, 'the loader reads the whole NDIST');
  },
  async discriminate(ctx) {
    const by = await members(ctx), V = values(), t = patch => () => validateTrig(by.get('TRIG.DAT'), { ...V.trig, ...patch }), n = patch => () => validateNdist(by.get('NDIST'), { ...V.ndist, ...patch });
    return [
      { label: '1919 trig entries', fn: t({ entries: V.trig.entries - 1 }) },
      { label: '4-byte trig entries', fn: t({ entryBytes: V.trig.entryBytes / 2 }) }, // @math half the entry
      { label: '15-bit fixed point', fn: t({ fixedBits: V.trig.fixedBits - 1 }) },
      { label: '17-bit fixed point', fn: t({ fixedBits: V.trig.fixedBits + 1 }) },
      { label: 'length error 1.33', fn: t({ normError: V.trig.normError - 0.01 }) }, // @math one hundredth less
      { label: 'length error 1.35', fn: t({ normError: V.trig.normError + 0.01 }) }, // @math one hundredth more
      { label: 'no repeated entry at 1351', fn: t({ duplicateAt: V.trig.duplicateAt + 1 }) },
      { label: 'steps of at least 0.996 entries', fn: t({ minStep: V.trig.minStep + 0.001 }) }, // @math just above the smallest step in the table
      { label: 'steps of at most 1.006 entries', fn: t({ maxStep: V.trig.maxStep - 0.001 }) }, // @math just below the largest step in the table
      { label: 'axis miss 151', fn: t({ axisError: V.trig.axisError - 1 }) },
      { label: 'axis miss 153', fn: t({ axisError: V.trig.axisError + 1 }) },
      { label: 'runs of 69', fn: n({ groupLength: V.ndist.groupLength - 1 }) },
      { label: 'runs of 71', fn: n({ groupLength: V.ndist.groupLength + 1 }) },
      { label: '321 groups', fn: n({ groups: V.ndist.groups + 1 }) },
      { label: 'minimum 116', fn: n({ min: V.ndist.min + 1 }) },
      { label: 'maximum 1121', fn: n({ max: V.ndist.max - 1 }) },
    ];
  },
};
