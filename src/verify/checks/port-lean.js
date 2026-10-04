import assert from 'node:assert/strict';
import { stepLean } from '../../game/car.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ L: expected('car.lean-observed') });
const FIRST_TICK = 36; // @math the countdown is over: the samples before it show the start frames
const PLAIN = [0, 5]; // @math the state words of the lean (0 at rest, 5 while moving) as car.lean-observed names them; the other values are other effects

// Replay the port's lean step over every usable pair of pauses one frame apart.
function replay(samples, V, { step = V.L.step, keysOfEarlier = false } = {}) {
  let pairs = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], k = keysOfEarlier ? a : b;
    if (b.tick - a.tick !== V.L.tickGap || a.tick < FIRST_TICK || !PLAIN.includes(a.state) || !PLAIN.includes(b.state)) continue;
    const input = { left: k.leftAmount > 0, right: k.rightAmount > 0 };
    const got = stepLean(a.frameWord, input);
    assert.equal(step, V.L.step, 'the step');
    assert.deepEqual([got.lean, got.state], [b.frameWord, b.state], `tick ${b.tick}: lean ${a.frameWord} with ${JSON.stringify(input)}`);
    pairs++;
  }
  return pairs;
}

export default {
  id: 'port-lean',
  claims: ['car.lean-observed'],
  obs: ['carsteer-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const r = ctx.obs('carsteer-1'); assertArchive(r, await ctx.open('WACKY.DAT'));
    const pairs = replay(r.samples, values());
    assert.ok(pairs >= 300, `enough pairs (${pairs})`); // @math 334 pairs were observed
  },
  async discriminate(ctx) {
    const V = values(), s = ctx.obs('carsteer-1').samples;
    return [
      { label: 'the keys of the earlier pause', fn: () => replay(s, V, { keysOfEarlier: true }) },
      { label: 'a step of two', fn: () => assert.deepEqual(stepLean(0, { right: true }), { lean: V.L.step + 1, state: V.L.movingState }) }, // @math one more than the step
      { label: 'the lean toward the other side', fn: () => replay(s.map(x => ({ ...x, leftAmount: x.rightAmount, rightAmount: x.leftAmount })), V) },
    ];
  },
};
