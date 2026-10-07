// Stage 4's 2x (docs/enhancements.md, Stage 4 as built, M6) on synthetic tables, the floor's side: the reference samples of the floor, the sky
// and the strip at s = 2 and 3 are the reference renderer's; the reference look's ground light is drawFloor's own relief layer on the
// reference grid; the fine heading of mode 1; the composite of the reference look (the soft layers read at each pixel's reference cell) is the
// composite of those layers enlarged nearest, with and without the sky-band fast path. No game files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castFloor } from '../src/enhance/caster.js';
import { drawFloor, KIND } from '../src/enhance/project.js';
import { compositeAt } from '../src/enhance/composite.js';
import { createLayers, createSoftLayers, SOFT_KEYS, fineHeading } from '../src/enhance/scene.js';
import { geometryOf, IDENTITY } from '../src/enhance/geometry.js';
import { drawSkyAt, drawStripAt } from '../src/enhance/sky-hd.js';
import { gradeOf } from '../src/enhance/grade.js';
import { models } from '../src/enhance/models.js';
import { createRandom } from '../src/enhance/particles.js';
import { renderFloor } from '../src/render/floor.js';
import { renderSky, renderHorizon } from '../src/render/sky.js';

const F = models().floor, S = models().sky, V = models().view, SIZE = F.width * F.height;

// A synthetic world: TRIG with negative components (an entry repeating the one before, as the archive's 1351 repeats 1350), NDIST, VIEW, a
// map, two sheets, a sky picture and a .PAR strip.
function syntheticWorld(seed) {
  const random = createRandom(seed), trig = new DataView(new ArrayBuffer(F.wrap * F.trigEntryBytes));
  for (let h = 0; h < F.wrap; h++) { trig.setInt32(h * 8, Math.round(Math.cos((2 * Math.PI * h) / F.wrap) * 65536), true); trig.setInt32(h * 8 + 4, Math.round(Math.sin((2 * Math.PI * h) / F.wrap) * 65536), true); } // @math 16.16 cosine and sine of each entry
  trig.setInt32(1351 * 8, trig.getInt32(1350 * 8, true), true); trig.setInt32(1351 * 8 + 4, trig.getInt32(1350 * 8 + 4, true), true); // @math the repeated entry
  const ndist = new DataView(new ArrayBuffer(F.columns * F.steps * 4)), view = new DataView(new ArrayBuffer(F.columns * 4)); // @math dwords
  for (let c = 0; c < F.columns; c++) for (let k = 0; k < F.steps; k++) ndist.setUint32((c * F.steps + k) * 4, 110 + k * k + (c % 9), true); // @math distances growing down the steps
  for (let c = 0; c < F.columns; c++) view.setUint32(c * 4, Math.round(16384 * (1 - ((c - 160) / 400) ** 2)), true); // @math about 2^14 cos
  const tiles = Uint8Array.from({ length: 4096 }, () => Math.floor(random() * 108)), sheets = [0, 1].map(() => Uint8Array.from({ length: 54 * 1024 }, () => Math.floor(random() * 256))); // @math 64 x 64 cells; two sheets of 54 tiles
  const sky = Uint8Array.from({ length: SIZE }, () => Math.floor(random() * 256)), par = new Uint8Array(S.parBytes);
  for (let j = 0; j < S.horizonRows; j++) for (let p = 0; p < S.parRowPixels; p++) par[j * S.parRowPixels + p] = (p * 13 + j * 29) & 0xff; // @math a pattern
  return { trig, ndist, view, tiles, sheets, sky, par };
}
const CAMERAS = [{ x: 2048, y: 2048, heading: 0 }, { x: 1500, y: 2700, heading: 1777 }, { x: 1037, y: 3001, heading: 481 }, { x: 2900, y: 1100, heading: 159 }, { x: 1201, y: 2222, heading: 1311 }]; // whole cameras and headings: 159 makes modes 2 and 3 reset past the end, 1311 casts over the repeated entry

test('at 2x and 3x, a whole camera and heading, modes 1 to 3: the reference samples of the floor, the sky and the strip are the reference renderer\'s', () => {
  const w = syntheticWorld(3);
  for (const s of [2, 3]) for (const mode of [1, 2, 3]) for (const camera of CAMERAS) { // @math the scales of the tests
    const G = geometryOf({ s, m: 0 }), fb = new Uint8Array(G.W * G.H), offset = (camera.heading * 7) % (S.offsetMax + 1); // @math a whole strip offset of the camera
    drawSkyAt(w.sky, fb, G); drawStripAt(w.par, offset, fb, G); castFloor(w, camera, mode, fb, G);
    const ref = renderSky(w.sky, new Uint8Array(SIZE)); renderHorizon(w.par, offset, ref); renderFloor(w, camera, mode, ref);
    for (let y = 0; y < F.height; y++) for (let x = 0; x < F.width; x++) if (fb[s * y * G.W + s * x] !== ref[y * F.width + x]) assert.fail(`${s}x mode ${mode} camera ${JSON.stringify(camera)}: the sample ${x},${y}`);
  }
});

test('the reference look: the ground\'s light on the reference grid is drawFloor\'s own relief layer, and the liquids\' samples are drawFloor\'s', () => {
  const w = syntheticWorld(5), texels = new Uint8Array(108 * 1024); // @math a liquid table over every tile's texels
  for (let id = 0; id < 108; id++) for (let t = 0; t < 1024; t++) texels[id * 1024 + t] = id % 5 === 0 ? (t % 3 === 0 ? 1 : 0) : id % 7 === 0 ? 2 : 0; // @math water on some tiles, the red liquid on others
  const light = (at, x, y) => (at % 977) / 977 + ((x ^ y) & 7) / 8, shade = (kind, x, y, c, k) => kind + ((x * 3 + y + c + k) % 97) / 97; // @math functions of their arguments
  for (const s of [2, 3]) for (const mode of [1, 2, 3]) for (const camera of [...CAMERAS, { x: 1500.37, y: 2700.81, heading: 1777 }]) { // a fractional camera too (its samples are drawFloor's at the same camera)
    const G = geometryOf({ s, m: 0 }), size = G.W * G.H, grid = new Float32Array(G.refW * F.height).fill(1), wet = new Uint8Array(size), wave = new Float32Array(size);
    castFloor(w, camera, mode, new Uint8Array(size), G, { relief: { ref: grid, light }, liquid: { texels, wet, wave, shade } });
    const one = { out: new Float32Array(SIZE).fill(1), light }, liquid = { texels, wet: new Uint8Array(SIZE), wave: new Float32Array(SIZE), shade };
    drawFloor(w, camera, mode, new Uint8Array(SIZE), { relief: one, liquid });
    assert.deepEqual(grid, one.out, `${s}x mode ${mode}: the ground's light`);
    for (let y = 130; y < F.height; y++) for (let x = 0; x < F.width; x++) { // @math the floor's rows
      const o = s * y * G.W + s * x, i = y * F.width + x;
      if (wet[o] !== liquid.wet[i] || (wet[o] && wave[o] !== liquid.wave[i])) assert.fail(`${s}x mode ${mode}: the liquid at the sample ${x},${y}`);
    }
  }
});

test('the fine heading above 1x: mode 1 to 1/s of an entry, wrapped; modes 2 and 3 and 1x the tick camera\'s whole heading', () => {
  const two = geometryOf({ s: 2, m: 0 }), three = geometryOf({ s: 3, m: 0 }), camI = { heading: 100 }; // @math a whole heading
  assert.equal(fineHeading({ heading: 100.3 }, camI, two, 1), 100.5); // @math round(200.6) / 2
  assert.equal(fineHeading({ heading: 100.2 }, camI, two, 1), 100); // @math round(200.4) / 2
  assert.equal(fineHeading({ heading: 100.3 }, camI, three, 1), 100 + 1 / 3); // @math round(300.9) / 3
  assert.equal(fineHeading({ heading: V.turn - 0.2 }, { heading: 0 }, two, 1), 0, 'wrapped at the turn');
  assert.equal(fineHeading({ heading: -0.3 }, { heading: 0 }, two, 1), V.turn - 0.5, 'a blend below 0 wrapped'); // @math round(-0.6) / 2
  for (const mode of [2, 3]) assert.equal(fineHeading({ heading: 100.3 }, camI, two, mode), 100); // @math the column blocks are gameplay
  assert.equal(fineHeading({ heading: 100.3 }, camI, IDENTITY, 1), 100);
  // A fractional heading turns the floor between the whole ones: at 100.5 the rays of the columns are the lerp of 100's and 101's.
  const w = syntheticWorld(9), G = two, a = castFloor(w, { x: 2048, y: 2048, heading: 100.5 }, 1, new Uint8Array(G.W * G.H), G), b = castFloor(w, { x: 2048, y: 2048, heading: 100 }, 1, new Uint8Array(G.W * G.H), G); // @math the map's middle
  assert.ok(!Buffer.from(a).equals(Buffer.from(b)), 'half an entry moves the floor');
});

// The layers and the soft layers of a synthetic 2x frame: every kind, liquids, shadows, marks and both reliefs.
function softFrame(G, seed) {
  const random = createRandom(seed), size = G.W * G.H, L = createLayers(size), R = createSoftLayers(G.refW * F.height), fb = new Uint8Array(size);
  for (let o = 0; o < size; o++) {
    const row = G.rowRef[Math.floor(o / G.W)];
    fb[o] = row < S.skyRows ? (row * 31 + G.colRef[o % G.W] * 7) & 0xff : Math.floor(random() * 256); L.kind[o] = row < S.skyRows ? KIND.sky : row < S.horizonRow + S.horizonRows ? KIND.horizon : KIND.floor; // @math palette indices: the sky's one a cell, as sky-hd.js enlarges it
    if (row >= S.skyRows && random() < 0.1) L.kind[o] = KIND.sprite;
    L.depth[o] = L.kind[o] === KIND.floor || L.kind[o] === KIND.sprite ? random() * 1400 : Infinity; // @math distances over the floor's
    L.wet[o] = L.kind[o] === KIND.floor && random() < 0.2 ? 1 + Math.floor(random() * 2) : 0; L.wave[o] = random() * 1.3 - 0.5; L.relief[o] = 0.5 + random(); // @math either liquid; a light
  }
  for (const k of SOFT_KEYS) for (let r = 0; r < R[k].length; r++) R[k][r] = k === 'relief' ? 0.5 + random() : random() < 0.3 ? random() : 0; // @math the reference grid's shadows, marks and ground light
  const palette = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) palette.set([i, (i * 7) % 256, 255 - i, 255], i * 4); // @math 256 colours
  return { L, R, fb, palette };
}

test('the reference look\'s composite is the composite of its soft layers enlarged nearest (the ground\'s light at the cell, the pictures\' at the pixel), fast path or not', () => {
  for (const s of [2, 3]) {
    const G = geometryOf({ s, m: 0 }), { L, R, fb, palette } = softFrame(G, 40 + s), rows = new Uint8Array(G.H); // @math a seed a scale
    const big = createLayers(G.W * G.H); for (const k of ['kind', 'depth', 'wet', 'wave', 'relief']) big[k].set(L[k]);
    for (let o = 0; o < G.W * G.H; o++) { const Y = Math.floor(o / G.W), r = G.rowRef[Y] * G.refW + G.colRef[o % G.W]; big.shade[o] = R.shade[r]; big.cast[o] = R.cast[r]; big.mark[o] = R.mark[r]; if (L.kind[o] === KIND.floor) big.relief[o] = R.relief[r]; } // the soft layers enlarged; the pictures keep their own light
    for (let Y = 0; Y < G.H; Y++) rows[Y] = L.kind.subarray(Y * G.W, (Y + 1) * G.W).includes(KIND.sprite) ? 1 : 0;
    const ramp = Float32Array.from({ length: V.maxDistance + 2 }, (_, d) => Math.min(d / 1400, 1) * 0.4); // @math a fog by distance
    for (const effects of [{ shadow: 0.8, fog: null, relief: true, cap: 255 }, { shadow: 1, fog: { color: [40, 90, 200], ramp, horizon: 0.3 }, water: { sky: [120, 160, 220], highlight: [240, 250, 255], glow: [255, 120, 40], reflect: ramp }, relief: true, grade: { ...gradeOf('sunset', 0.8), trackSky: true }, cap: 200 }]) { // @math a plain set and every effect under a fade
      const a = new Uint8ClampedArray(G.W * G.H * 4), b = new Uint8ClampedArray(G.W * G.H * 4), c = new Uint8ClampedArray(G.W * G.H * 4); // @math four bytes a colour
      compositeAt(a, { fb, L, G, palette, effects, rows, soft: R });
      compositeAt(b, { fb, L: big, G, palette, effects, rows });
      compositeAt(c, { fb, L, G, palette, effects, rows, soft: R, slow: true });
      assert.ok(Buffer.from(a).equals(Buffer.from(b)), `${s}x: the soft layers read at the cell`);
      assert.ok(Buffer.from(a).equals(Buffer.from(c)), `${s}x: the fast path`);
    }
  }
});
