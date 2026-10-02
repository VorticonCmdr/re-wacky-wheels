import OPL3 from '../vendor/opl3.js';
import { parseKlm, parseAdlib, parseMidi } from './audio.js';

export function renderOpl(data, kind, limit = 30, progress = () => {}) {
  const song = kind === 'klm' ? parseKlm(data) : parseAdlib(data);
  const sampleRate = 49700, duration = Math.min(song.duration + 0.35, limit), frames = Math.ceil(duration * sampleRate), samples = new Float32Array(frames * 2);
  const chip = new OPL3(); let at = 0;
  for (const event of song.events) {
    const next = Math.min(frames, Math.round(event.time * sampleRate));
    if (next > at) chip.read(samples.subarray(at * 2, next * 2));
    at = next;
    if (at >= frames) break;
    chip.write(0, event.reg, event.value);
    if (event.time % 5 < 0.02) progress(at / Math.max(frames, 1));
  }
  for (let ch = 0; ch < 9; ch++) chip.write(0, 0xB0 + ch, chip.registers[0xB0 + ch] & ~32);
  chip.write(0, 0xBD, 32);
  if (at < frames) chip.read(samples.subarray(at * 2));
  // Gentle gain compensates for this emulator's 18-channel normalization in OPL2 mode.
  for (let i = 0; i < samples.length; i++) samples[i] = Math.max(-0.95, Math.min(0.95, samples[i] * 2));
  return { samples, sampleRate, channels: 2, duration: song.duration, description: kind === 'klm' ? 'Original KLM instruments · JavaScript OPL synthesis' : 'Original AdLib instrument · OPL synthesis at 140 ticks/s' };
}

export function renderMidi(data, limit = 30) {
  const song = parseMidi(data), sampleRate = 22050, duration = Math.min(song.duration + 0.4, limit), samples = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 1;
  for (const n of song.notes) {
    const start = Math.floor(n.start * sampleRate); if (start >= samples.length) continue;
    const length = n.end - n.start, release = 0.12, count = Math.min(samples.length - start, Math.ceil((length + release) * sampleRate));
    const freq = 440 * 2 ** ((n.pitch - 69) / 12), family = Math.floor(n.program / 8), percussion = n.channel === 9;
    const gain = n.velocity / 127 * 0.09;
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate, phase = 2 * Math.PI * freq * t;
      let envelope = Math.min(1, t / 0.008) * (t < length ? 1 : Math.max(0, 1 - (t - length) / release));
      if ([0, 1, 3].includes(family)) envelope *= Math.exp(-t * 1.5);
      let wave;
      if (percussion) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; wave = (seed / 2 ** 31 - 1) * Math.exp(-t * 18); }
      else {
        wave = Math.sin(phase);
        if (family !== 9) wave += Math.sin(phase * 2) * ([2, 6, 7].includes(family) ? 0.4 : 0.15);
        if ([5, 6, 7, 10].includes(family)) wave += Math.sin(phase * 3) * 0.2;
      }
      samples[start + i] += wave * gain * envelope;
    }
  }
  for (let i = 0; i < samples.length; i++) samples[i] = Math.tanh(samples[i]);
  return { samples, sampleRate, channels: 1, duration: song.duration, description: 'Original MIDI notes · approximate General MIDI timbres (no soundfont)' };
}
