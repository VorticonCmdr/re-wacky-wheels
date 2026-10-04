import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const rel = (from, to) => d(to - from); // @math a near call's operand: the target minus the address after the call

// The placement driver as instruction bytes built from the claim's values, and the call that reaches it.
function bytesOf(P, o = {}) {
  const V = { ...P, ...o }, at = V.driver;
  const head = [
    0x53, 0x51, 0x52, 0x56, 0x57, 0x66, 0xa1, ...d(V.countSource), 0xbf, ...d(V.lagSteps), 0x66, 0xa3, ...d(V.count), // @math push ebx, ecx, edx, esi, edi; mov ax,[count source]; mov edi,lag; mov [count],ax
    0xa1, ...d(V.limitAt), 0x0f, 0xbf, 0x0d, ...d(V.routeLastAt), 0x39, 0xc8, 0x7d, 0x02, 0x89, 0xc8, // @math mov eax,[limit]; movsx ecx,word [last]; cmp eax,ecx; jnl +2; mov eax,ecx
  ];
  const draw = [
    0xe8, ...rel(at + head.length + 5, V.seedFn), // @math call the seeding routine: its operand is relative to the next instruction
    0xe8, ...rel(at + head.length + 10, V.randomFn), // @math call the random routine
    0x89, 0xc1, 0x89, 0xc6, 0x85, 0xc0, 0x7c, 0xf3, 0x0f, 0xbf, 0x05, ...d(V.routeLastAt), 0x39, 0xc1, 0x7f, 0xe8, // @math mov ecx,eax; mov esi,eax; test eax,eax; jl back; movsx eax,word [last]; cmp ecx,eax; jg back
    0xb9, ...d(V.firstPlaced), 0xeb, 0x0c, // @math mov ecx,first racer; jmp to the loop test
  ];
  const loopAt = at + head.length + draw.length;
  const loop = [
    0x89, 0xc8, 0x89, 0xfa, 0x89, 0xf3, 0xe8, ...rel(loopAt + 11, V.placeFn), 0x41, // @math mov eax,ecx; mov edx,edi; mov ebx,esi; call the placement routine; inc ecx
    0x0f, 0xbf, 0x05, ...d(V.count), 0x39, 0xc1, 0x7e, 0xe9, 0x5f, 0x5e, 0x5a, 0x59, 0x5b, 0xc3, // @math movsx eax,word [count]; cmp ecx,eax; jng back; pop edi, esi, edx, ecx, ebx; ret
  ];
  return { all: [...head, ...draw, ...loop] };
}

function validate(exe, P, o = {}) {
  const { le } = locateLe(exe), B = bytesOf(P, o), V = { ...P, ...o };
  assert.deepEqual([...objectBytes(le, 1, V.driver, B.all.length)], B.all, 'the placement driver');
  const call = [...objectBytes(le, 1, V.callerAt, 5)]; // @math a near call is 5 bytes
  assert.deepEqual(call, [0xe8, ...rel(V.callerAt + 5, V.driver)], 'racer.init\'s first branch calls it'); // @math the call opcode, then the operand relative to the next instruction
}

export default {
  id: 'exe-placement',
  claims: ['route.placement'],
  obs: ['start-3'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), expected('route.placement')); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), P = expected('route.placement');
    return [
      { label: 'another lag', fn: () => validate(exe, P, { lagSteps: P.lagSteps + 1 }) },
      { label: 'another count source', fn: () => validate(exe, P, { countSource: P.countSource + 2 }) }, // @math the next word
      { label: 'racers placed from 0', fn: () => validate(exe, P, { firstPlaced: 0 }) }, // @math the first racer
      { label: 'another random routine', fn: () => validate(exe, P, { randomFn: P.randomFn + 1 }) }, // @math the next byte
      { label: 'another placement routine', fn: () => validate(exe, P, { placeFn: P.placeFn + 1 }) }, // @math the next byte
      { label: 'another caller', fn: () => validate(exe, P, { callerAt: P.callerAt + 1 }) }, // @math the next byte
    ];
  },
};
