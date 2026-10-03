// The static data members WW.EXE loads once at startup (Ghidra FUN_00028180, obj1+0x18180): MAP.XY,
// WACKY.SDX, TRIG.DAT, NDIST, CARS.SP and GIG.MOV (claims static.*). Only the sizes and the
// count-plus-records shapes are decoded here; what the tables mean is unproven (docs/TODO.md), so
// every table is returned as raw bytes. Sizes are strict: another size is an error.
import { bytes, view } from '../binary.js';
import { K } from '../evidence/k.js';

const LAYOUT = () => K({ mapXyBytes: 0x1000, sdxCountBytes: 0x02, sdxRecordBytes: 0x12e, movCountBytes: 0x02, movEntryBytes: 0x04, movExtraBytes: 0x04, trigBytes: 0x3c00, ndistBytes: 0x15e00, carsBytes: 0x18f00 }, 'static.layout');

const exact = (name, data, size) => {
  const b = bytes(data);
  if (b.length !== size) throw new Error(`${name} is ${b.length} bytes, expected ${size}`);
  return b;
};

export function parseMapXyWith(data, L) {
  const b = exact('MAP.XY', data, L.mapXyBytes), half = L.mapXyBytes / 2; // @math the loader reads it as two equal halves
  return { first: b.subarray(0, half), second: b.subarray(half) };
}

export function parseSdxWith(data, L, littleEndian = true) {
  const b = bytes(data);
  if (b.length < L.sdxCountBytes) throw new Error('SDX is truncated');
  const count = view(b).getUint16(0, littleEndian), size = L.sdxCountBytes + count * L.sdxRecordBytes;
  if (b.length !== size) throw new Error(`SDX is ${b.length} bytes, expected ${size} for ${count} records`);
  return { count, records: Array.from({ length: count }, (_, i) => b.subarray(L.sdxCountBytes + i * L.sdxRecordBytes, L.sdxCountBytes + (i + 1) * L.sdxRecordBytes)) };
}

export function parseMovWith(data, L, littleEndian = true) {
  const b = bytes(data);
  if (b.length < L.movCountBytes) throw new Error('MOV is truncated');
  const count = view(b).getUint16(0, littleEndian), size = L.movCountBytes + count * L.movEntryBytes + L.movExtraBytes;
  if (b.length !== size) throw new Error(`MOV is ${b.length} bytes, expected ${size} for ${count} entries`);
  return { count, table: b.subarray(L.movCountBytes) };
}

export const parseMapXy = data => parseMapXyWith(data, LAYOUT());
export const parseSdx = data => parseSdxWith(data, LAYOUT());
export const parseMov = data => parseMovWith(data, LAYOUT());
export const parseTrig = data => exact('TRIG.DAT', data, LAYOUT().trigBytes);
export const parseNdist = data => exact('NDIST', data, LAYOUT().ndistBytes);
export const parseCarsSp = data => exact('CARS.SP', data, LAYOUT().carsBytes);
