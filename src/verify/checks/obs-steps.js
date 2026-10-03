import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ st: expected('car.step-observed'), model: expected('car.speed-model'), move: expected('car.move-step'), trig: expected('trig.layout') });
const IDS = ['steps-1', 'steps-2'];

function validate(dat, records, V, { accel = V.st.accelStep, coast = V.st.coastStep, brake = V.st.brakeTotal, cap = V.st.cap, rounding = V.st.rounding, useOldSpeed = false } = {}) {
  const K = V.st, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), vel = view(members.get('VEL.TAB')), trig = view(members.get('TRIG.DAT'));
  assert.equal(records.length, K.records, 'the records');
  assert.deepEqual([K.accelStep, K.coastStep, K.cap], [V.model.accelStep, V.model.coastStep, V.model.throttleCap], 'the steps of car.speed-model');
  assert.equal(K.brakeTotal, V.model.coastStep + V.model.brakeStep, 'the brake takes the coasting 4 and its own 8'); // @math both steps together
  assert.equal(K.rounding, V.move.rounding, 'the rounding of car.move-step');
  assert.equal(V.trig.entryBytes, 8, 'two dwords an entry'); // @math the TRIG entry size in bytes
  const cnt = { accelerate: 0, accelerateAtCap: 0, coast: 0, coastClamped: 0, brake: 0, brakeClamped: 0, moves: 0, movesMoving: 0 }, headings = new Set();
  for (const r of records) {
    assertArchive(r, dat);
    assert.deepEqual(r.columns, K.columns, 'the columns the tool writes');
    const c = Object.fromEntries(r.columns.map((n, i) => [n, i]));
    for (let i = 1; i < r.samples.length; i++) {
      const a = r.samples[i - 1], b = r.samples[i];
      if (b[c.tick] - a[c.tick] !== 1) continue; // @math exactly one tick apart
      if (a[c.terrain] !== 0 || b[c.terrain] !== 0 || a[c.collisionA] || a[c.collisionB] || b[c.collisionA] || b[c.collisionB]) continue;
      if (a[c.accelerate] !== b[c.accelerate] || a[c.brake] !== b[c.brake] || a[c.angle] !== b[c.angle]) continue;
      const acc = b[c.accelerate] !== 0, brk = b[c.brake] !== 0;
      let want, kind;
      if (acc && !brk) { want = Math.min(a[c.throttle] + accel, cap); kind = 'accelerate'; if (a[c.throttle] === cap) cnt.accelerateAtCap++; }
      else if (!acc && !brk) { want = Math.max(a[c.throttle] - coast, 0); kind = 'coast'; if (a[c.throttle] < coast) cnt.coastClamped++; }
      else if (brk && !acc) { want = Math.max(a[c.throttle] - brake, 0); kind = 'brake'; if (a[c.throttle] < brake) cnt.brakeClamped++; }
      else continue;
      cnt[kind]++;
      assert.equal(b[c.throttle], want, `${r.id} sample ${i}: the throttle after a ${kind} call`);
      if (b[c.throttle] !== 0) assert.equal(b[c.speed], vel.getInt16(b[c.throttle] * 2, true), `${r.id} sample ${i}: the speed is the table entry`); // @math 16-bit table entries
      const angle = b[c.angle], speed = useOldSpeed ? a[c.speed] : b[c.speed], vx = trig.getInt32(angle * V.trig.entryBytes, true), vy = trig.getInt32(angle * V.trig.entryBytes + 4, true); // @math the y dword follows the x dword
      const dx = Number((BigInt(vx) * BigInt(speed) + BigInt(rounding)) >> 16n), dy = Number((BigInt(vy) * BigInt(speed) + BigInt(rounding)) >> 16n); // @math 16.16 fixed point
      assert.deepEqual([b[c.x] - a[c.x], b[c.y] - a[c.y]], [dx, dy], `${r.id} sample ${i}: one step of the new speed along the heading`);
      cnt.moves++; if (speed > 0) cnt.movesMoving++; headings.add(angle);
    }
  }
  assert.deepEqual(cnt, { accelerate: K.accelerate, accelerateAtCap: K.accelerateAtCap, coast: K.coast, coastClamped: K.coastClamped, brake: K.brake, brakeClamped: K.brakeClamped, moves: K.moves, movesMoving: K.movesMoving }, 'the pairs of each kind');
  assert.deepEqual([...headings].sort((x, y) => x - y), K.headings, 'the headings');
}

export default {
  id: 'obs-steps',
  claims: ['car.step-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), K = V.st;
    return [
      { label: 'accelerate by 11', fn: () => validate(dat, records, V, { accel: K.accelStep + 1 }) },
      { label: 'coast by 5', fn: () => validate(dat, records, V, { coast: K.coastStep + 1 }) },
      { label: 'brake by 8', fn: () => validate(dat, records, V, { brake: V.model.brakeStep }) },
      { label: 'a cap of 99', fn: () => validate(dat, records, V, { cap: K.cap - 1 }) },
      { label: 'rounding down', fn: () => validate(dat, records, V, { rounding: 0 }) },
      { label: 'the old speed for the step', fn: () => validate(dat, records, V, { useOldSpeed: true }) },
      { label: 'a sample altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map((s, n) => (n === 5 ? s.map((x, k) => (k === r.columns.indexOf('y') ? x + 1 : x)) : s)) } : r)), V) }, // @math the sixth sample of the second record
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
