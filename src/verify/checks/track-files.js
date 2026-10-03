import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseMapWith, parsePosWith, parseSinWith, parseRouteWith, parseSpwWith } from '../../formats/track-files.js';
import { expected } from '../expect.js';

const KINDS = ['M', 'POS', 'SIN', 'RD', 'SPW', 'GAM', 'PAR'];
function tracks(dat) {
  const byName = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), numbers = [...byName.keys()].filter(n => n.endsWith('.M')).map(n => n.slice(0, -'.M'.length));
  assert.ok(numbers.length > 0, 'no tracks');
  return { numbers, get: (n, kind) => { const d = byName.get(`${n}.${kind}`); assert.ok(d, `${n}.${kind} is missing`); return d; } };
}
const all = (t, kind, fn) => t.numbers.forEach(n => fn(t.get(n, kind), n));

export default {
  id: 'track-files',
  claims: ['m.layout', 'pos.layout', 'sin.layout', 'rd.layout', 'spw.layout', 'track.file-set'],
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) {
    const t = tracks(await ctx.open('WACKY.DAT')), M = expected('m.layout'), P = expected('pos.layout'), S = expected('sin.layout'), R = expected('rd.layout'), W = expected('spw.layout'), F = expected('track.file-set');
    assert.equal(t.numbers.length, F.tracks);
    for (const n of t.numbers) for (const kind of KINDS) t.get(n, kind);
    let biggestTile = 0;
    all(t, 'M', d => { biggestTile = Math.max(biggestTile, ...parseMapWith(d, M).tiles); });
    assert.equal(biggestTile, M.maxTileId, 'the largest tile id in the archive is exactly the claimed maximum');
    // The largest cell in the archive is exactly the claimed value, and it fits in one byte, so the
    // trailer == max(grid) relation survives a joint byte swap (see pos.layout).
    let biggestCell = 0;
    all(t, 'POS', d => { biggestCell = Math.max(biggestCell, ...parsePosWith(d, P).grid); });
    assert.equal(biggestCell, P.maxCell);
    assert.ok(biggestCell < 0x100, 'every cell fits in one byte'); // @math one-byte range
    all(t, 'SIN', d => parseSinWith(d, S));
    all(t, 'RD', d => parseRouteWith(d, R));
    all(t, 'PAR', d => assert.equal(d.length, F.parBytes));
    all(t, 'SPW', d => parseSpwWith(d, W));
    // The layouts agree with what the loader does (STATIC claims from disassembly).
    const m = expected('m.read'), buf = expected('tiles.buffer'), pos = expected('pos.read'), sin = expected('sin.read'), rd = expected('rd.read'), sheet = expected('tiles.sheet-split');
    assert.deepEqual([m.rows, m.columns], [M.rows, M.columns]);
    assert.equal(M.rows * M.columns, M.size);
    assert.equal(buf.totalBytes / buf.sheetDivisor / buf.tileBytes, sheet.count, 'tile buffer holds exactly one sheet of tiles per quarter');
    assert.equal(m.tileBytes, buf.tileBytes);
    assert.equal(buf.tileBytes, sheet.size * sheet.size, 'a tile is size x size bytes');
    assert.equal(M.maxTileId + 1, buf.sheets * sheet.count, 'ids cover exactly the loader\'s sheets');
    assert.equal(buf.totalBytes / buf.maskDivisor, buf.sheets * sheet.count * buf.tileBytes, 'masks start after all sheets of tiles');
    assert.equal(pos.gridBytes, P.gridBytes);
    assert.equal(pos.trailerBytes, P.trailerBytes);
    assert.equal(sin.tableBytes / sin.kept, S.records);
    assert.equal(sin.skipped, S.skipped);
    assert.equal(sin.skipped + sin.kept, S.recordBytes);
    assert.equal(rd.countBytes, R.countBytes);
    assert.equal(rd.recordBytes, R.recordBytes);
    const route = expected('rd.route'), unused = expected('rd.unused-words'), offsets = [...route.coordWords, rd.tableWord, ...unused.notRead].sort((x, y) => x - y);
    assert.deepEqual(offsets, Array.from({ length: R.words }, (_, i) => i * R.wordBytes), 'the offsets rd.route, rd.read and rd.unused-words name are exactly the record\'s words');
  },
  // Off-by-one sizes, another byte order, and a smaller tile-id range must not describe the archive.
  async discriminate(ctx) {
    const t = tracks(await ctx.open('WACKY.DAT')), M = expected('m.layout'), P = expected('pos.layout'), S = expected('sin.layout'), R = expected('rd.layout'), W = expected('spw.layout');
    return [
      { label: `map size ${M.size + 1}`, fn: () => all(t, 'M', d => parseMapWith(d, { ...M, size: M.size + 1 })) },
      { label: `max tile id ${M.maxTileId - 1}`, fn: () => all(t, 'M', d => parseMapWith(d, { ...M, maxTileId: M.maxTileId - 1 })) },
      { label: 'POS big-endian grid, little-endian trailer', fn: () => all(t, 'POS', d => parsePosWith(d, P, { grid: false })) },
      { label: 'POS little-endian grid, big-endian trailer', fn: () => all(t, 'POS', d => parsePosWith(d, P, { trailer: false })) },
      { label: 'POS grid as bytes', fn: () => all(t, 'POS', d => parsePosWith(d, { ...P, cellBytes: 1 })) }, // @math alternative: single-byte cells
      { label: `POS trailer ${P.trailerBytes + 1} bytes`, fn: () => all(t, 'POS', d => parsePosWith(d, { ...P, trailerBytes: P.trailerBytes + 1 })) },
      { label: `SIN record ${S.recordBytes - 1} bytes`, fn: () => all(t, 'SIN', d => parseSinWith(d, { ...S, recordBytes: S.recordBytes - 1 })) },
      { label: `SIN ${S.records + 1} records`, fn: () => all(t, 'SIN', d => parseSinWith(d, { ...S, records: S.records + 1 })) },
      { label: `RD record ${R.recordBytes - R.wordBytes} bytes`, fn: () => all(t, 'RD', d => parseRouteWith(d, { ...R, recordBytes: R.recordBytes - R.wordBytes, words: R.words - 1 })) }, // @math one word fewer
      { label: `RD record ${R.recordBytes + R.wordBytes} bytes`, fn: () => all(t, 'RD', d => parseRouteWith(d, { ...R, recordBytes: R.recordBytes + R.wordBytes, words: R.words + 1 })) }, // @math one word more
      { label: 'RD big-endian count', fn: () => all(t, 'RD', d => parseRouteWith(d, R, false)) },
      { label: `SPW record ${W.recordBytes - W.wordBytes} bytes`, fn: () => all(t, 'SPW', d => parseSpwWith(d, { ...W, recordBytes: W.recordBytes - W.wordBytes, words: W.words - 1 })) }, // @math one word fewer
      { label: `SPW record ${W.recordBytes + W.wordBytes} bytes`, fn: () => all(t, 'SPW', d => parseSpwWith(d, { ...W, recordBytes: W.recordBytes + W.wordBytes, words: W.words + 1 })) }, // @math one word more
      { label: 'SPW big-endian count', fn: () => all(t, 'SPW', d => parseSpwWith(d, W, false)) },
    ];
  },
};
