import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const RECORDS = ['cmdline-1', 'cmdline-2', 'cmdline-3', 'cmdline-4'];
const values = () => ({ words: expected('cmdline.words') });

// Predict what the start-up code leaves behind for a command line, from the claimed word table and the no-argument defaults.
function predict(args, defaults, W) {
  const out = { mask: defaults.mask, now: defaults.now, class: defaults.class, debug: defaults.debug };
  for (const word of args.map(a => a.toUpperCase())) {
    const bit = W.words.find(w => w.text === word), cls = W.classes.find(c => c.text === word);
    if (bit) out.mask += bit.bit;
    if (word === W.nowText) out.now = 1;
    if (cls) out.class = cls.value;
    if (word === W.debugText) out.debug = 1;
  }
  return out;
}

function validate(dat, records, V) {
  const W = V.words, [base, ...rest] = records;
  [base, ...rest].forEach(r => assertArchive(r, dat));
  assert.deepEqual(base.args, [], 'the first record is the no-argument baseline');
  records.forEach(r => {
    assert.equal(r.maskAt, W.maskAt);
    assert.equal(r.nowAt, W.nowAt);
    assert.equal(r.classAt, W.classAt);
    assert.equal(r.debugAt, W.debugAt);
    assert.deepEqual(r.maskCopyAt, W.maskCopyAt);
    const want = predict(r.args, base, W);
    assert.equal(r.mask, want.mask, `${r.args.join(' ') || '(none)'}: the mask`);
    assert.deepEqual(r.maskCopies, [want.mask, want.mask, want.mask], `${r.args.join(' ') || '(none)'}: the mask is copied to three more places`);
    assert.equal(r.now, want.now, `${r.args.join(' ') || '(none)'}: the NOW flag`);
    assert.equal(r.class, want.class, `${r.args.join(' ') || '(none)'}: the /1 /2 /3 value`);
    assert.equal(r.debug, want.debug, `${r.args.join(' ') || '(none)'}: the debug word`);
  });
  // The experiment is not vacuous: every word of the claim was used somewhere and the mask took several values.
  const used = new Set(records.flatMap(r => r.args.map(a => a.toUpperCase())));
  for (const w of [...W.words.map(x => x.text), W.nowText, W.debugText, ...W.classes.map(c => c.text)]) assert.ok(used.has(w), `${w} was tried`);
  assert.notEqual(base.class, W.classes.find(c => c.text === '/2').value, 'the default class differs from /2, so /2 is visible');
}

export default {
  id: 'obs-cmdline',
  claims: ['cmdline.words'],
  obs: RECORDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), RECORDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = RECORDS.map(id => ctx.obs(id)), V = values(), W = V.words;
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, records, { words: { ...W, ...patch } }) });
    return [
      tweak('JUMP and HOG bits swapped', { words: W.words.map(w => (w.text === 'JUMP' ? { ...w, bit: 4 } : w.text === 'HOG' ? { ...w, bit: 2 } : w)) }), // @math the two bit values exchanged
      tweak('FIRE bit 0x20', { words: W.words.map(w => (w.text === 'FIRE' ? { ...w, bit: w.bit << 1 } : w)) }), // @math the next bit
      tweak('/2 sets 7', { classes: W.classes.map(c => (c.text === '/2' ? { ...c, value: c.value + 1 } : c)) }),
      tweak('/3 sets 1', { classes: W.classes.map(c => (c.text === '/3' ? { ...c, value: c.value + 1 } : c)) }),
      tweak('mask word 4 bytes on', { maskAt: W.maskAt + 4 }), // @math one dword on
      tweak('NOW word 4 bytes on', { nowAt: W.nowAt + 4 }), // @math one dword on
      tweak('debug word 2 bytes on', { debugAt: W.debugAt + 2 }), // @math one word on
    ];
  },
};
