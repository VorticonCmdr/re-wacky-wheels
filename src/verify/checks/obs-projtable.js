import assert from 'node:assert/strict';
import { assertArchive, crc, words16 } from '../obs-helpers.js';
import { locateLe, objectBytes } from '../../formats/le.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => expected('view.row-table');

// The table as the routine at obj1+0x174a4 builds it, from the claim values alone.
function table(V, { rounding = 'half-down', numerator = V.numerator } = {}) {
  const out = [V.first];
  for (let d = 1; d < V.entries; d++) {
    let b = Math.floor(numerator / d);
    const r = numerator - b * d;
    if (rounding === 'half-down' ? r > Math.floor(d / 2) // @math half the distance, the rounding threshold
       : rounding === 'up' ? r > 0 : false) b++;
    b = Math.min(Math.max(b, V.minimum), V.maximum);
    out.push(V.base - (b >> 1) + b); // @math the halved size, as the code does
  }
  return words16(out);
}

// The constants as the code carries them: the immediates of the five instructions the claim cites (opcode bytes, then the little-endian immediate).
const SITES = {
  first: { at: 0x174a9, opcode: [0xbb], width: 4 }, // @math mov ebx,imm32
  numerator: { at: 0x174d8, opcode: [0xb8], width: 4 }, // @math mov eax,imm32
  minimum: { at: 0x17504, opcode: [0x83, 0xfb], width: 1 }, // @math cmp ebx,imm8
  maximum: { at: 0x1750e, opcode: [0x81, 0xfb], width: 4 }, // @math cmp ebx,imm32
  base: { at: 0x17527, opcode: [0xba], width: 4 }, // @math mov edx,imm32
};
function codeImmediates(exe, V, sites = SITES) {
  const { le } = locateLe(exe);
  for (const [name, site] of Object.entries(sites)) {
    const b = objectBytes(le, 1, site.at, site.opcode.length + site.width), dv = view(b);
    assert.deepEqual([...b.subarray(0, site.opcode.length)], site.opcode, `${name}: the opcode`);
    assert.equal(site.width === 1 ? dv.getUint8(site.opcode.length) : dv.getUint32(site.opcode.length, true), V[name], `${name}: the immediate in the code`); // @math one-byte or dword immediates
  }
}

function validate(dat, r, V, options, exe) {
  if (exe) codeImmediates(exe, V);
  assertArchive(r, dat);
  assert.equal(r.tableAt, V.tableAt, 'the live table address');
  assert.equal(V.maximum, V.first, 'the size cap is the entry the table starts with (a cap of 0xef gives the same entries, so only this relation pins it)');
  assert.equal(r.bytes, V.entries * 2, 'the table is 0x1000 words'); // @math two bytes a word
  assert.equal(r.crc, crc(table(V, options)), 'the live table equals the computed one');
}

export default {
  id: 'obs-projtable',
  claims: ['view.row-table'],
  obs: ['projtable-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('projtable-1'), values(), undefined, await ctx.open('WW.EXE')); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), exe = await ctx.open('WW.EXE'), r = ctx.obs('projtable-1'), V = values(), v = patch => ({ ...V, ...patch });
    return [
      { label: 'numerator one more', fn: () => validate(dat, r, V, { numerator: V.numerator + 1 }) },
      { label: 'numerator one less (the table cannot tell, the code can)', fn: () => validate(dat, r, v({ numerator: V.numerator - 1 }), undefined, exe) },
      { label: 'rounding down', fn: () => validate(dat, r, V, { rounding: 'down' }) },
      { label: 'rounding any remainder up', fn: () => validate(dat, r, V, { rounding: 'up' }) },
      { label: 'minimum 0x14', fn: () => validate(dat, r, v({ minimum: V.minimum - 1 })) },
      { label: 'maximum 0xf1', fn: () => validate(dat, r, v({ maximum: V.maximum + 1 })) },
      { label: 'maximum 0xef (the table cannot tell, the code can)', fn: () => validate(dat, r, v({ maximum: V.maximum - 1 }), undefined, exe) },
      { label: 'base 0x77', fn: () => validate(dat, r, v({ base: V.base - 1 })) },
      { label: 'first entry 0xef', fn: () => validate(dat, r, v({ first: V.first - 1 })) },
      { label: 'the table at another address', fn: () => validate(dat, r, v({ tableAt: V.tableAt + 2 })) }, // @math the next word
      { label: 'a table of 0xfff words', fn: () => validate(dat, r, v({ entries: V.entries - 1 })) },
    ];
  },
};
