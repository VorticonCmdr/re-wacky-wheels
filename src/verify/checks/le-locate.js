import assert from 'node:assert/strict';
import { locateLe, parseLe } from '../../formats/le.js';
import { expected } from '../expect.js';

export default {
  id: 'le-locate',
  claims: ['mz.header', 'le.header', 'ww.exe.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const exe = await ctx.open('WW.EXE'), want = expected('ww.exe.layout');
    assert.equal(exe.length, want.size);
    const { le } = locateLe(exe);
    assert.equal(le.mz, want.mz);
    assert.equal(le.header, want.header);
    assert.equal(le.cpu, want.cpu);
    assert.equal(le.os, want.os);
  },
  // Every other MZ signature in the file, and the LE header itself, must fail as a base.
  async discriminate(ctx) {
    const exe = await ctx.open('WW.EXE'), want = expected('ww.exe.layout'), { candidates } = locateLe(exe);
    const others = candidates.filter(c => c.at !== want.mz);
    assert.ok(others.length > 0, 'no competing MZ signatures to discriminate against');
    return [
      ...others.map(c => ({ label: `MZ at ${c.at}`, fn: () => { if (c.reason) throw new Error(c.reason); } })),
      { label: `LE header ${want.header} as base`, fn: () => parseLe(exe, want.header) },
    ];
  },
};
