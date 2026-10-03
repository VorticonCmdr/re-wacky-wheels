// AUDIOHED.FX + AUDIOT.FX, the sound-effect bank, parsed strictly with the layout the archive proves
// (claim audio.bank-layout). The legacy parseAudioT in src/archive.js is untraced and stays until the
// viewer moves here. What the header bytes after each chunk's length dword mean is not established
// (UNKNOWN_AUDIO_CHUNK_FIELDS), so header and trailer bytes are returned raw. The bank names are positional, not claims:
// `first` is slots 0 to 25, `second` slots 26 to 51.
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const LAYOUT = () => K({ offsetBytes: 0x04, slots: 0x4e, bankSlots: 0x1a, firstHeader: 0x06, firstTrailer: 0x01, secondHeader: 0x17, secondTrailer: 0x0a, lengthAt: 0x00, tag: '!ID!' }, 'audio.bank-layout');

// `layout` is exposed so the check can show that wrong layouts are rejected.
export function parseAudioBankWith(head, body, L) {
  const h = bytes(head), b = bytes(body), hv = view(h), tagBytes = L.tag.length, filled = L.bankSlots * 2; // @math two banks hold sounds
  if (h.length !== (L.slots + 1) * L.offsetBytes) throw new Error(`AUDIOHED is ${h.length} bytes, expected ${(L.slots + 1) * L.offsetBytes}`);
  const offsets = Array.from({ length: L.slots + 1 }, (_, i) => hv.getUint32(i * L.offsetBytes, true));
  const hasTag = (data, at) => String.fromCharCode(...data.subarray(at, at + tagBytes)) === L.tag;
  if (offsets[0] !== 0) throw new Error('the first slot does not start at 0');
  const end = offsets[filled];
  if (b.length !== end + tagBytes || !hasTag(b, end)) throw new Error(`AUDIOT must end with one ${L.tag} tag after slot ${filled - 1}`);
  if (offsets[L.slots] !== end - tagBytes) throw new Error('the last offset is not the position of the last sound\'s tag');
  for (let i = filled; i < L.slots; i++) if (offsets[i] !== end) throw new Error(`slot ${i} is not empty`);
  const slots = [];
  for (let i = 0; i < filled; i++) {
    const start = offsets[i], stop = offsets[i + 1], second = i >= L.bankSlots, header = second ? L.secondHeader : L.firstHeader, trailer = second ? L.secondTrailer : L.firstTrailer;
    if (stop < start || stop > b.length) throw new Error(`slot ${i} offsets are not increasing within the file`);
    const size = stop - start;
    need(b, start, Math.max(size, header + trailer), `slot ${i}`);
    if (size < header + trailer) throw new Error(`slot ${i} is ${size} bytes, shorter than its ${header}-byte header and ${trailer}-byte trailer`);
    const data = b.subarray(start, stop), length = view(data).getUint32(L.lengthAt, true), extra = size - header - trailer - length;
    const last = i % L.bankSlots === L.bankSlots - 1; // @math the last slot of a bank
    if (extra !== 0 && !(last && extra === tagBytes && hasTag(data, size - tagBytes))) throw new Error(`slot ${i} is ${size} bytes but its header and length account for ${header + length + trailer}`);
    slots.push({ index: i, bank: second ? 'second' : 'first', start, size, length, header: data.subarray(Uint32Array.BYTES_PER_ELEMENT, header), payload: data.subarray(header, header + length), trailer: data.subarray(header + length, header + length + trailer), tagged: extra !== 0 });
  }
  return { offsets, slots };
}

export const parseAudioBank = (head, body) => parseAudioBankWith(head, body, LAYOUT());
