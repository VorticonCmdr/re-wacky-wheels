// KLM (AdLib music) songs, played the way the game's sound library plays them (claims klm.player, klm.opl-tables): the song is
// walked with the driver's command grammar and every OPL2 register write the driver would make is recorded with its time, from
// the reset and initialisation to the end byte. The structure is checked against the 16 archive songs (klm.songs). Tick pacing
// comes from the header's tick rate; how the game's timer service paces the calls is not read.
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const PLAYER = () => K({ tick: 0x3a4a4, dispatchTable: 0x3a490, header: { tempoAt: 0, songAt: 3, instrumentsAt: 5, instrumentBytes: 11 }, delay8: 0xfd, delay16: 0xfe, end: 0xff, maxKind: 4, kinds: { off: 0, freq: 1, volume: 2, instrument: 3, on: 4 }, channels: 11, twoOperatorChannels: 7, freqBytes: [2, 2, 2, 2, 2, 2, 2, 0, 4, 0, 0], ports: { index: 0x388, data: 0x389 }, regs: { waveEnable: 0x01, noteSelect: 0x08, rhythm: 0xbd, freqLow: 0xa0, freqHigh: 0xb0, level: 0x40, attackDecay: 0x60, sustainRelease: 0x80, tremolo: 0x20, waveform: 0xe0, feedback: 0xc0 }, init: { waveEnable: 0x20, rhythmMode: 0x20, tom: { low: 0xa8, lowValue: 0x57, high: 0xb8, highValue: 0x09 }, snare: { low: 0xa7, lowValue: 0x03, high: 0xb7, highValue: 0x0a }, release: 0x0f, volume: 0x7f, voices: 9 }, keyOn: 0x20, levelMask: 0x3f, kslMask: 0xc0, additive: 1, volumeRounding: 0x7f, volumeDivisor: 0xfe, volumeScale: 0xff, modulatorFields: [0, 2, 4, 6, 8], carrierFields: [1, 3, 5, 7, 9], feedbackField: 10, tomChannel: 8, snareChannel: 7 }, 'klm.player');
const TABLES = () => K({ slotMapAt: 0x4588, slotMapStride: 8, slots: [[0, 3], [1, 4], [2, 5], [6, 9], [7, 10], [8, 11], [12, 15], [16, 0], [14, 0], [17, 0], [13, 0]], opOffsetsAt: 0x45e0, opOffsets: [0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21], rhythmBitsAt: 0x455c, rhythmFirstChannel: 6, rhythmBits: [0x10, 0x8, 0x4, 0x2, 0x1], masterVolumeAt: 0x4570, masterVolume: 0xff }, 'klm.opl-tables');

const MAX_EVENTS = 1e6; // @math size guard of the viewer, not a game value
const MAX_SECONDS = 600; // @math length guard of the viewer, not a game value

export function parseKlmSong(data) {
  const P = PLAYER(), T = TABLES(), H = P.header, R = P.regs, b = bytes(data), dv = view(b);
  need(b, 0, H.instrumentsAt, 'KLM header');
  const tempo = dv.getUint16(H.tempoAt, true), start = dv.getUint16(H.songAt, true);
  if (!tempo) throw new Error('KLM has no tick rate');
  if (start < H.instrumentsAt || (start - H.instrumentsAt) % H.instrumentBytes) throw new Error('KLM instrument table is not a whole number of records');
  need(b, H.instrumentsAt, start - H.instrumentsAt, 'KLM instruments');
  const instruments = (start - H.instrumentsAt) / H.instrumentBytes, slots = T.opOffsets.length;
  const events = [];
  let ticks = 0, rhythm = 0;
  const write = (reg, value) => events.push({ time: ticks / tempo, reg, value });
  const low = new Array(P.channels).fill(0), high = new Array(P.channels).fill(0), loaded = new Array(P.channels).fill(-1);
  const level = new Array(slots).fill(0), ksl = new Array(slots).fill(0), volume = new Array(slots).fill(P.init.volume);
  const bit = channel => T.rhythmBits[channel - T.rhythmFirstChannel], percussion = channel => channel >= T.rhythmFirstChannel;
  const setRhythm = value => { rhythm = value; write(R.rhythm, rhythm); };
  // obj1+0x40280: the operator's output level from its level, its volume and its key scaling bits.
  const apply = slot => write(R.level + T.opOffsets[slot], (P.levelMask - Math.floor((2 * level[slot] * volume[slot] + P.volumeRounding) / P.volumeDivisor)) | ksl[slot]); // @math twice the product, rounded
  const noteOff = channel => { if (percussion(channel)) setRhythm(rhythm & ~bit(channel)); else write(R.freqHigh + channel, high[channel] & ~P.keyOn); };
  // The reset (obj1+0x4080c) and the initialisation (obj1+0x40374).
  for (let s = 0; s < slots; s++) write(R.sustainRelease + T.opOffsets[s], P.init.release);
  for (let ch = 0; ch < P.channels; ch++) noteOff(ch);
  write(R.waveEnable, P.init.waveEnable); write(R.noteSelect, 0);
  for (let ch = 0; ch < P.init.voices; ch++) { write(R.freqLow + ch, 0); write(R.freqHigh + ch, 0); }
  for (let s = 0; s < slots; s++) write(R.waveform + T.opOffsets[s], 0);
  write(P.init.tom.low, P.init.tom.lowValue); write(P.init.tom.high, P.init.tom.highValue);
  write(P.init.snare.low, P.init.snare.lowValue); write(P.init.snare.high, P.init.snare.highValue);
  setRhythm(P.init.rhythmMode);
  const instrument = (channel, index) => {
    if (index >= instruments) throw new Error('KLM references a missing instrument');
    if (loaded[channel] === index) return;
    loaded[channel] = index;
    const at = H.instrumentsAt + index * H.instrumentBytes, ins = b.subarray(at, at + H.instrumentBytes), [m, c] = T.slots[channel], mo = T.opOffsets[m];
    const fields = [R.attackDecay, R.sustainRelease, R.tremolo, R.waveform];
    level[m] = P.levelMask - (ins[P.modulatorFields[0]] & P.levelMask); ksl[m] = ins[P.modulatorFields[0]] & P.kslMask;
    fields.forEach((reg, i) => write(reg + mo, ins[P.modulatorFields[i + 1]]));
    if (channel >= P.twoOperatorChannels) { apply(m); return; }
    write(R.level + mo, ins[P.modulatorFields[0]]); write(R.feedback + channel, ins[P.feedbackField]);
    level[c] = P.levelMask - (ins[P.carrierFields[0]] & P.levelMask); ksl[c] = ins[P.carrierFields[0]] & P.kslMask;
    apply(c);
    fields.forEach((reg, i) => write(reg + T.opOffsets[c], ins[P.carrierFields[i + 1]]));
  };
  const setVolume = (channel, value) => {
    const scaled = Math.floor(value * T.masterVolume / P.volumeScale), [m, c] = T.slots[channel];
    if (channel >= P.twoOperatorChannels) { volume[m] = scaled; apply(m); return; }
    volume[c] = scaled; apply(c);
    if (loaded[channel] >= 0 && b[H.instrumentsAt + loaded[channel] * H.instrumentBytes + P.feedbackField] & P.additive) { volume[m] = scaled; apply(m); }
  };
  let p = start;
  for (;;) {
    need(b, p, 1, 'KLM command');
    const cmd = b[p++];
    if (cmd === P.end) break;
    if (cmd === P.delay8) { need(b, p, 1, 'KLM delay'); ticks += b[p]; p += 1; continue; }
    if (cmd === P.delay16) { need(b, p, 2, 'KLM delay'); ticks += dv.getUint16(p, true); p += 2; continue; } // @math a 16-bit delay
    const kind = cmd >> 4, channel = cmd & 15; // @math the nibbles
    if (kind > P.maxKind) continue;
    if (channel >= P.channels) throw new Error(`Invalid KLM channel ${channel}`);
    if (kind === P.kinds.off) noteOff(channel);
    else if (kind === P.kinds.freq) {
      const n = P.freqBytes[channel]; need(b, p, n, 'KLM frequency');
      if (n) {
        write(R.freqLow + channel, low[channel] = b[p]); write(R.freqHigh + channel, high[channel] = b[p + 1]);
        if (channel === P.tomChannel) { write(P.init.snare.low, b[p + 2]); write(P.init.snare.high, b[p + 3]); } // @math the third and fourth byte
        p += n;
      }
      if (percussion(channel)) setRhythm(rhythm | bit(channel));
    } else if (kind === P.kinds.volume) { need(b, p, 1, 'KLM volume'); setVolume(channel, b[p]); p += 1; }
    else if (kind === P.kinds.instrument) { need(b, p, 1, 'KLM instrument'); instrument(channel, b[p]); p += 1; }
    else if (percussion(channel)) setRhythm(rhythm | bit(channel));
    else { write(R.freqLow + channel, low[channel]); write(R.freqHigh + channel, high[channel]); }
    if (events.length > MAX_EVENTS) throw new Error('KLM has too many register writes');
    if (ticks / tempo > MAX_SECONDS) throw new Error('KLM exceeds 10-minute limit');
  }
  return { events, duration: ticks / tempo, tempo, instruments };
}
