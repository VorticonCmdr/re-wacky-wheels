import test from 'node:test';
import assert from 'node:assert/strict';
import { createCycle, stepCycle } from '../src/game/palette-cycle.js';

const palette = Uint8Array.from({ length: 768 }, (_, i) => i & 63); // each byte names its own position (6-bit)
const at = (cycle, entry) => cycle.entries.get(entry);
const run = (cycle, calls) => { for (let i = 0; i < calls; i++) cycle = stepCycle(cycle); return cycle; };

test('a track without the flag has no cycle and a null cycle stays null', () => {
  assert.equal(createCycle(0, [], palette), null);
  assert.equal(stepCycle(null), null);
});

test('group B takes its first state on the second call, from the buffer at 15 bytes a state', () => {
  const c = createCycle(1, [2, 4, 3], palette);
  assert.equal(run(c, 1).entries.size, 0); // the first call: nothing is due yet
  const second = run(c, 2); // the count is at the delay of B: the state 1, the colours at 15
  assert.deepEqual([161, 162, 163, 164, 148].map(e => at(second, e)), [[15, 16, 17], [18, 19, 20], [21, 22, 23], [24, 25, 26], [27, 28, 29]]);
});

test('group A takes its first position on the fourth call, from the buffer at 0x87 + 12 and the source 0x30 on', () => {
  const c = run(createCycle(1, [2, 4, 3], palette), 4), base = 0x87 + 12;
  assert.deepEqual([173, 172, 174, 175].map(e => at(c, e)), [0, 1, 2, 3].map(i => [palette[base + i * 3], palette[base + i * 3 + 1], palette[base + i * 3 + 2]]));
  assert.deepEqual([168, 169, 170, 171].map(e => at(c, e)), [0, 1, 2, 3].map(i => [palette[base + 0x30 + i * 3], palette[base + 0x30 + i * 3 + 1], palette[base + 0x30 + i * 3 + 2]]));
});

test('group B waits twice as long in its state 3 (the delay in the line 27) and then takes the state 4 from the buffer at 0x3c', () => {
  const c = createCycle(1, [2, 4, 3], palette), states = [];
  let x = c; for (let i = 0; i < 24; i++) { x = stepCycle(x); states.push(x.state); }
  assert.deepEqual(states.slice(0, 10), [0, 1, 1, 2, 2, 3, 3, 3, 3, 4]); // 2 calls each, 4 in the state 3
  assert.deepEqual(states.slice(10, 12), [4, 5]);
  const resume = run(c, 10); assert.deepEqual(at(resume, 161), [palette[0x3c], palette[0x3c + 1], palette[0x3c + 2]]);
  assert.equal(states.indexOf(0, 1), 19, 'the state 0 again on the 20th call: 8 states of 2 calls and 4 in the state 3, the first state one call short');
});

test('the colours are copied, not shared: the earlier state keeps its entries', () => {
  const a = run(createCycle(1, [2, 4, 3], palette), 2), b = stepCycle(a);
  assert.notEqual(a.entries, b.entries);
  assert.deepEqual(at(a, 148), at(b, 148));
});
