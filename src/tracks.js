import { bytes, view, need, ascii } from './binary.js';
import { parseMap, parseRouteKeepingTail as parseRouteStrict, parseSpwKeepingTail as parseSpwStrict } from './formats/track-files.js';
import { splitTiles } from './formats/pcx.js';
import { parseGam as parseGamStrict, gamFileNames } from './formats/gam.js';
// The track configuration for the viewer and editor. The traced strict parser (src/formats/gam.js, claims gam.*) reads the file when it is the
// game's shape (CRLF lines, 25 or more, integers where the game reads them); otherwise the lenient reader below keeps the old behaviour
// (any line ending, trimmed lines), because the editor may be given files the game itself would misread.
export function parseGam(data) {
  const lines = ascii(data).split(/\r?\n/).map(s => s.trim());
  try {
    const g = parseGamStrict(data), names = gamFileNames(g), lower = list => list.map(n => n.toLowerCase());
    return { lines, tiles: lower(names.tilesets), masks: lower(names.masks), sky: names.sky.toLowerCase(), startX: g.starts[0].x, startY: g.starts[0].y, cycling: g.flag === 1, starts: g.starts, values: g.values, extra: g.extra, strict: true };
  } catch {
    if (lines.length < 25) throw new Error('GAM needs at least 25 lines');
    return { lines, tiles: lines.slice(0, 2).map(n => 'a_' + n.toLowerCase()), masks: lines.slice(2, 4).map(n => 'a_' + n.toLowerCase()), sky: lines[4].toLowerCase(), startX: Number(lines[8]), startY: Number(lines[9]), cycling: Number(lines[24]) === 1, strict: false };
  }
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
