import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { parseGam } from '../../formats/gam.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ p: expected('race.palette'), gam: expected('gam.read') });

function validate(dat, r, V, { source = 'tileset' } = {}) {
  const P = V.p, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assertArchive(r, dat);
  assert.equal(r.track, P.track, 'the track');
  assert.deepEqual([r.from, r.to, r.samples[0].dac.length], [0, P.entries - 1, P.entries], 'all the entries'); // @math the last entry of 256
  const gam = parseGam(members.get(`${r.track}.GAM`));
  const pic = source === 'tileset' ? V.gam.prefix + gam.tilesets[0].toUpperCase() : source === 'sky' ? gam.sky.toUpperCase() : V.gam.prefix + gam.masks[0].toUpperCase();
  const vga = decodePcxMember(members.get(pic)).vga, dac = r.samples[0].dac;
  const equal = dac.filter((rgb, e) => rgb.every((v, k) => v === vga[e * 3 + k])).length; // @math three components an entry
  assert.equal(equal, P.entries, `all ${P.entries} entries equal the ${source} picture ${pic}`);
  if (P.sameAsSecond && source === 'tileset') {
    const second = decodePcxMember(members.get(V.gam.prefix + gam.tilesets[1].toUpperCase())).vga;
    assert.deepEqual([...second], [...vga], 'the second tileset has the same palette'); // @math the second of the two tilesets
  }
}

export default {
  id: 'obs-racepalette',
  claims: ['race.palette'],
  obs: ['dac-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('dac-2'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('dac-2'), V = values();
    return [
      { label: 'the sky picture', fn: () => validate(dat, r, V, { source: 'sky' }) },
      { label: 'the mask picture', fn: () => validate(dat, r, V, { source: 'mask' }) },
      { label: 'a DAC value altered', fn: () => validate(dat, { ...r, samples: [{ ...r.samples[0], dac: r.samples[0].dac.map((c, e) => (e === 100 ? [c[0] ^ 1, c[1], c[2]] : c)) }] }, V) }, // @math entry 100
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
