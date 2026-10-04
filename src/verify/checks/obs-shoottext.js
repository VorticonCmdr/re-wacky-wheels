import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ t: expected('text.shootout-observed'), glyphs: expected('text.glyphs-observed'), map: expected('text.char-map') });
const ownCrc = (data, at, [w, h]) => { const picked = []; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = data[at + i * h + j]; if (v !== 0) picked.push(v); } return crc(Uint8Array.from(picked)); };

function validate(dat, r, V, { advance = V.t.advance, base = V.map.letterBase } = {}) {
  const T = V.t, of = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(T.member);
  assertArchive(r, dat);
  assert.equal(T.advance, V.glyphs.advance, 'the advance of text.glyphs-observed');
  assert.equal(r.sprites.length, T.strings.reduce((n, [t]) => n + [...t].length, 0) * T.candidates, 'every candidate at every place');
  T.strings.forEach(([text, x, y], n) => [...text].forEach((ch, k) => {
    const hits = r.sprites.filter(s => s.tag.startsWith(`${n}:${k}:`) && s.x === x + advance * k && s.y === y && s.crc === ownCrc(of, s.at, V.glyphs.glyphSize));
    const slot = ch.charCodeAt(0) - base;
    const most = Math.max(...hits.map(s => s.pixels)), best = hits.filter(s => s.pixels === most);
    assert.equal(best.length, 1, `${text} place ${k}: one fitting glyph has the most pixels`);
    assert.equal(best[0].at, V.glyphs.slotBytes * slot, `${text} place ${k} shows ${ch}`);
  }));
}

export default {
  id: 'obs-shoottext',
  claims: ['text.shootout-observed'],
  obs: ['text-6'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('text-6'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('text-6'), V = values();
    return [
      { label: 'an advance of 9', fn: () => validate(dat, r, V, { advance: V.t.advance + 1 }) },
      { label: 'letters from 0x40', fn: () => validate(dat, r, V, { base: V.map.letterBase - 1 }) },
      { label: 'a crc altered', fn: () => validate(dat, { ...r, sprites: r.sprites.map(s => (s.tag === '2:2:14' ? { ...s, crc: '00000000' } : s)) }, V) }, // @math the O of SCORE: string 2, place 2, slot 14
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
