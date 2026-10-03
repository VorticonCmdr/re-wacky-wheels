// MIDI (.MID) files read the way the game's sequencer reads them (claims midi.player, midi.songs): the header the loader
// accepts, MTrk chunks, variable-length deltas, running status, meta events with a one-byte length (only the end of track and the
// tempo are acted on) and channel events with the data byte counts of the sequencer's table. Every track is walked to its end;
// events are returned with their absolute tick. System messages (sysex) are not handled by the game's sequencer and are rejected.
import { bytes, need } from '../binary.js';
import { K } from '../evidence/k.js';

const SEQUENCER = () => K({ loader: 0x3b014, tick: 0x3a99b, tickTable: 0x3a890, kindTable: 0x3a97c, header: { tag: 'MThd', lengthAt: 4, formatAt: 8, tracksAt: 10, divisionAt: 12, chunkHeader: 8, minimum: 14 }, trackTag: 'MTrk', trackLengthAt: 4, trackRecordBytes: 0x1c, maxFormat: 1, errors: { notHeader: 2, format: 3, noTracks: 4, notTrack: 5 }, dataBytes: [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 1, 2, 0], firstChannelKind: 8, lastChannelKind: 14, statusBit: 0x80, kindShift: 4, channelMask: 0xf, kinds: { noteOff: 8, noteOn: 9, aftertouch: 10, control: 11, program: 12, channelAftertouch: 13, pitchBend: 14 }, meta: 0xff, endOfTrack: 0x2f, tempo: 0x51, tempoBytes: 3, microsPerMinute: 60000000, secondsPerMinute: 60, controlWithExtraByte: 0x7e, volumeControl: 7, varLengthBits: 7 }, 'midi.player');

const be = (b, at, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[at + i]; return v; }; // @math big-endian bytes
const MAX_EVENTS = 1e6; // @math size guard of the viewer, not a game value

export function parseMidiEvents(data) {
  const P = SEQUENCER(), H = P.header, b = bytes(data);
  need(b, 0, H.minimum, 'MIDI header');
  if (String.fromCharCode(...b.subarray(0, H.tag.length)) !== H.tag) throw new Error('Not a MIDI file');
  const headerLength = be(b, H.lengthAt, 4), format = be(b, H.formatAt, 2), tracks = be(b, H.tracksAt, 2), division = be(b, H.divisionAt, 2); // @math big-endian dword and words
  if (format > P.maxFormat) throw new Error(`MIDI format ${format} is not supported`);
  if (!tracks) throw new Error('MIDI has no tracks');
  let p = H.chunkHeader + headerLength, serial = 0, lastTick = 0;
  need(b, 0, p, 'MIDI header');
  const events = [], walks = [];
  for (let track = 0; track < tracks; track++) {
    need(b, p, H.chunkHeader, 'MIDI track');
    if (String.fromCharCode(...b.subarray(p, p + P.trackTag.length)) !== P.trackTag) throw new Error('Missing MTrk');
    const length = be(b, p + P.trackLengthAt, 4); // @math the length dword
    p += H.chunkHeader; need(b, p, length, 'MIDI track');
    const end = p + length, steps = [];
    let tick = 0, status = 0, done = false;
    walks.push({ start: p, end, steps });
    const take = n => { if (p + n > end) throw new Error('Truncated MIDI event'); const at = p; p += n; return at; };
    while (p < end && !done) {
      let delta = 0, byte;
      const deltaAt = p;
      do { byte = b[take(1)]; delta = delta * 2 ** P.varLengthBits + (byte & ~P.statusBit); } while (byte & P.statusBit); // @math seven bits a byte
      tick += delta; lastTick = Math.max(lastTick, tick);
      steps.push({ deltaAt, delta, eventAt: p, statusBefore: status }); // where the sequencer\'s pointer rests while this event\'s delta counts down
      const first = b[take(1)];
      if (first === P.meta) {
        const type = b[take(1)], n = b[take(1)];
        if (type === P.endOfTrack) { take(n); done = true; break; }
        const at = take(n);
        if (type === P.tempo) { if (n < P.tempoBytes) throw new Error('Truncated MIDI tempo'); events.push({ tick, serial: serial++, kind: 'tempo', tempo: be(b, at, P.tempoBytes) }); }
        continue;
      }
      if (first & P.statusBit) status = first; else { if (!status) throw new Error('Invalid MIDI running status'); p--; }
      const kind = status >> P.kindShift;
      if (kind < P.firstChannelKind || kind > P.lastChannelKind) throw new Error(`Unsupported MIDI status ${status}`);
      const at = take(P.dataBytes[kind]), n = P.dataBytes[kind];
      if (b.subarray(at, at + n).some(v => v & P.statusBit)) throw new Error('Invalid MIDI data byte');
      if (kind === P.kinds.control && b[at] === P.controlWithExtraByte) take(1);
      events.push({ tick, serial: serial++, kind, channel: status & P.channelMask, a: b[at], b: n === 2 ? b[at + 1] : 0 }); // @math the second data byte of a two-byte event
      if (events.length > MAX_EVENTS) throw new Error('Too many MIDI events');
    }
    p = end;
  }
  return { format, tracks, division, events, lastTick, walks };
}
