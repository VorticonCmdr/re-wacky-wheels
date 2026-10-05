import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ C: expected('audio.calls-observed'), D: expected('audio.digital-observed') });

const REGISTERS = ['eax', 'edx', 'ebx'];

// Cross-validate a `calls` record: the sound mode and flag words read from the running game (the game rewrites WACKY.CFG while the menus are played, so the file's hash is not the start-up one), and what followed the entry of the engine start and of the horn routine.
async function validate(ctx, record, R, V) {
  const { C, D } = V, col = Object.fromEntries(C.columns.map((c, i) => [c, i]));
  assertArchive(record, await ctx.open('WACKY.DAT'));
  assert.deepEqual(record.words.mode, [D.modeAt, R.mode], 'the sound mode of the run');
  assert.deepEqual(record.words.flag, [D.flagAt, R.flag], 'the digital sound flag of the run');
  assert.equal(record.words.engine[1] === 0, R.flag === 0, 'the engine sample is loaded exactly when the flag is on'); // @math 0 is a pointer that was never stored
  assert.deepEqual(record.sites, C.sites, 'the breakpoint sites');
  assert.deepEqual(record.columns, C.columns);
  assert.equal(record.rows.length, R.stops, 'the stops');
  const same = (a, b) => REGISTERS.every(name => a[col[name]] === b[col[name]]); // the registers of two stops
  const rows = record.rows, at = site => rows.map((r, i) => (r[col.site] === site ? i : -1)).filter(i => i >= 0);
  record.rows.forEach((r, i) => { assert.equal(r[col.stop], i + 1, 'the stops follow one another'); assert.ok(C.sites.includes(r[col.site]), `stop ${i + 1} is at a site`); }); // @math stops count from 1
  // the library's play routine: its stops come from the numbered-play routine
  for (const i of at(C.play.site)) assert.equal(rows[i][col.return], C.play.caller, 'the play routine was called by the numbered-play routine');
  const [engine] = at(C.engine.entry), [horn] = at(C.horn.entry);
  assert.ok(engine !== undefined && horn !== undefined, 'the engine start and the horn routine were both entered');
  assert.ok(C.engine.callers.includes(rows[engine][col.return]), 'the engine start was called from one of its call sites');
  assert.ok(C.horn.callers.includes(rows[horn][col.return]), 'the horn routine was called from one of its call sites');
  const after = i => rows[i + 1]; // @math the stop after the entry
  assert.equal(after(engine)[col.site], C.engine.exit, 'the next stop after the engine start\'s entry is its exit');
  if (R.flag === 0) {
    assert.ok(same(rows[engine], after(engine)), 'the engine start left with the registers it was entered with: its body did not run');
    assert.equal(after(horn)[col.site], C.horn.exit, 'the next stop after the horn\'s entry is its exit');
    assert.ok(same(rows[horn], after(horn)), 'the horn routine left with the registers it was entered with');
    assert.equal(at(C.horn.body).length, 0, 'the first instruction of the horn\'s body did not run');
  } else {
    assert.ok(!same(rows[engine], after(engine)), 'the engine start\'s body changed the registers');
    assert.equal(after(horn)[col.site], C.horn.body, 'the next stop after the horn\'s entry is the first instruction of its body');
    assert.ok(same(rows[horn], after(horn)));
  }
}

export default {
  id: 'obs-calls',
  claims: ['audio.calls-observed'],
  obs: ['calls-7', 'calls-0'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { const V = values(); for (const R of V.C.records) await validate(ctx, ctx.obs(R.id), R, V); },
  async discriminate(ctx) {
    const V = values(), [seven, zero] = V.C.records, one = ctx.obs(seven.id), nought = ctx.obs(zero.id);
    const rec = (r, patch) => ({ ...r, ...patch }), word = (r, name, v) => rec(r, { words: { ...r.words, [name]: [r.words[name][0], v] } });
    const row = (r, k, column, v) => rec(r, { rows: r.rows.map((x, i) => (i === k ? x.map((y, j) => (j === column ? v : y)) : x)) });
    const col = Object.fromEntries(V.C.columns.map((c, i) => [c, i]));
    const engineExit = one.rows.findIndex(r => r[col.site] === V.C.engine.exit), hornExit = one.rows.findIndex(r => r[col.site] === V.C.horn.exit);
    return [
      { label: 'the flag on in the PC-speaker run', fn: () => validate(ctx, word(one, 'flag', 1), seven, V) },
      { label: 'the engine start\'s exit with another eax', fn: () => validate(ctx, row(one, engineExit, col.eax, one.rows[engineExit][col.eax] + 1), seven, V) }, // @math one more
      { label: 'the horn routine\'s exit with another ebx', fn: () => validate(ctx, row(one, hornExit, col.ebx, one.rows[hornExit][col.ebx] + 1), seven, V) }, // @math one more
      { label: 'the horn\'s body stopped in the PC-speaker run', fn: () => validate(ctx, row(one, hornExit, col.site, V.C.horn.body), seven, V) },
      { label: 'the play routine called from elsewhere', fn: () => validate(ctx, row(one, 0, col.return, V.C.engine.callers[0]), seven, V) }, // @math the first stop
      { label: 'the engine start called from an unknown place', fn: () => validate(ctx, row(one, one.rows.findIndex(r => r[col.site] === V.C.engine.entry), col.return, 1), seven, V) }, // @math an address that is no call site
      { label: 'the control run with the flag off', fn: () => validate(ctx, word(nought, 'flag', 0), zero, V) },
      { label: 'the control run\'s engine start leaving with its entry\'s registers', fn: () => { const k = nought.rows.findIndex(r => r[col.site] === V.C.engine.exit), e = nought.rows.findIndex(r => r[col.site] === V.C.engine.entry); return validate(ctx, row(row(row(nought, k, col.eax, nought.rows[e][col.eax]), k, col.edx, nought.rows[e][col.edx]), k, col.ebx, nought.rows[e][col.ebx]), zero, V); } },
      { label: 'an archive of another size', fn: () => validate(ctx, rec(one, { archive: { ...one.archive, size: one.archive.size + 1 } }), seven, V) }, // @math one byte
    ];
  },
};
