import assert from 'node:assert/strict';
import { stepFrame, sizeOf, frameOf } from '../../game/menu.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ A: expected('menu.animation-observed') });
const MAX_STEPS = 60; // @math a bit more than a cycle of 51 steps: the most the replay looks ahead between two pauses
const PICK = 40, PICK_LION = 18, PICK_TIME = 100; // @math pauses to alter in the discriminators: a plain one, one with the icons animating, one later in the run
const LOST_TAPS = 2; // @math the recording tapped 20 keys and the game dropped at most this many

const stateOf = s => ({ cursor: s.cursor, lionTop: s.lionRow, lionFrame: s.lionFrame, busy: s.busy, phase: s.phase, count: s.count, pair: s.pair });
const same = (a, b) => ['cursor', 'lionTop', 'lionFrame', 'busy', 'phase', 'count', 'pair'].every(k => a[k] === b[k]);

// Replay every pair of consecutive pauses through the port's step: some number of steps, the key (if one was tapped in the interval) read in one of them
// or dropped, reaches the recorded state, and the steps are 8 counts of the game's own frame time each.
function replay(r, V, { period = V.A.period } = {}) {
  const keys = new Map(r.keys.map(([i, k]) => [i, k.replace('KBD_', '')])), S = r.samples;
  let pairs = 0, lost = 0;
  S.forEach(s => {
    assert.equal(sizeOf(s.phase, s.count), s.size, 'the size follows from the phase and the count');
    assert.ok(frameOf(s.phase, s.count) >= 0 && frameOf(s.phase, s.count) < V.A.frames, 'the frame stays within the cycle');
  });
  for (let i = 1; i < S.length; i++) {
    const a = stateOf(S[i - 1]), b = stateOf(S[i]), key = keys.get(i);
    let steps = null, dropped = false;
    for (let k = 0; k <= MAX_STEPS && steps === null; k++) {
      for (let at = key ? 0 : 0; at <= (key ? Math.max(k, 1) : 0) && steps === null; at++) {
        let c = a; for (let j = 1; j <= k; j++) c = stepFrame(c, key && j === at ? key : null).menu;
        if (same(c, b)) { steps = k; dropped = Boolean(key) && at === 0; }
      }
    }
    assert.notEqual(steps, null, `pauses ${i - 1} and ${i}: no number of steps reaches the recorded state (${JSON.stringify(a)} to ${JSON.stringify(b)}, key ${key})`);
    assert.equal(S[i].frameTime - S[i - 1].frameTime, period * steps, `pauses ${i - 1} and ${i}: ${steps} steps are ${period} counts each`);
    if (dropped) lost++;
    pairs++;
  }
  assert.ok(lost <= LOST_TAPS, `at most ${LOST_TAPS} taps dropped (${lost})`);
  return pairs;
}

export default {
  id: 'obs-menustate',
  claims: ['menu.animation-observed'],
  obs: ['menuanim-2'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const r = ctx.obs('menuanim-2'), pairs = replay(r, values());
    assertArchive(r, await ctx.open('WACKY.DAT'));
    assert.equal(pairs, r.samples.length - 1, 'every pair of pauses');
  },
  async discriminate(ctx) {
    const r = ctx.obs('menuanim-2'), V = values();
    return [
      { label: 'a step of 7 counts', fn: () => replay(r, V, { period: V.A.period - 1 }) },
      { label: 'a recorded count altered', fn: () => replay({ ...r, samples: r.samples.map((s, i) => (i === PICK ? { ...s, count: s.count + 1 } : s)) }, V) },
      { label: 'a recorded pair altered', fn: () => replay({ ...r, samples: r.samples.map((s, i) => (i === PICK ? { ...s, pair: (s.pair + 2) % 8 } : s)) }, V) }, // @math the next pair of the four
      { label: 'a recorded icon frame altered', fn: () => replay({ ...r, samples: r.samples.map((s, i) => (i === PICK_LION ? { ...s, lionFrame: s.lionFrame + 1 } : s)) }, V) },
      { label: 'a recorded frame time altered', fn: () => replay({ ...r, samples: r.samples.map((s, i) => (i === PICK_TIME ? { ...s, frameTime: s.frameTime + 1 } : s)) }, V) },
    ];
  },
};
