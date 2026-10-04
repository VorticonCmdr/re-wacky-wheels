import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { locateLe, objectBytes } from '../../formats/le.js';
import { renameMember } from '../patch.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ e: expected('archive.edition-probe') });
const le32 = (b, i) => b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24; // @math little-endian dword

// The probe's instructions in WW.EXE: mov eax, <name>; the call to the directory lookup; the three stores of the flag and the level.
function code(exe, V, { stores = V.e.stores.flags.map((flag, i) => ({ flag, level: V.e.stores.levels[i] })), lookupFn = V.e.lookupFn } = {}) {
  const E = V.e, { le } = locateLe(exe);
  E.movAt.forEach((at, i) => {
    const b = objectBytes(le, 1, at, 5); // @math mov eax, imm32 is 5 bytes
    assert.equal(b[0], E.movOpcode, 'mov eax, imm32');
    assert.equal(le32(b, 1), E.namesAt[i], `the operand of the load ${i} is the name string`);
  });
  const call = objectBytes(le, 1, E.callAt, 5); // @math a call is 5 bytes long
  assert.equal(call[0], E.callOpcode, 'a near call');
  assert.equal(E.callAt + 5 + le32(call, 1), lookupFn, 'to the directory lookup'); // @math the rel32 operand starts at byte 1
  stores.forEach((s, i) => {
    const b = objectBytes(le, 1, E.stores.at[i], 20); // @math two 10-byte mov dword [mem], imm32 stores
    assert.deepEqual([b[0], b[1], le32(b, 2), le32(b, 6)], [E.storeOpcode[0], E.storeOpcode[1], E.flagAt, s.flag], `store ${i} of the flag`); // @math opcode bytes 0 and 1, the address at byte 2, the value at byte 6
    assert.deepEqual([b[10], b[11], le32(b, 12), le32(b, 16)], [E.storeOpcode[0], E.storeOpcode[1], E.levelAt, s.level], `store ${i} of the level`); // @math the second store follows the first
  });
  const text = (offset, n) => String.fromCharCode(...objectBytes(le, 2, offset, n)); // @math the data object holds the strings
  E.namesAt.forEach((at, i) => assert.equal(text(at, E.names[i].length), E.names[i], `the name string ${i}`));
}

function validate(dat, records, V, { rename = V.e.renameTo } = {}) {
  const E = V.e, members = new Set(parseDatDirectory(dat).map(e => e.name));
  E.names.forEach(n => assert.ok(members.has(n), `the plain archive has ${n}`));
  assert.equal(records.length, E.runs.length, 'the runs');
  records.forEach((r, i) => {
    const run = E.runs[i];
    let used = dat;
    for (const name of run.renamed) used = renameMember(used, name, rename[name]);
    assertArchive(r, used);
    assert.deepEqual([r.flagAt, r.levelAt, r.lookupAt], [E.flagAt, E.levelAt, E.lookupAt], 'the words read');
    assert.deepEqual(r.names, E.names, 'the names the probe looks for');
    assert.deepEqual([r.flag, r.level, r.lookup], [run.flag, run.level, run.lookup], `run ${i}: the flag, the level and the last lookup result`);
    // the result is what the code says: the flag is set when neither name is found, the level counts the editions found
    const found = E.names.map(n => !run.renamed.includes(n));
    assert.equal(run.flag, found.some(Boolean) ? 0 : 1, 'the flag is 1 when no name is found'); // @math flag 0 when found, 1 when neither
    assert.equal(run.level, found[0] ? E.stores.levels[0] : found[1] ? E.stores.levels[1] : E.stores.levels[2], 'the level'); // @math the three stores, in the order of the probe
    assert.equal(run.lookup, found.some(Boolean) ? 1 : 0, 'the last lookup result'); // @math 1 when the last name looked for was found
  });
}

export default {
  id: 'obs-edition',
  claims: ['archive.edition-probe'],
  obs: ['share-1', 'share-3', 'share-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values();
    code(await ctx.open('WW.EXE'), V);
    validate(await ctx.open('WACKY.DAT'), ['share-1', 'share-3', 'share-2'].map(id => ctx.obs(id)), V);
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), exe = await ctx.open('WW.EXE'), recs = ['share-1', 'share-3', 'share-2'].map(id => ctx.obs(id)), V = values(), E = V.e;
    return [
      { label: 'the flag stored 0 where the code stores 1', fn: () => code(exe, V, { stores: E.stores.flags.map((f, i) => ({ flag: 1 - f, level: E.stores.levels[i] })) }) }, // @math the other value
      { label: 'the levels in the other order', fn: () => code(exe, V, { stores: E.stores.flags.map((f, i) => ({ flag: f, level: E.stores.levels[2 - i] })) }) }, // @math reverse the three levels
      { label: 'another lookup function', fn: () => code(exe, V, { lookupFn: E.lookupFn + 1 }) }, // @math the next byte
      { label: 'the runs with the archives swapped', fn: () => validate(dat, [recs[1], recs[0], recs[2]], V) }, // @math swap the first two
      { label: 'the second run\'s flag altered', fn: () => validate(dat, recs.map((r, i) => (i === 1 ? { ...r, flag: 1 } : r)), V) }, // @math the middle run
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), recs, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
