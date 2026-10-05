import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseAudioBankWith } from '../../formats/audio-bank.js';
import { expected } from '../expect.js';

const values = () => ({ F: expected('audio.chunk-fields'), L: expected('audio.bank-layout') });
const hex = b => Buffer.from(b).toString('hex');
const text = trailer => Buffer.from(trailer.subarray(1)).toString('latin1').replace(/\0+$/, '');

// The header fields of the 52 sounds (audio.chunk-fields): the word after the length dword, the second bank's instrument bytes and block byte, and the trailer texts.
function validate(dat, V, { priorityBytes = V.F.priorityBytes, instrument = null } = {}) {
  const by = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), { slots } = parseAudioBankWith(by.get('AUDIOHED.FX'), by.get('AUDIOT.FX'), V.L), F = V.F;
  const first = slots.filter(s => s.bank === 'first'), second = slots.filter(s => s.bank === 'second');
  for (const s of slots) assert.ok(s.header.subarray(0, priorityBytes).every(b => b === 0), `slot ${s.index}: the word after the length is 0`);
  const common = instrument ?? F.defaultInstrument, odd = second.filter(s => hex(s.header.subarray(F.priorityBytes, F.priorityBytes + F.instrumentBytes)) !== common || s.header[F.priorityBytes + F.instrumentBytes] !== F.defaultBlock);
  assert.deepEqual(odd.map(s => s.index), F.differing.map(d => d.slot), 'the sounds that do not hold the common instrument and block');
  odd.forEach((s, i) => assert.deepEqual([hex(s.header.subarray(F.priorityBytes, F.priorityBytes + F.instrumentBytes)), s.header[F.priorityBytes + F.instrumentBytes]], [F.differing[i].instrument, F.differing[i].block], `slot ${s.index}`));
  const names = new Map(); for (const s of second) names.set(text(s.trailer), (names.get(text(s.trailer)) ?? 0) + 1);
  assert.deepEqual([...names].sort(), F.names.map(n => [n.text, n.count]).sort(), 'the trailer texts');
  assert.equal(first.length + second.length, F.sounds, 'the sounds');
}

export default {
  id: 'audio-fields',
  claims: ['audio.chunk-fields'],
  reviewed: { by: 'main-session', date: '2026-10-05' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values();
    return [
      { label: 'the instrument without its last byte', fn: () => validate(dat, V, { instrument: V.F.defaultInstrument.slice(0, -2) }) }, // @math one byte is two hex digits
      { label: 'a longer priority field', fn: () => validate(dat, V, { priorityBytes: 3 }) }, // @math the priority word plus the first instrument byte
    ];
  },
};
