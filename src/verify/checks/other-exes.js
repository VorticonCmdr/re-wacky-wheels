import assert from 'node:assert/strict';
import { locateLe } from '../../formats/le.js';
import { parseMzHeaderWith } from '../../formats/mz.js';
import { expected } from '../expect.js';

function leFacts(exe) {
  const { le, overlay, candidates } = locateLe(exe);
  return { size: exe.length, mz: le.mz, header: le.header, pages: le.pages, lastPageSize: le.lastPageSize, overlay, eip: le.eip, esp: le.esp,
    objects: le.objects.map(({ base, virtualSize, flags, pageIndex, pageCount }) => ({ base, virtualSize, flags, pageIndex, pageCount })), candidates };
}

function wwhelpFacts(exe, offsets) {
  assert.equal(new Set(String.fromCharCode(...exe.subarray(0, 2))).size, 2, 'MZ signature'); // @math the signature is two distinct letters
  const secondMz = Buffer.from(exe.buffer, exe.byteOffset, exe.length).indexOf('MZ', 2); // @math search after the first signature
  assert.throws(() => locateLe(exe), /found 0/, 'WWHELP.EXE has no LE program');
  return { size: exe.length, fields: parseMzHeaderWith(exe, offsets), secondMz };
}

export default {
  id: 'other-exes',
  claims: ['mz.dos-header', 'wwhelp.exe.mz', 'setup.exe.layout', 'manual.exe.layout', 'dos4g.stub-header'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    for (const [file, id] of [['SETUP.EXE', 'setup.exe.layout'], ['MANUAL.EXE', 'manual.exe.layout']]) {
      const { candidates, ...facts } = leFacts(await ctx.open(file));
      assert.deepEqual(facts, expected(id), file);
      assert.ok(candidates.filter(c => !c.le).length > 0, `${file}: other MZ signatures exist and are rejected`);
    }
    assert.deepEqual(wwhelpFacts(await ctx.open('WWHELP.EXE'), expected('mz.dos-header')), expected('wwhelp.exe.mz'));
    // The DOS/4G stub header is the same in all three LE programs, and a header with no relocations ends at the fixed header size.
    const O = expected('mz.dos-header'), stub = expected('dos4g.stub-header');
    for (const file of ['WW.EXE', 'SETUP.EXE', 'MANUAL.EXE']) assert.deepEqual(parseMzHeaderWith(await ctx.open(file), O), stub, file);
    assert.equal(expected('wwhelp.exe.mz').fields.relocTable, O.size, 'WWHELP\'s relocation table starts right after the fixed header');
    // SETUP.EXE is bound with the same stub as WW.EXE.
    assert.equal(expected('setup.exe.layout').mz, expected('ww.exe.layout').mz);
    assert.equal(expected('setup.exe.layout').header, expected('ww.exe.layout').header);
  },
  // Another MZ as the program start, other header offsets and other file sizes must not match.
  async discriminate(ctx) {
    const setup = await ctx.open('SETUP.EXE'), manual = await ctx.open('MANUAL.EXE'), help = await ctx.open('WWHELP.EXE'), S = expected('setup.exe.layout'), M = expected('manual.exe.layout'), O = expected('mz.dos-header');
    return [
      { label: 'SETUP at the MANUAL stub offset', fn: () => assert.equal(leFacts(setup).mz, M.mz) },
      { label: 'MANUAL without its overlay', fn: () => assert.equal(leFacts(manual).overlay, 0) }, // @math alternative: no trailing data
      { label: 'SETUP with an overlay', fn: () => assert.equal(leFacts(setup).overlay, M.overlay) },
      { label: 'WWHELP header fields shifted by 2', fn: () => assert.deepEqual(wwhelpFacts(help, Object.fromEntries(Object.entries(O).map(([k, v]) => [k, k === 'size' ? v : v + 2]))).fields, expected('wwhelp.exe.mz').fields) }, // @math each field one word later
      { label: 'WWHELP as an LE program', fn: () => leFacts(help) },
      { label: 'SETUP pages', fn: () => assert.equal(leFacts(setup).pages, S.pages + 1) }, // @math one page more
      { label: 'stub header read at WWHELP offsets shifted', fn: () => assert.deepEqual(parseMzHeaderWith(setup, Object.fromEntries(Object.entries(O).map(([k, v]) => [k, k === 'size' ? v : v + 2]))), expected('dos4g.stub-header')) }, // @math each field one word later
    ];
  },
};
