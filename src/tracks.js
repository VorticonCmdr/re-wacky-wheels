import { bytes, view, need, ascii } from './binary.js';
export function parseGam(data) {
  const lines = ascii(data).split(/\r?\n/).map(s => s.trim());
  if (lines.length < 25) throw new Error('GAM needs at least 25 lines');
  return { lines, tiles: lines.slice(0, 2).map(n => 'a_' + n.toLowerCase()), masks: lines.slice(2, 4).map(n => 'a_' + n.toLowerCase()), sky: lines[4].toLowerCase(), startX: Number(lines[8]), startY: Number(lines[9]), cycling: Number(lines[24]) === 1 };
}
export function parseRoute(data) {
  const b = bytes(data), v = view(b); need(b, 0, 2, 'RD');
  const n = v.getUint16(0, true); need(b, 2, n * 14, 'RD records');
  return Array.from({ length: n }, (_, i) => {
    const p = 2 + i * 14;
    return Object.fromEntries(['x1', 'y1', 'x2', 'y2', 'angle', 'direction', 'distance'].map((k, j) => [k, v.getUint16(p + j * 2, true)]));
  });
}
export function parseSpawns(data) {
  const b = bytes(data), v = view(b); need(b, 0, 2, 'SPW');
  const n = v.getUint16(0, true); need(b, 2, n * 12, 'SPW records');
  return Array.from({ length: n }, (_, i) => { const p = 2 + i * 12; return { id: v.getUint16(p, true), x: v.getUint16(p + 4, true), y: v.getUint16(p + 6, true), unknown1: v.getUint16(p + 2, true), unknown2: v.getUint16(p + 8, true), unknown3: v.getInt16(p + 10, true) }; });
}
export function composeTrack(data, first, second) {
  const map = bytes(data); need(map, 0, 4096, 'Track map');
  const width = 2048, height = 2048, indices = new Uint8Array(width * height);
  for (let my = 0; my < 64; my++) for (let mx = 0; mx < 64; mx++) {
    const tile = map[my * 64 + mx], sheet = tile < 54 ? first : second, n = tile % 54;
    if (tile > 107 || !sheet.indices) throw new Error('Invalid tile index or non-indexed tileset');
    // Tile numbering follows the image stride (10 columns in a 320px sheet).
    // Only the first 54 of the 60 full tiles belong to each track tileset.
    const columns = Math.floor(sheet.width / 32);
    const tx = (n % columns) * 32, ty = Math.floor(n / columns) * 32;
    if (sheet.width < tx + 32 || sheet.height < ty + 32) throw new Error('Tileset is too small');
    for (let y = 0; y < 32; y++) indices.set(sheet.indices.subarray((ty + y) * sheet.width + tx, (ty + y) * sheet.width + tx + 32), (my * 32 + y) * width + mx * 32);
  }
  return { width, height, indices, palette: first.palette };
}
