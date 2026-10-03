import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { view } from '../../binary.js';
import { replaceMember } from '../patch.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ boost: expected('car.boost-observed'), model: expected('car.speed-model'), asl: expected('ai.surface-slowdown'), sin: expected('sin.read'), sinLayout: expected('sin.layout'), map: expected('m.read'), sheet: expected('tiles.sheet-split'),
  gate: expected('car.boost-gate') });

const COLUMNS = ['boostActive', 'boostTimer', 'throttle', 'speed', 'terrain', 'row', 'fraction', 'surface', 'tableEntry', 'carWordA', 'heading'], C = Object.fromEntries(COLUMNS.map((n, i) => [n, i]));

// Rebuild the run copy from the user's archive: the tile's two kept SIN dwords set to the terrain value, the strip's cells set to the tile, and compare it with the record's.
function rebuild(dat, r, V) {
  const B = V.boost, S = B.strip, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), name = `${r.build.track}`;
  assert.deepEqual([r.build.id, r.build.rows, r.build.cols, r.build.value], [S.tile, S.rows, S.cols, B.terrain], 'the experiment built the strip and nothing else');
  const map = Uint8Array.from(members.get(`${name}.M`)), sin = Uint8Array.from(members.get(`${name}.SIN`)), dv = view(sin);
  assert.ok(!map.includes(S.tile), 'the track does not use the tile');
  for (let row = S.rows[0]; row <= S.rows[1]; row++) for (let col = S.cols[0]; col <= S.cols[1]; col++) map[row * V.map.columns + col] = S.tile;
  for (let k = 0; k < V.sin.kept / 4; k++) dv.setUint32(S.tile * V.sinLayout.recordBytes + V.sin.skipped + k * 4, B.terrain, true); // @math the kept bytes are dwords
  const run = replaceMember(replaceMember(dat, `${name}.M`, map), `${name}.SIN`, sin);
  assert.equal(run.length, r.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(run).digest('hex'), r.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  return members;
}

function strip(V) {
  const S = V.boost.strip, origin = V.map.mapOrigin * V.sheet.size, edge = V.sheet.size;
  return [origin + S.rows[0] * edge, origin + (S.rows[1] + 1) * edge];
}

// Common to both runs: columns, the terrain-2 cells are exactly the strip's rows, a boost is never half-recorded.
function common(dat, r, V) {
  assertArchive(r, dat);
  assert.deepEqual(r.columns, COLUMNS, 'the columns');
  const members = rebuild(dat, r, V), [from, to] = strip(V), B = V.boost, vel = view(members.get('VEL.TAB'));
  for (const s of r.samples) {
    assert.equal(s[C.terrain] === B.terrain, s[C.row] >= from && s[C.row] < to, `terrain ${s[C.terrain]} at row ${s[C.row]} is terrain 2 exactly inside the strip`);
    assert.equal(s[C.tableEntry], vel.getInt16(s[C.throttle] * 2, true), 'the loaded table holds VEL.TAB at the throttle'); // @math 16-bit table entries
    assert.equal(s[C.boostActive] === 0, s[C.boostTimer] === 0, 'the boost word and its timer are zero together');
  }
  return { vel };
}

// boost-2: the gate as the game set it. Terrain 2 is crossed and nothing happens.
function closed(dat, r, V) {
  const { vel } = common(dat, r, V), B = V.boost;
  assert.deepEqual(r.forced, [], 'nothing was written into the game');
  assert.deepEqual(r.gateBefore, [0, 0, 0, 0, 0, B.track], 'the gate words as the game set them: the car word and the four range words 0, the track word 1'); // @math the six words read before and after
  assert.deepEqual(r.gateAfter, r.gateBefore, 'and unchanged');
  let onStrip = 0;
  for (const s of r.samples) {
    assert.equal(s[C.carWordA], 0, 'the car word +0xa stays 0');
    assert.notEqual(s[C.heading], 0, 'the heading is not the one heading inside the range 0 to 0');
    assert.equal(s[C.boostActive], 0, 'no boost');
    assert.ok(s[C.throttle] <= B.throttleCap, 'the throttle stays within its cap');
    if (s[C.terrain] === B.terrain) onStrip++;
  }
  assert.equal(onStrip, B.closedSamples, 'the samples on a terrain-2 cell');
  assert.ok(vel.getInt16(B.boostThrottle * 2, true) !== 0); // @math 16-bit table entries
}

// boost-1: the gate's inputs written. A boost starts on the first terrain-2 sample and runs its timer down.
function opened(dat, r, V) {
  const { vel } = common(dat, r, V), B = V.boost, F = B.forced, G = V.gate;
  assert.deepEqual(r.forced, [['car', F.carWord, 2, F.carValue], ...F.rangeWords.map(w => ['obj2', w, 4, F.rangeValue])], 'the written words'); // @math word and dword sizes
  assert.deepEqual(r.gateBefore, [0, 0, 0, 0, 0, B.track], 'the gate words as the game set them'); // @math the six words read before and after
  assert.deepEqual(r.gateAfter, [F.carValue, 0, F.rangeValue, 0, F.rangeValue, B.track], 'and after the writes'); // @math the six words read before and after
  assert.equal(F.carWord, G.carWord, 'the car word of the gate');
  assert.deepEqual(F.rangeWords, [G.startRange[1], G.activeRange[1]], 'the upper range words of the gate');
  assert.equal(B.terrain, V.model.boostTerrain);
  assert.equal(B.boostThrottle, V.model.boostThrottle);
  assert.equal(B.boostFrames, V.model.boostFrames);
  const samples = r.samples, first = samples.findIndex(s => s[C.boostActive] === 1), activeRuns = samples.filter(s => s[C.boostActive] === 1);
  assert.ok(first > 0, 'the boost starts after the first sample');
  assert.ok(samples.slice(0, first).every(s => s[C.terrain] !== B.terrain), 'no terrain-2 sample before the boost');
  assert.equal(samples[first][C.terrain], B.terrain, 'the boost starts on terrain 2');
  assert.equal(samples[first][C.boostTimer], B.firstTimer, 'the timer at the first active sample');
  assert.ok(samples[first][C.boostTimer] <= B.boostFrames, 'at most the 16 calls');
  assert.equal(activeRuns.length, B.activeSamples, 'the samples with the boost word set');
  assert.deepEqual(samples.slice(first, first + activeRuns.length).map(s => s[C.boostActive]), activeRuns.map(() => 1), 'the active samples are consecutive');
  const entry = vel.getInt16(B.boostThrottle * 2, true); // @math 16-bit table entries
  assert.equal(entry, B.boostEntry, 'the table entry for the boost throttle');
  let previous = Infinity;
  for (const s of activeRuns) {
    assert.equal(s[C.throttle], B.boostThrottle, 'the boost throttle');
    assert.equal(s[C.carWordA], 0, 'the car word +0xa is 0 again by the samples');
    assert.equal(s[C.tableEntry], entry);
    assert.equal(s[C.speed], entry - ((entry * s[C.fraction]) >> V.asl.shift), 'the speed is the entry slowed by the surface fraction');
    assert.ok(s[C.boostTimer] >= 1 && s[C.boostTimer] < previous, `the timer only falls (${s[C.boostTimer]})`);
    previous = s[C.boostTimer];
  }
  assert.ok(samples[first + activeRuns.length - 1][C.row] >= strip(V)[1] + B.boostFrames * entry / B.boostFrames, 'the boost goes on past the strip'); // @math the 16 calls of 64 units, one entry a call
  const after = samples[first + activeRuns.length];
  assert.deepEqual([after[C.boostActive], after[C.boostTimer]], [0, 0], 'the boost has ended after the last active sample');
  assert.ok(samples.slice(first + activeRuns.length).some(s => s[C.throttle] === B.throttleCap), 'the throttle is back at its cap');
  assert.ok(samples.slice(first + activeRuns.length + 1).every(s => s[C.throttle] <= B.throttleCap || s === after), 'and stays within it');
}

export default {
  id: 'obs-boost',
  claims: ['car.boost-observed'],
  obs: ['boost-1', 'boost-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    opened(dat, ctx.obs('boost-1'), V); closed(dat, ctx.obs('boost-2'), V);
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r1 = ctx.obs('boost-1'), r2 = ctx.obs('boost-2');
    const edit = (r, i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, j) => (j in patch ? patch[j] : v)) : s)) });
    const first = r1.samples.findIndex(s => s[C.boostActive] === 1), mid = first + 3, // @math a sample inside the boost
    onStrip = r2.samples.findIndex(s => s[C.terrain] === V.boost.terrain);
    const b = patch => ({ ...V, boost: { ...V.boost, ...patch } });
    return [
      { label: 'a timer that rises', fn: () => opened(dat, edit(r1, mid, { [C.boostTimer]: r1.samples[first][C.boostTimer] }), V) },
      { label: 'a throttle of 159', fn: () => opened(dat, edit(r1, mid, { [C.throttle]: V.boost.boostThrottle - 1 }), V) },
      { label: 'a speed one more', fn: () => opened(dat, edit(r1, mid, { [C.speed]: r1.samples[mid][C.speed] + 1 }), V) },
      { label: 'a boost word set with the timer 0', fn: () => opened(dat, edit(r1, first + r1.samples.filter(s => s[C.boostActive] === 1).length, { [C.boostActive]: 1 }), V) },
      { label: 'a boost in the closed run', fn: () => closed(dat, edit(r2, onStrip + 2, // @math a sample on the strip
 { [C.boostActive]: 1, [C.boostTimer]: 1 }), V) },
      { label: 'the closed record taken for the open one', fn: () => opened(dat, r2, V) },
      { label: 'the open record taken for the closed one', fn: () => closed(dat, r1, V) },
      { label: 'a strip one row lower', fn: () => opened(dat, r1, b({ strip: { ...V.boost.strip, rows: [V.boost.strip.rows[0] + 1, V.boost.strip.rows[1] + 1] } })) },
      { label: 'a strip of another tile', fn: () => opened(dat, r1, b({ strip: { ...V.boost.strip, tile: V.boost.strip.tile + 1 } })) },
      { label: 'a boost of 15 calls', fn: () => opened(dat, r1, b({ boostFrames: V.boost.boostFrames - 1 })) },
      { label: 'a gate word not written', fn: () => opened(dat, { ...r1, forced: r1.forced.slice(1) }, V) },
      { label: 'one archive byte changed', fn: () => opened(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r1, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
