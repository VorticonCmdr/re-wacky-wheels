import assert from 'node:assert/strict';
import { stepLean } from '../../game/car.js';
import { createControl, controlStep, animate } from '../../game/control.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ L: expected('car.lean-observed') });
const FIRST_TICK = 36; // @math the countdown is over: the samples before it show the start frames
const PLAIN = [0, 5]; // @math the state words of the lean (0 at rest, 5 while moving) as car.lean-observed names them; the other values are other effects

// The same pairs through the port's control routine and animation states (car.control-rules): the key words set the target row and the state 5, and the state machine walks the row.
// The car is rebuilt from the earlier pause: its row and state, and the target the pause's pair implies when the state is 5 (the next call recomputes it from the keys).
const DETAIL = 2; // @math the race of carsteer-1 ran at medium detail (the steering amounts of its samples are 36)
const IDLE_WORLD = { speeds: Array.from({ length: 200 }, () => 0), sdx: { records: [new Uint8Array(302)] }, name: '1' }; // @math the speed table's size (400 bytes of 16-bit entries, small.read) and the SDX record's size (terrain.sdx-index)
function replayMachine(samples, V, { keysOfEarlier = false } = {}) {
  let pairs = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], k = keysOfEarlier ? a : b;
    if (b.tick - a.tick !== V.L.tickGap || a.tick < FIRST_TICK || !PLAIN.includes(a.state) || !PLAIN.includes(b.state)) continue;
    const car = { ...createControl(), surface: 0, throttle: 0, crashed: false, row: a.frameWord, anim: a.state, target: V.L.straight };
    const keys = { accelerate: false, brake: false, left: k.leftAmount > 0, right: k.rightAmount > 0, spin: false, fire: false };
    const env = { world: IDLE_WORLD, tick: b.tick, detail: DETAIL, racing: true, finished: false, stunned: false, slot: 0 }; // @math the slot does not matter here: no pose runs
    const got = animate(controlStep(car, keys, env).car, env);
    assert.deepEqual([got.row, got.anim], [b.frameWord, b.state], `tick ${b.tick}: the machine from row ${a.frameWord} with ${JSON.stringify([keys.left, keys.right])}`);
    pairs++;
  }
  return pairs;
}

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
    assert.equal(replayMachine(r.samples, values()), pairs, 'the control routine and its states walk the same rows'); // a car whose key is released on row 2 would show a different state machine here
    assert.ok(pairs >= 300, `enough pairs (${pairs})`); // @math 334 pairs were observed
  },
  async discriminate(ctx) {
    const V = values(), s = ctx.obs('carsteer-1').samples;
    return [
      { label: 'the keys of the earlier pause', fn: () => replay(s, V, { keysOfEarlier: true }) },
      { label: 'a step of two', fn: () => assert.deepEqual(stepLean(0, { right: true }), { lean: V.L.step + 1, state: V.L.movingState }) }, // @math one more than the step
      { label: 'the machine with the keys of the earlier pause', fn: () => replayMachine(s, V, { keysOfEarlier: true }) },
      { label: 'the lean toward the other side', fn: () => replay(s.map(x => ({ ...x, leftAmount: x.rightAmount, rightAmount: x.leftAmount })), V) },
    ];
  },
};
