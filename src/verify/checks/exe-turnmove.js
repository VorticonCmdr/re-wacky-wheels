import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const rel = (from, to) => d(to - from); // @math a near call's operand
const values = () => ({ t: expected('car.turn-move') });

// The turn blocks of the steering routine: the pivot offset before and after the heading change, their difference and its addition to the camera words.
function code(exe, V, { routine = V.t.routine, cameraWords = V.t.cameraWords } = {}) {
  const T = V.t, { le } = locateLe(exe), read = (at, n) => [...objectBytes(le, 1, at, n)];
  for (const at of T.calls) assert.deepEqual(read(at, 5), [0xe8, ...rel(at + 5, routine)], `the call of the pivot routine at obj1+0x${at.toString(16)}`); // @math a near call is 5 bytes
  for (const at of T.diffAt) {
    const sub = (oldWord, newWord, diffWord) => [0xa1, ...d(oldWord), 0x2b, 0x05, ...d(newWord), 0xa3, ...d(diffWord)]; // @math mov eax,[old]; sub eax,[new]; mov [diff],eax
    assert.deepEqual(read(at, 16), sub(T.oldWords[0], T.newWords[0], T.diffWords[0]), 'the difference of the x offsets'); // @math 16 bytes
    assert.deepEqual(read(at + 16, 16), sub(T.oldWords[1], T.newWords[1], T.diffWords[1]), 'the difference of the y offsets'); // @math the second block follows the first
  }
  for (const at of T.moveAt) {
    const add = (diffWord, cameraWord) => [0x66, 0xa1, ...d(diffWord), 0x66, 0x01, 0x05, ...d(cameraWord)]; // @math mov ax,[diff]; add [camera],ax
    assert.deepEqual(read(at, 13), add(T.diffWords[0], cameraWords[0]), 'the x difference is added to the camera x'); // @math 13 bytes
    assert.deepEqual(read(at + 13, 13), add(T.diffWords[1], cameraWords[1]), 'and the y difference to the camera y'); // @math the y block follows
  }
}

export default {
  id: 'exe-turnmove',
  claims: ['car.turn-move'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { code(await ctx.open('WW.EXE'), values()); },
  async discriminate(ctx) {
    const V = values(), exe = await ctx.open('WW.EXE'), T = V.t;
    return [
      { label: 'another pivot routine', fn: () => code(exe, V, { routine: T.routine + 1 }) }, // @math the next byte
      { label: 'the camera words swapped', fn: () => code(exe, V, { cameraWords: [T.cameraWords[1], T.cameraWords[0]] }) },
    ];
  },
};
