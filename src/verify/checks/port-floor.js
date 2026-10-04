import assert from 'node:assert/strict';
import { loadTrack } from '../../game/track-data.js';
import { renderFloor } from '../../render/floor.js';
import { assertArchive, crc } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ obs: expected('floor.render-observed'), modes: expected('floor.detail-modes-observed'), model: expected('floor.model') });
const FRAMES = [['floor-1', 'obs'], ['floor-2', 'obs'], ['floor-3', 'obs'], ['floor-4', 'modes'], ['floor-5', 'modes']];

const ranges = list => { const out = []; for (const c of list) { const last = out.at(-1); if (last && c === last[1] + 1) last[1] = c; else out.push([c, c]); } return out; };

// The port's own renderer, run on the recorded camera, heading and mode of every observed frame: the columns it draws equal the game's
// (the CRC-32 of the rows 130 to 199) everywhere except the ranges the observing claims list, which lie under overlays.
function validate(dat, records, V, { drop = 0 } = {}) {
  records.forEach((r, i) => {
    assertArchive(r, dat);
    const F = r.floor, M = V.model, world = loadTrack(dat, F.track), fb = new Uint8Array(M.width * M.height);
    renderFloor(world, { x: F.camera[0], y: F.camera[1], heading: F.heading }, F.mode, fb);
    const first = V.obs.firstRow, bad = [];
    for (let c = 0; c < M.columns; c++) {
      const col = new Uint8Array(M.steps);
      for (let k = 0; k < M.steps; k++) col[k] = fb[(first + k + drop) * M.width + c];
      if (crc(col) !== F.columns[c]) bad.push(c);
    }
    const [claim, index] = FRAMES[i][1] === 'obs' ? [V.obs, i] : [V.modes, i - V.obs.frames];
    assert.deepEqual(ranges(bad), claim.mismatching[index], `${r.id}: the columns the port's floor does not reproduce are the ones under overlays`);
  });
}

export default {
  id: 'port-floor',
  claims: ['floor.model'],
  obs: FRAMES.map(f => f[0]),
  reviewed: { by: 'main-session', date: '2026-10-04' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), FRAMES.map(f => ctx.obs(f[0])), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), recs = FRAMES.map(f => ctx.obs(f[0])), V = values();
    return [
      { label: 'the rows one scan line lower', fn: () => validate(dat, recs, V, { drop: 1 }) }, // @math one scan line
      { label: 'a camera one unit off', fn: () => validate(dat, recs.map((r, i) => (i === 0 ? { ...r, floor: { ...r.floor, camera: [r.floor.camera[0] + 1, r.floor.camera[1]] } } : r)), V) }, // @math the first frame
      { label: 'a heading one entry off', fn: () => validate(dat, recs.map((r, i) => (i === 1 ? { ...r, floor: { ...r.floor, heading: r.floor.heading + 1 } } : r)), V) }, // @math the second frame
      { label: 'the medium frame drawn at full detail', fn: () => validate(dat, recs.map((r, i) => (i === 3 ? { ...r, floor: { ...r.floor, mode: 1 } } : r)), V) }, // @math the fourth frame
    ];
  },
};
