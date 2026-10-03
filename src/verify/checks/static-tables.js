import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseMapXyWith, parseSdxWith, parseMovWith } from '../../formats/static-tables.js';
import { expected } from '../expect.js';

const members = dat => new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
const get = (m, name) => { const d = m.get(name); assert.ok(d, `${name} is missing`); return d; };

function validate(m, L) {
  parseMapXyWith(get(m, 'MAP.XY'), L);
  parseSdxWith(get(m, 'WACKY.SDX'), L);
  parseMovWith(get(m, 'GIG.MOV'), L);
  assert.equal(get(m, 'TRIG.DAT').length, L.trigBytes);
  assert.equal(get(m, 'NDIST').length, L.ndistBytes);
  assert.equal(get(m, 'CARS.SP').length, L.carsBytes);
}

export default {
  id: 'static-tables',
  claims: ['static.layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const m = members(await ctx.open('WACKY.DAT')), L = expected('static.layout'), R = expected('static.read');
    validate(m, L);
    // The layout agrees with what the loader reads (static.read, proven in the running game).
    assert.equal(R.mapXy.halfBytes * 2, L.mapXyBytes); // @math MAP.XY is read as two halves
    assert.equal(R.sdx.recordBytes, L.sdxRecordBytes);
    assert.ok(R.sdx.tailFrom < R.sdx.recordBytes, 'the rewritten tail lies inside a record');
    assert.equal(R.trig.bytes, L.trigBytes);
    assert.equal(R.ndist.bytes, L.ndistBytes);
    assert.equal(R.cars.bytes, L.carsBytes);
    assert.equal(R.mov.entryBytes, L.movEntryBytes);
    assert.equal(R.mov.extraBytes, L.movExtraBytes);
  },
  // Off-by-one sizes and a big-endian count must not describe the archive.
  async discriminate(ctx) {
    const m = members(await ctx.open('WACKY.DAT')), L = expected('static.layout'), wrong = (label, patch, opts) => ({ label, fn: () => validate(m, { ...L, ...patch }, opts) });
    return [
      wrong(`MAP.XY ${L.mapXyBytes + 1} bytes`, { mapXyBytes: L.mapXyBytes + 1 }),
      wrong(`SDX record ${L.sdxRecordBytes - 1} bytes`, { sdxRecordBytes: L.sdxRecordBytes - 1 }),
      wrong(`SDX record ${L.sdxRecordBytes + 1} bytes`, { sdxRecordBytes: L.sdxRecordBytes + 1 }),
      wrong(`MOV entry ${L.movEntryBytes / 2} bytes`, { movEntryBytes: L.movEntryBytes / 2 }), // @math alternative: 2-byte entries
      wrong(`MOV entry ${L.movEntryBytes * 2} bytes`, { movEntryBytes: L.movEntryBytes * 2 }), // @math alternative: 8-byte entries
      wrong('MOV with no trailing bytes', { movExtraBytes: 0 }), // @math alternative: no extra bytes
      wrong(`TRIG ${L.trigBytes - 1} bytes`, { trigBytes: L.trigBytes - 1 }),
      wrong(`NDIST ${L.ndistBytes + 1} bytes`, { ndistBytes: L.ndistBytes + 1 }),
      wrong(`CARS.SP ${L.carsBytes - 1} bytes`, { carsBytes: L.carsBytes - 1 }),
      { label: 'SDX big-endian count', fn: () => parseSdxWith(get(m, 'WACKY.SDX'), L, false) },
      { label: 'MOV big-endian count', fn: () => parseMovWith(get(m, 'GIG.MOV'), L, false) },
    ];
  },
};
