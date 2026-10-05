import assert from 'node:assert/strict';
import { loadTrack, archiveMembers } from '../../game/track-data.js';
import { lionBytes } from '../../game/start.js';
import { startRace, stepRace, beginIntro } from '../../game/race.js';
import { demoSpec, parseBmc, bmcStart, bmcStep } from '../../game/demo.js';
import { defaultSettings } from '../../game/menus.js';
import { loadHudArt } from '../../render/hud.js';
import { drawRaceFrame } from '../../render/race-frame.js';
import { crc32 } from '../../evidence/crc32.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ F: expected('port.frames-observed') });
const SEED = 12345; // @math the seed of the computer racers' slots: the records give the slots, so the seed is not used
const AFTER = 2; // @math frames replayed past the last sample, for the image a pause sees one tick late

// The port's own race through the demo's start (intro passes, countdown, race) with the screen drawn after every call, the way the page draws it: the CRC-32 of the 64000 index bytes of the frame after k calls.
// `carry` is the horizon pointer the race starts with (the previous race leaves it: horizon.scroll); the options are the variants the discriminators run.
function replay(dat, r, carry, { driver = r.driver, slots = r.slots, detail = null, switches = r.switches } = {}) {
  const members = archiveMembers(dat), spec = demoSpec('attract', r.track), settings = defaultSettings();
  settings.switches = switches.slice();
  const state = { class: spec.class, engine: spec.engine, detail: detail ?? spec.detail, humanSlot: driver, slots: slots.slice(), horizonCarry: carry, seed: SEED, dat, hudArt: loadHudArt(members), menu: { settings }, demo: { kind: 'attract', spec, mode: spec.mode, bmc: null, page: 1, pages: spec.pages.length, pictures: null, escape: false } };
  startRace(state, { ...loadTrack(dat, String(r.track), spec.engine, driver), lion: lionBytes(members) }, spec.laps);
  beginIntro(state);
  while (state.intro) stepRace(state, {}); // the intro's passes: the page shows them before the countdown, the records start in the countdown
  return { state, members, spec };
}

function run(dat, r, V, options = {}) {
  assertArchive(r, dat);
  const F = values().F, { state, members, spec } = replay(dat, r, options.carry ?? V.carry, options), index = new Uint8Array(F.screen), frames = [];
  let bmc = bmcStart(parseBmc(members.get(`${spec.track}.BMC`)));
  drawRaceFrame(state, index); frames.push(crc32(index));
  const last = r.samples[r.samples.length - 1].tick;
  for (let t = 1; t <= last + AFTER; t++) {
    const step = bmcStep(bmc); bmc = step.state;
    const c = step.controls;
    stepRace(state, { accelerate: c.accelerate, brake: c.brake, left: c.left, right: c.right, spin: c.spin, fire: c.fire });
    drawRaceFrame(state, index); frames.push(crc32(index));
  }
  const lag = options.lag ?? F.lag, out = { now: 0, before: 0, after: 0, unmatched: [] };
  r.samples.forEach((s, n) => {
    if (V.mode !== undefined && s.mode !== V.mode) return; // the records with the clock on are compared in the countdown only: the race's clock runs by the wall clock
    const at = s.tick - (s.mode === F.countdownMode ? lag.countdown : lag.racing); // the frame the counter names
    if (frames[at] === s.crc) out.now++; else if (frames[at - 1] === s.crc) out.before++; else if (frames[at + 1] === s.crc) out.after++; else out.unmatched.push(n); // @math one frame later: a pause after the page flip of the next frame
  });
  return out;
}

export default {
  id: 'port-frames',
  claims: ['port.frames-observed', 'effects.rear-switch'],
  obs: ['frames-t2', 'frames-t4', 'frames-t5', 'frames-c4', 'frames-c5'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) {
    const F = values().F, dat = await ctx.open('WACKY.DAT');
    assert.deepEqual(F.records.map(v => v.id), ['frames-t2', 'frames-t4', 'frames-t5', 'frames-c4', 'frames-c5']);
    for (const V of F.records) {
      const r = ctx.obs(V.id), got = run(dat, r, V);
      assert.equal(r.samples.length, V.samples, `${V.id}: the samples`);
      assert.equal(r.track, V.track, `${V.id}: the track`);
      assert.deepEqual(got, { now: V.now, before: V.before, after: V.after, unmatched: V.unmatched }, `${V.id}: the samples that are frames of the port's race`);
    }
  },
  async discriminate(ctx) {
    const F = values().F, dat = await ctx.open('WACKY.DAT'), [, four, five, clockFour] = F.records, go = (V, options) => () => assert.deepEqual(run(dat, ctx.obs(V.id), V, options), { now: V.now, before: V.before, after: V.after, unmatched: V.unmatched });
    return [
      { label: 'the horizon pointer one unit off at the start (track 4)', fn: go(four, { carry: four.carry + 1 }) }, // @math one unit
      { label: 'the horizon pointer one unit off at the start (track 5)', fn: go(five, { carry: five.carry - 1 }) }, // @math one unit
      { label: 'the counter named frame one later in the countdown', fn: go(five, { lag: { ...F.lag, countdown: F.lag.countdown - 1 } }) }, // @math one frame
      { label: 'the idle rear flame going on at the step that switches to the race (track 5)', fn: () => { const kept = globalThis.__DR_MUTATE__; globalThis.__DR_MUTATE__ = { id: 'effects.rear-switch', path: ['holdIdle'], variant: 'inc' }; try { go(five)(); } finally { if (kept === undefined) delete globalThis.__DR_MUTATE__; else globalThis.__DR_MUTATE__ = kept; } } },
      { label: 'the next driver slot for the human', fn: go(five, { driver: ctx.obs(five.id).driver + 1 }) }, // @math the next slot
      { label: 'the computer racers\' slots reversed', fn: go(four, { slots: ctx.obs(four.id).slots.slice().reverse() }) },
      { label: 'the high detail level', fn: go(four, { detail: 1 }) }, // @math the high level (the attract mode runs the medium one)
      { label: 'the clock switch off in the track 4 demo with the clock on', fn: go(clockFour, { switches: [1, 0, 1] }) }, // @math the switches of the earlier records: the clock off
      { label: 'an archive byte changed', fn: () => run(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), ctx.obs(four.id), four) }, // @math flip the lowest bit of the last byte
    ];
  },
};
export { run as replayFrames }; // for tuning the carries of the claim by hand
