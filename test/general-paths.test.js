// The general paths of Stage 4 (docs/enhancements.md, Stage 4 as built) on synthetic data: the table-driven floor caster (src/enhance/caster.js)
// against drawFloor and the reference floor, its hooks and its template; the general picture blit (src/enhance/blit.js) against blitLayers and
// the INF's own samples; compositeAt (src/enhance/composite.js) against composite for every effect set, and its sky-band fast path against its
// per-pixel path. No game files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castFloor, drawFloorAt, floorTemplateAt } from '../src/enhance/caster.js';
import { blitAt, blitFlatAt, classMap, shapeOf, blockPictures } from '../src/enhance/blit.js';
import { composite, compositeAt } from '../src/enhance/composite.js';
import { drawFloor, layerTemplate, KIND } from '../src/enhance/project.js';
import { createLayers, createCollect, blitLayers, blitFlatLayers, LAYER_KEYS } from '../src/enhance/scene.js';
import { geometryOf, IDENTITY } from '../src/enhance/geometry.js';
import { gradeOf } from '../src/enhance/grade.js';
import { models } from '../src/enhance/models.js';
import { createRandom } from '../src/enhance/particles.js';
import { renderFloor } from '../src/render/floor.js';
import { clipPicture } from '../src/game/objects.js';

const F = models().floor, S = models().sky, V = models().view, SIZE = F.width * F.height;
const HORIZON = { from: S.horizonRow, to: S.horizonRow + S.horizonRows };

// A synthetic world for the floor: TRIG with negative components and an entry that repeats the one before (as the archive's 1351 repeats
// 1350), NDIST distances, VIEW words with one word of 0, a map of tile ids, two sheets and a table of liquid texels.
function syntheticWorld(seed = 99) {
  const random = createRandom(seed), trig = new DataView(new ArrayBuffer(F.wrap * F.trigEntryBytes));
  for (let h = 0; h < F.wrap; h++) { trig.setInt32(h * 8, Math.round(Math.cos((2 * Math.PI * h) / F.wrap) * 65536), true); trig.setInt32(h * 8 + 4, Math.round(Math.sin((2 * Math.PI * h) / F.wrap) * 65536), true); }
  trig.setInt32(1351 * 8, trig.getInt32(1350 * 8, true), true); trig.setInt32(1351 * 8 + 4, trig.getInt32(1350 * 8 + 4, true), true);
  const ndist = new DataView(new ArrayBuffer(F.columns * F.steps * 4));
  for (let c = 0; c < F.columns; c++) for (let k = 0; k < F.steps; k++) ndist.setUint32((c * F.steps + k) * 4, 110 + k * k + (c % 9), true);
  const view = new DataView(new ArrayBuffer(F.columns * 4));
  for (let c = 0; c < F.columns; c++) view.setUint32(c * 4, c === 5 ? 0 : Math.round(16384 * (1 - ((c - 160) / 400) ** 2)), true);
  const tiles = Uint8Array.from({ length: 4096 }, () => Math.floor(random() * 108)), sheets = [0, 1].map(() => Uint8Array.from({ length: 54 * 1024 }, () => Math.floor(random() * 256)));
  const texels = new Uint8Array(108 * 1024);
  for (let id = 0; id < 108; id++) for (let t = 0; t < 1024; t++) texels[id * 1024 + t] = id % 5 === 0 ? (t % 3 === 0 ? 1 : 0) : id % 7 === 0 ? 2 : 0;
  return { trig, ndist, view, tiles, sheets, texels };
}
const CAMERAS = [{ x: 2048, y: 2048, heading: 0 }, { x: 1500, y: 2700, heading: 1777 }, { x: 1037, y: 3001, heading: 481 }, { x: 2900, y: 1100, heading: 159 }, { x: 1800, y: 1300, heading: 1 }, { x: 1201, y: 2222, heading: 1311 }]; // heading 159 and 1 make modes 2 and 3 reset past the end; 1311 casts over the repeated entry
const FRACTIONAL = [{ x: 1500.37, y: 2700.81, heading: 1777 }, { x: 2048.999999, y: 2047.000001, heading: 0 }, { x: 1037.5, y: 3001.25, heading: 481 }];

// drawFloor's hooks, logging every call: the liquid's light and the relief's light are functions of their arguments.
function hooks(world, size, log) {
  return {
    liquid: { texels: world.texels, wet: new Uint8Array(size), wave: new Float32Array(size), shade: (kind, x, y, c, k) => { log.push(`l ${kind} ${x} ${y} ${c} ${k}`); return kind + ((y & 31) * 32 + (x & 31)) / 1024; } },
    relief: { out: new Float32Array(size).fill(1), light: (at, x, y) => { log.push(`r ${at} ${x} ${y}`); return at; } },
  };
}

test('the general caster at the identity is drawFloor: the picture, the hooks and their calls in order, at whole and fractional cameras, modes 1 to 3', () => {
  const w = syntheticWorld();
  for (const mode of [1, 2, 3]) for (const camera of [...CAMERAS, ...FRACTIONAL]) {
    const la = [], lb = [], ha = hooks(w, SIZE, la), hb = hooks(w, SIZE, lb), label = `mode ${mode} camera ${JSON.stringify(camera)}`;
    const a = drawFloor(w, camera, mode, new Uint8Array(SIZE), ha), b = castFloor(w, camera, mode, new Uint8Array(SIZE), IDENTITY, hb);
    assert.deepEqual(b, a, label);
    assert.ok(la.length > 1000, 'the hooks ran');
    assert.deepEqual(lb, la, `${label}: the hooks' calls`);
    assert.deepEqual(hb.liquid.wet, ha.liquid.wet); assert.deepEqual(hb.liquid.wave, ha.liquid.wave); assert.deepEqual(hb.relief.out, ha.relief.out);
    assert.deepEqual(drawFloorAt(w, camera, mode, new Uint8Array(SIZE), IDENTITY, {}, true), a, 'forced');
  }
});

test('the general template at the identity is layerTemplate, both skies, modes 1 to 3', () => {
  const w = syntheticWorld();
  for (const mode of [1, 2, 3]) for (const plain of [true, false]) {
    const a = layerTemplate(w, mode, plain, HORIZON), b = floorTemplateAt(w, mode, plain, HORIZON, IDENTITY, true);
    assert.notEqual(a, b, 'its own template');
    assert.deepEqual(b.kind, a.kind); assert.deepEqual(b.depth, a.depth);
    assert.equal(floorTemplateAt(w, mode, plain, HORIZON, IDENTITY), a, 'dispatched at the identity');
  }
});

test('at whole scales and margins the reference samples are the reference floor, its template\'s depths and its hooks\' calls', () => {
  const w = syntheticWorld(7);
  for (const [s, m] of [[2, 0], [3, 0], [2, 27], [3, 8], [1, 53]]) for (const mode of [1, 2, 3]) for (const camera of CAMERAS.slice(0, 4)) {
    const G = geometryOf({ s, m }), fb = castFloor(w, camera, mode, new Uint8Array(G.W * G.H), G), ref = renderFloor(w, camera, mode, new Uint8Array(SIZE)), label = `s ${s} m ${m} mode ${mode} camera ${JSON.stringify(camera)}`;
    const t = floorTemplateAt(w, mode, true, HORIZON, G), r = layerTemplate(w, mode, true, HORIZON);
    for (let y = 130; y < F.height; y++) for (let x = 0; x < F.width; x++) {
      const o = s * y * G.W + s * (x + m);
      if (fb[o] !== ref[y * F.width + x]) assert.fail(`${label}: the sample ${x},${y} is ${fb[o]}, the reference ${ref[y * F.width + x]}`);
      if (t.depth[o] !== r.depth[y * F.width + x] || t.kind[o] !== KIND.floor) assert.fail(`${label}: the template at ${x},${y}`);
    }
    for (let Y = 0; Y < G.H; Y++) { const want = Y < s * 110 ? KIND.sky : Y < s * 130 ? KIND.horizon : KIND.floor; if (t.kind[Y * G.W] !== want || t.kind[Y * G.W + G.W - 1] !== want) assert.fail(`${label}: the kind of row ${Y}`); }
    for (let i = s * 130 * G.W; i < G.W * G.H; i++) if (!(t.depth[i] > 0 && t.depth[i] < Infinity)) assert.fail(`${label}: depth ${t.depth[i]} at ${i}`);
    if (mode === 1 && camera === CAMERAS[0]) { // the hooks run once per cell, at its top-left pixel, the reference sample: every texel liquid, the calls are drawFloor's
      const all = { ...w, texels: new Uint8Array(108 * 1024).fill(1) }, la = [], lb = [];
      drawFloor(all, camera, mode, new Uint8Array(SIZE), { liquid: hooks(all, SIZE, la).liquid });
      castFloor(all, camera, mode, new Uint8Array(G.W * G.H), G, { liquid: hooks(all, G.W * G.H, lb).liquid });
      if (m === 0) assert.deepEqual(lb, la, `${label}: the liquid's calls`);
      else assert.deepEqual(lb.filter(l => { const c = Number(l.split(' ')[4]); return c > 0 && c < 319; }), la.filter(l => { const c = Number(l.split(' ')[4]); return c > 0 && c < 319; }), `${label}: the liquid's calls of the centre columns`);
    }
  }
});

test('above scale 1 the hooks: a liquid pixel takes its cell\'s light or is shaded on the spot, the relief is each pixel\'s own texel\'s', () => {
  const w = syntheticWorld(3);
  for (const [s, mode] of [[2, 1], [3, 1], [2, 2], [3, 3]]) {
    const G = geometryOf({ s, m: 0 }), size = G.W * G.H, log = [], h = hooks(w, size, log), at = new Int32Array(size).fill(-1), camera = { x: 1500.25, y: 2700.5, heading: 1777 };
    castFloor(w, camera, mode, new Uint8Array(size), G, { ...h, tile: (id, texel, fu, fv, o) => { at[o] = id * 1024 + texel; if (!(fu >= 0 && fu < 1 && fv >= 0 && fv < 1)) assert.fail(`fraction ${fu} ${fv}`); return -1; } });
    let own = 0, shared = 0;
    const step = s * F.columnSteps[mode - 1];
    for (let Y = s * 130; Y < G.H; Y++) for (let X = 0; X < G.W; X++) {
      const o = Y * G.W + X, a = at[o], kind = w.texels[a], anchor = Math.floor(Y / s) * s * G.W + Math.floor(X / step) * step, aKind = w.texels[at[anchor]];
      assert.equal(h.relief.out[o], a, 'the relief of the pixel\'s own texel');
      assert.equal(h.liquid.wet[o], kind);
      if (!kind) continue;
      const mine = kind + (a % 1024) / 1024; // the test's shade: the kind and the texel
      if (kind === aKind) { assert.equal(h.liquid.wave[o], h.liquid.wave[anchor]); shared++; } else { assert.equal(h.liquid.wave[o], mine); own++; }
    }
    assert.ok(shared > 1000 && own > 0, `s ${s}: ${shared} shared, ${own} shaded on the spot`);
  }
});

test('the tile hook replaces the sheet\'s pixel, or keeps it with a negative answer', () => {
  const w = syntheticWorld(), G = geometryOf({ s: 2, m: 0 }), camera = { x: 1500.5, y: 2700, heading: 1777 };
  const plain = castFloor(w, camera, 1, new Uint8Array(G.W * G.H), G), kept = castFloor(w, camera, 1, new Uint8Array(G.W * G.H), G, { tile: () => -1 }), own = castFloor(w, camera, 1, new Uint8Array(G.W * G.H), G, { tile: () => 7 });
  assert.deepEqual(kept, plain);
  assert.ok(own.subarray(2 * 130 * G.W).every(v => v === 7));
  assert.deepEqual(drawFloorAt(w, camera, 1, new Uint8Array(SIZE), IDENTITY, { tile: () => -1 }), drawFloor(w, camera, 1, new Uint8Array(SIZE)), 'a tile hook takes the general path at the identity');
});

// An .INF shape of ten pictures over a W0 x H0 column-major frame: class 0 the frame itself, the others reading every few columns and rows
// (separable), and one picture whose columns read different rows (not separable).
function infPicture(w, h, src) { // src(i, j): the frame offset of the picture's pixel
  const deltas = new Int32Array((h + 1) * w);
  for (let i = 0; i < w; i++) { deltas[i * (h + 1)] = src(i, 0); for (let j = 0; j < h; j++) deltas[i * (h + 1) + 1 + j] = j + 1 < h ? src(i, j + 1) - src(i, j) : 0; }
  return { w, h, deltas };
}
function syntheticShape(W0 = 38, H0 = 28) {
  return Array.from({ length: 10 }, (_, k) => { const w = Math.max(W0 - 3 * k, 2), h = Math.max(H0 - 2 * k, 2); return infPicture(w, h, (i, j) => Math.floor((i * W0) / w) * H0 + Math.floor((j * H0) / h)); });
}
const skewed = infPicture(20, 14, (i, j) => Math.floor((i * 38) / 20) * 28 + Math.floor((j * 28) / 14) + (i % 2)); // odd columns read one row lower

test('the class maps: separable pictures read the INF\'s own byte at every sample and the skipped texels between; others fall back to blocks', () => {
  const shape = syntheticShape(), world = { carShape: shape, shotShape: syntheticShape(18, 13), pitShape: syntheticShape(32, 24), shapes: new Map([[3, syntheticShape(24, 30)]]) };
  assert.equal(shapeOf(world, shape[4]).k, 4); assert.equal(shapeOf(world, shape[4]).H0, 28); assert.equal(shapeOf(world, skewed), null);
  assert.deepEqual(blockPictures(world, 2), []);
  for (const s of [1, 2, 3]) for (const p of [...shape, ...world.shapes.get(3)]) {
    const info = shapeOf(world, p), map = classMap(p, s, info);
    assert.ok(map.separable, `${p.w} x ${p.h}`);
    for (let i = 0; i < p.w; i++) for (let j = 0; j < p.h; j++) if (map.cols[i * s] + map.rows[j * s] !== map.src[i * p.h + j]) assert.fail(`s ${s}: the sample ${i},${j}`);
    for (let I = 0; I < p.w * s; I++) { const c = map.cols[I] / info.H0; if (c < Math.floor(map.cols[Math.floor(I / s) * s] / info.H0) || c >= info.W0) assert.fail(`column ${I}`); }
  }
  const zero = classMap(shape[0], 2, shapeOf(world, shape[0]));
  assert.deepEqual([...zero.cols.subarray(0, 6)].map(v => v / 28), [0, 0, 1, 1, 2, 2], 'class 0 at 2x: a nearest copy');
  const mapped = classMap(skewed, 2, { shape, k: 3, W0: 38, H0: 28 });
  assert.equal(mapped.separable, false); assert.match(mapped.why, /off its column's row map/);
  assert.equal(classMap({ ...skewed }, 2, null).why, 'no shape of the world');
  assert.equal(blockPictures({ carShape: [...shape.slice(0, 9), skewed] }, 2).length, 1);
  // A picture blitted once at 2x without its world (no world walked so far holds it) takes blocks then, and its class map once the world is given.
  const fresh = syntheticShape(), lone = { carShape: fresh }, G = geometryOf({ s: 2, m: 0 }), picture = fresh[3];
  blitAt(new Uint8Array(G.W * G.H), createLayers(G.W * G.H), { ...clipPicture({ column: 160, bottom: 150 }, picture), picture, frame: new Uint8Array(38 * 28).fill(7), distance: 100 }, 0.2, G);
  assert.equal(classMap(picture, 2, null).why, 'no shape of the world');
  assert.ok(classMap(picture, 2, shapeOf(lone, picture)).separable, 'the class map, not the blocks of the call without the world');
  assert.deepEqual(blockPictures(lone, 2), []);
});

test('the general blit at scale 1 is blitLayers, clips, footprint, silhouette and relief list included; above it the samples are the INF\'s bytes', () => {
  const random = createRandom(5), shape = syntheticShape(), world = { carShape: shape }, frame = Uint8Array.from({ length: 38 * 28 }, () => (random() < 0.3 ? 0 : 1 + Math.floor(random() * 255)));
  const places = [[160, 150], [-7, 120], [-30, 199], [315, 60], [300, 230], [40, -5], [10, 20], [319, 205]]; // inside; cut on the left, the right, the bottom; above the top
  let records = 0;
  for (const picture of [...shape, skewed]) for (const [column, bottom] of places) {
    const clip = clipPicture({ column, bottom }, picture);
    if (!clip) continue;
    const rec = { ...clip, picture, frame, distance: 321.5 }, label = `${picture.w} x ${picture.h} at ${column},${bottom}`;
    const La = createLayers(SIZE), Lb = createLayers(SIZE), fa = new Uint8Array(SIZE), fb = new Uint8Array(SIZE), ca = createCollect(), cb = createCollect();
    ca.drawn = new Int32Array(SIZE); ca.sources = new Int32Array(SIZE); cb.drawn = new Int32Array(SIZE); cb.sources = new Int32Array(SIZE);
    const rows = new Uint8Array(F.height), a = blitLayers(fa, La, rec, 0.2, F.width, F.height, ca), b = blitAt(fb, Lb, rec, 0.2, IDENTITY, { world, collect: cb, rows });
    assert.deepEqual(b, a, label); assert.deepEqual(fb, fa, label);
    for (const k of LAYER_KEYS) assert.deepEqual(Lb[k], La[k], `${label}: ${k}`);
    assert.equal(cb.count, ca.count); assert.deepEqual(cb.drawn.subarray(0, cb.count), ca.drawn.subarray(0, ca.count)); assert.deepEqual(cb.sources.subarray(0, cb.count), ca.sources.subarray(0, ca.count));
    for (let y = 0; y < F.height; y++) assert.equal(rows[y], fa.subarray(y * F.width, (y + 1) * F.width).some(v => v !== 0) ? 1 : 0, `${label}: the flag of row ${y}`);
    if (a) records++;
    for (const s of [2, 3]) { // the whole picture at s: the sample (s i, s j) is the INF's byte, the layers on every drawn pixel
      const G = geometryOf({ s, m: 0 }), out = new Uint8Array(G.W * G.H), L = createLayers(G.W * G.H), whole = { ...rec, ...clipPicture({ column: 160, bottom: 150 }, picture) };
      const drawn = blitAt(out, L, whole, 0.2, G, { world });
      const map = classMap(picture, s, shapeOf(world, picture));
      for (let i = 0; i < picture.w; i++) for (let j = 0; j < picture.h; j++) {
        const v = frame[map.src[i * picture.h + j]], o = (s * (whole.top + j)) * G.W + s * (whole.left + i);
        if (v !== 0 && out[o] !== v) assert.fail(`s ${s}, ${label}: the sample ${i},${j}`);
      }
      for (let o = 0; o < out.length; o++) if ((out[o] !== 0) !== (L.kind[o] === KIND.sprite)) assert.fail(`s ${s}: the kind at ${o}`);
      if (drawn) { assert.equal(drawn.cols.top.length, whole.width * s); assert.ok(drawn.foot.minX >= s * whole.left && drawn.foot.maxX < s * (whole.left + picture.w)); }
    }
  }
  assert.ok(records > 40);
  const d = { x: 300, y: 190, width: 30, height: 15, bytes: frame.subarray(0, 450) }, La = createLayers(SIZE), Lb = createLayers(SIZE), fa = new Uint8Array(SIZE), fb = new Uint8Array(SIZE);
  blitFlatLayers(fa, La, d, 124, F.width, F.height, true); blitFlatAt(fb, Lb, d, 124, IDENTITY, true);
  assert.deepEqual(fb, fa); for (const k of LAYER_KEYS) assert.deepEqual(Lb[k], La[k], `the flat blit: ${k}`);
});

// A synthetic 320 x 200 frame with every layer and every effect: the sky rows, the strip's rows and the ground with pictures over them.
function syntheticFrame(seed, G = IDENTITY) {
  const random = createRandom(seed), size = G.W * G.H, L = createLayers(size), index = new Uint8Array(size), mask = new Uint8Array(size);
  for (let o = 0; o < size; o++) {
    const Y = Math.floor(o / G.W), row = G.rowRef[Y];
    index[o] = Math.floor(random() * 256);
    L.kind[o] = row < 110 ? KIND.sky : row < 130 ? (random() < 0.8 ? KIND.horizon : KIND.sky) : KIND.floor;
    if (random() < 0.08) L.kind[o] = KIND.sprite;
    L.depth[o] = L.kind[o] === KIND.sky || L.kind[o] === KIND.horizon ? Infinity : random() * 1400;
    L.shade[o] = random() < 0.3 ? random() : 0; L.cast[o] = random() < 0.2 ? random() : 0; L.mark[o] = random() < 0.1 ? random() * 0.5 : 0;
    L.wet[o] = random() < 0.2 ? 1 + Math.floor(random() * 2) : 0; L.wave[o] = random() * 1.3 - 0.5; L.relief[o] = random() < 0.3 ? 1 : 0.5 + random();
    mask[o] = random() < 0.03 ? 1 : 0;
  }
  const palette = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) palette.set([i, (i * 7) % 256, 255 - i, 255], i * 4);
  return { L, index, mask, palette };
}
// The effects' tables of a geometry, drawn once (the covers at its reference width), and the effect set `n` of them: its bits switch the
// effects on and off, n mod 5 picks the sky (none, the tint only, the far range only, the clouds only, everything).
function syntheticPool(G = IDENTITY) {
  const random = createRandom(1000 + G.s * 100 + G.m), cells = G.refW, f32 = (len, scale = 255) => Float32Array.from({ length: len }, () => random() * scale), flags = (len, p) => Uint8Array.from({ length: len }, () => (random() < p ? 1 : 0));
  return {
    strip: flags(20 * 256, 0.5), tint: { colours: f32(130 * 3), amount: 0.4 },
    range: { cover: { alpha: flags(cells * 130, 0.4), tone: f32(cells * 130, 1), snow: flags(cells * 130, 0.2) }, colours: { lit: f32(130 * 3), shade: f32(130 * 3), snow: f32(130 * 3) } },
    clouds: [0, 1].map(() => ({ alpha: Float32Array.from({ length: cells * 110 }, () => (random() < 0.5 ? 0 : random())), light: f32(cells * 110, 1), lit: f32(110 * 3), shade: f32(110 * 3) })),
    ramp: f32(V.maxDistance + 2, 1), reflect: f32(V.maxDistance + 2, 0.8),
  };
}
function syntheticEffects(n, pool) {
  const bit = b => (n >> b) & 1, variant = n % 5;
  const sky = variant === 0 ? null : { rows: 110, stripRows: 20, strip: variant === 2 && bit(1) ? null : pool.strip, tint: variant === 1 || variant === 4 ? pool.tint : null, range: variant === 2 || variant === 4 ? pool.range : null, clouds: variant === 3 || variant === 4 ? pool.clouds : [] };
  const fog = bit(1) ? { color: [40, 90, 200], ramp: pool.ramp, horizon: 0.3 } : null;
  const water = bit(2) ? { sky: [120, 160, 220], highlight: [240, 250, 255], glow: [255, 120, 40], reflect: bit(5) ? pool.reflect : null } : null;
  const grade = bit(3) ? { ...gradeOf(bit(6) ? 'night' : 'sunset', 0.8), trackSky: Boolean(bit(5)) } : null;
  return { shadow: bit(4) ? 0.7 : 0, fog, sky, water, relief: Boolean(bit(5)), grade, cap: bit(7) ? 180 : 255 };
}
const same = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
const syntheticSplats = (G = IDENTITY) => [{ x: 40 * G.s, y: 60 * G.s, r: 9 * G.s, depth: 300, color: [255, 0, 0], alpha: 0.8, soft: true, map: y => y }, { x: 200 * G.s, y: 160 * G.s, r: 12 * G.s, depth: 500, color: [0, 255, 0], alpha: 1, soft: false, map: y => G.H - 1 - y }, { x: 310 * G.s, y: 2 * G.s, r: 6 * G.s, depth: 200, color: [9, 9, 9], alpha: 0.5, soft: true, map: y => y }];

test('compositeAt at the identity is composite for every effect set, with and without overlays and splats', () => {
  const { L, index, mask, palette } = syntheticFrame(11), pool = syntheticPool();
  for (let n = 0; n < 256; n++) {
    const effects = syntheticEffects(n, pool), splats = n % 3 === 1 ? syntheticSplats() : [], overlays = ((n * 37) >> 3) & 1, m = overlays ? mask : new Uint8Array(SIZE); // the splats and the overlays apart from the effects' bits
    const a = composite(new Uint8ClampedArray(SIZE * 4), { index, mask: m, L, palette, width: F.width, effects, splats });
    const b = compositeAt(new Uint8ClampedArray(SIZE * 4), { fb: index, mask: overlays ? mask : null, L, G: IDENTITY, palette, effects, splats, rows: new Uint8Array(F.height) });
    if (!same(a, b)) assert.fail(`effect set ${n}: first difference at byte ${a.findIndex((v, i) => v !== b[i])}`);
  }
});

test('the sky-band fast path is the per-pixel path, and it runs', () => {
  for (const [s, m] of [[2, 0], [3, 0], [2, 8]]) {
    const G = geometryOf({ s, m }), size = G.W * G.H, { L, mask, palette } = syntheticFrame(13, G), random = createRandom(17), cells = new Uint8Array(G.refW * F.height).map(() => Math.floor(random() * 256));
    const fb = new Uint8Array(size), rows = new Uint8Array(G.H), pool = syntheticPool(G);
    for (let Y = 0; Y < G.H; Y++) for (let X = 0; X < G.W; X++) fb[Y * G.W + X] = cells[G.rowRef[Y] * G.refW + G.colRef[X] + m]; // a sky drawn at s: one index a cell
    for (let o = 0; o < s * 110 * G.W; o++) L.kind[o] = KIND.sky;
    for (const y of [5, 6, 50]) for (let X = 10; X < 40; X++) { const Y = s * y + (y % s), o = Y * G.W + X; L.kind[o] = KIND.sprite; L.depth[o] = 100; fb[o] = 3; rows[Y] = 1; } // pictures over three sky rows, flagged by their blit
    for (let n = 0; n < 20; n++) { // every sky, every effect on and off, with and without splats and overlays
      const effects = syntheticEffects(n * 13 + 3, pool), splats = n % 3 === 1 ? syntheticSplats(G) : [], withMask = (n >> 2) & 1 ? mask : null;
      const slow = compositeAt(new Uint8ClampedArray(size * 4), { fb, mask: withMask, L, G, palette, effects, splats, rows, slow: true });
      const fast = compositeAt(new Uint8ClampedArray(size * 4), { fb, mask: withMask, L, G, palette, effects, splats, rows });
      if (!same(slow, fast)) assert.fail(`s ${s} m ${m} effect set ${n}: first difference at byte ${slow.findIndex((v, i) => v !== fast[i])}`);
    }
    const odd = Uint8Array.from(fb); odd[(s * 30 + 1) * G.W + 1] ^= 0x55; // a cell that is not one index: only the per-pixel path sees it
    const effects = syntheticEffects(0, pool), a = compositeAt(new Uint8ClampedArray(size * 4), { fb: odd, L, G, palette, effects, rows, slow: true }), b = compositeAt(new Uint8ClampedArray(size * 4), { fb: odd, L, G, palette, effects, rows });
    assert.notDeepEqual(b, a, 'the fast path composed the sky row once per cell');
    const ground = Uint8Array.from(L.kind); ground[(s * 30 + 1) * G.W + 1] = KIND.floor; // a pixel of another kind under that row: the row goes per pixel
    const Lg = { ...L, kind: ground }, c = compositeAt(new Uint8ClampedArray(size * 4), { fb: odd, L: Lg, G, palette, effects, rows, slow: true }), d = compositeAt(new Uint8ClampedArray(size * 4), { fb: odd, L: Lg, G, palette, effects, rows });
    assert.ok(same(c, d), 'a sky row holding another kind is composed per pixel');
    const count = { fast: 0 }, slowCount = { fast: 0 }; // the rows the fast path took: every sky row but the three flagged ones (and none when it is off)
    compositeAt(new Uint8ClampedArray(size * 4), { fb, L, G, palette, effects, rows, count }); compositeAt(new Uint8ClampedArray(size * 4), { fb, L, G, palette, effects, rows, slow: true, count: slowCount });
    assert.deepEqual([count.fast, slowCount.fast], [110 - 3, 0]); // @math the sky's rows less the three with pictures
    assert.throws(() => compositeAt(new Uint8ClampedArray(size * 4), { fb, L, G, palette, effects, rows: new Uint8Array(F.height) }), /row flags/, 'flags of the reference height above it');
  }
});
