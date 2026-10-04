import assert from 'node:assert/strict';
import { expected } from '../expect.js';

// floor.model is every leaf of the floor constants read from the claim that established it.
export default {
  id: 'port-floormodel',
  claims: ['floor.model'],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run() {
    const obs = expected('floor.render-observed'), loop = expected('floor.render-loop'), modes = expected('floor.detail-modes-observed'), trig = expected('trig.layout'), ndist = expected('ndist.layout'), map = expected('m.read'), sheet = expected('tiles.sheet-split'), buffer = expected('tiles.buffer'), gam = expected('gam.read'), pcx = expected('pcx.layout');
    assert.equal(loop.columns, obs.columns, 'both claims name the same column count');
    assert.equal(loop.steps, obs.steps, 'and the same step count');
    assert.equal(loop.angleBias, obs.angleBias);
    assert.equal(loop.wrap, trig.entries, 'the wrap is the TRIG entry count');
    assert.equal(loop.angleBytes, trig.entryBytes);
    assert.equal(obs.groupDwords, ndist.groupLength);
    assert.equal(loop.tileBytes ?? buffer.tileBytes, buffer.tileBytes);
    assert.equal(1 << loop.tileShift, sheet.size, 'a tile is 2^shift pixels wide'); // @math the tile width as a power of two
    assert.equal(sheet.size * sheet.size, buffer.tileBytes, 'a tile is size x size bytes');
    assert.equal(loop.tileMask, sheet.size - 1, 'the mask is the size less one'); // @math the mask keeps the low bits of the coordinate
    assert.equal(loop.lineBytes * 4, pcx.width, 'a screen line is four planes of lineBytes'); // @math four VGA planes
    const want = {
      columns: obs.columns, steps: obs.steps, angleBias: obs.angleBias, wrap: trig.entries, bottomRow: obs.bottomRow, trigEntryBytes: trig.entryBytes, fixedBits: trig.fixedBits, groupDwords: ndist.groupLength, ndistDwordBytes: ndist.dwordBytes,
      mapRows: map.rows, mapColumns: map.columns, mapOrigin: map.mapOrigin, tileShift: loop.tileShift, tileMask: loop.tileMask, tileBytes: buffer.tileBytes, sheetCount: sheet.count, sheetSize: sheet.size, sheetColumns: sheet.columns,
      columnSteps: [obs.columns / obs.columns, ...modes.steps], resetTo: modes.resetTo, gamPrefix: gam.prefix, width: pcx.width, height: pcx.height,
    };
    assert.deepEqual(expected('floor.model'), want, 'floor.model equals its sources, leaf by leaf');
    assert.equal(want.bottomRow, pcx.height - 1, 'the bottom row is the last of the picture'); // @math the last row of a picture
    assert.equal(want.columns, pcx.width, 'the floor is as wide as the picture');
  },
  async discriminate() {
    const M = expected('floor.model');
    return [
      { label: 'a model with one more step', fn: () => assert.deepEqual({ ...M, steps: M.steps + 1 }, M) },
      { label: 'column steps of 1, 2, 3', fn: () => assert.deepEqual({ ...M, columnSteps: [1, 2, 3] }, M) }, // @math a step of 3 instead of 4
    ];
  },
};
