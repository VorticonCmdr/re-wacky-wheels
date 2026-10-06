// Stage 3 of the Enhanced presentation (docs/enhancements.md): the far range behind the horizon strip and the moving water. Synthetic data
// only; the pictures of real tracks are checked by scripts/check-enhance.js and in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAtmosphere, describeAtmosphere } from '../src/enhance/atmosphere.js';
import { ATMOSPHERE, RANGE, WATER, PRESETS, LOOK_EFFECTS } from '../src/enhance/config.js';
import { rangeProfile, coverRange, rangeColours } from '../src/enhance/ranges.js';
import { liquidsOf, waterShader, sunGlitter, LIQUID } from '../src/enhance/water.js';
import { composite } from '../src/enhance/composite.js';
import { createLayers } from '../src/enhance/scene.js';
import { createEnhancer } from '../src/enhance/index.js';
import { gradeOf } from '../src/enhance/grade.js';
import { drawFloor, KIND } from '../src/enhance/project.js';
import { createRandom } from '../src/enhance/particles.js';
import { models } from '../src/enhance/models.js';

const W = 320, H = 200, SIZE = W * H; // @math the screen

test('the far range and the water in an atmosphere: their values within range, names only from the lists', () => {
  const a = normalizeAtmosphere({ range: 3, rangeShape: 'mountains', water: '0.25' });
  assert.deepEqual(a, { ...ATMOSPHERE.defaults, range: 1, rangeShape: 'mountains', water: 0.25 }); // @math a quarter
  for (const bad of [{ range: [1] }, { water: true }, { rangeShape: 'toString' }, { rangeShape: '__proto__' }, { rangeShape: ['hills'] }, { range: '' }]) assert.deepEqual(normalizeAtmosphere(bad), ATMOSPHERE.defaults, JSON.stringify(bad));
  assert.match(describeAtmosphere({ range: 0, water: 0 }), /no far range, still water/);
  assert.match(describeAtmosphere({ rangeShape: 'mountains', range: 0.8 }), /far mountains 80%/);
  assert.ok(RANGE.names.includes(ATMOSPHERE.defaults.rangeShape));
});

test('a range\'s profile repeats without a step and stays within its low point and 1; it is made once', () => {
  for (const shape of RANGE.names) {
    const p = rangeProfile(shape), n = RANGE.period;
    assert.equal(rangeProfile(shape), p);
    assert.equal(p.length, n);
    assert.ok(Math.min(...p) >= RANGE.shapes[shape].low - 1e-6 && Math.max(...p) <= 1 + 1e-6, shape);
    let largest = 0;
    for (let x = 0; x < n; x++) largest = Math.max(largest, Math.abs(p[(x + 1) % n] - p[x]));
    assert.ok(Math.abs(p[0] - p[n - 1]) <= largest + 1e-6, `${shape}: the end meets the start as any two neighbours meet`);
  }
});

test('the range stands on the strip\'s last row in every column, no taller than its rows, nothing at none; it moves slower than the strip', () => {
  const S = models().sky, rows = S.skyRows + S.horizonRows, foot = rows - 1, out = { alpha: new Uint8Array(W * rows), tone: new Float32Array(W * rows), snow: new Uint8Array(W * rows) };
  assert.equal(coverRange(out, { height: 0, shape: 'hills', scroll: 0 }), false);
  assert.ok(out.alpha.every(a => a === 0));
  for (const shape of RANGE.names) {
    assert.equal(coverRange(out, { height: 1, shape, scroll: 37 }), true); // @math any scroll
    const top = foot + 1 - Math.ceil(RANGE.shapes[shape].rows) - 1;
    for (let x = 0; x < W; x++) {
      assert.equal(out.alpha[foot * W + x], 1, `${shape} column ${x} stands on the foot`);
      for (let y = 0; y < top; y++) assert.equal(out.alpha[y * W + x], 0, `${shape} column ${x} row ${y}`);
      let y = foot; while (y >= 0 && out.alpha[y * W + x]) y--; for (; y >= 0; y--) assert.equal(out.alpha[y * W + x], 0, `${shape}: no gap under the crest in column ${x}`);
    }
    for (const t of out.tone) assert.ok(t >= 0 && t <= 1);
  }
  assert.ok(out.snow.some(s => s === 1), 'the mountains have snow at the full range');
  const heights = scroll => { coverRange(out, { height: 1, shape: 'mountains', scroll }); return Array.from({ length: W }, (_, x) => { let n = 0; for (let y = foot; y >= 0 && out.alpha[y * W + x]; y--) n++; return n; }); };
  const a = heights(0), b = heights(1 / RANGE.parallax); // the strip moves a pixel: the range one pixel times its parallax
  let same = 0; for (let x = 0; x < W - 1; x++) if (Math.abs(b[x] - a[x + 1]) <= 1) same++; // @math a dithered edge is a pixel either way
  assert.ok(same >= W - 4, `shifted by a pixel: ${same}`); // @math a few edge pixels may dither apart
  const colours = rangeColours(new Float32Array(rows * 3).fill(200), [100, 120, 140], 255); // @math a light sky, a bluish haze
  for (let i = 0; i < rows * 3; i++) { assert.ok(colours.lit[i] >= colours.shade[i] - 1e-6, 'a lit face is lighter'); assert.ok(colours.snow[i] >= colours.lit[i] - 1e-6, 'snow is lighter still'); }
  const capped = rangeColours(new Float32Array(rows * 3).fill(250), [250, 250, 250], 60); // @math the demo's fade
  for (const c of [capped.lit, capped.shade, capped.snow]) for (const v of c) assert.ok(v <= 60); // @math the cap
});

test('the composite: the range takes the sky and the strip\'s sky-coloured pixels without the strip\'s fog, never its scenery nor the overlays', () => {
  const index = new Uint8Array(SIZE).fill(1), mask = new Uint8Array(SIZE), L = createLayers(SIZE), palette = new Uint8ClampedArray(1024); // @math 256 colours of four bytes
  palette.set([100, 150, 200, 255], 4); palette.set([90, 60, 30, 255], 8); // @math colour 1, the sky's; colour 2, scenery
  for (let i = 0; i < SIZE; i++) L.kind[i] = i < 110 * W ? KIND.sky : i < 130 * W ? KIND.horizon : KIND.floor; // @math the sky, the strip, the floor
  const skyPixel = 105 * W + 3, stripSky = 125 * W + 3, stripScenery = 125 * W + 4, overlay = 120 * W + 3; // @math pixels of each part
  index[stripScenery] = 2; mask[overlay] = 1;
  const strip = new Uint8Array(20 * 256); for (let j = 0; j < 20; j++) strip[j * 256 + 1] = 1; // @math the strip's rows: index 1 is its sky
  const cover = { alpha: new Uint8Array(130 * W).fill(1), tone: new Float32Array(130 * W).fill(1), snow: new Uint8Array(130 * W) }, flat = new Float32Array(130 * 3); // @math the range everywhere, lit
  for (let y = 0; y < 130; y++) flat.set([10, 20, 30], y * 3); // @math the range's colour
  const sky = { rows: 110, stripRows: 20, strip, tint: null, range: { cover, colours: { lit: flat, shade: flat, snow: flat } }, clouds: [] }, fog = { color: [255, 255, 255], ramp: new Float32Array(2000).fill(0.5), horizon: 0.5 }; // @math half fog toward white
  const out = composite(new Uint8ClampedArray(SIZE * 4), { index, mask, L, palette, width: W, effects: { shadow: 0, fog, sky, cap: 255 } }); // @math four bytes a colour
  const rgb = i => [...out.subarray(i * 4, i * 4 + 3)];
  assert.deepEqual(rgb(skyPixel), [10, 20, 30]); // @math the range
  assert.deepEqual(rgb(stripSky), [10, 20, 30]); // @math the range, no strip fog over it
  assert.deepEqual(rgb(stripScenery), [172, 158, 142]); // @math the scenery, half way to the fog's white (halves round to even)
  assert.deepEqual(rgb(overlay), [100, 150, 200]); // @math the overlay as the palette has it
  const faded = composite(new Uint8ClampedArray(SIZE * 4), { index, mask, L, palette, width: W, effects: { shadow: 0, fog: null, sky: { ...sky, range: { cover, colours: { lit: flat.map(() => 255), shade: flat.map(() => 255), snow: flat } } }, cap: 60 } }); // @math a white range under a fade
  for (const i of [skyPixel, stripSky]) for (let k = 0; k < 3; k++) assert.ok(faded[i * 4 + k] <= 60); // @math the cap
});

// A synthetic track for the liquids: tile 1 is surface 6 (blue), 2 surface 15 (red), 3 surface 25 in nearly the blue of tile 1, 4 surface 0
// (green), 5 half surface 0 and half surface 6 by its mask; the map holds tiles 0 to 5.
function liquidWorld() {
  const palette = new Uint8Array(768); // @math 256 colours of three 6-bit components
  palette.set([0, 0, 60], 3); palette.set([60, 0, 0], 6); palette.set([1, 2, 58], 9); palette.set([0, 50, 0], 12); // @math colours 1 (blue), 2 (red), 3 (nearly 1), 4 (green)
  const surfaces = [[0, 0], [6, 6], [15, 15], [25, 25], [0, 0], [0, 6]], colours = [4, 1, 2, 3, 4, 1]; // @math per tile: the surfaces of mask 0 and 1, its colour
  const sin = Array.from({ length: 108 }, (_, id) => { const kept = new Uint8Array(8), dv = new DataView(kept.buffer), [a, b] = surfaces[id] ?? [0, 0]; dv.setUint32(0, a, true); dv.setUint32(4, b, true); return { kept }; }); // @math 108 tiles of 8 kept bytes, two dwords
  const sheets = [0, 1].map(() => new Uint8Array(54 * 1024)), maskSheets = [0, 1].map(() => new Uint8Array(54 * 1024)); // @math two sheets of 54 tiles
  for (let id = 0; id < surfaces.length; id++) { sheets[0].fill(colours[id], id * 1024, id * 1024 + 1024); if (id === 5) for (let t = 0; t < 1024; t++) maskSheets[0][id * 1024 + t] = t & 1; } // @math tile bytes; tile 5's mask alternates
  const tiles = Uint8Array.from({ length: 4096 }, (_, i) => i % 6); // @math the map's cells, tiles 0 to 5
  return { palette, sin, sheets, maskSheets, tiles };
}

test('the liquids: the game\'s sinking surfaces, water or red by their colour, and a surface in nearly a liquid\'s colour; every texel marked', () => {
  const world = liquidWorld(), l = liquidsOf(world);
  assert.equal(liquidsOf(world), l); // made once
  assert.equal(l.kinds.get(6), LIQUID.water); assert.equal(l.kinds.get(15), LIQUID.red); assert.equal(l.kinds.get(25), LIQUID.water); assert.equal(l.kinds.has(0), false); // @math the surfaces of the synthetic tiles
  assert.ok(l.any);
  const texel = (id, t) => l.texels[id * 1024 + t]; // @math tile bytes
  assert.equal(texel(1, 77), LIQUID.water); assert.equal(texel(2, 77), LIQUID.red); assert.equal(texel(3, 77), LIQUID.water); assert.equal(texel(4, 77), LIQUID.none); // @math any texel
  assert.equal(texel(5, 0), LIQUID.none); assert.equal(texel(5, 1), LIQUID.water); // the mask picks the surface
  const dry = liquidWorld(); dry.tiles.fill(4); assert.equal(liquidsOf(dry).any, false); // @math only the green tile on the map
});

test('the water\'s light: a highlight up to the strength, a little darker or lighter between, only highlights on a beach; it moves with time', () => {
  const V = models().view, F = models().floor, world = liquidWorld();
  world.ndist = new DataView(new ArrayBuffer(F.columns * F.groupDwords * F.ndistDwordBytes)); world.view = new DataView(new ArrayBuffer((V.maxColumn + 1) * V.viewBytes));
  for (let c = 0; c < F.columns; c++) { for (let k = 0; k < F.steps; k++) world.ndist.setUint32((c * F.groupDwords + k) * F.ndistDwordBytes, 115 + k * 12, true); world.view.setUint32(c * V.viewBytes, 2 ** V.viewShift, true); } // @math distances from the nearest row outward; a scale of 1
  const glitter = sunGlitter({ f: -1, l: 0 }, new Float32Array(F.columns)); // the sun straight ahead
  assert.ok(glitter[V.center] > glitter[0] && glitter[0] >= 0, 'the middle looks at the sun');
  const values = (time, strength, beach, kind = LIQUID.water) => { const shade = waterShader(world, { time, strength, beach, glitter }), out = []; for (let x = 0; x < 300; x += 7) for (let y = 0; y < 300; y += 5) out.push(shade(kind, 1000 + x, 1000 + y, (x + y) % F.columns, y % 40)); return out; }; // @math a patch of samples
  const a = values(1000, 1, false), b = values(4000, 1, false); // @math two moments
  for (const v of a) assert.ok(v >= -WATER.shimmer - 1e-9 && v <= 1 + 1e-9, String(v));
  assert.ok(a.some(v => v > WATER.shimmer), 'some highlights'); assert.ok(a.some(v => v < 0), 'some darker');
  assert.notDeepEqual(a, b, 'it moves');
  for (const v of values(1000, 1, true)) assert.ok(v >= 0, 'the beach water: highlights only');
  assert.ok(values(1000, 1, true, LIQUID.red).some(v => v < 0), 'the red liquid has its shimmer on a beach track too');
  for (const v of values(1000, 0, false)) assert.equal(Math.abs(v), 0, 'none at no strength');
});

test('the composite: water goes toward the highlight or darker, the red liquid toward its glow and keeps more light under a grade; dry ground is untouched', () => {
  const index = new Uint8Array(SIZE).fill(1), mask = new Uint8Array(SIZE), L = createLayers(SIZE), palette = new Uint8ClampedArray(1024); // @math 256 colours of four bytes
  palette.set([100, 100, 100, 255], 4); // @math colour 1, grey
  L.kind.fill(KIND.floor); L.depth.fill(100); // @math near ground
  const lit = 150 * W, red = lit + 1, dark = lit + 2, dry = lit + 3, still = lit + 4; // @math pixels of each kind
  L.wet[lit] = LIQUID.water; L.wave[lit] = 0.5; L.wet[red] = LIQUID.red; L.wave[red] = 0.5; L.wet[dark] = LIQUID.water; L.wave[dark] = -0.5; L.wet[still] = LIQUID.red; L.wave[still] = 0; // @math half way
  const water = { sky: [0, 0, 0], highlight: [200, 200, 200], glow: [200, 0, 0], reflect: new Float32Array(2000) }; // @math colours for the test; no mirror near by
  const run = effects => composite(new Uint8ClampedArray(SIZE * 4), { index, mask, L, palette, width: W, effects: { shadow: 0, fog: null, cap: 255, ...effects } }); // @math four bytes a colour
  const out = run({ water }), rgb = (o, i) => [...o.subarray(i * 4, i * 4 + 3)];
  assert.deepEqual(rgb(out, lit), [150, 150, 150]); assert.deepEqual(rgb(out, red), [150, 50, 50]); assert.deepEqual(rgb(out, dark), [50, 50, 50]); assert.deepEqual(rgb(out, dry), [100, 100, 100]); // @math half way to each
  assert.deepEqual(rgb(run({}), lit), [100, 100, 100], 'without the water effect the layer is not read');
  const graded = run({ water, grade: { ...gradeOf('night', 1), trackSky: true } });
  assert.ok(rgb(graded, still).reduce((s, v) => s + v) > rgb(graded, dry).reduce((s, v) => s + v), 'the red liquid glows at night');
});

test('the floor with the liquid hook is the same picture, and marks exactly the liquid samples', () => {
  const trig = new DataView(new ArrayBuffer(1920 * 8)); // @math the TRIG table's entries
  for (let h = 0; h < 1920; h++) { trig.setInt32(h * 8, Math.round(Math.cos((2 * Math.PI * h) / 1920) * 65536), true); trig.setInt32(h * 8 + 4, Math.round(Math.sin((2 * Math.PI * h) / 1920) * 65536), true); } // @math 16.16 sines and cosines
  const ndist = new DataView(new ArrayBuffer(320 * 70 * 4)); // @math the NDIST table
  for (let c = 0; c < 320; c++) for (let k = 0; k < 70; k++) ndist.setUint32((c * 70 + k) * 4, 110 + k * k + (c % 9), true); // @math growing distances
  const random = createRandom(7), w = { trig, ndist, tiles: Uint8Array.from({ length: 4096 }, () => Math.floor(random() * 108)), sheets: [0, 1].map(() => Uint8Array.from({ length: 54 * 1024 }, () => Math.floor(random() * 256))) }; // @math a random map and sheets
  const texels = Uint8Array.from({ length: 108 * 1024 }, () => (random() < 0.3 ? 1 + Math.floor(random() * 2) : 0)); // @math some texels water or red
  for (const mode of [1, 2, 3]) {
    const camera = { x: 1500.25, y: 2700.75, heading: 777 }, L = createLayers(SIZE), calls = []; // @math any camera
    const a = drawFloor(w, camera, mode, new Uint8Array(SIZE)), b = drawFloor(w, camera, mode, new Uint8Array(SIZE), { texels, wet: L.wet, wave: L.wave, shade: (kind, x, y, c, k) => { calls.push(kind); return kind / 4; } }); // @math a light that tells the kinds apart
    assert.deepEqual(b, a, `mode ${mode}`);
    assert.ok(calls.length > 0 && calls.every(k => k === 1 || k === 2));
    for (let i = 0; i < SIZE; i++) if (L.wet[i]) assert.equal(L.wave[i], L.wet[i] / 4); // @math the light of its kind
    assert.deepEqual(L.wet, drawFloor({ ...w, sheets: [texels.subarray(0, 54 * 1024), texels.subarray(54 * 1024)] }, camera, mode, new Uint8Array(SIZE)), `mode ${mode}: every pixel the kind of the texel it shows`); // @math the kinds drawn as a floor of their own: 54 tiles a sheet
    assert.ok(L.wet.subarray(0, 130 * W).every(v => v === 0), 'nothing above the floor'); // @math the sky and the strip
  }
});

test('the water is a look switch: turning it on or off keeps the scene', () => {
  assert.ok(LOOK_EFFECTS.includes('water') && PRESETS.enhanced.water && !PRESETS.original.water);
  const m = new Map(), enh = createEnhancer({ storage: { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) } });
  let resets = 0; const reset = enh.reset; enh.reset = () => { resets++; reset(); };
  enh.configure({ ...PRESETS.original, smooth: true }); resets = 0;
  enh.configure({ ...PRESETS.original, smooth: true, water: true }); assert.equal(resets, 0);
  enh.configure({ ...PRESETS.original, smooth: true }); assert.equal(resets, 0);
});
