import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAudioBankWith } from '../../formats/audio-bank.js';
import { expected } from '../expect.js';

async function members(ctx) {
  const dat = await ctx.open('WACKY.DAT'), by = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assert.ok(by.has('AUDIOHED.FX') && by.has('AUDIOT.FX'), 'both bank files are archive members');
  return { head: by.get('AUDIOHED.FX'), body: by.get('AUDIOT.FX') };
}

// The bank must parse under the layout, and the split between header, payload and trailer must be the true one (the totals alone
// cannot show it): a trailer is a 0 byte, or a 0 byte followed by NUL-padded printable text, and is never part of the payload.
function validate(head, body, L) {
  const { slots } = parseAudioBankWith(head, body, L);
  for (const s of slots) {
    if (s.bank === 'first') assert.ok(s.trailer.every(b => b === 0), `slot ${s.index}: the trailer is 0`);
    else {
      assert.equal(s.trailer[0], 0, `slot ${s.index}: the trailer starts with a 0 byte`);
      assert.ok(s.trailer.every(b => b === 0 || (b >= 0x20 && b < 0x7f)), `slot ${s.index}: the trailer is NUL-padded printable text`); // @math printable ASCII range
    }
  }
  for (const bank of ['first', 'second']) {
    assert.ok(slots.some(s => s.bank === bank && s.length > 0 && s.payload.at(-1) !== 0), `${bank} bank: some payload ends in a non-zero byte, so the trailer is not payload`);
  }
  return slots;
}

export default {
  id: 'audio-bank',
  claims: ['audio.bank-layout'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const { head, body } = await members(ctx), L = expected('audio.bank-layout'), { offsets } = parseAudioBankWith(head, body, L), slots = validate(head, body, L);
    assert.equal(slots.length, L.bankSlots * 2, 'two banks of sounds'); // @math two banks hold sounds
    // Slots tile the file: each starts where the previous ended, from 0 to the end of slot 51.
    slots.forEach((s, i) => assert.equal(s.start, i === 0 ? 0 : slots[i - 1].start + slots[i - 1].size, `slot ${i} starts where the previous ends`));
    // Exactly the last slot of each bank carries a tag, and no payload byte count is guessed: size is header + length (+ tag).
    assert.deepEqual(slots.filter(s => s.tagged).map(s => s.index), [L.bankSlots - 1, L.bankSlots * 2 - 1], 'only the last slot of each bank is tagged'); // @math the last slot of each of two banks
    // The loader (audio.load, STATIC) reads one bank of this many records.
    assert.equal(expected('audio.load').records, L.bankSlots, 'the loader\'s record count is one bank');
    assert.equal(expected('audio.mode-select').secondBankBase, L.bankSlots, 'the second bank starts after the first');
    // The empty tail: every one of the last slots has the same offset.
    assert.equal(new Set(offsets.slice(L.bankSlots * 2, L.slots)).size, 1, 'slots after the second bank are empty'); // @math two banks hold sounds
    // Both banks contain sounds with a zero length (the aliased ones of audio.alias) and sounds with data.
    for (const bank of ['first', 'second']) {
      const own = slots.filter(s => s.bank === bank);
      assert.ok(own.some(s => s.length === 0) && own.some(s => s.length > 0), `${bank} bank has empty and non-empty sounds`);
    }
    const alias = expected('audio.alias');
    for (let i = alias.firstTarget; i < alias.firstTarget + alias.count; i++) {
      assert.equal(slots[i].length, 0, `first-bank slot ${i} is an empty sound`);
      assert.equal(slots[L.bankSlots + i].length, 0, `second-bank slot ${i} is an empty sound`);
    }
    assert.ok(slots[alias.source].length > 0, 'the aliased source is a sound with data');
    assert.ok(slots[L.bankSlots + alias.source].length > 0, 'the aliased source is a sound with data in the second bank too');
  },
  // Neighbouring headers, bank sizes, tags and strides must all fail.
  async discriminate(ctx) {
    const { head, body } = await members(ctx), L = expected('audio.bank-layout'), wrong = (label, patch) => ({ label, fn: () => validate(head, body, { ...L, ...patch }) });
    const moved = (bank, from) => ({ [`${bank}Header`]: L[`${bank}Header`] + from, [`${bank}Trailer`]: L[`${bank}Trailer`] - from }); // same total, a different split
    return [
      wrong(`first header ${L.firstHeader - 1}`, { firstHeader: L.firstHeader - 1 }),
      wrong(`first header ${L.firstHeader + 1}`, { firstHeader: L.firstHeader + 1 }),
      wrong(`second header ${L.secondHeader - 1}`, { secondHeader: L.secondHeader - 1 }),
      wrong(`second header ${L.secondHeader + 1}`, { secondHeader: L.secondHeader + 1 }),
      wrong(`first trailer ${L.firstTrailer - 1} (header ${L.firstHeader + 1})`, moved('first', 1)), // @math a 7-byte header and no trailer
      wrong(`first trailer ${L.firstTrailer + 1} (header ${L.firstHeader - 1})`, moved('first', -1)), // @math a 5-byte header and a 2-byte trailer
      wrong(`second trailer ${L.secondTrailer - 1} (header ${L.secondHeader + 1})`, moved('second', 1)), // @math a 24-byte header and a 9-byte trailer
      wrong(`second trailer ${L.secondTrailer + 1} (header ${L.secondHeader - 1})`, moved('second', -1)), // @math a 22-byte header and an 11-byte trailer
      wrong('the old split: 7 and 33 bytes of header, no trailer', { firstHeader: L.firstHeader + L.firstTrailer, firstTrailer: 0, secondHeader: L.secondHeader + L.secondTrailer, secondTrailer: 0 }), // @math header plus trailer as one header
      wrong(`banks of ${L.bankSlots - 1}`, { bankSlots: L.bankSlots - 1 }),
      wrong(`banks of ${L.bankSlots + 1}`, { bankSlots: L.bankSlots + 1 }),
      wrong(`${L.slots - 1} slots`, { slots: L.slots - 1 }),
      wrong(`${L.slots + 1} slots`, { slots: L.slots + 1 }),
      wrong('tag "!ID?"', { tag: '!ID?' }),
      wrong('tag of 3 bytes', { tag: '!ID' }),
      wrong('length dword at +1', { lengthAt: L.lengthAt + 1 }),
      wrong('offset stride 2', { offsetBytes: L.offsetBytes / 2 }), // @math half the stride
    ];
  },
};
