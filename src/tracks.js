import { bytes, view, need, ascii } from './binary.js';
import { parseMap, parseRouteKeepingTail as parseRouteStrict, parseSpwKeepingTail as parseSpwStrict } from './formats/track-files.js';
import { splitTiles } from './formats/pcx.js';
export function parseGam(data) {
  const lines = ascii(data).split(/\r?\n/).map(s => s.trim());
  if (lines.length < 25) throw new Error('GAM needs at least 25 lines');
  return { lines, tiles: lines.slice(0, 2).map(n => 'a_' + n.toLowerCase()), masks: lines.slice(2, 4).map(n => 'a_' + n.toLowerCase()), sky: lines[4].toLowerCase(), startX: Number(lines[8]), startY: Number(lines[9]), cycling: Number(lines[24]) === 1 };
}
// Route and object files are read by the traced parsers (src/formats/track-files.js, claims rd.* and spw.*), which
// require the exact size the count implies; these adapters give the words their viewer and editor names.
const ROUTE_WORDS = ['x1', 'y1', 'x2', 'y2', 'angle', 'direction', 'distance'];
export function parseRoute(data) {
  return parseRouteStrict(data).map(record => Object.fromEntries(ROUTE_WORDS.map((name, i) => [name, record[i]])));
}
export function parseSpawns(data) {
  // Word +0x0a is read as signed here; the loader copies it unchanged (UNKNOWN_SPW_FIELDS).
  return parseSpwStrict(data).map(r => ({ id: r[0], x: r[2], y: r[3], unknown1: r[1], unknown2: r[4], unknown3: (r[5] << 16) >> 16 }));
}
// The 2048x2048 track surface: the map's tile ids index the 108 tiles of the two sheets in order (first sheet's 54, then the
// second's), exactly the game's tile buffer (claims m.layout, tiles.sheet-split, tiles.buffer).
export function composeTrack(data, first, second) {
  const { rows, columns, tiles: map } = parseMap(data);
  if (!first.indices || !second.indices) throw new Error('Invalid tile index or non-indexed tileset');
  const sheets = [...splitTiles(first), ...splitTiles(second)], size = Math.round(Math.sqrt(sheets[0].length)), width = columns * size, height = rows * size;
  const indices = new Uint8Array(width * height);
  for (let my = 0; my < rows; my++) for (let mx = 0; mx < columns; mx++) {
    const tile = sheets[map[my * columns + mx]];
    for (let y = 0; y < size; y++) indices.set(tile.subarray(y * size, (y + 1) * size), (my * size + y) * width + mx * size);
  }
  return { width, height, indices, palette: first.palette };
}
