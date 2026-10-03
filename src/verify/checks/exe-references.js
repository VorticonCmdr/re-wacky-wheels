import assert from 'node:assert/strict';
import { locateLe, parseFixups, objectFixups } from '../../formats/le.js';
import { expected } from '../expect.js';

// Every absolute address in the program has a relocation record (ww.exe.fixups), so the records list all the places that name a
// given data address directly, whether as an immediate or as a displacement. Computed addresses are not covered.
async function sites(ctx) {
  const exe = await ctx.open('WW.EXE'), { le } = locateLe(exe), offset32 = expected('le.fixup-record').source.offset32;
  return objectFixups(le, parseFixups(exe, le)).filter(s => s.type === offset32);
}

function validate(all, V) {
  const R = V.rd, Q = V.quarter;
  assert.equal(R.recordBytes, expected('rd.layout').recordBytes, 'the buffer is one .RD record long');
  // The route record buffer: which of its words the program names, and where.
  const inside = all.filter(s => s.targetObject === R.object && s.target >= R.base && s.target < R.base + R.recordBytes);
  assert.deepEqual([...new Set(inside.map(s => s.target - R.base))].sort((a, b) => a - b), R.words, 'the words of the record that the program names');
  assert.ok(inside.every(s => s.object === R.siteObject), 'all the references are in the code object');
  assert.equal(Math.min(...inside.map(s => s.offset)), R.firstSite, 'first reference');
  assert.equal(Math.max(...inside.map(s => s.offset)), R.lastSite, 'last reference');
  // The trailer quarter.
  const quarter = all.filter(s => s.targetObject === Q.object && s.target === Q.offset).map(s => ({ object: s.object, offset: s.offset }));
  assert.deepEqual(quarter, Q.sites, 'the references to the trailer quarter');
}

export default {
  id: 'exe-references',
  claims: ['rd.record-references', 'pos.quarter-references'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await sites(ctx), { rd: expected('rd.record-references'), quarter: expected('pos.quarter-references') }); },
  async discriminate(ctx) {
    const all = await sites(ctx), V = { rd: expected('rd.record-references'), quarter: expected('pos.quarter-references') };
    const rd = patch => () => validate(all, { ...V, rd: { ...V.rd, ...patch } }), q = patch => () => validate(all, { ...V, quarter: { ...V.quarter, ...patch } });
    return [
      { label: 'buffer base 2 bytes on', fn: rd({ base: V.rd.base + 2 }) }, // @math the next word
      { label: 'record of 10 bytes', fn: rd({ recordBytes: V.rd.recordBytes - 4 }) }, // @math drops the word at +0x0a
      { label: 'word +8 claimed to be named', fn: rd({ words: [...V.rd.words, 0x08].sort((a, b) => a - b) }) }, // @math the unnamed word
      { label: 'word +0x0c claimed to be named', fn: rd({ words: [...V.rd.words, 0x0c].sort((a, b) => a - b) }) }, // @math the other unnamed word
      { label: 'first reference one byte earlier', fn: rd({ firstSite: V.rd.firstSite - 1 }) },
      { label: 'last reference one byte later', fn: rd({ lastSite: V.rd.lastSite + 1 }) },
      { label: 'references in the data object', fn: rd({ siteObject: V.rd.object }) },
      { label: 'quarter 4 bytes on', fn: q({ offset: V.quarter.offset + 4 }) }, // @math one dword on
      { label: 'two references to the quarter', fn: q({ sites: [...V.quarter.sites, V.quarter.sites[0]] }) },
    ];
  },
};
