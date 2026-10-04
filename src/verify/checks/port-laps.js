import assert from 'node:assert/strict';
import { loadTrack, archiveMembers } from '../../game/track-data.js';
import { createCar, cameraOf } from '../../game/car.js';
import { parsePos } from '../../formats/track-files.js';
import { gridValue, createLaps, stepLaps, lapsTotal, isFinished } from '../../game/laps.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ laps: expected('pos.lap-observed'), live: expected('pos.progress-live'), rules: expected('lap.rules'), banner: expected('text.banner-observed'), finish: expected('devil.finish-observed') });

// The port's grid lookup at every racer's recorded position of every sample of progress-1 equals the value the game stored.
function replayLookup(dat, r, V, { swapAxes = false } = {}) {
  assertArchive(r, dat);
  const pos = parsePos(archiveMembers(dat).get(`${r.names.track}.POS`));
  let compared = 0, onCourse = 0;
  for (const sample of r.samples) for (const [x, y, , value] of sample.racers) {
    const got = swapAxes ? gridValue(pos, y, x) : gridValue(pos, x, y);
    assert.equal(got, value, `the grid value at (${x}, ${y})`);
    compared++; if (value !== 0) onCourse++;
  }
  assert.ok(onCourse > 0, 'some racers are on the course, so the comparison is not vacuous'); // @math at least one
  return compared;
}

// The port's lap step over the recorded grid values of laps-1 (the player and the seven computer racers): where the samples are one tick apart the lap
// must go up exactly on the wraps from the trailer to 1, and it must stay wherever the value does not wrap (the pairs two ticks apart that wrap skip a frame).
function replayLaps(dat, r, V, { trailer } = {}) {
  assertArchive(r, dat);
  const world = loadTrack(dat, r.names.track), L = r.laps, ticks = r.ticks.map(t => t[1]), K = V.laps;
  assert.equal(trailer ?? world.pos.trailer, world.pos.trailer, 'the trailer of the track');
  const tr = trailer ?? world.pos.trailer;
  let counted = 0, kept = 0, skipped = 0;
  for (let n = 0; n < L[0].length; n++) {
    const laps = L.map(l => l[n][0]), vals = L.map(l => l[n][1]);
    for (let i = 1; i < L.length; i++) {
      const wrap = vals[i] < vals[i - 1];
      if (wrap && ticks[i] - ticks[i - 1] !== 1) { skipped++; continue; } // @math a gap of one tick: no frame between the samples
      const { laps: next } = stepLaps({ lap: laps[i - 1], prev: vals[i - 1], flag: 0, shown: false }, vals[i], tr, V.banner.total);
      assert.equal(next.lap, laps[i], `racer ${n} sample ${i}: the lap word after the step`);
      if (wrap) counted++; else kept++;
    }
  }
  assert.equal(counted, K.strictWraps, 'the wraps one tick apart');
  assert.ok(kept > 0 && skipped === K.wraps - K.strictWraps, 'the other pairs'); // @math some pairs without a wrap
  return { counted, kept, skipped };
}

// The start of a race: the grid value at the car record position is the player's start value, and at the camera it is not; the trailer is the track's.
function startCheck(dat, V, { atCamera = false } = {}) {
  const world = loadTrack(dat, '1'), car = createCar(world.start, world), at = atCamera ? cameraOf({ x: world.start.x, y: world.start.y, heading: world.start.heading }, world) : world.start;
  assert.equal(gridValue(world.pos, at.x, at.y), V.laps.playerStart, 'the grid value at the start');
  assert.equal(world.pos.trailer, V.laps.trailer, 'the trailer of track 1');
  assert.equal(createLaps(world.pos, at.x, at.y).lap, V.laps.startLaps, 'the lap word starts at 0');
  assert.ok(car.cx !== undefined);
}

// The laps menu choices map to the laps words seen in two observations.
function menuMapping(V) {
  assert.equal(V.rules.lapsMenuChoices, V.rules.lapsByChoice.length, 'a laps word for every choice');
  assert.equal(lapsTotal(1), V.banner.total, 'the laps word 6 of text.banner-observed is the first choice'); // @math the first choice
  assert.equal(lapsTotal(V.rules.lapsMenuChoices), V.finish.laps, 'the laps word 10 of devil.finish-observed is the last choice');
  assert.equal(V.rules.trailerWord, V.live.trailerOffset, 'the trailer word of pos.progress-live');
  assert.equal(V.rules.lapWord, V.live.layout.humanLapWord, 'the lap word');
  assert.equal(V.rules.valueWord, V.live.layout.humanValueWord, 'the value word');
  assert.equal(V.rules.flagWord, V.live.layout.flagWord, 'the flag word');
  assert.ok(isFinished(V.banner.total + V.rules.finishExtraLaps, V.banner.total) && !isFinished(V.banner.total, V.banner.total), 'the finish is the crossing after the last lap');
}

export default {
  id: 'port-laps',
  claims: ['pos.lap-observed', 'pos.progress-live'],
  obs: ['laps-1', 'progress-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    replayLookup(dat, ctx.obs('progress-1'), V);
    replayLaps(dat, ctx.obs('laps-1'), V);
    startCheck(dat, V);
    menuMapping(V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), progress = ctx.obs('progress-1'), laps = ctx.obs('laps-1');
    return [
      { label: 'the axes of the lookup swapped', fn: () => replayLookup(dat, progress, V, { swapAxes: true }) },
      { label: 'a recorded grid value altered', fn: () => replayLookup(dat, { ...progress, samples: progress.samples.map((s, i) => (i === 0 ? { ...s, racers: s.racers.map((x, k) => (k === 0 ? [x[0], x[1], x[2], x[3] + 1, x[4], x[5]] : x)) } : s)) }, V) }, // @math the first racer of the first sample
      { label: 'a trailer one lower', fn: () => replayLaps(dat, laps, V, { trailer: V.laps.trailer - 1 }) }, // @math one step lower
      { label: 'a recorded lap altered', fn: () => replayLaps(dat, { ...laps, laps: laps.laps.map((l, i) => (i === 100 ? l.map((x, n) => (n === 0 ? [x[0] + 1, x[1]] : x)) : l)) }, V) }, // @math the 100th sample, the player
      { label: 'the start looked up at the camera', fn: () => startCheck(dat, V, { atCamera: true }) },
      { label: 'one archive byte changed', fn: () => replayLookup(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), progress, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
