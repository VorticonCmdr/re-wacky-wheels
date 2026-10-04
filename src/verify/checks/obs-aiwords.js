import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSdx } from '../../formats/static-tables.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { rebuildStrip } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ asl: expected('ai.surface-slowdown'), race: expected('ai.race-speeds'), eff: expected('terrain.effects-observed'), idx: expected('terrain.sdx-index'), sin: expected('sin.read'), sinLayout: expected('sin.layout'), map: expected('m.read') });
const IDS = ['aiwords-0', 'aiwords-1'];

function validate(dat, records, V, { shift = V.asl.shift, surface = V.asl.surface } = {}) {
  const A = V.asl, sdx = parseSdx(new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])).get('WACKY.SDX')).records;
  assert.equal(records.length, IDS.length, 'the records');
  assert.equal(A.carPointerAt, V.idx.carPointerOffset, 'the car pointer of terrain.sdx-index');
  assert.equal(A.fractionWord, V.eff.carFracWord, 'the car word that holds the fraction (terrain.effects-observed)');
  assert.equal(A.sdxDwordAt, V.idx.dwordAt, 'the SDX dword of terrain.sdx-index');
  assert.deepEqual([V.race.fixedWord, ...V.race.speedWords], [0x0c, 0x08, 0x0a], 'the words of ai.race-speeds that the tool read as w c, 8 and a'); // @math the words +0xc, +8 and +0xa
  const fraction = view(sdx[surface]).getUint32(A.sdxDwordAt, true);
  assert.equal(fraction, 30146, 'the surface 1 fraction of the SDX'); // @math the fraction of terrain.effects-observed for the surface 1
  const words = r => {
    const c = Object.fromEntries(r.columns.map((n, i) => [n, i])), s = r.samples.at(-1), out = { c: [], a: [], eight: [] };
    for (let n = 1; n <= A.racers; n++) { out.c.push(s[c[`w${n}c`]]); out.a.push(s[c[`w${n}a`]]); out.eight.push(s[c[`w${n}8`]]); }
    // the words never change in the countdown samples
    for (const x of r.samples) for (let n = 1; n <= A.racers; n++) assert.deepEqual([x[c[`w${n}c`]], x[c[`w${n}a`]], x[c[`w${n}8`]]], [s[c[`w${n}c`]], s[c[`w${n}a`]], s[c[`w${n}8`]]], 'the words stay put in the countdown');
    return out;
  };
  records.forEach(r => assertArchive(r, dat));
  const base = words(records[0]), slow = words(records[1]);
  assert.deepEqual(base.c, A.baseC, 'the +0xc words'); assert.deepEqual(base.a, A.baseA, 'the +0xa words'); assert.deepEqual(base.eight, Array(A.racers).fill(A.baseEight), 'the +8 words');
  assert.deepEqual(slow.c, A.baseC, 'the +0xc words are not scaled');
  assert.deepEqual(slow.a, base.a.map(v => v - ((v * fraction) >> shift)), 'the +0xa words are lowered by the fraction');
  assert.deepEqual(slow.eight, base.eight.map(v => v - ((v * fraction) >> shift)), 'the +8 words are lowered by the fraction');
  assert.deepEqual(slow.a, A.scaledA, 'the values');
  assert.deepEqual(slow.eight, Array(A.racers).fill(A.scaledEight), 'the values');
  const r1 = records[1];
  assert.deepEqual([r1.build.id, r1.build.rows, r1.build.cols, r1.build.value, r1.build.track], [56, [18, 18], [6, 9], surface, 1], 'what was built'); // @math tile 56 over the start-line row of track 1
  rebuildStrip(dat, r1, { sin: V.sin, sinLayout: V.sinLayout, map: V.map });
}

export default {
  id: 'obs-aiwords',
  claims: ['ai.surface-slowdown'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values();
    return [
      { label: 'a shift of 15', fn: () => validate(dat, records, V, { shift: V.asl.shift - 1 }) },
      { label: 'the surface 2', fn: () => validate(dat, records, V, { surface: 2 }) }, // @math another surface
      { label: 'a word altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map(s => s.map((x, k) => (k === r.columns.indexOf('w3a') ? x + 1 : x))) } : r)), V) }, // @math racer 3's +0xa word
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
