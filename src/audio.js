import { bytes, view, need, ascii } from './binary.js';
import { parseMidiEvents } from './formats/midi.js';

export { decodeVocAudio as decodeVoc } from './formats/voc-audio.js';

export { decodePcSpeaker } from './formats/pc-speaker.js';

export { parseKlmSong as parseKlm } from './formats/klm.js';

export function parseAdlib(data) {
  const b = bytes(data), v = view(b); need(b, 0, 23, 'AdLib sound');
  const count = v.getUint32(0, true); need(b, 23, count, 'AdLib tones');
  if (count > 140 * 120) throw new Error('AdLib sound is too long');
  const events = [{ time: 0, reg: 1, value: 32 }];
  const registers = [0x20, 0x23, 0x40, 0x43, 0x60, 0x63, 0x80, 0x83, 0xE0, 0xE3, 0xC0];
  registers.forEach((reg, i) => events.push({ time: 0, reg, value: b[6 + i] }));
  const block = (b[22] & 7) << 2; let prev = -1;
  for (let i = 0; i < count; i++) {
    const value = b[23 + i]; if (value === prev) continue; prev = value;
    if (value) events.push({ time: i / 140, reg: 0xA0, value });
    events.push({ time: i / 140, reg: 0xB0, value: block | (value ? 32 : 0) });
  }
  events.push({ time: count / 140, reg: 0xB0, value: block });
  return { events, duration: count / 140 };
}

export function parseMidi(data) {
  // The file is read by the traced sequencer grammar (src/formats/midi.js, claims midi.player and midi.songs). Pairing notes below
  // is the viewer's own: the game hands note, controller and program events to its sound card driver. The controller numbers 64
  // (sustain), 120 and 123 (all notes off) are the MIDI specification's, not read from the game.
  const { events, tracks, division, lastTick } = parseMidiEvents(data);
  if (!division || division & 0x8000) throw new Error('Only quarter-note timing is supported');
  events.sort((a, b) => a.tick - b.tick || a.serial - b.serial);
  const active = Array.from({ length: 16 }, () => new Map()), programs = new Uint8Array(16), sustain = new Uint8Array(16), notes = [];
  let tempo = 500000, time = 0, tick = 0;
  function finish(channel, pitch, endTime) {
    const stack = active[channel].get(pitch); if (!stack?.length) return;
    const note = stack.shift(); note.end = endTime; if (note.end > note.start) notes.push(note);
  }
  for (const e of events) {
    time += (e.tick - tick) * tempo / division / 1e6; tick = e.tick;
    if (time > 600) throw new Error('MIDI exceeds 10-minute limit');
    if (e.kind === 'tempo') { if (!e.tempo) throw new Error('Invalid MIDI tempo'); tempo = e.tempo; continue; }
    const { channel: ch, a, b: velocity } = e;
    if (e.kind === 12) programs[ch] = a;
    else if (e.kind === 9 && velocity) {
      if (!active[ch].has(a)) active[ch].set(a, []);
      active[ch].get(a).push({ start: time, end: time, pitch: a, velocity, program: programs[ch], channel: ch });
    } else if (e.kind === 8 || (e.kind === 9 && !velocity)) {
      if (sustain[ch]) { const note = active[ch].get(a)?.find(n => !n.released); if (note) note.released = true; }
      else finish(ch, a, time);
    } else if (e.kind === 11 && a === 64) {
      sustain[ch] = velocity >= 64;
      if (!sustain[ch]) for (const [pitch, stack] of active[ch]) {
        const held = stack.filter(n => !n.released); for (const note of stack.filter(n => n.released)) { note.end = time; notes.push(note); } active[ch].set(pitch, held);
      }
    } else if (e.kind === 11 && [120, 123].includes(a)) {
      for (const [pitch, stack] of active[ch]) while (stack.length) finish(ch, pitch, time);
    }
  }
  time += (lastTick - tick) * tempo / division / 1e6;
  for (let ch = 0; ch < 16; ch++) for (const [pitch, stack] of active[ch]) while (stack.length) finish(ch, pitch, time);
  return { notes, duration: time, tracks, division, events: events.length };
}

export function encodeWav(audio) {
  const { samples, sampleRate, channels = 1 } = audio;
  const buffer = new ArrayBuffer(44 + samples.length * 2), v = new DataView(buffer);
  const str = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, buffer.byteLength - 8, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, channels, true); v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * channels * 2, true); v.setUint16(32, channels * 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return buffer;
}
