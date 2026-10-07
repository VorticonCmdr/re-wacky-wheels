// Stage 4's 2x (docs/enhancements.md, Stage 4 as built, M6) on synthetic pictures, the pictures' side: a record's whole picture at its finer
// place, cut per pixel, is the reference window s times over at a whole place (its footprint and silhouette those of what the screen shows);
// the INF's bytes at its samples at any place; the reference look's shadows from the picture's reference samples are the 1x shadows; a split
// viewer's first row; the running-sum blur; the layers of a kept frame with an overlay over them. No game files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blitAt, blitFlatAt, classMap, shapeOf } from '../src/enhance/blit.js';
import { createLayers, blitLayers, blitFlatLayers, placeAt } from '../src/enhance/scene.js';
import { casterOf, castOf, castShadow, sunDirection, blurCast, boxBlurCast } from '../src/enhance/shadows.js';
import { projectFine, roundWord } from '../src/enhance/project.js';
import { geometryOf, IDENTITY } from '../src/enhance/geometry.js';
import { createEnhancer } from '../src/enhance/index.js';
import { SUN } from '../src/enhance/config.js';
import { pictureLight } from '../src/enhance/relief.js';
import { models } from '../src/enhance/models.js';
import { createRandom } from '../src/enhance/particles.js';
import { clipPicture } from '../src/game/objects.js';
import { buildRowTable } from '../src/game/view.js';

const F = models().floor, SIZE = F.width * F.height;

// An .INF shape of ten pictures over a W0 x H0 column-major frame (class 0 the frame itself, the others every few columns and rows) and a frame
// with transparent bytes.
function infPicture(w, h, src) {
  const deltas = new Int32Array((h + 1) * w);
  for (let i = 0; i < w; i++) { deltas[i * (h + 1)] = src(i, 0); for (let j = 0; j < h; j++) deltas[i * (h + 1) + 1 + j] = j + 1 < h ? src(i, j + 1) - src(i, j) : 0; }
  return { w, h, deltas };
}
const shapeOfSize = (W0, H0) => Array.from({ length: 10 }, (_, k) => { const w = Math.max(W0 - 3 * k, 2), h = Math.max(H0 - 2 * k, 2); return infPicture(w, h, (i, j) => Math.floor((i * W0) / w) * H0 + Math.floor((j * H0) / h)); }); // @math the size classes shrink
const random = createRandom(17), shape = shapeOfSize(38, 28), world = { carShape: shape }, frame = Uint8Array.from({ length: 38 * 28 }, () => (random() < 0.3 ? 0 : 1 + Math.floor(random() * 255))); // @math a car's frame; about a third transparent
const PLACES = [[160, 150], [-7, 120], [-30, 199], [315, 60], [300, 230], [40, -5], [10, 20], [319, 205]]; // inside; cut on the left, the right, the bottom; above the top
const whole = rec => ({ ...rec, left: rec.left - rec.firstColumn, firstColumn: 0, width: rec.picture.w, height: rec.picture.h }); // the record's whole picture (scene.js placeAt's window)

test('the whole picture at s times a whole place, cut per pixel, is the reference window s times over: its pixels, layers, footprint and silhouette', () => {
  let compared = 0;
  for (const s of [2, 3]) for (const picture of shape) for (const [column, bottom] of PLACES) { // @math the scales of the tests
    const clip = clipPicture({ column, bottom }, picture);
    if (!clip) continue;
    const G = geometryOf({ s, m: 0 }), rec = { ...clip, picture, frame, distance: 321.5 }, all = whole(rec), size = G.W * G.H, label = `${s}x ${picture.w} x ${picture.h} at ${column},${bottom}`; // @math a distance
    const fa = new Uint8Array(size), fb = new Uint8Array(size), La = createLayers(size), Lb = createLayers(size);
    const a = blitAt(fa, La, rec, 0.2, G, { world }), b = blitAt(fb, Lb, all, 0.2, G, { world, at: { x: s * all.left, y: s * all.top } }); // @math the footprint's band
    assert.ok(Buffer.from(fa).equals(Buffer.from(fb)), `${label}: the pixels`); assert.deepEqual(Lb.kind, La.kind); assert.deepEqual(Lb.depth, La.depth);
    if (!a) { assert.equal(b, null, label); continue; }
    assert.deepEqual(b.foot, a.foot, `${label}: the footprint`);
    for (let I = 0; I < all.width * s; I++) { const J = I - rec.firstColumn * s, inside = J >= 0 && J < rec.width * s; assert.equal(b.cols.top[I], inside ? a.cols.top[J] : -1, `${label}: the silhouette's column ${I}`); assert.equal(b.cols.bottom[I], inside ? a.cols.bottom[J] : -1); }
    compared++;
  }
  assert.ok(compared > 80);
});

test('at any place, a fine one included, the picture\'s samples are the INF\'s bytes; nothing is written above a split viewer\'s first row, and its footprint stays', () => {
  for (const s of [2, 3]) for (const picture of shape.slice(0, 5)) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [s - 1, s - 1]]) { // @math the first five classes; whole and fine places
    const G = geometryOf({ s, m: 0 }), rec = whole({ ...clipPicture({ column: 160, bottom: 150 }, picture), picture, frame, distance: 99 }), at = { x: s * rec.left + dx, y: s * rec.top + dy }, out = new Uint8Array(G.W * G.H); // @math the middle of the screen; a distance
    blitAt(out, createLayers(G.W * G.H), rec, 0.2, G, { world, at });
    const map = classMap(picture, s, shapeOf(world, picture));
    for (let i = 0; i < picture.w; i++) for (let j = 0; j < picture.h; j++) { const v = frame[map.src[i * picture.h + j]]; if (v !== 0 && out[(at.y + s * j) * G.W + at.x + s * i] !== v) assert.fail(`${s}x at +${dx},+${dy}: the sample ${i},${j}`); }
  }
  const G = geometryOf({ s: 2, m: 0 }), picture = shape[0], rec = whole({ ...clipPicture({ column: 100, bottom: 112 }, picture), picture, frame, distance: 50 }), from = 2 * 100, at = { x: 2 * rec.left, y: 2 * rec.top }; // @math a picture across the split screen's first row (100, at 2x 200)
  const all = new Uint8Array(G.W * G.H), cut = new Uint8Array(G.W * G.H), flags = new Uint8Array(G.H);
  const a = blitAt(all, createLayers(G.W * G.H), rec, 0.2, G, { world, at }), b = blitAt(cut, createLayers(G.W * G.H), rec, 0.2, G, { world, at, from, rows: flags });
  assert.ok(all.subarray(0, from * G.W).some(v => v !== 0) && cut.subarray(0, from * G.W).every(v => v === 0), 'nothing above the first row');
  assert.ok(Buffer.from(all.subarray(from * G.W)).equals(Buffer.from(cut.subarray(from * G.W))), 'the rows below as without it');
  assert.deepEqual(b, a, 'the footprint and the silhouette of the whole picture'); assert.ok(flags.subarray(0, from).every(v => v === 0));
  const d = { x: 150, y: 95, width: 10, height: 12, bytes: frame.subarray(0, 120) }, flat = new Uint8Array(G.W * G.H), Lf = createLayers(G.W * G.H); // @math an after-blit across the row
  blitFlatAt(flat, Lf, d, 50, G, false, null, from); // @math the distance
  assert.ok(flat.subarray(0, from * G.W).every(v => v === 0) && flat.subarray(from * G.W).some(v => v !== 0));
  const fa = new Uint8Array(SIZE), fb = new Uint8Array(SIZE), La = createLayers(SIZE), Lb = createLayers(SIZE);
  blitFlatLayers(fa, La, d, 50, F.width, F.height, true); blitFlatAt(fb, Lb, d, 50, IDENTITY, true, null, 0); // @math the distance
  assert.deepEqual(fb, fa, 'at the identity with no first row: blitFlatLayers');
});

test('a split viewer\'s picture across its first row is lit as a whole, as the 1x split screen lights it before the cut: no rim at that row', () => {
  const G = geometryOf({ s: 2, m: 0 }), size = G.W * G.H, from = 2 * 100, luma = Float32Array.from({ length: 256 }, (_, i) => i / 255), sun = [0.5, -0.6, 0.62]; // @math 2x; the split screen's first row (100, at 2x 200); any brightness ramp; a sun from the right, above, toward the viewer
  const collect = () => ({ drawn: new Int32Array(size), sources: new Int32Array(size), count: 0 });
  for (const [column, bottom] of [[100, 112], [60, 104], [200, 118]]) for (const picture of shape.slice(0, 3)) { // @math pictures across the row: about half, most and a third of them above it; the first three classes
    const rec = whole({ ...clipPicture({ column, bottom }, picture), picture, frame, distance: 50 }), at = { x: 2 * rec.left, y: 2 * rec.top }, label = `${picture.w} x ${picture.h} at ${column},${bottom}`; // @math a distance
    const all = new Uint8Array(size), cut = new Uint8Array(size).fill(7, 0, from * G.W), ca = collect(), cb = collect(); // the viewer's rows above its first hold the last frame's pixels (never cleared there)
    blitAt(all, createLayers(size), rec, 0.2, G, { world, at, collect: ca }); blitAt(cut, createLayers(size), rec, 0.2, G, { world, at, collect: cb, from });
    assert.ok(cut.subarray(0, from * G.W).every(v => v === 7), `${label}: nothing written above the first row`); // @math the stale index
    const la = new Float32Array(size).fill(1), lb = new Float32Array(size).fill(1), light = (out, c, fb) => pictureLight(out, { drawn: c.drawn, sources: c.sources, count: c.count, fb, frame, width: G.W, luma, sun, strength: 1, scale: 2 }); // @math 2x
    light(la, ca, all); light(lb, cb, cut);
    let below = 0;
    for (let n = 0; n < ca.count; n++) { const o = ca.drawn[n]; if (o >= from * G.W) { below++; assert.equal(lb[o], la[o], `${label}: the light at ${o % G.W},${Math.floor(o / G.W)}`); } }
    assert.ok(below > 0 && below < ca.count && [...la].some(v => v !== 1), `${label}: a lit picture across the row`);
  }
});

// The tables a projection needs: TRIG (16.16 cosines and sines), VIEW (about 2^14 cos) and the row table.
function projectionWorld() {
  const trig = new DataView(new ArrayBuffer(F.wrap * F.trigEntryBytes)), view = new DataView(new ArrayBuffer(F.columns * 4)); // @math dwords
  for (let h = 0; h < F.wrap; h++) { trig.setInt32(h * 8, Math.round(Math.cos((2 * Math.PI * h) / F.wrap) * 65536), true); trig.setInt32(h * 8 + 4, Math.round(Math.sin((2 * Math.PI * h) / F.wrap) * 65536), true); } // @math 16.16
  for (let c = 0; c < F.columns; c++) view.setUint32(c * 4, Math.round(16384 * Math.cos(((c - 160) / 320) * 1.2)), true); // @math about 2^14 cos of the column's angle
  return { trig, view, rows: buildRowTable() };
}

test('the reference look\'s shadows: from the picture\'s reference samples at s times a whole place, the 1x contact shadow and sun cast themselves', () => {
  const w = projectionWorld(), P = { car: {}, fx: {}, ai: { racers: [] } }, opts = { shadows: true, sceneryShadows: true }, sun = sunDirection(w, 0.3, 0); // @math a sun from a third of the turn
  let cast = 0;
  for (const s of [2, 3]) for (const picture of shape.slice(0, 6)) for (const [column, bottom, type] of [[160, 170, 1], [-6, 150, -1], [300, 199, 1], [120, 140, -1]]) { // @math the first six classes; a racer and objects, cut on either side and at the bottom
    const clip = clipPicture({ column, bottom }, picture), G = geometryOf({ s, m: 0 }), rec = { ...clip, picture, frame, distance: 140 + 30 * picture.h / 28, type, racer: 2, object: type === 1 ? -1 : 0 }, all = whole(rec), label = `${s}x ${picture.w} x ${picture.h} at ${column},${bottom}`; // @math a distance by the size
    const one = blitLayers(new Uint8Array(SIZE), createLayers(SIZE), rec, 0.2, F.width, F.height), at = { x: s * all.left, y: s * all.top }; // @math the band
    const two = blitAt(new Uint8Array(G.W * G.H), createLayers(G.W * G.H), all, 0.2, G, { world, at, sampled: true }), grid = { x: at.x / s, y: at.y / s, u: 1, m: 0 };
    assert.deepEqual(two.sample.foot, one.foot, `${label}: the footprint on the reference grid`);
    assert.deepEqual(casterOf(all, P, two.sample.foot, 188, opts, grid), casterOf(rec, P, one.foot, 188, opts), `${label}: the contact shadow`); // @math the own car's ground row (unused here)
    const L1 = createLayers(SIZE), L2 = createLayers(SIZE), b1 = { x0: F.width, x1: -1, y0: F.height, y1: -1 }, b2 = { ...b1 };
    castShadow(L1, castOf(rec, P, one, 188), w, sun, F.width, F.height, b1); castShadow(L2, castOf(all, P, two.sample, 188, grid), w, sun, F.width, F.height, b2); // @math the ground row
    blurCast(L1, b1, F.width, F.height, L1.scratch); blurCast(L2, b2, F.width, F.height, L2.scratch);
    assert.deepEqual(L2.cast, L1.cast, `${label}: the sun cast`); cast += L1.cast.some(v => v > 0) ? 1 : 0;
  }
  assert.ok(cast > 20, 'the casts were not empty');
});

test('a record\'s finer place: the whole picture at s times its whole place plus the fine shift rounded to output pixels, within half an output pixel', () => {
  const w = projectionWorld(), picture = shape[2], camI = { x: 2048, y: 2048, heading: 300 }, camF = { x: 2048.4, y: 2047.3, heading: 300.5 }, a = { x: 2100.6, y: 2190.2 }; // @math a camera, its fine blend and a racer's point
  const i = projectFine(w, camI, roundWord(a.x), roundWord(a.y)), f = projectFine(w, camF, a.x, a.y), rec = { ...clipPicture({ column: Math.round(i.column), bottom: Math.round(i.bottom) }, picture), picture, frame, distance: i.distance };
  for (const s of [1, 2, 3]) for (const m of [0, 53]) { // @math the scales; the margin of 4 BY 3
    const G = geometryOf({ s, m }), placed = placeAt(rec, w, camF, camI, a, G), left = rec.left - rec.firstColumn;
    assert.deepEqual([placed.firstColumn, placed.width, placed.height, placed.left], [0, picture.w, picture.h, left], 'the whole picture');
    assert.ok(Math.abs(placed.place.x - s * (left + m + f.column - i.column)) <= 0.5 && Math.abs(placed.place.y - s * (rec.top + f.bottom - i.bottom)) <= 0.5, `${s}x margin ${m}: within half an output pixel of the fine place`); // @math half a pixel
    assert.deepEqual(placeAt(rec, w, camF, camI, null, G).place, { x: s * (left + m), y: s * rec.top }, 'no point (the own car, a frame at the tick\'s camera): s times the whole place');
  }
});

test('the running-sum blur of the full look is blurCast\'s at SUN.blur x s, within 1e-6', () => {
  const r = createRandom(8);
  for (const s of [2, 3]) {
    const G = geometryOf({ s, m: 0 }), A = createLayers(G.W * G.H), B = createLayers(G.W * G.H), box = { x0: 40, x1: G.W - 30, y0: 9, y1: G.H - 1 }; // @math a box near the edges
    for (let o = 0; o < A.cast.length; o++) A.cast[o] = r() < 0.15 ? r() : 0; // @math patches
    B.cast.set(A.cast);
    blurCast(A, box, G.W, G.H, A.scratch, SUN.blur * s); boxBlurCast(B, box, G.W, G.H, B.scratch, SUN.blur * s);
    let worst = 0; for (let o = 0; o < A.cast.length; o++) worst = Math.max(worst, Math.abs(A.cast[o] - B.cast[o]));
    assert.ok(worst < 1e-6, `${s}x: ${worst}`); // @math the tolerance
  }
});

test('an overlay over a kept frame above 1x: in the HUD layer over the frame\'s own HUD, or stamped as s x s blocks; the canvas as before', () => {
  const memory = new Map(), enh = createEnhancer({ storage: { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) } });
  const palette = new Uint8ClampedArray(1024); palette.set([10, 20, 30, 255], 4 * 7); palette.set([200, 100, 50, 255], 4 * 9); // @math 256 colours; the overlay's colour 9
  const world = new Uint8ClampedArray(640 * 400 * 4).fill(40), hud = new Uint8ClampedArray(SIZE * 4); hud.set([1, 2, 3, 255], (5 * 320 + 6) * 4); // @math a 2x world; the frame's HUD has one pixel at 6,5
  const kept = { world: { data: world, w: 640, h: 400 }, hud: { data: hud, w: 320, h: 200 }, logical: { w: 320, h: 200 } }, index = new Uint8Array(SIZE).fill(7), base = new Uint8ClampedArray(SIZE * 4).fill(60); // @math the kept frame; the index under the overlay
  const overlay = fb => { for (let x = 100; x < 104; x++) fb[50 * 320 + x] = 9; }; // @math four pixels of row 50
  overlay(index);
  const out = new Uint8ClampedArray(SIZE * 4), layered = enh.drawOver({ out, base, index, palette, overlay, kept, hudLayer: true });
  assert.deepEqual([...out.subarray((50 * 320 + 100) * 4, (50 * 320 + 101) * 4)], [200, 100, 50, 255]); assert.equal(out[0], 60, 'the canvas: the overlay over the base'); // @math the overlay's colour; the base elsewhere
  assert.deepEqual([layered.world.w, layered.world.h, layered.hud.w], [640, 400, 320]); // @math the kept sizes
  assert.ok(Buffer.from(layered.world.data).equals(Buffer.from(world)), 'the world as it was');
  assert.deepEqual([...layered.hud.data.subarray((50 * 320 + 100) * 4, (50 * 320 + 101) * 4)], [200, 100, 50, 255]); assert.deepEqual([...layered.hud.data.subarray((5 * 320 + 6) * 4, (5 * 320 + 7) * 4)], [1, 2, 3, 255]); // @math the overlay and the frame's own HUD
  const stamped = enh.drawOver({ out, base, index, palette, overlay, kept, hudLayer: false });
  assert.equal(stamped.hud, null);
  const px = (x, y) => [...stamped.world.data.subarray((y * 640 + x) * 4, (y * 640 + x + 1) * 4)]; // @math the 2x world's pixel
  for (const [x, y] of [[200, 100], [201, 101], [207, 101]]) assert.deepEqual(px(x, y), [200, 100, 50, 255], `the overlay's block at ${x},${y}`); // @math 2 x 100, 2 x 50, and its corners
  assert.deepEqual(px(12, 10), [1, 2, 3, 255], 'the frame\'s HUD stamped with it'); assert.deepEqual(px(0, 0), [40, 40, 40, 40], 'the world elsewhere'); // @math 2 x 6, 2 x 5
  assert.equal(enh.keepLayers(), null, 'no frame drawn above 1x: nothing to keep');
  assert.equal(enh.drawOver({ out, base, index, palette, overlay }), out, 'without a kept frame: the canvas');
});
