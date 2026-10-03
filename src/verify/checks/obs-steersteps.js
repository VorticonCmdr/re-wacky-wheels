import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ st: expected('car.steer-step-observed'), model: expected('car.move-step'), trig: expected('trig.layout'), steer: expected('input.steer-observed') });
const TOOL = { right: 0x28b90, left: 0x28b92, angle: 0x1d5d4 }; // @math the words the steps scenario of observe.mjs reads in the columns rightAmount, leftAmount and angle

function validate(dat, r, V, { step = V.st.step, spin = V.st.spinStep, turn = V.st.turn, wallTurn = V.st.wallTurn } = {}) {
  const K = V.st, c = Object.fromEntries(r.columns.map((n, i) => [n, i])), mod = d => ((d % turn) + turn) % turn;
  assertArchive(r, dat);
  assert.equal(r.samples.length, K.samples, 'the samples');
  assert.deepEqual([K.amountWords.right, K.amountWords.left, K.angleWord], [TOOL.right, TOOL.left, TOOL.angle], 'the words the tool read');
  assert.deepEqual([K.amountWords.right, K.amountWords.left, K.angleWord], [V.model.steerRightAt, V.model.steerLeftAt, V.model.headingAt], 'the words of car.move-step');
  assert.equal(K.turn, V.trig.entries, 'a turn is the 1920 TRIG entries');
  assert.equal(K.turn, V.model.turn, 'the turn of car.move-step');
  assert.equal(K.wallTurn, V.model.wallTurn, 'the wall turn of car.move-step');
  const cnt = { pairs: 0, left: 0, right: 0, spin: 0, none: 0, wallProbe: 0, crash: 0 }; let maxSpeed = 0;
  for (let i = 1; i < r.samples.length; i++) {
    const a = r.samples[i - 1], b = r.samples[i];
    if (b[c.tick] - a[c.tick] !== 1) continue; // @math exactly one tick apart
    if (a[c.collisionA] || a[c.collisionB] || b[c.collisionA] || b[c.collisionB]) continue;
    if (a[c.accelerate] !== b[c.accelerate] || a[c.brake] !== b[c.brake]) continue;
    cnt.pairs++; maxSpeed = Math.max(maxSpeed, b[c.speed]);
    const delta = mod(b[c.angle] - a[c.angle]), want = mod(b[c.rightAmount] - b[c.leftAmount]);
    if (delta === want) {
      if (b[c.leftAmount] === step && b[c.rightAmount] === 0) cnt.left++;
      else if (b[c.rightAmount] === step && b[c.leftAmount] === 0) cnt.right++;
      else if (b[c.leftAmount] === spin && b[c.rightAmount] === 0) cnt.spin++;
      else { assert.deepEqual([b[c.rightAmount], b[c.leftAmount]], [0, 0], 'no other amounts'); cnt.none++; } // @math both amounts clear
    } else if (mod(delta - want) === wallTurn) cnt.wallProbe++;
    else { assert.equal(delta, 0, 'the other pair leaves the heading alone'); assert.ok(b[c.throttle] === 0 && a[c.throttle] > 0, 'its throttle was cleared'); cnt.crash++; } // @math a heading unchanged and a throttle cleared
  }
  assert.deepEqual(cnt, { pairs: K.pairs, left: K.left, right: K.right, spin: K.spin, none: K.none, wallProbe: K.wallProbe, crash: K.crash }, 'the pairs of each kind');
  assert.equal(K.left + K.right + K.spin + K.none + K.wallProbe + K.crash, K.pairs, 'all pairs are classified');
  assert.equal(maxSpeed, K.maxSpeedSeen, 'the largest speed seen in a pair');
  assert.ok(V.steer.amounts.includes(step), 'the amount 40 is one of input.steer-observed\'s');
}

export default {
  id: 'obs-steersteps',
  claims: ['car.steer-step-observed'],
  obs: ['steps-3'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('steps-3'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('steps-3'), V = values(), K = V.st;
    return [
      { label: 'a step of 41', fn: () => validate(dat, r, V, { step: K.step + 1 }) },
      { label: 'a spin step of 119', fn: () => validate(dat, r, V, { spin: K.spinStep - 1 }) },
      { label: 'a turn of 1919', fn: () => validate(dat, r, V, { turn: K.turn - 1 }) },
      { label: 'a wall turn of 19', fn: () => validate(dat, r, V, { wallTurn: K.wallTurn + 1 }) },
      { label: 'an angle altered', fn: () => validate(dat, { ...r, samples: r.samples.map((s, i) => (i === 12 ? s.map((x, k) => (k === r.columns.indexOf('angle') ? x + 1 : x)) : s)) }, V) }, // @math the thirteenth sample
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
