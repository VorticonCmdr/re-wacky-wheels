// Stage 4's smooth sprite sizes (docs/enhancements.md, Stage 4 as built, M7) on synthetic tables and pictures: the size law between the
// game's classes (w(d_k) = w_k at the band middles, flat outside them, monotonic and continuous), the nearest and symmetric source maps and
// their list of 256, the floor's own rows of a depth (rowOfDepth: the floor's rows at its sample depths, continuous, strictly decreasing,
// linear in 1/d beyond both ends along the table's chord, the row table for a floor that has none), the standing row (the floor's row down
// to the row table's last row, that row beyond), the order (farthest first, records of one distance in the frame routine's queue whatever
// order they come in, a margin record by what it shows), the placement at the tick (the game's column, the standing row) and with a fine
// shift, the blit of a smooth picture and its reference samples, and the decals on the same rows (the contact shadow and the sun cast under
// the drawn picture, the projections' row law). No game files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smoothSize, smoothMap, smoothMapsKept, blitAt } from '../src/enhance/blit.js';
import { createLayers, blitLayers, placeSmooth, smoothOrder } from '../src/enhance/scene.js';
import { rowOfDepth, rowReport, standingRow, rowLaw, geometryOf, IDENTITY } from '../src/enhance/geometry.js';
import { casterOf, castOf, castShadow, sunDirection } from '../src/enhance/shadows.js';
import { projectAt, projectFine, fromCameraAt, rowAt, roundWord } from '../src/enhance/project.js';
import { SIZES, SHADOW } from '../src/enhance/config.js';
import { models } from '../src/enhance/models.js';
import { createRandom } from '../src/enhance/particles.js';
import { clipPicture } from '../src/game/objects.js';
import { buildRowTable } from '../src/game/view.js';

const F = models().floor, V = models().view, SIZE = F.width * F.height;

// An .INF shape of ten pictures over a W0 x H0 column-major frame (class 0 the frame itself, the others every few columns and rows), as
// test/stage4-blit.test.js builds them, and a frame with transparent bytes.
function infPicture(w, h, src) {
  const deltas = new Int32Array((h + 1) * w);
  for (let i = 0; i < w; i++) { deltas[i * (h + 1)] = src(i, 0); for (let j = 0; j < h; j++) deltas[i * (h + 1) + 1 + j] = j + 1 < h ? src(i, j + 1) - src(i, j) : 0; }
  return { w, h, deltas };
}
const shapeOfSize = (W0, H0) => Array.from({ length: 10 }, (_, k) => { const w = Math.max(W0 - 3 * k, 2), h = Math.max(H0 - 2 * k, 2); return infPicture(w, h, (i, j) => Math.floor((i * W0) / w) * H0 + Math.floor((j * H0) / h)); }); // @math the size classes shrink
const random = createRandom(23), shape = shapeOfSize(38, 28), frame = Uint8Array.from({ length: 38 * 28 }, () => (random() < 0.3 ? 0 : 1 + Math.floor(random() * 255))); // @math a car's frame; about a third transparent

// A world with the tables a projection and the floor's rows need: TRIG (16.16 cosines and sines), VIEW (2^14 cos of each column's angle,
// one TRIG entry a column), NDIST (a ground plane: about 9000 / ((78.25 - k) cos) for the step k, whole units) and the row table.
function floorWorld({ flat = false, viewZero = false } = {}) {
  const trig = new DataView(new ArrayBuffer(F.wrap * F.trigEntryBytes)), view = new DataView(new ArrayBuffer(F.columns * V.viewBytes)), ndist = new DataView(new ArrayBuffer(F.columns * F.groupDwords * F.ndistDwordBytes));
  for (let h = 0; h < F.wrap; h++) { trig.setInt32(h * F.trigEntryBytes, Math.round(Math.cos((2 * Math.PI * h) / F.wrap) * 2 ** 16), true); trig.setInt32(h * F.trigEntryBytes + 4, Math.round(Math.sin((2 * Math.PI * h) / F.wrap) * 2 ** 16), true); } // @math 16.16; the second dword
  for (let c = 0; c < F.columns; c++) {
    const cos = Math.cos(((c - V.center) * 2 * Math.PI) / F.wrap);
    view.setUint32(c * V.viewBytes, viewZero && c === V.center ? 0 : Math.round(2 ** V.viewShift * cos), true);
    for (let k = 0; k < F.steps; k++) ndist.setUint32((c * F.groupDwords + k) * F.ndistDwordBytes, flat && k > 30 && k < 34 ? Math.round(9000 / ((78.25 - 30) * cos)) : Math.round(9000 / ((78.25 - k) * cos)), true); // @math a ground plane seen from a camera's height; a run of equal depths when flat
  }
  return { trig, view, ndist, rows: buildRowTable(), carShape: shape, carFrames: { cars: frame } };
}
const depthAt = (w, k) => (w.ndist.getUint32((V.center * F.groupDwords + k) * F.ndistDwordBytes, true) * (w.view.getUint32(V.center * V.viewBytes, true) || 2 ** V.viewShift)) / 2 ** V.viewShift; // @math the VIEW word is a 2.14 fixed-point scale

test('the size law: each class\'s own size at the middle of its band, flat before the first and past the last, monotonic and continuous between', () => {
  for (let k = 0; k <= V.maxSize; k++) {
    const d = V.sizeBase + V.sizeStep * (k + 0.5); // @math the band's middle
    assert.deepEqual(smoothSize(shape, d), { w: shape[k].w, h: shape[k].h }, `the class ${k} at ${d}`);
  }
  const first = V.sizeBase + V.sizeStep / 2, last = V.sizeBase + V.sizeStep * (V.maxSize + 0.5); // @math the first and the last band's middles
  for (const d of [0, V.minDistance, 120, first - 0.01, first]) assert.deepEqual(smoothSize(shape, d), { w: shape[0].w, h: shape[0].h }, `flat at ${d}`); // @math distances before the first middle
  for (const d of [last, last + 0.01, 900, V.maxDistance, 4000]) assert.deepEqual(smoothSize(shape, d), { w: shape[V.maxSize].w, h: shape[V.maxSize].h }, `flat at ${d}`); // @math distances past the last middle
  let prev = smoothSize(shape, V.minDistance), steps = 0;
  for (let d = V.minDistance + 0.125; d <= V.maxDistance; d += 0.125) { // @math an eighth of a unit at a time
    const z = smoothSize(shape, d);
    assert.ok(z.w <= prev.w && z.h <= prev.h, `monotonic at ${d}`);
    assert.ok(prev.w - z.w <= 3 / V.sizeStep / 8 + 1e-12 && prev.h - z.h <= 2 / V.sizeStep / 8 + 1e-12, `no step at ${d}`); // @math three columns and two rows a class, spread over a band, an eighth of a unit
    if (z.w !== prev.w) steps++;
    prev = z;
  }
  assert.ok(steps > 1000, 'it moves between the classes');
  const grow = [...shape].reverse(); // a shape whose classes grow: the law follows them up
  assert.ok(smoothSize(grow, 300).w > smoothSize(grow, 200).w);
});

test('the source map: the texel nearest each output pixel\'s middle, symmetric, the frame itself at its own size; the list keeps the last 256', () => {
  for (const [W0, H0, w, h] of [[38, 28, 38, 28], [38, 28, 76, 56], [38, 28, 17, 13], [38, 28, 1, 1], [18, 13, 40, 9], [32, 24, 33, 25]]) { // @math the frame itself, twice, smaller, a pixel, other sizes
    const map = smoothMap(W0, H0, w, h);
    assert.equal(map, smoothMap(W0, H0, w, h), 'kept');
    assert.deepEqual([map.cols.length, map.rows.length, map.separable], [w, h, true]);
    for (let I = 0; I < w; I++) {
      const U = map.cols[I] / H0, middle = ((I + 0.5) * W0) / w; // @math the output pixel's middle in the frame
      assert.ok(Number.isInteger(U) && U >= 0 && U < W0 && middle >= U && middle < U + 1, `column ${I} of ${w} reads ${U}`);
      if (((2 * I + 1) * W0) % (2 * w) !== 0) assert.equal(map.cols[w - 1 - I] / H0, W0 - 1 - U, 'symmetric'); // @math no tie between two texels
    }
    for (let J = 0; J < h; J++) { const middle = ((J + 0.5) * H0) / h; assert.ok(middle >= map.rows[J] && middle < map.rows[J] + 1, `row ${J}`); } // @math the output pixel's middle
    if (w === W0 && h === H0) { assert.ok(map.cols.every((c, I) => c === I * H0)); assert.ok(map.rows.every((r, J) => r === J)); }
  }
  const made = [];
  for (let n = 0; n < SIZES.maps + 40; n++) made.push(smoothMap(5, 5, n + 1, 3)); // @math more sizes than the list keeps: the widths 41 to 296 stay
  assert.equal(smoothMapsKept(), SIZES.maps);
  const oldest = smoothMap(5, 5, 41, 3); // @math the oldest kept, used again: now the most recent
  assert.equal(oldest, made[40], 'kept'); // @math the width 41
  smoothMap(5, 5, SIZES.maps + 41, 3); // @math a new size: the least recently used (the width 42) dropped, not the oldest made (41)
  assert.equal(smoothMap(5, 5, 41, 3), oldest, 'the recently used kept'); assert.notEqual(smoothMap(5, 5, 42, 3), made[41], 'the least recently used made again'); // @math the widths 41 and 42
  assert.equal(smoothMapsKept(), SIZES.maps);
});

test('rowOfDepth: the floor\'s rows at its sample depths, continuous and strictly decreasing, linear in 1/d along the chord beyond both ends', () => {
  for (const options of [{}, { viewZero: true }]) { // a VIEW word of 0 at the centre is a scale of 1.0
    const w = floorWorld(options), last = F.steps - 1;
    assert.equal(rowReport(w).ok, true);
    for (let k = 0; k < F.steps; k++) assert.equal(rowOfDepth(w, depthAt(w, k)), F.bottomRow - k, `the sample ${k}`);
    let prev = rowOfDepth(w, 20), worst = 0; // @math nearer than any floor sample
    for (let d = 20.25; d <= 3000; d += 0.25) { const r = rowOfDepth(w, d); assert.ok(r < prev, `strictly decreasing at ${d}`); if (d > V.minDistance) worst = Math.max(worst, prev - r); prev = r; } // @math a quarter unit at a time, far beyond the last sample
    assert.ok(worst < 0.4, `${worst} rows at most a quarter unit from the nearest distance the game draws on`); // @math 9000 / 80^2 rows a unit there, a quarter of it
    for (let k = 0; k < F.steps; k++) for (const e of [-1e-7, 1e-7]) assert.ok(Math.abs(rowOfDepth(w, depthAt(w, k) + e) - (F.bottomRow - k)) < 1e-6, `continuous at the sample ${k}`); // @math either side of the sample; the tolerance
    for (let k = 0; k < last; k++) { // inside a segment: linear in 1/d, the sample's k plus its share
      const a = depthAt(w, k), b = depthAt(w, k + 1), d = (a + b) / 2, share = (1 / a - 1 / d) / (1 / a - 1 / b); // @math the segment's middle
      assert.ok(Math.abs(rowOfDepth(w, d) - (F.bottomRow - k - share)) < 1e-9, `the segment ${k}`); // @math the tolerance
    }
    const D0 = depthAt(w, 0), DL = depthAt(w, last), slope = last / (1 / D0 - 1 / DL);
    for (const d of [30, 80, 100, D0 - 0.5]) assert.ok(Math.abs(rowOfDepth(w, d) - (F.bottomRow - (1 / D0 - 1 / d) * slope)) < 1e-9, `the chord before the first sample at ${d}`); // @math distances nearer than the first sample; the tolerance
    for (const d of [DL + 0.5, 1122, 2000, 1e6]) assert.ok(Math.abs(rowOfDepth(w, d) - (F.bottomRow - last - (1 / DL - 1 / d) * slope)) < 1e-9, `the chord past the last sample at ${d}`); // @math distances past the last sample; the tolerance
    assert.ok(Math.abs(rowOfDepth(w, 80) - w.rows[80]) < 1.5, 'near the camera the chord stays near the row table'); // @math the nearest distance the game draws; a row and a half
  }
  const flat = floorWorld({ flat: true }); // equal depths at the centre column: no rows of its own, the row table
  assert.equal(rowReport(flat).ok, false);
  for (const d of [90, 300.5, 1000]) assert.equal(rowOfDepth(flat, d), rowAt(flat.rows, d)); // @math some distances
  assert.equal(rowLaw(flat, 'classes'), null); assert.equal(rowLaw(floorWorld(), 'smooth')(500), rowOfDepth(floorWorld(), 500)); // @math a distance
});

test('the standing row: the floor\'s own row down to the row table\'s last row, that row beyond (where the floor draws no ground), continuous', () => {
  const w = floorWorld(), lastRow = w.rows[w.rows.length - 1], crossing = depthAt(w, F.bottomRow - lastRow), law = rowLaw(w, 'smooth'); // the floor's sample on the table's last row
  assert.ok(crossing < depthAt(w, F.steps - 1), 'the floor reaches the table\'s last row before its own last sample');
  let prev = standingRow(w, V.minDistance), first = null;
  for (let d = V.minDistance + 0.25; d <= 3000; d += 0.25) { // @math a quarter unit at a time from the nearest distance the game draws, far beyond the last sample
    const r = standingRow(w, d), floor = rowOfDepth(w, d);
    assert.ok(r <= prev && prev - r < 1, `never up, no step at ${d}`); assert.ok(r >= lastRow, `never above the table's last row at ${d}`);
    assert.equal(r, Math.max(floor, lastRow), `the floor's row or the last row at ${d}`); assert.equal(law(d), r, 'the sizes\' row law');
    if (r === lastRow) first ??= d;
    prev = r;
  }
  assert.ok(Math.abs(first - crossing) <= 0.25, `on the last row from the floor's crossing (${first} against ${crossing})`); // @math a quarter unit
  for (const e of [-1e-7, 1e-7]) assert.ok(Math.abs(standingRow(w, crossing + e) - lastRow) < 1e-6, 'continuous at the crossing'); // @math either side; the tolerance
  for (const d of [1000, V.maxDistance]) assert.ok(rowOfDepth(w, d) < lastRow - 1 && standingRow(w, d) === lastRow, `at ${d} the floor's row is above the strip's edge, the standing row is not`); // @math a far distance
  const flat = floorWorld({ flat: true });
  for (const d of [90, 300.5, 1000]) assert.equal(standingRow(flat, d), rowAt(flat.rows, d)); // @math some distances
});

test('the order: farthest first, records of one distance in the frame routine\'s queue whatever order they come in, a margin record by what it shows', () => {
  const rec = (o, distance) => ({ type: -1, racer: -1, object: -1, distance, ...o });
  const queue = [rec({ type: 1, racer: 0 }, 300), rec({ type: 1, racer: 2 }, 300), rec({ type: 1, racer: 5, margin: true }, 300), rec({ object: 1 }, 300), rec({ object: 4 }, 300), rec({ type: 0, racer: 0 }, 300), rec({}, 300), rec({ shot: 0 }, 300), rec({ shot: 3 }, 300)]; // @math the intro's human, racers, a margin racer, objects, the own car, the starter, shots, all at one distance
  const r = createRandom(5);
  for (let n = 0; n < 50; n++) { // @math shuffles
    const shuffled = queue.slice().sort(() => r() - 0.5); // @math a coin a pair
    assert.deepEqual(smoothOrder(shuffled), queue, 'the queue order');
  }
  const mixed = [rec({ object: 2 }, 400.25), rec({ type: 1, racer: 1 }, 120.5), rec({ shot: 1 }, 400.25), rec({ type: 1, racer: 3 }, 400.25), rec({ type: 0, racer: 0 }, 124), rec({ object: 0 }, 900)]; // @math fine distances, three of one
  assert.deepEqual(smoothOrder(mixed).map(x => x.distance), [900, 400.25, 400.25, 400.25, 124, 120.5]); // @math farthest first
  assert.deepEqual(smoothOrder(mixed).slice(1, 4), [mixed[3], mixed[0], mixed[2]], 'one distance: the racer, the object, the shot');
  assert.notEqual(smoothOrder(mixed), mixed, 'a copy'); assert.deepEqual(mixed[0], rec({ object: 2 }, 400.25)); // @math the input untouched
});

test('the placement at the tick: the game\'s column, the standing row of its distance, the size of the law; with a fine shift, the shift unrounded', () => {
  const w = floorWorld(), camI = { x: 2048, y: 2048, heading: 300 }; // @math a camera
  for (const [column, bottom, distance] of [[160, 150, 260], [-6, 132, 830], [300, 199, 115], [37, 140, 413], [90, 131, 1000]]) { // @math in the middle, cut on the left, at the bottom row, anywhere, beyond the floor's crossing of the last row
    for (const k of [0, 3, 9]) for (const [s, m] of [[1, 0], [2, 0], [2, 53], [3, 18]]) { // @math some classes; 1x, 2x, 2x wide on 4 BY 3, 3x on 16 BY 10
      const picture = shape[k], clip = clipPicture({ column, bottom }, picture);
      if (!clip) continue;
      const r = { ...clip, picture, frame, distance, sizeClass: k, type: 1, racer: 2, object: -1 }, G = geometryOf({ s, m }), p = placeSmooth(r, w, camI, camI, null, G), size = smoothSize(shape, distance); // @math a racer
      const W = Math.max(1, Math.round(s * size.w)), H = Math.max(1, Math.round(s * size.h)), lift = w.rows[distance] - bottom; // the record's lift above its row-table row (a forged record's: kept)
      assert.deepEqual([p.smooth.w, p.smooth.h, p.distance, p.firstColumn, p.width, p.height], [W, H, distance, 0, picture.w, picture.h]);
      assert.equal(p.place.x + (W >> 1), s * (column + m), 'the anchor column is the game\'s column, s times over');
      assert.equal(p.place.y + H, Math.round(s * (standingRow(w, distance) - lift)), 'the bottom on the standing row of the distance');
      assert.equal(p.smooth.map, smoothMap(38, 28, W, H)); // @math the frame's size
    }
  }
  const picture = shape[2], a = { x: 2100.6, y: 2190.2 }, camF = { x: 2048.4, y: 2047.3, heading: 300.5 }, i = projectFine(w, camI, roundWord(a.x), roundWord(a.y)), f = projectFine(w, camF, a.x, a.y); // @math a camera's fine blend and a racer's point
  const r = { ...clipPicture({ column: Math.round(i.column), bottom: w.rows[Math.round(i.distance)] }, picture), picture, frame, distance: Math.round(i.distance), sizeClass: 2, type: 1, racer: 1, object: -1 };
  for (const [s, m] of [[1, 0], [2, 0], [2, 53]]) { // @math the scales; the margin of 4 BY 3
    const G = geometryOf({ s, m }), p = placeSmooth(r, w, camF, camI, a, G), d = r.distance + f.distance - i.distance, f2 = m ? projectAt(w, camF, a.x, a.y, m) : f, i2 = m ? projectAt(w, camI, roundWord(a.x), roundWord(a.y), m) : i;
    assert.ok(Math.abs(p.distance - (r.distance + f2.distance - i2.distance)) < 1e-9 && Math.abs(p.distance - d) < 1e-9, 'the fine distance: the game\'s plus the shift'); // @math the tolerance
    assert.ok(Math.abs(p.place.x + (p.smooth.w >> 1) - s * (Math.round(i.column) + f2.column - i2.column + m)) <= 0.5, `${s}x margin ${m}: the anchor within half an output pixel of the fine column`); // @math half a pixel
    assert.ok(Math.abs(p.place.y + p.smooth.h - s * standingRow(w, p.distance)) <= 0.5, 'the bottom within half an output pixel of the fine row'); // @math half a pixel
  }
  assert.equal(placeSmooth({ ...r, type: 0 }, w, camI, camI, null, IDENTITY), null, 'the own car keeps its class');
  assert.equal(placeSmooth({ ...r, picture: infPicture(4, 4, (x, y) => x * 4 + y) }, w, camI, camI, null, IDENTITY), null, 'a picture of no shape of the world keeps its class'); // @math a 4 x 4 picture
  assert.equal(placeSmooth({ ...r, frame: frame.subarray(0, 100) }, w, camI, camI, null, IDENTITY), null, 'a frame smaller than the class 0 picture'); // @math too few bytes
});

test('the blit of a smooth picture: every pixel the texel of its map, the frame itself at its own size; its reference samples from the top left', () => {
  const w = floorWorld(), picture = shape[0], r = { ...clipPicture({ column: 160, bottom: 170 }, picture), picture, frame, distance: 150, sizeClass: 0, type: 1, racer: 1, object: -1 }; // @math in the middle; a distance of class 0
  const one = { ...r, place: { x: r.left, y: r.top }, smooth: { w: 38, h: 28, map: smoothMap(38, 28, 38, 28) } }, f1 = new Uint8Array(SIZE), f2 = new Uint8Array(SIZE), L1 = createLayers(SIZE), L2 = createLayers(SIZE); // @math the frame's own size
  const a = blitLayers(f1, L1, r, 0.2, F.width, F.height), b = blitAt(f2, L2, one, 0.2, IDENTITY, { world: w, at: one.place }); // @math the footprint's band
  assert.deepEqual(f2, f1, 'at the class 0 size and its place: the class 0 picture'); assert.deepEqual(L2.kind, L1.kind); assert.deepEqual(b, a);
  for (const [s, W, H] of [[1, 23, 17], [2, 47, 35], [2, 1, 1], [3, 60, 41]]) { // @math sizes between the classes, a pixel, at 1x to 3x
    const G = geometryOf({ s, m: 0 }), at = { x: s * 100 + 1, y: s * 60 }, rec = { ...r, place: at, smooth: { w: W, h: H, map: smoothMap(38, 28, W, H) } }, out = new Uint8Array(G.W * G.H), L = createLayers(G.W * G.H), rows = new Uint8Array(G.H); // @math a place
    const got = blitAt(out, L, rec, 0.2, G, { world: w, at, sampled: true, rows }), map = rec.smooth.map; // @math the band
    let drawn = 0;
    for (let I = 0; I < W; I++) for (let J = 0; J < H; J++) { const v = frame[map.cols[I] + map.rows[J]], o = (at.y + J) * G.W + at.x + I; if (v) { drawn++; assert.equal(out[o], v); assert.equal(L.depth[o], r.distance); } else assert.equal(out[o], 0); }
    assert.equal(out.reduce((n, v) => n + (v ? 1 : 0), 0), drawn, 'nothing outside the box'); assert.ok(rows[at.y] || rows[at.y + H - 1]);
    assert.deepEqual([got.cols.top.length, got.sample.cols.top.length], [W, Math.ceil(W / s)], 'the silhouette: every output column, and the sampled ones');
    for (let i = 0; i < Math.ceil(W / s); i++) { // the sampled silhouette: the picture's output pixels s i, s j
      let top = -1, bottom = -1;
      for (let j = 0; j * s < H; j++) if (frame[map.cols[s * i] + map.rows[s * j]]) { if (top < 0) top = j; bottom = j; }
      assert.deepEqual([got.sample.cols.top[i], got.sample.cols.bottom[i]], [top, bottom], `${s}x ${W} x ${H}: the sampled column ${i}`);
    }
  }
});

test('the decals in smooth sizes: the contact shadow and the sun cast under the drawn picture, on the pictures\' rows; the projections\' row law', () => {
  const w = floorWorld(), P = { car: {}, fx: {}, ai: { racers: [] } }, opts = { shadows: true, sceneryShadows: true }, law = rowLaw(w, 'smooth'), floorRows = d => rowOfDepth(w, d), cam = { x: 2048, y: 2048, heading: 0 }, lastRow = w.rows[w.rows.length - 1]; // @math a camera
  // Two far places: on the floor's own rows before they reach the table's last row (840: the floor's 131.5, the table's 131), and beyond
  // (1000), where the sizes' law stands the picture on the last row (the floor would put it more than a row higher, over the horizon strip).
  // A law of the floor's rows alone (the picture placed on it by hand) shows that the cast follows whatever law it is given.
  for (const [d, row, onFloor] of [[840, law, true], [1000, law, false], [1000, floorRows, true]]) { // @math the distances
    const r = { ...clipPicture({ column: 160, bottom: w.rows[d] }, shape[V.maxSize]), picture: shape[V.maxSize], frame, distance: d, sizeClass: V.maxSize, type: 1, racer: 2, object: -1 };
    for (const [s, soft] of [[1, false], [2, false], [2, true]]) { // @math 1x; 2x in the full look and on the reference grid
      const G = geometryOf({ s, m: 0 }), placed = placeSmooth(r, w, cam, cam, null, G), { w: W, h: H } = placed.smooth, u = soft ? 1 : s, k = u / s;
      assert.equal(placed.place.y + H, Math.round(s * standingRow(w, d)), 'the picture on the standing row');
      if (!onFloor) assert.equal(placed.place.y + H, s * lastRow, 'beyond the crossing: the table\'s last row, the classes\' row');
      const p = row === law ? placed : { ...placed, place: { x: placed.place.x, y: Math.round(s * rowOfDepth(w, d)) - H } }; // placed by hand on the floor's rows
      const grid = soft ? { x: p.place.x / s, y: p.place.y / s, u: 1, m: 0 } : { x: p.place.x, y: p.place.y, u: s, m: 0 };
      grid.box = { w: W * k, h: H * k, ax: (W >> 1) * k }; grid.row = row;
      const c = casterOf(p, P, null, 188, opts, grid); // @math the own car's ground row (unused here)
      assert.ok(Math.abs(c.x - (p.place.x + (W >> 1)) * k) < 1e-9 && Math.abs(c.y - (p.place.y + H) * k) < 1e-9, 'the shadow under the drawn picture\'s anchor'); // @math the tolerance
      assert.ok(Math.abs(c.rx - (W * k * SHADOW.widthOfPicture) / 2) < 1e-9, 'its radius from the drawn width'); // @math the tolerance; half the width
      const drawn = blitAt(new Uint8Array(G.W * G.H), createLayers(G.W * G.H), p, 0.2, G, { world: w, at: p.place, sampled: soft }), cast = castOf(p, P, soft ? drawn.sample : drawn, 188, grid); // @math the band; the ground row (unused)
      assert.deepEqual([cast.anchor, cast.ground, cast.width, cast.row], [grid.x + grid.box.ax, grid.y + grid.box.h, W / s, row]);
      const bottom = cast.ground - u, sun = { ...sunDirection(w, 0.3, 0), length: 0 }, gw = soft ? F.width : G.W, gh = soft ? F.height : G.H; // the picture's bottom row on the grid; a sun at noon: the cast is its base alone // @math a sun from a third of the turn
      const base = castShadow(createLayers(gw * gh), cast, w, sun, gw, gh, { x0: gw, x1: -1, y0: gh, y1: -1 }), table = castShadow(createLayers(gw * gh), { ...cast, row: null }, w, sun, gw, gh, { x0: gw, x1: -1, y0: gh, y1: -1 });
      const where = `${d} ${s}x${soft ? ' reference' : ''}${row === law ? '' : ' on the floor\'s rows'}`;
      assert.ok(base.y0 >= bottom - u && base.y1 <= bottom + u, `${where}: the cast's base on the picture's bottom row (${base.y0}..${base.y1} against ${bottom})`);
      if (row === floorRows) assert.ok(table.y0 > base.y1, `${where}: on the row table it would stand below the picture (${table.y0} against ${base.y1})`);
      if (!onFloor) assert.deepEqual(base, table, `${where}: beyond the crossing the sizes' law is the row table`);
    }
  }
  const camera = { x: 2048, y: 2048, heading: 100 }; // @math a camera
  for (const [x, y] of [[2600, 2300], [2900, 1900], [2150, 2060]]) for (const m of [0, 53]) { // @math far, aside and near points; the margin of 4 BY 3
    const plain = projectAt(w, camera, x, y, m), smooth = projectAt(w, camera, x, y, m, law);
    assert.deepEqual([smooth.column, smooth.distance], [plain.column, plain.distance], 'the place itself unchanged');
    assert.equal(plain.bottom, rowAt(w.rows, plain.distance), 'the row table without a law'); assert.equal(smooth.bottom, standingRow(w, smooth.distance), 'the standing row with it');
    const t = projectFine(w, camera, x, y), back = fromCameraAt(w, 300, 40, true, m, law); // @math a point of the camera's ground
    assert.equal(projectFine(w, camera, x, y, law).bottom, standingRow(w, t.distance)); assert.equal(back.bottom, standingRow(w, back.distance));
  }
});
