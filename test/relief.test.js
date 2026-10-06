// The relief of the track lighting (docs/enhancements.md): the ground's and the pictures' height maps, their light under the sun, the
// player's own maps and how the race finds them. Synthetic data only; real tracks are checked by scripts/check-enhance.js and in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundRelief, groundLight, sunVector, screenSun, pictureLight, pictureHeights, tilesToSheet, sheetToTiles, shadeByHeights, paletteLuma } from '../src/enhance/relief.js';
import { createReliefProvider, normalizeRecord } from '../src/enhance/relief-store.js';
import { normalizeAtmosphere } from '../src/enhance/atmosphere.js';
import { RELIEF, ATMOSPHERE } from '../src/enhance/config.js';
import { composite } from '../src/enhance/composite.js';
import { createLayers } from '../src/enhance/scene.js';
import { KIND } from '../src/enhance/project.js';
import { models } from '../src/enhance/models.js';

const W = 320, H = 200, SIZE = W * H; // @math the screen
const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// A synthetic track: tile 1 half wall (its mask's right half), tile 2 water, the others plain; the palette grey by index.
function world() {
  const F = models().floor, palette = Uint8Array.from({ length: 768 }, (_, i) => Math.floor(i / 3) >> 2); // @math 256 greys of three 6-bit components
  const sin = Array.from({ length: 108 }, (_, id) => { const kept = new Uint8Array(8), dv = new DataView(kept.buffer); dv.setUint32(0, id === 2 ? 6 : 0, true); dv.setUint32(4, id === 1 ? 3 : id === 2 ? 6 : 0, true); return { kept }; }); // @math 108 tiles; tile 1's mask 1 is the wall, tile 2 is water
  const sheets = [0, 1].map(() => new Uint8Array(54 * 1024).fill(128)), maskSheets = [0, 1].map(() => new Uint8Array(54 * 1024)); // @math two sheets of 54 tiles, a mid grey
  for (let t = 0; t < 1024; t++) if ((t & 31) >= 16) maskSheets[0][1024 + t] = 1; // @math tile 1: the right half is mask 1
  sheets[0].fill(40, 2 * 1024, 3 * 1024); // @math tile 2 dark blue-ish (a liquid by the game's surface)
  return { palette, sin, sheets, maskSheets, tiles: Uint8Array.from({ length: 4096 }, (_, i) => i % 3), gam: { tilesets: ['f1.pcx', 'f2.pcx'] }, F }; // @math the map's cells
}

test('a relief level in the atmosphere, 0 none; the default lights the relief a little', () => {
  assert.equal(normalizeAtmosphere({ relief: 2 }).relief, 1);
  assert.equal(normalizeAtmosphere({ relief: [1] }).relief, ATMOSPHERE.defaults.relief);
  assert.ok(ATMOSPHERE.defaults.relief > 0 && ATMOSPHERE.defaults.relief <= 1);
});

test('the ground\'s generated heights: brightness, the wall raised, liquids flat; a map of the player\'s replaces a sheet\'s; slopes and occlusion', () => {
  const w = world(), g = groundRelief(w), T = 1024, luma = paletteLuma(w)[128]; // @math tile bytes; the sheets' grey
  assert.equal(groundRelief(w), g, 'made once');
  assert.ok(close(g.height[0], luma * RELIEF.detail)); // a plain texel
  assert.ok(close(g.height[T + 20], luma * RELIEF.detail + RELIEF.wall) && close(g.height[T + 5], luma * RELIEF.detail)); // @math tile 1: the wall half, the plain half
  assert.equal(g.height[2 * T + 7], RELIEF.liquid); // @math the water lies flat
  assert.ok(g.gx[T + 16] > 0 && close(g.gx[T + 5], 0), 'the wall\'s edge rises to the right; a plain texel is flat'); // @math the edge at column 16 of tile 1
  assert.ok(g.occlusion[T + 15] >= 0 && close(g.occlusion[0], 0));
  assert.equal(g.flat[2 * T + 7], 1); assert.equal(g.gx[2 * T + 7], 0); // @math the water keeps its light: no slope
  const own = { id: 'mine', heights: new Uint8Array(54 * T).fill(255) }, mine = groundRelief(w, name => (name === 'A_F1.PCX' ? own : null)); // @math the first sheet's map: all high
  assert.notEqual(mine, g); assert.equal(mine.height[T + 5], 1); assert.ok(close(mine.height[54 * T + 5], g.height[54 * T + 5]), 'the second sheet keeps its generated map'); // @math a texel of each sheet
  for (const v of g.height) assert.ok(v >= 0 && v <= 1, 'heights within 0 and 1');
  // a wall that ends where its tile does: tile 1 (the wall half at its right) beside tile 2 on the map; the slope at the tile's edge comes from across it
  const edge = world(); edge.tiles.fill(0); edge.tiles[0] = 1; edge.tiles[1] = 0; // @math map cell (0, 0) the wall tile, cell (1, 0) a plain one
  for (let t = 0; t < 1024; t++) edge.maskSheets[0][1024 + t] = (t & 31) >= 16 ? 1 : 0; // @math the wall in tile 1's right half, up to its right edge
  const eg = groundRelief(edge), sun2 = [-Math.SQRT1_2, 0, Math.SQRT1_2], lightAt = groundLight(edge, eg, { sun: sun2, strength: 1 }); // @math the sun toward -x: the wall's far side (+x) is in its shade
  const at = T + 31, x = 1024 + 31, y = 1024 + 10; // @math tile 1's last column; map cell (0, 0) is at world 1024
  assert.ok(close(eg.gx[at], 0), 'inside the tile the edge texel sees no slope'); assert.ok(lightAt(at, x, y) < 1, 'across the tile edge the wall falls toward the plain tile, away from the sun'); // @math a texel of the wall's last column
});

test('the ground\'s light: a flat ground is as it was, a slope toward the sun lighter and one away darker, nothing at no strength, within the range', () => {
  const ground = { height: new Float32Array(5), gx: Float32Array.from([0, -1, 1, 50, 9]), gy: new Float32Array(5), occlusion: new Float32Array(5), flat: Uint8Array.from([0, 0, 0, 0, 1]) }, sun = [Math.SQRT1_2, 0, Math.SQRT1_2]; // @math five texels: flat, rising toward -x, rising toward +x, a cliff, a liquid; the sun at 45 degrees toward +x
  const w = { tiles: new Uint8Array(4096) }, light = at => groundLight(w, ground, { sun, strength: 1 })(at, 10, 10); // @math a texel inside its tile, where the kept slopes are used
  assert.ok(close(light(0), 1)); // the flat ground
  assert.ok(light(2) < 1 && light(1) > 1, 'the slope that rises toward the sun faces away from it'); // @math gx > 0 rises toward +x: its normal leans to -x
  assert.ok(light(3) >= RELIEF.range[0] && light(3) <= RELIEF.range[1]);
  assert.equal(light(4), 1, 'a liquid keeps its light'); // @math the liquid texel
  assert.ok(close(groundLight(w, ground, { sun, strength: 0 })(2, 10, 10), 1)); // @math no strength
  const v = sunVector({ trig: trigTable() }, 0.25, 1); // @math a quarter turn, a shadow as long as the height
  assert.ok(close(Math.hypot(...v), 1, 1e-9) && close(v[2], Math.SQRT1_2, 1e-9), 'a unit vector 45 degrees up');
  const s = screenSun({ f: 1, l: 0 }, 1); // the shadows fall straight ahead: the sun behind the camera, lighting the pictures' faces
  assert.ok(s[2] > 0 && s[1] < 0 && close(s[0], 0));
});

// A TRIG table of 1920 headings (16.16 cosines and sines), as the floor's.
function trigTable() {
  const trig = new DataView(new ArrayBuffer(1920 * 8)); // @math the TRIG entries
  for (let h = 0; h < 1920; h++) { trig.setInt32(h * 8, Math.round(Math.cos((2 * Math.PI * h) / 1920) * 65536), true); trig.setInt32(h * 8 + 4, Math.round(Math.sin((2 * Math.PI * h) / 1920) * 65536), true); } // @math 16.16
  return trig;
}

test('a picture\'s light: its side toward the sun lighter, the other darker, the middle as it was; the player\'s map is read by source byte', () => {
  const out = new Float32Array(SIZE).fill(1), fb = new Uint8Array(SIZE), drawn = [], sources = []; // the drawn pixels of a disc of radius 8 at (100, 100)
  for (let y = 92; y <= 108; y++) for (let x = 92; x <= 108; x++) if ((x - 100) ** 2 + (y - 100) ** 2 <= 64) { const o = y * W + x; drawn.push(o); sources.push(drawn.length - 1); fb[o] = 1; } // @math the disc
  const luma = new Float32Array(256), args = { drawn: Int32Array.from(drawn), sources: Int32Array.from(sources), count: drawn.length, fb, width: W, luma, sun: [Math.SQRT1_2, 0, Math.SQRT1_2], strength: 1 }; // @math the sun to the right, 45 degrees toward the viewer
  pictureLight(out, args);
  assert.ok(out[100 * W + 107] > 1 && out[100 * W + 93] < 1, 'lit on the right, shaded on the left'); // @math near the right and left edges
  assert.ok(close(out[100 * W + 100], 1, 0.02), 'the middle faces the viewer'); // @math the centre
  for (const o of drawn) assert.ok(out[o] >= RELIEF.range[0] && out[o] <= RELIEF.range[1]);
  const flat = new Float32Array(SIZE).fill(1); pictureLight(flat, { ...args, heights: () => 128 }); // @math a flat map of the player's
  for (const o of drawn) assert.ok(close(flat[o], 1, 1e-6) || drawn.some(p => Math.abs(p - o) === 1 || Math.abs(p - o) === W), 'flat inside');
  const cut = [], cutSrc = []; for (let y = 90; y <= 110; y++) for (let x = 0; x <= 12; x++) { cut.push(y * W + x); cutSrc.push(cut.length - 1); } // @math a block cut by the screen's left edge
  const edgeOut = new Float32Array(SIZE).fill(1); pictureLight(edgeOut, { ...args, drawn: Int32Array.from(cut), sources: Int32Array.from(cutSrc), count: cut.length, heights: () => 200 }); // @math a flat map
  assert.ok(close(edgeOut[100 * W], 1, 1e-6), 'no rim where the screen cuts the picture'); assert.ok(edgeOut[100 * W + 12] !== 1, 'its own edge still has one'); // @math the cut column and the picture's right edge
});

test('the generated map of sprite frames: transparent pixels 0, higher toward the middle, in the frames\' own byte order', () => {
  const w = 6, h = 4, bytes = new Uint8Array(2 * w * h).fill(5); // @math two frames of 6 x 4, all opaque
  bytes[0] = 0; // @math the first frame's top left pixel transparent (column-major byte 0)
  const luma = new Float32Array(256), col = pictureHeights(bytes, { width: w, height: h, frames: 2, columnMajor: true }, luma), row = pictureHeights(bytes, { width: w, height: h, frames: 2, columnMajor: false }, luma); // @math both pixel orders
  assert.equal(col[0], 0); assert.ok(col[2 * h + 2] > col[1], 'the middle stands higher than an edge'); // @math column 2, row 2 against column 0, row 1
  assert.equal(col.length, 2 * w * h); assert.ok(row[0] === 0 && row[w + 1] > 0); // @math row-major: row 1, column 1
  const tiles = Uint8Array.from({ length: 54 * 1024 }, (_, i) => i % 251); // @math 54 tiles of any heights
  assert.deepEqual(sheetToTiles(tilesToSheet(tiles, 320, 200), 320), tiles); // @math the sheet's picture and back
  const shaded = shadeByHeights(new Uint8ClampedArray(4 * 4 * 4).fill(200), new Uint8Array(16), 4, 4, 1); // @math flat: as lit as a flat surface
  assert.ok(shaded.every(v => v === 200));
});

test('the player\'s maps: records checked, tile sheets by name, sprite frames by where their bytes lie in the archive', () => {
  assert.equal(normalizeRecord({ member: 'x', kind: 'sprites', heights: new Uint8Array(3), width: 2, height: 2, offset: 0, frames: 1 }), null, 'the heights must fill the frames');
  assert.equal(normalizeRecord({ member: 'x', kind: 'paint', heights: new Uint8Array(4) }), null);
  assert.equal(normalizeRecord({ member: 'a_f1.pcx', kind: 'tiles', heights: new Uint8Array(100) }), null, 'a tile sheet\'s map has every texel of its tiles'); // @math too few
  const sprite = new Uint8Array(4 * 6).fill(1), dat = syntheticDat([{ name: 'A.SP', data: new Uint8Array(10) }, { name: 'CARS.SP', data: sprite }]); // @math a member before it; four frames of 2 x 3
  const records = [{ member: 'a_f1.pcx', kind: 'tiles', heights: new Uint8Array(54 * 1024), saved: 1 }, { member: 'cars.sp', kind: 'sprites', heights: Uint8Array.from({ length: 24 }, (_, i) => i), width: 2, height: 3, offset: 0, frames: 4, columnMajor: true, saved: 2 }]; // @math a tile sheet and four frames of 2 x 3
  const p = createReliefProvider(() => dat).set(records);
  assert.equal(p.size, 2);
  assert.ok(p.tiles('A_F1.PCX') && p.tiles('A_F2.PCX') === null);
  const carsAt = dat.length - 24, frame2 = dat.subarray(carsAt + 2 * 6, carsAt + 3 * 6); // @math the third frame of CARS.SP
  assert.equal(p.frame(frame2)(0), 12); assert.equal(p.frame(frame2)(5), 17); // @math its bytes' heights
  assert.equal(p.frame(dat.subarray(carsAt + 1, carsAt + 7)), null, 'not on a frame boundary'); // @math a misaligned view
  assert.equal(p.frame(new Uint8Array(6)), null, 'bytes from elsewhere'); // @math a frame's size
  const longer = createReliefProvider(() => dat).set([{ ...records[1], frames: 5, heights: Uint8Array.from({ length: 30 }, (_, i) => i) }]); // @math a record with a frame more than the member holds
  assert.equal(longer.frame(dat.subarray(carsAt + 3 * 6, carsAt + 4 * 6))(0), 18); assert.equal(longer.frame(dat.subarray(4, 10)), null, 'never past the member'); // @math the last real frame; six bytes elsewhere in the archive
});

// An archive of the game's layout: a count, 22-byte entries (a NUL-terminated name, the size at +14, the offset less 2 at +18), the data.
function syntheticDat(entries) {
  const dir = 2 + entries.length * 22, b = new Uint8Array(dir + entries.reduce((n, e) => n + e.data.length, 0)), dv = new DataView(b.buffer); // @math the count and the entries
  dv.setInt16(0, entries.length, true);
  let at = dir;
  entries.forEach((e, i) => { const o = 2 + i * 22; b.set([...e.name].map(c => c.charCodeAt(0)), o); dv.setUint32(o + 14, e.data.length, true); dv.setUint32(o + 18, at - 2, true); b.set(e.data, at); at += e.data.length; }); // @math the entry's fields
  return b;
}

test('the composite: the relief lights the ground and the pictures, never the sky nor the overlays, within the fade\'s cap; off reads nothing', () => {
  const index = new Uint8Array(SIZE).fill(1), mask = new Uint8Array(SIZE), L = createLayers(SIZE), palette = new Uint8ClampedArray(1024); // @math 256 colours of four bytes
  palette.set([100, 100, 100, 255], 4); // @math colour 1
  for (let i = 0; i < SIZE; i++) L.kind[i] = i < 110 * W ? KIND.sky : i % 2 ? KIND.floor : KIND.sprite; // @math the sky, then floor and pictures
  L.relief.fill(1.4); mask[150 * W + 4] = 1; // @math everything lit; an overlay pixel
  const run = effects => composite(new Uint8ClampedArray(SIZE * 4), { index, mask, L, palette, width: W, effects: { shadow: 0, fog: null, cap: 255, ...effects } }); // @math four bytes a colour
  const on = run({ relief: true }), off = run({}), capped = run({ relief: true, cap: 120 }); // @math a demo's fade
  const at = (o, i) => o[i * 4]; // @math the red component
  assert.equal(at(on, 150 * W + 1), 140); assert.equal(at(on, 150 * W + 2), 140); assert.equal(at(on, 10), 100); assert.equal(at(on, 150 * W + 4), 100); // @math floor and picture lit, sky and overlay not
  assert.equal(at(off, 150 * W + 1), 100); assert.equal(at(capped, 150 * W + 1), 120); // @math off; the cap
});
