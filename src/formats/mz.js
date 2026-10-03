// The classic 16-bit part of an MZ header, as the claims mz.dos-header and wwhelp.exe.mz record it.
// WW.EXE, SETUP.EXE and MANUAL.EXE are DOS/4G programs: their MZ header is only a stub (le.js);
// WWHELP.EXE is a plain MZ executable. Fields are returned raw; their meaning for a loader is the
// MS-DOS EXE format (a lead, not read into this repo).
import { bytes, view, need } from '../binary.js';
import { K } from '../evidence/k.js';

const OFFSETS = () => K({ lastPage: 0x02, pages: 0x04, relocations: 0x06, headerParagraphs: 0x08, minAlloc: 0x0a, maxAlloc: 0x0c, ss: 0x0e, sp: 0x10, ip: 0x14, cs: 0x16, relocTable: 0x18, size: 0x1c }, 'mz.dos-header');

export function parseMzHeaderWith(data, offsets, at = 0) {
  const b = bytes(data), dv = view(b);
  need(b, at, offsets.size, 'MZ header');
  if (String.fromCharCode(b[at], b[at + 1]) !== 'MZ') throw new Error(`No MZ signature at ${at}`);
  return Object.fromEntries(Object.entries(offsets).filter(([k]) => k !== 'size').map(([k, o]) => [k, dv.getUint16(at + o, true)]));
}

export const parseMzHeader = (data, at = 0) => parseMzHeaderWith(data, OFFSETS(), at);
