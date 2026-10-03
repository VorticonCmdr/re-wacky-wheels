import assert from 'node:assert/strict';
import { parseDatWith, directoryEnd } from '../../formats/dat.js';
import { expected } from '../expect.js';

// The proven layout, as tiling: sorted by offset each member ends where the next begins, the last
// ends at EOF, and the first begins one entry after the directory end.
function tiles(data, layout) {
  const entries = parseDatWith(data, layout), sorted = [...entries].sort((a, b) => a.offset - b.offset);
  assert.ok(sorted.length > 0, 'no entries');
  assert.equal(sorted[0].offset, directoryEnd(data, layout) + layout.entrySize, 'first member one entry after the directory');
  sorted.forEach((e, i) => assert.equal(e.offset + e.size, i + 1 < sorted.length ? sorted[i + 1].offset : data.length, `member ${e.name} ends where the next begins`));
  assert.equal(new Set(entries.map(e => e.name)).size, entries.length, 'names are unique');
  return entries;
}

export default {
  id: 'dat-directory',
  claims: ['dat.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), layout = expected('dat.layout');
    tiles(dat, layout);
    // The layout agrees with what the executable does (STATIC claims from disassembly).
    const read = expected('dat.directory-read'), lookup = expected('dat.entry-lookup'), size = expected('dat.entry-size');
    assert.equal(layout.countBytes, read.countBytes);
    assert.equal(layout.entrySize, read.entrySize);
    assert.equal(layout.offsetAt, lookup.offsetAt);
    assert.equal(layout.offsetBias, lookup.seekBias);
    assert.equal(layout.sizeAt, size.sizeAt);
  },
  // Neighbouring strides, swapped fields, and every other bias must not tile the archive.
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), L = expected('dat.layout'), wrong = (label, patch) => ({ label, fn: () => tiles(dat, { ...L, ...patch }) });
    return [
      wrong(`entry size ${L.entrySize - 1}`, { entrySize: L.entrySize - 1 }),
      wrong(`entry size ${L.entrySize + 1}`, { entrySize: L.entrySize + 1 }),
      wrong('size and offset fields swapped', { sizeAt: L.offsetAt, offsetAt: L.sizeAt }),
      wrong(`offset bias ${L.offsetBias - 1}`, { offsetBias: L.offsetBias - 1 }),
      wrong(`offset bias ${L.offsetBias + 1}`, { offsetBias: L.offsetBias + 1 }),
      wrong('offset bias 0', { offsetBias: 0 }), // @math the alternative that offsets count from the file start
    ];
  },
};
