import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSdx } from '../../formats/static-tables.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ eff: expected('terrain.effects-observed'), look: expected('terrain.lookup'), sdx: expected('terrain.sdx-index'), asl: expected('ai.surface-slowdown'), model: expected('car.speed-model'), move: expected('car.move-step') });
const ids = n => Array.from({ length: n }, (_, v) => `terr-${v}`);
const TOOL = { table: 0x1ad88, dwords: 216, carSlide: 0x3a }; // @math the car word +0x3a the steps scenario reads as word3a // @math the loaded .SIN table the survey wrote: 108 entries of 2 dwords

function validate(dat, records, V, { bump = V.eff.bumpThrottle, bumpTick = V.eff.bumpTick, slideAt = V.eff.sdxSlideAt, fracAt = V.eff.sdxFracAt } = {}) {
  const E = V.eff, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), sdx = parseSdx(members.get('WACKY.SDX')).records;
  assert.equal(records.length, E.values, 'the records');
  assert.deepEqual([E.written, E.dwords], [TOOL.table, TOOL.dwords], 'what the tool wrote');
  assert.equal(E.dwords, V.look.entryBytes / 4 * (E.dwords / 2) , 'two dwords an entry'); // @math each entry is two dwords
  assert.equal(E.sdxFracAt, V.asl.sdxDwordAt, 'the slowdown dword of ai.surface-slowdown');
  assert.equal(E.carFracWord, V.asl.fractionWord, 'its car word');
  assert.equal(E.carSurfaceWord, V.move.terrainWord, 'the car word that keeps the surface value, of car.move-step');
  assert.equal(E.carSlideWord, TOOL.carSlide, 'the car word the slide number is read from');
  assert.equal(E.maxThrottle, V.model.throttleCap, 'the cap of car.speed-model');
  assert.ok(sdx.length > E.values - 1, 'an SDX record for every value');
  const found = { wall: [], pit: [], special: [], bump: [] };
  records.forEach((r, v) => {
    assertArchive(r, dat);
    assert.deepEqual(r.columns, E.columns, 'the columns');
    assert.equal(r.build.value, v, 'the value written');
    assert.equal(r.samples.length, E.samples, 'the samples');
    const c = Object.fromEntries(r.columns.map((n, i) => [n, i])), S = r.samples, rec = view(sdx[v]);
    const settled = S.filter(s => s[c.tick] >= 8); // @math from tick 8 the written value is read at every position
    assert.ok(settled.every(s => s[c.terrain] === v && s[c.surface56] === v), `the terrain and the car word +0x56 are ${v}`);
    const last = S.at(-1);
    assert.equal(last[c.frac36], rec.getUint32(fracAt, true), `terr-${v}: the slowdown dword is SDX record ${v}'s +0x120`);
    assert.equal(last[c.word3a], rec.getUint32(slideAt, true), `terr-${v}: the slide number is SDX record ${v}'s +0x124`);
    const throttle = Math.max(...S.map(s => s[c.throttle])), states = new Set(S.map(s => s[c.state44])), flags = new Set(S.map(s => s[c.flag5a])), falls = new Set(S.map(s => s[c.fall0a]));
    if (throttle === 0) found.wall.push(v);
    if (falls.has(1) && falls.has(2)) found.pit.push(v); // @math the two fall states
    if (states.has(1)) { found.special.push(v); assert.ok(flags.has(1), 'the word +0x5a is set with the state'); } // @math the special state is 1
    const over = S.filter(s => s[c.throttle] > E.maxThrottle);
    if (over.length) { found.bump.push(v); assert.deepEqual(over.map(s => [s[c.tick], s[c.throttle]]), [[bumpTick, bump]], `terr-${v}: one call of throttle 140`); }
    if (!found.wall.includes(v) && !found.pit.includes(v) && !found.special.includes(v) && !found.bump.includes(v)) assert.ok(states.size === 1 && flags.size === 1 && falls.size === 1 && S.every(s => s[c.crash7e] === 0), `terr-${v}: nothing special`); // @math every special word stays at one value, 0
    assert.ok(S.every(s => s[c.throttle] <= (found.bump.includes(v) ? bump : E.maxThrottle)), 'the throttle bounds');
  });
  assert.deepEqual(found, { wall: E.wall, pit: E.pit, special: E.special, bump: E.bump }, 'the special surfaces');
  assert.equal(V.model.boostTerrain, 2, 'the boost surface of car.speed-model is quiet here, as its gate is closed on track 1'); // @math terrain 2 is the boost
  assert.ok(records[V.model.boostTerrain].samples.every(s => s[records[V.model.boostTerrain].columns.indexOf('throttle')] <= E.maxThrottle), 'terrain 2 does not boost');
}

export default {
  id: 'obs-terreffects',
  claims: ['terrain.effects-observed'],
  obs: ids(27), // @math the values 0 to 26
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ids(27).map(id => ctx.obs(id)), values()); }, // @math the values 0 to 26
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = ids(27).map(id => ctx.obs(id)), V = values(), E = V.eff; // @math the values 0 to 26
    return [
      { label: 'a bump of 139', fn: () => validate(dat, records, V, { bump: E.bumpThrottle - 1 }) },
      { label: 'a bump at tick 39', fn: () => validate(dat, records, V, { bumpTick: E.bumpTick + 1 }) },
      { label: 'the slide number from +0x120', fn: () => validate(dat, records, V, { slideAt: E.sdxFracAt }) },
      { label: 'the slowdown from +0x124', fn: () => validate(dat, records, V, { fracAt: E.sdxSlideAt }) },
      { label: 'a state word altered', fn: () => validate(dat, records.map((r, i) => (i === 5 ? { ...r, samples: r.samples.map((s, n) => (n === 50 ? s.map((x, k) => (k === r.columns.indexOf('state44') ? 1 : x)) : s)) } : r)), V) }, // @math the value 5 at a sample in the middle
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
