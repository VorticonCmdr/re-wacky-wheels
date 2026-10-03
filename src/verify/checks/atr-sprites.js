import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAtrWith } from '../../formats/atr.js';
import { expected } from '../expect.js';

// Every catalogue record must name an existing member whose size is the product of its three words.
function validate(dat, L, littleEndian = true) {
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), atr = members.get('SPRITE.ATR');
  assert.ok(atr, 'SPRITE.ATR is missing');
  const records = parseAtrWith(atr, L, littleEndian);
  for (const r of records) {
    const member = members.get(r.name.toUpperCase());
    assert.ok(member, `${r.name} is not a member`);
    assert.equal(member.length, r.bytes, `${r.name}: ${r.width} x ${r.height} x ${r.frames}`);
  }
  return records;
}

export default {
  id: 'atr-sprites',
  claims: ['atr.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), L = expected('atr.layout'), records = validate(dat, L);
    assert.ok(records.length > 0);
    assert.equal(new Set(records.map(r => r.name)).size, records.length, 'catalogue names are unique');
    assert.equal(L.nameAt + L.nameBytes, L.recordBytes, 'the name field runs to the end of the record');
    const read = expected('atr.read');
    assert.ok(read.pointerAt >= L.nameAt && read.pointerAt + 4 <= L.recordBytes, 'the loader\'s pointer lies in the record, in the name field\'s unused tail'); // @math a pointer is a dword
    const longest = Math.max(...records.map(r => r.name.length));
    assert.ok(read.pointerAt >= L.nameAt + longest + 1, 'no catalogue name reaches the pointer field'); // @math NUL terminator
  },
  // Wrong record size, wrong field offsets and a big-endian count must not describe the archive.
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), L = expected('atr.layout'), wrong = (label, patch) => ({ label, fn: () => validate(dat, { ...L, ...patch }) });
    return [
      wrong(`record ${L.recordBytes - 1} bytes`, { recordBytes: L.recordBytes - 1 }),
      wrong(`record ${L.recordBytes + 1} bytes`, { recordBytes: L.recordBytes + 1 }),
      wrong(`frames at +0x0c`, { framesAt: L.framesAt - 2 }), // @math the size-selector word
      wrong(`name at +${L.nameAt - 1}`, { nameAt: L.nameAt - 1 }),
      wrong(`name at +${L.nameAt + 1}`, { nameAt: L.nameAt + 1 }),
      wrong('width at +2', { widthAt: L.widthAt - 2 }), // @math the word before width
      wrong('height at +8', { heightAt: L.heightAt + 2 }), // @math the duplicate-dimension word
      { label: 'big-endian count', fn: () => validate(dat, L, false) },
    ];
  },
};
