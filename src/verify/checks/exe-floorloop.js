import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { expected } from '../expect.js';

// The instruction bytes of the floor routine's high detail loop (obj1+0x27e94), built from the claim's values: every address and constant the claim lists is an operand here, and the bytes in WW.EXE must be exactly these.
const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const NOP4 = [0x90, 0x90, 0x90, 0x90]; // @math the padding the compiler left where a jump was shortened

function bytesOf(L, o = {}) {
  const V = { ...L, ...o }, shift = Math.log2(V.angleBytes); // @math the angle entry's size is a power of two: the shift that scales an index
  const dispatch = [0x66, 0xa1, ...d(V.renderMode), 0x66, 0x3d, 0x01, 0x00]; // @math mov ax,[mode]; cmp ax,1
  const setup = [
    0x8b, 0x1d, ...d(V.angleAt), // @math mov ebx,[angle]
    0x81, 0xeb, ...d(V.angleBias), // @math sub ebx,bias
    0x83, 0xfb, 0x00, 0x7d, 0x0a, ...NOP4, // @math cmp ebx,0; jnl +10
    0x81, 0xc3, ...d(V.wrap), // @math add ebx,wrap
    0xc1, 0xe3, shift, // @math shl ebx,shift
    0x03, 0x1d, ...d(V.trigPointerAt), // @math add ebx,[trig pointer]
    0x8b, 0x35, ...d(V.ndistPointerAt), // @math mov esi,[ndist pointer]
    0xbf, 0x00, 0x00, 0x0a, 0x00, // @math mov edi,0xa0000
    0x81, 0xc7, ...d(V.vramBase), // @math add edi,base
    0x66, 0x03, 0x3d, ...d(V.pageWordAt), // @math add di,[page word]
    0x33, 0xc9, 0xb9, ...d(V.columns), // @math xor ecx,ecx; mov ecx,columns
  ];
  const step = [
    0x56, 0x8b, 0x03, 0xf7, 0x26, 0xc1, 0xe8, 0x10, // @math push esi; mov eax,[ebx]; mul dword [esi]; shr eax,16
    0x66, 0x03, 0x05, ...d(V.cameraWords[0]), 0x8b, 0xc8, // @math add ax,[camera x]; mov ecx,eax
    0x8b, 0x43, 0x04, 0xf7, 0x26, 0xc1, 0xe8, 0x10, // @math mov eax,[ebx+4]; mul dword [esi]; shr eax,16
    0x66, 0x03, 0x05, ...d(V.cameraWords[1]), 0x8b, 0xf0, // @math add ax,[camera y]; mov esi,eax
    0x83, 0xe6, V.tileMask, 0xc1, 0xe6, V.tileShift, 0x8b, 0xd1, 0x83, 0xe2, V.tileMask, 0x03, 0xf2, // @math and esi,mask; shl esi,shift; mov edx,ecx; and edx,mask; add esi,edx
    0x8b, 0x15, ...d(V.tablePointerAt), 0xc1, 0xe8, V.tileShift, 0xc1, 0xe0, 0x09, 0xc1, 0xe9, V.tileShift, 0xc1, 0xe1, 0x02, // @math mov edx,[table]; shr eax,shift; shl eax,9; shr ecx,shift; shl ecx,2
    0x03, 0xd0, 0x03, 0xd1, 0x03, 0x32, 0xa4, 0x5e, // @math add edx,eax; add edx,ecx; add esi,[edx]; movsb; pop esi
    0x83, 0xef, V.lineBytes + 1, 0x83, 0xc6, 0x04, // @math sub edi,line+1 (movsb added 1); add esi,4
  ];
  const tail = [
    0x59, 0x83, 0xc3, V.angleBytes, 0x3b, 0x1d, ...d(V.trigEndAt), 0x7e, 0x0a, ...NOP4, // @math pop ecx; add ebx,entry; cmp ebx,[end]; jng +10
    0x8b, 0x1d, ...d(V.trigPointerAt), 0x81, 0xc7, ...d(V.rowAdvance), // @math mov ebx,[start]; add edi,rows
    0x8a, 0x25, ...d(V.planeMaskAt), 0xd0, 0xe4, 0x80, 0xfc, 0x08, 0x7e, 0x08, ...NOP4, 0xb4, 0x01, 0x66, 0x47, 0x86, 0x25, ...d(V.planeMaskAt), // @math mov ah,[mask]; shl ah,1; cmp ah,8; jng +8; mov ah,1; inc di; xchg ah,[mask]
  ];
  return { dispatch, setup, step, tail };
}

const at = { dispatch: 0x27eaa, setup: 0x27fae, step: 0x28000 }; // @math the offsets of the cited instructions

function validate(exe, L, o = {}) {
  const { le } = locateLe(exe), B = bytesOf(L, o), steps = o.steps ?? L.steps;
  const read = (offset, n) => [...objectBytes(le, 1, offset, n)];
  assert.deepEqual(read(at.dispatch, B.dispatch.length), B.dispatch, 'the mode word is compared with 1');
  assert.deepEqual(read(at.setup, B.setup.length), B.setup, 'the column setup');
  // the 70 unrolled steps are the same bytes repeated, then the column tail follows them
  for (let k = 0; k < steps; k++) assert.deepEqual(read(at.step + k * B.step.length, B.step.length), B.step, `step ${k}`);
  assert.deepEqual(read(at.step + steps * B.step.length, B.tail.length), B.tail, 'the column tail after the last step');
  assert.equal(L.rowAdvance, L.steps * (L.lineBytes), 'the video pointer moves on by the steps of 70 lines'); // @math a line is lineBytes bytes
  assert.notDeepEqual(read(at.step + steps * B.step.length, B.step.length), B.step, 'and the step is not repeated a 71st time');
}

export default {
  id: 'exe-floorloop',
  claims: ['floor.render-loop'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WW.EXE'), expected('floor.render-loop')); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), L = expected('floor.render-loop');
    return [
      { label: '71 steps', fn: () => validate(exe, L, { steps: L.steps + 1 }) },
      { label: '69 steps', fn: () => validate(exe, L, { steps: L.steps - 1 }) },
      { label: 'another column count', fn: () => validate(exe, L, { columns: L.columns + 1 }) },
      { label: 'another camera word', fn: () => validate(exe, L, { cameraWords: [L.cameraWords[0], L.cameraWords[1] + 4] }) }, // @math the next dword
      { label: 'another plane mask word', fn: () => validate(exe, L, { planeMaskAt: L.planeMaskAt + 1 }) }, // @math the next byte
      { label: 'another tile mask', fn: () => validate(exe, L, { tileMask: L.tileMask - 1 }) },
    ];
  },
};
