import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ rec: expected('cars.slot-records'), frames: expected('cars.frames'), slots: expected('cars.slots') });

// Cross-validate a `cars` record: the buffer holds CARS.SP whole, and each slot's record starts with that slot's frame pointers, a frame apart.
function validate(dat, record, V) {
  const R = V.rec, C = V.frames, S = V.slots;
  assertArchive(record, dat);
  const cars = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])).get('CARS.SP');
  assert.equal(record.bufferPointerOffset, R.bufferPointerAt);
  assert.equal(R.bufferPointerAt, S.bufferPointerAt, 'the pointer of cars.slots');
  assert.equal(R.recordTableAt, S.recordTableAt, 'the record table of cars.slots');
  assert.equal(R.recordBytes, S.recordBytes, 'the record size of cars.slots');
  assert.equal(record.recordTableOffset, R.recordTableAt);
  assert.equal(record.recordBytes, R.recordBytes);
  assert.equal(record.bufferBytes, cars.length, 'the buffer is as long as CARS.SP');
  assert.equal(record.bufferCrc, crc(cars), 'the buffer holds CARS.SP');
  assert.equal(R.inBuffer, C.framesPerSlot, 'one pointer per frame of a slot');
  assert.equal(record.records.length, C.slots, 'one record per slot');
  record.records.forEach((rec, k) => {
    assert.equal(rec.length * Int32Array.BYTES_PER_ELEMENT, R.recordBytes, `record ${k} size`);
    for (let j = 0; j < R.inBuffer; j++) assert.deepEqual(rec[j], [k * C.slotBytes + j * C.width * C.height], `record ${k} pointer ${j} is slot ${k}'s frame ${j}`);
    assert.ok(rec.slice(R.inBuffer).every(d => !Array.isArray(d)), `record ${k}: the remaining dwords point outside the buffer`);
  });
}

export default {
  id: 'obs-cars',
  claims: ['cars.slot-records'],
  obs: ['cars-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('cars-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), r = ctx.obs('cars-1'), V = values(), c = patch => ({ ...V, frames: { ...V.frames, ...patch } }), rr = patch => ({ ...V, rec: { ...V.rec, ...patch } });
    return [
      { label: '11 pointers in the buffer', fn: () => validate(dat, r, rr({ inBuffer: V.rec.inBuffer - 1 })) },
      { label: '13 pointers in the buffer', fn: () => validate(dat, r, rr({ inBuffer: V.rec.inBuffer + 1 })) },
      { label: 'slot step 0x31e1', fn: () => validate(dat, r, c({ slotBytes: V.frames.slotBytes + 1 })) },
      { label: 'frames of 38 x 27', fn: () => validate(dat, r, c({ height: V.frames.height - 1 })) },
      { label: 'record size 0x94', fn: () => validate(dat, r, rr({ recordBytes: V.rec.recordBytes - 4 })) }, // @math one dword fewer
      { label: 'pointers shifted by a frame', fn: () => validate(dat, { ...r, records: r.records.map(rec => rec.map(d => (Array.isArray(d) ? [d[0] + 1] : d))) }, V) },
    ];
  },
};
