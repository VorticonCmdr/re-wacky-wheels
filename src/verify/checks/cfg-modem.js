import assert from 'node:assert/strict';
import { locateLe } from '../../formats/le.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ m: expected('cfg.modem-defaults'), keys: expected('cfg.default-keys'), cfg: expected('cfg.read') });

// Decode SETUP.EXE's two defaults routines: `mov dword [addr], imm32` stores and `mov edi, dst; mov esi, src` string copies.
function setupDefaults(setup, M) {
  const { le } = locateLe(setup), code = le.objects[0].data, data = le.objects[1].data, dv = view(code), dwords = [], strings = [];
  for (const [from, to] of M.ranges) {
    const items = [];
    for (let i = from; i < to;) {
      if (code[i] === M.storeDword[0] && code[i + 1] === M.storeDword[1]) { items.push({ at: i, end: i + M.storeLength, dword: { addr: dv.getUint32(i + 2, true), value: dv.getUint32(i + 2 + 4, true) } }); i += M.storeLength; continue; } // @math opcode + modrm, then the address and the value
      if (code[i] === M.movEdi && code[i + M.movLength] === M.movEsi) {
        const src = dv.getUint32(i + 1 + M.movLength, true), bytes = data.subarray(src), end = bytes.indexOf(0);
        items.push({ at: i, end: i + 2 * M.movLength, string: { addr: dv.getUint32(i + 1, true), text: String.fromCharCode(...bytes.subarray(0, end)) } }); i += 2 * M.movLength; continue; // @math the two movs
      }
      i++;
    }
    assert.equal(items[0].at, from, 'the routine range starts at an item');
    assert.equal(items.at(-1).end, to, 'and ends after an item');
    for (const it of items) (it.dword ? dwords : strings).push(it.dword ?? it.string);
  }
  return { dwords, strings };
}

function validate(setup, file, V, name) {
  const M = V.m, dv = view(file), { dwords, strings } = setupDefaults(setup, M), end = file.length;
  assert.equal(end, V.cfg.size, `${name}: the file size of cfg.read`);
  const hex = off => `0x${off.toString(16)}`; // @math hexadecimal radix
  const text = off => { const raw = file.subarray(off), z = raw.indexOf(0); return String.fromCharCode(...raw.subarray(0, z)); };
  const inCfg = a => { const off = a - M.base; return off >= M.from && off < M.to ? off : null; };
  let nd = 0, ns = 0, lo = Infinity, hi = -Infinity;
  for (const { addr, value } of dwords) {
    const off = inCfg(addr); if (off === null) continue;
    nd++; lo = Math.min(lo, off); hi = Math.max(hi, off + M.dwordBytes);
    assert.equal(dv.getUint32(off, true), value, `${name}: the dword at ${hex(off)}`);
  }
  for (const { addr, text: s } of strings) {
    const off = inCfg(addr); if (off === null) continue;
    ns++; lo = Math.min(lo, off); hi = Math.max(hi, off + s.length + 1); // @math the terminating NUL
    if (M.edited.includes(off)) assert.equal(text(off).slice(0, M.editedPrefix.length), M.editedPrefix, `${name}: the edited string at ${hex(off)} still begins like a command`);
    else assert.equal(text(off), s, `${name}: the string at ${hex(off)}`);
  }
  assert.deepEqual([lo, hi], [M.from, M.to], 'the extent of the matched words');
  assert.equal(nd, M.dwordCount, 'the dword stores that land in the configuration');
  assert.equal(ns, M.stringCount, 'the string copies that land in the configuration');
  for (let k = 0; k < M.records.count; k++) assert.equal(dv.getUint32(M.records.at + k * M.records.stride, true), k + 1, `${name}: COM record ${k + 1}`); // @math record numbers start at 1
  assert.equal(dv.getUint32(M.records.at + M.records.count * M.records.stride, true), 0, `${name}: the table ends`); // @math a zero dword follows the table
}

export default {
  id: 'cfg-modem',
  claims: ['cfg.modem-defaults'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const V = values(), setup = await ctx.open('SETUP.EXE'), paths = ctx.list().filter(p => /(^|\/)wacky\.cfg$/i.test(p));
    assert.equal(paths.length, V.keys.files, 'the installed WACKY.CFG files');
    for (const path of paths) validate(setup, await ctx.openPath(path), V, path);
  },
  async discriminate(ctx) {
    const V = values(), setup = await ctx.open('SETUP.EXE'), path = ctx.list().find(p => /(^|\/)wacky\.cfg$/i.test(p)), file = await ctx.openPath(path), m = patch => () => validate(setup, file, { ...V, m: { ...V.m, ...patch } }, path);
    return [
      { label: 'base 4 bytes up', fn: m({ base: V.m.base + 4 }) }, // @math one dword
      { label: 'base 4 bytes down', fn: m({ base: V.m.base - 4 }) }, // @math one dword
      { label: 'base one byte up', fn: m({ base: V.m.base + 1 }) },
      { label: 'no edited string', fn: m({ edited: [] }) },
      { label: 'records numbered from 2', fn: m({ records: { ...V.m.records, at: V.m.records.at + V.m.records.stride } }) },
      { label: 'one dword more', fn: m({ dwordCount: V.m.dwordCount + 1 }) },
      { label: 'one string fewer', fn: m({ stringCount: V.m.stringCount - 1 }) },
      { label: 'first range ends early', fn: m({ ranges: [[V.m.ranges[0][0], V.m.ranges[0][1] - V.m.storeLength], V.m.ranges[1]] }) },
    ];
  },
};
