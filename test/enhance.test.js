// The Enhanced presentation (src/enhance) on synthetic data: settings, smooth motion's blend and its discontinuities, the floor adapter
// against the reference floor, the compositor's masks and layers, the shadows and the lint rules of the directory. No game files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, presetOf, applyPreset, change, resetSettings, anyEffect, loadSettings, saveSettings } from '../src/enhance/settings.js';
import { DEFAULTS, PRESETS, EFFECTS, STORAGE_KEY, MOTION, SHADOW } from '../src/enhance/config.js';
import { capture, blend, present, turnDelta, wrapHeading, blendHorizon, createMotion } from '../src/enhance/motion.js';
import { drawFloor, rowAt, KIND } from '../src/enhance/project.js';
import { renderFloor } from '../src/render/floor.js';
import { composite, overlayMask, SENTINEL } from '../src/enhance/composite.js';
import { stampShadow, casterOf } from '../src/enhance/shadows.js';
import { createLayers } from '../src/enhance/scene.js';
import { createRandom } from '../src/enhance/particles.js';
import { lintSource } from '../tools/lint/constants.mjs';
import { claims } from '../src/evidence/registry.js';

const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const deepFreeze = o => { if (o && typeof o === 'object' && !ArrayBuffer.isView(o) && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };

test('settings: the Original preset by default, presets, custom, levels, storage', () => {
  const d = resetSettings();
  assert.equal(d.preset, 'original');
  assert.equal(anyEffect(d), false);
  const e = applyPreset(d, 'enhanced');
  assert.equal(e.preset, 'enhanced');
  for (const k of EFFECTS) assert.equal(e[k], true);
  const custom = change(e, 'fog', false);
  assert.equal(custom.preset, 'custom');
  assert.equal(presetOf(change(custom, 'fog', true)), 'enhanced');
  assert.equal(normalize({ shadowStrength: 7, fogStrength: -1, particleAmount: 0.333, junk: 1, smooth: 'yes' }).shadowStrength, 1);
  assert.equal(normalize({ fogStrength: -1 }).fogStrength, 0);
  assert.equal(normalize({ particleAmount: 0.333 }).particleAmount, 0.325); // kept in fortieths
  assert.equal(normalize({ smooth: 'yes' }).smooth, false);
  assert.equal('junk' in normalize({ junk: 1 }), false);
  const s = memoryStorage();
  assert.deepEqual(loadSettings(s), normalize(DEFAULTS));
  assert.equal(saveSettings(e, s), true);
  assert.deepEqual(loadSettings(s), e);
  s.setItem(STORAGE_KEY, '{broken');
  assert.deepEqual(loadSettings(s), resetSettings());
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(throwing), resetSettings());
  assert.equal(saveSettings(e, throwing), false);
  assert.deepEqual(PRESETS.original, Object.fromEntries(EFFECTS.map(k => [k, false])));
});

const world = { name: 'w' };
const car = (o = {}) => ({ cx: 1000, cy: 2000, heading: 100, px: 1100, py: 2050, horizon: 80, surface: 0, speed: 0, jump: 0, special: 0, specialValue: 0, spark: 0, sparkCount: 0, crashed: 0, ...o });
const raceState = (o = {}) => ({ world, tick: 10, car: car(), beforeAnswer: null, ai: { racers: [{ x: 0, y: 0 }, { x: 1500, y: 1500 }] }, shots: [{ active: 0 }, { active: 1, x: 900, y: 900 }], ...o });

test('smooth motion: headings and the horizon take the short way round', () => {
  assert.equal(turnDelta(1900, 20), 40);
  assert.equal(turnDelta(20, 1900), -40);
  assert.equal(turnDelta(0, 960), 960);
  assert.equal(wrapHeading(-20), 1900);
  const a = capture(raceState({ car: car({ heading: 1900, horizon: 238 }) })), b = capture(raceState({ tick: 11, car: car({ heading: 20, horizon: 82 }) }));
  const mid = blend(a, b, 0.5);
  assert.equal(wrapHeading(Math.round(mid.seats[0].heading)), 0); // 1900 -> 1920 = 0 -> 20
  assert.equal(mid.seats[0].horizon, 240); // 238 -> 240 = 80 -> 82: four steps to the right across the wrap
  assert.equal(blendHorizon(2, 158, 0.5), 0); // 2 -> 0 = 160 -> 158 to the left
  assert.equal(blendHorizon(2, 158, 0.75), 159);
  for (let t = 0; t <= 1; t += 0.125) { const h = blendHorizon(238, 82, t); assert.ok(h >= 0 && h <= 240, `horizon ${h}`); }
});

test('smooth motion: discontinuities are shown at once, new scenes start fresh', () => {
  const a = capture(raceState()), far = capture(raceState({ tick: 11, car: car({ cx: 1000 + MOTION.snapDistance + 1 }) }));
  assert.equal(blend(a, far, 0.5).seats[0].cx, far.seats[0].cx);
  const turn = capture(raceState({ tick: 11, car: car({ heading: 100 + MOTION.snapTurn + 1 }) }));
  assert.equal(blend(a, turn, 0.5).seats[0].heading, turn.seats[0].heading);
  const near = capture(raceState({ tick: 11, car: car({ cx: 1040 }) }));
  assert.equal(blend(a, near, 0.5).seats[0].cx, 1020);
  const other = capture(raceState({ world: { name: 'x' }, tick: 11, car: car({ cx: 1040 }) }));
  assert.equal(blend(a, other, 0.5), other);
  const earlier = capture(raceState({ tick: 3, car: car({ cx: 1040 }) }));
  assert.equal(blend(a, earlier, 0.5), earlier);
  const racerJump = capture(raceState({ tick: 11, ai: { racers: [{ x: 0, y: 0 }, { x: 1500 + MOTION.snapDistance * 2, y: 1500 }] } }));
  assert.equal(blend(a, racerJump, 0.5).racers[1].x, racerJump.racers[1].x);
  const spawned = capture(raceState({ tick: 11, shots: [{ active: 1, x: 5, y: 5 }, { active: 1, x: 910, y: 900 }] }));
  const shots = blend(a, spawned, 0.5).shots;
  assert.deepEqual([shots[0].x, shots[1].x], [5, 905]); // a shot that was not there is drawn where it is
});

test('smooth motion: the camera the frame is drawn from, the present state copies and never writes', () => {
  const s = deepFreeze(raceState({ beforeAnswer: { cx: 990, cy: 1990, heading: 90 } }));
  const snap = capture(s);
  assert.deepEqual([snap.seats[0].cx, snap.seats[0].heading, snap.seats[0].px], [990, 90, 1100]);
  const b = capture(raceState({ tick: 11, car: car({ cx: 1001.5, px: 1101 }) }));
  const P = present(s, blend(snap, b, 0.5));
  assert.deepEqual(P.beforeAnswer, { cx: Math.round(995.75), cy: 1995, heading: 95 }); // the frame is drawn from the blended camera (90 -> 100)
  assert.equal(P.car.cx, 1000); // the car keeps the tick's words but stands at the blended point
  assert.equal(P.car.px, Math.round(1100.5));
  assert.notEqual(P.car, s.car);
  assert.equal(s.car.px, 1100);
  assert.equal(blend(snap, b, 0.5).seats[0].tickHeading, 100); // the racers' direction frames keep the tick's heading
  const versus = deepFreeze(raceState({ versus: { viewer: 0 }, seat2: { car: car({ cx: 3000 }), beforeAnswer: null } }));
  const two = capture(versus);
  assert.equal(two.seats.length, 2);
  const VP = present(versus, two);
  assert.equal(VP.seat2.beforeAnswer.cx, 3000);
  assert.equal(versus.seat2.beforeAnswer, null);
  assert.notEqual(VP.seat2, versus.seat2);
  assert.notEqual(VP.versus, versus.versus);
});

test('smooth motion: a blend that goes back without a tick carries on from the picture shown', () => {
  const m = createMotion(), s = raceState();
  m.tick(s, 88);
  const next = raceState({ tick: 11, car: car({ cx: 1088 }) });
  m.tick(next, 88);
  const shown = m.view(next, 0.75, 88).seats[0].cx;
  assert.equal(shown, 1066);
  assert.equal(m.view(next, 0, 88).seats[0].cx, shown); // the page restarted its accumulator (the in-race menu closed): no jump back
  assert.equal(m.view(next, 1, 88).seats[0].cx, 1088);
  m.reset();
  assert.equal(m.view(next, 0.3, 88).seats[0].cx, 1088); // after a reset the state is shown as it is
  assert.ok(Math.abs(m.takeDelay() - (0.25 + 1 + 0 + 0.7) * 88 / 4) < 1e-9);
});

// A synthetic floor: a TRIG table, NDIST distances, a map of tile ids and two sheets of tile pixels.
function syntheticFloor() {
  const trig = new DataView(new ArrayBuffer(1920 * 8));
  for (let h = 0; h < 1920; h++) { trig.setInt32(h * 8, Math.round(Math.cos((2 * Math.PI * h) / 1920) * 65536), true); trig.setInt32(h * 8 + 4, Math.round(Math.sin((2 * Math.PI * h) / 1920) * 65536), true); }
  const ndist = new DataView(new ArrayBuffer(320 * 70 * 4));
  for (let c = 0; c < 320; c++) for (let k = 0; k < 70; k++) ndist.setUint32((c * 70 + k) * 4, 110 + k * k + (c % 9), true);
  const random = createRandom(99), tiles = Uint8Array.from({ length: 4096 }, () => Math.floor(random() * 108)), sheets = [0, 1].map(() => Uint8Array.from({ length: 54 * 1024 }, () => Math.floor(random() * 256)));
  return { trig, ndist, tiles, sheets };
}

test('the floor adapter draws the reference floor at a whole-unit camera, and moves within a texel at fractions', () => {
  const w = syntheticFloor();
  for (const mode of [1, 2, 3]) for (const camera of [{ x: 2048, y: 2048, heading: 0 }, { x: 1500, y: 2700, heading: 1777 }, { x: 1037, y: 3001, heading: 481 }]) {
    const a = renderFloor(w, camera, mode, new Uint8Array(64000)), b = drawFloor(w, camera, mode, new Uint8Array(64000));
    assert.deepEqual(b, a, `mode ${mode} camera ${JSON.stringify(camera)}`);
  }
  const at = { x: 1500, y: 2700, heading: 1777 }, a = renderFloor(w, at, 1, new Uint8Array(64000)), b = drawFloor(w, { ...at, x: 1500.5 }, 1, new Uint8Array(64000));
  assert.notDeepEqual(b, a);
  assert.deepEqual(drawFloor(w, { ...at, x: 1500.999999 }, 1, new Uint8Array(64000)).subarray(0, 64000), drawFloor(w, { ...at, x: 1500.9999995 }, 1, new Uint8Array(64000)));
});

test('the row of a distance between the entries of the row table', () => {
  const rows = Uint16Array.from([240, 200, 180, 170]);
  assert.equal(rowAt(rows, 1), 200);
  assert.equal(rowAt(rows, 1.5), 190);
  assert.equal(rowAt(rows, 99), 170);
  assert.equal(rowAt(rows, -3), 240);
});

test('the compositor: overlays untouched, shadows only on the ground, fog by distance, particles behind nearer pictures hidden', () => {
  const width = 4, size = 8, L = createLayers(size), palette = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) palette.set([i, i, i, 255], i * 4);
  const index = Uint8Array.from([200, 200, 200, 200, 100, 100, 100, 100]);
  L.kind.set([KIND.sky, KIND.horizon, KIND.floor, KIND.sprite, KIND.floor, KIND.floor, KIND.sprite, KIND.floor]);
  L.depth.set([Infinity, Infinity, 500, 500, 120, 120, 100, 120]);
  L.shade.fill(1);
  const buffer = new Uint16Array(size).fill(SENTINEL); buffer[7] = 100; // an overlay pixel that has the colour under it
  const mask = overlayMask(buffer, new Uint8Array(size));
  assert.deepEqual([...mask], [0, 0, 0, 0, 0, 0, 0, 1]);
  const ramp = new Float32Array(1200); ramp.fill(0.5, 400);
  const out = composite(new Uint8ClampedArray(size * 4), { index, mask, L, palette, width, effects: { shadow: 1, fog: { color: [0, 0, 255], ramp, horizon: 0.25 }, cap: 255 }, splats: [] });
  const px = i => [...out.subarray(i * 4, i * 4 + 3)];
  assert.deepEqual(px(0), [200, 200, 200]); // the sky
  assert.deepEqual(px(1), [150, 150, 214]); // the horizon strip, a quarter of the way
  const shaded = Math.round(200 * (1 - SHADOW.opacity));
  assert.deepEqual(px(2), [Math.round(shaded / 2), Math.round(shaded / 2), Math.round((shaded + 255) / 2)]); // the far ground: shadow, then half fog
  assert.deepEqual(px(3), [100, 100, 228]); // a far picture: no shadow, half fog
  assert.deepEqual(px(7), [100, 100, 100]); // the overlay pixel
  const before = Uint8ClampedArray.from(out);
  composite(out, { index, mask, L, palette, width, effects: { shadow: 0, fog: null }, splats: [{ x: 2, y: 1.5, r: 3, depth: 110, color: [255, 0, 0], alpha: 1, soft: false, map: y => y }] });
  assert.deepEqual(px(4), [255, 0, 0]); // in front of the ground
  assert.deepEqual(px(6), [100, 100, 100]); // behind the nearer picture
  assert.deepEqual(px(7), [100, 100, 100]); // under the overlay
  assert.notDeepEqual(out, before);
});

test('shadows: the ellipse under the anchor, the larger of two, none for a falling, wrecked or flying own car', () => {
  const L = createLayers(320 * 200), c = { x: 160, y: 190, rx: 10, strength: 1 };
  stampShadow(L, c, 320, 200);
  const centreRow = Math.floor(190 - 0.5 - SHADOW.rise * Math.max(10 * SHADOW.aspect, SHADOW.minRows / 2));
  assert.ok(L.shade[centreRow * 320 + 160] > 0.9);
  assert.equal(L.shade[centreRow * 320 + 171], 0);
  assert.equal(L.shade[150 * 320 + 160], 0);
  stampShadow(L, { ...c, strength: 0.1 }, 320, 200);
  assert.ok(L.shade[centreRow * 320 + 160] > 0.9);
  stampShadow(L, { x: 0, y: 199, rx: 40, strength: 1 }, 320, 200); // clipped at the edges
  const picture = { w: 38, h: 28 }, own = { type: 0, left: 141, top: 160, picture, firstColumn: 0 }, opts = { shadows: true, sceneryShadows: true };
  const P = { car: {}, fx: {} };
  assert.equal(casterOf(own, P, null, 188, opts).y, 188);
  assert.ok(casterOf({ ...own, top: 150 }, P, null, 188, opts).strength < 1); // lifted
  assert.equal(casterOf(own, { ...P, fx: { pit: {} } }, null, 188, opts), null);
  assert.equal(casterOf(own, { ...P, car: { wrecked: true } }, null, 188, opts), null);
  assert.equal(casterOf(own, { ...P, fx: { crash: {} } }, null, 188, opts), null);
  assert.equal(casterOf({ ...own, type: -1, object: 3 }, P, null, 188, opts), null); // scenery without a footprint
  assert.equal(casterOf({ ...own, type: -1, object: 3, shot: 1 }, P, { minX: 1, maxX: 5 }, 188, opts), null); // shots fly
  assert.equal(casterOf({ ...own, type: 1, racer: 2 }, { ai: { racers: [0, 0, { crashed: 1 }] } }, null, 188, opts), null);
});

test('the visual random source is deterministic and its own', () => {
  const a = createRandom(5), b = createRandom(5), seq = Array.from({ length: 5 }, a);
  assert.deepEqual(Array.from({ length: 5 }, b), seq);
  assert.ok(seq.every(v => v >= 0 && v < 1));
  const keep = Math.random;
  Math.random = () => { throw new Error('the game\'s random source was used'); };
  try { createRandom(1)(); } finally { Math.random = keep; }
});

test('lint: the design numbers stay in config.js, no claims, no writes to the state, only the page imports src/enhance', async () => {
  const at = f => `src/enhance/${f}`;
  assert.deepEqual(await lintSource('export const A = 0.42;', at('config.js'), claims), []);
  assert.match((await lintSource('export const a = 0.42;', at('fx.js'), claims)).join('\n'), /outside config.js/);
  assert.deepEqual(await lintSource('export const a = x => x * 4; // @math four bytes a colour', at('fx.js'), claims), []);
  assert.match((await lintSource("import { K } from '../evidence/k.js';\nexport const a = () => K(1, 'mz.header');", at('fx.js'), claims)).join('\n'), /cites no claims/);
  assert.match((await lintSource('export function f(state) { state.car.cx = 0; }', at('fx.js'), claims)).join('\n'), /never writes the race state/);
  assert.match((await lintSource('export function f(state) { state.tick++; }', at('fx.js'), claims)).join('\n'), /never writes the race state/);
  assert.deepEqual(await lintSource('export function f(state) { const P = { ...state }; P.car = 1; return P; }', at('fx.js'), claims), []);
  assert.match((await lintSource("import { createEnhancer } from '../enhance/index.js';", 'src/render/fixture.js', claims)).join('\n'), /only the pages import src\/enhance/);
  assert.deepEqual(await lintSource("import { createEnhancer } from './enhance/index.js';", 'src/play.js', claims), []);
  assert.match((await lintSource("import x from '../formats/hypotheses/x.js';", at('fx.js'), claims)).join('\n'), /may not import formats\/hypotheses/);
});

// A synthetic ground for the projection: the TRIG table, VIEW words of 1.0 and the game's row table.
import { fromCamera, cameraPoint, toCamera } from '../src/enhance/project.js';
import { buildRowTable } from '../src/game/view.js';
import { createMarks, skidding } from '../src/enhance/marks.js';
import { fillQuad } from '../src/enhance/raster.js';
import { sunDirection, castShadow } from '../src/enhance/shadows.js';
import { soundNumber } from '../src/game/sounds.js';
import { specialSurfaces } from '../src/game/surface.js';
import { MARKS, LEVELS } from '../src/enhance/config.js';
function syntheticGround() {
  const { trig } = syntheticFloor(), view = new DataView(new ArrayBuffer(320 * 4));
  for (let c = 0; c < 320; c++) view.setUint32(c * 4, 16384, true);
  return { name: '1', trig, view, rows: buildRowTable(), sdx: { records: [] } };
}

test('the camera point of a column and a distance is the point that projects there', () => {
  const w = syntheticGround();
  for (const [f, l] of [[124, 0], [300, -40], [600, 120], [140, 25.5]]) {
    const p = fromCamera(w, f, l), back = cameraPoint(w, p.column, p.distance);
    assert.ok(Math.abs(back.f - f) < 1e-6 && Math.abs(back.l - l) < 1e-6, `${f},${l} -> ${back.f},${back.l}`);
  }
  assert.ok(fromCamera(w, 100, 30).column > 160); // the right of the camera is the right of the screen
  const c = toCamera(w, { x: 1000, y: 1000, heading: 0 }, 1100, 1010);
  assert.ok(Math.abs(c.f - 100) < 1e-9 && Math.abs(c.l - 10) < 1e-9);
});

test('the quad fill takes the covered part of each pixel, and keeps the larger value', () => {
  const layer = new Float32Array(16);
  fillQuad(layer, [[1, 1], [3, 1], [3, 3], [1, 3]], 0.8, 4, 4);
  assert.deepEqual([...layer].map(v => Math.round(v * 100) / 100), [0, 0, 0, 0, 0, 0.8, 0.8, 0, 0, 0.8, 0.8, 0, 0, 0, 0, 0]);
  const thin = new Float32Array(16);
  fillQuad(thin, [[1.25, 0], [1.75, 0], [1.75, 4], [1.25, 4]], 1, 4, 4);
  assert.ok(Math.abs(thin[5] - 0.5) < 1e-6 && thin[4] === 0 && thin[6] === 0);
  fillQuad(thin, [[1, 0], [2, 0], [2, 4], [1, 4]], 0.3, 4, 4);
  assert.ok(Math.abs(thin[5] - 0.5) < 1e-6);
  const kinds = Uint8Array.from({ length: 16 }, (_, i) => (i % 2 ? KIND.floor : KIND.sprite)), only = new Float32Array(16);
  fillQuad(only, [[0, 0], [4, 0], [4, 1], [0, 1]], 1, 4, 4, kinds, KIND.floor);
  assert.deepEqual([...only.subarray(0, 4)], [0, 1, 0, 1]);
});

test('skid marks: the game\'s skid states, the surfaces it drives on, a bounded ring that fades and resets', () => {
  const skid = soundNumber('SKID'), S = specialSurfaces();
  assert.equal(skidding({ drift: 1, turn: 0, hop: 0 }), true);
  assert.equal(skidding({ drift: 0, turn: 0, hop: 0 }), false);
  assert.equal(skidding({ drift: 0, turn: 0, hop: 0 }, [{ id: skid, guard: true }]), true);
  assert.equal(skidding({ drift: 0, turn: 0, hop: 0 }, [skid + 1]), false);
  const w = syntheticGround(), seat = o => ({ cx: 1000, cy: 1000, heading: 0, dir: 0, px: 1124, py: 1000, surface: 0, jump: 0, skid: true, crashed: false, ...o });
  const snap = (t, o) => ({ world: w, tick: t, time: t * 88, seats: [seat(o)], racers: [], shots: [] });
  const marks = createMarks();
  marks.emit(snap(1), snap(2, { px: 1144 }));
  assert.equal(marks.count, 2); // a segment for each rear wheel
  for (const blocked of [S.wall, S.stopped, S.fall, ...S.pit]) marks.emit(snap(2, { px: 1144 }), snap(3, { px: 1164, surface: blocked }));
  marks.emit(snap(2), snap(3, { px: 1164, skid: false }));
  marks.emit(snap(2), snap(3, { px: 1164, jump: 3 }));
  marks.emit(snap(2), snap(3, { px: 1124 + MOTION.snapDistance + 50 }));
  assert.equal(marks.count, 2);
  for (let t = 0; t < MARKS.cap; t++) marks.emit(snap(t), snap(t + 1, { px: 1144 }));
  assert.equal(marks.count, MARKS.cap);
  const L = createLayers(64000);
  L.kind.fill(KIND.floor, 130 * 320);
  const camera = { x: 1000, y: 1000, heading: 0 };
  marks.stamp(L, w, camera, MARKS.cap * 88, 320, 200);
  assert.ok(L.mark.some(v => v > 0));
  assert.ok(L.mark.subarray(0, 130 * 320).every(v => v === 0)); // never above the ground
  L.mark.fill(0);
  marks.stamp(L, w, camera, MARKS.cap * 88 + MARKS.holdMs + MARKS.fadeMs + 88, 320, 200);
  assert.ok(L.mark.every(v => v === 0)); // faded out
  marks.clear();
  assert.equal(marks.count, 0);
});

test('sun shadows fall away from the sun as the camera turns, and a lifted picture\'s shadow moves off its anchor', () => {
  const w = syntheticGround();
  const side = sunDirection(w, 0.25, 0), ahead = sunDirection(w, 0.25, 480); // @math a quarter turn of sun, the camera along 0 and along a quarter turn
  assert.ok(Math.abs(side.f) < 0.01 && side.l > 0.99);
  assert.ok(ahead.f > 0.99 && Math.abs(ahead.l) < 0.01);
  assert.equal(LEVELS.sunAngle >= 0 && LEVELS.sunAngle <= 1, true);
  const picture = { w: 10, h: 20 }, r = { left: 155, top: 172, distance: 124, picture }, cols = { top: new Int16Array(10).fill(0), bottom: new Int16Array(10).fill(19) };
  const cast = lift => { const L = createLayers(64000), box = { x0: 320, x1: -1, y0: 200, y1: -1 }; castShadow(L, { r: { ...r, top: r.top - lift }, cols, ground: 192, anchor: 160 }, w, side, 320, 200, box); return { L, box }; };
  const low = cast(0), high = cast(10);
  assert.ok(low.box.x1 > 165, 'the shadow reaches right of the picture');
  assert.ok(high.box.x0 > low.box.x0, 'a lifted picture casts further away');
  assert.ok(low.L.cast.subarray(0, 120 * 320).every(v => v === 0));
});
