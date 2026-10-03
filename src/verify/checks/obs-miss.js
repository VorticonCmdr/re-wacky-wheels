import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../../formats/dat.js';
import { replaceMember, editLines } from '../patch.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ miss: expected('dat.entry-notfound'), layout: expected('dat.layout'), space: expected('gam.trailing-space') });

// Cross-validate a `miss` record: the run archive is the user's with the sky-name line edited, the execute breakpoint on the lookup's not-found path
// stopped once, with the walk index equal to the entry count, a zero first byte there and a non-zero one before it.
function validate(dat, record, V) {
  const M = V.miss, entries = parseDatDirectory(dat), by = new Map(entries.map(e => [e.name, e]));
  assertArchive(record, dat);
  const edited = replaceMember(dat, record.member, editLines(by.get(record.member).data, record.edits));
  assert.equal(createHash('sha1').update(edited).digest('hex'), record.modified.sha1, 'the rebuilt test archive is the one the game ran from');
  assert.deepEqual(record.edits, [[V.space.skyLine, V.space.skyText]], 'the sky-name line was edited');
  assert.equal(record.name, V.space.skyText.toUpperCase(), 'the lookup was asked for the edited name, upper-cased');
  assert.ok(!by.has(record.name), 'no archive member has that name');
  assert.deepEqual(record.breakpoints, [[M.missPath, 1]], 'the not-found path ran once');
  assert.equal(record.stoppedAt, M.missPath);
  assert.deepEqual(record.walkIndex, [M.walkIndexAt, entries.length], 'the walk ended at the index after the last entry');
  assert.equal(record.table.offset, M.tableAt);
  assert.equal(record.table.entryBytes, V.layout.entrySize, 'entry stride');
  assert.equal(record.table.atIndex[0], M.endMarker, 'the entry the walk ended on starts with the end marker');
  assert.notEqual(record.table.lastLoaded[0], M.endMarker, 'the last loaded entry does not');
}

export default {
  id: 'obs-miss',
  claims: ['dat.entry-notfound'],
  obs: ['miss-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('miss-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('miss-1'), V = values(), m = patch => ({ ...V, miss: { ...V.miss, ...patch } });
    const t = patch => ({ ...r, table: { ...r.table, ...patch } });
    return [
      { label: 'walk ended at the last entry', fn: () => validate(dat, { ...r, walkIndex: [r.walkIndex[0], r.walkIndex[1] - 1] }, V) }, // @math one entry earlier
      { label: 'walk ended one entry later', fn: () => validate(dat, { ...r, walkIndex: [r.walkIndex[0], r.walkIndex[1] + 1] }, V) }, // @math one entry later
      { label: 'end marker 1', fn: () => validate(dat, r, m({ endMarker: V.miss.endMarker + 1 })) },
      { label: 'miss path one byte on', fn: () => validate(dat, r, m({ missPath: V.miss.missPath + 1 })) },
      { label: 'entry stride 21', fn: () => validate(dat, r, { ...V, layout: { ...V.layout, entrySize: V.layout.entrySize - 1 } }) },
      { label: 'zero entry before the end', fn: () => validate(dat, t({ lastLoaded: [0, 0, 0, 0] }), V) }, // @math four zero bytes
      { label: 'name found in the archive', fn: () => validate(dat, { ...r, name: 'WACKY.DAT' }, V) },
    ];
  },
};
