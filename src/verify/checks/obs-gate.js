import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ gate: expected('audio.device-gate-run'), static: expected('audio.device-gate'), mode: expected('audio.mode-select') });

// Cross-validate a `gate` record (execute breakpoints armed in protected mode, read at the stop on the error stub that ended the run).
function validate(dat, record, run, V) {
  const G = V.gate;
  assertArchive(record, dat);
  assert.equal(record.selector, G.selector, 'the breakpoints were armed in the game\'s flat code segment');
  assert.deepEqual(G.sites, [G.loader, G.bankRoutine, G.check, G.checkError, G.init, G.initError], 'the six sites, in address order');
  assert.deepEqual(record.breakpoints.map(b => b[0]), G.sites, 'the record watched the six sites');
  assert.equal(G.check, V.static.checkRoutine, 'the check routine of audio.device-gate');
  assert.equal(G.init, V.static.initRoutine, 'the init routine of audio.device-gate');
  assert.equal(G.checkError, V.static.checkError);
  assert.equal(G.initError, V.static.initError);
  assert.equal(G.loader, V.mode.loaderRoutine, 'the bank loader called from the routine of audio.mode-select');
  assert.equal(G.bankRoutine, V.mode.bankRoutine, 'the routine with the mode test of audio.mode-select');
  assert.deepEqual(record.words.mode, [V.mode.modeAt, run.mode], 'the sound-mode word holds the mode of the run');
  assert.deepEqual(record.words.device, [G.deviceAt, run.mode], 'the library\'s device word equals it');
  assert.equal(record.stoppedAt, run.stop, 'the run ended at the error stub');
  assert.deepEqual(record.breakpoints.map(b => b[1]), run.hits, 'how often each site ran');
  assert.ok(run.hits[1] === 0 && run.hits[0] === 0, 'neither the bank-load routine nor the loader ran'); // @math indexes of the loader and the bank routine in the sorted site list
}

export default {
  id: 'obs-gate',
  claims: ['audio.device-gate-run'],
  obs: ['gate-2', 'gate-3'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    validate(dat, ctx.obs('gate-2'), V.gate.run2, V);
    validate(dat, ctx.obs('gate-3'), V.gate.run3, V);
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r2 = ctx.obs('gate-2'), r3 = ctx.obs('gate-3'), G = V.gate;
    const g = patch => ({ ...V, gate: { ...G, ...patch } });
    return [
      { label: 'mode-2 record against the mode-3 run', fn: () => validate(dat, r2, G.run3, V) },
      { label: 'mode-3 record against the mode-2 run', fn: () => validate(dat, r3, G.run2, V) },
      { label: 'the init ran in the mode-2 run', fn: () => validate(dat, r2, { ...G.run2, hits: G.run3.hits }, V) },
      { label: 'the bank routine ran', fn: () => validate(dat, r3, { ...G.run3, hits: G.run3.hits.map((h, i) => (i === 1 ? 1 : h)) }, V) }, // @math the bank routine is index 1 of the sorted sites
      { label: 'stub of the other run', fn: () => validate(dat, r3, { ...G.run3, stop: G.checkError }, V) },
      { label: 'selector 0x188', fn: () => validate(dat, r2, G.run2, g({ selector: G.selector + 8 })) }, // @math the next descriptor
      { label: 'check site one byte on', fn: () => validate(dat, r2, G.run2, g({ check: G.check + 1, sites: G.sites.map(s => (s === G.check ? s + 1 : s)) })) },
    ];
  },
};
