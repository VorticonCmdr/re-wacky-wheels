import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { createAi, stepAi, rankPlayer } from '../../game/ai.js';
import { racerFrame, compassSector, frameTable, racerRecords } from '../../game/racers.js';
import { viewSetup } from '../../game/view.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ motion: expected('ai.motion-observed'), rules: expected('ai.rules'), setup: expected('ai.speed-setup'), surface: expected('ai.surface-slowdown'), shot: expected('item.racer-hit-observed'), banner: expected('text.banner-observed'), frames: expected('racer.frames'), frameObs: expected('racer.frame-observed'), progress: expected('pos.progress-live') });
const START_PLACE = 8; // @math the place word of every HUD record of a fresh race (grid-1: 8): the player starts last
const LEVEL_WORD = 4; // @math the word +8 is the fifth of the columns the record read
const REPLACED_FROM = 2; // @math the first pause whose speed words are table values: the third (ai.race-speeds: the earlier pauses hold the indices)
const FAR_BEHIND = -1e9; // @math a player key so low that no racer is ever behind it by the helper's threshold (state 3 was never seen in aistate-1)

// The level word: ai.rules says 89, the words of ai.surface-slowdown (racer 1's slow word 25 = level - 4 - 10 x 6) and the record agree.
function levelCheck(V, recordLevel) {
  const L = V.rules.level, S = V.setup;
  assert.equal(V.surface.baseC[0] + S.slowOffset + S.rankStep * (V.rules.lastRacer - V.rules.firstRacer), L, 'the level of ai.rules is the one the racers\' words of ai.surface-slowdown give');
  if (recordLevel !== undefined) assert.equal(recordLevel, L, 'the level word of the record');
}

// The AI from the race start for `frames` frames; `envAt(f, ai, place)` gives the player's side of the helper's inputs.
function simulate(world, frames, envAt, options = {}) {
  let ai = createAi(world, options), place = START_PLACE;
  const states = [ai], events = new Set();
  for (let f = 1; f <= frames; f++) {
    const env = envAt(f, ai, place), out = stepAi(ai, { pos: world.pos, trailer: world.pos.trailer, total: env.total, playerKey2: env.key2, playerPlace: place });
    ai = out.ai; out.events.forEach(e => events.add(e));
    place = rankPlayer([env.key1, ...ai.racers.slice(1).map(r => r.key1)], place);
    states.push(ai);
  }
  return { states, events };
}

// laps-1: the lap and grid value of racers 1 to 7 at every pause equal the simulation's after (tick - the quiet tick) frames; the pause between two racers' updates of a frame is
// the only kind of difference, and it is found by the split.
function replayLaps(dat, r, V, { startTick = V.motion.startTick, level = V.rules.level, speedShift = 0, routeShift = 0, record = r } = {}) {
  assertArchive(r, dat);
  levelCheck(V, undefined);
  assert.equal(V.motion.startTick, V.shot.quietUntil, 'the first racing frame is the one after the quiet tick of item.racer-hit-observed');
  const world = loadTrack(dat, record.names.track), ticks = record.ticks.map(t => t[1]), rows = record.laps, trailer = world.pos.trailer;
  const w = { ...world, aiSpeeds: world.aiSpeeds.map(v => v + speedShift), route: routeShift ? world.route.map((rec, i) => (i === 0 ? rec.map((x, k) => (k === 0 ? x + routeShift : x)) : rec)) : world.route };
  const total = V.banner.total, shift = V.rules.lapShift;
  const playerAt = tick => { let k = 0; while (k + 1 < ticks.length && ticks[k + 1] <= tick) k++; return rows[k][0]; };
  const { states, events } = simulate(w, ticks.at(-1) - startTick, (f) => { const [lap, v] = playerAt(startTick + f); return { total, key1: lap * (1 << shift) + v, key2: lap * trailer + v }; }, { level });
  assert.equal(events.size, 0, 'the push, the helper and state 3 never happen in this record');
  const racers = V.motion.laps.racers, same = (a, row, n) => a.racers[n].lap === row[n][0] && a.racers[n].prev === row[n][1];
  let misses = 0; const found = [];
  rows.forEach((row, i) => {
    const F = ticks[i] - startTick, exact = states[F], wrong = [];
    for (let n = V.rules.firstRacer; n <= racers; n++) if (!same(exact, row, n)) wrong.push(n);
    misses += wrong.length;
    if (wrong.length) {
      // a pause between two racers' updates of the frame: racers 1 to k as of this frame, the others as of the frame before (the largest k that fits)
      let split = -1;
      for (let k = racers; k >= 0 && split < 0; k--) { const ok = Array.from({ length: racers }, (_, j) => j + 1).every(n => same(n <= k ? exact : states[F - 1], row, n)); if (ok) split = k; }
      found.push({ sample: i, tick: ticks[i], racers: wrong, split });
    }
  });
  assert.equal(rows.length, V.motion.laps.samples, 'the samples');
  assert.deepEqual([misses, found.length], [V.motion.laps.misses, 1], 'the readings that differ, in one pause');
  assert.deepEqual([found[0].sample, found[0].tick, found[0].racers, found[0].split], [V.motion.laps.missSample, V.motion.laps.missTick, V.motion.laps.missRacers, V.motion.laps.split], 'that pause, its racers and the split of the frame');
  assert.deepEqual(rows.at(-1).slice(V.rules.firstRacer).map(x => x[0]), Array(racers).fill(V.motion.laps.endLap), 'each computer racer ends on its fifth lap');
}

// aistate-1: every AI word of racers 1 to 7 equals the simulation's at an increasing frame for each of the first pauses; the next pause has only racer 2 off.
const wordsOf = (r, ai) => { const e = ai.entries[r.entry]; return [r.mode, r.state, r.first, r.second, e.points.length - r.index, r.lateral & 0xffff, r.entry, r.level, r.fast, r.slow]; }; // @math the lateral word is read as 16 bits
function replayWords(dat, r, V, { level = V.rules.level, startShift = 0, routeShift = 0, record = r } = {}) {
  assertArchive(r, dat);
  levelCheck(V, record.samples[0].level);
  const world = loadTrack(dat, record.names.track), moved = { ...world, start: { ...world.start, x: world.start.x + startShift }, route: routeShift ? world.route.map((rec, i) => (i === 0 ? rec.map((x, k) => (k === 0 ? x + routeShift : x)) : rec)) : world.route };
  const maxFrame = 140; // @math enough frames to pass the pauses compared
  const { states, events } = simulate(moved, maxFrame, () => ({ total: V.banner.total, key1: FAR_BEHIND, key2: FAR_BEHIND }), { level });
  assert.equal(events.size, 0, 'no push in the first frames');
  assert.ok(record.samples.slice(0, REPLACED_FROM).every(s => s.racers.slice(V.rules.firstRacer).every(w => w[LEVEL_WORD] === level)), 'the first two pauses still hold the level index in the word +8');
  assert.ok(record.samples.slice(REPLACED_FROM).every(s => s.racers.slice(V.rules.firstRacer).every(w => w[LEVEL_WORD] === states[0].racers[1].level)), 'from the third pause the word +8 holds the table value');
  const frames = [], mismatches = (words, f, from) => { const bad = []; for (let n = V.rules.firstRacer; n <= V.motion.laps.racers; n++) { const want = wordsOf(states[f].racers[n], states[f]), w = words[n], got = [w[0], w[2], w[3], w[7], w[8], w[9], w[10], w[4], w[5], w[6]]; const upto = from ? want.length : want.length - 3; if (want.slice(0, upto).some((x, k) => x !== got[k])) bad.push(n); } return bad; }; // @math the last three words are the speeds, which the record shows replaced from the sixth pause on
  let prev = 0;
  for (let i = 0; i < V.motion.words.pauses; i++) {
    const replaced = i >= REPLACED_FROM;
    let f = prev, bad = mismatches(record.samples[i].racers, f, replaced);
    while (bad.length && f < maxFrame) { f++; bad = mismatches(record.samples[i].racers, f, replaced); }
    assert.equal(bad.length, 0, `pause ${i}: every AI word of the racers 1 to 7 equals the simulation`);
    frames.push(f); prev = f;
  }
  assert.deepEqual(frames, V.motion.words.frames, 'the frames of the pauses');
  let best = [Infinity, -1, []];
  for (let f = prev; f <= maxFrame; f++) { const bad = mismatches(record.samples[V.motion.words.deviating].racers, f, true); if (bad.length < best[0]) best = [bad.length, f, bad]; }
  assert.equal(V.motion.words.deviating, V.motion.words.pauses, 'the first pause that differs is the one after the compared ones');
  assert.deepEqual(best.at(-1), [V.motion.words.racer], 'in the next pause only racer 2 differs');
}

// progress-1: in the first pauses the racers 3 to 7 are exactly where the simulation puts them, at increasing frames.
function replayPositions(dat, r, V, { level = V.rules.level, record = r } = {}) {
  assertArchive(r, dat);
  const world = loadTrack(dat, record.names.track), maxFrame = 360; // @math enough frames to pass the pauses compared
  const { states } = simulate(world, maxFrame, () => ({ total: V.banner.total, key1: FAR_BEHIND, key2: FAR_BEHIND }), { level });
  const racers = V.motion.positions.racers, frames = [];
  let prev = 0;
  for (let i = 0; i < V.motion.positions.pauses; i++) {
    let f = prev;
    const matching = ff => Array.from({ length: V.rules.lastRacer }, (_, k) => k + V.rules.firstRacer).filter(n => { const p = record.samples[i].racers[n], s = states[ff].racers[n]; return p[0] === s.x && p[1] === s.y; });
    const at = ff => matching(ff).join() === racers.join(); // exactly these racers match: the racers 1 and 2 do not
    while (f <= maxFrame && !at(f)) f++;
    assert.ok(f <= maxFrame, `pause ${i}: the racers ${racers} stand where the simulation puts them`);
    frames.push(f); prev = f;
  }
  assert.deepEqual(frames, V.motion.positions.frames, 'the frames of the pauses');
}

// horizon-14: the frame a computer car shows is the table's, in the camera's sector, for its compass word.
function replayFrames(dat, r, V, { sectorShift = 0, playerFrame = V.frameObs.playerFrame } = {}) {
  assertArchive(r, dat);
  const O = V.frameObs, h = r.horizon, F = V.frames, table = frameTable();
  assert.equal(r.id, O.record, 'the record the claim names');
  assert.equal(r.horizon.heading, O.heading, 'the heading of the record');
  assert.equal((compassSector(h.heading) + sectorShift) % F.rows, O.sector, 'the camera\'s compass sector'); // @math keep within the eight sectors
  assert.equal(table.length, F.rows, 'the table has a row for every sector');
  const TYPE = 18, RACER = 12, COMPASS = 2; // @math the words of a draw record (type, racer index) and the compass entry of camera.racers
  const player = h.drawList.find(rec => rec[TYPE] === 0), addr = rec => (rec[6] & 0xffff) + rec[7] * 0x10000; // @math the frame address dword of a draw record: words 6 and 7
  assert.ok(player, 'the player\'s record');
  for (const e of O.racers) {
    const rec = h.drawList.find(x => x[TYPE] === 1 && x[RACER] === e.racer);
    assert.ok(rec, `racer ${e.racer} is drawn`);
    const after = (addr(rec) - addr(player)) / O.frameBytes;
    assert.equal(after, e.after, `racer ${e.racer}: the frames after the player's`);
    assert.equal(h.camera.racers[e.racer][COMPASS], e.compass, `racer ${e.racer}: the compass word`);
    const frameInSlot = (after + playerFrame) % O.slotFrames;
    assert.equal(frameInSlot, e.frame, `racer ${e.racer}: the frame within its slot`);
    assert.equal(racerFrame(h.heading + sectorShift * F.sectorSize, e.compass, table), frameInSlot, `racer ${e.racer}: the table's frame for the compass word`);
  }
}

// grid-1 and grid-7: the port's draw records of the computer racers on the grid have the size, left column, top row, distance and size class of the recorded ones, and exactly the
// racers the game drew (racer 4's column is outside the screen). The frame pointers are not compared: the grid pauses fall in the countdown (racer.frames).
function replayRecords(dat, r, V, { shift = 0 } = {}) {
  assertArchive(r, dat);
  const h = r.horizon, world = loadTrack(dat, h.track), camera = { x: h.camera.x + shift, y: h.camera.y, heading: h.heading }, view = viewSetup(world, camera);
  const TYPE = 18, RACER = 12, FIELDS = [0, 1, 2, 3, 8, 13]; // @math the words of a draw record: type, racer index, and width, height, left, top, distance, size class
  const racers = h.camera.racers.map(([x, y, compass], n) => ({ n, x, y, compass })), got = racerRecords(world, view, camera, racers, h.heading, racers.map((_, n) => n));
  const want = h.drawList.filter(rec => rec[TYPE] === 1);
  assert.deepEqual(got.map(g => g.racer).sort(), want.map(w => w[RACER]).sort(), 'the racers drawn');
  for (const w of want) {
    const g = got.find(x => x.racer === w[RACER]);
    assert.deepEqual([g.width, g.height, g.left, g.top, g.distance, g.sizeClass], FIELDS.map(k => w[k]), `racer ${w[RACER]}: the size, left column, top row, distance and size class`);
  }
  assert.ok(want.length > 1, 'several racers'); // @math more than one
}

export default {
  id: 'port-ai',
  claims: ['ai.motion-observed', 'racer.frame-observed', 'view.car-column-observed'],
  obs: ['laps-1', 'aistate-1', 'progress-1', 'horizon-14', 'grid-1', 'grid-7'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    replayLaps(dat, ctx.obs('laps-1'), V);
    replayWords(dat, ctx.obs('aistate-1'), V);
    replayPositions(dat, ctx.obs('progress-1'), V);
    replayFrames(dat, ctx.obs('horizon-14'), V);
    replayRecords(dat, ctx.obs('grid-1'), V);
    replayRecords(dat, ctx.obs('grid-7'), V);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), laps = ctx.obs('laps-1'), words = ctx.obs('aistate-1'), positions = ctx.obs('progress-1'), frames = ctx.obs('horizon-14');
    const withRow = (rec, i, patch) => ({ ...rec, samples: rec.samples.map((s, k) => (k === i ? patch(s) : s)) });
    return [
      { label: 'the first racing frame a tick earlier', fn: () => replayLaps(dat, laps, V, { startTick: V.motion.startTick - 1 }) }, // @math one tick
      { label: 'the first racing frame a tick later', fn: () => replayLaps(dat, laps, V, { startTick: V.motion.startTick + 1 }) }, // @math one tick
      { label: 'a level of 88', fn: () => replayLaps(dat, laps, V, { level: V.rules.level - 1 }) }, // @math one level lower
      { label: 'the speeds one higher', fn: () => replayLaps(dat, laps, V, { speedShift: 1 }) }, // @math one more
      { label: 'a recorded lap altered', fn: () => replayLaps(dat, { ...laps, laps: laps.laps.map((l, i) => (i === 300 ? l.map((x, n) => (n === 4 ? [x[0] + 1, x[1]] : x)) : l)) }, V) }, // @math the 300th pause, racer 4
      { label: 'the route start one pixel on', fn: () => replayWords(dat, words, V, { routeShift: 1 }) }, // @math one pixel
      { label: 'the grid one pixel right', fn: () => replayWords(dat, words, V, { startShift: 1 }) }, // @math one pixel
      { label: 'a recorded sideways offset altered', fn: () => replayWords(dat, withRow(words, 3, s => ({ ...s, racers: s.racers.map((w, n) => (n === 4 ? w.map((x, k) => (k === 9 ? x + 1 : x)) : w)) })), V) }, // @math the fourth pause, racer 4, the offset word
      { label: 'a recorded position altered', fn: () => replayPositions(dat, withRow(positions, 2, s => ({ ...s, racers: s.racers.map((p, n) => (n === 5 ? [p[0] + 1, p[1], ...p.slice(2)] : p)) })), V) }, // @math the third pause, racer 5
      { label: 'the camera sector one on', fn: () => replayFrames(dat, frames, V, { sectorShift: 1 }) }, // @math one sector
      { label: 'the player\'s frame 5', fn: () => replayFrames(dat, frames, V, { playerFrame: V.frameObs.playerFrame + 1 }) }, // @math one frame
      { label: 'the camera one column on', fn: () => replayRecords(dat, ctx.obs('grid-1'), V, { shift: 12 }) }, // @math a shift that moves the racers' columns
      { label: 'one archive byte changed', fn: () => replayLaps(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), laps, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
