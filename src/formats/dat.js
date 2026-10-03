// WACKY.DAT directory, parsed strictly with the layout proven by the dat-directory check and
// read from WW.EXE (claims dat.*). The legacy parseDat in src/archive.js is untraced and stays
// until phase 2 moves its callers here. Only the directory is decoded; member bytes are returned
// as views, never copied.
import { bytes, view, need, ascii } from '../binary.js';
import { K } from '../evidence/k.js';

const LAYOUT = () => K({ countAt: 0x00, countBytes: 0x02, entrySize: 0x16, sizeAt: 0x0e, offsetAt: 0x12, offsetBias: 0x02 }, 'dat.layout');

// `layout` is exposed so the check can show that wrong layouts are rejected.
export function parseDatWith(data, layout) {
  const b = bytes(data), dv = view(b), L = layout;
  need(b, L.countAt, L.countBytes, 'DAT count');
  const count = dv.getInt16(L.countAt, true); // the game sign-extends the count (MOVSX word)
  if (count < 0) throw new Error(`DAT count ${count} is negative`);
  const first = L.countAt + L.countBytes;
  need(b, first, count * L.entrySize, 'DAT directory');
  return Array.from({ length: count }, (_, i) => {
    const at = first + i * L.entrySize, field = b.subarray(at, at + L.sizeAt);
    if (field[0] === 0) throw new Error(`DAT entry ${i} has an empty name; the game treats that as the end of the table`);
    if (!field.includes(0)) throw new Error(`DAT entry ${i} name is not NUL-terminated before +${L.sizeAt}`);
    const size = dv.getUint32(at + L.sizeAt, true), offset = dv.getUint32(at + L.offsetAt, true) + L.offsetBias;
    need(b, offset, size, `DAT member ${ascii(field)}`);
    return { name: ascii(field), size, offset, entryAt: at, data: b.subarray(offset, offset + size) };
  });
}

export const parseDatDirectory = data => parseDatWith(data, LAYOUT());

// Where the directory ends (first byte past the last entry).
export const directoryEnd = (data, layout = LAYOUT()) => layout.countAt + layout.countBytes + view(data).getInt16(layout.countAt, true) * layout.entrySize;
