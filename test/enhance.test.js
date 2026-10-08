// The Enhanced presentation (src/enhance) on synthetic data: settings, smooth motion's blend and its discontinuities, the floor adapter
// against the reference floor, the compositor's masks and layers, the shadows and the lint rules of the directory. No game files.
import { createArtProvider } from '../src/enhance/art.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, presetOf, applyPreset, change, resetSettings, anyEffect, loadSettings, saveSettings, renderActive, enhancedOn, renderDefault, nextPreset, menuView } from '../src/enhance/settings.js';
import { DEFAULTS, PRESETS, EFFECTS, STORAGE_KEY, MOTION, SHADOW, RENDER, RENDER_MENU } from '../src/enhance/config.js';
import { createEnhancer } from '../src/enhance/index.js';
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

test('settings, Stage 4: the rendering choices (RENDER) beside the switches, their defaults the presentation before Stage 4', () => {
  const R = RENDER.defaults, keys = Object.keys(R);
  assert.deepEqual(keys, ['scale', 'view', 'hudPlace', 'sizes', 'angles', 'art']);
  assert.deepEqual(R, { scale: 1, view: 'standard', hudPlace: 'centred', sizes: 'classes', angles: 'locked', art: false });
  for (const k of keys) assert.equal(DEFAULTS[k], R[k]);
  // Settings stored before Stage 4 (no rendering choice in them) normalize to the same preset and values, with every choice at its default.
  const before = [{ preset: 'original', ...PRESETS.original, ...LEVELS }, { preset: 'enhanced', ...PRESETS.enhanced, shadowStrength: 0.5, sunAngle: 0.125 }, { preset: 'custom', ...PRESETS.enhanced, fog: false, fogStrength: 0.25 }, { preset: 'enhanced', smooth: true }]; // @math levels a player may have set
  for (const old of before) {
    const s = normalize(old);
    for (const k of [...EFFECTS, ...Object.keys(LEVELS)]) if (k in old && k !== 'preset') assert.equal(s[k], old[k], k);
    for (const k of keys) assert.equal(s[k], R[k], k);
    assert.equal(s.preset, old.preset); // the preset it was stored under
    assert.equal(enhancedOn(s), anyEffect(s), 'the same path as before Stage 4');
  }
  const kept = memoryStorage(); kept.setItem(STORAGE_KEY, JSON.stringify(before[1]));
  assert.deepEqual(loadSettings(kept), { ...normalize(before[1]), ...R });
  // Values outside their lists take the default; the scale may come from a form as text.
  assert.deepEqual(keys.map(k => normalize({ scale: 3, view: 'ultra', hudPlace: 'left', sizes: 'huge', angles: 'spin', art: 'yes' })[k]), keys.map(k => R[k])); // @math 3 is not offered (tests only)
  assert.equal(normalize({ scale: '2' }).scale, 2); assert.equal(normalize({ scale: '' }).scale, 1); assert.equal(normalize({ view: 'toString' }).view, 'standard'); assert.equal(normalize({ art: 1 }).art, false);
  // Original is the reference renderer: off; Enhanced: on.
  assert.equal(enhancedOn(resetSettings()), false); assert.equal(renderActive(resetSettings()), false); assert.ok(renderDefault(resetSettings()));
  assert.equal(enhancedOn(applyPreset(resetSettings(), 'enhanced')), true);
  // The scale, the view, the sizes and the artwork turn the enhanced path on (an enhancer's active() too) and make Original's switches 'custom';
  // the HUD place and the angles alone do not (they only refine those), so the preset word stays ORIGINAL, matching what draws.
  const away = { scale: 2, view: 'wide', hudPlace: 'edges', sizes: 'smooth', angles: 'free', art: true }; // @math the second allowed value of each
  for (const k of keys) {
    const s = change(resetSettings(), k, away[k]), enh = createEnhancer({ storage: memoryStorage() }), drawing = !['hudPlace', 'angles'].includes(k);
    assert.equal(s.preset, drawing ? 'custom' : 'original', k); assert.equal(s[k], away[k]);
    enh.configure(s);
    assert.equal(renderActive(s), drawing, k); assert.equal(enhancedOn(s), drawing, k); assert.equal(enh.active(), drawing && k !== 'art', `${k}: active()`); // the artwork draws only with a pack stored
    if (k === 'art') { const packed = createEnhancer({ storage: memoryStorage(), art: createArtProvider(() => null).set([{ entry: { kind: 'tiles', member: 'A_F1.PCX' }, bytes: 0 }]) }); packed.configure(s); assert.equal(packed.active(), true, 'art: active() with a pack'); }
    assert.equal(presetOf({ ...s, ...PRESETS.enhanced }), 'enhanced', `${k}: Enhanced whatever the rendering choices`);
  }
  // applyPreset('original') puts the choices back, applyPreset('enhanced') keeps them; Enter from CUSTOM goes to Original and puts them back.
  const custom = normalize({ ...PRESETS.original, ...away });
  assert.deepEqual(keys.map(k => applyPreset(custom, 'original')[k]), keys.map(k => R[k])); assert.equal(applyPreset(custom, 'original').preset, 'original');
  const enhanced = applyPreset(custom, 'enhanced');
  assert.deepEqual(keys.map(k => enhanced[k]), keys.map(k => away[k])); assert.equal(enhanced.preset, 'enhanced');
  assert.equal(custom.preset, 'custom'); assert.deepEqual(nextPreset(custom), applyPreset(custom, 'original'));
  assert.deepEqual(keys.map(k => resetSettings()[k]), keys.map(k => R[k]));
});

test('settings, Stage 4: a rendering choice keeps the scene unless it turns the enhanced path on or off', () => {
  const enh = createEnhancer({ storage: memoryStorage() });
  let resets = 0; const reset = enh.reset; enh.reset = () => { resets++; reset(); };
  enh.configure(PRESETS.enhanced); resets = 0;
  for (const [k, v] of [['scale', 2], ['view', 'wide'], ['sizes', 'smooth'], ['angles', 'off'], ['art', true], ['hudPlace', 'edges']]) enh.configure(change(enh.settings, k, v)); // @math the second scale
  assert.equal(resets, 0, 'look-only while the effects are on');
  enh.configure(resetSettings()); resets = 0;
  enh.configure(change(enh.settings, 'scale', 2)); assert.equal(resets, 1, 'Original at 2x draws through the enhanced path: a new scene'); // @math the second scale
  enh.configure(change(enh.settings, 'sizes', 'smooth')); assert.equal(resets, 1);
  enh.configure(change(enh.settings, 'scale', 1)); assert.equal(resets, 1, 'still on (smooth sizes)');
  enh.configure(change(enh.settings, 'sizes', 'classes')); assert.equal(resets, 2, 'off again: the scene ends');
});

test('settings, Stage 4: the RENDERING words fit a bar of the menu font, and NONE where a choice cannot be shown', () => {
  const R = RENDER_MENU, bar = (name, word) => name.length + 1 + word.length;
  const words = [[R.scale, Object.values(R.scales)], [R.view, Object.values(R.views)], [R.sizes, Object.values(R.sizeNames)], [R.angles, Object.values(R.angleNames)], [R.art, ['ON', 'OFF']]];
  for (const [name, list] of words) for (const w of [...list, R.none]) { assert.ok(bar(name, w) <= R.width, `${name} ${w}`); assert.match(`${name} ${w}`, /^[A-Z0-9 ]+$/); }
  assert.equal(bar(R.sizes, R.sizeNames.classes), R.width); // SPRITE SIZES STEPPED, exactly the bar
  assert.equal(R.item.length <= R.width, true);
  assert.deepEqual(Object.keys(R.scales).map(Number), RENDER.scales); assert.deepEqual(Object.keys(R.sizeNames), RENDER.sizes); assert.deepEqual(Object.keys(R.angleNames), RENDER.angles);
  const v = menuView(resetSettings());
  assert.deepEqual(v.render, { scale: '1X', view: 'STANDARD', sizes: 'STEPPED', angles: 'NONE', art: false, artReady: false }); assert.equal(v.active, false);
  const w = menuView(normalize({ ...PRESETS.original, scale: 2, view: 'wide', hudPlace: 'edges', angles: 'free', art: true }), { worldReady: false, packs: 1, angleSets: 1 }); // @math one pack, with angles
  assert.deepEqual(w.render, { scale: 'NONE', view: 'NONE', sizes: 'STEPPED', angles: 'FREE', art: true, artReady: true }); assert.equal(w.active, true); assert.equal(w.preset, 'CUSTOM');
  assert.equal(menuView(normalize({ view: 'wide', hudPlace: 'edges' })).render.view, 'WIDE EDGES', 'M9: the HUD at the edges of the wide view'); assert.equal(menuView(normalize({ view: 'wide' })).render.view, 'WIDE');
  assert.equal(menuView(normalize({ view: 'standard', hudPlace: 'edges' })).render.view, 'STANDARD', 'the HUD\'s place says nothing in the standard view');
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

// ---- Stage 4: the decals at a geometry (geometry.js): the reference numbers placed at s (x + m), s y, so each is the 1x one with s times the samples
import { geometryOf } from '../src/enhance/geometry.js';
import { castOf } from '../src/enhance/shadows.js';
import { createParticles } from '../src/enhance/particles.js';

// fillQuad as it was before Stage 4, over the whole of its box every row: the reference for the rows worked only where their scanlines cross.
function fillQuadBefore(layer, pts, value, width, height, kinds = null, kind = 0, sub = 4) { // @math four scanlines a row
  const ys = pts.map(p => p[1]), y0 = Math.max(Math.floor(Math.min(...ys)), 0), y1 = Math.min(Math.floor(Math.max(...ys)), height - 1);
  const xs = pts.map(p => p[0]), left = Math.max(Math.floor(Math.min(...xs)), 0), right = Math.min(Math.floor(Math.max(...xs)), width - 1);
  if (right < left) return;
  const cover = new Float32Array(right - left + 1);
  for (let y = y0; y <= y1; y++) {
    cover.fill(0);
    for (let s = 0; s < sub; s++) {
      const cy = y + (s + 0.5) / sub; let lo = Infinity, hi = -Infinity; // @math the sub-scanline's middle
      for (let k = 0; k < pts.length; k++) { const [xa, ya] = pts[k], [xb, yb] = pts[(k + 1) % pts.length]; if ((cy < ya && cy < yb) || (cy > ya && cy > yb) || ya === yb) continue; const x = xa + ((cy - ya) * (xb - xa)) / (yb - ya); if (x < lo) lo = x; if (x > hi) hi = x; }
      if (lo > hi) continue;
      for (let x = Math.max(Math.floor(lo), left); x <= Math.min(Math.floor(hi), right); x++) cover[x - left] += Math.max(Math.min(hi, x + 1) - Math.max(lo, x), 0) / sub;
    }
    for (let x = left; x <= right; x++) { const v = value * Math.min(cover[x - left], 1), o = y * width + x; if (v > 0 && (!kinds || kinds[o] === kind) && v > layer[o]) layer[o] = v; }
  }
}

test('Stage 4: the quad fill works each row only where its scanlines cross, with the very values of its whole box', () => {
  const random = createRandom(23), W = 64, H = 48, kinds = Uint8Array.from({ length: W * H }, () => (random() < 0.7 ? KIND.floor : KIND.sprite)); // @math a small picture, most of it floor
  const a = new Float32Array(W * H), b = new Float32Array(W * H);
  for (let n = 0; n < 400; n++) { // @math long slanted bands, thin ones, ones off the picture
    const x = random() * 80 - 8, y = random() * 60 - 6, dx = random() * 30 - 15, dy = random() * 40 - 20, w = random() * 3; // @math places, extents and widths over and around the picture
    const pts = [[x, y], [x + w, y + w * 0.3], [x + w + dx, y + dy], [x + dx, y + dy - w * 0.2]], value = 0.2 + random() * 0.8, sub = n % 3 ? 4 : 1, mask = n % 2 ? kinds : null; // @math a convex quad; any value; the marks' four scanlines and the casts' one
    fillQuad(a, pts, value, W, H, mask, KIND.floor, sub); fillQuadBefore(b, pts, value, W, H, mask, KIND.floor, sub);
  }
  assert.deepEqual(a, b);
  assert.ok(a.some(v => v > 0));
});

test('Stage 4: contact and sun shadows, skid marks and particles at a geometry are the reference ones in output pixels', () => {
  const G = geometryOf({ s: 2, m: 0 }), opts = { shadows: true, sceneryShadows: true }, picture = { w: 37, h: 28 }, P = { car: {}, fx: {} }; // @math 2x; an odd width
  // The grid a record's shadows are drawn on (scene.js): the unclipped picture's top left, u pixels a reference pixel (s: the output's, the
  // 'full' look; 1: the reference grid of the reference look), the margin added to the column.
  const grid = (r, g, u = g.s) => ({ x: u * (r.left - r.firstColumn + g.m), y: u * r.top, u, m: g.m });
  const racer = { type: 1, racer: 2, left: 100, top: 150, picture, firstColumn: 3 }, own = { type: 0, left: 141, top: 160, picture, firstColumn: 0 }; // @math a racer cut on the left, the own car lifted
  for (const r of [racer, own]) {
    const one = casterOf(r, P, null, 188, opts), two = casterOf(r, P, null, 188, opts, grid(r, G)), ref = casterOf(r, P, null, 188, opts, grid(r, G, 1)); // @math the own car's ground row
    assert.deepEqual([two.x, two.y, two.rx, two.strength], [2 * one.x, 2 * one.y, 2 * one.rx, one.strength]); // @math s times the place and the size; the same strength
    assert.deepEqual(ref, one, 'on the reference grid (the reference look): the 1x shadow itself');
  }
  const wide = geometryOf({ s: 2, m: 53 }); // @math 2x at 4 BY 3
  assert.equal(casterOf(racer, P, null, 188, opts, grid(racer, wide)).x, 2 * (casterOf(racer, P, null, 188, opts).x + 53)); // @math the margin added to the column
  assert.equal(casterOf(racer, P, null, 188, opts, grid(racer, wide, 1)).x, casterOf(racer, P, null, 188, opts).x + 53); // @math on the reference grid, the margin added
  const foot = { minX: 40, maxX: 69, lift: 4 }, object = { type: -1, object: 0, left: 20, top: 100, picture, firstColumn: 0 }; // @math an object's footprint in output pixels, lifted four output rows
  const scenery = casterOf(object, P, foot, 188, opts, grid(object, G)), keep = 1 - Math.min(4 / (SHADOW.liftFade * 2), 1) / 2; // @math four output rows are two reference rows
  assert.deepEqual([scenery.x, scenery.y, scenery.strength], [(40 + 69 + 1) / 2, 2 * 128, keep]); // @math the footprint's middle; the picture's bottom row 100 + 28, times 2
  // The ellipse at 2x: four times the pixels of the 1x one, about the same total darkness per reference pixel, the same smallest shadow.
  const L1 = createLayers(64000), L2 = createLayers(G.W * G.H), c1 = casterOf(racer, P, null, 188, opts); // @math the 320 x 200 screen
  stampShadow(L1, c1, 320, 200); stampShadow(L2, casterOf(racer, P, null, 188, opts, grid(racer, G)), G.W, G.H, G.s); // @math the reference screen
  const sum = a => a.reduce((x, y) => x + y, 0), lit = a => a.reduce((n, v) => n + (v > 0), 0);
  assert.ok(Math.abs(sum(L2.shade) / 4 - sum(L1.shade)) / sum(L1.shade) < 0.05, 'the same darkness over four times the pixels'); // @math s squared; within five percent
  assert.ok(Math.abs(lit(L2.shade) / 4 - lit(L1.shade)) / lit(L1.shade) < 0.1); // @math s squared; within a tenth
  const tiny = { x: 300, y: 190, rx: (SHADOW.minRows - 0.5) / 2, strength: 1 }, L3 = createLayers(G.W * G.H); // @math narrower than the smallest shadow at 1x
  stampShadow(L3, { ...tiny, x: 600, y: 380, rx: tiny.rx * 2 }, G.W, G.H, G.s); // @math the same shadow at 2x
  assert.ok(L3.shade.every(v => v === 0), 'the smallest shadow is a reference pixel\'s');
  // The sun shadow of a picture drawn at 2x (its silhouette in output pixels): about four times the 1x cast's area, in the same place.
  const w = syntheticGround(), side = sunDirection(w, 0.25, 0), pic = { w: 10, h: 20 }, r = { type: -1, object: 0, left: 155, top: 172, distance: 124, picture: pic, firstColumn: 0 }; // @math a quarter turn of sun; a picture at the own car's distance
  const cols1 = { top: new Int16Array(10).fill(0), bottom: new Int16Array(10).fill(19) }, cols2 = { top: new Int16Array(20).fill(0), bottom: new Int16Array(20).fill(39) }; // @math the columns at 1x and 2x
  const L4 = createLayers(64000), box1 = { x0: 320, x1: -1, y0: 200, y1: -1 }, L5 = createLayers(G.W * G.H), box2 = { x0: G.W, x1: -1, y0: G.H, y1: -1 }; // @math empty boxes
  castShadow(L4, castOf(r, P, { cols: cols1 }, 192), w, side, 320, 200, box1); // @math the own car's ground row
  const at2 = castOf(r, P, { cols: cols2 }, 192, grid(r, G));
  assert.deepEqual([at2.left, at2.top, at2.anchor, at2.ground, at2.s], [2 * 155, 2 * 172, 2 * (155 + 5), 2 * (172 + 20), 2]); // @math s times the picture's place, its anchor column (half its width) and its ground row
  castShadow(L5, at2, w, side, G.W, G.H, box2);
  const area1 = lit(L4.cast), area2 = lit(L5.cast);
  assert.ok(area2 > 3 * area1 && area2 < 5 * area1, `about four times the area: ${area1} and ${area2}`); // @math s squared, roughly
  assert.ok(Math.abs(box2.x0 - 2 * box1.x0) <= 2 && Math.abs(box2.x1 - 2 * box1.x1) <= 3 && Math.abs(box2.y1 - 2 * box1.y1) <= 3, 'the same place'); // @math within a reference pixel or so
  // Skid marks at 2x: on the ground only, about four times the pixels of the 1x marks.
  const marks = createMarks(), seat = o => ({ cx: 1000, cy: 1000, heading: 0, dir: 0, px: 1124, py: 1000, surface: 0, jump: 0, skid: true, crashed: false, ...o }), snap = (t, o) => ({ world: w, tick: t, time: t * 88, seats: [seat(o)], racers: [], shots: [] }); // @math a car ahead of the camera
  marks.emit(snap(1), snap(2, { px: 1144 })); // @math a tick's travel
  const M1 = createLayers(64000), M2 = createLayers(G.W * G.H), camera = { x: 1000, y: 1000, heading: 0 }; // @math the 320 x 200 screen
  M1.kind.fill(KIND.floor, 130 * 320); M2.kind.fill(KIND.floor, 260 * G.W); // @math the floor's rows at 1x and 2x
  marks.stamp(M1, w, camera, 200, 320, 200); marks.stamp(M2, w, camera, 200, G.W, G.H, G); // @math 200 ms after the mark was laid
  assert.ok(lit(M2.mark) > 3 * lit(M1.mark) && lit(M2.mark) < 5 * lit(M1.mark), `marks: ${lit(M1.mark)} and ${lit(M2.mark)} pixels`); // @math s squared, roughly
  assert.ok(M2.mark.subarray(0, 260 * G.W).every(v => v === 0), 'never above the ground'); // @math the floor's first row at 2x
  // Particles (a contact's sparks, which need no surface's picture): the same discs, s times their place and radius, the margin added.
  const particles = createParticles(), sw = { ...w, spark: Uint8Array.from({ length: 90 }, (_, i) => (i % 3 ? 40 + i : 0)), palette: Uint8Array.from({ length: 768 }, (_, i) => i % 64) }; // @math SPARK.SP's 10 x 9 bytes, some transparent; a palette of 6-bit components
  const car = (t, spark, sparkCount) => ({ world: sw, tick: t, time: t * 88, seats: [seat({ px: 1124, py: 1000, jump: 1, special: 0, spark, sparkCount })], racers: [], shots: [] }); // @math in the air: no dust
  particles.emit({ duck: null }, car(1, 0, 0), car(2, 1, 1)); // the spark's first picture in this tick
  assert.ok(particles.count > 0);
  const one = particles.splats(sw, camera, 2 * 88 + 40), two = particles.splats(sw, camera, 2 * 88 + 40, G), margin = particles.splats(sw, camera, 2 * 88 + 40, wide); // @math the tick's time and a little after
  assert.ok(one.length > 0); assert.equal(two.length, one.length);
  one.forEach((d, n) => { assert.deepEqual([two[n].x, two[n].y, two[n].r, two[n].depth, two[n].alpha], [2 * d.x, 2 * d.y, 2 * d.r, d.depth, d.alpha]); assert.equal(margin[n].x, 2 * (d.x + 53)); }); // @math s times the place and radius; the margin added
});
