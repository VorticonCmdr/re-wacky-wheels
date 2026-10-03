// LZEXE 0.91 compressed program images (the packer WWHELP.EXE was built with, claim wwhelp.packed): a bit stream of 16-bit words
// whose bits are taken from the lowest up, mixed with literal bytes and offsets, read forward from the end of the MZ header. The rules
// are those of the packer's own decompressor stub; claim lzexe.decode shows that this decoder reproduces the program as it runs.
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const RULES = () => K({ headerParasAt: 0x08, paragraph: 0x10, wordBits: 0x10, shortSpanHigh: 0xff00, longSpanHigh: 0xe000, spanHighMask: 0x07, spanHighShift: 0x05, lengthBias: 0x02, extendedBias: 0x01, endMark: 0x00 }, 'lzexe.decode');

const MAX_OUTPUT = 2 ** 24; // @math size guard of the decoder, not a format value

// Returns the decompressed program image (without the MZ header or relocations) and the file offset where the packed stream ended.
export function unpackLzexe(data) {
  const R = RULES(), b = bytes(data), dv = view(b);
  let pos = dv.getUint16(R.headerParasAt, true) * R.paragraph; // @math the header size in paragraphs
  const word = () => { need(b, pos, 2, 'LZEXE bit word'); const v = dv.getUint16(pos, true); pos += 2; return v; }; // @math a 16-bit word
  const byte = () => { need(b, pos, 1, 'LZEXE byte'); return b[pos++]; };
  let bits = word(), left = R.wordBits;
  const bit = () => { const v = bits & 1; bits >>>= 1; if (--left === 0) { bits = word(); left = R.wordBits; } return v; }; // the next word is read as soon as the last bit of one is used
  const out = [];
  for (;;) {
    if (out.length > MAX_OUTPUT) throw new Error('LZEXE output is too large');
    if (bit()) { out.push(byte()); continue; }
    let span, length;
    if (!bit()) { length = bit() << 1; length |= bit(); length += R.lengthBias; span = byte() | R.shortSpanHigh; } // @math two length bits, then a low offset byte
    else {
      span = byte(); length = byte();
      span |= ((length & ~R.spanHighMask) << R.spanHighShift) | R.longSpanHigh;
      length = (length & R.spanHighMask) + R.lengthBias;
      if (length === R.lengthBias) {
        length = byte();
        if (length === R.endMark) break;
        if (length === 1) continue; // the segment-change mark: skipped (the stream of WWHELP.EXE has none)
        length += R.extendedBias;
      }
    }
    span -= 2 ** R.wordBits; // @math the offset is a 16-bit value with its high bits set: negative
    for (let i = 0; i < length; i++) { const from = out.length + span; if (from < 0) throw new Error('LZEXE match reaches before the start'); out.push(out[from]); }
  }
  return { image: Uint8Array.from(out), packedEnd: pos };
}
