import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parsePos } from '../../formats/track-files.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ laps: expected('pos.lap-observed'), live: expected('pos.progress-live'), progress: expected('pos.progress') });
const TOOL = { lapBase: 0xaab2, valueBase: 0xaab4, stride: 0x68, playerLap: 0x84c2, playerValue: 0x84be }; // @math the words observe.mjs-less strip-run.mjs --laps reads: the AI words of the racer n - 1 in row n, and the player's pair in row 0

function validate(dat, r, V, { newValue = V.laps.newValue } = {}) {
  const K = V.laps, L = r.laps, ticks = r.ticks.map(t => t[1]), S = r.samples;
  assertArchive(r, dat);
  assert.deepEqual(K.racers, Array.from({ length: V.live.racers - K.idleRacer - 1 }, (_, i) => K.idleRacer + 1 + i), 'the counting racers are those after the idle racer, up to the last of the race'); // @math consecutive racer indices
  assert.equal(K.idleRacer, 1, 'the idle racer is racer 1'); // @math the one racer after the player
  assert.equal(L.length, K.samples, 'the samples');
  assert.deepEqual([TOOL.lapBase, TOOL.valueBase, TOOL.stride, TOOL.playerLap, TOOL.playerValue], [K.lapWord, K.valueWord, K.stride, K.playerLapWord, K.playerValueWord], 'the words the tool read');
  assert.equal(K.lapWord, V.live.layout.aiLapWord, 'the lap word of pos.progress-live');
  assert.equal(K.valueWord, V.live.layout.aiValueWord, 'the value word of pos.progress-live');
  assert.equal(K.stride, V.live.layout.racerStride, 'the stride of pos.progress-live');
  assert.equal(K.playerLapWord, V.live.layout.humanLapWord);
  assert.equal(K.playerValueWord, V.live.layout.humanValueWord);
  const pos = parseDatDirectory(dat).find(e => e.name === `${r.names.track}.POS`).data, { trailer } = parsePos(pos);
  assert.equal(trailer, K.trailer, 'the trailer of the track\'s grid');
  assert.equal(newValue, V.progress.firstStep, 'a lap starts at the first step');
  assert.deepEqual([ticks[0], ticks.at(-1)], [K.firstTick, K.lastTick], 'the ticks');
  assert.equal(S.length, L.length);
  let increments = 0; const perRacer = [];
  assert.ok(L.every(l => l[K.idleRacer][0] === 0 && l[K.idleRacer][1] === 0), 'racer 1 stays at lap 0 and value 0'); // @math the idle racer's words
  for (const n of K.racers) { // row n holds racer n
    const row = n, laps = [], values_ = [];
    for (let i = 0; i < L.length; i++) { laps.push(L[i][row][0]); values_.push(L[i][row][1]); }
    let mine = 0;
    for (let i = 1; i < L.length; i++) {
      const up = laps[i] - laps[i - 1], wrap = values_[i - 1] === trailer && values_[i] === newValue;
      assert.ok(up === 0 || up === 1, 'a lap goes up by one at a time, never down');
      assert.equal(up === 1, wrap, `racer ${n}: a lap is counted exactly when the value goes from the trailer to 1 (sample ${i})`);
      if (up === 1) mine++;
      if (!wrap) assert.ok(values_[i] - values_[i - 1] >= 0 && values_[i] - values_[i - 1] <= 1 || values_[i] === 0 || values_[i - 1] === 0, `racer ${n}: the value rises by 0 or 1`); // @math a step of at most one cell between samples, or off the course
    }
    increments += mine; perRacer.push([laps[0], laps.at(-1), mine]);
    assert.ok(values_.every(v => v <= trailer), 'the value never passes the trailer');
  }
  assert.equal(increments, K.increments, 'the lap changes');
  perRacer.forEach(([a, b, m]) => assert.deepEqual([a, b, m], [K.startLaps, K.endLaps, K.lapsPerRacer], 'each racer\'s laps'));
  assert.equal(K.endLaps - K.startLaps, K.lapsPerRacer, 'four laps'); // @math the difference is the laps run
  assert.equal(K.racers.length * K.lapsPerRacer, K.increments, 'six racers of four laps');
  const player = L.map(l => l[0]);
  assert.ok(player.every(p => p[0] === 0), 'the parked player\'s lap stays 0'); // @math the lap word of the player at the start
  assert.deepEqual([Math.min(...player.map(p => p[1])), Math.max(...player.map(p => p[1]))], K.playerValues, 'the parked player\'s value');
}

export default {
  id: 'obs-laps',
  claims: ['pos.lap-observed'],
  obs: ['laps-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('laps-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('laps-1'), V = values(), K = V.laps, k = patch => ({ ...V, laps: { ...K, ...patch } });
    return [
      { label: 'a trailer of 26', fn: () => validate(dat, r, k({ trailer: K.trailer - 1 })) },
      { label: 'a lap counted at value 2', fn: () => validate(dat, r, V, { newValue: V.laps.newValue + 1 }) },
      { label: 'a lap altered', fn: () => validate(dat, { ...r, laps: r.laps.map((l, i) => (i === 100 ? l.map((x, n) => (n === 3 ? [x[0] + 1, x[1]] : x)) : l)) }, V) }, // @math a sample in the middle
      { label: 'five racers', fn: () => validate(dat, r, k({ racers: K.racers.slice(1) })) },
      { label: 'racer 1 among the counters', fn: () => validate(dat, r, k({ racers: [K.idleRacer, ...K.racers.slice(1)] })) },
      { label: 'a stride of 0x67', fn: () => validate(dat, r, k({ stride: K.stride - 1 })) },
      { label: 'a player value of 23', fn: () => validate(dat, r, k({ playerValues: [K.playerValues[0], K.playerValues[1] + 1] })) },
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
