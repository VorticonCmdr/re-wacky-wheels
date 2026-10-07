// The geometry of a rendered world (src/enhance/geometry.js, Stage 4): the identity at scale 1 without margins, the maps at whole scales and
// margins (aligned top-left, so every reference sample is an output pixel), the wide view's margins for the two display shapes, the strip's
// period check, and the cosine read from a TRIG table. Synthetic tables only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometryOf, IDENTITY, viewMargin, cosT, stripPeriod, stripRepeats, bandSample } from '../src/enhance/geometry.js';
import { composeSplitAt, flipViewportAt, flippedBands, splitSample } from '../src/enhance/split.js';
import { blurCast, boxBlurCast } from '../src/enhance/shadows.js';
import { createLayers } from '../src/enhance/scene.js';
import { createRandom } from '../src/enhance/particles.js';
import { SUN } from '../src/enhance/config.js';
import { composeSplit, flipViewport } from '../src/render/versus.js';
import { LAYOUT } from '../src/game/versus-rules.js';
import { models } from '../src/enhance/models.js';

const F = models().floor, S = models().sky, V = models().view;
// A TRIG table of `turn` entries of two signed 16.16 words, entry 0 on the x axis (so the dot products are exact): cos and sin of e turns / turn.
function trigTable(turn = V.turn, phase = 0) {
  const view = new DataView(new ArrayBuffer(turn * V.trigEntryBytes)), unit = 2 ** V.fixedBits;
  for (let e = 0; e < turn; e++) { const a = (2 * Math.PI * e) / turn + phase; view.setInt32(e * V.trigEntryBytes, Math.round(unit * Math.cos(a)), true); view.setInt32(e * V.trigEntryBytes + V.trigEntryBytes / 2, Math.round(unit * Math.sin(a)), true); } // @math a full turn; the second word half an entry on
  return view;
}

test('the identity: scale 1 without margins maps every pixel to itself', () => {
  const G = IDENTITY;
  assert.equal(G, geometryOf({ s: 1, m: 0 })); assert.equal(G, geometryOf());
  assert.deepEqual([G.s, G.m, G.refW, G.refH, G.W, G.H, G.key, G.identity], [1, 0, F.width, F.height, F.width, F.height, '1:0', true]);
  assert.ok(G.colRef.every((c, X) => c === X)); assert.ok(G.rowRef.every((r, Y) => r === Y)); assert.ok(G.sample.every((o, i) => o === i));
  for (const x of [0, 17.25, 319]) { assert.equal(G.u(x), x); assert.equal(G.outX(x), x); assert.equal(G.v(x), x); assert.equal(G.outY(x), x); } // @math whole and fractional columns
});

test('whole scales and margins: aligned top-left, every reference sample an output pixel, the cells of the sub-pixels', () => {
  for (const [s, m] of [[2, 0], [2, 53], [2, 18], [3, 0], [3, 120], [1, 53]]) { // @math 2x, 2x wide at 4:3 and 16:10, 3x (tests only), margins up to 120, 1x wide
    const G = geometryOf({ s, m });
    assert.equal(G, geometryOf({ s, m }), 'one object per geometry');
    assert.deepEqual([G.refW, G.refH, G.W, G.H, G.key, G.identity], [F.width + 2 * m, F.height, s * (F.width + 2 * m), s * F.height, `${s}:${m}`, false]); // @math a margin each side
    assert.equal(G.colRef.length, G.W); assert.equal(G.rowRef.length, G.H); assert.equal(G.sample.length, F.width * F.height);
    assert.equal(G.colRef[0], 0 - m); assert.equal(G.colRef[G.W - 1], F.width - 1 + m); assert.equal(G.rowRef[G.H - 1], F.height - 1);
    for (let X = 0; X < G.W; X++) assert.equal(G.colRef[X], Math.floor(X / s) - m);
    for (const [x, y] of [[0, 0], [319, 199], [160, 110], [7, 131]]) { // @math corners, the horizon's centre, a floor row
      const o = G.sample[y * F.width + x], X = o % G.W, Y = Math.floor(o / G.W);
      assert.deepEqual([X, Y], [s * (x + m), s * y]); assert.deepEqual([G.colRef[X], G.rowRef[Y]], [x, y]); // the output pixel of a sample lies in that sample's cell, top-left
      assert.equal(G.u(X), x); assert.equal(G.v(Y), y); assert.equal(G.outX(x), X); assert.equal(G.outY(y), Y);
    }
    if (s > 1) { assert.equal(G.u(1), 1 / s - m); assert.equal(G.colRef[s - 1], 0 - m); assert.equal(G.colRef[s], 1 - m); } // the sub-columns of column -m
    for (const u of [0 - m, -0.5, 12.75, 319.5]) assert.equal(G.u(G.outX(u)), u); // @math the maps are each other's inverse
  }
  assert.throws(() => geometryOf({ s: 1.5, m: 0 }), /whole numbers/); assert.throws(() => geometryOf({ s: 0, m: 0 }), /whole numbers/); assert.throws(() => geometryOf({ s: 2, m: -1 }), /whole numbers/); // @math a fractional scale, no scale, a negative margin
});

test('the wide view\'s margin: none in the standard view, 53 columns at 4 BY 3 and 18 at 16 BY 10 for 16:9, within the strip\'s period', () => {
  assert.equal(viewMargin('standard', 'dos'), 0); assert.equal(viewMargin('standard', 'wide'), 0);
  assert.equal(viewMargin('wide', 'dos'), 53); assert.equal(viewMargin('wide', 'wide'), 18); // @math 426 and 356 columns
  assert.equal(viewMargin('ultra', 'dos'), 0); assert.equal(viewMargin('wide', 'tv'), 0); assert.equal(viewMargin('toString', 'dos'), 0); assert.equal(viewMargin('wide', 'constructor'), 0);
  assert.equal(stripPeriod(), 640); // @math horizon.bounds' span: 160 bytes of four pixels
  assert.ok(F.width + 2 * viewMargin('wide', 'dos') <= stripPeriod(), 'the picture never shows the panorama twice');
  // A world whose horizon strip repeats with the period (and whose VIEW words are the TRIG cosine: test/stage4-wide.test.js) keeps the margin;
  // one whose strip does not gets none.
  const par = new Uint8Array(S.parBytes), trig = trigTable(), view = new DataView(new ArrayBuffer((V.maxColumn + 1) * V.viewBytes));
  for (let j = 0; j < S.horizonRows; j++) for (let p = 0; p < S.parRowPixels; p++) par[j * S.parRowPixels + p] = (p % stripPeriod()) * 7 + j; // @math a pattern of the period
  for (let c = 0; c <= V.maxColumn; c++) view.setUint32(c * V.viewBytes, Math.round(2 ** V.viewShift * cosT(trig, c - V.center)), true); // @math the VIEW word is a 2.14 fixed-point scale
  assert.ok(stripRepeats(par)); assert.equal(viewMargin('wide', 'dos', { par, view, trig }), 53); // @math the margin at 4 BY 3
  const odd = par.slice(); odd[3 * S.parRowPixels + 700] ^= 1; // @math one pixel of the fourth row's repeat
  assert.equal(stripRepeats(odd), false); assert.equal(viewMargin('wide', 'dos', { par: odd, view, trig }), 0); assert.equal(viewMargin('standard', 'dos', { par: odd, view, trig }), 0);
  assert.equal(stripRepeats(new Uint8Array(100)), false); // @math not a .PAR at all
});

test('cosT: the cosine of D TRIG entries from the table\'s own dot products, 1 at 0, symmetric, lerped between entries, cached per table', () => {
  const trig = trigTable(), turn = V.turn;
  assert.equal(cosT(trig, 0), 1);
  assert.equal(cosT(trig, turn / 4), 0); assert.equal(cosT(trig, turn / 2), -1); assert.equal(cosT(trig, turn), 1); // @math a quarter, half and whole turn
  for (const D of [1, 5, 37.5, 159.25, 160, 213, 700.5]) { // @math whole and fractional entries, the fan's edge, beyond a quarter turn
    assert.equal(cosT(trig, -D), cosT(trig, D), `symmetric at ${D}`);
    assert.ok(Math.abs(cosT(trig, D) - Math.cos((2 * Math.PI * D) / turn)) < 1e-4, `near the cosine at ${D}`); // @math a turn; within the table's rounding and the lerp
  }
  assert.equal(cosT(trig, 10.5), (cosT(trig, 10) + cosT(trig, 11)) / 2); // @math the lerp halfway
  assert.equal(cosT(trig, turn - 0.5), (cosT(trig, turn - 1) + cosT(trig, 0)) / 2); // @math the wrap from the last entry to the first
  // Any table, whatever direction its entry 0 points: the dot products with entry 0 are the cosine of the angle between them.
  const turned = trigTable(turn, 0.7); // @math a table whose entry 0 is not on an axis
  for (const D of [0, 100, 480, 959]) assert.ok(Math.abs(cosT(turned, D) - Math.cos((2 * Math.PI * D) / turn)) < 1e-4, `a turned table at ${D}`); // @math a turn; within the table's rounding
  // The values are the table's, never a fit: an entry changed in a copy changes its cosine there and nowhere else.
  const changed = new DataView(trig.buffer.slice(0)); changed.setInt32(100 * V.trigEntryBytes, changed.getInt32(100 * V.trigEntryBytes, true) - 64, true); // @math entry 100's x word, 64 units less
  assert.notEqual(cosT(changed, 100), cosT(trig, 100)); assert.equal(cosT(changed, 99), cosT(trig, 99)); assert.equal(cosT(changed, 101), cosT(trig, 101)); // @math the entry and its neighbours
});

test('the reference cell of every output column and row (colRef, rowRef), and the identity\'s maps', () => {
  for (const [s, m] of [[1, 0], [2, 0], [3, 0], [2, 53], [3, 8]]) { // @math the scales and margins of the tests
    const G = geometryOf({ s, m });
    for (let Y = 0; Y < G.H; Y++) assert.equal(G.rowRef[Y], Math.floor(Y / s));
    for (let X = 0; X < G.W; X++) assert.equal(G.colRef[X], Math.floor(X / s) - m);
    for (let Y = 0; Y < G.H; Y += s) for (let q = 0; q < s; q++) assert.equal(G.rowRef[Y + q], G.rowRef[Y], 'the s rows of a cell share its reference row');
  }
  assert.equal(bandSample(IDENTITY, []), IDENTITY.sample);
  assert.ok(bandSample(IDENTITY, [{ first: 110, rows: 90 }]).every((o, i) => o === i), 'at the identity a mirrored band reads the pixel itself'); // @math a viewer's band
});

// A buffer of output rows with a value per pixel that tells its place: per output row Y and column X, Y x 1000 + X (Float32 holds them exactly).
const placed = G => Float32Array.from({ length: G.W * G.H }, (_, i) => Math.floor(i / G.W) * 1000 + (i % G.W)); // @math a value that names its row and column

test('the split screen at a geometry: composeSplitAt and flipViewportAt are composeSplit and flipViewport at 1x, and s times their rows above', () => {
  const L = LAYOUT(), size = F.width * F.height, random = createRandom(3);
  const a = Uint8Array.from({ length: size }, () => Math.floor(random() * 256)), b = Uint8Array.from({ length: size }, () => Math.floor(random() * 256)); // @math palette indices
  // At 1x the general code (forced) is render/versus.js's, and the dispatched call is it.
  assert.deepEqual(composeSplitAt(a, b, new Uint8Array(size), IDENTITY, F.width, true), composeSplit(a, b, new Uint8Array(size)));
  assert.deepEqual(composeSplitAt(a, b, new Uint8Array(size), IDENTITY), composeSplit(a, b, new Uint8Array(size)));
  for (const seat of [0, 1]) {
    assert.deepEqual(flipViewportAt(a.slice(), seat, IDENTITY, F.width, true), flipViewport(a.slice(), seat), `seat ${seat}`);
    assert.deepEqual(flipViewportAt(a.slice(), seat, IDENTITY), flipViewport(a.slice(), seat), `seat ${seat}, dispatched`);
    const layer = Float32Array.from(a, v => v / 7); // @math any Float32 layer
    assert.deepEqual(flipViewportAt(layer.slice(), seat, IDENTITY, F.width, true), flipViewport(layer.slice(), seat));
    assert.deepEqual(flipViewportAt(layer.slice(), seat, IDENTITY), flipViewport(layer.slice(), seat));
  }
  // Row flags (one value an output row, always the general code) cut and mirror like the rows they flag: at 1x, 2x and 3x the mirrored flags are
  // the flags of the rows the mirrored picture holds (a picture of one value a row, mirrored as the pictures are).
  const rowsA = Uint8Array.from({ length: F.height }, (_, y) => y % 3), rowsB = Uint8Array.from({ length: F.height }, (_, y) => (y % 5) + 10); // @math distinct patterns
  const rows = composeSplitAt(rowsA, rowsB, new Uint8Array(F.height), IDENTITY, 1);
  for (let y = 0; y < F.height; y++) assert.equal(rows[y], y >= L.viewRow ? rowsA[y] : rowsB[y + L.shift]);
  for (const G of [IDENTITY, geometryOf({ s: 2, m: 0 }), geometryOf({ s: 3, m: 0 })]) for (const seat of [0, 1]) { // @math the scales of the tests
    const flags = Uint8Array.from({ length: G.H }, (_, y) => (y * 7) % 251), picture = Uint8Array.from({ length: G.W * G.H }, (_, i) => flags[Math.floor(i / G.W)]); // @math distinct values a row
    const mirrored = flipViewportAt(flags.slice(), seat, G, 1), whole = flipViewportAt(picture.slice(), seat, G, G.W, true);
    for (let y = 0; y < G.H; y++) assert.equal(mirrored[y], whole[y * G.W], `${G.s}x, seat ${seat}: row ${y}`);
    const first = G.s * (seat === 0 ? L.flip.first : L.flip.first - L.shift), n = G.s * L.flip.rows;
    assert.equal(mirrored[first], flags[first + n - 1]); assert.equal(mirrored[first - 1], flags[first - 1], 'the rows outside the band stay'); // the band's first row takes its last
  }
  // At 2x and 3x: cut at s times the rows, so its reference samples are composeSplit of the inputs' samples; the band of an upside-down viewer
  // mirrored at its own output rows, and the canvas's map reads row s y + s - 1 there, which gives flipViewport of the samples.
  for (const s of [2, 3]) { // @math the scales of the tests
    const G = geometryOf({ s, m: 0 }), A = placed(G), B = A.map(v => -v - 1), out = new Float32Array(G.W * G.H); // the second viewer's values told apart by their sign
    composeSplitAt(A, B, out, G);
    const sample = buf => Float32Array.from(G.sample, o => buf[o]), refA = sample(A), refB = sample(B);
    assert.deepEqual(sample(out), composeSplit(refA, refB, new Float32Array(size)), `the cut at ${s}x`);
    for (const flipped of [[true, false], [false, true], [true, true]]) {
      const after = out.slice(), ref = composeSplit(refA, refB, new Float32Array(size));
      flipped.forEach((f, seat) => { if (f) { flipViewportAt(after, seat, G); flipViewport(ref, seat); } });
      const map = splitSample(G, flipped);
      assert.deepEqual(Float32Array.from(map, o => after[o]), ref, `${s}x, upside down: ${flipped}`);
      assert.deepEqual(map, bandSample(G, flippedBands(flipped)));
      for (const { first, rows: n } of flippedBands(flipped)) for (let q = 0; q < s * n; q++) { // the band's output rows reversed, every pixel of them
        const Y = s * first + q, from = s * first + s * n - 1 - q;
        for (const X of [0, 1, G.W - 1]) assert.equal(after[Y * G.W + X], out[from * G.W + X]);
      }
    }
  }
});

test('the running-sum box blur of the sun shadows is blurCast\'s within 1e-6 at every radius, up to the picture\'s edges', () => {
  const random = createRandom(11), W = 96, H = 64; // @math a small picture
  // A brute-force box blur: rows then columns, the window's pixels outside the picture counting 0, over the box grown by R (blurCast's).
  const brute = (cast, box, R) => {
    const n = 2 * R + 1, x0 = Math.max(box.x0 - R, 0), x1 = Math.min(box.x1 + R, W - 1), y0 = Math.max(box.y0 - R, 0), y1 = Math.min(box.y1 + R, H - 1), mid = Float64Array.from(cast), out = Float64Array.from(cast); // @math the window of a radius
    for (let y = Math.max(y0 - R, 0); y <= Math.min(y1 + R, H - 1); y++) for (let x = x0; x <= x1; x++) { let s = 0; for (let k = -R; k <= R; k++) if (x + k >= 0 && x + k < W) s += cast[y * W + x + k]; mid[y * W + x] = s / n; }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { let s = 0; for (let k = -R; k <= R; k++) if (y + k >= 0 && y + k < H) s += mid[(y + k) * W + x]; out[y * W + x] = s / n; }
    return out;
  };
  for (let trial = 0; trial < 24; trial++) { // @math random casts and boxes
    const cast = Float32Array.from({ length: W * H }, () => (random() < 0.3 ? random() : 0)), R = [SUN.blur, 2, 3][trial % 3]; // @math SUN.blur, and the radii of 2x and 3x
    const box = trial % 4 === 0 ? { x0: 0, x1: W - 1, y0: 0, y1: H - 1 } : { x0: Math.floor(random() * W), x1: 0, y0: Math.floor(random() * H), y1: 0 }; // @math every fourth the whole picture (both edges)
    if (trial % 4) { box.x1 = Math.min(box.x0 + Math.floor(random() * 40), W - 1); box.y1 = Math.min(box.y0 + Math.floor(random() * 30), H - 1); } // @math boxes of up to 40 x 30
    const a = createLayers(W * H), b = createLayers(W * H);
    a.cast.set(cast); b.cast.set(cast);
    blurCast(a, box, W, H, a.scratch, R); boxBlurCast(b, box, W, H, b.scratch, R);
    const expected = brute(cast, box, R);
    for (let i = 0; i < W * H; i++) {
      if (Math.abs(b.cast[i] - a.cast[i]) > 1e-6) assert.fail(`trial ${trial}, radius ${R}: pixel ${i % W},${Math.floor(i / W)} is ${b.cast[i]}, blurCast's ${a.cast[i]}`);
      if (Math.abs(a.cast[i] - expected[i]) > 1e-6) assert.fail(`trial ${trial}: blurCast differs from the brute force at ${i}`);
    }
  }
  const L = createLayers(W * H); L.cast.fill(0.5); // @math any value
  boxBlurCast(L, { x0: W, x1: -1, y0: H, y1: -1 }, W, H, L.scratch, 2); // an empty box (nothing cast) touches nothing
  assert.ok(L.cast.every(v => v === 0.5));
});
