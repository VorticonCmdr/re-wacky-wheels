import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAudioBankWith } from '../../formats/audio-bank.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ tick: expected('audio.speaker-tick'), bank: expected('audio.bank-layout'), load: expected('audio.load'), alias: expected('audio.alias'), speaker: expected('audio.speaker-player') });

// Cross-validate a `tick` record: every stop is the first instruction of the tone path, with the player's pointer inside one chunk's data (after the
// header), the remaining counter equal to the length minus the bytes consumed, the divisor equal to 60 times the byte just read, and the priority one
// that the game's records give that chunk.
function validate(dat, record, V) {
  const T = V.tick, B = V.bank, LD = V.load, A = V.alias;
  assertArchive(record, dat);
  assert.deepEqual(record.columns, T.columns, 'the columns the record names');
  assert.equal(record.bufferPointerOffset, LD.bufferPointerAt);
  assert.ok(record.samples.length > 0, 'the record holds stops');
  assert.equal(T.step, V.speaker.divisorStep, 'the step of audio.speaker-player');
  assert.equal(T.headerBytes, B.firstHeader, 'the header the player skips is the first bank\'s header');
  const members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), body = members.get('AUDIOT.FX');
  const bank = parseAudioBankWith(members.get('AUDIOHED.FX'), body, B);
  for (const [eip, divisor, pointer, remaining, priority] of record.samples) {
    assert.equal(eip, T.toneAt, 'stopped at the first instruction of the tone path');
    const slot = bank.slots.slice(0, B.bankSlots).find(s => pointer - 1 >= bank.offsets[s.index] + T.headerBytes && pointer - 1 < bank.offsets[s.index] + T.headerBytes + s.length);
    assert.ok(slot, `pointer ${pointer} lies in the data of a first-bank chunk`);
    const chunk = bank.offsets[slot.index], consumed = pointer - 1 - (chunk + T.headerBytes);
    assert.equal(remaining, slot.length - consumed, 'the counter holds the length minus the bytes consumed');
    assert.equal(divisor, body[pointer - 1] * T.step, 'the divisor is 60 times the byte just read');
    const records = [...Array(B.bankSlots).keys()].filter(k => (k >= A.firstTarget && k < A.firstTarget + A.count ? A.source : k) === slot.index);
    assert.ok(records.map(k => LD.priorityFirst - k).includes(priority), 'the stored priority is that of a record pointing at the chunk'); // @math priorities fall by one per record from the first
  }
}

export default {
  id: 'obs-tick',
  claims: ['audio.speaker-tick'],
  obs: ['tick-1', 'tick-2'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    let stops = 0;
    for (const id of ['tick-1', 'tick-2']) { validate(dat, ctx.obs(id), V); stops += ctx.obs(id).samples.length; }
    assert.equal(stops, V.tick.samples, 'the two records hold the stops the claim counts');
  },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), r = ctx.obs('tick-1'), t = patch => ({ ...V, tick: { ...V.tick, ...patch } });
    const sample = (i, patch) => ({ ...r, samples: r.samples.map((s, k) => (k === i ? s.map((v, c) => (c in patch ? patch[c] : v)) : s)) });
    return [
      { label: 'step 59', fn: () => validate(dat, r, t({ step: V.tick.step - 1 })) },
      { label: 'step 61', fn: () => validate(dat, r, t({ step: V.tick.step + 1 })) },
      { label: 'header 5 bytes', fn: () => validate(dat, r, t({ headerBytes: V.tick.headerBytes - 1 })) },
      { label: 'header 7 bytes', fn: () => validate(dat, r, t({ headerBytes: V.tick.headerBytes + 1 })) },
      { label: 'wrong stop address', fn: () => validate(dat, r, t({ toneAt: V.tick.toneAt + 1 })) },
      { label: 'divisor off by 60', fn: () => validate(dat, sample(0, { 1: r.samples[0][1] + V.tick.step }), V) },
      { label: 'counter off by one', fn: () => validate(dat, sample(0, { 3: r.samples[0][3] + 1 }), V) }, // @math column 3 is the counter
      { label: 'pointer one byte on', fn: () => validate(dat, sample(0, { 2: r.samples[0][2] + 1 }), V) }, // @math column 2 is the pointer
      { label: 'priority 0', fn: () => validate(dat, sample(0, { 4: 0 }), V) },
    ];
  },
};
