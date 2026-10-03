// A strip of one terrain value laid over a track's map in a run copy of the archive (tools/dosbox/make-test-sin.mjs): the check rebuilds the run copy from the user's own archive and compares
// its hash with the record's, so that what the game ran from is the user's archive plus exactly this edit.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatDirectory } from '../formats/dat.js';
import { view } from '../binary.js';
import { replaceMember } from './patch.js';

// `V` carries sin (sin.read), sinLayout (sin.layout) and map (m.read); `build` is the record's { track, id, rows, cols, value }.
export function rebuildStrip(dat, record, V) {
  const b = record.build, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data])), name = `${b.track}`;
  const map = Uint8Array.from(members.get(`${name}.M`)), sin = Uint8Array.from(members.get(`${name}.SIN`)), dv = view(sin);
  assert.ok(!map.includes(b.id), 'the track does not use the tile');
  for (let row = b.rows[0]; row <= b.rows[1]; row++) for (let col = b.cols[0]; col <= b.cols[1]; col++) map[row * V.map.columns + col] = b.id;
  for (let k = 0; k < V.sin.kept / 4; k++) dv.setUint32(b.id * V.sinLayout.recordBytes + V.sin.skipped + k * 4, b.value, true); // @math the kept bytes are dwords
  const run = replaceMember(replaceMember(dat, `${name}.M`, map), `${name}.SIN`, sin);
  assert.equal(run.length, record.modified.size, 'the rebuilt run copy has the recorded size');
  assert.equal(createHash('sha1').update(run).digest('hex'), record.modified.sha1, 'the rebuilt run copy is the one the game ran from');
  return members;
}

// The world rows [from, to) the strip covers: the map origin in pixels plus its rows in tiles.
export const stripRows = (b, V) => [V.map.mapOrigin * V.sheet.size + b.rows[0] * V.sheet.size, V.map.mapOrigin * V.sheet.size + (b.rows[1] + 1) * V.sheet.size];
