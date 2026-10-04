import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSdx } from '../../formats/static-tables.js';
import { parseMap } from '../../formats/track-files.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { rebuildStrip } from '../strip.js';
import { expected } from '../expect.js';

const values = () => ({ ai: expected('ai.surface-slowdown-observed'), eff: expected('terrain.effects-observed'), look: expected('terrain.lookup'), asl: expected('ai.surface-slowdown'), sin: expected('sin.read'), sinLayout: expected('sin.layout'), map: expected('m.read'), step: expected('ai.step-rules') });
const IDS = ['aislow-0', 'aislow-1', 'aislow-2', 'aislow-3'];

function byTick(r) {
  const c = Object.fromEntries(r.columns.map((n, i) => [n, i])), ticks = new Map();
  for (const s of r.samples) { const key = [s[c.r1x], s[c.r1y], s[c.r7x], s[c.r7y]].join(); (ticks.get(s[c.tick]) ?? ticks.set(s[c.tick], new Map()).get(s[c.tick])).set(key, s[c.r1state]); }
  return { c, ticks, r };
}
const single = (b, t) => { const m = b.ticks.get(t); return m && m.size === 1 ? [...m.keys()][0] : null; };
const places = (b, t) => [...b.ticks.get(t).keys()].sort().join('|');

function validate(dat, records, V, { shift = V.asl.shift, fraction = V.ai.fraction } = {}) {
  const A = V.ai, members = new Map(parseDatDirectory(dat).map(e => [e.name.toUpperCase(), e.data])), sdx = parseSdx(members.get('WACKY.SDX')).records, map = parseMap(members.get('1.M'));
  assert.equal(records.length, A.records, 'the records');
  assert.equal(A.sinTableAt, V.eff.written, 'the loaded table of terrain.effects-observed');
  assert.equal(A.entryBytes, V.look.entryBytes, 'the entry size of terrain.lookup');
  assert.equal(map.tiles.filter(t => t === A.tile).length, A.tileCells, 'the start-line tile is used in four cells only');
  assert.equal(map.tiles[(((1600 - 0x400) >> 5) * map.columns) + ((1280 - 0x400) >> 5)], A.tile, 'the player\'s start cell is that tile'); // @math the world offset 0x400 and 32 pixels a cell
  assert.equal(view(sdx[1]).getUint32(V.asl.sdxDwordAt, true), fraction, 'the surface 1 slows by 30146');
  const runs = records.map(byTick);
  records.forEach(r => assertArchive(r, dat));
  // aislow-3 ran from a run copy with the start-line row replaced by an unused tile on the surface 1.
  const r3 = records[records.length - 1];
  assert.deepEqual([r3.build.id, r3.build.rows, r3.build.cols, r3.build.value, r3.build.track], [A.newTile, A.rows, A.cols, 1, 1], 'what was built'); // @math the surface 1 on track 1
  rebuildStrip(dat, r3, { sin: V.sin, sinLayout: V.sinLayout, map: V.map });
  const surfaces = runs.map(({ r, c }) => new Set(r.samples.map(s => s[c.terrain])));
  assert.deepEqual(surfaces.map(s => [...s]), [[0], [1], [0], [1]], 'the car\'s surface in the four runs: the road, 1, the road, 1'); // @math the terrain value of each run
  assert.equal(runs[1].r.samples[0][runs[1].c.tick], A.firstSampleTick, 'the surface 1 is there from the first sample');
  A.racers.forEach(n => assert.ok(runs.every(p => p.r.columns.includes(`r${n}x`) && p.r.columns.includes(`r${n}y`)), `racer ${n} is recorded`));
  // 1: writing the table after the start does nothing.
  const common = (list) => [...list[0].ticks.keys()].filter(t => list.every(p => p.ticks.has(t))).sort((a, b) => a - b);
  const early = runs.slice(0, runs.length - 1), same = common(early); // the runs where only the loaded table was written, or nothing
  assert.deepEqual([same[0], same.at(-1), same.length], [A.firstTick, A.lastTick, A.commonTicks], 'the ticks the first three runs have in common');
  for (const t of same) { const p = early.map(x => places(x, t)); assert.ok(p.every(x => x === p[0]), `tick ${t}: the racers are at the same places in the first three runs`); }
  // 2: the surface at the start slows them from the state 1 on.
  const base = runs[0], slow = runs[runs.length - 1], ticksAll = [...base.ticks.keys()].sort((a, b) => a - b);
  assert.equal(ticksAll.find(t => places(base, t) !== places(base, ticksAll[0])), A.greenLight, 'the racers stand still until the green light');
  const stateOne = ticksAll.find(t => [...base.ticks.get(t).values()][0] === 1); // @math the state word 1
  assert.equal(stateOne, A.stateOneTick, 'racer 1 is in its state 1 from tick 58');
  const both = common([base, slow]), diff = both.filter(t => places(base, t) !== places(slow, t));
  assert.equal(diff[0], A.divergeTick, 'the runs agree until the tick after the state change');
  assert.equal(A.divergeTick, A.stateOneTick + 1, 'the first tick of the state 1 speed'); // @math one tick
  assert.ok(both.filter(t => t < A.divergeTick).every(t => places(base, t) === places(slow, t)), 'and agree before');
  const dy = (run, t) => { const a = single(run, t - 1), b = single(run, t); if (a === null || b === null) return null; const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number); return bx === ax ? by - ay : null; };
  let checked = 0;
  for (const t of both.filter(t => t >= A.divergeTick)) {
    const d0 = dy(base, t), d3 = dy(slow, t);
    if (d0 === null || d3 === null || d0 !== A.stateOneStep) continue;
    assert.equal(d3, d0 - ((d0 * fraction) >> shift), `tick ${t}: ${d0} lowered by the fraction`);
    assert.equal(d3, A.slowedStep, 'to 20');
    checked++;
  }
  assert.ok(checked >= 4, 'at least four straight ticks compared'); // @math four ticks
  const zero = both.filter(t => t > A.greenLight && t < A.stateOneTick).map(t => dy(base, t)).filter(d => d !== null);
  assert.ok(zero.length > 10 && zero.every(d => d === A.stateZeroStep), 'the state 0 step is 25 in the baseline'); // @math more than ten ticks of state 0
}

export default {
  id: 'obs-aislow',
  claims: ['ai.surface-slowdown-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values(), A = V.ai;
    return [
      { label: 'the shift of 15', fn: () => validate(dat, records, V, { shift: V.asl.shift - 1 }) },
      { label: 'a fraction of 30000', fn: () => validate(dat, records, V, { fraction: A.fraction - 146 }) }, // @math a visible change of the fraction
      { label: 'a racer moved in the second run', fn: () => validate(dat, records.map((r, i) => (i === 2 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 50 ? s.map((x, k) => (k === r.columns.indexOf('r1x') ? x + 1 : x)) : s)) } : r)), V) }, // @math tick 50 of the third run
      { label: 'the slowed run altered', fn: () => validate(dat, records.map((r, i) => (i === 3 ? { ...r, samples: r.samples.map(s => (s[r.columns.indexOf('tick')] === 61 ? s.map((x, k) => (k === r.columns.indexOf('r1y') ? x + 1 : x)) : s)) } : r)), V) }, // @math tick 61 of the slowed run
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
