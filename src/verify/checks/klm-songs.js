import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { view } from '../../binary.js';
import { expected } from '../expect.js';

const values = () => ({ s: expected('klm.songs'), p: expected('klm.player') });

// Walk one song with the driver's grammar (klm.player): header, instrument table, then commands to the end byte.
function walk(song, P) {
  const dv = view(song), H = P.header, tempo = dv.getUint16(H.tempoAt, true), start = dv.getUint16(H.songAt, true);
  assert.equal((start - H.instrumentsAt) % H.instrumentBytes, 0, 'the instrument table is a whole number of records');
  const instruments = (start - H.instrumentsAt) / H.instrumentBytes, used = new Set();
  let p = start, commands = 0, delays = 0, ticks = 0, maxInstrument = -1;
  for (;;) {
    assert.ok(p < song.length, 'the song ends with its end byte');
    const c = song[p++];
    if (c === P.end) break;
    if (c === P.delay8) { ticks += song[p]; p += 1; delays++; continue; }
    if (c === P.delay16) { ticks += dv.getUint16(p, true); p += 2; delays++; continue; } // @math a 16-bit delay
    const kind = c >> 4, channel = c & 15; // @math nibbles
    assert.ok(kind <= P.maxKind, `command ${c.toString(16)} is a known kind`); // @math hexadecimal radix
    assert.ok(channel < P.channels, 'channel in range');
    commands++; used.add(`${kind}:${channel}`);
    if (kind === P.kinds.freq) p += P.freqBytes[channel];
    else if (kind === P.kinds.volume) p += 1;
    else if (kind === P.kinds.instrument) { maxInstrument = Math.max(maxInstrument, song[p]); p += 1; }
  }
  assert.equal(p, song.length, 'the end byte is the last byte of the file');
  assert.ok(maxInstrument < instruments, 'instrument numbers are inside the table');
  return { tempo, instruments, commands, delays, ticks, used: [...used].sort(), maxInstrument };
}

function validate(dat, V) {
  const S = V.s, songs = parseDatDirectory(dat).filter(e => /\.KLM$/i.test(e.name)), facts = songs.map(e => walk(e.data, V.p));
  assert.equal(songs.length, S.songs, 'the number of songs');
  assert.deepEqual([...new Set(facts.map(f => f.tempo))], [S.tempo], 'one tick rate');
  assert.equal(facts.reduce((n, f) => n + f.commands, 0), S.commands, 'the commands of all songs');
  assert.equal(facts.reduce((n, f) => n + f.delays, 0), S.delays, 'the delays of all songs');
  assert.equal(facts.reduce((n, f) => n + f.ticks, 0), S.ticks, 'the ticks of all songs');
  assert.equal(Math.max(...facts.map(f => f.instruments)), S.mostInstruments, 'the longest instrument table');
  assert.deepEqual([...new Set(facts.flatMap(f => f.used))].sort(), [...S.kindsAndChannels].sort(), 'the command kinds and channels that occur');
}

export default {
  id: 'klm-songs',
  claims: ['klm.songs'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), V = values(), p = patch => () => validate(dat, { ...V, p: { ...V.p, ...patch } }), s = patch => () => validate(dat, { ...V, s: { ...V.s, ...patch } });
    return [
      { label: 'channel 6 frequency without bytes', fn: p({ freqBytes: V.p.freqBytes.map((n, ch) => (ch === V.p.twoOperatorChannels - 1 ? 0 : n)) }) },
      { label: 'channel 0 frequency with 3 bytes', fn: p({ freqBytes: V.p.freqBytes.map((n, ch) => (ch === 0 ? n + 1 : n)) }) },
      { label: 'instrument records of 10 bytes', fn: p({ header: { ...V.p.header, instrumentBytes: V.p.header.instrumentBytes - 1 } }) },
      { label: 'end byte 0xfe', fn: p({ end: V.p.delay16 }) },
      { label: 'one more song', fn: s({ songs: V.s.songs + 1 }) },
      { label: 'another tick rate', fn: s({ tempo: V.s.tempo + 1 }) },
      { label: 'one command more', fn: s({ commands: V.s.commands + 1 }) },
      { label: 'one tick more', fn: s({ ticks: V.s.ticks + 1 }) },
    ];
  },
};
