import assert from 'node:assert/strict';
import { locateLe, objectBytes } from '../../formats/le.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const d = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; // @math the four bytes of a little-endian dword
const rel = (from, to) => d(to - from); // @math a near jump's or call's operand: the target minus the address after the instruction

// The first branch of racer.init (gate word not 0) as instruction bytes, built from the claim's values; the offsets of the other record words are the routine's own.
function bytesOf(R, o = {}) {
  const V = { ...R, ...o }, b = V.base, at = V.routine, out = [];
  const push = (...bytes) => out.push(...bytes), here = () => at + out.length;
  const clear = disp => push(0x66, 0x89, 0x88, ...d(b + disp)); // @math mov [eax+base+disp],cx
  push(0x53, 0x51, 0x52, 0x56); // @math push ebx, ecx, edx, esi
  push(0x83, 0x3d, ...d(V.gate), 0x00); // @math cmp dword [gate],0
  push(0x0f, 0x84, ...rel(here() + 6, V.otherBranch)); // @math jz to the other branch (the instruction is 6 bytes)
  push(0x66, 0xa1, ...d(V.shadowSource), 0x31, 0xf6, 0x66, 0xa3, ...d(V.shadowTarget), 0x66, 0x89, 0x35, ...d(V.indexAt), 0x31, 0xc9); // @math mov ax,[source]; xor esi,esi; mov [target],ax; mov [index],si; xor ecx,ecx
  const loop = here();
  push(0x66, 0x8b, 0x35, ...d(V.indexAt), 0x0f, 0xbf, 0xd6, 0x6b, 0xc2, V.racerBytes); // @math mov si,[index]; movsx edx,si; imul eax,edx,record size
  push(0x66, 0xc7, 0x80, ...d(b + V.stateWord), V.stateValue, 0x00); // @math mov word [eax+state],2
  [0x62, 0x54, 0x56, 0x12, 0x5c, 0x58, 0x00].forEach(clear); // @math the words the routine clears, in its order
  push(0x66, 0x83, 0xfe, V.startRacers - 1, 0x7f, 0x33); // @math cmp si,last start racer; jg over the next 0x33 bytes
  push(0x66, 0x8b, 0x1c, 0x55, ...d(V.xTable)); // @math mov bx,[edx*2+x table]
  clear(0x1c); // @math the route index word
  push(0x66, 0x8b, 0x14, 0x55, ...d(V.yTable)); // @math mov dx,[edx*2+y table]
  push(0x66, 0x89, 0x98, ...d(b + V.xWord), 0x66, 0x89, 0x90, ...d(b + V.yWord)); // @math mov [eax+x],bx; mov [eax+y],dx
  push(0x66, 0x8b, 0x15, ...d(V.routeCompassWord), 0x66, 0x89, 0x90, ...d(b + V.headingWord)); // @math mov dx,[route compass]; mov [eax+heading],dx
  push(0x89, 0xca, 0x0f, 0xbf, 0xde, 0x6b, 0xdb, V.racerBytes, 0x83, 0xc2, 0x02); // @math mov edx,ecx; movsx ebx,si; imul ebx,ebx,size; add edx,2
  push(0x66, 0x89, 0x8c, 0x1a, ...d(b + 0x26), 0x66, 0x89, 0x8c, 0x1a, ...d(b + 0x2e), 0x83, 0xfa, 0x04, 0x75, 0xe2); // @math two indexed clears, cmp edx,4; jnz back
  const clearB = disp => push(0x66, 0x89, 0x8b, ...d(b + disp)); // @math mov [ebx+base+disp],cx
  clearB(0x02); clearB(0x24); push(0x66, 0xa1, ...d(V.speedSource)); clearB(0x20); push(0x46); clearB(0x22); // @math the words cleared; mov ax,[source]; inc esi
  push(0x66, 0x89, 0x35, ...d(V.indexAt), 0x66, 0x89, 0x83, ...d(b + 0x08)); // @math mov [index],si; mov [ebx+base+8],ax
  push(0x66, 0x83, 0xfe, V.racers - 1, 0x0f, 0x8e, ...rel(here() + 10, loop)); // @math cmp si,last racer (4 bytes); jng back to the loop top (6 bytes)
  push(0xe8, ...rel(here() + 5, V.driver)); // @math call the placement driver
  push(0xe8, ...rel(here() + 5, V.after)); // @math call the routine after it
  push(0x66, 0x8b, 0x35, ...d(V.indexAt), 0x5e, 0x5a, 0x59, 0x5b, 0xc3); // @math mov si,[index]; pop esi, edx, ecx, ebx; ret
  return out;
}

function validate(exe, R, o = {}) {
  const { le } = locateLe(exe), B = bytesOf(R, o);
  const got = [...objectBytes(le, 1, (o.routine ?? R.routine), B.length)], first = got.findIndex((v, i) => v !== B[i]);
  assert.equal(first, -1, `the first branch of racer.init differs at byte ${first}: got ${got.slice(first, first + 8).map(v => v.toString(16))}, built ${B.slice(first, first + 8).map(v => v.toString(16))}`); // @math show the first 8 bytes at the difference, in hex
}

// What the branch left in the game: racer 0 on the first table entry, the heading word the route's first compass word, every state word 2.
function observed(dat, r, R, { state = R.stateValue } = {}) {
  assertArchive(r, dat);
  assert.notEqual(r.branch, 0, 'the gate word is not 0');
  const [x, y, heading, , , , s] = r.racers[0]; // @math the record's words: x, y, +0x1a, +0x1c, +0, +2, +4
  assert.deepEqual([x, y], [r.tables.x[0], r.tables.y[0]], 'racer 0 on the first table entry');
  assert.equal(heading, r.routeCompass0, 'its heading word is the first route record\'s compass word');
  assert.ok(r.racers.every(p => p[6] === state), 'every racer\'s state word'); // @math the record's seventh word is +4
  assert.equal(s, state);
}

export default {
  id: 'exe-racerinit',
  claims: ['racer.init'],
  obs: ['start-3'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { const R = expected('racer.init'); validate(await ctx.open('WW.EXE'), R); observed(await ctx.open('WACKY.DAT'), ctx.obs('start-3'), R); },
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), dat = await ctx.open('WACKY.DAT'), r = ctx.obs('start-3'), R = expected('racer.init');
    return [
      { label: 'another gate word', fn: () => validate(exe, R, { gate: R.gate + 4 }) }, // @math the next dword
      { label: 'another x table', fn: () => validate(exe, R, { xTable: R.xTable + 2 }) }, // @math the next word
      { label: 'the heading word from another source', fn: () => validate(exe, R, { routeCompassWord: R.routeCompassWord - 2 }) }, // @math the previous word
      { label: 'another record size', fn: () => validate(exe, R, { racerBytes: R.racerBytes + 1 }) },
      { label: 'seven racers', fn: () => validate(exe, R, { racers: R.racers - 1 }) },
      { label: 'another base', fn: () => validate(exe, R, { base: R.base + 2 }) }, // @math the next word
      { label: 'a state of 3', fn: () => observed(dat, r, R, { state: R.stateValue + 1 }) },
      { label: 'racer 0 elsewhere', fn: () => observed(dat, { ...r, racers: r.racers.map((p, i) => (i === 0 ? [p[0] + 1, ...p.slice(1)] : p)) }, R) }, // @math the first racer
    ];
  },
};
