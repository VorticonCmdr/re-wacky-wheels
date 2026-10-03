import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSdx } from '../../formats/static-tables.js';
import { view } from '../../binary.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ index: expected('terrain.sdx-index'), table: expected('static.read').sdx });

// Cross-validate a `surface` record: the car record holds the SDX record's fields and address for its terrain value, and those fields are the file's.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const I = V.index, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), sdx = parseSdx(members.get('WACKY.SDX'));
  assert.equal(record.resultOffset, I.resultOffset);
  assert.equal(record.carPointerOffset, I.carPointerOffset);
  assert.equal(record.tableOffset, I.tableOffset);
  assert.equal(I.tableOffset, V.table.tableOffset, 'the same table as the startup loader fills');
  assert.equal(I.recordBytes, V.table.recordBytes, 'the same record size');
  const tableBase = record.bases[2] + I.tableOffset, seen = new Set(); // @math object 2 holds the table
  record.samples.forEach(([result, t, dword, word, p72, p76, liveDword, liveWord], k) => {
    assert.ok(t >= 0 && t < sdx.count, `sample ${k}: the terrain value ${t} names an SDX record`);
    const rec = view(sdx.records[t]);
    assert.equal(p72, tableBase + t * I.recordBytes, `sample ${k}: +0x72 is the address of SDX record ${t}`);
    assert.equal(p76, p72, `sample ${k}: +0x76 is the same address`);
    assert.equal(dword, rec.getUint32(I.dwordAt, true), `sample ${k}: +0x36 is the file's dword at record +0x${I.dwordAt.toString(16)}`); // @math hex radix
    assert.equal(word, rec.getUint16(I.wordAt, true), `sample ${k}: +0x3a is the file's word at record +0x${I.wordAt.toString(16)}`); // @math hex radix
    assert.equal(liveDword, dword, `sample ${k}: the live SDX record holds the same dword`);
    assert.equal(liveWord, word, `sample ${k}: the live SDX record holds the same word`);
    assert.equal(result, t, `sample ${k}: the car record's value is the lookup result`);
    seen.add(t);
  });
  assert.ok(seen.size > 1, 'more than one terrain value was sampled, so the record size in the address is exercised');
  assert.ok(record.samples.some(([, , dword, word]) => dword !== 0 || word !== 0), 'a non-zero SDX field was copied, so the copy is not vacuous');
}

export default {
  id: 'obs-surface',
  claims: ['terrain.sdx-index'],
  obs: ['surface-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('surface-1'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('surface-1'), V = values();
    const tweak = (label, patch) => ({ label, fn: () => validate(dat, record, { ...V, index: { ...V.index, ...patch } }) });
    return [
      tweak(`record size ${V.index.recordBytes - 1}`, { recordBytes: V.index.recordBytes - 1 }),
      tweak(`record size ${V.index.recordBytes + 1}`, { recordBytes: V.index.recordBytes + 1 }),
      tweak('dword at +0x11c', { dwordAt: V.index.dwordAt - 4 }), // @math the previous dword
      tweak('word at +0x122', { wordAt: V.index.wordAt - 2 }), // @math the previous word
      tweak('table 8 bytes on', { tableOffset: V.index.tableOffset + 8 }), // @math a different table address
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
