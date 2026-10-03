// Creative Voice (.VOC) samples to PCM, the way the game's sound library plays them (claim voc.library-player): the rate of a
// type-1 block is 0xf424000 / (0x10000 - (byte << 8)), only 8-bit mono PCM blocks play, silence, marker, text and extended
// blocks are skipped and a repeat plays its blocks once more per count. The structure comes from the traced parser (parseVoc,
// claim voc.layout). How the library hands the rate to the sound card is not read, so the viewer plays at the computed rate.
import { need, view } from '../binary.js';
import { K } from '../evidence/k.js';
import { parseVoc } from './voc.js';

const PLAYER = () => K({ tables: [0x37b80, 0x39442], tableEntries: 10, handlers: [0x394c0, 0x394ca, 0x394f9, 0x39503, 0x39503, 0x39503, 0x39530, 0x39541, 0x39503, 0x3956a], maxType: 9, rateDividend: 0xf424000, rateBase: 0x10000, rateShift: 8, playedCodec: 0, newSound: { bits: 8, channels: 1, codec: 0, headerBytes: 12 }, soundHeader: 2, infiniteRepeat: 0xffff, blockHeader: 4, lengthMask: 0xffffff }, 'voc.library-player');

const MAX_SAMPLES = 2 ** 26; // @math output size guard of the viewer, not a game value

export function decodeVocAudio(data) {
  const P = PLAYER(), { blocks } = parseVoc(data), [end, sound, cont, skip, , , repeatStart, repeatEnd, , fresh] = P.handlers;
  const segments = [];
  let rate = 0, total = 0, start = -1, count = 0, loop = false;
  const append = (bytes, r) => {
    if (!(r > 0)) throw new Error('VOC block has no sample rate');
    total += bytes.length / r;
    if (total * r > MAX_SAMPLES) throw new Error('VOC is too long to decode');
    segments.push({ bytes, rate: r });
  };
  for (let i = 0; i < blocks.length; i++) {
    const { type, data: block } = blocks[i];
    if (type > P.maxType) break;
    const handler = P.handlers[type];
    if (handler === end) break;
    if (handler === sound) {
      need(block, 0, P.soundHeader, 'VOC sound block');
      rate = Math.floor(P.rateDividend / (P.rateBase - (block[0] << P.rateShift)));
      if (block[1] === P.playedCodec) append(block.subarray(P.soundHeader), rate);
    } else if (handler === cont) {
      append(block, rate);
    } else if (handler === repeatStart) {
      need(block, 0, 2, 'VOC repeat'); // @math the count is one 16-bit word
      count = view(block).getUint16(0, true); start = i;
    } else if (handler === repeatEnd) {
      if (count > 0 && start >= 0) {
        if (count === P.infiniteRepeat) { loop = true; start = -1; continue; }
        i = start; count--;
        if (count === 0) start = -1;
      }
    } else if (handler === fresh) {
      need(block, 0, P.newSound.headerBytes, 'VOC new sound');
      const dv = view(block), N = P.newSound;
      rate = dv.getUint32(0, true);
      if (block[4] === N.bits && block[5] === N.channels && dv.getUint16(6, true) === N.codec) append(block.subarray(N.headerBytes), rate); // @math field offsets of the new-sound header
    } else if (handler !== skip) throw new Error(`VOC block type ${type} has no handler`);
  }
  if (!segments.length) throw new Error('VOC contains no audio');
  const sampleRate = Math.round(segments[0].rate), count2 = Math.round(total * sampleRate), output = new Float32Array(count2);
  let at = 0;
  for (const s of segments) {
    const n = Math.round(s.bytes.length * sampleRate / s.rate);
    for (let k = 0; k < n && at < count2; k++, at++) output[at] = (s.bytes[Math.min(s.bytes.length - 1, Math.floor(k * s.rate / sampleRate))] - 128) / 128; // @math unsigned 8-bit PCM is centred on 128
  }
  return { samples: output, sampleRate, channels: 1, loop, description: `Creative Voice PCM · ${sampleRate} Hz${loop ? ' · original loop' : ''}` };
}
