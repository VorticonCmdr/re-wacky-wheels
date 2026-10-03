// SPRITE.ATR, the sprite catalogue, parsed strictly with the layout the game's loader uses and the
// archive proves (claims atr.*). Fields whose meaning is unproven stay raw. `width` and `height`
// follow the wiki's order: the game only multiplies them, so the archive cannot tell them apart. The legacy parseAtr in
// src/sprites.js still serves the viewer until phase 2 moves it.
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const LAYOUT = () => K({ countBytes: 0x02, recordBytes: 0x28, widthAt: 0x04, heightAt: 0x06, framesAt: 0x0e, nameAt: 0x10, nameBytes: 0x18 }, 'atr.layout');

export function parseAtrWith(data, L, littleEndian = true) {
  const b = bytes(data), dv = view(b);
  need(b, 0, L.countBytes, 'ATR count');
  const count = dv.getInt16(0, littleEndian);
  if (count < 0) throw new Error(`ATR count ${count} is negative`);
  if (b.length !== L.countBytes + count * L.recordBytes) throw new Error(`ATR is ${b.length} bytes, expected ${L.countBytes + count * L.recordBytes} for ${count} records`);
  return Array.from({ length: count }, (_, id) => {
    const at = L.countBytes + id * L.recordBytes, name = b.subarray(at + L.nameAt, at + L.nameAt + L.nameBytes), end = name.indexOf(0);
    if (end < 0) throw new Error(`ATR record ${id} name is not NUL-terminated`);
    const width = dv.getInt16(at + L.widthAt, littleEndian), height = dv.getInt16(at + L.heightAt, littleEndian), frames = dv.getInt16(at + L.framesAt, littleEndian);
    if (width < 1 || height < 1 || frames < 1) throw new Error(`ATR record ${id} has a non-positive size`);
    return { id, name: new TextDecoder('windows-1252').decode(name.subarray(0, end)), width, height, frames, bytes: width * height * frames, raw: b.subarray(at, at + L.recordBytes) };
  });
}

export const parseAtr = data => parseAtrWith(data, LAYOUT());
