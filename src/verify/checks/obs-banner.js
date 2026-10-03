import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ banner: expected('hud.banner-observed'), place: expected('hud.place-speed-observed') });
const IDS = ['banner-1', 'banner-2', 'banner-3', 'banner-4'];
const TOOL = { counterAWord: 0x847a, counterBWord: 0x847c }; // @math the words observe.mjs reads as hud.counterA and hud.counterB

// The CRC-32 of the sprite's own non-zero pixels in row order, leaving out the rectangle: the value of a record whose screen shows the sprite there.
function ownCrc(data, at, [w, h], [x, y], rect) {
  const picked = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = data[at + i * h + j];
    if (v === 0) continue;
    const px = x + i, py = y + j;
    if (rect && px >= rect[0] && px < rect[0] + rect[2] && py >= rect[1] && py < rect[1] + rect[3]) continue; // @math the rectangle's x, y, width and height
    picked.push(v);
  }
  return { crc: crc(Uint8Array.from(picked)), pixels: picked.length };
}

function validate(dat, records, V, { digitsAt = V.banner.digitsAt, pictureAt = V.banner.pictures.map(p => p.at), pad = 2 } = {}) { // @math two places
  const B = V.banner, lap = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('LAP.SP');
  assert.equal(records.length, B.records, 'the records');
  assert.deepEqual([B.counterWord, B.startWord], [TOOL.counterAWord, TOOL.counterBWord], 'the words the tool read');
  assert.deepEqual(B.digitSize, [10, 9], 'the digit glyphs are 10 x 9'); // @math the glyph size of the report and the code
  assert.equal(B.digitSize[0] * B.digitSize[1], B.digitBytes, 'a glyph is 90 bytes');
  assert.equal(B.pictures[0].exclude.join(), V.place.placeRect.join(), 'the panel leaves out the place digit rectangle of hud.place-speed-observed');
  assert.deepEqual(B.counters.map(String), ['7', '0', '42', '99'], 'the counters set'); // @math the four values the tool wrote, as text
  const digitCrc = d => ownCrc(lap, digitsAt + B.digitBytes * d, B.digitSize, [0, 0], null).crc;
  assert.equal(new Set(Array.from({ length: 10 }, (_, d) => digitCrc(d))).size, 10, 'the ten glyphs differ'); // @math ten digits
  records.forEach((r, k) => {
    assertArchive(r, dat);
    B.pictures.forEach((p, n) => {
      const want = ownCrc(lap, pictureAt[n], p.size, p.where, p.exclude), got = r.sprites.find(s => s.tag === ['panel', 'laps', 'count'][n]); // @math the three tags of the tool
      assert.ok(got, `record ${k}: picture ${n} recorded`);
      assert.deepEqual([got.member, got.at, got.w, got.h, got.x, got.y, got.exclude], ['LAP.SP', pictureAt[n], ...p.size, ...p.where, [p.exclude]], `record ${k}: picture ${n} is the one the claim names`);
      assert.equal(got.crc, want.crc, `record ${k}: the screen shows picture ${n} apart from the digit box`);
      assert.equal(got.pixels, want.pixels, `record ${k}: the pixel count of picture ${n}`);
    });
    const shownAt = (place, x) => { const hits = []; for (let d = 0; d < 10; d++) { /* @math ten digits */ const s = r.sprites.find(q => q.tag === `${place}:${d}`); assert.ok(s, 'glyph recorded'); assert.equal(s.x, x); assert.equal(s.y, B.row); if (s.crc === digitCrc(d)) hits.push(d); } assert.equal(hits.length, 1, `record ${k}: exactly one glyph at ${x}`); return hits[0]; };
    const counter = shownAt('t', B.counterPlaces[0]) * 10 + shownAt('u', B.counterPlaces[1]); // @math the tens glyph first, then the units
    assert.equal(String(counter).padStart(pad, '0'), String(B.counters[k]).padStart(2, '0'), `record ${k}: the counter shows the set value`); // @math two places
    assert.equal(r.hud.counterA, B.counters[k], `record ${k}: the HUD word is the value set on the car`);
    assert.equal(shownAt('a', B.startDigit[0]), B.startDigitShown, `record ${k}: the single digit shows the start value`);
    assert.equal(r.hud.counterB, B.overwrittenWord, `record ${k}: the word under the single digit was overwritten`);
    assert.notEqual(B.overwrittenWord, B.startDigitShown, 'so the digit is not read from the word each frame');
  });
}

export default {
  id: 'obs-banner',
  claims: ['hud.banner-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), B = V.banner;
    return [
      { label: 'glyph table one glyph on', fn: () => validate(dat, records, V, { digitsAt: B.digitsAt + B.digitBytes }) },
      { label: 'glyph table one byte on', fn: () => validate(dat, records, V, { digitsAt: B.digitsAt + 1 }) }, // @math one byte
      { label: 'the report\'s 16 bytes higher panel', fn: () => validate(dat, records, V, { pictureAt: [B.pictures[0].at + 16, B.pictures[1].at, B.pictures[2].at] }) }, // @math the report's offset error
      { label: 'the report\'s 16 bytes higher label', fn: () => validate(dat, records, V, { pictureAt: [B.pictures[0].at, B.pictures[1].at + 16, B.pictures[2].at] }) }, // @math the report's offset error
      { label: 'the report\'s 16 bytes higher count label', fn: () => validate(dat, records, V, { pictureAt: [B.pictures[0].at, B.pictures[1].at, B.pictures[2].at + 16] }) }, // @math the report's offset error
      { label: 'three places', fn: () => validate(dat, records, V, { pad: 3 }) }, // @math three places
      { label: 'a counter altered', fn: () => validate(dat, records.map((r, i) => (i === 2 ? { ...r, hud: { ...r.hud, counterA: r.hud.counterA + 1 } } : r)), V) }, // @math the third record
      { label: 'a glyph altered', fn: () => validate(dat, records.map((r, i) => (i === 0 ? { ...r, sprites: r.sprites.map(s => (s.tag === 'u:7' ? { ...s, crc: '00000000' } : s)) } : r)), V) }, // @math the units digit of the first record, 7
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
