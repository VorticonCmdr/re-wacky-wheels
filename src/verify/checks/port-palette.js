import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { decodePcxMember } from '../../formats/pcx.js';
import { createCycle, stepCycle, cycleName } from '../../game/palette-cycle.js';
import { loadTrack, archiveMembers } from '../../game/track-data.js';
import { lionBytes } from '../../game/start.js';
import { startRace, stepRace, beginIntro } from '../../game/race.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ R: expected('palette.cycle-replay'), O: expected('palette.cycle-observed'), S: expected('palette.cycle-start-replay') });

// The recorded samples through the port's cycler (palette.cycle-replay): the shoot-out race of dac-1 has no intro and no countdown, so the frame of the counter value c has made c + 1 calls once it is done.
function replay(dat, r, V, { delays, palette = null, startCount = V.R.startCount, offset = 0 } = {}) {
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), gam = parseGam(members.get(`${r.track}.GAM`)), beach = decodePcxMember(members.get(cycleName()));
  assertArchive(r, dat);
  assert.equal(gam.flag, 1, 'the cycling flag');
  const pal = palette ?? beach.vga, ds = delays ?? gam.extra;
  let cycle = createCycle(gam.flag, ds, pal); cycle = { ...cycle, count: startCount };
  const states = [cycle];
  for (let n = 1; n <= r.samples[r.samples.length - 1].tick + 2; n++) { cycle = stepCycle(cycle); states.push(cycle); } // @math two calls past the last sample
  const fits = (s, calls) => { const e = states[calls].entries; return [...e].every(([entry, c]) => s.dac[entry - r.from].join() === c.join()) && e.size > 0; };
  const plusOne = [], plain = [];
  for (const s of r.samples) { if (fits(s, s.tick + 1 + offset)) plusOne.push(s.tick); else if (fits(s, s.tick + offset)) plain.push(s.tick); else assert.fail(`tick ${s.tick}: no state fits`); }
  return { plusOne, plain };
}

// The demo race of dacrace-1 through the port's own race (palette.cycle-start-replay): the intro's passes, the countdown and the race frames, each a call of stepRace, with the cycled entries after every call.
function replayStart(dat, r, V, { skipIntro = false, offset = 0 } = {}) {
  const S = V.S, members = archiveMembers(dat), state = { class: S.class, engine: S.engine, detail: S.detail, humanSlot: S.driver, seed: S.seed, demo: {} };
  assertArchive(r, dat);
  startRace(state, { ...loadTrack(dat, String(r.track), S.engine, S.driver), lion: lionBytes(members) }, S.laps);
  beginIntro(state);
  const trace = [new Map(state.cycle.entries)]; let passes = 0;
  while (state.intro && passes < S.intro * 2) { stepRace(state, {}); passes++; trace.push(new Map(state.cycle.entries)); } // @math twice the intro's passes bounds the loop
  for (let t = 1; t <= r.samples[r.samples.length - 1].tick + 2; t++) { stepRace(state, {}); trace.push(new Map(state.cycle.entries)); } // @math two frames past the last sample
  const fits = (s, calls) => trace[calls] !== undefined && [...trace[calls]].every(([entry, c]) => s.dac[r.entries.indexOf(entry)].join() === c.join());
  const plusOne = [], plain = [], modes = [0, 0, 0]; // @math the intro, the countdown and the race modes
  for (const s of r.samples) {
    modes[s.mode]++;
    if (s.mode < 1) continue; // the intro's samples show the palette fade
    const calls = (skipIntro ? 0 : passes) + s.tick + offset;
    if (fits(s, calls + 1)) plusOne.push(s.tick); else if (fits(s, calls)) plain.push(s.tick); else assert.fail(`counter ${s.tick} (mode ${s.mode}): no state fits`);
  }
  return { passes, modes, plusOne: plusOne.length, plain: plain.length };
}

function validateStart(dat, r, V, options) {
  const got = replayStart(dat, r, V, options), S = V.S;
  assert.equal(got.passes, S.intro, 'the intro\'s passes'); assert.deepEqual(got.modes, S.modes, 'the samples of the three modes');
  assert.equal(got.plusOne, S.atCallsPlusOne, 'the samples after the passes + c + 1 calls'); assert.equal(got.plain, S.atCalls, 'the samples one call earlier');
}

function validate(dat, r, V, options) {
  const got = replay(dat, r, V, options), R = V.R;
  assert.equal(r.samples.length, R.samples, 'the samples');
  assert.equal(got.plusOne.length, R.atCountPlusOne, 'the samples after c + 1 calls');
  assert.deepEqual(got.plain, R.atCountSamples, 'the samples one call earlier');
  assert.equal(got.plain.length, R.atCount, 'their number');
}

export default {
  id: 'port-palette',
  claims: ['palette.cycle-replay', 'palette.cycle-start-replay'],
  obs: ['dac-1', 'dacrace-1'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { const dat = await ctx.open('WACKY.DAT'), V = values(); validate(dat, ctx.obs('dac-1'), V); validateStart(dat, ctx.obs('dacrace-1'), V); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('dac-1'), V = values();
    const beach = decodePcxMember(new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get(cycleName())).vga;
    const shifted = Uint8Array.from(beach.slice(3)); // @math one colour of three bytes
    return [
      { label: 'the delays 3, 4, 2', fn: () => validate(dat, r, V, { delays: [3, 4, 2] }) }, // @math the delays swapped
      { label: 'the delays 2, 2, 3', fn: () => validate(dat, r, V, { delays: [2, 2, 3] }) }, // @math the wait in the state 3 as the delay

      { label: 'the colours moved by one', fn: () => validate(dat, r, V, { palette: shifted }) },
      { label: 'the start count 0', fn: () => validate(dat, r, V, { startCount: 0 }) },
      { label: 'one call off', fn: () => validate(dat, r, V, { offset: 1 }) },
      { label: 'an archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
      { label: 'the intro\'s passes not counted', fn: () => validateStart(dat, ctx.obs('dacrace-1'), V, { skipIntro: true }) },
      { label: 'one call off (start)', fn: () => validateStart(dat, ctx.obs('dacrace-1'), V, { offset: 1 }) },
    ];
  },
};
