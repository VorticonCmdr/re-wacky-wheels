import assert from 'node:assert/strict';
import { crc32 } from '../../evidence/crc32.js';
import { archiveMembers, loadTrack } from '../../game/track-data.js';
import { createCar } from '../../game/car.js';
import { viewSetup } from '../../game/view.js';
import { createAi, stepAi } from '../../game/ai.js';
import { createLaps, lapsTotal } from '../../game/laps.js';
import { createStart, stepStart, idleFrame, idlePlayer, lionBytes, lionFrame, starterRecord } from '../../game/start.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ rules: expected('race.start-rules'), seen: expected('race.start-observed'), idle: expected('race.idle-observed'), motion: expected('ai.motion-observed') });
const COLUMN = { tick: 0, mode: 1, timer: 2, lion: 3, starter: 5, racers: 6, camera: 7 }; // @math the columns of a startseq row
const RACER = { mode: 0, state: 1, offset: 2, x: 3, y: 4, frame: 5 }; // @math the fields of a racer in a row
const STARTER = { left: 0, top: 1, sizeClass: 2, distance: 3, at: 4, crc: 5 }; // @math the fields of the starter in a row
const SLOT_FRAMES = 12; // @math the twelve frames of a slot of CARS.SP (cars.frames)
const PLAYER_SLOT = 0; // @math racer 0 is the player
const KEEPERS = [2, 3, 5, 6, 7]; // @math the racers that follow the rule to the 41st frame and show the normal frame after it (race.idle-observed)

const world = (dat) => ({ ...loadTrack(dat, '1'), lion: lionBytes(archiveMembers(dat)) });

// The port's start state after each frame counter value: `states[T]` is the state when the counter reads T, and `racing[T]` whether frame T ran the cars.
function timeline(frames) {
  let start = createStart();
  const states = [start], racing = [false];
  for (let t = 1; t <= frames; t++) { const out = stepStart(start); start = out.start; states.push(start); racing.push(out.racing); }
  return { states, racing };
}

// Every row: the frame counter, the mode word and the starter's frame word are the port's; the 10 Hz counter stays at 1 or less up to the quiet tick.
function replayTimeline(r, V, dat) {
  assertArchive(r, dat);
  const { states } = timeline(r.rows.at(-1)[COLUMN.tick]);
  assert.equal(V.motion.startTick, V.rules.readyTicks, 'ai.motion-observed starts the racing frame after the counter value the starter rule sets the mode on');
  assert.equal(V.seen.quiet, V.rules.readyTicks, 'the quiet frames of the record are the starter rule\'s');
  r.rows.forEach((row, i) => {
    const t = row[COLUMN.tick];
    assert.equal(t, i, 'a row for every frame counter value');
    assert.equal(row[COLUMN.mode], states[t].mode, `frame ${t}: the mode word`);
    assert.equal(row[COLUMN.lion], states[t].lion, `frame ${t}: the starter's frame word`);
    if (t <= V.seen.quiet) assert.ok(row[COLUMN.timer] <= V.seen.timer.most, `frame ${t}: the 10 Hz counter`);
    for (const x of row[COLUMN.racers]) if (t <= V.seen.quiet) assert.equal(x[RACER.state], 0, `frame ${t}: the state words`);
  });
  assert.deepEqual(r.slots, V.seen.slots, 'the slots of the racers');
  assert.ok(r.rows.at(-1)[COLUMN.timer] > V.seen.timer.most, 'the 10 Hz counter counts on after the start');
}

// The starter's draw record from the player's start camera against the recorded one, and the picture bytes against the archive's.
function replayLion(r, V, dat, { record = r, member = null } = {}) {
  assertArchive(r, dat);
  const w = world(dat), L = V.seen.lion, car = createCar(w.start, w), camera = { x: car.cx, y: car.cy, heading: car.heading }, view = viewSetup(w, camera);
  const { states } = timeline(record.rows.at(-1)[COLUMN.tick]), wb = member ? { ...w, lion: member } : w;
  const seen = new Map();
  for (const row of record.rows) {
    const t = row[COLUMN.tick], s = row[COLUMN.starter];
    assert.ok(s, `frame ${t}: the starter is in the draw list`);
    const anchor = { x: row[COLUMN.racers][PLAYER_SLOT][RACER.x], y: row[COLUMN.racers][PLAYER_SLOT][RACER.y] };
    assert.deepEqual([anchor.x, anchor.y], [w.start.x, w.start.y], `frame ${t}: racer 0 is at the player's start`);
    const rec = starterRecord(wb, view, camera, anchor, states[t].lion);
    assert.ok(rec, `frame ${t}: the starter is projected`);
    assert.deepEqual([rec.left, rec.top, rec.sizeClass, rec.distance], [s[STARTER.left], s[STARTER.top], s[STARTER.sizeClass], s[STARTER.distance]], `frame ${t}: the starter's left column, top row, size class and distance`);
    assert.deepEqual([rec.width, rec.height], L.size, `frame ${t}: the starter's size`);
    const C = V.rules.cut, at = C.lights * C.lightBytes + C.tiles * C.tileBytes + states[t].lion * C.frameBytes;
    assert.equal(s[STARTER.at], at, `frame ${t}: the starter's picture offset in GENEF.SP`);
    assert.equal(lionFrame(wb, states[t].lion).length, C.frameBytes, 'the picture is cut whole');
    if (s[STARTER.crc] !== undefined) { assert.equal(crc32(rec.frame), s[STARTER.crc], `frame ${t}: the CRC-32 of the starter's picture`); seen.set(states[t].lion, s[STARTER.crc]); }
  }
  return seen;
}

// The computer racers' positions at every row equal the walk of ai.motion-observed from the race start: standing on the grid up to the quiet tick, one step of the walk for every frame after it.
function replayMoves(r, V, dat, { record = r } = {}) {
  assertArchive(r, dat);
  const w = world(dat), { states, racing } = timeline(record.rows.at(-1)[COLUMN.tick]), laps = createLaps(w.pos, w.start.x, w.start.y);
  let ai = createAi(w);
  const walk = [ai];
  for (let t = 1; t < states.length; t++) {
    if (racing[t]) ai = stepAi(ai, { pos: w.pos, trailer: w.pos.trailer, total: lapsTotal(1), playerKey2: laps.key2, playerPlace: 8 }).ai; // @math the place of the last car at the start
    walk.push(ai);
  }
  record.rows.forEach(row => {
    const t = row[COLUMN.tick];
    row[COLUMN.racers].forEach((x, n) => { if (n > 0) assert.deepEqual([x[RACER.x], x[RACER.y]], [walk[t].racers[n].x, walk[t].racers[n].y], `frame ${t}: racer ${n}'s position`); });
  });
  const M = V.seen.move, first = record.rows.filter(row => row[COLUMN.tick] >= V.seen.quiet && row[COLUMN.tick] < V.seen.quiet + M.y.length);
  assert.deepEqual(first.map(row => row[COLUMN.racers][1][RACER.y]), M.y, 'racer 1\'s y at the quiet tick and the two after it');
  assert.deepEqual(first.map(row => row[COLUMN.racers][1][RACER.x]), M.x, 'racer 1\'s x at the quiet tick and the two after it');
  assert.equal(V.seen.firstMove, V.seen.quiet + 1, 'the first move is the frame after the quiet tick'); // @math one frame
}

// The picture each drawn racer shows (the frame pointer in the draw record, in frames of its slot).
const jOf = (x, slot) => x[RACER.frame] - slot * SLOT_FRAMES;

function pictureAt(r, V, row, n, slots, back = 0) {
  const x = row[COLUMN.racers][n], t = row[COLUMN.tick] - back;
  if (x[RACER.frame] < 0) return null;
  const j = jOf(x, slots[n]), want = n === 0 ? (idlePlayer(t) === null ? null : idlePlayer(t)[1] - slots[n] * SLOT_FRAMES) : idleFrame(t, x[RACER.mode]);
  return { j, want: want === null ? V.idle.normalFrame : want, t };
}

// race.idle-observed: the rule up to the quiet tick in start-4 and start-5, the listed deviations of start-6, the racers that keep it to the 41st frame, the normal frames after.
function replayIdle(records, V, dat, { alter = null } = {}) {
  records.forEach(r => assertArchive(r, dat));
  const exactRecords = records.filter(r => r.id !== V.seen.idleDeviations.record), slots = V.seen.slots;
  for (const r of exactRecords) {
    for (const row of r.rows) {
      const t = row[COLUMN.tick];
      for (let n = 0; n < slots.length; n++) {
        let p = pictureAt(r, V, row, n, slots);
        if (!p) continue;
        if (alter && alter(r.id, t, n)) p = { ...p, j: p.j + 1 };
        if (t === V.seen.quiet + 1) { // the frame after the quiet one: the picture of this frame or of the one before (a step of the cycle behind in these two records)
          const before = pictureAt(r, V, row, n, slots, 1);
          if (n === 0 || KEEPERS.includes(n) || n === 1) assert.ok(p.j === p.want || p.j === before.want, `${r.id} frame ${t}: racer ${n}'s picture`);
        } else if (n === 0 || t <= V.seen.quiet || (KEEPERS.includes(n) && t <= V.idle.racersLast + 1)) assert.equal(p.j, p.want, `${r.id} frame ${t}: racer ${n}'s picture`);
      }
    }
  }
  const dev = records.find(r => r.id === V.seen.idleDeviations.record);
  if (dev) {
    const found = new Map();
    for (const row of dev.rows) {
      const t = row[COLUMN.tick];
      if (t > V.seen.quiet) continue;
      for (let n = 0; n < slots.length; n++) { const p = pictureAt(dev, V, row, n, slots); if (p && p.j !== p.want) { if (!found.has(t)) found.set(t, []); found.get(t).push(n); } }
    }
    assert.deepEqual([...found.entries()], V.seen.idleDeviations.rows, `${dev.id}: the racers that deviate from the rule, by frame`);
  }
  // the idle pictures are frames 8 to 11 in every row of every record
  for (const r of records) for (const row of r.rows) if (row[COLUMN.tick] <= V.seen.quiet) for (let n = 0; n < slots.length; n++) { const x = row[COLUMN.racers][n]; if (x[RACER.frame] >= 0) { const j = jOf(x, slots[n]); assert.ok(j >= V.idle.base && j < V.idle.base + 2 * V.idle.side, `${r.id} frame ${row[COLUMN.tick]}: racer ${n} shows a frame 8 to 11`); } } // @math four idle frames
}

export default {
  id: 'port-start',
  claims: ['race.start-observed', 'race.idle-observed'],
  obs: ['start-4', 'start-5', 'start-6'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), records = V.seen.records.map(id => ctx.obs(id));
    assert.deepEqual(records.map(r => r.rows.length), V.seen.rows, 'the rows of each record');
    records.forEach(r => replayTimeline(r, V, dat));
    const crcs = records.map(r => replayLion(r, V, dat)).find(m => m.size);
    assert.deepEqual(V.seen.lion.steps.map(step => crcs.get(V.seen.lion.frames[V.seen.lion.steps.indexOf(step)])), V.seen.lion.crc, 'the CRC-32 of the starter\'s three pictures');
    records.forEach(r => replayMoves(r, V, dat));
    replayIdle(records, V, dat);
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT'), records = V.seen.records.map(id => ctx.obs(id)), [a, , c] = records;
    const withRows = (rec, patch) => ({ ...rec, rows: rec.rows.map(patch) });
    const flip = (bytes, at) => Uint8Array.from(bytes, (v, i) => (i === at ? v ^ 1 : v)); // @math flip the lowest bit
    const w = world(dat), C = V.rules.cut, at = C.lights * C.lightBytes + C.tiles * C.tileBytes + C.frameBytes; // the second picture
    return [
      { label: 'a recorded mode word altered', fn: () => replayTimeline(withRows(a, row => (row[COLUMN.tick] === 20 ? row.map((v, i) => (i === COLUMN.mode ? v + 1 : v)) : row)), V, dat) }, // @math frame 20
      { label: 'a recorded starter frame altered', fn: () => replayTimeline(withRows(a, row => (row[COLUMN.tick] === 17 ? row.map((v, i) => (i === COLUMN.lion ? 0 : v)) : row)), V, dat) }, // @math frame 17, the first of the second picture
      { label: 'a recorded racer position altered', fn: () => replayMoves(withRows(a, row => (row[COLUMN.tick] === 40 ? row.map((v, i) => (i === COLUMN.racers ? v.map((x, n) => (n === 3 ? x.map((y, k) => (k === RACER.y ? y + 1 : y)) : x)) : v)) : row)), V, dat) }, // @math frame 40, racer 3
      { label: 'the starter\'s left column altered', fn: () => replayLion(withRows(c, row => row.map((v, i) => (i === COLUMN.starter ? v.map((x, k) => (k === STARTER.left ? x + 1 : x)) : v))), V, dat) }, // @math one column
      { label: 'a byte of the starter\'s second picture changed', fn: () => replayLion(c, V, dat, { member: flip(w.lion, at + C.frameBytes / 2) }) }, // @math the middle of the picture
      { label: 'a racer\'s picture altered', fn: () => replayIdle(records, V, dat, { alter: (id, t, n) => id === 'start-5' && t === 12 && n === 5 }) }, // @math frame 12, racer 5
    ];
  },
};
