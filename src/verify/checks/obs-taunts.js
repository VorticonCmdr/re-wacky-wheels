import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ T: expected('audio.taunts-observed'), D: expected('audio.digital-observed') });

// Cross-validate a `taunts` record: the sound mode and flag, the two players' taunts (accepted in both modes), and the voice words (set only with the flag on).
async function validate(ctx, record, R, V) {
  const { T, D } = V;
  assertArchive(record, await ctx.open('WACKY.DAT'));
  assert.deepEqual(record.words.mode, [D.modeAt, R.mode], 'the sound mode of the run');
  assert.deepEqual(record.words.flag, [D.flagAt, R.flag], 'the digital sound flag of the run');
  for (let p = 0; p < T.players; p++) {
    const word = name => record.seen[`${name}${p + 1}`], at = name => T.base + p * T.stride + T.fields[name];
    for (const name of Object.keys(T.fields)) assert.equal(word(name)[0], at(name), `the ${name} word of player ${p + 1} lies in the car record`);
    assert.ok(word('counter')[1].some(v => v > 0) && word('taunt')[1].some(v => v > 0), `player ${p + 1}'s taunt was accepted`); // @math a taunt raises the counter and sets the word above 0
    if (R.flag === 0) {
      assert.deepEqual(word('handle')[1], [0], `player ${p + 1}'s voice handle never changed`); // @math 0 is the handle of no voice
      assert.deepEqual(word('voice')[1], [0], `player ${p + 1}'s voice flag never went on`); // @math 0 is the flag of no voice
    } else {
      assert.ok(word('handle')[1].some(v => v > 0), `player ${p + 1}'s voice got a handle`); // @math a voice handle is above 0
      assert.ok(word('voice')[1].includes(1), `player ${p + 1}'s voice flag went on`); // @math 1 is the flag of a playing voice
    }
  }
}

export default {
  id: 'obs-taunts',
  claims: ['audio.taunts-observed'],
  obs: ['taunts-7', 'taunts-0'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { const V = values(); for (const R of V.T.records) await validate(ctx, ctx.obs(R.id), R, V); },
  async discriminate(ctx) {
    const V = values(), [seven, zero] = V.T.records, one = ctx.obs(seven.id), nought = ctx.obs(zero.id);
    const rec = (r, patch) => ({ ...r, ...patch }), word = (r, name, v) => rec(r, { words: { ...r.words, [name]: [r.words[name][0], v] } });
    const seen = (r, name, values) => rec(r, { seen: { ...r.seen, [name]: [r.seen[name][0], values] } });
    return [
      { label: 'the flag on in the PC-speaker run', fn: () => validate(ctx, word(one, 'flag', 1), seven, V) },
      { label: 'a voice handle in the PC-speaker run (second player)', fn: () => validate(ctx, seen(one, 'handle2', [0, 90]), seven, V) }, // @math a handle above 0
      { label: 'the voice flag on in the PC-speaker run (first player)', fn: () => validate(ctx, seen(one, 'voice1', [0, 1]), seven, V) }, // @math the flag of a playing voice
      { label: 'no taunt of the second player', fn: () => validate(ctx, seen(seen(one, 'counter2', [0]), 'taunt2', [0]), seven, V) },
      { label: 'the control run without a handle (second player)', fn: () => validate(ctx, seen(nought, 'handle2', [0]), zero, V) },
      { label: 'the control run without the voice flag (first player)', fn: () => validate(ctx, seen(nought, 'voice1', [0]), zero, V) },
      { label: 'the control run with the flag off', fn: () => validate(ctx, word(nought, 'flag', 0), zero, V) },
      { label: 'an archive of another size', fn: () => validate(ctx, rec(one, { archive: { ...one.archive, size: one.archive.size + 1 } }), seven, V) }, // @math one byte
    ];
  },
};
