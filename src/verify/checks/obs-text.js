import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ text: expected('text.glyphs-observed'), map: expected('text.char-map') });
const TOOL = { tableAt: 0xa778, entries: 0x3d, slotBytes: 0x40 }; // @math what observe.mjs font reads

// The CRC-32 of a glyph slot's own non-zero pixels in row order, the value a record holds when the screen shows the glyph there.
const ownCrc = (data, at, [w, h]) => { const picked = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = data[at + i * h + j]; if (v !== 0) picked.push(v); } return crc(Uint8Array.from(picked)); };

function validate(dat, font, shot, V, { slot = V.text.slotBytes, base = V.text.letterBase, advance = V.text.advance } = {}) {
  const T = V.text, M = V.map, ofont = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(T.member);
  assertArchive(font, dat); assertArchive(shot, dat);
  assert.deepEqual([T.tableAt, T.entries, T.slotBytes], [TOOL.tableAt, TOOL.entries, TOOL.slotBytes], 'what the tool read');
  assert.deepEqual([T.tableAt, T.advance, T.glyphSize, T.letterBase], [M.tableAt, M.advance, M.glyphSize, M.letterBase], 'text.char-map says the same');
  assert.equal(T.slotBytes, T.glyphSize[0] * T.glyphSize[1], 'a slot is an 8 x 8 glyph'); // @math the glyph's bytes
  assert.equal(font.pointers.length, T.entries);
  font.pointers.forEach((p, k) => {
    assert.equal(p - font.pointers[0], slot * k, `entry ${k} is slot ${k}`);
    assert.equal(font.crcs[k], crc(ofont.subarray(slot * k, slot * k + slot)), `slot ${k} in memory equals the file's block`);
  });
  assert.equal(T.letters, M.letterLast - M.letterBase + 1, 'the 26 letters'); // @math both ends count
  let subsets = 0;
  [...T.text].forEach((ch, k) => {
    const index = ch.charCodeAt(0) - base, hits = shot.sprites.filter(s => s.y === T.y && s.x === T.x + advance * k && s.member === T.member && s.crc === ownCrc(ofont, s.at, T.glyphSize));
    const most = Math.max(...hits.map(s => s.pixels)), best = hits.filter(s => s.pixels === most);
    assert.equal(best.length, 1, `one matching letter has the most pixels at place ${k}`);
    assert.equal(best[0].at, slot * index, `place ${k} shows ${ch}, the slot ${index}`);
    assert.equal(best[0].tag, `${k}:${ch}`, 'tag');
    assert.ok(hits.every(s => s === best[0] || s.pixels < most), 'any other match draws fewer pixels (a subset of the shown glyph)');
    subsets += hits.length - 1;
  });
  assert.equal(shot.sprites.length, T.letters * T.text.length, 'every letter was a candidate at every place');
  assert.equal(subsets, T.subsetMatches, 'the other matches: the I of 22 pixels inside the T of 29');
  assert.equal(M.punctuation[0x21], 0x24, 'the exclamation mark follows the digits and 0x24 is 36'); // @math slot 36
  assert.equal(M.digitBase + M.digitFirst - M.digitFirst, M.digitBase); // @math digit arithmetic as the code does it
  assert.equal(M.digitFirst - M.digitBase, T.letters, 'the digits follow the letters'); // @math 0x30 - 0x16 = 26
  assert.equal(M.digitLast - M.digitBase + 1, 36, 'ten digits end at slot 35'); // @math slot 35, so 36 counts the slots so far
}

export default {
  id: 'obs-text',
  claims: ['text.glyphs-observed'],
  obs: ['font-1', 'text-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('font-1'), ctx.obs('text-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), font = ctx.obs('font-1'), shot = ctx.obs('text-1'), V = values(), T = V.text;
    return [
      { label: 'slots of 0x3f bytes', fn: () => validate(dat, font, shot, V, { slot: T.slotBytes - 1 }) },
      { label: 'letters from 0x40', fn: () => validate(dat, font, shot, V, { base: T.letterBase - 1 }) },
      { label: 'an advance of 9', fn: () => validate(dat, font, shot, V, { advance: T.advance + 1 }) },
      { label: 'a pointer altered', fn: () => validate(dat, { ...font, pointers: font.pointers.map((p, k) => (k === 7 ? p + 1 : p)) }, shot, V) }, // @math the eighth slot
      { label: 'a glyph altered', fn: () => validate(dat, { ...font, crcs: font.crcs.map((c, k) => (k === 7 ? '00000000' : c)) }, shot, V) }, // @math the eighth slot
      { label: 'a screen crc altered', fn: () => validate(dat, font, { ...shot, sprites: shot.sprites.map(s => (s.tag === '2:G' ? { ...s, crc: '00000000' } : s)) }, V) },
      { label: 'a different number of subset matches', fn: () => validate(dat, font, shot, { ...V, text: { ...T, subsetMatches: T.subsetMatches + 1 } }) },
      { label: 'the text TIGH', fn: () => validate(dat, font, shot, { ...V, text: { ...T, text: 'TIGH' } }) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), font, shot, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
