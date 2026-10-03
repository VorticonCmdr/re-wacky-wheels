import assert from 'node:assert/strict';
import { parseDatDirectory } from '../../formats/dat.js';
import { parseSpw } from '../../formats/track-files.js';
import { assertArchive } from '../obs-helpers.js';
import { expected } from '../expect.js';

const values = () => ({ obs: expected('view.object-column-observed'), proj: expected('view.object-projection'), list: expected('view.draw-list-observed') });
const IDS = ['horizon-6', 'horizon-7', 'horizon-8', 'horizon-9', 'horizon-10', 'horizon-11', 'horizon-12', 'horizon-13'];
const FIX = 16; // @math the 16.16 fixed point shift of the vector words and of the tangent factor
const TOOL = { boxWords: [0x28c16, 0x28c2a, 0x28c18, 0x28c2c], cameraWords: [0x28b0a, 0x28b0e], headingWords: [0x1d614, 0x1d5e4] }; // @math the words observe.mjs read into horizon.camera, in its order

const dword = (rec, at) => (rec[at] & 0xffff) + rec[at + 1] * 65536; // @math a dword from two words, the low one unsigned

// The integer square root of obj1+0x149b0: the digit-by-digit floor root, then one more when the remainder n - r r is at least r - 1.
function isqrt(n) {
  if (n <= 1) return n;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return n - r * r >= r - 1 ? r + 1 : r;
}

function validate(dat, records, V, { tan = V.proj.tan, worldOffset = V.obs.worldOffset, round = true, sizeBase = V.proj.sizeBase, viewRound = V.proj.viewRound } = {}) {
  const O = V.obs, P = V.proj, F = V.list.fieldWords, members = new Map(parseDatDirectory(dat).map(e => [e.name, e.data]));
  assert.equal(records.length, O.frames, 'the frames');
  assert.deepEqual([P.boxWords, P.cameraWords, P.headingWords], [TOOL.boxWords, TOOL.cameraWords, TOOL.headingWords], 'the words the tool read are those of view.object-projection');
  const view = members.get(O.viewMember); assert.ok(view, 'the VIEW member'); assert.equal(view.length, O.viewDwords * 4, 'VIEW holds 320 dwords'); // @math four bytes a dword
  const dv = new DataView(view.buffer, view.byteOffset, view.byteLength), table = Array.from({ length: O.viewDwords }, (_, i) => dv.getUint32(i * 4, true)); // @math four bytes a dword
  const perFrame = [], headings = []; let objects = 0;
  records.forEach((r, k) => {
    assertArchive(r, dat);
    const h = r.horizon, C = h.camera, [[x0, x1], [y0, y1]] = O.boxPairs.map(([a, b]) => [C.box[a], C.box[b]]), spw = parseSpw(members.get(`${h.track}.SPW`));
    headings.push(h.heading);
    const drawn = h.drawList.filter(w => w[F.type] === -1), seen = new Set();
    spw.forEach((o, i) => {
      const x = o[O.spwWords[0]] + worldOffset, y = o[O.spwWords[1]] + worldOffset;
      const inBox = x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1);
      const dx = x - C.x, dy = y - C.y;
      const f = Number((BigInt(C.a) * BigInt(dx) + BigInt(C.b) * BigInt(dy)) >> BigInt(FIX)), l = Number((BigInt(C.a) * BigInt(dy) - BigInt(C.b) * BigInt(dx)) >> BigInt(FIX));
      const div = Number((BigInt(f) * BigInt(tan)) >> BigInt(FIX)), col = div === 0 ? P.center : P.center + Math.trunc(l * P.center / div);
      const inView = col >= 0 && col <= P.maxColumn;
      const root = round ? isqrt(f * f + l * l) : Math.floor(Math.sqrt(f * f + l * l));
      const d = inView ? Math.floor((root * table[col] + viewRound) / (1 << P.viewShift)) : -1; // @math the shift right as a division
      const want = inBox && inView && d >= P.minDistance && d <= P.maxDistance;
      const rec = drawn.find(w => dword(w, F.distance) === d && w[F.left] === col - (w[F.width] >> 1)); // @math half the width, rounded down
      if (want) {
        assert.ok(rec, `frame ${k} object ${i}: a record with the distance ${d} and the left column ${col} minus half its width`);
        const cls = Math.min(Math.max(Math.floor((d - sizeBase) / P.sizeStep), 0), P.maxSize);
        assert.equal(rec[F.sizeClass], cls, `frame ${k} object ${i}: the size class`);
        assert.equal(rec[F.racer], -1, 'objects carry -1 in the racer word');
        seen.add(rec); objects++;
      } else if (inBox) assert.ok(!rec || d < 0, `frame ${k} object ${i}: no record when not in range`);
    });
    assert.equal(seen.size, drawn.length, `frame ${k}: every object record is explained by an object`);
    perFrame.push(drawn.length);
  });
  assert.deepEqual(perFrame, O.perFrame, 'the records per frame');
  assert.deepEqual(headings, O.headings, 'the headings');
  assert.equal(objects, O.objects, 'the objects drawn');
  assert.equal(O.perFrame.reduce((a, b) => a + b, 0), O.objects, 'the frame counts add up');
  assert.ok(perFrame.includes(0), 'frames with no object exist, so records are not assumed'); // @math a frame with no records
}

export default {
  id: 'obs-objproj',
  claims: ['view.object-column-observed'],
  obs: IDS,
  reviewed: { by: 'main-session', date: '2026-10-03' },
  async run(ctx) { validate(await ctx.open('WACKY.DAT'), IDS.map(id => ctx.obs(id)), values()); },
  async discriminate(ctx) {
    const dat = await ctx.open('WACKY.DAT'), records = IDS.map(id => ctx.obs(id)), V = values();
    return [
      { label: 'tangent factor off by 0x100', fn: () => validate(dat, records, V, { tan: V.proj.tan + 0x100 }) }, // @math a visible step of the factor
      { label: 'world offset 0x3ff', fn: () => validate(dat, records, V, { worldOffset: V.obs.worldOffset - 1 }) },
      { label: 'floor square root', fn: () => validate(dat, records, V, { round: false }) },
      { label: 'size base one step lower', fn: () => validate(dat, records, V, { sizeBase: V.proj.sizeBase - V.proj.sizeStep }) },
      { label: 'view rounding 0', fn: () => validate(dat, records, V, { viewRound: 0 }) },
      { label: 'a record altered', fn: () => validate(dat, records.map((r, i) => (i === 1 ? { ...r, horizon: { ...r.horizon, drawList: r.horizon.drawList.map((w, j) => (j === r.horizon.drawList.findIndex(q => q[V.list.fieldWords.type] === -1) ? w.map((x, n) => (n === V.list.fieldWords.left ? x + 1 : x)) : w)) } } : r)), V) }, // @math the first object record of the second frame
      { label: 'one archive byte changed', fn: () => validate(Uint8Array.from(dat, (x, i) => (i === dat.length - 1 ? x ^ 1 : x)), records, V) }, // @math flip the lowest bit of the last byte
    ];
  },
};
