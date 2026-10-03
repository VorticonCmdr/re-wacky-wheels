import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { locateLe, objectBytes } from '../../formats/le.js';
import { view } from '../../binary.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ timer: expected('hud.timer-observed') });
const IDS = ['timer-1', 'timer-2', 'timer-3', 'timer-4', 'timer-5'];
const TOOL_TICK_WORD = 0x1e71c; // @math the word tools/dosbox/observe.mjs reads as hud.ticks
const CHARS = '0123456789:'; // @math the glyph order: the digits, then the colon

// The CRC-32 of a glyph's own non-zero pixels in row order, the value the record holds when the screen shows it.
function glyphCrcs(dat, T) {
  const data = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('GENEF.SP'), [w, h] = T.glyphSize;
  return Array.from({ length: T.glyphs }, (_, k) => {
    const picked = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = data[T.glyphsAt + T.glyphBytes * k + i * h + j]; if (v !== 0) picked.push(v); }
    return crc(Uint8Array.from(picked));
  });
}

const text = (n, T) => { const t = Math.floor(n / T.tenths); return `${String(Math.floor(t / T.secondsPerMinute)).padStart(2, '0')}:${String(t % T.secondsPerMinute).padStart(2, '0')}:${n % T.tenths}`; }; // @math two digits

// The constants as the formatter carries them: immediates of the instructions the claim cites.
const SITES = {
  cap: { at: 0x1a624, skip: 1, width: 4 }, // @math cmp eax,imm32
  tenths: { at: 0x1a637, skip: 1, width: 4 }, // @math mov ebx,imm32
  secondsPerMinute: { at: 0x1a654, skip: 1, width: 4 }, // @math mov ebx,imm32 (the divisor of the minutes)
  modulo: { at: 0x1a660, skip: 4, width: 4 }, // @math mov dword [esp+8],imm32 (the divisor of the seconds)
};
function codeImmediates(exe, T) {
  const { le } = locateLe(exe);
  for (const [name, site] of Object.entries(SITES)) {
    const b = objectBytes(le, 1, site.at, site.skip + site.width), value = view(b).getUint32(site.skip, true);
    assert.equal(value, name === 'modulo' ? T.secondsPerMinute : T[name], `${name}: the immediate in the code`);
  }
}

function validate(dat, records, V, { glyphsAt = V.timer.glyphsAt, exe } = {}) {
  const T = { ...V.timer, glyphsAt }, crcs = glyphCrcs(dat, T);
  if (exe) codeImmediates(exe, T);
  assert.equal(records.length, T.samples, 'the samples');
  assert.equal(new Set(crcs).size, T.glyphs, 'the glyphs differ');
  assert.equal(CHARS.length, T.glyphs, 'the digits and the colon');
  assert.equal(CHARS.indexOf(':'), T.colon, 'the colon is the last glyph');
  assert.equal(T.tickWord, TOOL_TICK_WORD, 'the word the observation tool read');
  assert.equal(T.places, 7); // @math the seven characters of MM:SS:T
  assert.equal(T.glyphSize[0] * T.advance === T.advance * T.glyphSize[0] && T.places * T.advance, 49, 'the timer is 49 pixels wide'); // @math seven glyphs of 7 pixels
  let exact = 0, behind = 0;
  for (const r of records) {
    assertArchive(r, dat);
    const shown = [];
    for (let place = 0; place < T.places; place++) {
      const hits = r.sprites.filter(s => s.x === T.x + T.advance * place && s.y === T.y && s.member === 'GENEF.SP' && s.at === T.glyphsAt + T.glyphBytes * Number(s.tag.split(':')[1]) && s.crc === crcs[Number(s.tag.split(':')[1])]).map(s => Number(s.tag.split(':')[1]));
      assert.equal(hits.length, 1, `exactly one glyph matches place ${place}`);
      shown.push(CHARS[hits[0]]);
    }
    const word = r.hud.ticks, shownText = shown.join('');
    if (shownText === text(word, T)) exact++; else { behind++; assert.equal(shownText, text(word - 1, T), 'or the text of the word minus one'); } // @math one tick
  }
  assert.equal(exact, T.exact, 'the samples that agree exactly');
  assert.equal(behind, T.behind, 'the samples one tick behind');
}

export default {
  id: 'obs-timer',
  claims: ['hud.timer-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values(), { exe: await ctx.open('WW.EXE') }); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), exe = await ctx.open('WW.EXE'), records = IDS.map(id => ctx.obs(id)), V = values(), T = V.timer, t = patch => ({ timer: { ...T, ...patch } });
    const shifted = records.map((r, i) => (i === 1 ? { ...r, sprites: r.sprites.map(s => (s.tag.startsWith('0:') ? { ...s, x: s.x + 1 } : s)) } : r));
    return [
      { label: 'the glyph table one glyph on', fn: () => validate(dat, records, V, { glyphsAt: T.glyphsAt + T.glyphBytes }) },
      { label: 'the glyph table one byte on', fn: () => validate(dat, records, V, { glyphsAt: T.glyphsAt + 1 }) }, // @math one byte
      { label: 'a column one pixel right', fn: () => validate(dat, shifted, V) },
      { label: 'a minute of 59 seconds', fn: () => validate(dat, records, t({ secondsPerMinute: T.secondsPerMinute - 1 }), { exe }) },
      { label: 'a cap of 35999', fn: () => validate(dat, records, t({ cap: T.cap - 1 }), { exe }) },
      { label: 'hundredths of a second', fn: () => validate(dat, records, t({ tenths: T.tenths * 10 })) }, // @math ten times
      { label: 'a timer at row 113', fn: () => validate(dat, records, t({ y: T.y + 1 })) },
      { label: 'an advance of 8', fn: () => validate(dat, records, t({ advance: T.advance + 1 })) },
      { label: 'two samples exact', fn: () => validate(dat, records, t({ exact: T.exact - 1, behind: T.behind + 1 })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
