import assert from 'node:assert/strict';
import { directoryEnd } from '../../formats/dat.js';
import { expected } from '../expect.js';

const values = () => ({ s: expected('dat.sentinel-bytes'), layout: expected('dat.layout') });

// The entry-sized stretch after the directory: a zero first byte, then the previous (last) directory entry's name field from its second byte on, then zero numeric fields.
function validate(dat, V) {
  const S = V.s, L = V.layout, end = directoryEnd(dat, L), last = dat.subarray(end - L.entrySize, end), gap = dat.subarray(end, end + L.entrySize);
  assert.equal(S.nameBytes, L.sizeAt, 'the name field ends where the length field begins');
  assert.ok(gap.subarray(0, S.tailFrom).every(b => b === S.endMarker), 'the sentinel starts with the end marker, and nothing else before the tail');
  assert.deepEqual([...gap.subarray(S.tailFrom, S.nameBytes)], [...last.subarray(S.tailFrom, S.nameBytes)], 'its name field repeats the last entry\'s name from the second byte');
  assert.ok(last.subarray(0, S.nameBytes).some(b => b !== S.endMarker), 'the last entry has a name');
  assert.ok(gap.subarray(S.tailFrom, S.nameBytes).some(b => b !== S.endMarker), 'so the repeated tail is not all zero');
  assert.ok(gap.subarray(S.nameBytes).every(b => b === S.endMarker), 'its length and offset fields are zero');
  assert.ok(last.subarray(S.nameBytes).some(b => b !== S.endMarker), 'unlike the last entry\'s');
}

export default {
  id: 'dat-sentinel',
  claims: ['dat.sentinel-bytes'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), s = patch => () => validate(dat, { ...V, s: { ...V.s, ...patch } });
    return [
      { label: 'tail from byte 0', fn: s({ tailFrom: V.s.tailFrom - 1 }) },
      { label: 'tail from byte 2', fn: s({ tailFrom: V.s.tailFrom + 1 }) },
      { label: 'end marker 0x20', fn: s({ endMarker: V.s.endMarker + 0x20 }) }, // @math a space instead of NUL
      { label: 'name field of 13 bytes', fn: s({ nameBytes: V.s.nameBytes - 1 }) },
      { label: 'one byte of the archive changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === directoryEnd(dat, V.layout) + 1 ? b ^ 1 : b)), V) }, // @math flip the lowest bit of the sentinel's second byte
    ];
  },
};
