import assert from 'node:assert/strict';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ S: expected('audio.skips-observed'), D: expected('audio.digital-observed') });

// Cross-validate a `calls` record of the paths that sit behind the digital flag: with the flag off every path is entered but no site past its flag test stops; with it on all of them do, in order.
async function validate(ctx, record, R, V) {
  const { S, D } = V, col = Object.fromEntries(S.columns.map((c, i) => [c, i]));
  assertArchive(record, await ctx.open('WACKY.DAT'));
  assert.deepEqual(record.words.mode, [D.modeAt, R.mode], 'the sound mode of the run');
  assert.deepEqual(record.words.flag, [D.flagAt, R.flag], 'the digital sound flag of the run');
  assert.deepEqual(record.sites, S.sites, 'the breakpoint sites');
  assert.deepEqual(record.columns, S.columns);
  assert.equal(record.rows.length, R.stops, 'the stops');
  const rows = record.rows, first = site => rows.findIndex(r => r[col.site] === site);
  rows.forEach((r, i) => { assert.equal(r[col.stop], i + 1, 'the stops follow one another'); assert.ok(S.sites.includes(r[col.site]), `stop ${i + 1} is at a site`); }); // @math stops count from 1
  for (const path of S.paths) {
    const entry = first(path.entry);
    assert.ok(entry >= 0, `the ${path.name} path was entered`); // @math a stop index, -1 for none
    if (path.middle) assert.ok(first(path.middle) >= 0, `the ${path.name} path went on to ${path.middle}`); // @math a stop index, -1 for none
    if (R.flag === 0) {
      for (const site of [...(path.loader ? [path.loader] : []), ...path.past]) assert.equal(first(site), -1, `the ${path.name} path did not reach ${site} with the flag off`); // @math -1 is no stop
    } else {
      let at = entry;
      for (const site of path.past) { const i = first(site); assert.ok(i > at, `the ${path.name} path reached ${site} after ${at}`); at = i; }
      if (path.loader) assert.ok(first(path.loader) >= 0 && first(path.loader) < entry, 'the belch was loaded before the scene'); // @math a stop index, -1 for none
    }
  }
  const voice = first(S.paths.find(p => p.name === 'taunt').past.at(-1));
  if (R.flag === 1) assert.equal(rows[voice][col.return], S.paths.find(p => p.name === 'taunt').voiceCaller, 'the taunt voice was called by the key routine'); // @math the voice routine is the taunt path\'s last site
}

export default {
  id: 'obs-skips',
  claims: ['audio.skips-observed'],
  obs: ['calls2-7', 'calls2-0'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { const V = values(); for (const R of V.S.records) await validate(ctx, ctx.obs(R.id), R, V); },
  async discriminate(ctx) {
    const V = values(), [seven, zero] = V.S.records, one = ctx.obs(seven.id), nought = ctx.obs(zero.id), col = Object.fromEntries(V.S.columns.map((c, i) => [c, i]));
    const rec = (r, patch) => ({ ...r, ...patch }), word = (r, name, v) => rec(r, { words: { ...r.words, [name]: [r.words[name][0], v] } });
    const site = (r, k, v) => rec(r, { rows: r.rows.map((x, i) => (i === k ? x.map((y, j) => (j === col.site ? v : y)) : x)) });
    const [belch, quack, taunt] = V.S.paths, at = (r, s) => r.rows.findIndex(x => x[col.site] === s);
    return [
      { label: 'the flag on in the PC-speaker run', fn: () => validate(ctx, word(one, 'flag', 1), seven, V) },
      { label: 'the quack path\'s flag-test site stopping in the PC-speaker run', fn: () => validate(ctx, site(one, at(one, quack.middle), quack.past[0]), seven, V) }, // @math the first site past the test
      { label: 'the taunt voice stopping in the PC-speaker run', fn: () => validate(ctx, site(one, at(one, taunt.entry), taunt.past[1]), seven, V) }, // @math the voice routine
      { label: 'the control run without the belch play', fn: () => validate(ctx, site(nought, at(nought, belch.past[0]), belch.entry), zero, V) },
      { label: 'the control run without the voice call', fn: () => validate(ctx, site(nought, at(nought, taunt.past[1]), taunt.past[0]), zero, V) }, // @math the first site past the test
      { label: 'the control run with the flag off', fn: () => validate(ctx, word(nought, 'flag', 0), zero, V) },
      { label: 'an archive of another size', fn: () => validate(ctx, rec(one, { archive: { ...one.archive, size: one.archive.size + 1 } }), seven, V) }, // @math one byte
    ];
  },
};
