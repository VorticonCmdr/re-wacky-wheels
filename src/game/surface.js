// The surface under a car: the terrain lookup (terrain.lookup and terrain.clamp, PROVEN by obs-terrain) and the record of WACKY.SDX that the value picks
// (terrain.sdx-index, terrain.effects-observed): its dword +0x120 is the fraction of the speed the surface takes away (car.speed-observed) and its dword +0x124
// the number of calls a steering key is held before the car slides (car.steer-states, STATIC).
import { K } from '../evidence/k.js';

const LOOKUP = () => K({ inputsObject: 2, rowOffset: 120744, columnOffset: 120740, resultOffset: 124264, cellBits: 5, tileShift: 10, entryBytes: 8, maskZeroOffset: 0, maskOneOffset: 4, maskRegion: 110592 }, 'terrain.lookup');
const CLAMP = () => K({ limit: 4095 }, 'terrain.clamp');
const MAP = () => K({ rows: 64, columns: 64, tileBytes: 1024, tableCells: 128, mapOrigin: 32 }, 'm.read');
const SPLIT = () => K({ count: 54, size: 32, columns: 10 }, 'tiles.sheet-split');
const SDX = () => K({ resultOffset: 124264, tableOffset: 82424, recordBytes: 302, dwordAt: 288, wordAt: 292, carPointerOffset: 120240 }, 'terrain.sdx-index');
const FRACTION_BITS = 16; // @math the fraction is a 16.16 fixed-point number (car.speed-observed: 30146 is 0.46)

// The terrain value at a world position (x is the column, y the row): the tile of the cell, the mask pixel of the tile at the position's offset in it, and the
// first or second dword of the tile's .SIN entry (the clamp first). `world.tiles` is the map, `world.maskSheets` the mask tiles, `world.sin` the entries.
export function terrainAt(world, x, y) {
  const T = LOOKUP(), L = CLAMP(), M = MAP(), S = SPLIT(), limit = L.limit;
  const r = Math.max(0, Math.min(limit, y)), c = Math.max(0, Math.min(limit, x)), cr = r >> T.cellBits, cc = c >> T.cellBits;
  const inside = cr >= M.mapOrigin && cr < M.mapOrigin + M.rows && cc >= M.mapOrigin && cc < M.mapOrigin + M.columns;
  const id = inside ? world.tiles[(cr - M.mapOrigin) * M.columns + (cc - M.mapOrigin)] : 0; // the padding cells of the pointer table hold tile 0
  const mask = world.maskSheets[Math.floor(id / S.count)][(id % S.count) * M.tileBytes + ((r & (S.size - 1)) << T.cellBits) + (c & (S.size - 1))];
  const entry = world.sin[id].kept, dv = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
  return dv.getUint32(mask === 0 ? T.maskZeroOffset : T.maskOneOffset, true);
}

// The two numbers of the surface's SDX record: the fraction (dword +0x120) and the steering calls before a slide (dword +0x124).
export function surfaceRecord(world, value) {
  const D = SDX(), record = world.sdx.records[value], dv = new DataView(record.buffer, record.byteOffset, record.byteLength);
  return { fraction: dv.getUint32(D.dwordAt, true), slide: dv.getUint32(D.wordAt, true) };
}

// The speed after the surface's slowdown: the table entry less (entry x fraction) >> 16 (car.speed-observed, ai.surface-slowdown).
export const slowedSpeed = (entry, fraction) => entry - Number((BigInt(entry) * BigInt(fraction)) >> BigInt(FRACTION_BITS));
