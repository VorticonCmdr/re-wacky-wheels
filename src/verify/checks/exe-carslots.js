import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const rel = (from, to) => d(to - from); // @math a near call's operand: the target minus the address after the call

// The CARS.SP loader and the two slot-filling blocks as instruction bytes built from the claim's values.
function blocks(C, o = {}) {
  const V = { ...C, ...o }, pointerLoop = (at, out) => { // the eight frame pointers written into the slot's record
    out.push(0x89, 0xd0, 0x83, 0xc2, V.pointers * 4, 0x89, 0xb0, ...d(V.recordTableAt), 0x83, 0xc0, 0x04, 0x81, 0xc6, ...d(V.frameBytes), 0x39, 0xd0, 0x75, 0xed); // @math mov eax,edx; add edx,8 pointers x 4 bytes; mov [eax+records],esi; add eax,4; add esi,frame; cmp eax,edx; jnz back
  };
  const loader = [0xb8, ...d(V.loaderNameAt), 0xba, ...d(V.bufferBytes)]; // @math mov eax,name; mov edx,buffer size
  loader.push(0xe8, ...rel(V.loaderAt + loader.length + 5, V.lookupFn), 0xa1, ...d(V.bufferPointerAt), 0x8b, 0x0d, ...d(V.handleAt)); // @math call the lookup; mov eax,[buffer pointer]; mov ecx,[handle]
  loader.push(0xe8, ...rel(V.loaderAt + loader.length + 5, V.readFn)); // @math call the reader
  const first = [0x69, 0xc7, ...d(V.slotBytes), 0xba, ...d(V.readBytes), 0x8b, 0x35, ...d(V.bufferPointerAt), 0xbb, 0x01, 0x00, 0x00, 0x00, 0x01, 0xc6, 0xb8, ...d(V.nameAt), 0x89, 0x3d, ...d(V.slotPointerAt)]; // @math imul eax,edi,slot; mov edx,read; mov esi,[buffer pointer]; mov ebx,1; add esi,eax; mov eax,name; mov [slot pointer],edi
  first.push(0xe8, ...rel(V.routine + first.length + 5, V.lookupFn), 0x8b, 0x0d, ...d(V.handleAt), 0x89, 0xf0); // @math call the lookup; mov ecx,[handle]; mov eax,esi
  first.push(0xe8, ...rel(V.routine + first.length + 5, V.readFn), 0x8b, 0x3d, ...d(V.slotPointerAt), 0x69, 0xd7, ...d(V.recordBytes)); // @math call the reader; mov edi,[slot pointer]; imul edx,edi,record
  pointerLoop(V.routine, first);
  const second = [0x69, 0x35, ...d(V.otherSlotAt), ...d(V.slotBytes), 0xba, ...d(V.readBytes), 0xa1, ...d(V.bufferPointerAt), 0xbb, 0x01, 0x00, 0x00, 0x00, 0x01, 0xc6, 0x8b, 0x0d, ...d(V.handleAt), 0x89, 0xf0]; // @math imul esi,[other slot],slot; mov edx,read; mov eax,[buffer pointer]; mov ebx,1; add esi,eax; mov ecx,[handle]; mov eax,esi
  second.push(0xe8, ...rel(V.second + second.length + 5, V.readFn), 0x69, 0x15, ...d(V.otherSlotAt), ...d(V.recordBytes)); // @math call the reader; imul edx,[other slot],record
  pointerLoop(V.second, second);
  return { loader, first, second };
}

function validate(exe, C, o = {}) {
  const { le } = locateLe(exe), B = blocks(C, o), V = { ...C, ...o };
  for (const [name, at] of [['loader', V.loaderAt], ['first', V.routine], ['second', V.second]]) {
    const got = [...objectBytes(le, 1, at, B[name].length)], first = got.findIndex((v, i) => v !== B[name][i]);
    assert.equal(first, -1, `the ${name} block differs at byte ${first}: got ${got.slice(first, first + 8).map(v => v.toString(16))}, built ${B[name].slice(first, first + 8).map(v => v.toString(16))}`); // @math show 8 bytes at the difference, in hex
  }
  assert.equal(V.readBytes, V.pointers * V.frameBytes, 'the read is eight frames');
  assert.ok(V.readBytes < V.slotBytes, 'the read does not fill the slot'); // @math the remaining bytes of the slot stay unread
}

export default {
  id: 'exe-carslots',
  claims: ['cars.slots'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), expected('cars.slots')); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), C = expected('cars.slots');
    return [
      { label: 'another slot size', fn: () => validate(exe, C, { slotBytes: C.slotBytes + 4 }) }, // @math the next dword
      { label: 'another read length', fn: () => validate(exe, C, { readBytes: C.readBytes + 4 }) }, // @math the next dword
      { label: 'another frame step', fn: () => validate(exe, C, { frameBytes: C.frameBytes + 4 }) }, // @math the next dword
      { label: 'another record table', fn: () => validate(exe, C, { recordTableAt: C.recordTableAt + 4 }) }, // @math the next dword
      { label: 'another record size', fn: () => validate(exe, C, { recordBytes: C.recordBytes + 4 }) }, // @math the next dword
      { label: 'seven pointers', fn: () => validate(exe, C, { pointers: C.pointers - 1 }) },
      { label: 'another name', fn: () => validate(exe, C, { nameAt: C.nameAt + 1 }) }, // @math the next byte
      { label: 'another buffer size', fn: () => validate(exe, C, { bufferBytes: C.bufferBytes + 4 }) }, // @math the next dword
    ];
  },
};
