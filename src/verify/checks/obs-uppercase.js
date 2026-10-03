import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { replaceMember, editLines } from '../patch.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ up: expected('dat.uppercase-range'), space: expected('gam.trailing-space') });

// Experiment: line 5 of 2.GAM was edited to a name that holds the bytes on both sides of the lower-case range, and the game's stored copy of the line was read
// after the lookup. Rebuild the test archive from the user's own and compare hashes, then check each stored byte.
function validate(dat, record, V) {
  const U = V.up, by = new Map(parseDatDirectory(dat).map(e => [e.name, e]));
  assertArchive(record, dat);
  const edited = replaceMember(dat, record.member, editLines(by.get(record.member).data, record.edits));
  assert.equal(createHash('sha1').update(edited).digest('hex'), record.modified.sha1, 'the rebuilt test archive is the one the game ran from');
  assert.equal(record.edits.length, 1);
  assert.equal(record.edits[0][0], V.space.skyLine, 'the sky-name line was edited');
  assert.equal(record.slotOffset, U.slotAt);
  const planted = [...Buffer.from(record.edits[0][1], 'latin1')];
  assert.deepEqual(planted, U.planted, 'the planted bytes');
  assert.ok(planted.includes(U.lowerFirst - 1) && planted.includes(U.lowerLast + 1), 'both bytes next to the range were planted'); // @math the neighbours of the range
  assert.ok(planted.includes(U.lowerFirst) && planted.includes(U.lowerLast), 'both ends of the range were planted');
  const want = [...planted.map(b => (b >= U.lowerFirst && b <= U.lowerLast ? b - U.caseDelta : b)), V.space.terminator];
  assert.deepEqual(record.slotBytes.slice(0, want.length), want, 'only a to z were upper-cased in the stored line');
}

export default {
  id: 'obs-uppercase',
  claims: ['dat.uppercase-range'],
  obs: ['gamslot-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('gamslot-2'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('gamslot-2'), V = values(), u = patch => ({ ...V, up: { ...V.up, ...patch } });
    return [
      { label: 'range starts one below', fn: () => validate(dat, record, u({ lowerFirst: V.up.lowerFirst - 1 })) },
      { label: 'range ends one above', fn: () => validate(dat, record, u({ lowerLast: V.up.lowerLast + 1 })) },
      { label: 'range starts one above', fn: () => validate(dat, record, u({ lowerFirst: V.up.lowerFirst + 1 })) },
      { label: 'range ends one below', fn: () => validate(dat, record, u({ lowerLast: V.up.lowerLast - 1 })) },
      { label: 'delta 0x10', fn: () => validate(dat, record, u({ caseDelta: V.up.caseDelta / 2 })) }, // @math half the delta
      { label: 'stored line untouched', fn: () => validate(dat, { ...record, slotBytes: [...record.edits[0][1]].map(c => c.charCodeAt(0)).concat(record.slotBytes.slice(record.edits[0][1].length)) }, V) },
    ];
  },
};
