import assert from 'node:assert/strict';
import { archiveMembers } from '../../game/track-data.js';
import { loadHudArt, renderHud } from '../../render/hud.js';
import { slotOf } from '../../render/text.js';
import { counterDigits, lapText } from '../../game/hud.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const BANNER_IDS = ['banner-1', 'banner-2', 'banner-3', 'banner-4'], NAME_ID = 'text-1', LAP_IDS = ['text-2', 'text-3', 'text-4', 'text-5'];
const values = () => ({ banner: expected('hud.banner-observed'), glyphs: expected('text.glyphs-observed'), laptext: expected('text.banner-observed'), map: expected('text.char-map') });
const SCREEN = { width: 320, height: 200 }; // @math the mode 13h screen the observations read

// A buffer filled with one colour none of the drawn pictures uses, so a missing, shifted or wrongly chosen picture shows.
function blank(art, V) {
  const B = V.banner, used = new Set([...art.lap.subarray(B.pictures[0].at, B.digitsAt + 10 * B.digitBytes), ...art.ofont]); // @math ten digit pictures
  const free = Array.from({ length: 255 }, (_, i) => i + 1).find(v => !used.has(v)); // @math the colours 1 to 255
  assert.notEqual(free, undefined, 'a colour the pictures do not use');
  return new Uint8Array(SCREEN.width * SCREEN.height).fill(free);
}

// The screen's values under a frame's non-zero pixels in row order (a record's CRC is over these), leaving out `rect`.
function under(fb, data, at, [w, h], [x, y], rect) {
  const picked = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (data[at + i * h + j] === 0) continue;
    const px = x + i, py = y + j;
    if (rect && px >= rect[0] && px < rect[0] + rect[2] && py >= rect[1] && py < rect[1] + rect[3]) continue; // @math x, y, width and height of the rectangle
    picked.push(fb[py * SCREEN.width + px]);
  }
  return { crc: crc(Uint8Array.from(picked)), pixels: picked.length };
}

// The top banner for the counter values the records set: the three pictures apart from the digit boxes, and the glyph that the port draws at each digit place.
function replayBanner(dat, records, V, { counters = V.banner.counters } = {}) {
  const B = V.banner, art = loadHudArt(archiveMembers(dat));
  assert.equal(records.length, B.records, 'the records');
  records.forEach((r, k) => {
    assertArchive(r, dat);
    const fb = blank(art, V);
    renderHud(fb, art, { banner: counterDigits(counters[k]) });
    B.pictures.forEach((p, n) => {
      const got = r.sprites.find(s => s.tag === ['panel', 'laps', 'count'][n]); // @math the three tags of the tool
      assert.ok(got, `record ${k}: picture ${n} recorded`);
      assert.deepEqual([got.at, got.x, got.y], [p.at, ...p.where], `record ${k}: picture ${n} is where the claim has it`);
      assert.deepEqual(under(fb, art.lap, p.at, p.size, p.where, p.exclude), { crc: got.crc, pixels: got.pixels }, `record ${k}: the port's picture ${n} equals the screen apart from the digit box`);
    });
    const [tens, units] = counterDigits(counters[k]), shown = [['a', B.startDigit[0], B.startDigitShown], ['t', B.counterPlaces[0], tens], ['u', B.counterPlaces[1], units]]; // @math the tags of the single digit, the tens and the units
    for (const [place, x, d] of shown) {
      const s = r.sprites.find(q => q.tag === `${place}:${d}`);
      assert.ok(s, `record ${k}: the glyph ${d} at ${x} is in the record`);
      assert.deepEqual([s.at, s.x, s.y], [B.digitsAt + B.digitBytes * d, x, B.row], `record ${k}: the glyph entry`);
      assert.equal(under(fb, art.lap, s.at, B.digitSize, [x, B.row], null).crc, s.crc, `record ${k}: the port's glyph ${d} at ${x} equals the screen`);
    }
    assert.equal(r.hud.counterA, B.counters[k], `record ${k}: the car's counter word is what the page shows`);
  });
}

// The glyphs of a text drawn at (x, y): for every character that has a slot, the screen under the glyph's pixels equals the port's.
function glyphsMatch(fb, art, r, text, x, y, V, { advance = V.glyphs.advance } = {}) {
  const G = V.glyphs;
  [...text].forEach((ch, p) => {
    const slot = slotOf(ch);
    if (slot === null) return;
    const s = r.sprites.find(q => q.x === x + advance * p && q.y === y && q.at === G.slotBytes * slot);
    assert.ok(s, `${r.id}: the glyph of ${ch} at place ${p} is in the record`);
    assert.equal(under(fb, art.ofont, s.at, G.glyphSize, [s.x, s.y], null).crc, s.crc, `${r.id}: the port's ${ch} at place ${p} equals the screen`);
  });
}

// The driver's name under the place panel (record text-1) and the lap text at the bottom left (text-2 to text-5, from the lap, laps and flag words).
function replayText(dat, name, laps, V, { total = V.laptext.total, advance } = {}) {
  const art = loadHudArt(archiveMembers(dat)), L = V.laptext;
  assertArchive(name, dat);
  const fb = blank(art, V);
  renderHud(fb, art, { name: true });
  glyphsMatch(fb, art, name, V.glyphs.text, V.glyphs.x, V.glyphs.y, V, { advance });
  assert.equal(laps.length, L.cases.length, 'the records');
  laps.forEach((r, k) => {
    assertArchive(r, dat);
    const c = L.cases[k], words = r.words;
    assert.deepEqual([words[L.lapWord], words[L.totalWord], words[L.finishWord]], [c.lap, L.total, c.flag], 'the words the record read');
    const text = lapText(words[L.lapWord], total, words[L.finishWord] !== 0), at = blank(art, V);
    assert.equal(text, c.text, `${r.id}: the text the words give`);
    renderHud(at, art, { lap: text });
    glyphsMatch(at, art, r, text, L.x, L.y, V, { advance });
  });
}

export default {
  id: 'port-banner',
  claims: ['hud.banner-observed', 'text.glyphs-observed', 'text.banner-observed'],
  obs: [...BANNER_IDS, NAME_ID, ...LAP_IDS],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    assert.equal(V.glyphs.advance, V.laptext.advance, 'one advance for the font');
    replayBanner(dat, BANNER_IDS.map(id => ctx.obs(id)), V);
    replayText(dat, ctx.obs(NAME_ID), LAP_IDS.map(id => ctx.obs(id)), V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), banner = BANNER_IDS.map(id => ctx.obs(id)), name = ctx.obs(NAME_ID), laps = LAP_IDS.map(id => ctx.obs(id));
    const editSprites = (records, i, tag, crcValue) => records.map((r, k) => (k === i ? { ...r, sprites: r.sprites.map(s => (s.tag === tag ? { ...s, crc: crcValue } : s)) } : r));
    return [
      { label: 'a counter one too high', fn: () => replayBanner(dat, banner, V, { counters: V.banner.counters.map((c, i) => (i === 2 ? c + 1 : c)) }) }, // @math the third record
      { label: 'the counter digits swapped', fn: () => replayBanner(dat, banner, V, { counters: V.banner.counters.map((c, i) => (i === 2 ? (c % 10) * 10 + Math.floor(c / 10) : c)) }) }, // @math the third record, 42 as 24
      { label: 'a recorded picture CRC altered', fn: () => replayBanner(dat, editSprites(banner, 1, 'laps', '00000000'), V) }, // @math the second record
      { label: 'a recorded glyph CRC altered', fn: () => replayBanner(dat, editSprites(banner, 0, 'u:7', '00000000'), V) }, // @math the first record, its units digit 7
      { label: 'an advance of 9', fn: () => replayText(dat, name, laps, V, { advance: V.glyphs.advance + 1 }) }, // @math one pixel more
      { label: 'a laps word of 5', fn: () => replayText(dat, name, laps, V, { total: V.laptext.total - 1 }) }, // @math one lap fewer
      { label: 'a recorded name glyph altered', fn: () => replayText(dat, editSprites([name], 0, '1:I', '00000000')[0], laps, V) }, // @math the first I of TIGI is at place 1
      { label: 'one archive byte changed', fn: () => replayBanner(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), banner, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
