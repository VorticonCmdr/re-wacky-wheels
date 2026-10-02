import { bytes, view, need, ascii } from './binary.js';

export function decodeVoc(data) {
  const b = bytes(data), v = view(b); need(b, 0, 26, 'VOC');
  if (ascii(b.subarray(0, 19)) !== 'Creative Voice File' || b[19] !== 26) throw new Error('Not a Creative Voice file');
  const version = v.getUint16(22, true);
  if (v.getUint16(24, true) !== ((~version + 0x1234) & 65535)) throw new Error('Invalid VOC checksum');
  let p = v.getUint16(20, true), rate = 11025, channels = 1, codec = 0, bits = 8, extended = null, loop = false;
  need(b, 0, p, 'VOC header');
  const segments = [], repeats = []; let totalSeconds = 0;
  function append(samples, r, c) {
    totalSeconds += samples.length / r / c;
    if (totalSeconds > 120) throw new Error('VOC exceeds 120-second decoding limit');
    segments.push({ samples, rate: r, channels: c });
  }
  function decode(payload) {
    if (!((codec === 0 && bits === 8) || (codec === 4 && bits === 16))) throw new Error(`VOC codec ${codec}/${bits}-bit is unsupported`);
    const sampleBytes = bits / 8;
    if (payload.length % (sampleBytes * channels)) throw new Error('VOC sample data is not frame aligned');
    const dv = view(payload), samples = new Float32Array(payload.length / sampleBytes);
    for (let i = 0; i < samples.length; i++) samples[i] = bits === 8 ? (payload[i] - 128) / 128 : dv.getInt16(i * 2, true) / 32768;
    append(samples, rate, channels);
  }
  while (p < b.length) {
    const type = b[p++]; if (type === 0) break;
    need(b, p, 3, 'VOC block length');
    const length = b[p] | b[p + 1] << 8 | b[p + 2] << 16; p += 3;
    need(b, p, length, 'VOC block');
    const block = b.subarray(p, p + length), d = view(block); p += length;
    switch (type) {
      case 1:
        need(block, 0, 2, 'VOC sound block');
        if (extended) { ({ rate, channels, codec } = extended); extended = null; }
        else { rate = 1e6 / (256 - block[0]); channels = 1; codec = block[1]; }
        bits = codec === 4 ? 16 : 8; decode(block.subarray(2)); break;
      case 2: decode(block); break;
      case 3: {
        need(block, 0, 3, 'VOC silence');
        const r = 1e6 / (256 - block[2]); append(new Float32Array(d.getUint16(0, true) + 1), r, 1); break;
      }
      case 4: case 5: break;
      case 6: need(block, 0, 2, 'VOC repeat'); repeats.push({ index: segments.length, count: d.getUint16(0, true) }); break;
      case 7: {
        const repeat = repeats.pop();
        if (!repeat) throw new Error('VOC repeat end has no start');
        if (repeat.count === 65535) { loop = true; break; }
        if (repeat.count > 1000) throw new Error('VOC repeat count exceeds preview limit');
        const chunk = segments.slice(repeat.index);
        for (let i = 0; i < repeat.count; i++) for (const s of chunk) append(s.samples, s.rate, s.channels);
        break;
      }
      case 8: {
        need(block, 0, 4, 'VOC extended settings');
        const c = block[3] + 1;
        extended = { rate: 256e6 / (c * (65536 - d.getUint16(0, true))), channels: c, codec: block[2] }; break;
      }
      case 9:
        need(block, 0, 12, 'VOC new sound'); rate = d.getUint32(0, true); bits = block[4]; channels = block[5]; codec = d.getUint16(6, true);
        if (rate < 100 || rate > 192000 || channels < 1 || channels > 2) throw new Error('Unsupported VOC audio settings');
        decode(block.subarray(12)); break;
      default: throw new Error(`Unknown VOC block ${type}`);
    }
  }
  if (!segments.length) throw new Error('VOC contains no audio');
  const sampleRate = Math.round(segments[0].rate), count = Math.round(totalSeconds * sampleRate), output = new Float32Array(count);
  let at = 0;
  for (const s of segments) {
    const frames = s.samples.length / s.channels, n = Math.round(frames * sampleRate / s.rate);
    for (let i = 0; i < n && at < count; i++, at++) {
      const frame = Math.min(frames - 1, Math.floor(i * s.rate / sampleRate)); let value = 0;
      for (let c = 0; c < s.channels; c++) value += s.samples[frame * s.channels + c];
      output[at] = value / s.channels;
    }
  }
  return { samples: output, sampleRate, channels: 1, loop, description: `Creative Voice PCM · ${sampleRate} Hz${loop ? ' · original loop' : ''}` };
}

export function decodePcSpeaker(data, sampleRate = 22050) {
  const b = bytes(data), v = view(b); need(b, 0, 6, 'PC speaker');
  const n = v.getUint32(0, true); need(b, 6, n, 'PC-speaker tones');
  if (n > 140 * 120) throw new Error('PC-speaker sound is too long');
  const samples = new Float32Array(Math.ceil(n / 140 * sampleRate)); let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const tone = b[6 + Math.floor(i * 140 / sampleRate)] ?? 0;
    if (tone) { phase = (phase + 1193181 / (tone * 60) / sampleRate) % 1; samples[i] = phase < 0.5 ? 0.2 : -0.2; }
  }
  return { samples, sampleRate, channels: 1, loop: false, description: 'PC speaker · square-wave synthesis at 140 ticks/s' };
}

const modOffsets = [0, 1, 2, 8, 9, 10, 16, 17, 18];
const percOffsets = [19, 20, 18, 21, 17];
export function parseKlm(data) {
  const b = bytes(data), v = view(b); need(b, 0, 5, 'KLM');
  const tempo = v.getUint16(0, true), start = v.getUint16(3, true);
  if (!tempo || start < 5 || (start - 5) % 11) throw new Error('Invalid KLM instrument block');
  need(b, 5, start - 5, 'KLM instruments');
  const instruments = Array.from({ length: (start - 5) / 11 }, (_, i) => b.subarray(5 + i * 11, 16 + i * 11));
  const events = [], registers = new Uint8Array(256); let ticks = 0, p = start, rhythm = 32, ended = false;
  const write = (reg, value) => { registers[reg] = value; events.push({ time: ticks / tempo, reg, value }); };
  write(1, 32); write(0xBD, rhythm);
  function next(n) { need(b, p, n, 'KLM command'); const at = p; p += n; return at; }
  while (p < b.length && events.length < 1e6) {
    const cmd = b[p++], channel = cmd & 15, kind = cmd & 240;
    if (cmd === 255) { ended = true; break; }
    if (cmd === 253) { ticks += b[next(1)]; continue; }
    if (cmd === 254) { ticks += v.getUint16(next(2), true); continue; }
    if (channel > 10) throw new Error(`Invalid KLM channel ${channel}`);
    if (kind === 0 || kind === 64) {
      if (channel <= 6) {
        // Preserve the most recent block/frequency bits in B0.
        const reg = 0xB0 + channel, prev = registers[reg];
        write(reg, kind === 64 ? prev | 32 : prev & ~32);
        if (channel === 6) { rhythm = kind === 64 ? rhythm | 16 : rhythm & ~16; write(0xBD, rhythm); }
      } else { const bit = 1 << (10 - channel); rhythm = kind === 64 ? rhythm | bit : rhythm & ~bit; write(0xBD, rhythm); }
    } else if (kind === 16) {
      if (channel <= 6) {
        // The supplied songs use two frequency bytes for channel 6 as well.
        // The wiki's 0..5 boundary would desynchronize every song in this archive.
        const at = next(2); write(0xA0 + channel, b[at]); write(0xB0 + channel, b[at + 1]);
        if (channel === 6) { rhythm = b[at + 1] & 32 ? rhythm | 16 : rhythm & ~16; write(0xBD, rhythm); }
      }
      else { rhythm |= 1 << (10 - channel); write(0xBD, rhythm); }
    } else if (kind === 32) {
      const value = b[next(1)], offset = channel < 6 ? modOffsets[channel] + 3 : percOffsets[channel - 6];
      write(0x40 + offset, Math.floor((127 - Math.min(value, 127)) / 2));
    } else if (kind === 48) {
      const index = b[next(1)], inst = instruments[index];
      if (!inst) throw new Error('KLM references a missing instrument');
      if (channel <= 6) {
        const mod = modOffsets[channel], car = mod + 3;
        const regs = [0x40 + mod, 0x40 + car, 0x60 + mod, 0x60 + car, 0x80 + mod, 0x80 + car, 0x20 + mod, 0x20 + car, 0xE0 + mod, 0xE0 + car, 0xC0 + channel];
        for (let i = 0; i < 11; i++) write(regs[i], inst[i]);
      } else {
        const offset = percOffsets[channel - 6], carrier = channel === 7 || channel === 9, base = carrier ? 1 : 0;
        [0x40, 0x60, 0x80, 0x20, 0xE0].forEach((reg, i) => write(reg + offset, inst[i * 2 + base]));
        write(0xC0 + (channel === 7 || channel === 10 ? 7 : 8), inst[10]);
      }
    } else throw new Error(`Unknown KLM command 0x${cmd.toString(16)}`);
    if (ticks / tempo > 600) throw new Error('KLM exceeds 10-minute limit');
  }
  if (!ended) throw new Error('KLM has no end command');
  return { events, duration: ticks / tempo, tempo, instruments: instruments.length };
}

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
  const b = bytes(data), v = view(b); need(b, 0, 14, 'MIDI header');
  if (ascii(b.subarray(0, 4)) !== 'MThd') throw new Error('Not a MIDI file');
  const headerSize = v.getUint32(4), type = v.getUint16(8), tracks = v.getUint16(10), division = v.getUint16(12);
  if (headerSize < 6 || type > 1 || !tracks || !division || division & 0x8000) throw new Error('Only format 0/1 MIDI with quarter-note timing is supported');
  let p = 8 + headerSize, serial = 0, lastTick = 0; need(b, 0, p, 'MIDI header');
  const events = [];
  for (let track = 0; track < tracks; track++) {
    need(b, p, 8, 'MIDI track'); if (ascii(b.subarray(p, p + 4)) !== 'MTrk') throw new Error('Missing MTrk');
    const length = v.getUint32(p + 4); p += 8; const end = p + length; need(b, p, length, 'MIDI track');
    let tick = 0, running = 0;
    function vlq() { let value = 0; for (let i = 0; i < 4; i++) { if (p >= end) throw new Error('Truncated MIDI variable integer'); const byte = b[p++]; value = value * 128 + (byte & 127); if (!(byte & 128)) return value; } throw new Error('MIDI variable integer exceeds four bytes'); }
    function take(n) { if (p + n > end) throw new Error('Truncated MIDI event'); const at = p; p += n; return at; }
    while (p < end) {
      tick += vlq(); lastTick = Math.max(lastTick, tick);
      let status = b[take(1)];
      if (status < 128) { if (!running) throw new Error('Invalid MIDI running status'); p--; status = running; }
      if (status < 240) running = status;
      else if (status !== 255) running = 0;
      if (status === 255) {
        const meta = b[take(1)], n = vlq(), at = take(n);
        if (meta === 81 && n === 3) events.push({ tick, serial: serial++, kind: 'tempo', tempo: b[at] << 16 | b[at + 1] << 8 | b[at + 2] });
        if (meta === 47) { p = end; break; }
      } else if (status === 240 || status === 247) take(vlq());
      else if (status < 240) {
        const kind = status >> 4, n = kind === 12 || kind === 13 ? 1 : 2, at = take(n);
        if (b[at] >= 128 || (n === 2 && b[at + 1] >= 128)) throw new Error('Invalid MIDI data byte');
        events.push({ tick, serial: serial++, kind, channel: status & 15, a: b[at], b: n === 2 ? b[at + 1] : 0 });
      } else throw new Error(`Unsupported MIDI status ${status}`);
      if (events.length > 1e6) throw new Error('Too many MIDI events');
    }
  }
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
