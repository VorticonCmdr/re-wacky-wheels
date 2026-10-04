import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ f: expected('devil.finish-observed'), d: expected('devil.draw-observed'), banner: expected('text.banner-observed') });
const TOOL = { lap: 0x84c2, laps: 0x28b9c, driver: 0x84f4, flag: 0x8500, frame: 0x8504, step: 0x8508, lapCounted: 0x84b4 }; // @math the words observe.mjs --extra5 reads

function validate(dat, r, V, { offset = V.f.stepOffset, modulus = V.f.frameModulus } = {}) {
  const F = V.f, c = Object.fromEntries(r.columns.map((n, i) => [n, i])), S = r.samples;
  assertArchive(r, dat);
  assert.deepEqual([F.lapWord, F.lapsWord, F.driverWord, F.frameWord, F.stepWord], [TOOL.lap, TOOL.laps, TOOL.driver, TOOL.frame, TOOL.step], 'the words the tool read');
  assert.equal(F.flagWord, TOOL.lapCounted, 'the lap-counted word the tool read');
  assert.deepEqual([F.driverWord, F.frameWord, F.stepWord], [V.d.driverWord, V.d.frameWord, V.d.stepWord], 'the words of devil.draw-observed');
  assert.equal(F.lapsWord, V.banner.totalWord, 'the laps word of text.banner-observed');
  assert.equal(F.lapWord, V.banner.lapWord, 'the lap word of text.banner-observed');
  assert.equal(S.length, F.samples, 'the samples');
  assert.ok(S.every(s => s[c.laps28b9c] === F.laps), 'the laps word is 10 throughout');
  assert.equal(S[0][c.lap84c2], F.startLap, 'the lap word written');
  assert.equal(F.startLap + 1, F.laps, 'one below the laps word'); // @math one lap to go
  const cross = S.findIndex(s => s[c.lap84c2] === F.laps);
  assert.equal(S[cross][c.tick], F.crossTick, 'the line is crossed at tick 47');
  assert.ok(S.slice(0, cross).every(s => s[c.driver84f4] === 0 && s[c.word84b4] === 0), 'before the crossing: no figure and the flag word 0');
  assert.equal(cross, F.quiet, 'the pauses before the crossing');
  const on = S.slice(cross);
  assert.ok(on.every(s => s[c.driver84f4] === F.driver && s[c.flag8500] === F.flag && s[c.word84fc] === F.word84fc && s[c.word84b4] === 1), 'from the crossing: driver 7, flag 0, +0x84fc 6, +0x84b4 1'); // @math the flag word becomes 1
  assert.equal(on.length, F.withFigure, 'the pauses with the figure on');
  let exact = 0, late = 0, last = 0;
  for (const s of on) {
    const k = s[c.step8508] - (s[c.tick] - offset);
    if (k === 0) exact++; else { assert.equal(k, -1, 'at most one tick behind'); late++; } // @math one update behind
    if (s[c.step8508] > 0) assert.equal(s[c.frame8504], s[c.step8508] % modulus, 'the frame is the step modulo 4'); // @math step 0 is the first call, frame 0
    last = Math.max(last, s[c.step8508]);
  }
  assert.deepEqual([exact, late, last], [F.withFigure - F.withFigureLate, F.withFigureLate, F.lastStep], 'the steps');
  assert.deepEqual(F.block, [(F.driver - 1) * V.d.perDriver, F.driver * V.d.perDriver - 1], 'the frames of the driver 7'); // @math the first and last frame of the block
}

export default {
  id: 'obs-devilfinish',
  claims: ['devil.finish-observed'],
  obs: ['finish-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('finish-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('finish-1'), V = values(), F = V.f;
    return [
      { label: 'a step offset of 45', fn: () => validate(dat, r, V, { offset: F.stepOffset - 1 }) },
      { label: 'a frame modulus of 3', fn: () => validate(dat, r, V, { modulus: F.frameModulus - 1 }) },
      { label: 'a driver altered', fn: () => validate(dat, { ...r, samples: r.samples.map((s, i) => (i === 70 ? s.map((x, k) => (k === r.columns.indexOf('driver84f4') ? 6 : x)) : s)) }, V) }, // @math a pause with the figure on
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), r, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
