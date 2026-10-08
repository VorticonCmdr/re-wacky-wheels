// Stage 4's wide view (docs/enhancements.md, Stage 4 as built, M8) on synthetic tables and states, no game files: the per-world check of the
// VIEW words against the TRIG cosine; the horizon strip read modulo its period (seamless at every offset and across both wraps, today's in
// the standard view); the sky's margins (single-index rows continued exactly, dithered rows made again in their proportions from their own
// indices, the picture's 320 columns untouched); the wide projection (continuous at the fan's edge, the floor's column of a ray outside it,
// its own inverse, the pinhole itself at m = 0); the margins' records (wide.js): the coverage of a thing swept through a full turn, no gap
// at the fan's seams and never two records of one thing, the game's filters through the aimed probes, the frame bytes of the probe, the
// game's order kept; the HUD's places (hud-place.js); and a wide frame through the enhancer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometryOf, viewMargin, viewWorst, wideReport, cosT, stripPeriod, stripRepeats } from '../src/enhance/geometry.js';
import { skyMargins, drawSkyAt, drawStripAt } from '../src/enhance/sky-hd.js';
import { fromCamera, cameraPoint, projectFine, fromCameraAt, cameraPointAt, projectAt, fanEdge, rayRatio, toCamera } from '../src/enhance/project.js';
import { createWide, wideCandidates, mergeOrder, probeCamera, recordKey } from '../src/enhance/wide.js';
import { castFloor } from '../src/enhance/caster.js';
import { hudPlaces } from '../src/enhance/hud-place.js';
import { sunGlitter } from '../src/enhance/water.js';
import { createEnhancer } from '../src/enhance/index.js';
import { createRandom } from '../src/enhance/particles.js';
import { PRESETS, WIDE, SKY_MARGIN } from '../src/enhance/config.js';
import { models } from '../src/enhance/models.js';
import { sceneRecords } from '../src/render/scene.js';
import { tables, syntheticWorld, CAMERA, stateWith, pointAt, floorOf, raceOf, memory } from './wide-world.js';
import { sortDrawList } from '../src/render/draw-list.js';
import { renderHorizon } from '../src/render/sky.js';
import { buildRowTable, viewSetup } from '../src/game/view.js';

const F = models().floor, S = models().sky, V = models().view;


test('the VIEW words against the TRIG cosine: a cosine table passes, a changed one gets no wide view', () => {
  const { trig, view } = tables(), par = new Uint8Array(S.parBytes);
  for (let j = 0; j < S.horizonRows; j++) for (let p = 0; p < S.parRowPixels; p++) par[j * S.parRowPixels + p] = (p % stripPeriod()) + j; // @math a strip of the period
  assert.ok(viewWorst({ view, trig }) < 1e-4); assert.deepEqual(wideReport({ par, view, trig }).ok, true); // @math the words' rounding
  assert.equal(viewMargin('wide', 'dos', { par, view, trig }), 53); assert.equal(viewMargin('wide', 'wide', { par, view, trig }), 18); // @math 4 BY 3 and 16 BY 10
  const lens = new DataView(view.buffer.slice(0)); lens.setUint32(0, Math.round(lens.getUint32(0, true) * 1.01), true); // @math the edge column's word one per cent off
  assert.ok(viewWorst({ view: lens, trig }) > WIDE.viewTolerance); assert.equal(wideReport({ par, view: lens, trig }).view, false);
  assert.equal(viewMargin('wide', 'dos', { par, view: lens, trig }), 0, 'a world whose VIEW is not the cosine gets no margin');
  const flat = new DataView(new ArrayBuffer(view.byteLength)); for (let c = 0; c <= V.maxColumn; c++) flat.setUint32(c * V.viewBytes, 2 ** V.viewShift, true); // @math VIEW words of 1.0
  assert.equal(viewMargin('wide', 'dos', { par, view: flat, trig }), 0, 'a flat VIEW is no cosine');
  const odd = par.slice(); odd[S.parRowPixels + 900] ^= 1; // @math the second row's repeat broken
  assert.equal(viewMargin('wide', 'dos', { par: odd, view, trig }), 0, 'a strip that does not repeat gets no margin');
  assert.equal(viewMargin('standard', 'dos', { par, view, trig }), 0);
});

test('the horizon strip in the wide view: modulo its period, seamless at every offset and across both wraps, the standard view\'s centre, today\'s at m = 0', () => {
  const P = stripPeriod(), random = createRandom(3), panorama = Uint8Array.from({ length: P * S.horizonRows }, () => Math.floor(random() * 256)), par = new Uint8Array(S.parBytes);
  for (let j = 0; j < S.horizonRows; j++) for (let p = 0; p < S.parRowPixels; p++) par[j * S.parRowPixels + p] = panorama[j * P + (p % P)];
  assert.ok(stripRepeats(par));
  const [first, , third, fourth] = models().horizon, pictures = new Map();
  for (const [s, m] of [[1, 53], [2, 53], [1, 18], [3, 120]]) { // @math the scales and margins of the tests
    const G = geometryOf({ s, m }), std = geometryOf({ s, m: 0 });
    for (let offset = 0; offset <= S.offsetMax; offset++) {
      const fb = drawStripAt(par, offset, new Uint8Array(G.W * G.H), G), centre = drawStripAt(par, offset, new Uint8Array(std.W * std.H), std);
      const start = offset * S.pixelsPerByte * s;
      for (let j = 0; j < S.horizonRows; j += 7) { // @math every seventh row
        const row = s * (S.horizonRow + j) * G.W;
        for (let X = 0; X < G.W; X++) { const p = Math.floor((start + X - s * m) / s); if (fb[row + X] !== panorama[j * P + (((p % P) + P) % P)]) assert.fail(`${s}x margin ${m} offset ${offset}: column ${X} is not the panorama's`); } // seamless: every column the next of the panorama
        for (let X = 0; X < std.W; X++) if (fb[row + X + s * m] !== centre[s * (S.horizonRow + j) * std.W + X]) assert.fail(`${s}x margin ${m} offset ${offset}: the centre is not the standard view's`);
      }
      if (s === 1 && m === 53) pictures.set(offset, fb.slice(S.horizonRow * G.W, (S.horizonRow + S.horizonRows) * G.W)); // @math the margin at 4 BY 3
    }
  }
  // The horizon offset wraps from `first` to `third` and from `fourth` to `third - first` back (horizon.js): one panorama apart, the same picture.
  assert.equal((third - first) * S.pixelsPerByte, P);
  assert.deepEqual(pictures.get(first), pictures.get(third)); assert.deepEqual(pictures.get(fourth), pictures.get(fourth - (third - first)));
  // The standard view at 1x is today's strip, renderHorizon's.
  for (const offset of [0, 1, 80, 161, S.offsetMax]) { // @math offsets across the range
    const G = geometryOf({ s: 1, m: 0 }), fb = drawStripAt(par, offset, new Uint8Array(G.W * G.H), G), ref = renderHorizon(par, offset, new Uint8Array(F.width * F.height));
    assert.deepEqual(fb.subarray(S.horizonRow * F.width, (S.horizonRow + S.horizonRows) * F.width), ref.subarray(S.horizonRow * F.width, (S.horizonRow + S.horizonRows) * F.width));
  }
  const odd = par.slice(); odd[700] ^= 1; // @math a strip that does not repeat
  assert.throws(() => drawStripAt(odd, 0, new Uint8Array(geometryOf({ s: 1, m: 53 }).W * F.height), geometryOf({ s: 1, m: 53 })), /does not repeat/);
});

test('the sky\'s margins: a row of one index continued exactly, a dithered row made again from its own indices in their shares, the picture\'s columns untouched', () => {
  const random = createRandom(11), rows = S.skyRows + S.horizonRows, sky = new Uint8Array(S.width * F.height), kinds = [];
  for (let y = 0; y < rows; y++) { // a gradient's rows: one index, two in many shares, three
    const n = y % 5 === 0 ? 1 : y % 5 === 4 ? 3 : 2, share = (y % 17) / 17, base = 100 + y; // @math every fifth row one index, every fifth three; the shares vary
    for (let x = 0; x < S.width; x++) { const r = random(); sky[y * S.width + x] = n === 1 ? base : n === 2 ? base + (r < share ? 1 : 0) : base + Math.floor(r * 3); } // @math three indices evenly
    kinds.push(n);
  }
  for (const m of [18, 53, 120]) { // @math the margins of the tests
    const ext = skyMargins(sky, m), refW = S.width + 2 * m;
    assert.equal(ext, skyMargins(sky, m), 'kept per picture and margin'); assert.equal(ext.refW, refW);
    for (let y = 0; y < rows; y++) {
      const row = ext.pixels.subarray(y * refW, (y + 1) * refW), src = sky.subarray(y * S.width, (y + 1) * S.width), count = new Map();
      assert.deepEqual(row.subarray(m, m + S.width), src, 'the picture\'s 320 columns are its own');
      for (const v of src) count.set(v, (count.get(v) ?? 0) + 1);
      const margin = [...row.subarray(0, m), ...row.subarray(m + S.width)];
      assert.ok(margin.every(v => count.has(v)), 'only indices the row holds');
      if (count.size === 1) { assert.equal(ext.dithered[y], 0); assert.ok(margin.every(v => v === src[0]), 'a single index continued exactly'); continue; }
      assert.equal(ext.dithered[y], 1);
      // Any 16 columns of a margin take all sixteen thresholds once: each index fills its share of them to within a pixel.
      for (const side of [row.subarray(0, m), row.subarray(m + S.width)]) for (let a = 0; a + 16 <= side.length; a += 16) for (const [v, n] of count) { // @math the Bayer matrix's sixteen thresholds
        const got = side.subarray(a, a + 16).filter(u => u === v).length; // @math sixteen columns
        assert.ok(Math.abs(got - (16 * n) / S.width) < 1 + 1e-9, `margin ${m} row ${y}: index ${v} ${got} times in 16 columns, its share ${(16 * n) / S.width}`); // @math sixteen columns
      }
    }
    // drawn at a geometry, the margins are these pixels and the centre the picture's
    const G = geometryOf({ s: 2, m }), fb = drawSkyAt(sky, new Uint8Array(G.W * G.H), G); // @math 2x
    for (let Y = 0; Y < S.skyRows * 2; Y += 3) for (let X = 0; X < G.W; X += 5) assert.equal(fb[Y * G.W + X], ext.pixels[G.rowRef[Y] * refW + G.colRef[X] + m]); // @math 2x; a sample of the pixels
  }
  // 'mirror': the row reflected at the picture's edge.
  const mirror = skyMargins(sky, 53, 'mirror'), refW = S.width + 106; // @math the margin at 4 BY 3, both sides
  for (let y = 1; y < rows; y += 5) for (let k = 0; k < 53; k++) { assert.equal(mirror.pixels[y * refW + 52 - k], sky[y * S.width + k]); assert.equal(mirror.pixels[y * refW + 53 + S.width + k], sky[y * S.width + S.width - 1 - k]); } // @math the margin at 4 BY 3
  assert.ok(SKY_MARGIN.modes.includes(SKY_MARGIN.mode)); assert.throws(() => skyMargins(sky, 53, 'stretch'), /no sky margin mode/); // @math the margin at 4 BY 3
});

test('the wide projection: the pinhole inside the fan, continuous at its edge, the floor\'s column of a ray outside it, its own inverse; the pinhole itself at m = 0', () => {
  const world = tables(), te = fanEdge(), m = 53; // @math the margin at 4 BY 3
  assert.ok(Math.abs(te - V.center) < 1e-3, `the fan's edge ${te} entries`); // @math within a thousandth of an entry of the centre column
  // Continuous at the fan's edge: a ray just inside and just outside give the same column, on both sides.
  for (const side of [1, -1]) for (const f of [100, 500, 1000]) { // @math distances
    const l = (f * V.tan) / 2 ** V.fixedBits * side, inside = fromCameraAt(world, f, l * (1 - 1e-12), true, m), outside = fromCameraAt(world, f, l * (1 + 1e-12), true, m); // @math the edge's ray; a hair either side
    assert.ok(Math.abs(inside.column - outside.column) < 1e-9, `side ${side}: ${inside.column} against ${outside.column}`);
    assert.ok(Math.abs(inside.column - (V.center + side * V.center)) < 1e-9); // the fan's edge is the column 0 or 320
  }
  // Outside the fan, a point on the floor's ray of the column u (the TRIG pair at h - angleBias + u) projects onto u (to te's thousandth).
  const camera = { x: 2048, y: 2048, heading: 300 }; // @math the camera of the tests
  for (const u of [-53, -40.5, -20, -1, 320, 333.25, 350, 372]) for (const n of [130, 400, 900]) { // @math margin columns at 4 BY 3, whole and fractional; distances
    const a = camera.heading - F.angleBias + u, e0 = Math.floor(a), t = a - e0, at = e => [world.trig.getInt32((((e % V.turn) + V.turn) % V.turn) * V.trigEntryBytes, true), world.trig.getInt32((((e % V.turn) + V.turn) % V.turn) * V.trigEntryBytes + V.trigEntryBytes / 2, true)]; // @math the second word half an entry on
    const [x0, y0] = at(e0), [x1, y1] = at(e0 + 1), vx = x0 + (x1 - x0) * t, vy = y0 + (y1 - y0) * t, x = camera.x + (vx * n) / 2 ** F.fixedBits, y = camera.y + (vy * n) / 2 ** F.fixedBits; // the caster's ray (16.16)
    const p = projectAt(world, camera, x, y, m);
    assert.ok(Math.abs(p.column - u) < 1e-2, `the ray of column ${u} at ${n}: column ${p.column}`); // @math te's 8e-4 of an entry and the table's 16.16 rounding (a unit in 65536 of a ray is up to 0.005 of an entry), for the ray and the heading
    const back = cameraPointAt(world, p.column, p.distance, m), { f, l } = toCamera(world, camera, x, y);
    assert.ok(Math.abs(back.f - f) < 1e-6 * n && Math.abs(back.l - l) < 1e-6 * n, 'cameraPointAt inverts fromCameraAt'); // @math relative to the distance
    assert.ok(Math.abs(rayRatio(p.column) - l / f) < 1e-9, 'the glitter\'s ray is the projection\'s');
  }
  // At m = 0 and inside the fan, the pinhole and its VIEW clamp, unchanged.
  for (const [f, l] of [[124, 0], [300, -40], [600, 450], [140, -300], [80, 70]]) { // @math in and out of the fan
    assert.deepEqual(fromCameraAt(world, f, l, true, 0), fromCamera(world, f, l)); assert.deepEqual(cameraPointAt(world, 400 + l / 10, 300, 0), cameraPoint(world, 400 + l / 10, 300)); // @math a column outside the fan; a distance
    if (Math.abs(l) * 2 ** V.fixedBits <= f * V.tan) assert.deepEqual(fromCameraAt(world, f, l, true, 53), fromCamera(world, f, l), 'the pinhole inside the fan'); // @math the margin at 4 BY 3
  }
  assert.deepEqual(projectAt(world, camera, 2100, 2300, 0), projectFine(world, camera, 2100, 2300)); // @math a point
  // The sun's glitter: inside the fan the columns' own as before, the margins' along their rays.
  const sun = { f: -0.3, l: 0.9 }, plain = sunGlitter(sun, new Float32Array(S.width)), wide = sunGlitter(sun, new Float32Array(S.width + 2 * m), -m); // @math a sun to the side
  assert.deepEqual(wide.subarray(m, m + S.width), plain); assert.ok(wide[0] !== plain[0] || wide[S.width + 2 * m - 1] !== plain[S.width - 1]); // @math the margins look elsewhere
});

test('the margins\' records: a thing swept through a full turn is drawn once where the wide picture shows it, by the game\'s list inside the fan and by the probes in the margins and at the seams', () => {
  const world = syntheticWorld(), m = 53, G = geometryOf({ s: 1, m }), frames = { heading: CAMERA.heading }, half = world.shapes.get(5)[0].w >> 1, box = viewSetup(world, CAMERA).box; // @math the margin at 4 BY 3; half the width
  let drawn = 0, margin = 0, seams = 0, boxed = 0, cases = 0;
  for (const radius of [100, 125, 150, 300, 600, 900, 1100, 1150, 1200]) for (let angle = 0; angle < V.turn; angle += 2) { // @math distances, near ones at the seams, far ones beyond the game's box at the fan's edges; every second entry of a turn
    const { x, y } = pointAt(angle, radius), P = stateWith(world, { objects: [{ id: 0, x, y, consumed: 0, frame: 0 }], tick: cases }), wide = createWide(); // a new tick each case: the probes run again
    const main = sceneRecords(P, CAMERA, frames), extra = wide.records(P, CAMERA, frames, main, G), inMain = main.some(r => r.object === 0), inMargin = extra.some(r => r.object === 0), p = projectAt(world, CAMERA, x, y, m);
    cases++;
    assert.ok(!(inMain && inMargin), `angle ${angle} radius ${radius}: two records of one thing`);
    if (!p) { assert.ok(!inMain && !inMargin); continue; }
    if (Math.abs(p.distance - V.minDistance) < 1 || Math.abs(p.distance - V.maxDistance) < 1 || Math.abs(p.column - (-m - half)) < 0.5 || Math.abs(p.column - (V.maxColumn + m + half)) < 0.5) continue; // @math a hair from the limits, where whole and fractional units may decide otherwise
    const band = p.column >= WIDE.seam && p.column <= V.maxColumn - WIDE.seam, shown = p.column >= -m - half && p.column <= V.maxColumn + m + half && p.distance >= V.minDistance && p.distance <= V.maxDistance;
    if (band) { assert.ok(!inMargin, `angle ${angle} radius ${radius}: a margin record inside the fan (column ${p.column})`); if (inMain) drawn++; continue; } // the game's list decides inside the fan (its box culls far things there)
    if (p.column >= 0 && p.column <= V.maxColumn && (x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1)) { // at a seam inside the reference columns, outside the game's box: the game's decision, as in the rest of its columns
      assert.ok(!inMain && !inMargin, `angle ${angle} radius ${radius}: column ${p.column.toFixed(2)}, outside the game's box, is drawn (${inMain ? 'main' : 'margin'})`);
      boxed++; continue;
    }
    assert.equal(inMain || inMargin, shown, `angle ${angle} radius ${radius}: column ${p.column.toFixed(2)}, distance ${p.distance.toFixed(1)}: ${inMain ? 'main' : inMargin ? 'margin' : 'none'}, expected ${shown ? 'drawn' : 'not drawn'}`);
    if (inMain || inMargin) drawn++;
    if (inMargin) margin++;
    if (inMargin && p.column >= 0 && p.column <= V.maxColumn) seams++; // inside the reference columns at a seam, where the game's whole-unit column dropped it (never its box)
  }
  assert.ok(margin > 100 && drawn > margin && seams > 0 && boxed > 0, `${margin} margin records of ${drawn} drawn in ${cases} cases, ${seams} of them inside the reference columns at a seam, ${boxed} seam cases outside the game's box`); // @math enough of each
});

test('the margins\' records: the game\'s filters through the probes (consumed objects, wrecked racers gone, gone and skipped ducks, no starter while it is not shown, in the duck game or in the shoot-out), the probe\'s frame bytes, one record a thing', () => {
  const world = syntheticWorld(), m = 53, G = geometryOf({ s: 1, m }), frames = { heading: CAMERA.heading }, left = pointAt(-190, 300), right = pointAt(190, 300), far = pointAt(195, 500); // @math outside the fan at 4 BY 3 (160 entries), within its margin
  const margins = (P, wide = createWide()) => { const main = sceneRecords(P, CAMERA, frames); return { main, extra: wide.records(P, CAMERA, frames, main, G), wide }; };
  // A racer and an object in the margins are drawn there, with the frame bytes the aimed probe's draw list gives them.
  const live = stateWith(world, { objects: [{ id: 0, ...left, consumed: 0, frame: 0 }], racers: [{ ...right, n: 1, compass: 3 }] });
  const { main, extra } = margins(live);
  assert.ok(!main.some(r => r.object === 0 || r.racer === 1), 'the reference fan does not hold them');
  for (const key of ['o0', 'r1']) {
    const r = extra.find(e => recordKey(e) === key), at = key === 'o0' ? left : right, probe = sceneRecords(live, probeCamera(world, CAMERA, at.x, at.y), frames).find(e => recordKey(e) === key);
    assert.ok(r && probe, `${key} is drawn in the margin`); assert.ok(r.margin);
    assert.equal(r.frame.buffer, probe.frame.buffer); assert.equal(r.frame.byteOffset, probe.frame.byteOffset, `${key}: the probe's frame bytes`);
    assert.ok(r.left + (r.picture.w >> 1) < 0 || r.left + (r.picture.w >> 1) > V.maxColumn, `${key} stands in a margin`);
  }
  // The filters: none of these is drawn in the margins.
  const none = (P, key, why) => assert.ok(!margins(P).extra.some(r => recordKey(r) === key), why);
  none(stateWith(world, { objects: [{ id: 0, ...left, consumed: 0xffff, frame: 0 }] }), 'o0', 'a consumed object'); // @math the consumed marker
  none(stateWith(world, { racers: [{ ...right, n: 1, compass: 3, crashed: 1, crashPic: 99 }] }), 'r1', 'a racer gone after its crash'); // @math past its crash pictures
  const duck = { duck: true, car: { px: CAMERA.x - 3000, py: CAMERA.y, heading: 0 } }; // @math the human far behind
  none(stateWith(world, { ...duck, racers: [{ ...right, n: 1, compass: 3, crashed: 1, crashPic: 99 }] }), 'r1', 'a gone duck'); // @math past its crash pictures
  none(stateWith(world, { ...duck, racers: [{ ...right, n: 1, compass: 3, hp: 0, flicker: 1 }] }), 'r1', 'a skipped duck');
  assert.ok(margins(stateWith(world, { ...duck, racers: [{ ...right, n: 1, compass: 3, hp: 3, flicker: 0 }] })).extra.some(r => recordKey(r) === 'r1'), 'a live duck is drawn'); // @math a duck's hit points
  const lionWorld = { ...world, start: { x: far.x - 0x28, y: far.y + 10, heading: 0 } }; // @math the starter stands 0x28 right of and 10 above the start point (start.js starterPoint)
  assert.ok(margins(stateWith(lionWorld)).extra.some(r => recordKey(r) === 'lion'), 'the starter is drawn in the margin');
  none(stateWith(lionWorld, { lionShown: false }), 'lion', 'no starter once the start decided it is not shown');
  none(stateWith(lionWorld, { duck: true }), 'lion', 'no starter in the duck game');
  // The shoot-out (never wide on the page: always the split screen or a link race), forged all the same: its other human in the right margin
  // is drawn there through the probes (versus.js viewRacers), its starter never.
  const shootout = { intro: false, car: { cx: CAMERA.x, cy: CAMERA.y, heading: CAMERA.heading, px: CAMERA.x, py: CAMERA.y, horizon: 100, pic: { table: 'lean', row: 2 } }, fx: null, humanSlot: 7, seat2: { car: { px: right.x, py: right.y, heading: 0, wrecked: 0 }, humanSlot: 1 }, versus: { kind: 'shootout', viewer: 0, modes: [0, 0], blinks: [[], []] } }; // @math the own car on the camera, straight (control.js's lean row 2); the other human in slot 1; the first viewer, both modes 0
  const duel = margins(stateWith(lionWorld, shootout)).extra;
  assert.ok(duel.some(r => recordKey(r) === 'r1'), 'the shoot-out\'s other human is drawn in the margin'); assert.ok(!duel.some(r => recordKey(r) === 'lion'), 'no starter in the shoot-out');
  // One probe serves its neighbours: two objects side by side in a margin take one probe; what a probe found is kept for the tick.
  const pair = stateWith(world, { objects: [{ id: 0, ...left, consumed: 0, frame: 0 }, { id: 0, x: left.x + 6, y: left.y + 4, consumed: 0, frame: 0 }] }), w = createWide(); // @math a neighbour a few units away
  assert.equal(margins(pair, w).extra.length, 2); assert.equal(w.probes, 1);
  margins(pair, w); assert.equal(w.probes, 1, 'the same tick asks no more');
  margins({ ...pair, tick: 1 }, w); assert.equal(w.probes, 2, 'the next tick asks again');
  w.reset(); margins(pair, w); assert.equal(w.probes, 3, 'a reset forgets'); // @math the third probe
  // The candidates are every thing that may be drawn.
  assert.deepEqual(wideCandidates(pair).map(c => c.key), ['r0', 'o0', 'o1', 'lion']);
});

test('the game\'s order kept: the margin records merged in by distance, after the game\'s records of their distance', () => {
  const r = (distance, id) => ({ distance, id }), main = sortDrawList([r(5, 'a'), r(5, 'b'), r(9, 'c'), r(2, 'd')]), extra = sortDrawList([r(5, 'x'), r(9, 'y'), r(1, 'z')]); // @math distances with ties
  const out = mergeOrder(main, extra);
  assert.deepEqual(out.filter(e => 'abcd'.includes(e.id)), main, 'the game\'s order of its own records');
  assert.deepEqual(out.map(e => e.distance), [9, 9, 5, 5, 5, 2, 1]); // @math farthest first
  assert.equal(out.findIndex(e => e.id === 'y'), 1); assert.equal(out.findIndex(e => e.id === 'x'), 4); // @math after the game's records of the same distance
  assert.equal(mergeOrder(main, []), main);
  // Merging before the game's sort would not keep its order: the selection sort is not stable.
  const before = sortDrawList([r(5, 'a'), r(5, 'b'), r(9, 'y')]).filter(e => e.id !== 'y').map(e => e.id);
  assert.deepEqual(before, ['b', 'a'], 'a record merged into the queue reorders two of the game\'s of one distance'); assert.deepEqual(sortDrawList([r(5, 'a'), r(5, 'b')]).map(e => e.id), ['a', 'b']);
});

test('the HUD\'s places: every overlay pixel moved by the margin, in the HUD layer and in the world\'s blocks; nowhere at m = 0', () => {
  const id = hudPlaces(geometryOf({ s: 1, m: 0 }));
  assert.ok(id.hud.every((o, i) => o === i) && id.world.every((o, i) => o === i));
  for (const [s, m] of [[1, 53], [2, 53], [2, 18]]) { // @math the scales and margins of the tests
    const G = geometryOf({ s, m }), P = hudPlaces(G);
    assert.equal(P, hudPlaces(G), 'kept per geometry');
    for (let y = 0, i = 0; y < F.height; y++) for (let x = 0; x < F.width; x++, i++) { assert.equal(P.hud[i], y * G.refW + x + m); assert.equal(P.world[i], G.sample[i]); }
    assert.equal(new Set(P.hud).size, F.width * F.height, 'no two pixels on one place');
  }
});


test('a wide frame through the enhancer: its size, its HUD moved by the margin, the standard view where the screen may not be wide or the display cannot show it', () => {
  const state = raceOf();
  const draw = (settings, ctx) => {
    const enh = createEnhancer({ storage: memory(), trace: true }); enh.configure(settings);
    const index = new Uint8Array(F.width * F.height), out = new Uint8ClampedArray(F.width * F.height * 4), layers = { world: new Uint8ClampedArray(F.width * F.height * 4), hud: new Uint8ClampedArray(F.width * F.height * 4) }, palette = new Uint8ClampedArray(1024).fill(255); // @math four bytes a colour; 256 colours
    enh.drawSingle(state, 1, { index, out, palette, mode: 1, overlays: (P, fb) => { fb[5 * F.width + 7] = 9; }, layers, ...ctx }); // @math one overlay pixel at 7,5
    return enh;
  };
  const wide = draw({ ...PRESETS.original, smooth: true, view: 'wide' }, { worldReady: true, aspect: 'dos' }), l = wide.layers();
  assert.deepEqual([l.world.w, l.world.h, l.logical.w, l.hud.w], [426, 200, 426, 426]); // @math 53 columns a side at 4 BY 3
  for (let i = 0; i < l.hud.w * l.hud.h; i++) assert.equal(l.hud.data[i * 4 + 3] !== 0, i === 5 * 426 + 7 + 53, `the HUD layer's pixel ${i}`); // @math the overlay at 7,5 moved by 53
  assert.ok(wide.inspect().trace.records.some(r => r.margin), 'the object in the margin is drawn');
  const two = draw({ ...PRESETS.original, smooth: true, view: 'wide', scale: 2 }, { worldReady: true, aspect: 'wide' }).layers(); // @math 2x on 16 BY 10
  assert.deepEqual([two.world.w, two.world.h, two.logical.w], [712, 400, 356]); // @math 18 columns a side, twice
  for (const ctx of [{ worldReady: false, aspect: 'dos' }, { worldReady: true, aspect: 'dos', wideAllowed: false }, { worldReady: true }]) assert.equal(draw({ ...PRESETS.original, smooth: true, view: 'wide' }, ctx).layers().world.w, F.width, JSON.stringify(ctx)); // no WebGL 2; a link race or a slides demo; no shape given
});

test('the HUD in the picture in the wide view: the overlays stamped into the world as s x s blocks at their place moved by m, by the frame and by drawOver over a kept frame', () => {
  const state = raceOf(), palette = new Uint8ClampedArray(1024).fill(255), first = [10, 20, 30], second = [40, 50, 60]; // @math 256 colours; two overlay colours the white world never has
  palette.set(first, 9 * 4); palette.set(second, 12 * 4); // @math the overlays' indices 9 and 12, four bytes a colour
  for (const [s, aspect, m] of [[1, 'dos', 53], [2, 'dos', 53], [2, 'wide', 18]]) { // @math 4 BY 3 at 1x and 2x, 16 BY 10 at 2x
    const enh = createEnhancer({ storage: memory() }); enh.configure({ ...PRESETS.original, smooth: true, view: 'wide', scale: s });
    const index = new Uint8Array(F.width * F.height), out = new Uint8ClampedArray(F.width * F.height * 4); // @math four bytes a colour
    enh.drawSingle(state, 1, { index, out, palette, mode: 1, overlays: (P, fb) => { fb[5 * F.width + 7] = 9; }, layers: null, worldReady: true, aspect }); // @math one overlay pixel at 7,5
    const l = enh.layers(), label = `${s}x ${aspect}`;
    assert.deepEqual([l.world.w, l.logical.w, l.hud], [s * (F.width + 2 * m), F.width + 2 * m, null], `${label}: no HUD layer`); // @math a margin either side
    const at = (world, w, X, Y) => [...world.subarray((Y * w + X) * 4, (Y * w + X) * 4 + 3)]; // @math four bytes a colour, three components
    const block = (world, w, x, y, colour, what) => { for (let q = 0; q < s; q++) for (let r = 0; r < s; r++) assert.deepEqual(at(world, w, s * (x + m) + r, s * y + q), colour, `${label}, ${what}: the block of ${x},${y} moved by ${m}`); assert.notDeepEqual(at(world, w, s * x, s * y), colour, `${label}, ${what}: not at its unmoved place`); assert.notDeepEqual(at(world, w, s * (x + m) - 1, s * y), colour, `${label}, ${what}: nor beside its block`); };
    block(l.world.data, l.world.w, 7, 5, first, 'the frame'); // @math the overlay pixel at 7,5
    // drawOver over the kept frame (the menu of a lost race), the HUD in the picture: the new overlay stamped into the kept world the same way.
    const kept = enh.keepLayers(); index[6 * F.width + 9] = 12; // @math a new overlay pixel at 9,6
    const o = enh.drawOver({ out: new Uint8ClampedArray(out.length), base: out, index, palette, overlay: fb => { fb[6 * F.width + 9] = 12; }, kept, hudLayer: false }); // @math the same pixel
    assert.deepEqual([o.world.w, o.logical.w, o.hud], [l.world.w, l.logical.w, null], `${label}: drawOver keeps the frame's size, no HUD layer`);
    block(o.world.data, o.world.w, 9, 6, second, 'drawOver'); block(o.world.data, o.world.w, 7, 5, first, 'the kept frame\'s own'); // @math the two overlay pixels
  }
});

test('the water hook\'s own column (its sixth argument): from the picture\'s first reference column -m to its last, also where the first block of modes 2 and 3 starts left of it', () => {
  const world = { ...syntheticWorld(), ...floorOf() }, texels = new Uint8Array(108 * F.tileBytes).fill(1); // @math every texel of the 108 tiles a liquid
  for (const [s, m] of [[1, 53], [2, 53], [2, 18], [1, 8]]) for (const mode of [1, 2, 3]) { // @math odd and even margins at 1x and 2x
    const G = geometryOf({ s, m }), size = G.W * G.H, label = `${s}x margin ${m} mode ${mode}`;
    let lo = Infinity, hi = -Infinity, calls = 0;
    castFloor(world, CAMERA, mode, new Uint8Array(size), G, { liquid: { texels, wet: new Uint8Array(size), wave: new Float32Array(size), shade: (kind, x, y, c, k, column) => { lo = Math.min(lo, column); hi = Math.max(hi, column); calls++; return 0; } } });
    assert.ok(calls > 0, `${label}: the hook ran`); assert.equal(lo, -m, `${label}: the first column (the glitter's index 0, scene.js's refW columns from -m)`); assert.ok(hi <= V.maxColumn + m, `${label}: the last column ${hi}`);
  }
});

