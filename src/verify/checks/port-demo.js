import assert from 'node:assert/strict';
import { loadTrack, archiveMembers } from '../../game/track-data.js';
import { lionBytes } from '../../game/start.js';
import { startRace, stepRace } from '../../game/race.js';
import { demoSpec, parseBmc, bmcStart, bmcStep } from '../../game/demo.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ replay: expected('demo.replay-observed') });
const SEED = 12345; // @math the seed of the computer racers' slots: the demo's racers are the ones the route placement gives (racer.start-grid), whatever the slots
const FRAME_BASE = 1; // @math the first frame of a race is 1 (the counter counts the call just run)
const ALTERED = 150; // @math a sample inside the first 260 frames, whose heading the variant alters

// The port's replay of one demo race: the race of the kind's track with the recorded driver, the class and the engine of the demos, the file's controls frame by frame; the state after each frame.
function replay(dat, V, kind, { frames, demo = true, detail = null, jiggle = 0, skip = 0 } = {}) {
  const members = archiveMembers(dat), spec = demoSpec(kind, V.race), file = members.get(`${spec.track}.BMC`);
  assert.equal(spec.track, V.track, 'the track the kind plays');
  assert.ok(file, `the demo file of the track ${spec.track}`);
  const state = { class: spec.class, engine: spec.engine, detail: detail ?? spec.detail, humanSlot: V.driver, seed: SEED, ...(demo ? { demo: {} } : {}) };
  startRace(state, { ...loadTrack(dat, String(spec.track), spec.engine, V.driver), lion: lionBytes(members) }, spec.laps);
  state.car = { ...state.car, jiggle }; state.player = { ...state.player, car: state.car };
  let bmc = bmcStart(parseBmc(file));
  for (let i = 0; i < skip; i++) bmc = bmcStep(bmc).state;
  const trace = [];
  for (let f = FRAME_BASE; f <= frames; f++) {
    const step = bmcStep(bmc); bmc = step.state;
    if (step.controls.end) break;
    const c = step.controls;
    stepRace(state, { accelerate: c.accelerate, brake: c.brake, left: c.left, right: c.right, spin: c.spin, fire: c.fire });
    trace.push({ cx: state.car.cx, cy: state.car.cy, heading: state.car.heading, throttle: state.car.throttle, speed: state.car.speed, pre: state.beforeAnswer });
  }
  return trace;
}

// Every sample of the demo is a state of the port's replay: the frame the counter names or the frame before it (a pause inside a frame shows the camera of the frame before and, after the
// control routine, the new throttle), or the car as the move left it when the frame ends with the answer to a racer's touch. The frames whose samples are none of these are returned.
function mismatches(record, V, trace) {
  const ix = Object.fromEntries(record.columns.map((c, i) => [c, i])), out = [];
  for (const s of record.samples) {
    const f = s[ix.frame];
    if (s[ix.mode] === 0 || s[ix.track] !== V.track || s[ix.driver] !== V.driver || f < FRAME_BASE || f > trace.length) continue;
    const a = trace[f - FRAME_BASE], b = trace[f - FRAME_BASE - 1], p = a?.pre;
    const pos = u => u && u.cx === s[ix.cameraX] && u.cy === s[ix.cameraY] && u.heading === s[ix.heading], ctl = u => u && u.throttle === s[ix.throttle] && u.speed === s[ix.speed];
    if (!((pos(a) && ctl(a)) || (pos(b) && ctl(b)) || (pos(b) && ctl(a)) || (pos(p) && ctl(p)))) out.push(f);
  }
  return [...new Set(out)];
}

function samplesOf(record, V) {
  const ix = Object.fromEntries(record.columns.map((c, i) => [c, i]));
  return record.samples.filter(s => s[ix.mode] !== 0 && s[ix.track] === V.track && s[ix.driver] === V.driver).length;
}

function run(dat, record, R, V, options = {}) {
  assertArchive(record, dat);
  const trace = replay(dat, V, R.kind, { frames: V.frames, ...options }), bad = mismatches(record, V, trace);
  assert.deepEqual(bad, V.unmatched, `${record.id} track ${V.track}: the frames whose samples are not a state of the replay`);
  return trace;
}

export default {
  id: 'port-demo',
  claims: ['demo.replay-observed'],
  obs: ['demo-1', 'demo-2'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) {
    const R = values().replay, dat = await ctx.open('WACKY.DAT');
    assert.deepEqual(R.records.map(r => r.id), ['demo-1', 'demo-2']);
    for (const rec of R.records) {
      const record = ctx.obs(rec.id);
      for (const V of rec.demos) {
        const trace = run(dat, record, rec, V);
        assert.ok(trace.length >= V.frames - 1, `${rec.id} track ${V.track}: the replay ran the frames the samples cover`);
        assert.equal(samplesOf(record, V), V.samples, `${rec.id} track ${V.track}: the samples of the demo`);
      }
    }
  },
  async discriminate(ctx) {
    const R = values().replay, dat = await ctx.open('WACKY.DAT');
    const [one, two] = R.records.map(r => [r, ctx.obs(r.id), r.demos[0]]);
    const first = [one[0], one[1], { ...one[2], frames: 260, unmatched: [] }], second = [two[0], two[1], { ...two[2], frames: 150, unmatched: two[2].unmatched.filter(f => f <= 150) }]; // @math the frames of the first contacts and of the standing steering, which the variants must change
    const third = [R.records[1], ctx.obs('demo-2'), R.records[1].demos[2]]; // @math the third demo of the attract record, track 4: its ends hold the refused item's bump and the wall feelers
    const alter = ([R_, record, V], n, column, f) => [R_, { ...record, samples: record.samples.map((s, i) => (i === n ? s.map((v, j) => (j === record.columns.indexOf(column) ? f(v) : v)) : s)) }, V];
    const go = ([R_, record, V], options) => () => run(dat, record, R_, V, options);
    return [
      { label: 'a demo race that lets a standing car steer (the mode word 0)', fn: go(first, { demo: false }) },
      { label: 'the detail level 1 (the steering rate 40)', fn: go(first, { detail: 1 }) },
      { label: 'the car\'s jiggle flag the other way at the start', fn: go(first, { jiggle: 1 }) },
      { label: 'the demo file one frame early', fn: go(first, { skip: 1 }) },
      { label: 'the attract race with the jiggle flag the other way', fn: go(second, { jiggle: 1 }) },
      { label: 'a recorded heading altered', fn: go(alter(first, ALTERED, 'heading', v => v + 1)) },
      { label: 'the track 4 attract demo with the file one frame early', fn: go(third, { skip: 1 }) },
    ];
  },
};
