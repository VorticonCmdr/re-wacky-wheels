import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { viewSetup } from '../../game/view.js';
import { objectRecords } from '../../game/objects.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const HORIZON = ['horizon-6', 'horizon-7', 'horizon-8', 'horizon-9', 'horizon-10', 'horizon-11', 'horizon-12', 'horizon-13', 'horizon-14', 'grid-1', 'grid-7'];
const FIT = ['fit-2', 'fit-3', 'fit-4', 'fit-5', 'fit-6', 'fit-7', 'fit-8', 'fit-9'];
const values = () => ({ m: expected('view.model'), proj: expected('view.object-projection'), row: expected('view.row-table'), col: expected('view.object-column-observed'), floor: expected('floor.model'), ndist: expected('ndist.layout'), trig: expected('trig.layout'), list: expected('view.draw-list-observed') });

// view.model is every leaf read from the claims that established it.
function model(V) {
  const M = V.m, P = V.proj, R = V.row;
  assert.deepEqual(M, {
    fixedBits: V.trig.fixedBits, tan: P.tan, center: P.center, maxColumn: P.maxColumn, viewShift: P.viewShift, viewRound: P.viewRound, minDistance: P.minDistance, maxDistance: P.maxDistance, sizeBase: P.sizeBase, sizeStep: P.sizeStep, maxSize: P.maxSize, maxRow: P.maxRow,
    worldOffset: V.col.worldOffset, fanHalf: V.floor.angleBias ?? M.fanHalf, fanReach: V.ndist.max, rowFirst: R.first, rowNumerator: R.numerator, rowMinimum: R.minimum, rowMaximum: R.maximum, rowBase: R.base, rowEntries: R.entries, trigEntryBytes: V.trig.entryBytes, turn: V.trig.entries, slopeBytes: M.slopeBytes, viewBytes: M.viewBytes, rounding: M.rounding,
  }, 'view.model equals its sources, leaf by leaf');
  assert.equal(M.fanReach, M.maxDistance, 'the fan reaches as far as the farthest drawn distance');
  assert.equal(M.rounding, 2 ** (M.fixedBits - 1), 'the rounding is half of the fixed point unit'); // @math half of 2^16
}

// The bounding box of the horizon and grid frames, from the camera, the heading and the fan.
function boxes(dat, records, V) {
  for (const r of records) {
    assertArchive(r, dat);
    const h = r.horizon, c = h.camera, world = loadTrack(dat, h.track), view = viewSetup(world, { x: c.x, y: c.y, heading: h.heading });
    assert.deepEqual([view.box.x0, view.box.x1, view.box.y0, view.box.y1], c.box, `${r.id}: the box`);
    assert.deepEqual([view.a, view.b], [c.a, c.b], `${r.id}: the heading vector words`);
  }
}

const key = r => [r.distance, r.left, r.top, r.width, r.height, r.sizeClass].join(',');

// The static objects the port draws against the type -1 records of the draw list.
function objects(dat, records, V, { scan = false } = {}) {
  let total = 0;
  for (const r of records) {
    assertArchive(r, dat);
    const isFit = Boolean(r.fit), track = isFit ? r.fit.track : r.horizon.track, cam = isFit ? { x: r.fit.camera[0], y: r.fit.camera[1], heading: r.fit.heading } : { x: r.horizon.camera.x, y: r.horizon.camera.y, heading: r.horizon.heading };
    const world = loadTrack(dat, track), view = viewSetup(world, cam), got = objectRecords(world, view, cam).map(key).sort();
    const seen = isFit ? r.fit.records.filter(x => x.type === -1 && x.racer === -1).map(x => key({ distance: x.distance, left: x.left, top: x.top, width: x.w, height: x.h, sizeClass: x.sizeClass })) : r.horizon.drawList.filter(w => w[V.list.fieldWords.type] === -1).map(w => key({ distance: (w[V.list.fieldWords.distance] & 0xffff) + w[V.list.fieldWords.distance + 1] * 65536, left: w[V.list.fieldWords.left], top: w[V.list.fieldWords.top], width: w[V.list.fieldWords.width], height: w[V.list.fieldWords.height], sizeClass: w[V.list.fieldWords.sizeClass] })); // @math a dword from two words
    // the start grid's frames also hold the lion of the start (type -1 but not an object): leave the records the objects cannot explain out of both sides
    const explained = seen.filter(s => got.includes(s)).sort();
    assert.deepEqual(got.filter(g => seen.includes(g)), explained, `${r.id}: the port draws exactly the objects the game drew`);
    assert.ok(seen.length - explained.length <= 1, `${r.id}: at most one record (the start's lion) is not an object`); // @math the lion
    assert.ok(got.length === explained.length, `${r.id}: the port draws nothing the game did not (${got.join(' | ')} against ${seen.join(' | ')})`);
    total += explained.length;
  }
  return total;
}

export default {
  id: 'port-view',
  claims: ['view.model'],
  obs: [...HORIZON, ...FIT],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    model(V); boxes(dat, HORIZON.map(id => ctx.obs(id)), V);
    const total = objects(dat, [...HORIZON.slice(0, 9), ...FIT].map(id => ctx.obs(id)), V); // @math the nine horizon frames
    assert.ok(total >= 30, `enough objects compared (${total})`); // @math the frames hold 37 object records
  },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    return [
      { label: 'a model with another tangent', fn: () => model({ ...V, m: { ...V.m, tan: V.m.tan + 1 } }) },
      { label: 'a fan of 159', fn: () => boxes(dat, HORIZON.map(id => ctx.obs(id)).map(r => ({ ...r, horizon: { ...r.horizon, heading: r.horizon.heading + 1 } })), V) },
      { label: 'an object frame with a moved camera', fn: () => objects(dat, FIT.map(id => ctx.obs(id)).map(r => ({ ...r, fit: { ...r.fit, camera: [r.fit.camera[0] + 40, r.fit.camera[1]] } })), V) }, // @math forty units
    ];
  },
};
