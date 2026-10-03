// Per-track files as the loader reads them: .M, .POS, .SIN, .RD and .SPW (claims m.*, pos.*, sin.*,
// rd.*, spw.*). Strict: wrong sizes, out-of-range tile ids and a .POS trailer that is not the grid maximum
// are errors. Field meanings stay unnamed where they are UNKNOWN (docs/TODO.md). The legacy
// parsers in src/tracks.js and src/data-formats.js still serve the viewer and editor until phase 2
// moves them. .GAM has its own parser (gam.js); .PAR is read raw by the game and needs none.
import { bytes, view } from '../binary.js';
import { K } from '../evidence/k.js';

const MAP = () => K({ size: 0x1000, rows: 0x40, columns: 0x40, maxTileId: 0x6b }, 'm.layout');
const POS = () => K({ gridBytes: 0x2000, trailerBytes: 0x02, cellBytes: 0x02, maxCell: 0x47 }, 'pos.layout');
const SIN = () => K({ records: 0x6c, recordBytes: 0x0c, skipped: 0x04 }, 'sin.layout');
const SPW = () => K({ countBytes: 0x02, recordBytes: 0x0c, wordBytes: 0x02, words: 0x06 }, 'spw.layout');
const RD = () => K({ countBytes: 0x02, recordBytes: 0x0e, wordBytes: 0x02, words: 0x07 }, 'rd.layout');

// Each `*With` takes the layout so the check can show that wrong layouts are rejected.
export function parseMapWith(data, L, littleEndian = true) {
  void littleEndian; // single-byte ids: no byte order
  const b = bytes(data);
  if (b.length !== L.size) throw new Error(`Track map is ${b.length} bytes, expected ${L.size}`);
  if (L.rows * L.columns !== L.size) throw new Error('Track map rows x columns does not match its size');
  const biggest = b.reduce((m, t) => Math.max(m, t), 0);
  if (biggest > L.maxTileId) throw new Error(`Track map tile id ${biggest} exceeds ${L.maxTileId}`);
  return { rows: L.rows, columns: L.columns, tiles: b };
}

// The grid's and the trailer's byte orders are separate arguments: the relation trailer == max(grid)
// holds under a joint swap (all cells are below 256), so only a mixed order shows which is right.
export function parsePosWith(data, L, { grid: gridLe = true, trailer: trailerLe = true } = {}) {
  const b = bytes(data), dv = view(b);
  if (b.length !== L.gridBytes + L.trailerBytes) throw new Error(`POS is ${b.length} bytes, expected ${L.gridBytes + L.trailerBytes}`);
  const grid = Uint16Array.from({ length: L.gridBytes / L.cellBytes }, (_, i) => dv.getUint16(i * L.cellBytes, gridLe));
  const trailer = dv.getInt16(L.gridBytes, trailerLe), biggest = grid.reduce((m, v) => Math.max(m, v), 0);
  if (trailer !== biggest) throw new Error(`POS trailer ${trailer} is not the grid maximum ${biggest}`);
  return { grid, trailer };
}

export function parseSinWith(data, L, littleEndian = true) {
  void littleEndian;
  const b = bytes(data);
  if (b.length !== L.records * L.recordBytes) throw new Error(`SIN is ${b.length} bytes, expected ${L.records * L.recordBytes}`);
  return Array.from({ length: L.records }, (_, i) => {
    const at = i * L.recordBytes;
    return { skipped: b.subarray(at, at + L.skipped), kept: b.subarray(at + L.skipped, at + L.recordBytes) };
  });
}

export function parseRouteWith(data, L, littleEndian = true) {
  const b = bytes(data), dv = view(b);
  if (L.words * L.wordBytes !== L.recordBytes) throw new Error('RD record size is not a whole number of words');
  if (b.length < L.countBytes) throw new Error('RD is truncated');
  const count = dv.getUint16(0, littleEndian);
  if (b.length !== L.countBytes + count * L.recordBytes) throw new Error(`RD is ${b.length} bytes, expected ${L.countBytes + count * L.recordBytes} for ${count} records`);
  return Array.from({ length: count }, (_, i) => Uint16Array.from({ length: L.words }, (_, w) => dv.getUint16(L.countBytes + i * L.recordBytes + w * L.wordBytes, littleEndian)));
}

export function parseSpwWith(data, L, littleEndian = true) {
  const b = bytes(data), dv = view(b);
  if (L.words * L.wordBytes !== L.recordBytes) throw new Error('SPW record size is not a whole number of words');
  if (b.length < L.countBytes) throw new Error('SPW is truncated');
  const count = dv.getUint16(0, littleEndian);
  if (b.length !== L.countBytes + count * L.recordBytes) throw new Error(`SPW is ${b.length} bytes, expected ${L.countBytes + count * L.recordBytes} for ${count} records`);
  return Array.from({ length: count }, (_, i) => Uint16Array.from({ length: L.words }, (_, w) => dv.getUint16(L.countBytes + i * L.recordBytes + w * L.wordBytes, littleEndian)));
}

export const parseMap = data => parseMapWith(data, MAP());
export const parsePos = data => parsePosWith(data, POS());
export const parseSin = data => parseSinWith(data, SIN());
export const parseRoute = data => parseRouteWith(data, RD());
export const parseSpw = data => parseSpwWith(data, SPW());
