import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSdx } from '../../formats/static-tables.js';
import { parseMap } from '../../formats/track-files.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ ai: expected('ai.surface-independent-observed'), eff: expected('terrain.effects-observed'), look: expected('terrain.lookup'), asl: expected('ai.surface-slowdown') });
const IDS = ['aislow-0', 'aislow-1', 'aislow-2'];

function validate(dat, records, V, { tile = V.ai.tile } = {}) {
  const A = V.ai, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), sdx = parseSdx(members.get('WACKY.SDX')).records, map = parseMap(members.get('1.M'));
  assert.equal(records.length, A.records, 'the records');
  assert.equal(A.sinTableAt, V.eff.written, 'the loaded table of terrain.effects-observed');
  assert.equal(A.entryBytes, V.look.entryBytes, 'the entry size of terrain.lookup');
  assert.equal(map.tiles.filter(t => t === tile).length, A.tileCells, 'the start-line tile is used in four cells only');
  const startCell = [(1600 - 0x400) >> 5, (1280 - 0x400) >> 5]; // @math the world offset 0x400 and 32 pixels a cell
  assert.equal(map.tiles[startCell[0] * map.columns + startCell[1]], tile, 'the player\'s start cell is that tile');
  assert.equal(view(sdx[1]).getUint32(V.asl.sdxDwordAt, true), A.fraction, 'the surface 1 slows by 30146');
  let first0 = null;
  const perTick = records.map(r => {
    assertArchive(r, dat);
    const c = Object.fromEntries(r.columns.map((n, i) => [n, i])), byTick = new Map();
    for (const s of r.samples) { const key = [s[c.r1x], s[c.r1y], s[c.r7x], s[c.r7y]].join(); (byTick.get(s[c.tick]) ?? byTick.set(s[c.tick], new Set()).get(s[c.tick])).add(key); }
    const out = { c, byTick, r }; first0 ??= out; return out;
  });
  // the player's surface in each run
  const surface = perTick.map(({ r, c }) => new Set(r.samples.map(s => s[c.terrain])));
  assert.deepEqual(surface.map(s => [...s]), [[0], [1], [0]], 'the car\'s surface: the road, surface 1, the road'); // @math the three runs' terrain values
  assert.equal(perTick[1].r.samples[0][perTick[1].c.tick], A.firstSampleTick, 'the surface 1 is there from the first sample');
  A.racers.forEach(n => assert.ok(perTick.every(p => p.r.columns.includes(`r${n}x`) && p.r.columns.includes(`r${n}y`)), `racer ${n} is recorded`));
  assert.deepEqual(perTick.map(p => p.r.build.written), ['nothing', 'tile 64', 'every tile except 64'], 'what was written');
  const common = [...perTick[0].byTick.keys()].filter(t => perTick.every(p => p.byTick.has(t))).sort((a, b) => a - b);
  assert.deepEqual([common[0], common.at(-1), common.length], [A.firstTick, A.lastTick, A.commonTicks], 'the ticks the runs have in common');
  for (const t of common) { const sets = perTick.map(p => [...p.byTick.get(t)]); assert.ok(sets.every(s => s.length === 1 && s[0] === sets[0][0]), `tick ${t}: the racers are at the same places in all three runs`); }
  const ticksAll = [...first0.byTick.keys()].sort((a, b) => a - b), startKey = [...first0.byTick.get(ticksAll[0])][0];
  assert.equal(ticksAll.find(t => [...first0.byTick.get(t)][0] !== startKey), A.greenLight, 'the racers stand still until the green light and move from tick 35');
  const moving = common.filter(t => t >= A.greenLight); assert.ok(moving.length > 50, 'many ticks of racing'); // @math more than 50 ticks of racing
  const first = perTick[0], c0 = first.c; const startPos = [...first.byTick.get(A.greenLight - 1)][0], afterPos = [...first.byTick.get(A.lastTick)][0];
  assert.notEqual(startPos, afterPos, 'the racers have moved');
}

export default {
  id: 'obs-aislow',
  claims: ['ai.surface-independent-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), A = V.ai;
    return [
      { label: 'tile 63', fn: () => validate(dat, records, V, { tile: A.tile - 1 }) },
      { label: 'a racer moved in one run', fn: () => validate(dat, records.map((r, i) => (i === 2 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 50 ? s.map((x, k) => (k === r.columns.indexOf('r1x') ? x + 1 : x)) : s)) } : r)), V) }, // @math tick 50 of the third run
      { label: 'the surface of the second run altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, samples: r.samples.map(s => s.map((x, k) => (k === r.columns.indexOf('terrain') ? 0 : x))) } : r)), V) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
