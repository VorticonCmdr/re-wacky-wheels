import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { locateLe, objectBytes } from '../../formats/le.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ x: expected('exit.screen-observed'), sel: expected('exit.screen-select') });
const TOOL = { textAt: 0xb8000, cells: 4000 }; // @math what observe.mjs exit reads: the colour text segment and 80 x 25 cells of 2 bytes

function validate(dat, r, V, { member = V.x.member } = {}) {
  const X = V.x, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assertArchive(r, dat);
  assert.deepEqual([r.textAt, r.cells], [TOOL.textAt, TOOL.cells], 'what the tool read');
  assert.deepEqual([X.textAt, X.cells, X.crtcStart], [r.textAt, r.cells, r.crtcStart], 'the screen and the start address');
  assert.equal(members.get(member).length, X.cells, 'the member is one screen of cells');
  assert.equal(members.get(X.other).length, X.cells, 'the other member too');
  assert.equal(r.textCrc, crc(members.get(member)), `the text screen is ${member}`);
  assert.equal(crc(members.get(X.member)), X.crc, 'the CRC of the member');
  assert.equal(crc(members.get(X.other)), X.otherCrc, 'the CRC of the other member');
  assert.notEqual(r.textCrc, crc(members.get(member === X.member ? X.other : X.member)), 'not the other member');
  assert.notEqual(r.nextCrc, r.textCrc, 'the next 4000 bytes are another thing');
}

// The instructions of the selection (cmp dword [flag], 0; jz; mov eax, shareware string; jmp; mov eax, registered string) and the strings they name, read from WW.EXE's objects.
function selection(exe, V, { reader = V.sel.reader, at = V.sel.codeAt, flagAt = V.sel.flagAt, strings = V.sel.strings } = {}) {
  const S = V.sel, { le } = locateLe(exe), code = objectBytes(le, 1, at, S.code.length), le32 = (b, i) => b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24; // @math little-endian dword
  assert.deepEqual([...code], S.code, 'the bytes of the selection');
  assert.equal(le32(code, 2), flagAt, 'it tests the flag dword'); // @math the operand of cmp dword [mem], imm8 sits after the 2 opcode bytes
  const text = (offset, n) => String.fromCharCode(...objectBytes(le, 2, offset, n)); // @math the data object holds the strings
  assert.equal(le32(code, 10), S.shareware, 'the first string is the shareware one'); // @math the operand of the first mov eax, imm32 sits at byte 10
  assert.equal(le32(code, 17), S.registered, 'the second is the registered one'); // @math the operand of the second mov eax, imm32 sits at byte 17
  assert.equal(text(S.shareware, strings[0].length), strings[0], 'the string at the shareware address');
  assert.equal(text(S.registered, strings[1].length), strings[1], 'the string at the registered address');
  const call = objectBytes(le, 1, S.callAt, 5), target = S.callAt + 5 + le32(call, 1); // @math a call is 5 bytes long, its rel32 operand starts at byte 1
  assert.equal(call[0], 0xe8, 'a near call'); // @math the call opcode
  assert.equal(target, reader, 'to the member reader');
  assert.equal(code[7], 0x74, 'a jump if zero skips the shareware branch'); // @math the jz opcode, byte 7
}

export default {
  id: 'obs-exit',
  claims: ['exit.screen-observed', 'exit.screen-select'],
  obs: ['exit-1', 'exit-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    validate(dat, ctx.obs('exit-1'), V);
    validate(dat, ctx.obs('exit-2'), V, { member: V.x.other });
    selection(await ctx.open('WW.EXE'), V);
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('exit-1'), r2 = ctx.obs('exit-2'), V = values(), exe = await ctx.open('WW.EXE');
    return [
      { label: 'the flag run showing the registered member', fn: () => validate(dat, r2, V) },
      { label: 'the plain run showing the shareware member', fn: () => validate(dat, r, V, { member: V.x.other }) },
      { label: 'the selection one byte on', fn: () => selection(exe, V, { at: V.sel.codeAt + 1 }) },
      { label: 'another flag dword', fn: () => selection(exe, V, { flagAt: V.sel.flagAt + 4 }) }, // @math the next dword
      { label: 'another reader', fn: () => selection(exe, V, { reader: V.sel.reader + 1 }) }, // @math the next byte
      { label: 'the strings swapped', fn: () => selection(exe, V, { strings: [...V.sel.strings].reverse() }) },
      { label: 'the shareware member', fn: () => validate(dat, r, V, { member: V.x.other }) },
      { label: 'the text altered', fn: () => validate(dat, { ...r, textCrc: '00000000' }, V) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
