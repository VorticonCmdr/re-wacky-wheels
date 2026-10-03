import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { crc, assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ upload: expected('par.upload') });

// The bytes the file would put in plane `p` under a layout: byte 4k+p for the interleaved layout, with two wrong ones for the discriminators.
function planeBytes(par, V, p, order) {
  const per = V.bytes / V.planes, out = new Uint8Array(per);
  for (let k = 0; k < per; k++) out[k] = order === 'blocked' ? par[p * per + k] : order === 'reversed' ? par[V.planes * k + (V.planes - 1 - p)] : par[V.planes * k + p];
  return out;
}

// Cross-validate a `vram` record: video memory at the claimed offset holds the track's .PAR bytes, one plane at a time.
function validate(dat, record, V, order = 'interleaved') {
  assertArchive(record, dat);
  const U = V.upload, par = parseDatDirectory(dat).find(e => e.name === `${record.names.track}.PAR`)?.data;
  assert.ok(par, 'the loaded track\'s .PAR is an archive member');
  assert.equal(par.length, U.bytes, 'the file is as long as the routine copies');
  assert.equal(record.bytes, U.bytes);
  assert.equal(record.vramOffset, U.vramOffset);
  assert.equal(record.pointerOffset, U.pointerOffset);
  assert.equal(record.planes, U.planes);
  assert.equal(record.planeCrcs.length, U.planes);
  record.planeCrcs.forEach((live, p) => assert.equal(live, crc(planeBytes(par, U, p, order)), `plane ${p} holds the file's bytes in ${order} order`));
  assert.equal(new Set(record.planeCrcs).size, U.planes, 'the planes are different from each other, so the match tells them apart');
}

export default {
  id: 'obs-vram',
  claims: ['par.upload'],
  obs: ['vram-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('vram-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('vram-1'), V = values();
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { upload: { ...V.upload, ...patch } }) });
    return [
      { label: 'contiguous quarters instead of interleaving', fn: () => validate(dat, record, V, 'blocked') },
      { label: 'planes in reverse order', fn: () => validate(dat, record, V, 'reversed') },
      tweak('2 planes', { planes: V.upload.planes / 2 }), // @math half the planes
      tweak('8 planes', { planes: V.upload.planes * 2 }), // @math double the planes
      tweak(`${V.upload.bytes - 4} bytes`, { bytes: V.upload.bytes - 4 }), // @math one byte per plane fewer
      tweak('video offset 0x7d04', { vramOffset: V.upload.vramOffset + 4 }), // @math one address on
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
