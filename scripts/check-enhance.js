// Checks the Enhanced presentation (src/enhance, docs/enhancements.md) against a local WACKY.DAT. A regression and smoke test, not
// evidence about the game:
//  1. the simulation is the same whatever is drawn: every scenario (the attract demos on their recorded controls, scripted races with
//     their fly-in, the two player race and shoot-out, the duck game) is run without drawing, with the reference renderer, and with
//     the enhanced one at random blends, switching settings mid-run and going back without a tick as the in-race menu does; the
//     state after every tick must hash the same in all three, and the enhancer must never use the game's random source;
//  2. with every effect off but smooth motion, a picture at the tick (blend 1) is the reference renderer's pixel for pixel, and with
//     every effect on the overlays (HUD, map, labels, strips) still are;
//  3. the largest steps between ticks stay under the discontinuity limits, particles and skid marks stay under their caps and a reset
//     leaves none;
//  4. the asset garage's race preview runs, draws, and reaches the same tick going back and forward;
//  4b. Stage 3: the sky's layers (the clouds and the far range), the track lighting and the moving water change the track's sky and world
//     but never a demo's slide page, the split screen's strips or the overlays; the sky's layers alone change only the sky and the strip's
//     sky-coloured pixels, and the water alone only the liquid pixels of the ground;
//  5. with --time, the mean and 95th percentile draw time of each effect on the demos, on this machine.
// usage: node scripts/check-enhance.js [WACKY.DAT] [--frames N] [--time]
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack, rgbaPalette } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { parseMov } from '../src/game/figure.js';
import { startRace, stepRace, beginIntro } from '../src/game/race.js';
import { demoSpec, parseBmc, bmcStart, bmcStep } from '../src/game/demo.js';
import { duckTrack, duckRules } from '../src/game/duck.js';
import { swapSeat, stripValues, raceValues, messageAt, carsBySeat } from '../src/game/versus.js';
import { defaultSettings } from '../src/game/menus.js';
import { hudGates } from '../src/game/hud.js';
import { drawRaceFrame, drawRaceOverlays, sceneSky } from '../src/render/race-frame.js';
import { renderScene } from '../src/render/scene.js';
import { loadHudArt } from '../src/render/hud.js';
import { composeSplit, drawStrips, drawRaceHud, flipViewport } from '../src/render/versus.js';
import { drawMessage } from '../src/render/finish.js';
import { crc32 } from '../src/evidence/crc32.js';
import { createEnhancer } from '../src/enhance/index.js';
import { PRESETS, MOTION, PARTICLES, MARKS } from '../src/enhance/config.js';
import { createRacePreview } from '../src/viewer-preview.js';
import { createRandom } from '../src/enhance/particles.js';
import { KIND } from '../src/enhance/project.js';
import { ATMOSPHERE } from '../src/enhance/config.js';
import { decodePcxMember } from '../src/formats/pcx.js';
import { stripSkyIndices } from '../src/enhance/clouds.js';

const args = process.argv.slice(2), frames = args.includes('--frames') ? Number(args[args.indexOf('--frames') + 1]) : 500, path = args.find(a => /\.dat$/i.test(a)), timing = args.includes('--time');
const dat = path ? new Uint8Array(await readFile(path)) : await (await openGameFolder()).open('WACKY.DAT');
const members = archiveMembers(dat), mov = parseMov(members.get('GIG.MOV')), hudArt = loadHudArt(members), SIZE = 64000, WIDTH = 320;
const memory = (atmospheres = null) => { const m = new Map(); if (atmospheres) m.set(ATMOSPHERE.storageKey, JSON.stringify({ version: 1, tracks: atmospheres })); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
let problems = 0;
const fail = msg => { problems++; console.log(`FAIL ${msg}`); };

// ---- the scenarios: a state, the input of each tick, how the reference renderer draws it
const base = () => ({ mov, unproven: new Set(), hud: null, dat, hudArt, menu: { settings: defaultSettings(1, true) }, seed: 4242, detail: 1 });
const none = { accelerate: false, brake: false, left: false, right: false, spin: false, fire: false };
function demo(race) {
  const spec = demoSpec('attract', race), state = { ...base(), class: spec.class, engine: spec.engine, detail: spec.detail, humanSlot: race % 8, demo: { kind: 'attract', spec, mode: spec.mode, page: 1, pictures: null } }; // @math a driver for each race
  startRace(state, { ...loadTrack(dat, String(spec.track), spec.engine, state.humanSlot), lion: lionBytes(members) }, spec.laps); beginIntro(state);
  let bmc = bmcStart(parseBmc(members.get(`${spec.track}.BMC`)));
  return { name: `demo ${spec.track}`, state, input: () => { if (state.intro) return {}; const s = bmcStep(bmc); bmc = s.state; return s.controls.end ? null : s.controls; } };
}
function race(track) {
  const state = base(); startRace(state, { ...loadTrack(dat, String(track)), lion: lionBytes(members) }, 6); beginIntro(state); // @math six laps
  let f = 0;
  return { name: `race ${track}`, state, input: () => { const w = Math.floor(f / 40) % 3; f++; return { accelerate: true, brake: f % 300 > 280, left: w === 1, right: w === 2, spin: f % 200 > 190, fire: f % 90 < 30 }; } }; // @math the keys of check:race
}
function versus(track, kind) {
  const state = { ...base(), class: kind === 'race' ? 1 : 4, engine: kind === 'race' ? 1 : 2, humanSlot: 7, versusMode: kind === 'race' ? { kind, cars: 2, laps: 2, class: 1, engine: 1, slots: [7, 4] } : { hits: 3, slots: [7, 3], scores: [0, 0] } }; // @math the setups of check:versus
  startRace(state, { ...loadTrack(dat, String(track), state.engine, 7, { split: true }), lion: lionBytes(members) }, kind === 'race' ? 2 : 1); state.versusMode = null; // @math two laps
  let f = 0;
  return { name: `versus ${kind} ${track}`, state, split: true, input: () => { const k = Math.floor(f / 30) % 3; f++; return { p1: { ...none, accelerate: true, left: k === 1, right: k === 2, fire: f % 60 < 20 }, p2: { ...none, accelerate: true, left: k === 2, right: k === 1, fire: f % 45 < 15 } }; } }; // @math the keys of check:versus
}
function duck(zone) {
  const R = duckRules(), random = createRandom(zone), state = { ...base(), class: R.level, engine: R.engine, humanSlot: 7, duckMode: { zone }, rng: random }; // the duck AI's own seeded source
  startRace(state, { ...loadTrack(dat, String(duckTrack(zone)), R.engine, 7), lion: lionBytes(members) }, 1); state.duckMode = null;
  let f = 0;
  return { name: `duck ${duckTrack(zone)}`, state, input: () => { const w = Math.floor(f / 40) % 3; f++; if (f === 50) state.player.car = { ...state.player.car, counter: 20 }; return { accelerate: true, left: w === 1, right: w === 2, fire: f % 90 < 30 }; } }; // @math some hogs at the 50th tick
}
const raceTracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => Number(n.replace('.GAM', ''))).sort((a, b) => a - b);
const SCENARIOS = [() => demo(1), () => demo(2), () => demo(3), () => demo(4), ...raceTracks.filter((_, i) => i % 3 === 0).map(t => () => race(t)), () => versus(1, 'race'), () => versus(duckTrack(2), 'shootout'), () => duck(1), () => duck(4)]; // @math the four attract races; every third track

// ---- the reference renderer's picture of a state (the page's draw without the menus)
function versusOverlays(s, fb) {
  const V = s.versus;
  drawStrips(fb, hudArt, stripValues(s), { shoot: V.kind === 'shootout' });
  if (V.kind === 'race') drawRaceHud(fb, hudArt, raceValues(s), hudGates(s.menu.settings));
  carsBySeat(s).forEach((c, n) => { if (c.inverted !== 0) flipViewport(fb, n); });
  if (V.message) drawMessage(fb, hudArt.ofont, messageAt(V.message.text));
}
const sceneA = new Uint8Array(SIZE), sceneB = new Uint8Array(SIZE);
function drawOriginal(sc, index) {
  const s = sc.state;
  if (!sc.split) { drawRaceFrame(s, index); return index; }
  const mode = s.menu.settings.detail.split;
  renderScene(s, sceneA, mode); swapSeat(s); renderScene(s, sceneB, mode); swapSeat(s);
  composeSplit(sceneA, sceneB, index); versusOverlays(s, index);
  return index;
}
function drawEnhanced(enh, sc, alpha, index, out) {
  const s = sc.state, palette = rgbaPalette(s.world.palette);
  const P = sc.split ? enh.drawSplit(s, alpha, { index, out, palette, mode: s.menu.settings.detail.split, overlays: versusOverlays })
    : enh.drawSingle(s, alpha, { index, out, palette, mode: s.detail, sky: sceneSky(s), overlays: (p, fb) => drawRaceOverlays(p, fb) });
  if (!s.minimap && P.minimap) s.minimap = P.minimap; // what the page keeps of the overhead map
  return out;
}

// ---- 1. the same simulation whatever is drawn
const SKIP = new Set(['world', 'dat', 'hudArt', 'mov', 'menu', 'unproven', 'minimap', 'steps']);
const hashState = s => crc32(new TextEncoder().encode(JSON.stringify(s, (k, v) => (SKIP.has(k) ? undefined : ArrayBuffer.isView(v) ? `#${v.length}` : typeof v === 'function' ? undefined : v instanceof Set ? undefined : v))));
const lehmer = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // @math a repeatable stand-in for the browser's random source
const keepRandom = Math.random;
const guarded = fn => { const r = Math.random; Math.random = () => { throw new Error('the enhanced presentation used Math.random'); }; try { return fn(); } finally { Math.random = r; } };
const SWITCHES = [PRESETS.enhanced, { ...PRESETS.original, smooth: true }, PRESETS.original, { ...PRESETS.original, shadows: true, fog: true }, { ...PRESETS.enhanced, particleAmount: 0.3, fogStrength: 0.4 }];

function runScenario(make, regime) {
  Math.random = lehmer(777);
  const sc = make(), s = sc.state, hashes = [], enh = regime === 'enhanced' ? createEnhancer({ storage: memory() }) : null, pick = createRandom(31), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
  const steps = { camera: 0, turn: 0, racer: 0, snaps: 0 }, cap = { particles: 0, marks: 0 };
  if (enh) enh.configure(PRESETS.enhanced);
  let prev = null;
  for (let t = 0; t < frames; t++) {
    const input = sc.input();
    if (input === null) break;
    stepRace(s, input);
    hashes.push(hashState(s));
    if (regime === 'original') drawOriginal(sc, index);
    if (enh) {
      if (t % 97 === 96) enh.configure(SWITCHES[Math.floor(t / 97) % SWITCHES.length]); // @math a settings change now and then
      guarded(() => enh.afterTick(s));
      const draws = 1 + Math.floor(pick() * 3); // @math one to three pictures a tick
      for (let d = 0; d < draws; d++) {
        const alpha = t % 150 === 75 && d > 0 ? 0 : pick(); // @math once in a while back without a tick (the in-race menu)
        if (enh.active()) guarded(() => drawEnhanced(enh, sc, alpha, index, out)); else drawOriginal(sc, index);
        const st = enh.stats(); cap.particles = Math.max(cap.particles, st.particles); cap.marks = Math.max(cap.marks, st.marks);
      }
    }
    const cam = { x: s.beforeAnswer?.cx ?? s.car.cx, y: s.beforeAnswer?.cy ?? s.car.cy, h: s.beforeAnswer?.heading ?? s.car.heading };
    if (prev && !s.intro && !prev.intro) {
      const move = Math.hypot(cam.x - prev.x, cam.y - prev.y), turn = Math.abs(((cam.h - prev.h + 2880) % 1920) - 960); // @math the shortest turn of 1920 compass units
      steps.camera = Math.max(steps.camera, move); steps.turn = Math.max(steps.turn, turn);
      if (move > MOTION.snapDistance || turn > MOTION.snapTurn) steps.snaps++;
      (s.ai?.racers ?? []).forEach((r, n) => { const p = prev.racers[n]; if (p) steps.racer = Math.max(steps.racer, Math.hypot(r.x - p.x, r.y - p.y)); });
    }
    prev = { ...cam, intro: Boolean(s.intro), racers: (s.ai?.racers ?? []).map(r => ({ x: r.x, y: r.y })) };
  }
  if (enh) { enh.reset(); const st = enh.stats(); if (st.particles !== 0 || st.marks !== 0) fail(`${sc.name}: particles or skid marks left after a reset`); }
  Math.random = keepRandom;
  return { name: sc.name, hashes, steps, cap };
}

const largest = { camera: 0, turn: 0, racer: 0, snaps: 0, particles: 0 };
for (const make of SCENARIOS) {
  const runs = ['none', 'original', 'enhanced'].map(r => runScenario(make, r)), [a, b, c] = runs;
  const differs = r => r.hashes.findIndex((h, i) => h !== a.hashes[i]);
  const bad = [b, c].map(differs);
  if (b.hashes.length !== a.hashes.length || c.hashes.length !== a.hashes.length || bad.some(i => i >= 0)) fail(`${a.name}: the state differs with the reference draw at tick ${bad[0]}, with the enhanced draw at tick ${bad[1]}`);
  else console.log(`ok   ${a.name}: ${a.hashes.length} ticks, the same state with no draw, the reference draw and the enhanced draw; largest steps camera ${a.steps.camera.toFixed(1)}, turn ${a.steps.turn}, racer ${a.steps.racer.toFixed(1)}; particles at most ${c.cap.particles}, skid mark segments at most ${c.cap.marks}`);
  for (const k of ['camera', 'turn', 'racer', 'snaps']) largest[k] = k === 'snaps' ? largest[k] + a.steps[k] : Math.max(largest[k], a.steps[k]);
  largest.particles = Math.max(largest.particles, c.cap.particles); largest.marks = Math.max(largest.marks ?? 0, c.cap.marks);
}
console.log(`steps: camera ${largest.camera.toFixed(1)} (limit ${MOTION.snapDistance}), turn ${largest.turn} (limit ${MOTION.snapTurn}), racer ${largest.racer.toFixed(1)}; ${largest.snaps} ticks beyond the limits in running races`);
if (largest.particles > PARTICLES.cap) fail(`${largest.particles} particles, the cap is ${PARTICLES.cap}`);
if (largest.marks > MARKS.cap) fail(`${largest.marks} skid mark segments, the cap is ${MARKS.cap}`);
if (!largest.marks) fail('no scenario laid a skid mark: the hand brake turns and the brake of the scripted races should');

// ---- 2. the reference picture at the tick, and the overlays with every effect on
for (const make of SCENARIOS) {
  const sc = make(), s = sc.state, plain = createEnhancer({ storage: memory() }), full = createEnhancer({ storage: memory() });
  plain.configure({ ...PRESETS.original, smooth: true }); full.configure(PRESETS.enhanced);
  const ref = new Uint8Array(SIZE), idx = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), all = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
  let compared = 0, wrong = null;
  for (let t = 0; t < frames && !wrong; t++) {
    const input = sc.input();
    if (input === null) break;
    stepRace(s, input); plain.afterTick(s); full.afterTick(s);
    if (t % 23 !== 0) continue; // @math a sample now and then
    drawEnhanced(plain, sc, 1, idx, out);
    drawOriginal(sc, ref);
    const palette = rgbaPalette(s.world.palette);
    const at = ref.findIndex((v, i) => v !== idx[i] || out[i * 4] !== palette[v * 4] || out[i * 4 + 1] !== palette[v * 4 + 1] || out[i * 4 + 2] !== palette[v * 4 + 2]); // @math four bytes a colour
    if (at >= 0) { wrong = `tick ${t}: pixel ${at % WIDTH},${Math.floor(at / WIDTH)} is ${idx[at]}, the reference ${ref[at]}`; break; }
    drawEnhanced(full, sc, 1, idx, all);
    const { mask } = full.inspect();
    const hud = mask.findIndex((m, i) => m && [0, 1, 2].some(k => all[i * 4 + k] !== palette[ref[i] * 4 + k])); // @math four bytes a colour, three of them compared
    if (hud >= 0) { wrong = `tick ${t}: the overlay pixel ${hud % WIDTH},${Math.floor(hud / WIDTH)} differs with every effect on`; break; }
    compared++;
  }
  if (wrong) fail(`${sc.name}: ${wrong}`); else console.log(`ok   ${sc.name}: ${compared} pictures at the tick equal the reference renderer's, overlays untouched by the effects`);
}

// ---- 2b. the second player's full-screen view of a link race (the page's drawLinkRace: the seats swapped for the draw)
{
  const state = { ...base(), class: 1, engine: 1, humanSlot: 7, versusMode: { kind: 'race', cars: 2, laps: 2, class: 1, engine: 1, slots: [7, 4] } }; // @math the setup of check:versus' race
  startRace(state, { ...loadTrack(dat, '1', 1, 7, { split: false }), lion: lionBytes(members) }, 2); state.versusMode = null; // @math two laps; a link race draws the track's sky
  const enh = createEnhancer({ storage: memory() }), ref = new Uint8Array(SIZE), idx = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), palette = rgbaPalette(state.world.palette); // @math four bytes a colour
  enh.configure({ ...PRESETS.original, smooth: true });
  let compared = 0, wrong = null, f = 0;
  for (let t = 0; t < frames && !wrong; t++) {
    const k = Math.floor(f / 30) % 3; f++; // @math a steering change every thirty ticks
    stepRace(state, { p1: { ...none, accelerate: true, left: k === 1, right: k === 2 }, p2: { ...none, accelerate: true, left: k === 2, right: k === 1, fire: f % 45 < 15 } }); // @math the fire key a third of the time
    enh.afterTick(state);
    if (t % 23 !== 0) continue; // @math a sample now and then
    const P = enh.drawSingle(state, 1, { index: idx, out, palette, mode: state.detail, overlays: (p, fb) => drawRaceOverlays(p, fb), seat: 1 });
    if (!state.minimap && P.minimap) state.minimap = P.minimap;
    swapSeat(state); drawRaceFrame(state, ref); swapSeat(state);
    const at = ref.findIndex((v, i) => v !== idx[i]);
    if (at >= 0) wrong = `tick ${t}: pixel ${at % WIDTH},${Math.floor(at / WIDTH)} is ${idx[at]}, the reference ${ref[at]}`;
    compared++;
  }
  if (wrong) fail(`link race, second seat: ${wrong}`); else console.log(`ok   link race, second seat: ${compared} pictures at the tick equal the reference renderer's swapped view`);
}

// ---- 2c. the brake's skid: a car that only brakes (no slide, no hand brake, no hop) lays marks, from the SKID among the tick's sounds
{
  const state = base(); startRace(state, { ...loadTrack(dat, '1'), lion: lionBytes(members) }, 6); // @math six laps
  const enh = createEnhancer({ storage: memory() }); enh.configure({ ...PRESETS.original, skidMarks: true });
  let t = 0, braking = 0;
  for (; t < 600 && (state.start.mode !== 2 || state.car.throttle < 60); t++) { stepRace(state, { accelerate: true }); enh.afterTick(state); } // @math racing (the mode word 2) and up to speed
  const before = enh.stats().marks;
  for (let k = 0; k < 6; k++) { // @math six ticks of brake
    stepRace(state, { brake: true }); enh.afterTick(state);
    if (state.car.drift !== 0 || state.car.turn !== 0 || state.car.hop !== 0) fail('the brake test slid: it would not show the brake path');
    if (state.car.throttle > 0 || k === 0) braking++;
  }
  const laid = enh.stats().marks - before;
  if (!laid) fail(`braking from throttle ${state.car.throttle} laid no skid marks`); else console.log(`ok   braking alone laid ${laid} skid mark segments in 6 ticks`);
}

// ---- 3. the asset garage's race preview (src/viewer-preview.js): a demo track and pilot tracks run, draw and go back
for (const track of ['2', '6', '12', '27']) {
  try {
    const preview = createRacePreview(dat, track), original = new Uint8ClampedArray(SIZE * 4), enhanced = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
    preview.seek(500, PRESETS.enhanced); // @math a moment well into the race
    const s = preview.draw({ alpha: 0.5, hud: true, detail: 1 }, original, enhanced); // @math half way to the next pass
    if (preview.race.laps.lap < 1) throw new Error(`the drive did not start a lap in 500 passes (${preview.driver})`); // @math the first lap
    const tick = preview.tick; preview.seek(200, PRESETS.enhanced); preview.seek(500, PRESETS.enhanced); // @math back, then forward to the same moment
    if (preview.tick !== tick) throw new Error('going back and forward did not reach the same tick');
    console.log(`ok   preview of track ${track}: ${preview.driver}, lap ${preview.race.laps.lap} at pass 500, ${s.particles} particles, ${s.marks} skid mark segments`);
  } catch (e) { fail(`preview of track ${track}: ${e.message}`); }
}

// ---- 3b. Stage 3: with a dark, cloudy, mountainous atmosphere on every track, the sky's layers, the lighting and the water change the track's
// sky and world, and leave alone what is not the track's sky (a demo's slide page, the split screen's strips) and the overlays
function slides() {
  const spec = demoSpec('ordering', null), state = { ...base(), class: spec.class, engine: spec.engine, detail: spec.detail, humanSlot: 0, demo: { kind: 'ordering', spec, mode: spec.mode, page: 1, pictures: spec.pages.map(n => decodePcxMember(members.get(n))) } };
  startRace(state, { ...loadTrack(dat, String(spec.track), spec.engine, 0), lion: lionBytes(members) }, spec.laps); beginIntro(state);
  let bmc = bmcStart(parseBmc(members.get(`${spec.track}.BMC`) ?? new Uint8Array(0)));
  return { name: `slides of track ${spec.track}`, state, input: () => { if (state.intro) return {}; const s = bmcStep(bmc); bmc = s.state; return s.controls.end ? {} : s.controls; } };
}
{
  const dark = Object.fromEntries(raceTracks.map(t => [String(t), { grade: 'night', clouds: 0.9, range: 1, rangeShape: 'mountains', water: 1 }])); // @math every track night, cloudy and mountainous
  for (const [make, sky] of [[slides, false], [() => versus(1, 'race'), false], [() => race(7), true]]) { // @math a slides demo, the split screen, a race on a track with sky
    const sc = make(), s = sc.state, on = createEnhancer({ storage: memory(dark) }), off = createEnhancer({ storage: memory(dark) });
    on.configure(PRESETS.enhanced); off.configure({ ...PRESETS.enhanced, clouds: false, lighting: false, water: false });
    const a = new Uint8ClampedArray(SIZE * 4), b = new Uint8ClampedArray(SIZE * 4), idx = new Uint8Array(SIZE), ref = new Uint8Array(SIZE); // @math four bytes a colour
    let wrong = null, changed = 0, compared = 0;
    for (let t = 0; t < Math.min(frames, 300) && !wrong; t++) { // @math long enough for the slides and the clouds to move
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); on.afterTick(s); off.afterTick(s);
      if (t % 29 !== 0) continue; // @math a sample now and then
      drawEnhanced(off, sc, 1, idx, b); drawEnhanced(on, sc, 1, idx, a); drawOriginal(sc, ref); // at the tick, where the overlays (the overhead map's dots) are the reference renderer's
      const { L, mask } = on.inspect(), palette = rgbaPalette(s.world.palette);
      for (let i = 0; i < SIZE && !wrong; i++) {
        const same = a[i * 4] === b[i * 4] && a[i * 4 + 1] === b[i * 4 + 1] && a[i * 4 + 2] === b[i * 4 + 2]; // @math four bytes a colour
        if (mask[i] && [0, 1, 2].some(k => a[i * 4 + k] !== palette[ref[i] * 4 + k])) wrong = `tick ${t}: the overlay pixel ${i % WIDTH},${Math.floor(i / WIDTH)} changed`; // @math four bytes a colour, three compared
        else if (!sky && L.kind[i] === KIND.sky && !same) wrong = `tick ${t}: the sky-row pixel ${i % WIDTH},${Math.floor(i / WIDTH)} (a slide's page or the strips' picture) changed`;
        else if (sky && L.kind[i] === KIND.sky && !same) changed++;
      }
      compared++;
    }
    if (wrong) fail(`${sc.name}, sky layers, lighting and water: ${wrong}`);
    else if (sky && !changed) fail(`${sc.name}: the sky layers and the lighting changed no pixel of the track's sky`);
    else console.log(`ok   ${sc.name}: ${compared} pictures with a night, cloudy, mountainous atmosphere: the overlays untouched${sky ? `, ${changed} sky pixels changed` : ', the sky rows (not the track\'s sky) untouched'}`);
  }
  // One effect alone, on the race view's pilot (it drives the computer cars' route, over the bridges and the lakes): the sky's layers change
  // only the sky and the strip's pixels in its sky's indices, the water only the ground's liquid pixels; each changes some.
  for (const [track, label, key, own] of [[3, 'the sky layers', 'clouds', (L, i, idx, w) => L.kind[i] === KIND.sky || (L.kind[i] === KIND.horizon && stripSkyIndices(w)[(Math.floor(i / WIDTH) - 110) * 256 + idx[i]] === 1)], [7, 'the water', 'water', (L, i) => L.kind[i] === KIND.floor && L.wet[i] !== 0], [6, 'the red liquid', 'water', (L, i) => L.kind[i] === KIND.floor && L.wet[i] !== 0]]) { // @math tracks with a sun in the strip, a lake, the red liquid; the strip's first row and 256 index flags a row
    const atmo = { [track]: { range: 1, rangeShape: 'mountains', clouds: 0.9, water: 1 } }, base = { ...PRESETS.enhanced, lighting: false, clouds: false, water: false, [key]: true };
    const pOn = createRacePreview(dat, String(track), { atmosphere: n => atmo[n] ?? null, demoControls: false }), pOff = createRacePreview(dat, String(track), { atmosphere: n => atmo[n] ?? null, demoControls: false });
    const o = new Uint8ClampedArray(SIZE * 4), a = new Uint8ClampedArray(SIZE * 4), b = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
    let wrong = null, changed = 0;
    for (let pass = 150; pass <= 1200 && !wrong; pass += 75) { // @math a moment every 75 passes of the pilot's drive
      pOn.seek(pass, base); pOff.seek(pass, { ...base, [key]: false });
      pOff.draw({ alpha: 1, hud: true }, o, b); pOn.draw({ alpha: 1, hud: true }, o, a);
      const { L, mask } = pOn.enhancer.inspect(), w = pOn.race.world, idx = new Uint8Array(SIZE);
      pOn.enhancer.drawSingle(pOn.race, 1, { index: idx, out: new Uint8ClampedArray(SIZE * 4), palette: rgbaPalette(w.palette), mode: 1, sky: sceneSky(pOn.race), overlays: (p, fb) => drawRaceOverlays({ ...p, demo: null }, fb) }); // @math four bytes a colour: the indexed picture of the same moment
      for (let i = 0; i < SIZE && !wrong; i++) {
        if ([0, 1, 2].every(k => a[i * 4 + k] === b[i * 4 + k])) continue; // @math four bytes a colour, three compared
        if (mask[i] || !own(L, i, idx, w)) wrong = `pass ${pass}: the pixel ${i % WIDTH},${Math.floor(i / WIDTH)} (kind ${L.kind[i]}) changed`;
        else changed++;
      }
    }
    if (wrong) fail(`track ${track}, ${label} alone: ${wrong}`);
    else if (!changed) fail(`track ${track}: ${label} changed no pixel`);
    else console.log(`ok   track ${track}, ${label} alone: ${changed} pixels changed, all of them its own`);
  }
}

// ---- 4. the draw time of each effect
if (timing) {
  const device = (() => { try { return process.platform === 'darwin' ? execSync('sysctl -n hw.model', { encoding: 'utf8' }).trim() : os.hostname(); } catch { return os.hostname(); } })();
  console.log(`\ndraw time per frame on ${device}, ${os.cpus()[0].model}, node ${process.version}, about 5 pictures a tick (60 Hz over the 11.3 Hz ticks):`);
  const configs = [['reference renderer', null], ['smooth motion', { ...PRESETS.original, smooth: true }], ['+ shadows', { ...PRESETS.original, smooth: true, shadows: true, sceneryShadows: true }], ['+ sun shadows', { ...PRESETS.original, smooth: true, sunShadows: true }], ['+ particles', { ...PRESETS.original, smooth: true, particles: true }], ['+ skid marks', { ...PRESETS.original, smooth: true, skidMarks: true }], ['+ fog', { ...PRESETS.original, smooth: true, fog: true }], ['+ sky layers', { ...PRESETS.original, smooth: true, clouds: true }], ['+ sky, mountains', { ...PRESETS.original, smooth: true, clouds: true }, { range: 1, rangeShape: 'mountains' }], ['+ water', { ...PRESETS.original, smooth: true, water: true }], ['+ lighting (sunset)', { ...PRESETS.original, smooth: true, lighting: true }, { grade: 'sunset' }], ['Enhanced (all)', PRESETS.enhanced], ['Enhanced, sunset', PRESETS.enhanced, { grade: 'sunset' }]];
  for (const [label, cfg, atmosphere] of configs) {
    const times = [];
    for (const race of [1, 2, 3, 4]) { // @math the four attract races
      const sc = demo(race), s = sc.state, enh = createEnhancer({ storage: memory(atmosphere ? Object.fromEntries(raceTracks.map(t => [String(t), atmosphere])) : null) }), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), palette = rgbaPalette(s.world.palette); // @math four bytes a colour
      if (cfg) enh.configure(cfg);
      for (let t = 0; t < frames; t++) {
        const input = sc.input(); if (input === null) break;
        stepRace(s, input); enh.afterTick(s);
        for (let d = 0; d < 5; d++) { // @math five pictures a tick
          const t0 = performance.now();
          if (cfg) drawEnhanced(enh, sc, d / 5, index, out); // @math five pictures a tick
          else { drawOriginal(sc, index); for (let i = 0; i < SIZE; i++) { const p = index[i] * 4; out[i * 4] = palette[p]; out[i * 4 + 1] = palette[p + 1]; out[i * 4 + 2] = palette[p + 2]; out[i * 4 + 3] = 255; } } // @math the page's blit: four bytes a colour
          if (t > 20) times.push(performance.now() - t0); // @math after the warm-up
        }
      }
    }
    times.sort((x, y) => x - y);
    console.log(`  ${label.padEnd(20)} mean ${(times.reduce((x, y) => x + y, 0) / times.length).toFixed(2)} ms, 95th percentile ${times[Math.floor(times.length * 0.95)].toFixed(2)} ms`); // @math the 95th percentile
  }
}
console.log(`check:enhance ${SCENARIOS.length} scenarios, ${problems} problems`);
process.exitCode = problems ? 1 : 0;
