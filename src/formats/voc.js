// Creative Voice (.VOC) files, parsed strictly for structure with the layout the archive proves
// (claim voc.layout): header, block list, terminator at the end of the file. Sample rates and
// codecs are not interpreted here: the rate rule is a lead (docs/voc.md), so audio decoding stays
// in the legacy src/audio.js until it is traced.
import { bytes, view, need, ascii } from '../binary.js';
import { K } from '../evidence/k.js';

const LAYOUT = () => K({ magic: 'Creative Voice File', markerAt: 0x13, marker: 0x1a, headerSizeAt: 0x14, versionAt: 0x16, checksumAt: 0x18, headerBytes: 0x1a, checksumBase: 0x1234, blockHeaderBytes: 0x04, terminator: 0x00, soundBlock: 0x01, repeatStart: 0x06, repeatEnd: 0x07, pcm8: 0x00, infiniteRepeat: 0xffff }, 'voc.layout');

// `layout` is exposed so the check can show that wrong layouts are rejected.
export function parseVocWith(data, L) {
  const b = bytes(data), dv = view(b);
  need(b, 0, L.headerBytes, 'VOC header');
  if (ascii(b.subarray(0, L.magic.length)) !== L.magic || b[L.markerAt] !== L.marker) throw new Error('Not a Creative Voice file');
  if (dv.getUint16(L.headerSizeAt, true) !== L.headerBytes) throw new Error(`VOC header size is ${dv.getUint16(L.headerSizeAt, true)}, expected ${L.headerBytes}`);
  const version = dv.getUint16(L.versionAt, true);
  if (dv.getUint16(L.checksumAt, true) !== ((~version + L.checksumBase) & 0xffff)) throw new Error('Invalid VOC checksum'); // @math 16-bit complement
  const blocks = [];
  let p = L.headerBytes;
  for (;;) {
    need(b, p, 1, 'VOC block type');
    const type = b[p];
    if (type === L.terminator) {
      if (p + 1 !== b.length) throw new Error(`VOC has ${b.length - p - 1} bytes after its terminator`);
      return { version, blocks };
    }
    need(b, p, L.blockHeaderBytes, 'VOC block header');
    let length = 0;
    for (let k = 1; k < L.blockHeaderBytes; k++) length += b[p + k] * 2 ** (8 * (k - 1)); // @math little-endian length in the bytes after the type byte
    need(b, p + L.blockHeaderBytes, length, 'VOC block');
    blocks.push({ type, offset: p, length, data: b.subarray(p + L.blockHeaderBytes, p + L.blockHeaderBytes + length) });
    p += L.blockHeaderBytes + length;
  }
}

export const parseVoc = data => parseVocWith(data, LAYOUT());
