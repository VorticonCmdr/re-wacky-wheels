import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const rel = (from, to) => d(to - from); // @math a near call's operand
const values = () => ({ h: expected('horizon.scroll') });

// The horizon routine and its callers and initialisation as instruction bytes built from the claim's values.
function code(exe, V, { ramps = [V.h.leftRamp, V.h.rightRamp], initial = V.h.initial } = {}) {
  const H = V.h, { le } = locateLe(exe), read = (at, n) => [...objectBytes(le, 1, at, n)];
  const [B0, B1, B2, B3] = H.boundWords, P = H.pointerAt, M = H.modeWord, car = H.carPointer, [left, right] = ramps;
  const routine = [
    0x52, 0x8b, 0x15, ...d(P), 0x83, 0x3d, ...d(M), H.modes[0], 0x74, 0x09, 0x83, 0x3d, ...d(M), H.modes[1], 0x75, 0x55, // @math push edx; mov edx,[ptr]; cmp [mode],0; jz +9; cmp [mode],3; jnz end
    0x66, 0x85, 0xc0, 0x74, 0x29, // @math test ax,ax; jz left
    0x3b, 0x15, ...d(B3), 0x75, 0x06, 0x8b, 0x15, ...d(B1), // @math cmp edx,[B3]; jnz +6; mov edx,[B1]
    0xa1, ...d(car), 0x0f, 0xbf, 0x40, right, 0x01, 0xc2, 0x3b, 0x15, ...d(B3), 0x7e, 0x2f, 0x8b, 0x15, ...d(B3), 0xeb, 0x27, // @math mov eax,[car]; movsx eax,word [eax+right ramp]; add edx,eax; cmp edx,[B3]; jng end; mov edx,[B3]; jmp end
    0x3b, 0x15, ...d(B0), 0x75, 0x06, 0x8b, 0x15, ...d(B2), // @math left: cmp edx,[B0]; jnz +6; mov edx,[B2]
    0xa1, ...d(car), 0x0f, 0xbf, 0x40, left, 0x29, 0xc2, 0x3b, 0x15, ...d(B0), 0x7d, 0x06, 0x8b, 0x15, ...d(B0), // @math mov eax,[car]; movsx eax,word [eax+left ramp]; sub edx,eax; cmp edx,[B0]; jnl end; mov edx,[B0]
    0x89, 0x15, ...d(P), 0x5a, 0xc3, // @math mov [ptr],edx; pop edx; ret
  ];
  assert.deepEqual(read(H.routine, routine.length), routine, 'the horizon routine');
  assert.deepEqual(read(H.calls[0], 7), [0x31, 0xc0, 0xe8, ...rel(H.calls[0] + 7, H.routine)], 'the left turn calls it with 0'); // @math xor eax,eax; call (7 bytes)
  assert.deepEqual(read(H.calls[1], 10), [0xb8, ...d(1), 0xe8, ...rel(H.calls[1] + 10, H.routine)], 'the right turn calls it with 1'); // @math mov eax,1; call (10 bytes)
  const store = (word, value) => [0xc7, 0x05, ...d(word), ...d(value)]; // @math mov dword [word], imm32
  H.bounds.forEach((b, i) => assert.deepEqual(read(H.initAt[i], 10), store(H.boundWords[i], H.base + b), `the bound ${i} is set at the start`)); // @math 10 bytes
  assert.deepEqual(read(H.initAt[4], 10), store(H.pointerAt, H.base + initial), 'and the pointer starts at bound 1'); // @math the fifth store
}

export default {
  id: 'exe-horizon',
  claims: ['horizon.scroll'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { code(await ctx.open('WW.EXE'), values()); },
  async discriminate(ctx) {
    const V = values(), exe = await ctx.open('WW.EXE'), H = V.h;
    return [
      { label: 'the ramp words swapped', fn: () => code(exe, V, { ramps: [H.rightRamp, H.leftRamp] }) },
      { label: 'a start offset of 79', fn: () => code(exe, V, { initial: H.initial - 1 }) },
    ];
  },
};
