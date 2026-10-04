import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { renderSky, renderHorizon } from '../../render/sky.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const SKY = ['sky-1', 'sky-2', 'sky-3', 'sky-4', 'sky-5'], HORIZON = ['horizon-1', 'horizon-2', 'horizon-14'];
const values = () => ({ m: expected('sky.model'), sky: expected('sky.static-observed'), hz: expected('horizon.render-observed'), par: expected('par.upload'), floor: expected('floor.model') });

// sky.model is every leaf read from the claims that observed it.
function model(V) {
  const H = V.hz;
  assert.deepEqual(V.m, {
    width: V.sky.width, skyRows: V.hz.firstRow, horizonRow: H.firstRow, horizonRows: H.rows, parRowPixels: H.rowPixels, pixelsPerByte: H.pixelsPerByte, parBytes: V.par.bytes,
    offsetMax: H.bounds.at(-1) - H.bounds[0], observedFrom: V.sky.rect[0],
  }, 'sky.model equals its sources, leaf by leaf');
  assert.equal(V.m.skyRows, V.sky.rect[1] + 1, 'the sky rows end where the observed rows end'); // @math the rows above the strip: the last observed row plus one
  assert.equal(V.m.width, V.floor.width, 'as wide as the picture');
}

// The port's sky matches the rows the game showed; the port's strip the columns it showed, outside the overlays.
function replay(dat, V, ctx, { offsetBias = 0 } = {}) {
  for (const id of SKY) {
    const r = ctx.obs(id); assertArchive(r, dat);
    const world = loadTrack(dat, r.sky.track), fb = new Uint8Array(V.floor.width * V.floor.height);
    renderSky(world.sky, fb);
    const [first, last, c0, c1] = V.sky.rect;
    for (let y = first; y <= last; y++) assert.equal(r.sky.rows[y - first], crc(fb.subarray(y * V.floor.width + c0, y * V.floor.width + c1 + 1)), `${id}: row ${y}`); // @math both ends count
  }
  for (const id of HORIZON) {
    const r = ctx.obs(id); assertArchive(r, dat);
    const h = r.horizon, world = loadTrack(dat, h.track), fb = new Uint8Array(V.floor.width * V.floor.height);
    renderHorizon(world.par, h.pointer - V.hz.base + offsetBias, fb);
    const covered = new Set();
    for (const w of h.drawList) if (w[3] + w[1] > V.m.horizonRow) for (let x = w[2]; x < w[2] + w[0]; x++) covered.add(x); // @math top row + height reaches the strip; words 0 to 3 are width, height, left, top
    for (let x = V.hz.timerColumns[0]; x <= V.hz.timerColumns[1]; x++) covered.add(x);
    for (let c = 0; c < V.floor.columns; c++) {
      const col = new Uint8Array(V.m.horizonRows);
      for (let j = 0; j < V.m.horizonRows; j++) col[j] = fb[(V.m.horizonRow + j) * V.floor.width + c];
      if (crc(col) !== h.columns[c]) assert.ok(covered.has(c), `${id}: column ${c} differs and is not under an overlay`);
    }
  }
}

export default {
  id: 'port-sky',
  claims: ['sky.model'],
  obs: [...SKY, ...HORIZON],
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { const V = values(); model(V); replay(await ctx.open('WACKY.DAT'), V, ctx); },
  async discriminate(ctx) {
    const V = values(), dat = await ctx.open('WACKY.DAT');
    return [
      { label: 'the strip offset by one byte', fn: () => replay(dat, V, ctx, { offsetBias: 1 }) }, // @math one byte
      { label: 'another strip row count', fn: () => model({ ...V, m: { ...V.m, horizonRows: V.m.horizonRows + 1 } }) },
    ];
  },
};
