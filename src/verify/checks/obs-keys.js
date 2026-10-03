import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const IDS = ['keys-1', 'keys-2', 'keys-3', 'keys-4', 'keys-5', 'keys-6', 'keys-7'];
const values = () => ({ k: expected('input.key-state'), h: expected('input.key-handler'), d: expected('cfg.default-keys') });

// Cross-validate the `keys` records: after each group of keys was held the handler's key table, last code and fixed flag bytes are what
// input.key-handler says they are for exactly those scancodes, and after all keys were released every flag is clear and the last code is
// the release code (the scancode with the release bit) of the last key held.
function validate(records, V, dat) {
  const K = V.k, H = V.h, keys = V.d.players.flat();
  let previous = null;
  for (const r of records) {
    assertArchive(r, dat);
    assert.equal(r.tableOffset, K.tableAt, 'the table the tool read');
    assert.equal(r.lastCodeOffset, K.lastCodeAt, 'the last code byte the tool read');
    assert.deepEqual(r.flagOffsets, K.flagAt, 'the flag bytes the tool read');
    assert.equal(r.words.length, H.tableWords, 'the table has one word per key');
    assert.deepEqual(r.words.map(w => w & 0xff), keys, 'the low bytes of the table are the default keys'); // @math the low byte of a word
    assert.deepEqual(r.words.map(w => w >> 8), keys.map(k => (r.held.includes(k) ? 1 : 0)), 'the high byte of a word is 1 for the keys held'); // @math the high byte of a word
    for (const [name, at] of Object.entries(K.flagAt)) {
      const codes = H.flagBytes.filter(f => f.at === at).map(f => f.code);
      assert.equal(r.flags[name], r.held.some(c => codes.includes(c)) ? 1 : 0, `the flag byte ${name}`);
    }
    if (r.held.length) assert.equal(r.lastCode, r.held.at(-1), 'the last code is the last key pressed');
    else assert.equal(r.lastCode, previous.held.at(-1) + H.releaseBias, 'the last code is the release code of the last key held');
    previous = r;
  }
  assert.equal(records.length, K.records, 'the number of records');
  assert.deepEqual([...new Set(records.flatMap(r => r.held))].sort((a, b) => a - b), K.keysHeld, 'the keys that were held');
}

export default {
  id: 'obs-keys',
  claims: ['input.key-state'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(IDS.map(id => ctx.obs(id)), values(), await ctx.open('WACKY.DAT')); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), rs = IDS.map(id => ctx.obs(id)), edit = (i, patch) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r));
    const h = patch => ({ ...V, h: { ...V.h, ...patch } });
    return [
      { label: 'a down flag missing', fn: () => validate(edit(0, { words: rs[0].words.map((w, i) => (i === 0 ? w & 0xff : w)) }), V, dat) }, // @math clear the high byte of the first word
      { label: 'a flag set for a key not held', fn: () => validate(edit(1, { words: rs[1].words.map((w, i) => (i === 6 ? w | 0x100 : w)) }), V, dat) }, // @math set the high byte of a player 2 word
      { label: 'a fixed flag wrong', fn: () => validate(edit(4, { flags: { ...rs[4].flags, up: 0 } }), V, dat) }, // @math the record index of the group
      { label: 'the wrong last code', fn: () => validate(edit(2, { lastCode: rs[2].lastCode - 1 }), V, dat) }, // @math the record index of the group
      { label: 'the release code without its bit', fn: () => validate(edit(6, { lastCode: rs[6].lastCode & 0x7f }), V, dat) }, // @math drop the release bit
      { label: 'release bias 0x40', fn: () => validate(rs, h({ releaseBias: V.h.releaseBias / 2 }), dat) }, // @math half
      { label: 'Enter as another flag', fn: () => validate(rs, h({ flagBytes: V.h.flagBytes.map(f => (f.code === 0x1c ? { ...f, at: f.at + 1 } : f)) }), dat) }, // @math the Enter scancode
      { label: 'a held key forgotten', fn: () => validate(edit(2, { held: rs[2].held.slice(1) }), V, dat) }, // @math the record index of the group
    ];
  },
};
