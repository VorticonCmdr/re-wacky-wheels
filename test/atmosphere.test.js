// Stage 3 of the Enhanced presentation (docs/enhancements.md): the tracks' atmospheres, the clouds and the track lighting. Synthetic data
// only; the pictures of real tracks are checked by scripts/check-enhance.js and in a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAtmosphere, defaultAtmosphere, isDefaultAtmosphere, loadAtmospheres, saveAtmosphere, saveAtmospheres, sunAngleOf, sunLengthOf, fogTintOf, hexOf, describeAtmosphere } from '../src/enhance/atmosphere.js';
import { ATMOSPHERE, SUN, CLOUDS, GRADES, PRESETS, EFFECTS, LOOK_EFFECTS } from '../src/enhance/config.js';
import { normalize } from '../src/enhance/settings.js';
import { createEnhancer } from '../src/enhance/index.js';
import { createMotion, horizonStep } from '../src/enhance/motion.js';
import { cloudField, coverClouds } from '../src/enhance/clouds.js';
import { gradeOf, gradePixel } from '../src/enhance/grade.js';
import { composite } from '../src/enhance/composite.js';
import { createLayers } from '../src/enhance/scene.js';
import { KIND } from '../src/enhance/project.js';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };

test('an atmosphere keeps only values of the right type and range, and the defaults draw as before', () => {
  assert.deepEqual(normalizeAtmosphere({}), ATMOSPHERE.defaults);
  assert.deepEqual(normalizeAtmosphere(null), ATMOSPHERE.defaults);
  const a = normalizeAtmosphere({ sunAngle: -0.25, sunHeight: 2, fogTint: '#ABCDEF', fog: 9, clouds: '0.5', grade: 'night', gradeStrength: -1, extra: 1 });
  assert.deepEqual(a, { ...ATMOSPHERE.defaults, sunAngle: 0.75, sunHeight: 1, fogTint: '#abcdef', fog: ATMOSPHERE.fogMax, clouds: 0.5, grade: 'night', gradeStrength: 0 }); // @math a quarter turn back is three quarters on
  for (const bad of [{ clouds: [1] }, { fog: true }, { sunAngle: null }, { fogTint: 'red' }, { fogTint: '#12345' }, { grade: 'toString' }, { grade: '__proto__' }, { grade: ['night'] }, { gradeStrength: '' }]) assert.deepEqual(normalizeAtmosphere(bad), ATMOSPHERE.defaults, JSON.stringify(bad));
  assert.equal(normalizeAtmosphere({ sunAngle: 1 }).sunAngle, 0); // a whole turn is no turn
  assert.ok(isDefaultAtmosphere({})); assert.ok(!isDefaultAtmosphere({ grade: 'dusk' }));
  assert.equal(sunLengthOf(defaultAtmosphere()), SUN.length); // the default sun casts as before Stage 3
  const [low, high] = ATMOSPHERE.sunElevation, rad = d => (d * Math.PI) / 180; // @math degrees to radians
  assert.ok(Math.abs(sunLengthOf(normalizeAtmosphere({ sunHeight: 0 })) - 1 / Math.tan(rad(low))) < 1e-9);
  assert.ok(Math.abs(sunLengthOf(normalizeAtmosphere({ sunHeight: 1 })) - 1 / Math.tan(rad(high))) < 1e-9);
  assert.equal(sunAngleOf(defaultAtmosphere(), 0.375), 0.375); assert.equal(sunAngleOf(normalizeAtmosphere({ sunAngle: 0.5 }), 0.375), 0.5); // @math the game setting, or the track's
  const strip = [1, 2, 3]; // @math any colour
  assert.equal(fogTintOf(defaultAtmosphere(), strip), strip); // the very same colour the strip gives: the fog's own path is untouched
  assert.deepEqual(fogTintOf(normalizeAtmosphere({ fogTint: '#102030' }), strip), [16, 32, 48]); // @math the bytes of #102030
  assert.equal(hexOf([16, 32, 48]), '#102030'); // @math the same bytes
  assert.equal(describeAtmosphere({}), 'the defaults');
  assert.match(describeAtmosphere({ grade: 'sunset', clouds: 0 }), /sunset lighting, no clouds/);
});

test('the atmospheres are kept by track number apart from everything else; the defaults are not stored; a broken entry gives the defaults', () => {
  const s = memory();
  assert.deepEqual(loadAtmospheres(s), {});
  assert.ok(saveAtmosphere(7, { grade: 'night' }, s)); // @math a track number
  assert.deepEqual(loadAtmospheres(s), { 7: normalizeAtmosphere({ grade: 'night' }) });
  saveAtmosphere('12', { clouds: 0.8 }, s);
  assert.deepEqual(Object.keys(loadAtmospheres(s)).sort(), ['12', '7']);
  saveAtmosphere(7, defaultAtmosphere(), s); // back to the defaults: forgotten
  assert.deepEqual(Object.keys(loadAtmospheres(s)), ['12']);
  saveAtmospheres({}, s); assert.equal(s.m.has(ATMOSPHERE.storageKey), false);
  for (const broken of ['{', '[]', '{"tracks":[1]}', '{"tracks":{"x":{"grade":"night"}}}']) { s.m.set(ATMOSPHERE.storageKey, broken); assert.deepEqual(loadAtmospheres(s), {}, broken); }
  assert.deepEqual(loadAtmospheres({ getItem() { throw new Error('blocked'); } }), {});
});

test('the new switches: Enhanced has them, Original not; stored settings from before them keep their preset; they only colour the picture', () => {
  assert.ok(EFFECTS.includes('clouds') && EFFECTS.includes('lighting'));
  assert.ok(PRESETS.enhanced.clouds && PRESETS.enhanced.lighting && !PRESETS.original.clouds && !PRESETS.original.lighting);
  const before = Object.fromEntries(Object.entries(PRESETS.enhanced).filter(([k]) => !LOOK_EFFECTS.includes(k)));
  assert.equal(normalize({ ...before, preset: 'enhanced' }).preset, 'enhanced');
  assert.equal(normalize({ ...before, preset: 'custom' }).clouds, false);
  assert.equal(normalize({ preset: 'constructor' }).preset, 'original');
});

test('the sky turns with the horizon strip, without its wraps: across 238 -> 82 and 2 -> 158 it moves on smoothly', () => {
  assert.equal(horizonStep(238, 82), 4); assert.equal(horizonStep(2, 158), -4); assert.equal(horizonStep(100, 103), 3); // @math the wraps of horizon.js are steps of 4, a plain step of 3
  const world = {}, car = h => ({ car: { cx: 0, cy: 0, heading: 0, px: 0, py: 0, horizon: h }, world, ai: null, shots: [] });
  const run = offsets => { const m = createMotion(); offsets.forEach((h, tick) => m.tick({ ...car(h), tick }, 100)); return m; }; // @math a tick
  const right = run([236, 240, 84, 88]), left = run([4, 0, 156, 152]); // right past the 240 wrap, left past the 0 wrap // @math runs of offsets
  assert.equal(right.snapshots.cur.seats[0].sky, 236 + 4 + 4 + 4); // @math the steps taken the short way round
  assert.equal(left.snapshots.cur.seats[0].sky, 4 - 4 - 4 - 4); // @math the same, turning left
  const mid = right.view({ ...car(88), tick: 3 }, 0.5, 100); // @math half way between the last two ticks
  assert.equal(mid.seats[0].sky, (right.snapshots.prev.seats[0].sky + right.snapshots.cur.seats[0].sky) / 2);
});

test('the cloud field repeats and is the same every time; the banks cover more with more cloud, nothing at none, only their own rows', () => {
  const f = cloudField(1), g = cloudField(1), size = CLOUDS.texture;
  assert.equal(f, g); // made once
  assert.ok(Math.min(...f) === 0 && Math.max(...f) === 1);
  const out = CLOUDS.layers.map(() => ({ alpha: new Float32Array(320 * 110), light: new Float32Array(320 * 110) })); // @math the sky rows of the screen
  const covered = amount => { coverClouds(out, { amount, speed: 0.3, scroll: 123, time: 4000 }); return out.map(o => o.alpha.reduce((s, a) => s + (a > 0 ? 1 : 0), 0)); }; // @math any wind, scroll and time
  assert.deepEqual(covered(0), [0, 0]);
  const some = covered(0.3), more = covered(0.8); // @math two cloud amounts
  for (let n = 0; n < CLOUDS.layers.length; n++) assert.ok(more[n] > some[n] && some[n] > 0, `bank ${n}`);
  covered(1);
  CLOUDS.layers.forEach((layer, n) => { for (let y = 0; y < 110; y++) if (y < layer.rows[0] || y >= layer.rows[1]) assert.equal(out[n].alpha.subarray(y * 320, y * 320 + 320).some(a => a > 0), false, `bank ${n} row ${y}`); }); // @math the sky rows
  for (const o of out) for (const a of o.alpha) assert.ok(a >= 0 && a <= 1 && Math.abs(a * CLOUDS.levels - Math.round(a * CLOUDS.levels)) < 1e-6);
  assert.ok(size > 0);
});

test('a grade: none is nothing, a part of one lies between the picture and the whole grade, the pictures get less of it', () => {
  assert.equal(gradeOf('none', 1), null); assert.equal(gradeOf('night', 0), null); assert.equal(gradeOf('nonsense', 1), null);
  for (const name of GRADES.names.slice(1)) {
    const full = gradeOf(name, 1), half = gradeOf(name, 0.5);
    assert.equal(gradeOf(name, 1), full); // made once
    for (let x = 0; x < 256; x += 51) for (let k = 0; k < 3; k++) { const a = full.lut[k * 256 + x], b = half.lut[k * 256 + x], c = full.sprite.lut[k * 256 + x]; assert.ok(Math.min(a, x) - 1 <= b && b <= Math.max(a, x) + 1, `${name} ${k} ${x}`); assert.ok(Math.min(a, x) - 1 <= c && c <= Math.max(a, x) + 1); } // @math a few values of each component
  }
  const out = new Uint8ClampedArray([200, 200, 200, 255]); gradePixel(out, 0, gradeOf('night', 1), 255); // @math a light grey
  assert.ok(out[2] > out[0] && out[0] < 200, 'night is darker and bluer'); // @math the grey before
  const capped = new Uint8ClampedArray([255, 255, 255, 255]); gradePixel(capped, 0, gradeOf('dawn', 1), 100); assert.ok(capped[0] <= 100 && capped[1] <= 100 && capped[2] <= 100); // @math the demo's fade
});

test('the composite: the sky and the grade never touch the overlays, the clouds only the track\'s sky, the grade the sky only when it is the track\'s', () => {
  const W = 320, H = 200, size = W * H, index = new Uint8Array(size).fill(1), mask = new Uint8Array(size), L = createLayers(size), palette = new Uint8ClampedArray(1024); // @math the screen; 256 colours of four bytes
  palette.set([100, 150, 200, 255], 4); // @math colour 1
  for (let i = 0; i < size; i++) L.kind[i] = i < 110 * W ? KIND.sky : i < 130 * W ? KIND.horizon : i % 7 ? KIND.floor : KIND.sprite; // @math the sky, the strip and the floor rows; some pictures
  const overlay = 5 * W + 5, skyPixel = 50 * W + 10, floorPixel = 150 * W + 10, spritePixel = 150 * W + 6; // @math a pixel of each kind (48006 is a multiple of 7: a picture)
  mask[overlay] = 1;
  const alpha = new Float32Array(110 * W).fill(1), light = new Float32Array(110 * W).fill(1), white = new Float32Array(110 * 3).fill(255), tint = new Float32Array(110 * 3).fill(0); // @math the sky rows; full cover
  const sky = { rows: 110, tint: { colours: tint, amount: 0.5 }, clouds: [{ alpha, light, lit: white, shade: white }] }; // @math half way to black, then white clouds
  const run = effects => composite(new Uint8ClampedArray(size * 4), { index, mask, L, palette, width: W, effects: { shadow: 0, fog: null, cap: 255, ...effects } }); // @math four bytes a colour
  const plain = run({}), clouded = run({ sky });
  assert.deepEqual([...clouded.subarray(overlay * 4, overlay * 4 + 3)], [100, 150, 200]); // @math the overlay as the palette has it
  assert.deepEqual([...clouded.subarray(skyPixel * 4, skyPixel * 4 + 3)], [255, 255, 255]); // @math fully under a white cloud
  assert.deepEqual([...clouded.subarray(floorPixel * 4, floorPixel * 4 + 3)], [...plain.subarray(floorPixel * 4, floorPixel * 4 + 3)]); // the floor has no sky
  const grade = gradeOf('night', 1), graded = run({ grade: { ...grade, trackSky: true } }), slide = run({ grade: { ...grade, trackSky: false } });
  assert.notDeepEqual([...graded.subarray(skyPixel * 4, skyPixel * 4 + 3)], [100, 150, 200]); // @math the track's sky is graded
  assert.deepEqual([...slide.subarray(skyPixel * 4, skyPixel * 4 + 3)], [100, 150, 200]); // @math a slide's page or the split screen's strips are not
  assert.deepEqual([...graded.subarray(overlay * 4, overlay * 4 + 3)], [100, 150, 200]); // @math never the overlays
  const floor = [...graded.subarray(floorPixel * 4, floorPixel * 4 + 3)], sprite = [...graded.subarray(spritePixel * 4, spritePixel * 4 + 3)];
  assert.ok(sprite.reduce((s, v) => s + v) > floor.reduce((s, v) => s + v), 'a picture keeps more of its light than the ground');
  for (const effects of [{ grade: { ...grade, trackSky: true }, sky, cap: 60 }, { sky, cap: 60 }]) { // @math a demo's fade, with a grade and with clouds alone (the default atmosphere has no grade)
    const faded = run(effects);
    const end = effects.grade ? size : 110 * W; // without a grade only the sky's colours are the effects' (the page fades the palette itself; this one is not faded) // @math the sky rows
    for (let i = 0; i < end; i++) if (!mask[i]) for (let k = 0; k < 3; k++) assert.ok(faded[i * 4 + k] <= 60, `${effects.grade ? 'graded' : 'clouds alone'}: pixel ${i}`); // @math the fade's cap
  }
});

test('switching only the clouds or the lighting keeps the scene, unless it turns the Enhanced presentation on or off (no snapshot is taken while it is off)', () => {
  const m = new Map(), enh = createEnhancer({ storage: { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) } });
  let resets = 0; const reset = enh.reset; enh.reset = () => { resets++; reset(); };
  enh.configure(PRESETS.original); resets = 0;
  enh.configure({ ...PRESETS.original, clouds: true }); assert.equal(resets, 1, 'on from all off: a new scene');
  enh.configure({ ...PRESETS.original, clouds: true, lighting: true }); assert.equal(resets, 1, 'another look switch while on: the scene stays');
  enh.configure({ ...PRESETS.original, lighting: true }); assert.equal(resets, 1);
  enh.configure(PRESETS.original); assert.equal(resets, 2, 'all off: the scene ends');
  enh.configure({ ...PRESETS.original, smooth: true }); assert.equal(resets, 3);
  enh.configure({ ...PRESETS.original, smooth: true, clouds: true }); assert.equal(resets, 3);
});
