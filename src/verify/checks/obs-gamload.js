import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseGam } from '../../formats/gam.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ load: expected('gam.load-words'), read: expected('gam.read'), rest: expected('gam.read-rest') });

// Cross-validate a `gamload` record (read at the exit of the .GAM parser) against the track's own .GAM in the archive.
function validate(dat, record, V) {
  const L = V.load, gam = parseGam(parseDatDirectory(dat).find(e => e.name === `${record.names.track}.GAM`).data);
  assertArchive(record, dat);
  assert.equal(L.valueBias, V.rest.valueBias, 'the bias of gam.read-rest');
  assert.equal(L.pairBias, V.read.startBias, 'the bias of gam.read');
  assert.equal(L.pairs, V.rest.startPairs, 'the pair count of gam.read-rest');
  assert.equal(L.extra.length, V.read.extraLines, 'the extra lines of gam.read');
  assert.deepEqual(record.values.map(v => v[0]), L.valueAt, 'the value words');
  assert.deepEqual(record.values.map(v => v[1]), gam.values.map(v => v + L.valueBias), 'lines 6 and 7 plus the bias');
  assert.equal(record.xTable[0], L.xTable);
  assert.equal(record.yTable[0], L.yTable);
  assert.equal(record.xTable[1].length, L.pairs);
  assert.deepEqual(record.xTable[1], gam.starts.map(s => s.x + L.pairBias), 'every pair\'s x plus the bias');
  assert.deepEqual(record.yTable[1], gam.starts.map(s => s.y + L.pairBias), 'every pair\'s y plus the bias');
  assert.deepEqual(record.flag, [L.flagAt, gam.flag], 'the flag line');
  assert.notEqual(gam.flag, 0, 'the recorded track has its extra lines'); // @math the extra words are only stored when the flag is set
  assert.deepEqual(record.extra.map(e => e[0]), L.extra, 'the extra words');
  assert.deepEqual(record.extra.map(e => e[1]), gam.extra, 'lines 26 to 28');
}

export default {
  id: 'obs-gamload',
  claims: ['gam.load-words'],
  obs: ['gamload-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('gamload-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('gamload-1'), V = values(), l = patch => ({ ...V, load: { ...V.load, ...patch } });
    return [
      { label: 'value bias 0x3ff', fn: () => validate(dat, r, l({ valueBias: V.load.valueBias - 1 })) },
      { label: 'value bias 0x401', fn: () => validate(dat, r, l({ valueBias: V.load.valueBias + 1 })) },
      { label: 'pair bias 0x3df', fn: () => validate(dat, r, l({ pairBias: V.load.pairBias - 1 })) },
      { label: 'pair bias 0x3e1', fn: () => validate(dat, r, l({ pairBias: V.load.pairBias + 1 })) },
      { label: 'tables swapped', fn: () => validate(dat, { ...r, xTable: r.yTable, yTable: r.xTable }, V) },
      { label: 'extra words reversed', fn: () => validate(dat, { ...r, extra: [...r.extra].reverse() }, V) },
      { label: 'record of another track', fn: () => validate(dat, { ...r, names: { track: '3' } }, V) },
    ];
  },
};
