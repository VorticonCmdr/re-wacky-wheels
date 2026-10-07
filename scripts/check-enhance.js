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
//     sky-coloured pixels, the water alone only the liquid pixels of the ground, the relief alone only the ground and the pictures, and a
//     relief map of the player's for the cars only the pictures' pixels;
//  4c. the HUD layer: the enhancer's world and overlay layers give the very same picture as its draw without them, the overlays' layer
//     holds exactly the masked pixels, and the reference renderer's layers put back together are its picture;
//  5. with --time, the mean, median and 95th percentile draw time of each effect on the demos, on this machine (and of the general paths of
//     6, and of 2x: smooth motion only, Enhanced, Enhanced with a sunset, and both again with every soft layer at the output resolution);
//  6. Stage 4's general paths (caster.js, blit.js, composite.js compositeAt) and the draw of a geometry (the enhancer's own buffers, the
//     decimation, the split screen's general cut and flip, the world composed under the overlays, the canvas and the HUD built from it) forced
//     at the reference geometry (createEnhancer's `force`): every scenario, the slides demo, the link race's second seat, a race at detail
//     level 3 and the split screen with its viewers upside down now and then (the general mirror against the dispatched one), under
//     check:identity's configurations A to D (scripts/hash-enhance.js), give the very frame the functions the enhancer calls
//     there by default give (the picture, the index, the overlay mask, every layer and in C the world and HUD layers); the pictures of the
//     worlds' shapes the general blit draws as blocks at 2x are reported (only those: a drawn picture that is none of the world's shapes would
//     take blocks without being listed);
//  6b. the draw at a geometry above 1x (the frame context's `geometry` override): at 2x and at 2x with the wide view's margin for 4 BY 3
//     (without the margins' own records, which section 11 checks), smooth motion only, at the tick, the page's index (the world's reference
//     samples with the overlays over them) is the reference renderer's picture and the canvas is its colours, in every scenario, the slides
//     demo, the link race's second seat and the split screen with an upside-down half; every draw is the size of its geometry (layers()), so
//     none passes by drawing at 1x;
//  9. Stage 4's 2x (RESOLUTION 2X through the settings and the frame context's worldReady, as the page draws it), at the tick, in every
//     scenario, the slides demo, the link race's second seat and the split screen with an upside-down half: with smooth motion only the
//     index is the reference renderer's picture, the canvas its colours, and the HUD layer holds exactly the overlay pixels in the reference
//     picture's colours; with fog, the sky's layers, the track lighting (a sunset grade and the ground's relief) and the water on (the
//     particles off: their discs are drawn at the output resolution) every pixel of the world's reference samples that is no picture, no
//     overlay and under no contact shadow, sun shadow or skid mark is the 1x Enhanced picture's, and with the relief off the pictures' pixels
//     are too; every draw is 640 x 400. Section 1 runs 2x too, switching between 1x and 2x mid-run.
//  11. Stage 4's wide view (VIEW WIDE through the settings and the frame context) at 1x and 2x against the standard view and the reference
//     renderer, with and without the margins' probes (the full list at the section). Section 1 switches into and out of it mid-run too.
// usage: node scripts/check-enhance.js [WACKY.DAT] [--frames N] [--time] [--only 1,2,2b,2c,3,3b,3c,6,6b,9,11] (--only runs the sections named, for a
// quick look; the gate is the run of every section)
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack, rgbaPalette } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { parseMov } from '../src/game/figure.js';
import { startRace, stepRace, beginIntro, shownCycle } from '../src/game/race.js';
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
import { overlayLayers } from '../src/enhance/display.js';
import { createReliefProvider } from '../src/enhance/relief-store.js';
import { SENTINEL } from '../src/enhance/composite.js';
import { LAYER_KEYS } from '../src/enhance/scene.js';
import { blockPictures } from '../src/enhance/blit.js';
import { geometryOf, viewMargin, wideReport, stripPeriod } from '../src/enhance/geometry.js';
import { normalizeDisplay } from '../src/enhance/display-settings.js';
import { WIDE, SUN } from '../src/enhance/config.js';
import { splitSample } from '../src/enhance/split.js';
import { RACE as VERSUS_RACE } from '../src/game/versus-rules.js';

const args = process.argv.slice(2), frames = args.includes('--frames') ? Number(args[args.indexOf('--frames') + 1]) : 500, path = args.find(a => /\.dat$/i.test(a)), timing = args.includes('--time');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null, want = id => !only || only.includes(id);
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
// The enhanced picture of a state, as the page draws it where its display shows a world of any size (worldReady: the settings' resolution and
// view, the display's default shape 4 BY 3, a slides demo never wide).
const ASPECT = normalizeDisplay().aspect;
function drawEnhanced(enh, sc, alpha, index, out, layers = null) {
  const s = sc.state, palette = rgbaPalette(s.world.palette);
  const P = sc.split ? enh.drawSplit(s, alpha, { index, out, palette, mode: s.menu.settings.detail.split, overlays: versusOverlays, layers, worldReady: true })
    : enh.drawSingle(s, alpha, { index, out, palette, mode: s.detail, sky: sceneSky(s), overlays: (p, fb) => drawRaceOverlays(p, fb), layers, worldReady: true, aspect: ASPECT, wideAllowed: !sc.link && !sceneSky(s) });
  if (!s.minimap && P.minimap) s.minimap = P.minimap; // what the page keeps of the overhead map
  return out;
}
// The margin a scenario's frame must get in the wide view: none in the split screen, a link race or a slides demo or for a world that fails
// its checks (wideReport, printed per track in section 11), else the plan's for the display's shape, written out here rather than taken from
// viewMargin (the code under test): 53 columns a side on 4 BY 3 (426 x 200 at 1x, 852 x 400 at 2x) and 18 on 16 BY 10, for a 16:9 picture.
const WIDE_MARGIN = { dos: 53, wide: 18 }; // @math the plan's margins for 16:9
if (!Object.hasOwn(WIDE_MARGIN, ASPECT)) throw new Error(`check:enhance has no wide margin for the display shape '${ASPECT}'`);
const marginOf = (enh, sc) => (enh.settings.view !== 'wide' || sc.split || sc.link || sceneSky(sc.state) || !wideReport(sc.state.world).ok ? 0 : WIDE_MARGIN[ASPECT]);
// The world's size the settings ask for, against what the last draw drew (every draw above 1x or wide checks it: none passes by drawing at 1x
// or in the standard view).
const sizeWrong = (enh, sc) => { const l = enh.layers(), s = enh.settings.scale, m = marginOf(enh, sc); return l && (l.world.w !== s * (WIDTH + 2 * m) || l.world.h !== s * (SIZE / WIDTH) || l.logical.w !== WIDTH + 2 * m) ? `drew ${l.world.w} x ${l.world.h} (logical ${l.logical.w}) at ${s}x with a margin of ${m}` : null; }; // @math a margin either side

// ---- 1. the same simulation whatever is drawn
const SKIP = new Set(['world', 'dat', 'hudArt', 'mov', 'menu', 'unproven', 'minimap', 'steps']);
const hashState = s => crc32(new TextEncoder().encode(JSON.stringify(s, (k, v) => (SKIP.has(k) ? undefined : ArrayBuffer.isView(v) ? `#${v.length}` : typeof v === 'function' ? undefined : v instanceof Set ? undefined : v))));
const lehmer = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // @math a repeatable stand-in for the browser's random source
const keepRandom = Math.random;
const guarded = fn => { const r = Math.random; Math.random = () => { throw new Error('the enhanced presentation used Math.random'); }; try { return fn(); } finally { Math.random = r; } };
const SWITCHES = [PRESETS.enhanced, { ...PRESETS.enhanced, scale: 2 }, { ...PRESETS.original, smooth: true }, { ...PRESETS.original, smooth: true, scale: 2 }, PRESETS.original, { ...PRESETS.enhanced, view: 'wide' }, { ...PRESETS.original, shadows: true, fog: true }, { ...PRESETS.enhanced, particleAmount: 0.3, fogStrength: 0.4, scale: 2 }, { ...PRESETS.enhanced, scale: 2, view: 'wide' }]; // Stage 4: 2x and the wide view among them, switched to and from mid-run
// A settings change every `EVERY` ticks, so that a run of `frames` ticks applies every entry, Original's reference renderer back to the enhanced
// path (its reset) among them; a run that goes past the last change and misses one fails.
const EVERY = Math.max(Math.floor(frames / (SWITCHES.length + 1)), 1);

function runScenario(make, regime) {
  Math.random = lehmer(777);
  const sc = make(), s = sc.state, hashes = [], enh = regime === 'enhanced' ? createEnhancer({ storage: memory() }) : null, pick = createRandom(31), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
  const steps = { camera: 0, turn: 0, racer: 0, snaps: 0 }, cap = { particles: 0, marks: 0, scales: new Set(), applied: new Set(), revived: 0 }; // `applied`: the entries of SWITCHES configured; `revived`: the changes from the reference renderer to the enhanced path
  if (enh) enh.configure(PRESETS.enhanced);
  let prev = null;
  for (let t = 0; t < frames; t++) {
    const input = sc.input();
    if (input === null) break;
    stepRace(s, input);
    hashes.push(hashState(s));
    if (regime === 'original') drawOriginal(sc, index);
    if (enh) {
      if (t % EVERY === EVERY - 1) { const n = Math.floor(t / EVERY) % SWITCHES.length, was = enh.active(); enh.configure(SWITCHES[n]); cap.applied.add(n); if (!was && enh.active()) cap.revived++; } // a settings change now and then
      guarded(() => enh.afterTick(s));
      const draws = 1 + Math.floor(pick() * 3); // @math one to three pictures a tick
      for (let d = 0; d < draws; d++) {
        const alpha = t % 150 === 75 && d > 0 ? 0 : pick(); // @math once in a while back without a tick (the in-race menu)
        if (enh.active()) { guarded(() => drawEnhanced(enh, sc, alpha, index, out)); const bad = sizeWrong(enh, sc); if (bad && !cap.size) cap.size = `tick ${t}: ${bad}`; cap.scales.add(enh.layers().world.w); } else drawOriginal(sc, index);
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
  if (enh) { enh.reset(); const st = enh.stats(); if (st.particles !== 0 || st.marks !== 0) fail(`${sc.name}: particles or skid marks left after a reset`); if (cap.size) fail(`${sc.name}: ${cap.size}`); }
  if (enh && hashes.length >= EVERY * SWITCHES.length && (cap.applied.size < SWITCHES.length || !cap.revived)) fail(`${sc.name}: ${hashes.length} ticks applied ${cap.applied.size} of the ${SWITCHES.length} settings changes${cap.revived ? '' : ', none from the reference renderer back to the enhanced path'}`);
  Math.random = keepRandom;
  return { name: sc.name, hashes, steps, cap };
}

const largest = { camera: 0, turn: 0, racer: 0, snaps: 0, particles: 0 };
if (want('1')) for (const make of SCENARIOS) {
  const runs = ['none', 'original', 'enhanced'].map(r => runScenario(make, r)), [a, b, c] = runs;
  const differs = r => r.hashes.findIndex((h, i) => h !== a.hashes[i]);
  const bad = [b, c].map(differs);
  if (b.hashes.length !== a.hashes.length || c.hashes.length !== a.hashes.length || bad.some(i => i >= 0)) fail(`${a.name}: the state differs with the reference draw at tick ${bad[0]}, with the enhanced draw at tick ${bad[1]}`);
  else console.log(`ok   ${a.name}: ${a.hashes.length} ticks, the same state with no draw, the reference draw and the enhanced draw (${c.cap.applied.size} of ${SWITCHES.length} settings changes, worlds ${[...c.cap.scales].sort((x, y) => x - y).join(' and ')} wide); largest steps camera ${a.steps.camera.toFixed(1)}, turn ${a.steps.turn}, racer ${a.steps.racer.toFixed(1)}; particles at most ${c.cap.particles}, skid mark segments at most ${c.cap.marks}`);
  for (const k of ['camera', 'turn', 'racer', 'snaps']) largest[k] = k === 'snaps' ? largest[k] + a.steps[k] : Math.max(largest[k], a.steps[k]);
  largest.particles = Math.max(largest.particles, c.cap.particles); largest.marks = Math.max(largest.marks ?? 0, c.cap.marks);
}
if (want('1')) console.log(`steps: camera ${largest.camera.toFixed(1)} (limit ${MOTION.snapDistance}), turn ${largest.turn} (limit ${MOTION.snapTurn}), racer ${largest.racer.toFixed(1)}; ${largest.snaps} ticks beyond the limits in running races`);
if (want('1') && largest.particles > PARTICLES.cap) fail(`${largest.particles} particles, the cap is ${PARTICLES.cap}`);
if (want('1') && largest.marks > MARKS.cap) fail(`${largest.marks} skid mark segments, the cap is ${MARKS.cap}`);
if (want('1') && !largest.marks) fail('no scenario laid a skid mark: the hand brake turns and the brake of the scripted races should');

// ---- 2. the reference picture at the tick, and the overlays with every effect on
if (want('2')) for (const make of SCENARIOS) {
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
if (want('2b')) {
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
if (want('2c')) {
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
if (want('3')) for (const track of ['2', '6', '12', '27']) {
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
if (want('3b')) {
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
  const carsMap = createReliefProvider(() => dat).set([{ member: 'CARS.SP', kind: 'sprites', width: 38, height: 28, offset: 0, frames: Math.floor(members.get('CARS.SP').length / 1064), columnMajor: true, heights: Uint8Array.from({ length: Math.floor(members.get('CARS.SP').length / 1064) * 1064 }, (_, i) => (Math.floor((i % 1064) / 28) * 255) / 37) }]); // @math a map of the player's for CARS.SP: 38 x 28 frames (1064 bytes, column-major) rising from left to right
  for (const [track, label, key, own, offRelief = null, onRelief = null] of [[3, 'the sky layers', 'clouds', (L, i, idx, w) => L.kind[i] === KIND.sky || (L.kind[i] === KIND.horizon && stripSkyIndices(w)[(Math.floor(i / WIDTH) - 110) * 256 + idx[i]] === 1)], [7, 'the water', 'water', (L, i) => L.kind[i] === KIND.floor && L.wet[i] !== 0], [6, 'the red liquid', 'water', (L, i) => L.kind[i] === KIND.floor && L.wet[i] !== 0], [4, 'the relief', 'lighting', (L, i) => L.kind[i] === KIND.floor || L.kind[i] === KIND.sprite], [1, 'a relief map for the cars', 'relief map', (L, i) => L.kind[i] === KIND.sprite, null, carsMap]]) { // @math tracks with a sun in the strip, a lake, the red liquid, any track; the strip's first row and 256 index flags a row
    const atmo = { [track]: { range: 1, rangeShape: 'mountains', clouds: 0.9, water: 1, relief: 1 } }, map = key === 'relief map', base = { ...PRESETS.enhanced, lighting: map, clouds: false, water: false, ...(map ? {} : { [key]: true }) };
    const pOn = createRacePreview(dat, String(track), { atmosphere: n => atmo[n] ?? null, demoControls: false, relief: onRelief }), pOff = createRacePreview(dat, String(track), { atmosphere: n => atmo[n] ?? null, demoControls: false, relief: offRelief });
    const o = new Uint8ClampedArray(SIZE * 4), a = new Uint8ClampedArray(SIZE * 4), b = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
    let wrong = null, changed = 0;
    for (let pass = 150; pass <= 1200 && !wrong; pass += 75) { // @math a moment every 75 passes of the pilot's drive
      pOn.seek(pass, base); pOff.seek(pass, map ? base : { ...base, [key]: false });
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

// ---- 3c. the HUD layer (the display's own layer of the overlays): the same picture with and without layers, the overlays' layer exactly the
// overlay pixels, the world's layer the picture elsewhere; and for the reference renderer, its layers put back together are its picture. The
// split screen is drawn once with the first car upside down, the case where the overlays flip a viewer's half.
if (want('3c')) {
  const layers = () => ({ world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) }); // @math four bytes a colour
  for (const make of [() => race(7), () => versus(1, 'race'), slides]) { // @math a race, the split screen, a slides demo
    const sc = make(), s = sc.state, enh = createEnhancer({ storage: memory() }), idx = new Uint8Array(SIZE), a = new Uint8ClampedArray(SIZE * 4), b = new Uint8ClampedArray(SIZE * 4), L2 = layers(); // @math four bytes a colour
    enh.configure(PRESETS.enhanced);
    let wrong = null, compared = 0, hudPixels = 0;
    for (let t = 0; t < Math.min(frames, 260) && !wrong; t++) { // @math long enough for the HUD to change
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); enh.afterTick(s);
      if (t % 37 !== 0) continue; // @math a sample now and then
      const flip = sc.split && t % 74 === 0, car = sc.split ? carsBySeat(s)[0] : null, inverted = car?.inverted; // @math every other sample upside down
      if (flip) car.inverted = 1;
      const palette = rgbaPalette(s.world.palette), draw = (out, lay) => (sc.split ? enh.drawSplit(s, 0.5, { index: idx, out, palette, mode: s.menu.settings.detail.split, overlays: versusOverlays, layers: lay }) : enh.drawSingle(s, 0.5, { index: idx, out, palette, mode: s.detail, sky: sceneSky(s), overlays: (p, fb) => drawRaceOverlays(p, fb), layers: lay }));
      draw(a, null); draw(b, L2);
      const { mask } = enh.inspect();
      for (let i = 0; i < SIZE && !wrong; i++) {
        const o = i * 4, same = (x, y) => x[o] === y[o] && x[o + 1] === y[o + 1] && x[o + 2] === y[o + 2]; // @math four bytes a colour
        if (!same(a, b)) wrong = `tick ${t}: the picture with layers differs at ${i % WIDTH},${Math.floor(i / WIDTH)}`;
        else if ((L2.hud[o + 3] !== 0) !== Boolean(mask[i])) wrong = `tick ${t}: the overlays' layer at ${i % WIDTH},${Math.floor(i / WIDTH)} disagrees with the mask`; // @math the alpha byte
        else if (mask[i] ? !same(L2.hud, a) : !same(L2.world, a)) wrong = `tick ${t}: a layer's colour differs from the picture at ${i % WIDTH},${Math.floor(i / WIDTH)}`;
        if (mask[i]) hudPixels++;
      }
      if (!wrong && !sc.split) { // the reference renderer's layers, put back together
        const scene = new Uint8Array(SIZE), whole = new Uint8Array(SIZE), sentinel = new Uint16Array(SIZE).fill(SENTINEL), R = layers();
        renderScene(s, scene, s.detail, sceneSky(s)); whole.set(scene); drawRaceOverlays(s, whole); drawRaceOverlays(s, sentinel);
        overlayLayers(R, { under: scene, index: whole, sentinel, blank: SENTINEL, palette });
        for (let i = 0; i < SIZE && !wrong; i++) { const o = i * 4, src = R.hud[o + 3] ? R.hud : R.world, p = whole[i] * 4; if ([0, 1, 2].some(k => src[o + k] !== palette[p + k])) wrong = `tick ${t}: the reference renderer's layers put together differ at ${i % WIDTH},${Math.floor(i / WIDTH)}`; } // @math four bytes a colour, three compared
      }
      if (flip) car.inverted = inverted;
      compared++;
    }
    if (wrong) fail(`${sc.name}, HUD layer: ${wrong}`);
    else if (!hudPixels) fail(`${sc.name}, HUD layer: no overlay pixel in ${compared} pictures`);
    else console.log(`ok   ${sc.name}: ${compared} pictures with the HUD as a layer: the same picture, ${hudPixels} overlay pixels in the overlays' layer`);
  }
}

// ---- 6. Stage 4's general paths forced at the reference geometry: the same frame as the dispatched functions, configurations A to D of
// check:identity, every scenario with the slides demo, the link race's second seat, a race at detail level 3 and the split screen with a viewer
// upside down now and then (set on the state for both draws and put back before the next tick). The two enhancers draw the same
// state at the same blends; the overhead map is kept from the dispatched draw only after both have drawn, so each captures it from its own world.
if (want('6') || want('6b') || want('9') || want('11')) {
  const ticks = Math.min(frames, 160), FORCE = { caster: true, blit: true, composite: true, pipeline: true }; // @math the fly-in, the start and some racing
  const darkFull = Object.fromEntries(raceTracks.map(t => [String(t), { grade: 'night', clouds: 0.9, range: 1, rangeShape: 'mountains', water: 1, relief: 1 }])); // @math check:identity's B: every track night, cloudy, mountainous, its water and relief full
  const CONFIGS = { A: { settings: PRESETS.enhanced, atmosphere: null, layers: false }, B: { settings: PRESETS.enhanced, atmosphere: darkFull, layers: false }, C: { settings: PRESETS.enhanced, atmosphere: darkFull, layers: true }, D: { settings: { ...PRESETS.original, smooth: true }, atmosphere: null, layers: false } };
  const linkSecond = () => { // the second human's full screen of a link race (section 2b), the page's overhead map of the other human
    const state = { ...base(), class: 1, engine: 1, humanSlot: 7, versusMode: { kind: 'race', cars: 2, laps: 2, class: 1, engine: 1, slots: [7, 4] } }; // @math the setup of check:versus' race
    startRace(state, { ...loadTrack(dat, '1', 1, 7, { split: false }), lion: lionBytes(members) }, 2); state.versusMode = null; // @math two laps; a link race draws the track's sky
    let f = 0;
    return { name: 'link race, second seat', state, link: true, seat: 1, input: () => { const k = Math.floor(f / 30) % 3; f++; return { p1: { ...none, accelerate: true, left: k === 1, right: k === 2 }, p2: { ...none, accelerate: true, left: k === 2, right: k === 1, fire: f % 45 < 15 } }; } }; // @math a steering change every thirty ticks, the fire key a third of the time
  };
  // A race at detail level 3, the only scenario of the floor's mode 3 (its four-column blocks): the demos draw
  // at level 2 and the races at 1. Track 2 has water on its map, so B and C run the mode with the liquid and relief hooks. Both enhancers draw
  // the same state, so the level's own steering rate changes nothing compared.
  const lowDetail = () => { const sc = race(2); sc.state.detail = 3; return { ...sc, name: `${sc.name}, detail 3` }; }; // @math a track with water, none of every third; the low detail level
  const paletteOf = (s, t, fade) => { // the page's palette: the demos' fade-in over their first ticks (6-bit levels up by four a tick), else the cycled entries shown
    const level = fade && t < 16 ? Math.min(t * 4, 63) : null; // @math the fade's sixteen ticks, at most the 6-bit 63
    if (level !== null) return { palette: rgbaPalette(s.world.palette.map(v => Math.min(v, level))), cap: Math.min((level << 2) | (level >> 4), 255) }; // @math the 6-bit level widened to 8 bits
    const palette = rgbaPalette(s.world.palette), entries = shownCycle(s)?.entries;
    if (entries?.size) for (const [entry, c] of entries) c.forEach((v, k) => { palette[entry * 4 + k] = (v << 2) | (v >> 4); }); // @math four bytes an entry; 6 bits widened to 8
    return { palette, cap: 255 }; // @math the brightest 8-bit component
  };
  const draw = (enh, sc, alpha, index, out, palette, cap, layers) => {
    const s = sc.state;
    if (sc.split) return enh.drawSplit(s, alpha, { index, out, palette, cap, mode: s.menu.settings.detail.split, overlays: versusOverlays, layers });
    return enh.drawSingle(s, alpha, { index, out, palette, cap, mode: s.detail, sky: sceneSky(s), seat: sc.seat ?? 0, layers, overlays: (p, fb) => {
      if (sc.link) { const cars = carsBySeat(p); p.minimapOthers = [{ x: cars[1 - sc.seat].px, y: cars[1 - sc.seat].py }, ...(p.ai ? p.ai.racers.slice(VERSUS_RACE().firstComputer) : [])]; } // the page's link race map: the other human, then the computer racers
      drawRaceOverlays(p, fb);
    } });
  };
  const bytesOf = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const differs = (a, b) => !bytesOf(a).equals(bytesOf(b));
  const flipSplit = () => ({ ...versus(1, 'race'), name: 'versus race 1, upside down', flip: true }); // the split screen with a viewer upside down now and then (here and in 6b)
  const worlds = new Map(), started = performance.now();
  let pictures = 0, runs = 0, wrong = 0;
  if (want('6')) for (const [key, config] of Object.entries(CONFIGS)) for (const make of [...SCENARIOS, slides, linkSecond, lowDetail, flipSplit]) {
    Math.random = lehmer(4242 + runs); // @math a repeatable stand-in for the browser's random source, one seed a run
    const sc = make(), s = sc.state, fade = sc.name.startsWith('demo') || sc.name.startsWith('slides'), pick = createRandom(77 + runs); // @math the checks' seed
    const enh = [createEnhancer({ storage: memory(config.atmosphere) }), createEnhancer({ storage: memory(config.atmosphere), force: FORCE })];
    const buf = enh.map(() => ({ index: new Uint8Array(SIZE), out: new Uint8ClampedArray(SIZE * 4), layers: config.layers ? { world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) } : null })); // @math four bytes a colour
    for (const e of enh) e.configure(config.settings);
    worlds.set(s.world.name, s.world);
    let found = null;
    for (let t = 0; t < ticks && !found; t++) {
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); for (const e of enh) e.afterTick(s);
      const alphas = t % 2 ? [] : t % 14 === 6 ? [pick(), 1] : [pick()]; // @math every other tick, every fourteenth also at the tick itself
      const cars = sc.flip ? carsBySeat(s) : [], kept = cars.map(c => c.inverted), flips = [t % 8 === 4, t % 12 === 0]; // @math drawn ticks: the first viewer upside down every fourth of them, the second every sixth, both at once some
      cars.forEach((c, n) => { if (flips[n]) c.inverted = 1; }); // the drawn state only: put back before the next tick
      for (const alpha of alphas) {
        const { palette, cap } = paletteOf(s, t, fade), P = enh.map((e, n) => draw(e, sc, alpha, buf[n].index, buf[n].out, palette, cap, buf[n].layers));
        if (!s.minimap && P[0].minimap) s.minimap = P[0].minimap; // what the page keeps of the overhead map, after both draws
        const [a, b] = enh.map(e => e.inspect()), parts = [['out', buf[0].out, buf[1].out], ['index', buf[0].index, buf[1].index], ['mask', a.mask, b.mask], ...LAYER_KEYS.map(k => [k, a.L[k], b.L[k]]), ...(config.layers ? [['world layer', buf[0].layers.world, buf[1].layers.world], ['HUD layer', buf[0].layers.hud, buf[1].layers.hud]] : [])];
        const bad = parts.filter(([, x, y]) => differs(x, y)).map(([k, x, y]) => { const i = Math.floor(x.findIndex((v, j) => !Object.is(v, y[j])) / (x.length / SIZE)); return `${k} at ${i % WIDTH},${Math.floor(i / WIDTH)}`; }); // the pixel of the first differing byte (four a pixel in the RGBA pictures)
        if (bad.length) found = `tick ${t}, blend ${alpha.toFixed(3)}${flips.some((f, n) => f && cars[n]) ? ' (upside down)' : ''}: ${bad.join(', ')}`; // @math three decimals
        pictures++;
      }
      cars.forEach((c, n) => { c.inverted = kept[n]; });
    }
    runs++;
    if (found) { wrong++; fail(`general paths, configuration ${key}, ${sc.name}: ${found}`); }
  }
  Math.random = keepRandom;
  const blocks = [...worlds.values()].flatMap(w => blockPictures(w, 2).map(b => `${w.name}: class ${b.k} ${b.w} x ${b.h} (${b.why})`)); // @math the first scale above the reference
  if (want('6') && !wrong) console.log(`ok   general paths and the draw of a geometry at the reference geometry: ${runs / 4} scenarios under configurations A to D, ${pictures} pictures, each the dispatched draw's (picture, index, mask, ${LAYER_KEYS.length} layers, the HUD layers in C); at 2x ${blocks.length ? `${blocks.length} pictures of ${worlds.size} worlds drawn as blocks: ${blocks.slice(0, 6).join('; ')}` : `every picture of the ${worlds.size} worlds' shapes separable`} (${((performance.now() - started) / 1000).toFixed(0)} s)`); // @math four configurations; the first few; milliseconds in a second

  // ---- 6b. the draw at a geometry above 1x: at the tick, with smooth motion only, the index is the reference picture and the canvas its colours
  const geometries = [geometryOf({ s: 2, m: 0 }), geometryOf({ s: 2, m: viewMargin('wide', 'dos') })]; // @math 2x; 2x with the wide view's margin at 4 BY 3
  const hdStarted = performance.now();
  let hdPictures = 0, hdWrong = 0;
  if (want('6b')) for (const G of geometries) for (const make of [...SCENARIOS, slides, linkSecond, flipSplit]) {
    const sc = make(), s = sc.state;
    if (sc.split && G.m) continue; // the split screen is never wide
    const enh = createEnhancer({ storage: memory(), probes: !G.m }), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), ref = new Uint8Array(SIZE); // @math four bytes a colour; the margin's own records (wide.js) off: a thing outside the reference fan may reach into its columns, which section 11 compares outside those records
    enh.configure({ ...PRESETS.original, smooth: true });
    let found = null;
    for (let t = 0; t < ticks && !found; t++) {
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); enh.afterTick(s);
      if (t % 7 !== 3) continue; // @math a sample now and then
      const car = sc.split ? carsBySeat(s)[0] : null, inverted = car?.inverted, flip = sc.flip && t % 14 === 3; // @math every other sample upside down
      if (flip) car.inverted = 1;
      const palette = rgbaPalette(s.world.palette);
      if (sc.split) enh.drawSplit(s, 1, { index, out, palette, mode: s.menu.settings.detail.split, overlays: versusOverlays, geometry: G });
      else { const P = enh.drawSingle(s, 1, { index, out, palette, mode: s.detail, sky: sceneSky(s), seat: sc.seat ?? 0, geometry: G, overlays: (p, fb) => drawRaceOverlays(p, fb) }); if (!s.minimap && P.minimap) s.minimap = P.minimap; }
      if (sc.link) { swapSeat(s); drawRaceFrame(s, ref); swapSeat(s); } // the second seat's view (section 2b)
      else drawOriginal(sc, ref);
      const L = enh.layers(), at = ref.findIndex((v, i) => v !== index[i] || out[i * 4] !== palette[v * 4] || out[i * 4 + 1] !== palette[v * 4 + 1] || out[i * 4 + 2] !== palette[v * 4 + 2]); // @math four bytes a colour
      if (L.world.w !== G.W || L.world.h !== G.H || L.logical.w !== G.refW) found = `tick ${t}: drew ${L.world.w} x ${L.world.h}, not ${G.W} x ${G.H}`;
      else if (at >= 0) found = `tick ${t}${flip ? ' (upside down)' : ''}: pixel ${at % WIDTH},${Math.floor(at / WIDTH)} is ${index[at]}, the reference ${ref[at]}`;
      if (flip) car.inverted = inverted;
      hdPictures++;
    }
    if (found) { hdWrong++; fail(`the draw at ${G.W} x ${G.H}, ${sc.name}: ${found}`); }
  }
  if (want('6b') && !hdWrong) console.log(`ok   the draw at ${geometries.map(G => `${G.W} x ${G.H}`).join(' and ')}: ${hdPictures} pictures at the tick, each index the reference renderer's picture and each canvas its colours (every scenario, the slides, the link race's second seat, the split screen upside down) (${((performance.now() - hdStarted) / 1000).toFixed(0)} s)`); // @math milliseconds in a second

  // ---- 9. 2x through the settings (RESOLUTION 2X and the frame context's worldReady, as the page draws it), at the tick: the reference
  // picture's samples (the index, the canvas, the HUD layer) with smooth motion only, and the 1x Enhanced picture at the world's samples
  // with fog, the sky's layers, the lighting and the water on (G1b), outside the pictures, the overlays and the soft shadows and marks.
  const lit = Object.fromEntries(raceTracks.map(t => [String(t), { grade: 'sunset', clouds: 0.9, range: 1, rangeShape: 'mountains', water: 1, relief: 1 }])), flat = Object.fromEntries(Object.entries(lit).map(([k, v]) => [k, { ...v, relief: 0 }])); // @math every track: a sunset, cloudy, mountainous, its water and relief full; the same without the relief
  const G1B = { ...PRESETS.enhanced, particles: false }, two = settings => ({ ...settings, scale: 2 }); // @math the particles off: their discs are drawn at the output resolution
  const ninth = performance.now(), count = { pictures: 0, compared: 0, sprites: 0, spriteSame: 0, soft: 0, softSame: 0, hud: 0, scenarios: 0 }; // `soft`: the pixels under a shadow or a mark, left out (`softSame` of them the 1x colour all the same)
  let nineWrong = 0;
  if (want('9')) for (const make of [...SCENARIOS, slides, linkSecond, flipSplit]) {
    const sc = make(), s = sc.state, mem = memory(lit), memFlat = memory(flat);
    const E = { plain: createEnhancer({ storage: memory() }), one: createEnhancer({ storage: mem }), two: createEnhancer({ storage: mem }), oneFlat: createEnhancer({ storage: memFlat }), twoFlat: createEnhancer({ storage: memFlat }) };
    E.plain.configure(two({ ...PRESETS.original, smooth: true })); E.one.configure(G1B); E.two.configure(two(G1B)); E.oneFlat.configure(G1B); E.twoFlat.configure(two(G1B));
    const buf = () => ({ index: new Uint8Array(SIZE), out: new Uint8ClampedArray(SIZE * 4) }), b = Object.fromEntries(Object.keys(E).map(k => [k, buf()])), hud = { world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) }, ref = new Uint8Array(SIZE); // @math four bytes a colour
    let found = null;
    for (let t = 0; t < ticks && !found; t++) {
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); for (const e of Object.values(E)) e.afterTick(s);
      if (t % 7 !== 3) continue; // @math a sample now and then
      const car = sc.split ? carsBySeat(s)[0] : null, inverted = car?.inverted, flip = sc.flip && t % 14 === 3; // @math every other sample upside down
      if (flip) car.inverted = 1;
      const palette = rgbaPalette(s.world.palette), flipped = sc.split ? carsBySeat(s).map(c => c.inverted !== 0) : [];
      const drawn = (e, o, layers = null) => { // at the tick, as 6b draws (the link race's second seat with the reference renderer's own map, which drawRaceFrame draws for the comparison)
        const P = sc.split ? e.drawSplit(s, 1, { index: o.index, out: o.out, palette, mode: s.menu.settings.detail.split, overlays: versusOverlays, layers, worldReady: true })
          : e.drawSingle(s, 1, { index: o.index, out: o.out, palette, mode: s.detail, sky: sceneSky(s), seat: sc.seat ?? 0, layers, worldReady: true, aspect: ASPECT, wideAllowed: !sc.link && !sceneSky(s), overlays: (p, fb) => drawRaceOverlays(p, fb) });
        if (!s.minimap && P.minimap) s.minimap = P.minimap;
      };
      drawn(E.plain, b.plain, hud);
      if (sc.link) { swapSeat(s); drawRaceFrame(s, ref); swapSeat(s); } else drawOriginal(sc, ref);
      for (const k of ['one', 'two', 'oneFlat', 'twoFlat']) { drawn(E[k], b[k]); const bad = sizeWrong(E[k], sc); if (bad) found = `tick ${t}, ${k}: ${bad}`; }
      // The reference picture's samples: the index, the canvas, the HUD layer (exactly the overlay pixels, in the reference picture's colours).
      const P = E.plain.layers(), { mask } = E.plain.inspect(), G = geometryOf({ s: 2, m: 0 }); // @math 2x
      if (P.world.w !== G.W || P.world.h !== G.H || !P.hud || P.hud.w !== G.refW) found ??= `tick ${t}: smooth motion drew ${P.world.w} x ${P.world.h}${P.hud ? '' : ' with no HUD layer'}`;
      for (let i = 0; i < SIZE && !found; i++) {
        const c = ref[i] * 4, o = i * 4, y = Math.floor(i / WIDTH), x = i % WIDTH, h = (y * G.refW + x + G.m) * 4; // @math four bytes a colour
        if (b.plain.index[i] !== ref[i]) found = `tick ${t}: the index at ${x},${y} is ${b.plain.index[i]}, the reference ${ref[i]}`;
        else if ([0, 1, 2].some(k => b.plain.out[o + k] !== palette[c + k])) found = `tick ${t}: the canvas at ${x},${y} is not the reference colour`; // @math three components
        else if ((P.hud.data[h + 3] !== 0) !== Boolean(mask[i]) || (mask[i] && [0, 1, 2].some(k => P.hud.data[h + k] !== palette[c + k]))) found = `tick ${t}: the HUD layer at ${x},${y} is not the reference overlay`; // @math the alpha byte; three components
        if (mask[i]) count.hud++;
      }
      // G1b: the world's samples against the 1x Enhanced picture (the canvas map: the samples, the mirrored rows of an upside-down viewer).
      const at = sc.split ? splitSample(G, flipped) : G.sample;
      for (const [k1, k2, sprites] of [['one', 'two', false], ['oneFlat', 'twoFlat', true]]) {
        const one = E[k1].inspect(), wide = E[k2].inspect(), world = E[k2].layers().world.data, out1 = b[k1].out, Lw = wide.L, R = wide.R;
        for (let i = 0; i < SIZE && !found; i++) {
          if (one.mask[i]) continue; // the overlays
          const o = at[i], Y = Math.floor(o / G.W), X = o % G.W, r = R ? G.rowRef[Y] * G.refW + G.colRef[X] + G.m : o, soft = R ?? Lw;
          const sprite = one.L.kind[i] === KIND.sprite || Lw.kind[o] === KIND.sprite;
          const same = [0, 1, 2].every(k => world[o * 4 + k] === out1[i * 4 + k]); // @math four bytes a colour, three components compared
          if (sprite && !sprites) { count.sprites++; if (same) count.spriteSame++; continue; }
          if (one.L.shade[i] > 0 || one.L.cast[i] > 0 || one.L.mark[i] > 0 || soft.shade[r] > 0 || soft.cast[r] > 0 || soft.mark[r] > 0) { // the plan's exclusion; the reference look's soft layers are the 1x layers at the tick, so there they must match too
            count.soft++; if (same) count.softSame++;
            if (!same && R) found = `tick ${t}${flip ? ' (upside down)' : ''}: the shadowed or marked pixel ${i % WIDTH},${Math.floor(i / WIDTH)} differs from 1x in the reference look (its soft layers are the 1x layers)`;
            continue;
          }
          count.compared++;
          if (!same) found = `tick ${t}${flip ? ' (upside down)' : ''}, ${sprites ? 'relief off' : 'G1b'}: the ${sprite ? 'picture' : `kind ${one.L.kind[i]}`} pixel ${i % WIDTH},${Math.floor(i / WIDTH)} is ${[0, 1, 2].map(k => world[o * 4 + k]).join(',')} at 2x, ${[0, 1, 2].map(k => out1[i * 4 + k]).join(',')} at 1x`; // @math four bytes a colour, three components
        }
      }
      if (flip) car.inverted = inverted;
      count.pictures++;
    }
    count.scenarios++;
    if (found) { nineWrong++; fail(`2x, ${sc.name}: ${found}`); }
  }
  if (want('9') && !count.compared) fail('2x: no pixel compared with the 1x picture');
  else if (want('9') && !nineWrong) console.log(`ok   2x through the settings: ${count.scenarios} scenarios, ${count.pictures} pictures at the tick, each 640 x 400; the index, the canvas and the HUD layer (${count.hud} overlay pixels) the reference renderer's; ${count.compared} pixels of the world's samples the 1x Enhanced picture's with a sunset, the sky's layers, the relief and the water (the particles off), the pictures among them with the relief off; left out ${count.sprites} picture pixels with the relief on (${count.spriteSame} of them the 1x colour all the same) and ${count.soft} under a shadow or a mark (${count.softSame} of them the 1x colour, as the reference look's soft layers must be) (${((performance.now() - ninth) / 1000).toFixed(0)} s)`); // @math milliseconds in a second

  // ---- 11. the wide view (VIEW WIDE through the settings and the frame context, the display's default shape 4 BY 3: 53 columns a side), at 1x
  // and 2x, every scenario, the slides demo and the link race's second seat (neither ever wide). Each sample draws the same state at the same
  // blend in the standard view and the wide view, Enhanced with a sunset, the sky's layers, the relief and the water (a scenario's world and
  // HUD layers apart), and with smooth motion only at the tick:
  //  - the world: columns [s m, s (m + 320)) of the wide picture are the standard picture's, outside E: the pictures, contact shadows and
  //    sun casts of the margin's own records and of the records whose reference picture reaches column 0 or 319 (the standard view cuts them
  //    there, or their relief sees an open side), the sun casts and skid marks whose boxes cross a crop edge (outside the reference fan the
  //    wide projection puts their corners elsewhere), the particle discs of either view that cross a crop edge, and the s x SUN.blur columns
  //    inside each crop edge (the sun casts' blur reads across it);
  //  - the world's indices, kinds and depths are the standard view's outside the pictures of those records, and with the probes off (no
  //    margin records) outside the cut records' pictures alone;
  //  - the page's 320 x 200 index (smooth motion only, at the tick) is the reference renderer's picture outside the margin records' pictures,
  //    and with the probes off everywhere; the HUD layer (refW x 200) holds exactly the reference overlays moved by m, nothing else;
  //  - every draw is the size the settings ask for (426 x 200 at 1x, 852 x 400 at 2x: WIDE_MARGIN, not viewMargin; 320 or 640 wide where the
  //    view may not be wide).
  // It also prints each track's VIEW check against the TRIG cosine and its strip's period (geometry.js wideReport).
  const eleventh = performance.now(), wc = { scenarios: 0, pictures: 0, compared: 0, excluded: 0, records: 0, margin: 0, edge: 0, kinds: 0, kindsOff: 0, reference: 0, referenceOff: 0, hud: 0, probes: 0, narrow: 0 };
  let elevenWrong = 0;
  if (want('11')) {
    const reports = raceTracks.map(t => ({ t, ...wideReport(loadTrack(dat, String(t))) })), refused = reports.filter(r => !r.ok);
    console.log(`     the wide view's per-track checks: VIEW within ${Math.max(...reports.map(r => r.worst)).toExponential(2)} of the TRIG cosine at worst (tolerance ${WIDE.viewTolerance}) on ${reports.filter(r => r.view).length} of ${reports.length} tracks, the horizon strip repeating every ${stripPeriod()} pixels on ${reports.filter(r => r.period).length} of ${reports.length}${refused.length ? `; no wide view on track ${refused.map(r => r.t).join(', ')}` : ''}; per track (its worst VIEW difference, its strip):`);
    for (let i = 0; i < reports.length; i += 7) console.log(`       ${reports.slice(i, i + 7).map(r => `${r.t} ${r.worst.toExponential(2)} ${r.period ? 'repeats' : 'NO PERIOD'}${r.ok ? '' : ' REFUSED'}`).join(', ')}`); // @math seven tracks a line
    for (const scale of [1, 2]) for (const make of [...SCENARIOS, slides, linkSecond]) { // @math the two scales
      const sc = make(), st = sc.state, mem = memory(lit), cfg = { ...PRESETS.enhanced, scale }, smooth = { ...PRESETS.original, smooth: true, scale }, pick = createRandom(111 + wc.scenarios); // @math the checks' seed
      const E = { std: createEnhancer({ storage: mem, trace: true }), wide: createEnhancer({ storage: mem, trace: true }), off: createEnhancer({ storage: mem, probes: false, trace: true }), plain: createEnhancer({ storage: memory(), trace: true }), plainOff: createEnhancer({ storage: memory(), probes: false }) };
      E.std.configure(cfg); E.wide.configure({ ...cfg, view: 'wide' }); E.off.configure({ ...cfg, view: 'wide' }); E.plain.configure({ ...smooth, view: 'wide' }); E.plainOff.configure({ ...smooth, view: 'wide' });
      const buf = Object.fromEntries(Object.keys(E).map(k => [k, { index: new Uint8Array(SIZE), out: new Uint8ClampedArray(SIZE * 4), layers: { world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) } }])), ref = new Uint8Array(SIZE); // @math four bytes a colour
      const m = marginOf(E.wide, sc), G = geometryOf({ s: scale, m }), Gs = geometryOf({ s: scale, m: 0 }), cx0 = scale * m, cx1 = scale * (m + WIDTH), border = scale * SUN.blur; // the centre's output columns in the wide picture
      const drawn = (e, b, alpha) => {
        const palette = rgbaPalette(st.world.palette);
        const P = sc.split ? e.drawSplit(st, alpha, { index: b.index, out: b.out, palette, mode: st.menu.settings.detail.split, overlays: versusOverlays, layers: b.layers, worldReady: true })
          : e.drawSingle(st, alpha, { index: b.index, out: b.out, palette, mode: st.detail, sky: sceneSky(st), seat: sc.seat ?? 0, layers: b.layers, worldReady: true, aspect: ASPECT, wideAllowed: !sc.link && !sceneSky(st), overlays: (p, fb) => {
            if (sc.link) { const cars = carsBySeat(p); p.minimapOthers = [{ x: cars[1 - sc.seat].px, y: cars[1 - sc.seat].py }, ...(p.ai ? p.ai.racers.slice(VERSUS_RACE().firstComputer) : [])]; } // the page's link race map
            drawRaceOverlays(p, fb);
          } });
        if (!st.minimap && P.minimap) st.minimap = P.minimap;
        return sizeWrong(e, sc);
      };
      let found = null;
      for (let t = 0; t < ticks && !found; t++) {
        const input = sc.input(); if (input === null) break;
        stepRace(st, input); for (const e of Object.values(E)) e.afterTick(st);
        if (t % 7 !== 3) continue; // @math a sample now and then
        const alpha = t % 14 === 3 ? 1 : pick(); // @math every other sample at the tick
        for (const k of ['std', 'wide', 'off']) { const bad = drawn(E[k], buf[k], alpha); if (bad) found ??= `tick ${t}, ${k}: ${bad}`; }
        for (const k of ['plain', 'plainOff']) { const bad = drawn(E[k], buf[k], 1); if (bad) found ??= `tick ${t}, ${k}: ${bad}`; }
        if (sc.link) { swapSeat(st); drawRaceFrame(st, ref); swapSeat(st); } else drawOriginal(sc, ref);
        wc.pictures++;
        if (!m || found) { wc.narrow++; continue; } // a screen that may not be wide: its size is what is checked (the rest is section 9's and 6b's)
        const S0 = E.std.inspect(), W0 = E.wide.inspect(), O0 = E.off.inspect(), std = E.std.layers().world.data, wide = E.wide.layers().world.data, palette = rgbaPalette(st.world.palette);
        // The exclusions, on the wide picture's output pixels.
        const cut = new Uint8Array(G.W * G.H), records = new Uint8Array(G.W * G.H), cutOff = new Uint8Array(G.W * G.H);
        const box = (into, b) => { if (!b) return; for (let y = Math.max(b.y0, 0); y <= Math.min(b.y1, G.H - 1); y++) into.fill(1, y * G.W + Math.max(b.x0, 0), y * G.W + Math.min(b.x1, G.W - 1) + 1); };
        const crosses = b => b && ((b.x0 < cx0 && b.x1 >= cx0) || (b.x0 < cx1 && b.x1 >= cx1));
        for (const r of W0.trace.records) {
          if (r.margin || r.edge) { box(records, r.rect); box(cut, r.rect); box(cut, r.shade); box(cut, r.cast); wc[r.margin ? 'margin' : 'edge']++; }
          else if (crosses(r.cast)) box(cut, r.cast);
          wc.records++;
        }
        for (const r of S0.trace.records) { const c = r.cast && { ...r.cast, x0: r.cast.x0 + cx0, x1: r.cast.x1 + cx0 }; if (crosses(c)) box(cut, c); } // the standard view's casts and marks across the crop edges, moved onto the wide picture's columns (the pinhole puts the corners outside the fan elsewhere)
        for (const q of [...W0.trace.marks, ...S0.trace.marks.map(b => ({ ...b, x0: b.x0 + cx0, x1: b.x1 + cx0 }))]) if (crosses(q)) box(cut, q);
        for (const [sp, dx] of [...W0.splats.map(p => [p, 0]), ...S0.splats.map(p => [p, cx0])]) { const b = { x0: Math.floor(sp.x + dx - sp.r) - 1, x1: Math.ceil(sp.x + dx + sp.r) + 1, y0: Math.floor(sp.y - sp.r) - 1, y1: Math.ceil(sp.y + sp.r) + 1 }; if (crosses(b)) box(cut, b); } // the standard view's discs moved onto the wide picture's columns
        for (let y = 0; y < G.H; y++) { cut.fill(1, y * G.W + cx0, y * G.W + cx0 + border); cut.fill(1, y * G.W + cx1 - border, y * G.W + cx1); }
        for (const r of O0.trace.records) if (r.edge) box(cutOff, r.rect);
        // The world, the indices, kinds and depths of the centre.
        const sFb = S0.fb, Ls = S0.L, Lw = W0.L, Lo = O0.L;
        for (let Y = 0; Y < G.H && !found; Y++) for (let X = 0; X < Gs.W && !found; X++) {
          const o = Y * Gs.W + X, w = Y * G.W + X + cx0;
          if (!cut[w]) { wc.compared++; if ([0, 1, 2].some(k => std[o * 4 + k] !== wide[w * 4 + k])) found = `tick ${t}, blend ${alpha.toFixed(3)}: the world at ${X},${Y} (wide ${X + cx0}) is ${[0, 1, 2].map(k => wide[w * 4 + k]).join(',')} wide, ${[0, 1, 2].map(k => std[o * 4 + k]).join(',')} standard`; } // @math four bytes a colour, three components
          else wc.excluded++;
          if (!records[w]) { wc.kinds++; if (sFb[o] !== W0.fb[w] || Ls.kind[o] !== Lw.kind[w] || !Object.is(Ls.depth[o], Lw.depth[w])) found ??= `tick ${t}: the index, kind or depth at ${X},${Y} differs (${sFb[o]}/${W0.fb[w]}, ${Ls.kind[o]}/${Lw.kind[w]}, ${Ls.depth[o]}/${Lw.depth[w]})`; }
          if (!cutOff[w]) { wc.kindsOff++; if (sFb[o] !== O0.fb[w] || Ls.kind[o] !== Lo.kind[w] || !Object.is(Ls.depth[o], Lo.depth[w])) found ??= `tick ${t}, the probes off: the index, kind or depth at ${X},${Y} differs`; }
        }
        // The page's 320 x 200 index against the reference renderer's picture (at the tick, smooth motion only), and the HUD layer.
        const Pl = E.plain.inspect(), cells = new Uint8Array(SIZE);
        for (const r of Pl.trace.records) if (r.margin) for (let y = Math.max(Math.floor(r.rect.y0 / scale), 0); y <= Math.min(Math.floor(r.rect.y1 / scale), SIZE / WIDTH - 1); y++) for (let x = Math.max(Math.floor(r.rect.x0 / scale) - m, 0); x <= Math.min(Math.floor(r.rect.x1 / scale) - m, WIDTH - 1); x++) cells[y * WIDTH + x] = 1; // the margin records' pictures on the reference grid
        const hudLayer = E.plain.layers().hud;
        for (let i = 0; i < SIZE && !found; i++) {
          if (!cells[i]) { wc.reference++; if (buf.plain.index[i] !== ref[i]) found = `tick ${t}: the page's index at ${i % WIDTH},${Math.floor(i / WIDTH)} is ${buf.plain.index[i]}, the reference ${ref[i]}`; }
          wc.referenceOff++; if (buf.plainOff.index[i] !== ref[i]) found ??= `tick ${t}, the probes off: the page's index at ${i % WIDTH},${Math.floor(i / WIDTH)} is ${buf.plainOff.index[i]}, the reference ${ref[i]}`;
        }
        if (!hudLayer || hudLayer.w !== G.refW) found ??= `tick ${t}: no HUD layer ${G.refW} wide`;
        else for (let y = 0; y < SIZE / WIDTH && !found; y++) for (let X = 0; X < G.refW; X++) {
          const x = X - m, i = y * WIDTH + x, h = (y * G.refW + X) * 4, over = x >= 0 && x < WIDTH && Pl.mask[i]; // @math four bytes a colour
          if ((hudLayer.data[h + 3] !== 0) !== Boolean(over) || (over && [0, 1, 2].some(k => hudLayer.data[h + k] !== palette[ref[i] * 4 + k]))) { found = `tick ${t}: the HUD layer at ${X},${y} is not the reference overlay moved by ${m}`; break; } // @math the alpha byte; three components
          if (over) wc.hud++;
        }
      }
      wc.probes += E.wide.inspect().probes; wc.scenarios++;
      if (found) { elevenWrong++; fail(`the wide view at ${scale}x, ${sc.name}: ${found}`); }
    }
    if (!wc.compared || !wc.margin) fail(`the wide view: ${wc.compared} pixels compared, ${wc.margin} margin records drawn: nothing was checked`);
    else if (!elevenWrong) console.log(`ok   the wide view at 1x and 2x (${WIDTH + 2 * WIDE_MARGIN[ASPECT]} x 200 and ${2 * (WIDTH + 2 * WIDE_MARGIN[ASPECT])} x 400 on the display's shape ${ASPECT}, every draw that size or 320 columns where the view may not be wide): ${wc.scenarios} scenario runs, ${wc.pictures} samples (${wc.narrow} of them never wide); ${wc.compared} pixels of the centre the standard view's (${wc.excluded} left out: ${wc.margin} margin records and ${wc.edge} records cut at the reference edges with their shadows, the casts, marks and particles across a crop edge, the blur's border), its indices, kinds and depths the standard view's in ${wc.kinds} pixels (${wc.kindsOff} with the probes off); the page's index the reference picture in ${wc.reference} pixels outside the margin records (${wc.referenceOff} with the probes off, all of them); the HUD layer the reference overlays moved by the margin (${wc.hud} pixels); ${wc.probes} probes (${((performance.now() - eleventh) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  }
}

// ---- 4. the draw time of each effect
if (timing) {
  const device = (() => { try { return process.platform === 'darwin' ? execSync('sysctl -n hw.model', { encoding: 'utf8' }).trim() : os.hostname(); } catch { return os.hostname(); } })();
  console.log(`\ndraw time per frame on ${device}, ${os.cpus()[0].model}, node ${process.version}, about 5 pictures a tick (60 Hz over the 11.3 Hz ticks):`);
  const configs = [['reference renderer', null], ['smooth motion', { ...PRESETS.original, smooth: true }], ['+ shadows', { ...PRESETS.original, smooth: true, shadows: true, sceneryShadows: true }], ['+ sun shadows', { ...PRESETS.original, smooth: true, sunShadows: true }], ['+ particles', { ...PRESETS.original, smooth: true, particles: true }], ['+ skid marks', { ...PRESETS.original, smooth: true, skidMarks: true }], ['+ fog', { ...PRESETS.original, smooth: true, fog: true }], ['+ sky layers', { ...PRESETS.original, smooth: true, clouds: true }], ['+ sky, mountains', { ...PRESETS.original, smooth: true, clouds: true }, { range: 1, rangeShape: 'mountains' }], ['+ water', { ...PRESETS.original, smooth: true, water: true }], ['+ lighting (sunset)', { ...PRESETS.original, smooth: true, lighting: true }, { grade: 'sunset' }], ['Enhanced (all)', PRESETS.enhanced], ['Enhanced, sunset', PRESETS.enhanced, { grade: 'sunset' }], ['general paths 1x', PRESETS.enhanced, null, { caster: true, blit: true, composite: true }], // the last: Enhanced through Stage 4's general paths at the reference geometry (6)
    ['smooth only 2x', { ...PRESETS.original, smooth: true, scale: 2 }], ['Enhanced 2x', { ...PRESETS.enhanced, scale: 2 }], ['Enhanced 2x sunset', { ...PRESETS.enhanced, scale: 2 }, { grade: 'sunset' }], // Stage 4's 2x, the soft layers on the reference grid (HD.look 'reference')
    ['Enhanced 2x full', { ...PRESETS.enhanced, scale: 2 }, null, null, 'full'], ['Enhanced 2x sunset full', { ...PRESETS.enhanced, scale: 2 }, { grade: 'sunset' }, null, 'full'], // and with every soft layer at the output resolution ('full'), for comparison
    ['Enhanced 1x wide', { ...PRESETS.enhanced, view: 'wide' }], ['Enhanced 2x wide', { ...PRESETS.enhanced, scale: 2, view: 'wide' }]]; // Stage 4's wide view on the display's default shape (4 BY 3: 426 and 852 columns)
  console.log(`  (load average ${os.loadavg().map(v => v.toFixed(1)).join(' ')}: compare the rows against each other, a busy machine slows them all)`);
  for (const [label, cfg, atmosphere, force = null, look = undefined] of configs) {
    const times = [];
    let sized = null;
    for (const race of [1, 2, 3, 4]) { // @math the four attract races
      const sc = demo(race), s = sc.state, enh = createEnhancer({ storage: memory(atmosphere ? Object.fromEntries(raceTracks.map(t => [String(t), atmosphere])) : null), force, look }), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), palette = rgbaPalette(s.world.palette); // @math four bytes a colour
      if (cfg) enh.configure(cfg);
      for (let t = 0; t < frames; t++) {
        const input = sc.input(); if (input === null) break;
        stepRace(s, input); enh.afterTick(s);
        for (let d = 0; d < 5; d++) { // @math five pictures a tick
          const t0 = performance.now();
          if (cfg) drawEnhanced(enh, sc, d / 5, index, out); // @math five pictures a tick
          else { drawOriginal(sc, index); for (let i = 0; i < SIZE; i++) { const p = index[i] * 4; out[i * 4] = palette[p]; out[i * 4 + 1] = palette[p + 1]; out[i * 4 + 2] = palette[p + 2]; out[i * 4 + 3] = 255; } } // @math the page's blit: four bytes a colour
          if (t > 20) times.push(performance.now() - t0); // @math after the warm-up
          if (cfg) sized ??= sizeWrong(enh, sc);
        }
      }
    }
    if (sized) fail(`${label}: ${sized}`);
    times.sort((x, y) => x - y);
    console.log(`  ${label.padEnd(24)} mean ${(times.reduce((x, y) => x + y, 0) / times.length).toFixed(2)} ms, median ${times[times.length >> 1].toFixed(2)} ms, 95th percentile ${times[Math.floor(times.length * 0.95)].toFixed(2)} ms`); // @math the 95th percentile
  }
}
console.log(`check:enhance ${SCENARIOS.length} scenarios, ${problems} problems`);
process.exitCode = problems ? 1 : 0;
