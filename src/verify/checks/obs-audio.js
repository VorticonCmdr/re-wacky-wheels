import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAudioBankWith } from '../../formats/audio-bank.js';
import { crc, assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

function values() {
  return { bank: expected('audio.bank-layout'), load: expected('audio.load'), alias: expected('audio.alias'), mode: expected('audio.mode-select') };
}

// Cross-validate an `audio` record against the archive: the buffer is AUDIOT.FX, and every record follows from the bank layout.
function validate(dat, record, V) {
  assertArchive(record, dat);
  const { bank: B, load: LD, alias: A, mode: M } = V, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assert.equal(record.names.head, 'AUDIOHED.FX', 'the game names the header file');
  assert.equal(record.names.body, 'AUDIOT.FX', 'the game names the bank file');
  assert.equal(record.names.headOffset, LD.headName);
  assert.equal(record.names.bodyOffset, LD.bodyName);
  const head = members.get(record.names.head), body = members.get(record.names.body);
  assert.ok(head && body, 'both named files are archive members');
  const bank = parseAudioBankWith(head, body, B);
  assert.equal(record.mode, M.otherMode, 'the recording was made with the mode that selects the first bank');
  assert.equal(record.modeOffset, M.modeAt);
  assert.notEqual(record.enableWord, 0, 'the routine\'s enable word is set');
  assert.equal(record.enableOffset, M.enableWordAt);
  assert.equal(record.bufferPointerOffset, LD.bufferPointerAt);
  assert.equal(record.bankBytes, body.length, 'the buffer is as long as the file');
  assert.equal(record.bankCrc, crc(body), 'the buffer holds AUDIOT.FX whole');
  assert.equal(record.recordTableOffset, LD.recordTable);
  assert.equal(record.recordBytes, LD.recordBytes);
  assert.equal(record.records.length, LD.records);
  assert.equal(LD.records, B.bankSlots, 'one record per slot of a bank');
  assert.equal(A.sourceOffset, A.source * LD.recordBytes, 'record 20 is at table offset 0x1e0');
  const dword = Int32Array.BYTES_PER_ELEMENT, at = off => off / dword;
  record.records.forEach((rec, k) => {
    assert.equal(rec.length, LD.recordBytes / dword, 'a record is six dwords');
    const aliased = k >= A.firstTarget && k < A.firstTarget + A.count, slot = bank.slots[aliased ? A.source : k];
    assert.equal(rec[at(LD.pointerAt)], bank.offsets[slot.index], `record ${k}: pointer is the buffer plus slot ${slot.index}'s offset`);
    assert.equal(rec[at(LD.lengthAt)], slot.length, `record ${k}: length is the first dword of slot ${slot.index}`);
    assert.equal(rec[at(LD.zeroAt)], 0, `record ${k}: the dword at +${LD.zeroAt} is 0`);
    assert.equal(rec[at(LD.priorityAt)], LD.priorityFirst - k, `record ${k}: counts down from ${LD.priorityFirst}`);
  });
  // The aliased slots are the empty sounds, and the source is not: otherwise the alias could not be told apart from the layout.
  for (let k = A.firstTarget; k < A.firstTarget + A.count; k++) assert.equal(bank.slots[k].length, 0, `slot ${k} is empty`);
  assert.ok(bank.slots[A.source].length > 0);
}

export default {
  id: 'obs-audio',
  claims: ['audio.load', 'audio.alias'],
  obs: ['audio-1'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), ctx.obs('audio-1'), values()); },
  // Each parameter changed on its own must make the observation fail.
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), record = ctx.obs('audio-1'), V = values();
    const tweak = (label, key, patch) => ({ label, fn: () => validate(dat, record, { ...V, [key]: { ...V[key], ...patch } }) });
    return [
      tweak('alias of record 19', 'alias', { source: V.alias.source - 1, sourceOffset: V.alias.sourceOffset - V.load.recordBytes }),
      tweak('alias of 7 records', 'alias', { count: V.alias.count - 1 }),
      tweak('alias of 9 records', 'alias', { count: V.alias.count + 1 }),
      tweak('alias starting at record 1', 'alias', { firstTarget: V.alias.firstTarget + 1 }),
      tweak('length at +0', 'load', { lengthAt: V.load.pointerAt }),
      tweak('priority from 26', 'load', { priorityFirst: V.load.priorityFirst - 1 }),
      tweak('priority from 28', 'load', { priorityFirst: V.load.priorityFirst + 1 }),
      tweak('priority at +0x10', 'load', { priorityAt: V.load.priorityAt + V.load.recordBytes / 6 }), // @math one dword on from +0x0c is not guaranteed; any move must fail
      tweak('zero word at +0x0c', 'load', { zeroAt: V.load.priorityAt }),
      tweak('25 records', 'load', { records: V.load.records - 1 }),
      tweak('mode 2 recorded as the mode', 'mode', { otherMode: V.mode.secondBankMode }),
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (b, i) => (i === dat.length - 1 ? b ^ 1 : b)), record, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
