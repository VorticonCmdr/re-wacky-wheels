// PC-speaker sounds (the first bank of AUDIOT.FX) as the game's device-7 player plays them (claims audio.speaker-player, audio.speaker-rate): the chunk's first dword is the number of tone
// bytes, the 2 bytes after it are skipped and the tones start at chunk + 6; the player reads one byte a tick and the byte times 60 is the divisor of the timer chip's channel 2 (a 0 turns the
// speaker off). The ticks come from the timer service at the rate registered with the handler: the period 0x12305e / 0x8c timer counts, so 1193182 / 8514 a second.
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const PLAYER = () => K({ deviceWord: 0x3fe8, speakerDevice: 7, errorDevices: [2, 3, 4], skippedHeaderBytes: 2, divisorStep: 60, tickRateArgument: 0x8c, pitCommand: 0xb6, portCommand: 0x43, portData: 0x42, portGate: 0x61, gateBits: 3 }, 'audio.speaker-player');
const RATE = () => K({ rateArgument: 0x8c, registerAt: 0x373e7, service: 0x30e38, periodDividend: 0x12305e, periodAt: 0x30e80, periodOffset: 0x10, accumulatorOffset: 0x14, handlerOffset: 0x08, enabledOffset: 0x1c, divisorAt: 0x3fa4, pitProgram: 0x30ab0, pitCommand: 0x36, commandPort: 0x43, dataPort: 0x40, interrupt: 0x30b5c, dispatch: 0x30be4, pitClock: 1193182 }, 'audio.speaker-rate');

const MAX_SECONDS = 120; // @math output size guard of the viewer, not a game value
const AMPLITUDE = 0.2; // @math the level of the page's square wave

// The ticks a second of the speaker handler: the timer clock over the period the service stores (an integer division, 1192030 / 140 = 8514).
export const speakerTicksPerSecond = () => { const R = RATE(); return R.pitClock / Math.floor(R.periodDividend / R.rateArgument); };

export function decodePcSpeaker(data, sampleRate = 22050) { // @math the viewer's output rate
  const b = bytes(data), v = view(b), P = PLAYER(), head = Uint32Array.BYTES_PER_ELEMENT + P.skippedHeaderBytes, rate = speakerTicksPerSecond();
  need(b, 0, head, 'PC speaker');
  const n = v.getUint32(0, true); // the number of tone bytes
  need(b, head, n, 'PC-speaker tones');
  if (n > rate * MAX_SECONDS) throw new Error('PC-speaker sound is too long');
  const samples = new Float32Array(Math.ceil(n / rate * sampleRate)); let phase = 0;
  for (let i = 0; i < samples.length; i++) {
    const tone = b[head + Math.floor(i * rate / sampleRate)] ?? 0;
    if (tone) { phase = (phase + RATE().pitClock / (tone * P.divisorStep) / sampleRate) % 1; samples[i] = phase < 0.5 ? AMPLITUDE : -AMPLITUDE; } // @math a square wave: half the period high, half low
  }
  return { samples, sampleRate, channels: 1, loop: false, description: `PC speaker · square-wave synthesis at ${rate.toFixed(2)} ticks/s` }; // @math two decimals of the shown rate
}
