import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ boot: expected('boot.pictures-observed'), pcx: expected('pcx.layout') });

// The CRC-32 of every full-screen picture of the archive, as the indexes the screen holds; pictures with the same CRC are not usable.
function pictures(dat, B, names) {
  const out = new Map(), dup = new Set(); let count = 0;
  for (const e of parseDatDirectory(dat)) {
    if (!e.name.endsWith('.PCX')) continue;
    let img; try { img = decodePcxMember(e.data); } catch { continue; }
    if (img.width !== B.width || img.height !== B.height) continue;
    count++;
    const c = crc(img.indices); if (out.has(c)) dup.add(c); out.set(c, e.name);
  }
  void names;
  return { out, dup, count };
}

function validate(dat, r, V, { order = V.boot.order, matches = V.boot.matches } = {}) {
  const B = V.boot;
  assertArchive(r, dat);
  assert.equal(r.samples.length, B.samples, 'the samples');
  assert.deepEqual(r.taps, B.taps, 'the Enter taps');
  const { out, dup, count } = pictures(dat, B);
  assert.equal(count, B.fullScreenPictures, 'the full-screen pictures of the archive');
  const seen = {};
  for (const [seconds, chain4, , hash] of r.samples) {
    void chain4;
    if (out.has(hash)) { assert.ok(!dup.has(hash), 'the match is unique'); (seen[out.get(hash)] ??= []).push(seconds); }
  }
  assert.deepEqual(seen, matches, 'the pictures seen and when');
  const first = Object.entries(seen).map(([name, times]) => [times[0], name]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  assert.deepEqual(first, order, 'the order in which they first appear');
}

export default {
  id: 'obs-boot',
  claims: ['boot.pictures-observed'],
  obs: ['boot-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('boot-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('boot-1'), V = values(), B = V.boot, b = patch => ({ boot: { ...B, ...patch } });
    return [
      { label: 'a different order', fn: () => validate(dat, r, V, { order: ['BEAVIS.PCX', 'APOG1.PCX', 'WINTRO.PCX'] }) },
      { label: 'a picture missing', fn: () => validate(dat, r, V, { matches: { 'APOG1.PCX': B.matches['APOG1.PCX'], 'BEAVIS.PCX': B.matches['BEAVIS.PCX'] } }) },
      { label: 'a later first time', fn: () => validate(dat, r, V, { matches: { ...B.matches, 'APOG1.PCX': [15.4] } }) }, // @math the next sample
      { label: 'a picture of 321 columns', fn: () => validate(dat, r, b({ width: B.width + 1 })) },
      { label: 'a sample altered', fn: () => validate(dat, { ...r, samples: r.samples.map(x => (x[0] === B.matches['BEAVIS.PCX'][0] ? [x[0], x[1], x[2], '00000000', x[4]] : x)) }, V) }, // @math the sample record is [seconds, mode, start, crc, flag]
      { label: 'one more full-screen picture', fn: () => validate(dat, r, b({ fullScreenPictures: B.fullScreenPictures + 1 })) },
      { label: 'an extra tap', fn: () => validate(dat, r, b({ taps: [...B.taps, 55] })) }, // @math another tap
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
