import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const at = { lookupInputs: 0x27a21, ahead: 0x27a6c, wrapA: 0x27fc3, wrapB: 0x296ee }; // @math the offsets of the cited routines

// The two small TRIG readers and the angle wraps, as instruction bytes built from the claim's values.
function bytesOf(T, o = {}) {
  const V = { ...T, ...o }, shift = Math.log2(V.entryBytes); // @math the entry size is a power of two: the shift that scales an index
  const entry = [0x8b, 0x1d, ...d(V.angleAt), 0xc1, 0xe3, shift, 0x03, 0x1d, ...d(V.trigPointerAt)]; // @math mov ebx,[angle]; shl ebx,3; add ebx,[trig pointer]
  const lookupInputs = [
    0x53, 0x50, 0x52, 0x56, ...entry, 0x8b, 0x35, ...d(V.ndistPointerAt), // @math push ebx, eax, edx, esi; the entry; mov esi,[ndist pointer]
    0x8b, 0x03, 0x8b, 0x16, 0xf7, 0xea, 0x05, ...d(V.round), 0x83, 0xd2, 0x00, 0xc1, 0xe8, 0x10, 0xa3, ...d(V.terrainColumnAt), // @math mov eax,[ebx]; mov edx,[esi]; imul edx; add eax,0x8000; adc edx,0; shr eax,16; mov [column],eax
    0x8b, 0x43, 0x04, 0x8b, 0x16, 0xf7, 0xea, 0x05, ...d(V.round), 0x83, 0xd2, 0x00, 0xc1, 0xe8, 0x10, 0xa3, ...d(V.terrainRowAt), // @math the same with dword 1 into the row
  ];
  const ahead = [
    0x60, 0x8b, 0x1d, ...d(V.angleAt), 0xbe, ...d(V.aheadDistance), 0xc1, 0xe3, shift, 0x03, 0x1d, ...d(V.trigPointerAt), // @math pusha; mov ebx,[angle]; mov esi,distance; shl ebx,3; add ebx,[trig pointer]
    0x8b, 0x03, 0xf7, 0xe6, 0xc1, 0xe8, 0x10, 0x66, 0x03, 0x05, ...d(V.positionWords[0]), 0x8b, 0xc8, // @math mov eax,[ebx]; mul esi; shr eax,16; add ax,[position x]; mov ecx,eax
    0x8b, 0x43, 0x04, 0xf7, 0xe6, 0xc1, 0xe8, 0x10, 0x66, 0x03, 0x05, ...d(V.positionWords[1]), // @math mov eax,[ebx+4]; mul esi; shr eax,16; add ax,[position y]
  ];
  const wrap = [0x81, 0xc3, ...d(V.wrapAdd)]; // @math add ebx,wrap
  return { lookupInputs, ahead, wrap };
}

function validate(exe, T, o = {}) {
  const { le } = locateLe(exe), B = bytesOf(T, o), read = (offset, n) => [...objectBytes(le, 1, offset, n)];
  assert.deepEqual(read(at.lookupInputs, B.lookupInputs.length), B.lookupInputs, 'the lookup input routine');
  assert.deepEqual(read(at.ahead, B.ahead.length), B.ahead, 'the point-ahead routine');
  assert.deepEqual(read(at.wrapA, B.wrap.length), B.wrap, 'the wrap of the high detail loop');
  assert.deepEqual(read(at.wrapB, B.wrap.length), B.wrap, 'the wrap of the medium detail loop');
}

export default {
  id: 'exe-tableuse',
  claims: ['floor.table-use'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), expected('floor.table-use')); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), T = expected('floor.table-use');
    return [
      { label: 'another rounding constant', fn: () => validate(exe, T, { round: T.round + 1 }) },
      { label: 'another distance ahead', fn: () => validate(exe, T, { aheadDistance: T.aheadDistance + 1 }) },
      { label: 'the lookup column and row swapped', fn: () => validate(exe, T, { terrainColumnAt: T.terrainRowAt, terrainRowAt: T.terrainColumnAt }) },
      { label: 'another position word', fn: () => validate(exe, T, { positionWords: [T.positionWords[1], T.positionWords[0]] }) },
      { label: 'another wrap', fn: () => validate(exe, T, { wrapAdd: T.wrapAdd + 1 }) },
    ];
  },
};
