import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ p: expected('palette.cycle-observed'), gam: expected('gam.layout') });

function validate(dat, r, V, { minChanges = V.p.minChanges } = {}) {
  const P = V.p, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), gam = parseGam(members.get(`${r.track}.GAM`)), beach = decodePcxMember(members.get(P.palette));
  assertArchive(r, dat);
  assert.deepEqual([r.track, r.from, r.to, r.samples.length], [P.track, P.from, P.to, P.samples], 'the record');
  assert.equal(gam.flag, 1, 'the track has the cycling flag');
  assert.deepEqual(gam.extra, P.delays, 'and the delays');
  const colours = new Set(Array.from({ length: 256 }, (_, i) => [beach.vga[i * 3], beach.vga[i * 3 + 1], beach.vga[i * 3 + 2]].join())); // @math 256 palette entries of 3 bytes
  const changes = new Map();
  r.samples.forEach((s, n) => {
    assert.equal(s.dac.length, P.to - P.from + 1, 'the entries of a sample'); // @math both ends count
    if (n === 0) return;
    s.dac.forEach((c, k) => { if (c.join() !== r.samples[n - 1].dac[k].join()) changes.set(P.from + k, (changes.get(P.from + k) ?? 0) + 1); });
  });
  assert.deepEqual([...changes.keys()].sort((a, b) => a - b), P.changing, 'exactly these entries change');
  assert.equal(P.to - P.from + 1 - P.changing.length, P.stable, 'the others are stable');
  assert.equal(Math.min(...changes.values()), minChanges, 'the least often changing entry changes this many times (the times depend on the sampling)');
  for (const s of r.samples) for (const e of P.changing) assert.ok(colours.has(s.dac[e - P.from].join()), `entry ${e}: a colour of the palette of BEACH.PCX`);
  const base = r.samples[0], back = r.samples.filter(s => P.groupA.every(e => s.dac[e - P.from].join() === base.dac[e - P.from].join())).map(s => s.tick);
  assert.deepEqual(P.groupA, P.changing.slice(0, P.groupA.length), 'the group is the first of the changing entries');
  assert.deepEqual(back, P.returnTicks, 'the group of 148 and 161 to 164 returns to its first colours at these ticks');
}

export default {
  id: 'obs-dac',
  claims: ['palette.cycle-observed'],
  obs: ['dac-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('dac-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('dac-1'), V = values(), P = V.p;
    return [
      { label: 'changes of at least 30', fn: () => validate(dat, r, V, { minChanges: 30 }) }, // @math more than any entry changes
      { label: 'a colour altered', fn: () => validate(dat, { ...r, samples: r.samples.map((s, n) => (n === 5 ? { ...s, dac: s.dac.map((c, k) => (k === 20 ? [c[0] ^ 1, c[1], c[2]] : c)) } : s)) }, V) }, // @math entry 164 at a sample in the middle
      { label: 'a stable entry altered', fn: () => validate(dat, { ...r, samples: r.samples.map((s, n) => (n === 5 ? { ...s, dac: s.dac.map((c, k) => (k === 0 ? [c[0] ^ 1, c[1], c[2]] : c)) } : s)) }, V) }, // @math entry 144
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
