import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parsePos } from '../../formats/track-files.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ laps: expected('pos.lap-observed'), live: expected('pos.progress-live'), progress: expected('pos.progress') });
const TOOL = { lapBase: 0xaab2, valueBase: 0xaab4, stride: 0x68, playerLap: 0x84c2, playerValue: 0x84be }; // @math the words strip-run.mjs --laps reads: racer n at the base plus the stride times n, row 0 the player's pair

function validate(dat, r, V, { newValue = V.laps.newValue, maxStep = V.laps.maxStep } = {}) {
  const K = V.laps, L = r.laps, ticks = r.ticks.map(t => t[1]);
  assertArchive(r, dat);
  assert.equal(L.length, K.samples, 'the samples');
  assert.deepEqual([TOOL.lapBase, TOOL.valueBase, TOOL.stride, TOOL.playerLap, TOOL.playerValue], [K.lapWord, K.valueWord, K.stride, K.playerLapWord, K.playerValueWord], 'the words the tool read');
  assert.equal(K.lapWord, V.live.layout.aiLapWord, 'the lap word of pos.progress-live');
  assert.equal(K.valueWord, V.live.layout.aiValueWord, 'the value word of pos.progress-live');
  assert.equal(K.stride, V.live.layout.racerStride, 'the stride of pos.progress-live');
  assert.equal(K.playerLapWord, V.live.layout.humanLapWord);
  assert.equal(K.playerValueWord, V.live.layout.humanValueWord);
  assert.deepEqual(K.racers, Array.from({ length: V.live.racers - 1 }, (_, i) => i + 1), 'racers 1 to the last, the player is racer 0'); // @math consecutive racer indices after the player
  const pos = parseDatDirectory(dat).find(e => e.name === `${r.names.track}.POS`).data, { trailer } = parsePos(pos);
  assert.equal(trailer, K.trailer, 'the trailer of the track\'s grid');
  assert.equal(newValue, V.progress.firstStep, 'a lap starts at the first step');
  assert.deepEqual([ticks[0], ticks.at(-1)], [K.firstTick, K.lastTick], 'the ticks');
  const gaps = new Set(); for (let i = 1; i < ticks.length; i++) gaps.add(ticks[i] - ticks[i - 1]);
  assert.deepEqual([...gaps].sort((a, b) => a - b), K.tickGaps, 'the gaps between samples, in ticks');
  let wraps = 0, strict = 0; const perRow = [];
  for (let n = 0; n <= K.racers.length; n++) { // row n holds racer n; row 0 is the player
    const laps = L.map(l => l[n][0]), vals = L.map(l => l[n][1]); let mine = 0;
    for (let i = 1; i < L.length; i++) {
      const up = laps[i] - laps[i - 1], wrap = vals[i] < vals[i - 1];
      assert.ok(up === 0 || up === 1, 'a lap goes up by one at a time, never down');
      assert.equal(up === 1, wrap, `racer ${n}: a lap is counted exactly when the value falls (sample ${i})`);
      if (wrap) {
        mine++;
        if (ticks[i] - ticks[i - 1] === 1) { strict++; assert.deepEqual([vals[i - 1], vals[i]], [trailer, newValue], `racer ${n}: one tick apart the value goes from the trailer to 1`); } // @math one tick between the samples
        else assert.ok(vals[i - 1] >= trailer - 1 && vals[i] <= newValue + 1, `racer ${n}: two ticks apart the line was crossed in between`); // @math one step either side of the exact wrap
      } else assert.ok(vals[i] - vals[i - 1] <= maxStep, `racer ${n}: the value rises by at most ${maxStep}`);
    }
    wraps += mine; perRow.push([laps[0], laps.at(-1), mine]);
    assert.ok(vals.every(v => v <= trailer), 'the value never passes the trailer');
  }
  assert.equal(wraps, K.wraps, 'the lap changes');
  assert.equal(strict, K.strictWraps, 'the wraps with samples one tick apart');
  perRow.slice(1).forEach(row => assert.deepEqual(row, [K.startLaps, K.endLaps, K.lapsPerRacer], 'each computer racer\'s laps'));
  assert.deepEqual(perRow[0], [K.startLaps, K.playerLaps, K.playerLaps], 'the player crosses the line once'); // @math one crossing, one lap
  assert.equal(K.racers.length * K.lapsPerRacer + K.playerLaps, K.wraps, 'seven racers of five laps and the player\'s one'); // @math the sum of the crossings
  assert.equal(L[0][0][1], K.playerStart, 'the player started behind the line');
}

export default {
  id: 'obs-laps',
  claims: ['pos.lap-observed'],
  obs: ['laps-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('laps-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('laps-1'), V = values(), K = V.laps, k = patch => ({ ...V, laps: { ...K, ...patch } });
    return [
      { label: 'a trailer of 26', fn: () => validate(dat, r, k({ trailer: K.trailer - 1 })) },
      { label: 'a lap counted at value 2', fn: () => validate(dat, r, V, { newValue: V.laps.newValue + 1 }) },
      { label: 'a rise of at most 1', fn: () => validate(dat, r, V, { maxStep: K.maxStep - 1 }) },
      { label: 'a lap altered', fn: () => validate(dat, { ...r, laps: r.laps.map((l, i) => (i === 100 ? l.map((x, n) => (n === 3 ? [x[0] + 1, x[1]] : x)) : l)) }, V) }, // @math a sample in the middle
      { label: 'six racers', fn: () => validate(dat, r, k({ racers: K.racers.slice(1) })) },
      { label: 'a stride of 0x67', fn: () => validate(dat, r, k({ stride: K.stride - 1 })) },
      { label: 'a tick altered', fn: () => validate(dat, { ...r, ticks: r.ticks.map((t, i) => (i === 14 ? [t[0], t[1] + 1] : t)) }, V) }, // @math the sample after the player's crossing
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
