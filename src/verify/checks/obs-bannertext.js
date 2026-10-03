import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ banner: expected('text.banner-observed'), glyphs: expected('text.glyphs-observed'), map: expected('text.char-map') });
const IDS = ['text-2', 'text-3', 'text-4', 'text-5'];
const TOOL_WORDS = [0x84c2, 0x28b9c, 0x28c3c, 0x84f4]; // @math the four words the recording asked for: lap, laps, finish flag, hold flag

const ownCrc = (data, at, [w, h]) => { const picked = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = data[at + i * h + j]; if (v !== 0) picked.push(v); } return crc(Uint8Array.from(picked)); };

// The text the lap routine shows for the words, as read in the report and observed here.
const textFor = (B, lap, total, flag) => (lap >= total ? (flag !== 0 ? 'FINISHED!' : 'LAST LAP!') : `LAP ${lap}`);

function validate(dat, records, V, { digitBase = V.map.digitBase, total = V.banner.total, advance = V.banner.advance } = {}) {
  const B = V.banner, ofont = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(B.member), M = V.map;
  assert.equal(records.length, B.cases.length, 'the records');
  assert.deepEqual([B.member, B.advance, B.x], [V.glyphs.member, V.glyphs.advance, V.glyphs.x], 'the font and advance of text.glyphs-observed');
  assert.equal(B.exclamationSlot, M.punctuation[0x21], 'the exclamation mark slot of text.char-map'); // @math the code of !
  records.forEach((r, k) => {
    assertArchive(r, dat);
    const c = B.cases[k], words = r.words;
    assert.deepEqual(Object.keys(words).map(Number).sort((a, b) => a - b), [...TOOL_WORDS].sort((a, b) => a - b), 'the words read');
    assert.equal(words[B.lapWord], c.lap, 'the lap word');
    assert.equal(words[B.totalWord], total, 'the laps word');
    assert.equal(words[B.finishWord], c.flag, 'the finish flag');
    assert.equal(textFor(B, words[B.lapWord], words[B.totalWord], words[B.finishWord]), c.text, 'the text the words give');
    [...c.text].forEach((ch, p) => {
      const hits = r.sprites.filter(s => s.y === B.y && s.x === B.x + advance * p && s.crc === ownCrc(ofont, s.at, V.glyphs.glyphSize));
      if (ch === ' ') { assert.equal(hits.length, 0, `place ${p}: the space draws nothing`); return; }
      const slot = ch === '!' ? M.punctuation[0x21] : ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - digitBase : ch.charCodeAt(0) - M.letterBase; // @math the digits and letters as text.char-map gives them
      const most = Math.max(...hits.map(s => s.pixels)), best = hits.filter(s => s.pixels === most);
      assert.equal(best.length, 1, `record ${k} place ${p}: one matching slot has the most pixels`);
      assert.equal(best[0].at, V.glyphs.slotBytes * slot, `record ${k} place ${p} shows ${ch}, slot ${slot}`);
    });
    const per = new Set(r.sprites.map(s => s.x)); assert.equal(per.size, [...c.text].length, 'a column of candidates per character');
    assert.equal(r.sprites.length, [...c.text].length * B.candidates, 'every candidate at every place');
  });
}

export default {
  id: 'obs-bannertext',
  claims: ['text.banner-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), B = V.banner;
    return [
      { label: 'digits from the code minus 0x15', fn: () => validate(dat, records, V, { digitBase: V.map.digitBase - 1 }) },
      { label: 'a laps word of 5', fn: () => validate(dat, records, V, { total: B.total - 1 }) },
      { label: 'an advance of 9', fn: () => validate(dat, records, V, { advance: B.advance + 1 }) },
      { label: 'a screen crc altered', fn: () => validate(dat, records.map((r, i) => (i === 2 ? { ...r, sprites: r.sprites.map(s => (s.tag === '2:18' ? { ...s, crc: '00000000' } : s)) } : r)), V) }, // @math the S of LAST at place 2, slot 18
      { label: 'the finish flag altered', fn: () => validate(dat, records.map((r, i) => (i === 3 ? { ...r, words: { ...r.words, [B.finishWord]: 0 } } : r)), V) }, // @math the FINISHED! record
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
