import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parsePos } from '../../formats/track-files.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ live: expected('pos.progress-live') });

// Cross-validate a `progress` record: in every sample every racer's stored grid value, lap and keys follow from its position and the .POS file.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const L = V.live, member = parseDatDirectory(dat).find(e => e.name === `${record.names.track}.POS`)?.data;
  assert.ok(member, 'the loaded track\'s .POS is an archive member');
  const { grid, trailer } = parsePos(member);
  const S = expected('pos.progress');
  assert.equal(L.origin, S.origin, 'the same world origin as the lookup routine');
  assert.equal(L.maxOffset, S.extent);
  assert.equal(L.cellShift, S.cellBits);
  assert.equal(L.columns, S.rowBytes / S.cellBytes, 'a row of the grid has this many cells');
  assert.deepEqual(record.layout, L.layout, 'the record read the words the claim names');
  assert.equal(record.countOffset, L.countOffset);
  assert.equal(record.trailerOffset, L.trailerOffset);
  assert.equal(record.trailerWord, trailer, 'the game\'s trailer word is the .POS trailer');
  assert.equal(record.countWord + 1, L.racers, 'the game has this many racers');
  const side = L.maxOffset, cell = v => { const d = v - L.origin; return d < 0 || d > side ? -1 : d >> L.cellShift; }; // @math arithmetic shift right: cell index of an offset
  let onCourse = 0, offCourse = 0, seenLaps = new Set();
  record.samples.forEach((sample, k) => {
    assert.equal(sample.racers.length, L.racers);
    assert.equal(sample.flag, 0, 'racer 0\'s flag word is clear, so its lap is not decremented');
    sample.racers.forEach(([x, y, lap, value, key, key2], i) => {
      const col = cell(x), row = cell(y), want = col < 0 || row < 0 ? 0 : grid[row * L.columns + col];
      assert.equal(value, want, `sample ${k} racer ${i}: the stored value is the grid value at (${x}, ${y})`);
      assert.equal(key, (lap << L.lapShift) + value, `sample ${k} racer ${i}: key is lap x 2^shift + value`); // @math shift left multiplies by a power of two
      assert.equal(key2, value + trailer * lap, `sample ${k} racer ${i}: second key is value + trailer x lap`);
      if (want === 0) offCourse++; else onCourse++;
      seenLaps.add(lap);
    });
  });
  assert.ok(onCourse > 0, 'some racers are on the course, so the match is not vacuous');
  assert.ok([...seenLaps].some(l => l > 0), 'some racer has a non-zero lap, so the lap terms are exercised');
}

export default {
  id: 'obs-progress',
  claims: ['pos.progress-live'],
  obs: ['progress-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('progress-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('progress-1'), V = values();
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { live: { ...V.live, ...patch } }) });
    return [
      tweak('origin 0x3ff', { origin: V.live.origin - 1 }),
      tweak('origin 0x401', { origin: V.live.origin + 1 }),
      tweak('cell shift 4', { cellShift: V.live.cellShift - 1 }),
      tweak('cell shift 6', { cellShift: V.live.cellShift + 1 }),
      tweak('63 columns', { columns: V.live.columns - 1 }),
      tweak('lap shift 9', { lapShift: V.live.lapShift - 1 }),
      tweak('lap shift 11', { lapShift: V.live.lapShift + 1 }),
      tweak('7 racers', { racers: V.live.racers - 1 }),
      tweak('layout with the AI value word 2 bytes on', { layout: { ...V.live.layout, aiValueWord: V.live.layout.aiValueWord + 2 } }), // @math the neighbouring word
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
