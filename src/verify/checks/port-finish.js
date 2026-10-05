import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { createCar } from '../../game/car.js';
import { createStart, stepStart } from '../../game/start.js';
import { createPlayer, stepPlayer } from '../../game/player.js';
import { liveObjects } from '../../game/pickups.js';
import { createLaps, stepLaps, gridValue, stepFinish, NO_KEYS } from '../../game/laps.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ fin: expected('car.finish-observed'), model: expected('car.model') });
const COL = { tick: 0, mode: 1, finish: 2, lap: 3, timer: 4, final: 5, throttle: 6, speed: 7, crash: 8, accelerate: 9, x: 10, y: 11 }; // @math the columns of a finish record

// The port's frames from the countdown with the key down from the tick the record first shows it, the lap word written with the laps word: the state after every counter value.
function states(world, record, { keyShift = 0, noFinish = false } = {}) {
  const key = record.rows.find(r => r[COL.accelerate])[COL.tick] + keyShift, total = record.lapsWord, last = record.rows.at(-1)[COL.tick];
  let player = createPlayer(createCar(world.start, world), liveObjects(world)), start = createStart(), laps = { ...createLaps(world.pos, world.start.x, world.start.y), lap: record.lapsWord }, finished = false;
  const read = (accelerate) => ({ finish: finished ? 1 : 0, lap: laps.lap, throttle: player.car.throttle, speed: player.car.speed, x: player.car.px, y: player.car.py, accelerate: accelerate ? 1 : 0 });
  const out = [read(false)];
  for (let t = 1; t <= last; t++) {
    const step = stepStart(start); start = step.start;
    const fin = noFinish ? { finished: false, fresh: false } : stepFinish(finished, laps.lap, total);
    if (step.racing) finished = fin.finished;
    const keys = { ...NO_KEYS, accelerate: t >= key && !finished };
    player = stepPlayer(player, keys, world, { racing: step.racing, racers: [] }).player;
    if (step.racing) laps = stepLaps(laps, gridValue(world.pos, player.car.px, player.car.py), world.pos.trailer, total).laps;
    out.push(read(keys.accelerate));
  }
  return out;
}

function replay(dat, record, V, options = {}) {
  assertArchive(record, dat);
  const world = loadTrack(dat, record.names.track), sequence = states(world, record, options), D = V.fin;
  assert.equal(record.rows.length, D.rows, 'the rows');
  assert.equal(record.rows.at(-1)[COL.tick], D.lastTick, 'the last frame counter value');
  assert.equal(record.lapsWord, D.lapsWord, 'the laps word');
  let splits = 0;
  for (const r of record.rows) {
    const t = r[COL.tick], want = [r[COL.finish], r[COL.lap], r[COL.throttle], r[COL.speed], r[COL.x], r[COL.y], r[COL.accelerate]], at = n => { const s = sequence[n]; return [s.finish, s.lap, s.throttle, s.speed, s.x, s.y, s.accelerate]; };
    if (want.every((v, i) => v === at(t)[i])) continue;
    assert.ok(t > 0 && want.every((v, i) => v === at(t - 1)[i]), `frame ${t}: the port's state is ${JSON.stringify(at(t))}, not ${JSON.stringify(want)}`);
    splits++;
  }
  assert.equal(splits, D.splits, 'the rows that show the state of the call before');
  return sequence;
}

function facts(record, V, sequence) {
  const D = V.fin, rows = new Map(record.rows.map(r => [r[COL.tick], r])), first = sequence.findIndex(s => s.finish === 1);
  assert.equal(first, D.finishTick, 'the call that sets the finish flag');
  assert.equal(sequence[first - 1].lap, D.lapsWord + 1, 'the lap word reached the laps word plus 1 in the call before');
  assert.equal(sequence[first - 1 - 1].lap, D.lapsWord, 'and was the laps word the call before that');
  const row = rows.get(first), before = rows.get(first - 1);
  assert.equal(row[COL.final], D.finalTime, 'the final time');
  assert.ok(before[COL.timer] <= D.finalTime && D.finalTime <= row[COL.timer], 'the final time is the tick word of the call that sets the flag');
  assert.equal(row[COL.accelerate], 0, 'the key is ignored in the call that sets the flag');
  const coast = sequence.slice(first, first + V.model.cap / D.coastStep).map(s => s.throttle);
  assert.deepEqual(coast, Array.from({ length: coast.length }, (_, i) => Math.max(0, V.model.cap - D.coastStep * (i + 1))), 'the throttle falls by the coasting step a call'); // @math the throttle was at the cap
  const stop = sequence.findIndex((s, n) => n > first && s.throttle === 0);
  assert.equal(stop, D.stopTick, 'the throttle reaches 0');
  assert.ok(sequence.slice(stop).every(s => s.y === D.restRow), 'the car rests where it stopped');
  assert.ok(record.rows.filter(r => r[COL.tick] >= first).every(r => r[COL.mode] === 2 && r[COL.finish] === 1 && r[COL.crash] === 0), 'the race mode word stays 2 and the flag 1'); // @math the racing mode
}

export default {
  id: 'port-finish',
  claims: ['car.finish-observed'],
  obs: ['finish-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), record = ctx.obs(V.fin.record);
    facts(record, V, replay(dat, record, V));
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), record = ctx.obs(V.fin.record);
    const alter = (n, k, f) => ({ ...record, rows: record.rows.map((r, i) => (i === n ? r.map((v, j) => (j === k ? f(v) : v)) : r)) });
    return [
      { label: 'no finish: the key stays down', fn: () => replay(dat, record, V, { noFinish: true }) },
      { label: 'the key down a frame later', fn: () => replay(dat, record, V, { keyShift: 1 }) }, // @math one frame
      { label: 'a recorded speed altered', fn: () => replay(dat, alter(60, COL.speed, v => v + 1), V) }, // @math the 60th row
      { label: 'a recorded row altered', fn: () => replay(dat, alter(70, COL.y, v => v + 1), V) }, // @math the 70th row
      { label: 'a recorded lap altered', fn: () => replay(dat, alter(45, COL.lap, v => v + 1), V) }, // @math the 45th row
    ];
  },
};
