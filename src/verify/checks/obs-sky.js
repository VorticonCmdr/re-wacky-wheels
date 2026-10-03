import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { parseGam } from '../../formats/gam.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ sky: expected('sky.static-observed') });
const IDS = ['sky-1', 'sky-2', 'sky-3', 'sky-4', 'sky-5'];
const TOOL_RECT = [52, 109, 80, 319]; // @math the rectangle observe.mjs hashed: first row, last row, first column, last column

function validate(dat, records, V, { shift = 0, member } = {}) {
  const K = V.sky, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assert.equal(records.length, K.frames, 'the frames');
  assert.deepEqual(K.rect, TOOL_RECT, 'the rectangle the tool hashed');
  assert.equal(K.rows, K.rect[1] - K.rect[0] + 1, 'the rows'); // @math both ends count
  assert.deepEqual(records.map(r => r.sky.heading), K.headings, 'the headings');
  assert.equal(new Set(K.headings).size, K.headings.length, 'five different headings');
  for (const r of records) {
    assertArchive(r, dat);
    assert.deepEqual(r.sky.rect, K.rect, 'the recorded rectangle');
    const g = parseGam(members.get(`${r.sky.track}.GAM`)), name = (member ?? g.sky).toUpperCase();
    assert.equal(name, K.member, 'the sky picture of the track');
    const img = decodePcxMember(members.get(name));
    assert.equal(img.width, K.width, 'the picture is 320 wide');
    assert.equal(r.sky.rows.length, K.rows, 'a CRC for each row');
    for (let y = K.rect[0]; y <= K.rect[1]; y++) {
      const [, , c0, c1] = K.rect, from = y * img.width + c0 + shift;
      assert.equal(r.sky.rows[y - K.rect[0]], crc(img.indices.subarray(from, from + c1 - c0 + 1)), `row ${y} equals the picture's`); // @math both ends count
    }
  }
}

export default {
  id: 'obs-sky',
  claims: ['sky.static-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), K = V.sky;
    return [
      { label: 'the picture shifted one column', fn: () => validate(dat, records, V, { shift: 1 }) }, // @math one column
      { label: 'another sky picture', fn: () => validate(dat, records, V, { member: 'BACK2.PCX' }) },
      { label: 'a row altered', fn: () => validate(dat, records.map((r, i) => (i === 0 ? { ...r, sky: { ...r.sky, rows: r.sky.rows.map((c, k) => (k === 0 ? '00000000' : c)) } } : r)), V) },
      { label: 'a rectangle one row taller', fn: () => validate(dat, records, { sky: { ...K, rect: [K.rect[0], K.rect[1] + 1, ...K.rect.slice(2)] } }) }, // @math the last two rect fields
      { label: 'a different heading list', fn: () => validate(dat, records, { sky: { ...K, headings: [...K.headings.slice(1), K.headings[0]] } }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
