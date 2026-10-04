import assert from 'node:assert/strict';
import { scrollHorizon, nextRamp } from '../../game/horizon.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ h: expected('horizon.scroll') });

// The port's rules replayed on every pair of pauses exactly one frame apart: the steering amount words say which side steers, the ramps and the offset follow.
function replay(r, V, { cap = V.h.rampCap, noWrap = false } = {}) {
  const H = V.h, S = r.samples, counts = { left: 0, right: 0, none: 0, wraps: 0 };
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    if (b.tick - a.tick !== 1) continue; // @math exactly one frame apart
    const left = b.leftAmount > 0, right = b.rightAmount > 0, offset = a.pointer - r.base;
    const ramps = [nextRamp(a.w52, left), nextRamp(a.w54, right)];
    assert.deepEqual([Math.min(ramps[0], cap), Math.min(ramps[1], cap)], [b.w52, b.w54], `tick ${b.tick}: the ramps`);
    let next = offset;
    if (left) { next = scrollHorizon(noWrap && offset === H.bounds[0] ? 1 : offset, 'left', ramps[0]); counts.left++; if (offset === H.bounds[0]) counts.wraps++; }
    if (right) { next = scrollHorizon(next, 'right', ramps[1]); counts.right++; if (offset === H.bounds.at(-1)) counts.wraps++; }
    if (!left && !right) counts.none++;
    assert.equal(next, b.pointer - r.base, `tick ${b.tick}: the horizon offset`);
  }
  return counts;
}

export default {
  id: 'port-horizon',
  claims: ['horizon.scroll'],
  obs: ['hscroll-1'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), r = ctx.obs('hscroll-1'); assertArchive(r, await ctx.open('WACKY.DAT'));
    const counts = replay(r, V);
    assert.ok(counts.left >= 100 && counts.right >= 80 && counts.none >= 100 && counts.wraps >= 2, `the replay covers both directions, no steering and a wrap (${JSON.stringify(counts)})`); // @math the record holds 140, 93, 177 and 2
  },
  async discriminate(ctx) {
    const V = values(), r = ctx.obs('hscroll-1');
    return [
      { label: 'a ramp cap of 3', fn: () => replay(r, V, { cap: V.h.rampCap - 1 }) },
      { label: 'no wrap at the first bound', fn: () => replay(r, V, { noWrap: true }) },
    ];
  },
};
