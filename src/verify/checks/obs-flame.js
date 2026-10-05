import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ F: expected('effects.rear-observed') });

// Cross-validate one `flameword` record of a demo race: the frame word of the rear pictures goes on by one for every counter step, across the switch of the mode word to the race, in the
// phase the claim lists for the track, and the stage word follows the start of the flame and the wrap of the frame word.
async function validate(ctx, record, R, F) {
  assertArchive(record, await ctx.open('WACKY.DAT'));
  assert.equal(record.track, R.track, 'the track');
  assert.equal(record.frameAt, F.frameAt, 'the frame word');
  assert.equal(record.stageAt, F.stageAt, 'the stage word');
  const list = record.samples;
  assert.equal(list.length, F.samples, 'the pauses');
  const mod = n => ((n % F.period) + F.period) % F.period;
  const modes = new Set(list.map(s => s.mode));
  assert.deepEqual([...modes].sort(), [F.modes.countdown, F.modes.race], 'the pauses cover the countdown and the race');
  list.forEach((s, i) => {
    if (i > 0) assert.ok(s.counter >= list[i - 1].counter && s.counter - list[i - 1].counter <= 1, `the counter goes on by at most one a pause (${i})`); // @math one counter step
    assert.equal(s.mode, s.counter >= F.switchCounter ? F.modes.race : F.modes.countdown, `the mode word follows the counter (${i})`);
  });
  const begun = list.findIndex(s => s.stage >= F.startStage);
  assert.ok(begun > 0, 'the stage word reaches the start stage'); // @math a sample index, -1 for none
  assert.equal(list[begun].counter, R.start, 'the counter of the pass that starts the flame');
  assert.equal(list[begun].stage, F.startStage, 'the first stage word is the start stage');
  assert.ok(list[begun].throttle > 0, 'the accelerate flag is on in that pass'); // @math the throttle word is above 0
  assert.ok([F.startFrame, mod(F.startFrame + 1)].includes(list[begun].frame), 'the pass sets the frame word, which may have gone on once'); // @math one advance
  const over = list.findIndex((s, i) => i > begun && s.stage === 0); // the flame goes out (the accelerate flag off clears the stage word) and may start again with a new anchor
  list.forEach((s, i) => {
    if (over >= 0 && i >= over) return;
    if (i < begun) { // idle: the word minus the counter is one of two values (before or after the advance of the pass), in the countdown and in the race alike
      assert.equal(s.stage, 0, `the stage word is 0 before the start (${i})`);
      assert.ok(R.offsets.includes(mod(s.frame - s.counter)), `the idle word is in its phase (${i}: ${s.frame} at the counter ${s.counter})`);
    } else { // from the start: the counter less the start counter, or one more
      const d = mod(s.frame - (s.counter - R.start));
      assert.ok(d === 0 || d === 1, `the word goes on from the start (${i}: ${s.frame} at the counter ${s.counter})`); // @math before or after the advance
    }
  });
  assert.deepEqual(R.offsets, [R.offsets[0], mod(R.offsets[0] + 1)], 'the two phases are one apart'); // @math one frame
  for (let i = begun + 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (b.stage > a.stage && a.stage === 0) { assert.equal(b.stage, F.startStage, `the flame starts again at the start stage (${i})`); assert.ok([F.startFrame, mod(F.startFrame + 1)].includes(b.frame), `with the frame word the pass sets or one on (${i})`); } // @math one advance
    else if (b.stage > a.stage) { assert.equal(b.stage - a.stage, 1, `the stage word goes up by one (${i})`); assert.ok(b.frame < a.frame, `at the wrap of the frame word (${i})`); } // @math one stage
  }
}

export default {
  id: 'obs-flame',
  claims: ['effects.rear-observed'],
  obs: ['flameword-2', 'flameword-3', 'flameword-4', 'flameword-5'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { const { F } = values(); for (const R of F.records) await validate(ctx, ctx.obs(R.id), R, F); },
  async discriminate(ctx) {
    const { F } = values(), [two, , four, five] = F.records, mk = r => ctx.obs(r.id);
    const rec = (r, patch) => ({ ...r, ...patch }), edit = (r, fn) => rec(r, { samples: r.samples.map(fn) });
    return [
      { label: 'the idle word one off in the race (track 5)', fn: () => validate(ctx, edit(mk(five), s => (s.mode === F.modes.race && s.stage === 0 ? { ...s, frame: (s.frame + 1) % F.period } : s)), five, F) }, // @math one frame
      { label: 'the idle word one off in the countdown (track 2)', fn: () => validate(ctx, edit(mk(two), s => (s.mode === F.modes.countdown ? { ...s, frame: (s.frame + 1) % F.period } : s)), two, F) }, // @math one frame
      { label: 'the phase of the track 5 demo for the track 4 demo', fn: () => validate(ctx, mk(four), { ...four, offsets: five.offsets }, F) },
      { label: 'the start counter one later (track 4)', fn: () => validate(ctx, mk(four), { ...four, start: four.start + 1 }, F) }, // @math one counter step
      { label: 'the stage word going up in the middle of a frame cycle', fn: () => { const at = mk(two).samples.findIndex(s => s.stage >= F.startStage); return validate(ctx, edit(mk(two), (s, i) => (i === at + 1 ? { ...s, stage: s.stage + 1 } : s)), two, F); } }, // @math the sample after the start
      { label: 'the mode word one counter late (track 5)', fn: () => validate(ctx, edit(mk(five), s => (s.counter === F.switchCounter ? { ...s, mode: F.modes.countdown } : s)), five, F) },
      { label: 'an archive of another size', fn: () => validate(ctx, rec(mk(two), { archive: { ...mk(two).archive, size: mk(two).archive.size + 1 } }), two, F) }, // @math one byte
    ];
  },
};
