import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const rel = (from, to) => d(to - from); // @math a near jump's operand: the target minus the address after the instruction

// The kind branch as instruction bytes built from the claim's values.
function bytesOf(A, o = {}) {
  const V = { ...A, ...o }, out = [], push = (...bytes) => out.push(...bytes), here = () => V.start + out.length;
  push(0x0f, 0xbf, 0x5a, V.typeWord, 0x6b, 0xdb, V.typeRecordBytes, 0xbf, ...d(V.typeTableAt), 0x01, 0xdf); // @math movsx ebx,word [edx+type]; imul ebx,ebx,12; mov edi,type table; add edi,ebx
  push(0x0f, 0xbf, 0x1f, 0x6b, 0xdb, V.recordBytes, 0x66, 0x8b, 0x9b, ...d(V.tableOffset + V.kindWord)); // @math movsx ebx,word [edi]; imul ebx,ebx,0x28; mov bx,[ebx+catalogue+kind word]
  push(0x89, 0x3d, ...d(V.recordPointerAt), 0x66, 0x85, 0xdb); // @math mov [record pointer],edi; test bx,bx
  push(0x0f, 0x8e, ...rel(here() + 6, V.lowCode)); // @math jng to the code for kinds of 0 or less (the jump is 6 bytes)
  push(0x66, 0x83, 0xfb, V.kindOne); // @math cmp bx,1
  push(0x0f, 0x84, ...rel(here() + 6, V.oneCode)); // @math jz to the code for kind 1
  push(0x66, 0x83, 0x78, V.limitWord, V.limit, 0x0f, 0x8d, ...rel(here() + 11, V.skipCode)); // @math cmp word [eax+counter],0x63 (5 bytes); jnl to the skip (6 bytes)
  push(0x31, 0xd2, 0x66, 0x83, 0x78, V.flagWord, 0x00, 0x74, 0x06); // @math xor edx,edx; cmp word [eax+flag],0; jz +6
  push(0x66, 0x83, 0xfb, V.kindTwo, 0x75, 0x05, 0xba, ...d(0x01)); // @math cmp bx,2; jnz +5; mov edx,1
  return out;
}

function validate(exe, A, o = {}) {
  const { le } = locateLe(exe), B = bytesOf(A, o), got = [...objectBytes(le, 1, (o.start ?? A.start), B.length)], first = got.findIndex((v, i) => v !== B[i]);
  assert.equal(first, -1, `the kind branch differs at byte ${first}: got ${got.slice(first, first + 8).map(v => v.toString(16))}, built ${B.slice(first, first + 8).map(v => v.toString(16))}`); // @math show 8 bytes at the difference, in hex
}

export default {
  id: 'exe-atrkind',
  claims: ['atr.kind-use'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), expected('atr.kind-use')); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), A = expected('atr.kind-use');
    return [
      { label: 'another catalogue table', fn: () => validate(exe, A, { tableOffset: A.tableOffset + 4 }) }, // @math the next dword
      { label: 'another record size', fn: () => validate(exe, A, { recordBytes: A.recordBytes + 1 }) },
      { label: 'the kind word at +2', fn: () => validate(exe, A, { kindWord: 2 }) }, // @math the second word
      { label: 'kind 2 where 1 is', fn: () => validate(exe, A, { kindOne: A.kindTwo }) },
      { label: 'the code of kind 1 elsewhere', fn: () => validate(exe, A, { oneCode: A.oneCode + 1 }) }, // @math the next byte
      { label: 'the low code elsewhere', fn: () => validate(exe, A, { lowCode: A.lowCode + 1 }) }, // @math the next byte
    ];
  },
};
