import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ F: expected('demo.fade-observed'), G: expected('gam.layout') });

// The first pauses of dacrace-1 (the demo race of the track 2 from its first intro pass) against the track's palette: each pause holds, for the 13 entries the cycler also writes, the
// colour of the track's first tileset palette cut at one level, a multiple of the step, and the levels never go down.
function levels(dat, r, V, { step = V.F.step, palette = null } = {}) {
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), gam = parseGam(members.get(`${r.track}.GAM`));
  assertArchive(r, dat);
  const pal = palette ?? decodePcxMember(members.get(`${V.F.prefix}${gam.tilesets[0].toUpperCase()}`)).vga, out = [];
  for (const s of r.samples.slice(0, V.F.levels.length)) {
    let found = null;
    for (let level = 0; level <= V.F.max + step; level += step) if (r.entries.every((e, i) => [0, 1, 2].every(k => s.dac[i][k] === Math.min(pal[e * 3 + k], level)))) { found = level; break; } // @math the three components of an entry
    out.push(found);
  }
  return out;
}

function validate(dat, r, V, options) {
  assert.deepEqual(levels(dat, r, V, options), V.F.levels, 'the levels of the first pauses');
}

export default {
  id: 'demo-fade',
  claims: ['demo.fade-observed'],
  obs: ['dacrace-1'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('dacrace-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('dacrace-1'), V = values();
    return [
      { label: 'a step of 3', fn: () => validate(dat, r, V, { step: 3 }) }, // @math a step that is not the game's
      { label: 'a step of 8', fn: () => validate(dat, r, V, { step: 8 }) }, // @math twice the game's step
      { label: 'the palette of another tileset', fn: () => validate(dat, r, V, { palette: Uint8Array.from({ length: 768 }, (_, i) => (i * 7) & 63) }) }, // @math a palette that is not the track's
    ];
  },
};
