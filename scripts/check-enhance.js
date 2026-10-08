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
//  4. the asset garage's race preview runs, draws, and reaches the same tick going back and forward, and draws its HUD at the wide view's edges;
//  4b. Stage 3: the sky's layers (the clouds and the far range), the track lighting and the moving water change the track's sky and world
//     but never a demo's slide page, the split screen's strips or the overlays; the sky's layers alone change only the sky and the strip's
//     sky-coloured pixels, the water alone only the liquid pixels of the ground, the relief alone only the ground and the pictures, and a
//     relief map of the player's for the cars only the pictures' pixels;
//  4c. the HUD layer: the enhancer's world and overlay layers give the very same picture as its draw without them, the overlays' layer
//     holds exactly the masked pixels, and the reference renderer's layers put back together are its picture;
//  time. with --time, the mean, median and 95th percentile draw time of each effect on the demos, on this machine (and of the general paths of
//     6, and of 2x: smooth motion only, Enhanced, Enhanced with a sunset, and both again with every soft layer at the output resolution; the
//     wide view at 1x and 2x; the smooth sprite sizes at 1x and 2x; Enhanced with an artwork pack of CARS.SP and the track's tile sheets, and with
//     kart angle sets of 32 directions besides);
//  5. Stage 4's region registry of the artwork packs (src/enhance/regions.js): every picture the scenarios' enhanced draws blit (standard
//     and wide, a recorder of the enhancer's) is a region of the registry, and the template of the local archive (src/enhance/art-template.js,
//     RGBA and indexed) validates with no entry refused;
//  7. Stage 4's artwork packs in the race: identity packs built at run time from the local archive (indexed at p = 1 and RGBA at p = 2, the
//     palette cycle's tile entries and the strip's sky-coloured pixels at alpha 0) give the no-pack picture byte for byte, Enhanced with the
//     dark full atmosphere, at 1x in every scenario (the beach tracks, the demos' fade-in and the split screen among them) and at 2x and in the
//     wide view in some; the packs' lookups reach the tiles, the skies, the strips, the pictures, the starter lion, the explosions, pictures at
//     byte offsets of no frame grid and the effects drawn after the own car; a tinted pack changes the picture. Section 1 switches the artwork
//     of a tinted pack on and off mid-run too.
//  8. Stage 4's kart angle sets (M4: src/enhance/angles.js): the convention check of every local track's route (its chords' octants are its
//     compass words: passes, or the track is reported); indexed N = 8 identity sets of every slot (CARS.SP's eight direction frames, p = 1) in
//     locked mode give the no-pack picture byte for byte in every scenario at 1x (and some at 2x, wide and in smooth sizes); every record
//     remapped by its direction has the bytes of the direction frame the game's rule chose (worked out here from the state: the tick's heading,
//     the racer's compass word and slot); the own car is never drawn from a set; N = 32 sets in locked and free mode move the karts between
//     the game's frames, locked never more than half an octant from the game's. Section 1 switches an N = 32 free set on and off mid-run too.
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
//  10. Stage 4's smooth sprite sizes (SPRITE SIZES SMOOTH, M7) against the stepped ones at the tick, at 1x, 2x and 1x wide, in every
//     scenario, the slides demo and the link race's second seat: every record's ground anchor within one reference column and one reference
//     row of its classes place at every distance; the particles and the skid marks on the same rows as the pictures; a far object's bottom
//     row continuous across the row table's plateau (the floor's own rows, geometry.js rowOfDepth, where the row table stands everything from
//     800 to 1122 on row 131), never above that row 131 (geometry.js standingRow: past the floor's last sample the floor draws no ground) and
//     its contact shadow on the floor; each track's floor giving those rows. Section 1 switches into and out of smooth sizes at 1x and 2x
//     mid-run too.
//  11. Stage 4's wide view (VIEW WIDE through the settings and the frame context) at 1x and 2x against the standard view and the reference
//     renderer, with and without the margins' probes (the full list at the section). Section 1 switches into and out of it mid-run too.
//  12. Stage 4's HUD at the edges of the wide view (VIEW WIDE EDGES, M9) at 1x and 2x on both display shapes, with the HUD layer and in the
//     picture, over the demos, the races and the duck game with the finish labels, the figure, the message, the crack, WRONG WAY and the in-race
//     menu set now and then: every element's pixels at its group's place, the forced overlays centred over them, the reference view unmoved,
//     drawOver's menu centred over a kept frame, no guard (the full list at the section).
// usage: node scripts/check-enhance.js [WACKY.DAT] [--frames N] [--time] [--only 1,2,2b,2c,3,3b,3c,5,6,6b,7,8,9,10,11,12] (--only runs the sections named, for
// a quick look; the gate is the run of every section)
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import os from 'node:os';
import { openGameFolder } from '../src/vfs/node.js';
import { archiveMembers, loadTrack, rgbaPalette } from '../src/game/track-data.js';
import { lionBytes } from '../src/game/start.js';
import { parseMov } from '../src/game/figure.js';
import { startRace, stepRace, beginIntro, shownCycle } from '../src/game/race.js';
import { demoSpec, parseBmc, bmcStart, bmcStep } from '../src/game/demo.js';
import { duckTrack, duckRules, duckPictures } from '../src/game/duck.js';
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
import { geometryOf, viewMargin, wideReport, stripPeriod, rowOfDepth, rowReport, standingRow } from '../src/enhance/geometry.js';
import { placeSmooth } from '../src/enhance/scene.js';
import { headingVector, rowAt } from '../src/enhance/project.js';
import { casterOf, stampShadow, shadowBox } from '../src/enhance/shadows.js';
import { models } from '../src/enhance/models.js';
import { viewSetup, projectPoint } from '../src/game/view.js';
import { clipPicture } from '../src/game/objects.js';
import { normalizeDisplay } from '../src/enhance/display-settings.js';
import { WIDE, SUN, ANGLES } from '../src/enhance/config.js';
import { splitSample } from '../src/enhance/split.js';
import { RACE as VERSUS_RACE } from '../src/game/versus-rules.js';
import { worldRegions } from '../src/enhance/regions.js';
import { buildTemplate, templateParts, cycledEntries } from '../src/enhance/art-template.js';
import { normalizeArtEntry, packContext } from '../src/enhance/pack-format.js';
import { createArtProvider, toArt } from '../src/enhance/art.js';
import { mapping as angleMapping, routeDirections } from '../src/enhance/angles.js';
import { racerFrame } from '../src/game/racers.js';
import { carFrame } from '../src/game/control.js';
import { viewRacers, viewSlots } from '../src/game/versus.js';
import { sceneCamera } from '../src/render/scene.js';
import { hudGroups, raceBase, raceForced } from '../src/enhance/hud-place.js';
import { drawBanner, drawPlace, drawName, drawSpeedometer, drawLapText, drawHeld, drawTimer, drawFigure, drawDuckBanner, drawMinimap, drawWrongWay } from '../src/render/hud.js';
import { drawDemoLogo, drawDemoText } from '../src/render/demo.js';
import { drawLabels } from '../src/render/finish.js';
import { drawCrack } from '../src/render/crack.js';
import { loadMenuArt, renderMenuOverlay } from '../src/render/menu.js';
import { createPause, viewOf as pauseView } from '../src/game/pause.js';
import { messageOf } from '../src/game/finish.js';
import { minimapAllowed, minimapOn, minimapDots } from '../src/game/minimap.js';
import { demoModel } from '../src/game/demo.js';
import { counterDigits, speedDigits, timerText, lapText } from '../src/game/hud.js';
import { driverName } from '../src/game/sounds.js';
import { PLAYER_SLOT } from '../src/game/player-car.js';
import { startFigure, stepFigure } from '../src/game/figure.js';

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

// ---- the artwork packs of the checks (Stage 4): built at run time from the local archive, in memory, never written anywhere.
const packWorld = loadTrack(dat, String(raceTracks[0])), packCtx = packContext(members, packWorld, dat), packCache = new Map();
// The template's entries (art-template.js) made art, each checked against the archive and its picture as an import checks it (a refusal fails).
// `keep(entry)` leaves entries out of the pack.
function packArts(options, change = null, keep = null) {
  const key = JSON.stringify(options);
  if (!change && !keep && packCache.has(key)) return packCache.get(key);
  const t = buildTemplate(members, packWorld, options), arts = [];
  t.manifest.entries.forEach((e, i) => { if (keep && !keep(e)) return; const image = change ? change(t.images[i], e) : t.images[i], r = normalizeArtEntry(e, packCtx, image); if (!r.entry) fail(`the pack ${key}: ${r.reason}`); else arts.push(toArt(r.entry, image)); });
  if (!change && !keep) packCache.set(key, arts);
  return arts;
}
// A kart angle set's template (art-template.js, its in-between cells empty) with each in-between cell drawn as the nearer original frame's cell: a
// set whose every direction is drawn, so locked and free mode move the karts between pictures (the original's own, here).
function fillSet(image, e) {
  if (e.kind !== 'angles') return image;
  const q = e.directions / 8, cw = e.cell[0], ch = e.cell[1], n = e.directions, indexed = Boolean(image.indices), px = indexed ? Uint8Array.from(image.indices) : Uint8ClampedArray.from(image.rgba), per = indexed ? 1 : 4; // @math the original's eight directions; four bytes a colour
  for (let k = 0; k < n; k++) {
    if (k % q === 0) continue;
    const from = (Math.round(k / q) * q) % n, a = { x: (from % e.columns) * cw, y: Math.floor(from / e.columns) * ch }, b = { x: (k % e.columns) * cw, y: Math.floor(k / e.columns) * ch };
    for (let y = 0; y < ch; y++) px.copyWithin(((b.y + y) * image.width + b.x) * per, ((a.y + y) * image.width + a.x) * per, ((a.y + y) * image.width + a.x + cw) * per);
  }
  return indexed ? { ...image, indices: px } : { ...image, rgba: px };
}
// A tinted pack (the RGBA template of CARS.SP, track 1's tile sheets and its strip, red and blue swapped, and N = 32 kart angle sets of every slot
// with their in-between cells drawn): it changes the picture, never the race.
let tintedOnce = null;
const tinted = () => (tintedOnce ??= (() => { const swap = (img, e) => { const filled = fillSet(img, e), rgba = Uint8ClampedArray.from(filled.rgba); for (let o = 0; o < rgba.length; o += 4) { const r = rgba[o]; rgba[o] = rgba[o + 2]; rgba[o + 2] = r; } return { ...filled, rgba }; }; const track = templateParts(members, packWorld).tracks[0]; return createArtProvider(() => dat).set([...['CARS.SP', ...track.tiles, track.par].flatMap(select => packArts({ select, scale: 2, color: 'rgba', track: track.stem }, swap)), ...packArts({ select: 'ANGLES:ALL', directions: 32, scale: 2, color: 'rgba', track: track.stem }, swap)]); })()); // @math four bytes a colour, red and blue swapped; a set of 32 directions

// ---- 1. the same simulation whatever is drawn
const SKIP = new Set(['world', 'dat', 'hudArt', 'mov', 'menu', 'unproven', 'minimap', 'steps']);
const hashState = s => crc32(new TextEncoder().encode(JSON.stringify(s, (k, v) => (SKIP.has(k) ? undefined : ArrayBuffer.isView(v) ? `#${v.length}` : typeof v === 'function' ? undefined : v instanceof Set ? undefined : v))));
const lehmer = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // @math a repeatable stand-in for the browser's random source
const keepRandom = Math.random;
const guarded = fn => { const r = Math.random; Math.random = () => { throw new Error('the enhanced presentation used Math.random'); }; try { return fn(); } finally { Math.random = r; } };
const SWITCHES = [PRESETS.enhanced, { ...PRESETS.enhanced, scale: 2 }, { ...PRESETS.original, smooth: true }, { ...PRESETS.original, smooth: true, scale: 2 }, PRESETS.original, { ...PRESETS.enhanced, view: 'wide' }, { ...PRESETS.enhanced, sizes: 'smooth' }, { ...PRESETS.original, shadows: true, fog: true }, { ...PRESETS.enhanced, particleAmount: 0.3, fogStrength: 0.4, scale: 2 }, { ...PRESETS.enhanced, scale: 2, sizes: 'smooth' }, { ...PRESETS.original, sizes: 'smooth' }, { ...PRESETS.enhanced, scale: 2, view: 'wide' }, { ...PRESETS.enhanced, art: true }, { ...PRESETS.enhanced, art: true, angles: 'free' }]; // Stage 4: 2x, the wide view, the smooth sprite sizes (1x, 2x, and alone with Original's switches), a tinted artwork pack and its N = 32 kart angle sets in free mode among them, switched to and from mid-run
// A settings change every `EVERY` ticks, so that a run of `frames` ticks applies every entry, Original's reference renderer back to the enhanced
// path (its reset) among them; a run that goes past the last change and misses one fails.
const EVERY = Math.max(Math.floor(frames / (SWITCHES.length + 1)), 1);

function runScenario(make, regime) {
  Math.random = lehmer(777);
  const sc = make(), s = sc.state, hashes = [], enh = regime === 'enhanced' ? createEnhancer({ storage: memory(), art: tinted() }) : null, pick = createRandom(31), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
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
    // The garage's View 'Wide, HUD at the edges' (M9): the preview places its HUD at the picture's edges on the playtest page's default shape.
    preview.seek(500, { ...PRESETS.enhanced, view: 'wide', hudPlace: 'edges' }); // @math the same moment
    const w = preview.draw({ alpha: 0.5, hud: true, detail: 1, aspect: ASPECT }, original, enhanced), placed = preview.enhancer.inspect(); // @math half way to the next pass
    if (w.w !== WIDTH + 2 * WIDE_MARGIN[ASPECT] || placed.hud?.place !== 'edges' || placed.guards.tear || placed.guards.collision || !placed.hud.layers[0].mask.some(Boolean)) throw new Error(`the wide view with the HUD at the edges drew ${w.w} wide, ${placed.hud?.place}${placed.hud?.guard ? ` (the ${placed.hud.guard} guard)` : ''}`); // @math a margin either side
    console.log(`ok   preview of track ${track}: ${preview.driver}, lap ${preview.race.laps.lap} at pass 500, ${s.particles} particles, ${s.marks} skid mark segments; ${w.w} x ${w.h} with the HUD at the edges`);
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

// ---- 5. the region registry of the artwork packs: every picture the scenarios draw is a region of it, and the archive's template validates
if (want('5')) {
  const fifth = performance.now(), registry = worldRegions(members, packWorld), drawnRegions = new Set(), outside = new Map();
  let blits = 0, pictures = 0;
  const record = (bytes, w, h) => { blits++; const key = `${bytes.byteOffset}:${w}x${h}`; if (bytes.buffer === dat.buffer && registry.hasAt(bytes.byteOffset, w, h)) drawnRegions.add(key); else if (!outside.has(key)) { const m = [...members].find(([, d]) => d.buffer === bytes.buffer && bytes.byteOffset >= d.byteOffset && bytes.byteOffset < d.byteOffset + d.length); outside.set(key, m ? `${m[0]} at ${bytes.byteOffset - m[1].byteOffset}, ${w} x ${h}` : `bytes of another buffer, ${w} x ${h}`); } };
  for (const view of ['standard', 'wide']) for (const make of SCENARIOS) { // the wide view's margins draw the things the standard view culls
    const sc = make(), s = sc.state, enh = createEnhancer({ storage: memory(), blits: record }), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
    enh.configure({ ...PRESETS.original, smooth: true, view }); // smooth motion only: the same records as any preset draws, at a fraction of the time
    for (let t = 0; t < frames; t++) { const input = sc.input(); if (input === null) break; stepRace(s, input); enh.afterTick(s); drawEnhanced(enh, sc, 1, index, out); pictures++; }
  }
  if (outside.size) fail(`regions: ${outside.size} pictures drawn outside the registry: ${[...outside.values()].slice(0, 8).join('; ')}`); // @math the first few
  else if (!blits || !drawnRegions.size) fail(`regions: no picture was recorded (${blits} blits, ${drawnRegions.size} of the registry's pictures): nothing was checked`);
  else console.log(`ok   regions: ${blits} pictures blitted in ${pictures} draws of ${SCENARIOS.length} scenarios (standard and wide), ${drawnRegions.size} of the registry's ${registry.size} pictures among them, none outside it (${((performance.now() - fifth) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  for (const color of ['rgba', 'indexed']) {
    const t = buildTemplate(members, packWorld, { scale: 1, color, archive: dat }), refused = [];
    t.manifest.entries.forEach((e, i) => { const r = normalizeArtEntry(e, packCtx, t.images[i]); if (!r.entry) refused.push(r.reason); });
    if (refused.length) fail(`regions: the ${color} template refuses ${refused.length} of its ${t.manifest.entries.length} entries: ${refused.slice(0, 4).join('; ')}`); // @math the first few
    else console.log(`ok   regions: the ${color} template of the archive (${t.manifest.entries.length} entries, ${t.images.reduce((n, im) => n + im.width * im.height, 0)} pixels) validates with no entry refused`);
  }
}

// ---- 6. Stage 4's general paths forced at the reference geometry: the same frame as the dispatched functions, configurations A to D of
// check:identity, every scenario with the slides demo, the link race's second seat, a race at detail level 3 and the split screen with a viewer
// upside down now and then (set on the state for both draws and put back before the next tick). The two enhancers draw the same
// state at the same blends; the overhead map is kept from the dispatched draw only after both have drawn, so each captures it from its own world.
if (want('6') || want('6b') || want('7') || want('8') || want('9') || want('10') || want('11') || want('12')) {
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

  // ---- 10. the smooth sprite sizes (SPRITE SIZES SMOOTH through the settings, M7) at the tick against the stepped sizes (the classes): two
  // traced enhancers, Enhanced with the default atmosphere, one with each size law, drawing the same state at alpha 1 at 1x, 2x and 1x wide
  // (the display's default shape: the margin records too), in every scenario (the split screen's trace is its last viewer's), the slides demo
  // and the link race's second seat. The records are matched by what they show (wide.js recordKey); every smooth record's ground anchor (the
  // anchor column of its picture's bottom edge) must lie within one reference column and one reference row (s output pixels) of its classes
  // place, at every distance (the standing row is the floor's own row, within a row of the table's below 800, and the table's last row 131
  // from about 878 on). The two enhancers keep the same particles and skid marks (the same ticks, the same seed): every particle disc of the
  // smooth sizes is the classes' moved down by s times the standing row less the row table's row of its distance, and the skid mark quads
  // are the classes' columns on rows of their own. Then a far object swept from 700 to 1122 units: its smooth bottom row goes down steadily
  // (the floor's rows, rowOfDepth, at quarter units strictly decreasing with no step of a hundredth of a row; drawn, never up and never more
  // than an output row between neighbouring units) while the classes stand it on row 131, it never stands above that row (where the floor
  // draws no ground and the composite would show no contact shadow under it), and its contact shadow darkens the floor's rows at every
  // distance of the plateau.
  const tenth = performance.now(), ten = { scenarios: 0, pictures: 0, records: 0, smooth: 0, far: 0, worstX: 0, worstY: 0, worstFar: 0, splats: 0, splatsMoved: 0, marks: 0, marksMoved: 0 };
  let tenWrong = 0;
  if (want('10')) {
    const reports = raceTracks.map(t => { const w = loadTrack(dat, String(t)); let worst = 0; for (let d = 80; d < 800; d++) worst = Math.max(worst, Math.abs(rowOfDepth(w, d) - w.rows[d])); return { t, ok: rowReport(w).ok, worst }; }); // @math the distances of the game's records below the plateau
    const refused = reports.filter(r => !r.ok);
    if (refused.length) fail(`the floor gives no rows of its own on track ${refused.map(r => r.t).join(', ')} (its centre-column depths do not increase): the smooth sizes stand them on the row table there`);
    console.log(`     the floor's own rows (rowOfDepth) on ${reports.length - refused.length} of ${reports.length} tracks, within ${Math.max(...reports.map(r => r.worst)).toFixed(3)} rows of the row table at the whole distances 80 to 799`);
    for (const [scale, view] of [[1, 'standard'], [2, 'standard'], [1, 'wide']]) for (const make of [...SCENARIOS, slides, linkSecond]) { // @math the scales and views of the check
      const sc = make(), st = sc.state, cfg = { ...PRESETS.enhanced, scale, view }, E = { classes: createEnhancer({ storage: memory(), trace: true }), smooth: createEnhancer({ storage: memory(), trace: true }) };
      E.classes.configure(cfg); E.smooth.configure({ ...cfg, sizes: 'smooth' });
      const index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
      const drawn = e => {
        const palette = rgbaPalette(st.world.palette);
        const P = sc.split ? e.drawSplit(st, 1, { index, out, palette, mode: st.menu.settings.detail.split, overlays: versusOverlays, worldReady: true })
          : e.drawSingle(st, 1, { index, out, palette, mode: st.detail, sky: sceneSky(st), seat: sc.seat ?? 0, worldReady: true, aspect: ASPECT, wideAllowed: !sc.link && !sceneSky(st), overlays: (p, fb) => drawRaceOverlays(p, fb) });
        if (!st.minimap && P.minimap) st.minimap = P.minimap;
        return sizeWrong(e, sc);
      };
      let found = null;
      for (let t = 0; t < ticks && !found; t++) {
        const input = sc.input(); if (input === null) break;
        stepRace(st, input); E.classes.afterTick(st); E.smooth.afterTick(st);
        if (t % 7 !== 3) continue; // @math a sample now and then
        for (const k of ['classes', 'smooth']) { const bad = drawn(E[k]); if (bad) found ??= `tick ${t}, ${k}: ${bad}`; }
        const a = E.classes.inspect().trace.records, b = E.smooth.inspect().trace.records, byKey = new Map(a.map(r => [r.key, r]));
        if (a.length !== b.length || b.some(r => !byKey.has(r.key))) found ??= `tick ${t}: the smooth sizes drew ${b.length} records (${b.map(r => r.key).join(' ')}), the classes ${a.length} (${a.map(r => r.key).join(' ')})`;
        for (const r of b) {
          const c = byKey.get(r.key);
          if (!c || found) continue;
          ten.records++;
          if (!r.smooth) { if (r.key !== null) found = `tick ${t}: ${r.key} was not drawn in smooth sizes`; continue; } // only the own car keeps its class
          ten.smooth++;
          const dx = Math.abs(r.anchor.x - c.anchor.x) / scale, dy = Math.abs(r.anchor.y - c.anchor.y) / scale;
          if (c.distance >= 800) { ten.far++; ten.worstFar = Math.max(ten.worstFar, dx, dy); } else { ten.worstX = Math.max(ten.worstX, dx); ten.worstY = Math.max(ten.worstY, dy); } // @math the row table's plateau begins here
          if (dx > 1 || dy > 1) found = `tick ${t}: ${r.key} at the distance ${c.distance} stands at ${r.anchor.x},${r.anchor.y} in smooth sizes, ${c.anchor.x},${c.anchor.y} in the classes (${scale}x ${view})`;
        }
        if (!sc.split) { // the particles (the split screen keeps no discs in its trace)
          const pa = E.classes.inspect().splats, pb = E.smooth.inspect().splats, w = st.world;
          if (pa.length !== pb.length) found ??= `tick ${t}: ${pb.length} particles in smooth sizes, ${pa.length} in the classes`;
          else for (let i = 0; i < pa.length && !found; i++) {
            const a = pa[i], b = pb[i], dy = scale * (standingRow(w, a.depth) - rowAt(w.rows, a.depth));
            ten.splats++; if (b.y !== a.y) ten.splatsMoved++;
            if (b.x !== a.x || b.r !== a.r || b.depth !== a.depth || Math.abs(b.y - a.y - dy) > 1e-6) found = `tick ${t}: the particle at the distance ${a.depth.toFixed(2)} is at ${b.x.toFixed(2)},${b.y.toFixed(3)} in smooth sizes, ${a.x.toFixed(2)},${a.y.toFixed(3)} in the classes, where the standing row is ${(dy / scale).toFixed(3)} rows from the table's (${scale}x ${view})`; // @math the tolerance
          }
        }
        const ma = E.classes.inspect().trace.marks, mb = E.smooth.inspect().trace.marks; // the skid marks: the same quads, in the same columns
        if (ma.length !== mb.length || mb.some((q, i) => q.x0 !== ma[i].x0 || q.x1 !== ma[i].x1)) found ??= `tick ${t}: ${mb.length} skid mark quads in smooth sizes, ${ma.length} in the classes, or in other columns (${scale}x ${view})`;
        else { ten.marks += mb.length; ten.marksMoved += mb.filter((q, i) => q.y0 !== ma[i].y0 || q.y1 !== ma[i].y1).length; }
        ten.pictures++;
      }
      ten.scenarios++;
      if (found) { tenWrong++; fail(`smooth sizes at ${scale}x ${view}, ${sc.name}: ${found}`); }
    }
    // A far object ahead of a camera on track 1, swept away from it along two rays, straight ahead and 140 TRIG entries to the side (near the
    // fan's edge): the game's record (its distance, size class and row table row: view.js projectPoint), placed in smooth sizes at the tick
    // (scene.js placeSmooth) at 1x and 2x. The camera faces an eighth of a turn, along the diagonal of the game's box (view.js viewSetup: the
    // box of the camera and the fan's two far corners), so straight ahead the game draws the object out to its farthest distance, 1122. Its
    // contact shadow, in smooth sizes and in the classes (shadows.js casterOf on the drawn box, stampShadow), summed over the floor's rows
    // (from its top row, its last sample's: the composite darkens the floor's pixels alone).
    const w = loadTrack(dat, '1'), cam = { x: 2048, y: 2048, heading: 240 }, fan = viewSetup(w, cam), W0 = w.carShape[0].w, H0 = w.carShape[0].h; // @math the middle of the map; an eighth of the turn of 1920
    const FL = models().floor, lastRow = w.rows[w.rows.length - 1], floorTop = FL.bottomRow - (FL.steps - 1), P0 = { car: {}, fx: {}, ai: { racers: [] } }, shadowsOn = { shadows: true };
    const fine = { worst: 0, down: true }, sweep = [];
    let sweepWrong = null, shadeRatio = Infinity;
    for (let d = 700; d < 1122; d += 0.25) { const a = rowOfDepth(w, d), b = rowOfDepth(w, d + 0.25); fine.worst = Math.max(fine.worst, a - b); if (!(b < a)) fine.down = false; } // @math the sweep's distances in quarter units
    if (!fine.down || fine.worst >= 0.01) sweepWrong = `the floor's rows from 700 to 1122: ${fine.down ? '' : 'not strictly decreasing, '}a step of ${fine.worst.toFixed(4)} rows a quarter unit`; // @math a hundredth of a row
    for (const s of [1, 2]) for (const ray of [0, 140]) { // @math the scales; straight ahead and near the fan's edge
      const G = geometryOf({ s, m: 0 }), seen = [], [vx, vy] = headingVector(w, cam.heading + ray), L = { shade: new Float32Array(G.W * G.H) };
      const onFloor = c => { // the shade a contact shadow lays on the floor's rows (then cleared)
        if (!c) return 0;
        const b = shadowBox(c, s);
        let sum = 0;
        stampShadow(L, c, G.W, G.H, s);
        for (let y = Math.max(b.y0, 0); y <= Math.min(b.y1, G.H - 1); y++) for (let x = Math.max(b.x0, 0); x <= Math.min(b.x1, G.W - 1); x++) { const o = y * G.W + x; if (y >= s * floorTop) sum += L.shade[o]; L.shade[o] = 0; }
        return sum;
      };
      for (let D = 690; D <= 1300; D++) { // @math a little either side of the far distances
        const hit = projectPoint(w, fan, cam, Math.round(cam.x + vx * D), Math.round(cam.y + vy * D), w.rows);
        if (!hit || hit.distance < 700) continue; // @math from the far end of the class 8 on
        const picture = w.carShape[hit.sizeClass], rec = { ...clipPicture(hit, picture), picture, frame: w.carFrames.cars.subarray(0, W0 * H0), distance: hit.distance, sizeClass: hit.sizeClass, type: 1, racer: 1, object: -1 }, p = placeSmooth(rec, w, cam, cam, null, G);
        const shade = onFloor(casterOf(p, P0, null, 0, shadowsOn, { x: p.place.x, y: p.place.y, u: s, m: 0, box: { w: p.smooth.w, h: p.smooth.h, ax: p.smooth.w >> 1 } })), classesShade = onFloor(casterOf(rec, P0, null, 0, shadowsOn, { x: s * (rec.left - rec.firstColumn), y: s * rec.top, u: s, m: 0 })); // the own car's ground row (unused)
        seen.push({ d: hit.distance, smooth: p.place.y + p.smooth.h, classes: s * (rec.top + picture.h), shade, classesShade });
      }
      seen.sort((a, b) => a.d - b.d);
      const plateau = seen.filter(e => e.d >= 800), rows = new Set(plateau.map(e => e.smooth)), stuck = new Set(plateau.map(e => e.classes)); // @math the row table's plateau
      const jump = seen.findIndex((e, i) => i > 0 && (e.smooth > seen[i - 1].smooth || seen[i - 1].smooth - e.smooth > 1));
      if (jump > 0) sweepWrong ??= `${s}x, ${ray} entries off the heading: the bottom row jumps between the distances ${seen[jump - 1].d} and ${seen[jump].d} (output rows ${seen[jump - 1].smooth} and ${seen[jump].smooth})`;
      else if (!plateau.length || rows.size < 2 || stuck.size !== 1) sweepWrong ??= `${s}x, ${ray} entries off the heading: ${rows.size} smooth rows and ${stuck.size} classes rows over the ${plateau.length} distances of the plateau`; // @math the smooth rows must move, the classes' must not
      else if (seen.some(e => e.smooth < s * lastRow)) { const e = seen.find(x => x.smooth < s * lastRow); sweepWrong ??= `${s}x, ${ray} entries off the heading: at the distance ${e.d} the bottom stands on output row ${e.smooth}, above the row table's last row ${s * lastRow}, where the floor draws no ground`; }
      else if (plateau.some(e => !(e.shade > 0))) { const e = plateau.find(x => !(x.shade > 0)); sweepWrong ??= `${s}x, ${ray} entries off the heading: at the distance ${e.d} (bottom on output row ${e.smooth}) its contact shadow lays nothing on the floor's rows (the classes' ${e.classesShade.toFixed(2)})`; }
      else {
        const settle = plateau.find(e => e.smooth === s * lastRow);
        for (const e of plateau) if (e.classesShade > 0) shadeRatio = Math.min(shadeRatio, e.shade / e.classesShade);
        sweep.push(`${s}x ${ray ? `${ray} entries to the side` : 'straight ahead'} from output row ${plateau[0].smooth} at ${plateau[0].d} to ${plateau[plateau.length - 1].smooth} at ${plateau[plateau.length - 1].d}${settle ? `, on it from ${settle.d}` : ''} (the classes ${[...stuck][0]} throughout)`);
      }
    }
    if (sweepWrong) fail(`a far object across the row table's plateau: ${sweepWrong}`);
    if (!ten.smooth) fail('smooth sizes: no record was drawn in smooth sizes');
    else if (ten.splats && !ten.splatsMoved) fail(`smooth sizes: none of ${ten.splats} particle discs stands off the classes' rows (the standing rows never reached the particles)`);
    else if (ten.marks && !ten.marksMoved) fail(`smooth sizes: none of ${ten.marks} skid mark quads stands on other rows than the classes' (the standing rows never reached the skid marks)`);
    else if (!tenWrong && !sweepWrong) console.log(`ok   smooth sprite sizes at the tick against the classes at 1x, 2x and 1x wide: ${ten.scenarios} scenario runs, ${ten.pictures} pictures, ${ten.records} records (${ten.smooth} in smooth sizes); below the distance 800 every ground anchor within ${ten.worstX.toFixed(2)} reference columns and ${ten.worstY.toFixed(2)} rows of its classes place, the ${ten.far} records from 800 on within ${ten.worstFar.toFixed(2)}; ${ten.splats} particle discs on the standing rows (${ten.splatsMoved} of them off the classes' rows), ${ten.marks} skid mark quads in the classes' columns (${ten.marksMoved} on other rows); a far object: ${sweep.join(', ')}, never up, at most an output row between neighbouring distances, never above the row table's last row and its contact shadow on the floor at every distance from 800 on (at least ${(100 * shadeRatio).toFixed(0)} per cent of the classes'); the floor's rows strictly decreasing at quarter units, at most ${fine.worst.toFixed(4)} rows a step (${((performance.now() - tenth) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  }

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

  // ---- 12. the HUD at the edges of the wide view (VIEW WIDE EDGES, M9: src/enhance/hud-place.js), at 1x and 2x on both display shapes (53 and
  // 18 columns a side), over the attract demos (DEMO MODE and the logo), the races and the duck game, with the finish labels, the reaction figure and
  // a held item, the message, the crack, the WRONG WAY sign with the lap text and the in-race menu set on the drawn state now and then (put back
  // before the next tick).
  // Each sample draws the same state at the same blend with the HUD centred, at the edges with the HUD layer, and at the edges in the picture
  // (smooth motion only; the page's base and forced parts, hud-place.js raceBase and raceForced with the menu), and checks:
  //  - the check's own element-by-element draw of the frame's overlays (drawRaceOverlays' order and values, the page's menu last) is the frame's
  //    overlays, so the elements below are the frame's own;
  //  - the HUD layer is exactly the overlays without the forced ones, each element's pixels moved by its group's shift (the plan's groups, written
  //    out here rather than read from hud-place.js), no two on one place, with the forced overlays (the menu, the message, the crack) moved by m over
  //    them: shifting every pixel back by its shift gives the overlays' two parts;
  //  - the picture's world is the HUD-layer frame's world with that HUD stamped as s x s blocks; the canvas, the index and the world under the HUD
  //    layer are the centred frame's (the reference view does not move);
  //  - drawOver (the menu of a lost race) over a kept edges frame puts its overlay centred over the kept HUD, in the layer and in the picture;
  //  - no guard centred a frame (no tear, no collision), every frame was drawn at the edges, and every element was seen at its place.
  if (want('12')) {
    const twelfth = performance.now(), hc = { runs: 0, samples: 0, base: 0, forced: 0, stamped: 0, over: 0, narrow: 0, seen: {} }, SENT = SENTINEL;
    let twelveWrong = 0;
    const SHAPE_WORDS = { dos: '4 BY 3', wide: '16 BY 10' }; // the display's shapes, as its menu names them
    const EDGE_SHIFT = { minimap: 0, banner: 0, place: 0, name: 0, speedometer: 0, lapText: 0, demoLogo: 0, duckBanner: 0, timer: 2, held: 2, figure: 2, demoText: 2, labels: 2, wrongWay: 1, message: 'forced', crack: 'forced', menu: 'forced' }; // @math the plan's groups: the margins each moves right (left 0, centre 1, right 2), the forced ones by one, drawn over
    const HELD_KIND = 3; // @math the first held item's kind (pickups.js: 3 to 7)
    const menuArt = loadMenuArt(members), groups = hudGroups({ art: hudArt, mov, world: packWorld });
    const figureDraws = []; for (let d = 1; d <= 7; d++) for (let f = startFigure(d); f;) { const call = stepFigure(f, mov.count); if (call.draw.picture !== null) figureDraws.push({ draw: call.draw, entry: mov.entries[call.draw.entry] }); f = call.fig; } // @math the figure's drivers 1 to 7: every picture at every entry the game's sequence draws
    const sentinel = () => new Uint16Array(SIZE).fill(SENT);
    // The frame's overlays element by element (render/race-frame.js drawRaceOverlays with its values, in its order; the page's in-race menu last).
    const elementsOf = (s, pause) => {
      const out = [], add = (name, d) => out.push({ name, draw: d }), gates = hudGates(s.menu.settings), art = s.hudArt, name = driverName(s.humanSlot ?? PLAYER_SLOT);
      if (minimapAllowed({ duck: s.duck, demo: s.demo, slides: demoModel().modes.slides }) && minimapOn(s.menu.settings) && s.minimap?.picture) add('minimap', fb => drawMinimap(fb, s.minimap, minimapDots([{ x: s.car.px, y: s.car.py }, ...(s.minimapOthers ?? (s.ai ? s.ai.racers.slice(1) : []))], s.world.mapxy)));
      const common = () => { add('banner', fb => drawBanner(fb, art, counterDigits(s.hud.counter))); add('name', fb => drawName(fb, art, name)); if (s.place) add('place', fb => drawPlace(fb, art, s.place)); };
      if (s.duck) { add('duckBanner', fb => drawDuckBanner(fb, art, counterDigits(s.hud.counter), counterDigits(s.duck.score))); add('name', fb => drawName(fb, art, name)); if (s.car.held) add('held', fb => drawHeld(fb, art, s.car.held)); add('timer', fb => drawTimer(fb, art, timerText(Math.max(duckRules().timer - s.hud.ticks, 0)))); }
      else if (!s.demo) {
        const text = s.laps.shown && !s.figure && !s.finished ? lapText(s.laps.lap, s.total, false) : null, wrong = s.laps.wrongShown ?? null;
        common();
        if (gates.speedometer) add('speedometer', fb => drawSpeedometer(fb, art, speedDigits(s.hud.shown)));
        if (s.car.held) add('held', fb => drawHeld(fb, art, s.car.held));
        if (gates.timer && !s.finished) add('timer', fb => drawTimer(fb, art, timerText(s.hud.timerShown)));
        if (wrong !== null) add('wrongWay', fb => drawWrongWay(fb, art, wrong));
        if (s.figureDraw) add('figure', fb => drawFigure(fb, art, s.figureDraw.draw, s.figureDraw.entry));
        if (text) add('lapText', fb => drawLapText(fb, art, text));
      } else {
        if (s.demo.mode === demoModel().modes.attract) { common(); if (s.car.held) add('held', fb => drawHeld(fb, art, s.car.held)); if (gates.timer && !s.finished) add('timer', fb => drawTimer(fb, art, timerText(s.hud.timerShown))); add('demoText', fb => drawDemoText(fb, art.ofont)); }
        add('demoLogo', fb => drawDemoLogo(fb, art.ofont));
      }
      if (s.labels?.length) add('labels', fb => drawLabels(fb, art.ofont, s.world, s.labels));
      if (s.message) add('message', fb => drawMessage(fb, art.ofont, s.message));
      if (s.fx?.cracked) add('crack', fb => drawCrack(fb, s.world));
      if (pause) add('menu', fb => renderMenuOverlay(fb, menuArt, pauseView(pause)));
      return out;
    };
    const bytesEqual = (a, b) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength));
    for (const [aspect, margin] of Object.entries(WIDE_MARGIN)) for (const scale of [1, 2]) for (const make of SCENARIOS) { // @math the two scales
      const sc = make(), st = sc.state;
      if (sc.split) continue; // the split screen is never wide
      Math.random = lehmer(1212 + hc.runs); // @math a repeatable stand-in for the browser's random source, one seed a run
      const pick = createRandom(1313 + hc.runs), cfg = { ...PRESETS.original, smooth: true, view: 'wide', scale }; // @math the checks' seed
      const E = { centred: createEnhancer({ storage: memory() }), edges: createEnhancer({ storage: memory() }), picture: createEnhancer({ storage: memory() }) };
      E.centred.configure({ ...cfg, hudPlace: 'centred' }); E.edges.configure({ ...cfg, hudPlace: 'edges' }); E.picture.configure({ ...cfg, hudPlace: 'edges' });
      const buf = Object.fromEntries(Object.keys(E).map(k => [k, { index: new Uint8Array(SIZE), out: new Uint8ClampedArray(SIZE * 4), layers: k === 'picture' ? null : { world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) } }])); // @math four bytes a colour
      const m = !sceneSky(st) && wideReport(st.world).ok ? margin : 0, G = geometryOf({ s: scale, m }), refW = WIDTH + 2 * m; // @math a margin either side
      let found = null, k = 0, pause = null;
      for (let t = 0; t < ticks && !found; t++) {
        const input = sc.input(); if (input === null) break;
        stepRace(st, input); for (const e of Object.values(E)) e.afterTick(st);
        if (t % 7 !== 3) continue; // @math a sample now and then
        k++;
        // The overlays set on the drawn state for this sample (put back below): in turn the labels with the figure and a held item, the message,
        // the crack, the WRONG WAY sign with the lap text, the in-race menu, and every eighth sample all of them at once.
        const kept = { labels: st.labels, message: st.message, fx: st.fx, laps: st.laps, figureDraw: st.figureDraw, car: st.car }, turn = k % 6, all = k % 8 === 0; // @math six turns; every eighth sample all at once
        if (turn === 1 || all) { st.labels = [1, 2, 3].map(place => ({ racer: place, place, slot: (k + place) % 8 })); st.figureDraw = figureDraws[k % figureDraws.length]; st.car = { ...st.car, held: HELD_KIND + (k % 5) }; } // @math the three places; eight slots; the five held kinds
        if (turn === 2 || all) st.message = messageOf(1 + (k % 3), 1 + (k % 3), 1 + (k % 5)); // @math the classes, places and races of the messages
        if ((turn === 3 || all) && st.fx) st.fx = { ...st.fx, cracked: true };
        if ((turn === 4 || all) && st.laps) st.laps = { ...st.laps, wrongShown: k % 2, shown: true, lap: k % (st.total + 1) }; // @math the sign's two pictures; the lap text of every lap to the last (the scripted races cross no line in these ticks)
        pause = turn === 5 || all ? createPause(Boolean(st.duck)) : null;
        const palette = rgbaPalette(st.world.palette), alpha = k % 2 ? 1 : pick(); // @math every other sample at the tick
        const overlays = (p, fb) => { drawRaceOverlays(p, fb); if (pause) renderMenuOverlay(fb, menuArt, pauseView(pause)); };
        const edges = { groups, base: raceBase, forced: (p, fb) => { raceForced(p, fb); if (pause) renderMenuOverlay(fb, menuArt, pauseView(pause)); } };
        const drawn = {};
        for (const [key, e] of Object.entries(E)) { const b = buf[key]; drawn[key] = e.drawSingle(st, alpha, { index: b.index, out: b.out, palette, mode: st.detail, sky: sceneSky(st), overlays, layers: b.layers, worldReady: true, aspect, wideAllowed: true, edges: key === 'centred' ? null : edges }); if (!st.minimap && drawn[key].minimap) st.minimap = drawn[key].minimap; }
        Object.assign(st, kept);
        hc.samples++;
        const L = { centred: E.centred.layers(), edges: E.edges.layers(), picture: E.picture.layers() };
        if (L.edges.world.w !== scale * refW || L.edges.hud?.w !== refW || L.picture.world.w !== scale * refW) { found = `tick ${t}: drew ${L.edges.world.w} (HUD ${L.edges.hud?.w}) and ${L.picture.world.w} wide, not ${scale * refW} (${refW})`; break; }
        if (!m) { hc.narrow++; continue; }
        const I = E.edges.inspect(), Ip = E.picture.inspect();
        if (I.hud?.place !== 'edges' || Ip.hud?.place !== 'edges') { found = `tick ${t}: drawn ${I.hud?.place} and ${Ip.hud?.place}${I.hud?.guard ? ` (the ${I.hud.guard} guard)` : ''}, not at the edges`; break; }
        // The check's elements are the frame's overlays.
        const P = drawn.edges, el = elementsOf(P, pause), whole = sentinel(), frame = sentinel();
        for (const e of el) e.draw(whole);
        overlays(P, frame);
        if (!bytesEqual(whole, frame)) { found = `tick ${t}: the check's elements (${el.map(e => e.name).join(', ')}) are not the frame's overlays`; break; }
        // The two parts, their owners and the pixels that only put back the track's sky (index.js overlaid).
        const baseS = sentinel(), forcedS = sentinel(), owner = new Int16Array(SIZE).fill(-1), part = sentinel();
        el.forEach((e, n) => { const forced = EDGE_SHIFT[e.name] === 'forced'; e.draw(forced ? forcedS : baseS); if (forced) return; part.fill(SENT); e.draw(part); for (let i = 0; i < SIZE; i++) if (part[i] !== SENT) owner[i] = n; });
        const trackSky = !sceneSky(st), under = i => I.fb[G.sample[i]], through = (v, i) => trackSky && I.kind[i] === KIND.sky && v === under(i);
        // The expected HUD layer: the base by the elements' shifts, then the forced overlays moved by m over it.
        const want = new Uint8ClampedArray(refW * (SIZE / WIDTH) * 4), taken = new Uint8Array(refW * (SIZE / WIDTH)); // @math four bytes a colour
        const paint = (h, v) => { want[h * 4] = palette[v * 4]; want[h * 4 + 1] = palette[v * 4 + 1]; want[h * 4 + 2] = palette[v * 4 + 2]; want[h * 4 + 3] = 0xff; }; // @math four bytes a colour; opaque
        for (let i = 0; i < SIZE && !found; i++) {
          const v = baseS[i]; if (v === SENT || through(v, i)) continue;
          const name = el[owner[i]].name, x = i % WIDTH, y = Math.floor(i / WIDTH), h = y * refW + x + EDGE_SHIFT[name] * m;
          if (taken[h]) { found = `tick ${t}: two pixels at ${h % refW},${y} (${name}'s from ${x})`; break; }
          taken[h] = 1; paint(h, v); hc.base++; hc.seen[name] = (hc.seen[name] ?? 0) + 1;
        }
        for (let i = 0; i < SIZE; i++) { const v = forcedS[i]; if (v === SENT || through(v, i)) continue; const x = i % WIDTH, y = Math.floor(i / WIDTH); paint(y * refW + x + m, v); hc.forced++; }
        for (const e of el) if (EDGE_SHIFT[e.name] === 'forced') hc.seen[e.name] = (hc.seen[e.name] ?? 0) + 1;
        if (found) break;
        const hud = L.edges.hud.data;
        for (let h = 0; h < taken.length; h++) if ([0, 1, 2, 3].some(c => hud[h * 4 + c] !== want[h * 4 + c])) { const x = h % refW, y = Math.floor(h / refW); found = `tick ${t}: the HUD layer at ${x},${y} is ${[...hud.subarray(h * 4, h * 4 + 4)]}, the elements moved by their groups give ${[...want.subarray(h * 4, h * 4 + 4)]}`; break; } // @math four bytes a colour
        if (found) break;
        // The canvas, the index and the world under the HUD layer are the centred frame's; the picture's world is that world with the HUD stamped.
        if (!bytesEqual(buf.edges.out, buf.centred.out) || !bytesEqual(buf.edges.index, buf.centred.index) || !bytesEqual(L.edges.world.data, L.centred.world.data)) { found = `tick ${t}: the canvas, the index or the world moved with the HUD`; break; }
        if (!bytesEqual(buf.picture.out, buf.centred.out)) { found = `tick ${t}: the canvas of the HUD in the picture is not the centred frame's`; break; }
        const stamped = Uint8ClampedArray.from(L.edges.world.data), W = L.edges.world.w, w32 = new Uint32Array(stamped.buffer), h32 = new Uint32Array(want.buffer);
        for (let h = 0; h < h32.length; h++) { if (!h32[h]) continue; const x = h % refW, y = Math.floor(h / refW); for (let q = 0; q < scale; q++) for (let r = 0; r < scale; r++) w32[(scale * y + q) * W + scale * x + r] = h32[h]; hc.stamped++; }
        if (!bytesEqual(stamped, L.picture.world.data)) { found = `tick ${t}: the picture's world is not the world with the HUD stamped at the edges' places`; break; }
        // drawOver (the menu of a lost race) over the kept edges frames: its overlay centred over the kept HUD, in the layer and in the picture.
        if (k % 5 === 4) for (const key of ['edges', 'picture']) { // @math one sample in five
          const e = E[key], b = buf[key], keptLayers = e.keepLayers(), retry = createPause(), over = fb => renderMenuOverlay(fb, menuArt, pauseView(retry)), index = Uint8Array.from(b.index), menu = sentinel();
          over(index); over(menu);
          const r = e.drawOver({ out: new Uint8ClampedArray(SIZE * 4), base: b.out, index, palette, overlay: over, kept: keptLayers, hudLayer: key === 'edges' }); // @math four bytes a colour
          const expect = key === 'edges' ? Uint8ClampedArray.from(keptLayers.hud.data) : Uint8ClampedArray.from(keptLayers.world.data), e32 = new Uint32Array(expect.buffer);
          for (let i = 0; i < SIZE; i++) {
            if (menu[i] === SENT) continue;
            const x = i % WIDTH, y = Math.floor(i / WIDTH), v = index[i], c = new Uint32Array(Uint8ClampedArray.from([palette[v * 4], palette[v * 4 + 1], palette[v * 4 + 2], 0xff]).buffer)[0]; // @math four bytes a colour; opaque
            if (key === 'edges') e32[y * refW + x + m] = c; else for (let q = 0; q < scale; q++) for (let s2 = 0; s2 < scale; s2++) e32[(scale * y + q) * W + scale * (x + m) + s2] = c;
            hc.over++;
          }
          if (!bytesEqual(key === 'edges' ? r.hud.data : r.world.data, expect)) { found = `tick ${t}: drawOver over the kept edges frame (${key === 'edges' ? 'the HUD layer' : 'the picture'}) is not its menu centred over the kept HUD`; break; }
        }
      }
      for (const key of ['edges', 'picture']) { const g = E[key].inspect().guards; if (!found && (g.tear || g.collision)) found = `${key}: ${g.tear} tears, ${g.collision} collisions centred frames`; }
      hc.runs++;
      if (found) { twelveWrong++; fail(`the HUD at the edges at ${scale}x on ${SHAPE_WORDS[aspect]} (${margin} columns a side), ${sc.name}: ${found}`); }
    }
    Math.random = keepRandom;
    const unseen = Object.keys(EDGE_SHIFT).filter(n => !hc.seen[n]);
    if (unseen.length || !hc.base || !hc.forced || !hc.over) fail(`the HUD at the edges: ${unseen.length ? `never saw ${unseen.join(', ')}` : ''}${!hc.base ? ' no base pixel' : ''}${!hc.forced ? ' no forced pixel' : ''}${!hc.over ? ' no drawOver' : ''}: nothing was checked`);
    else if (!twelveWrong) console.log(`ok   the HUD at the edges of the wide view at 1x and 2x on ${Object.entries(WIDE_MARGIN).map(([a, mm]) => `${SHAPE_WORDS[a]} (${mm} columns a side)`).join(' and ')}, with the HUD layer and in the picture: ${hc.runs} scenario runs, ${hc.samples} samples (${hc.narrow} without a margin); ${hc.base} HUD pixels each at its element's group's place, no two on one place (${Object.entries(hc.seen).filter(([n]) => EDGE_SHIFT[n] !== 'forced').map(([n, c]) => `${n} ${c}`).join(', ')}), ${hc.forced} pixels of the forced overlays (${Object.entries(hc.seen).filter(([n]) => EDGE_SHIFT[n] === 'forced').map(([n, c]) => `${n} in ${c} frames`).join(', ')}) centred over them; the canvas, the index and the world the centred frame's; ${hc.stamped} HUD pixels stamped into the picture's world; ${hc.over} menu pixels of drawOver centred over kept edges frames; no frame centred by a guard (${((performance.now() - twelfth) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  }

  // ---- 7. the artwork packs in the race: identity packs (built at run time from the local archive) draw the no-pack picture byte for byte
  if (want('7')) {
    const seventh = performance.now(), dark = Object.fromEntries(raceTracks.map(t => [String(t), { grade: 'night', clouds: 0.9, range: 1, rangeShape: 'mountains', water: 1, relief: 1 }])); // @math check:identity's B: every track night, cloudy, mountainous, its water and relief full
    const PACKS = [['indexed', 1], ['rgba', 2]], got = { pictures: 0, runs: 0, beach: new Set(), fade: 0, split: 0, hd: 0, wide: 0, tiles: 0, sky: 0, strip: 0, frames: 0 }, offsets = new Set(); // @math indexed at p = 1, RGBA at p = 2
    const genef = members.get('GENEF.SP'), at = name => members.get(name)?.byteOffset ?? -1, lionAt = at('GENEF.SP') + 4449, explosions = [0, 1, 2, 3].map(k => at('GENEF.SP') + 7641 + k * 1064); // @math the lion's first frame and the explosions' four (the plan's offsets, written out: the registry is under test)
    const effectsMembers = ['EFFECTS.SP', 'SPARK.SP'].map(n => members.get(n)).filter(Boolean);
    let wrong7 = 0, nonAligned = 0, afterBlits = 0;
    // The cycled entries of the beach tracks in the pictures of the registry (an RGBA copy of such a pixel could not cycle): reported.
    const cycledInFrames = new Map(), leftOut = new Set();
    const draw7 = (enh, sc, alpha, index, out, palette, cap, layers) => {
      const s = sc.state;
      if (sc.split) return enh.drawSplit(s, alpha, { index, out, palette, cap, mode: s.menu.settings.detail.split, overlays: versusOverlays, layers, worldReady: true });
      return enh.drawSingle(s, alpha, { index, out, palette, cap, mode: s.detail, sky: sceneSky(s), seat: sc.seat ?? 0, layers, worldReady: true, aspect: ASPECT, wideAllowed: !sc.link && !sceneSky(s), overlays: (p, fb) => drawRaceOverlays(p, fb) });
    };
    const geometries7 = [{ scale: 1, view: 'standard' }, { scale: 2, view: 'standard' }, { scale: 1, view: 'wide' }, { scale: 2, view: 'wide' }];
    const plan7 = [...SCENARIOS.map((make, n) => ({ make, geometries: n < 2 || n === SCENARIOS.length - 4 ? geometries7 : n % 5 === 0 ? geometries7.slice(0, 3) : geometries7.slice(0, 1) })), { make: linkSecond, geometries: geometries7.slice(0, 2) }]; // @math every scenario at 1x; the first demos, the split screen and every fifth at 2x and wide too
    for (const { make, geometries } of plan7) for (const geo of geometries) for (const [color, p] of PACKS) {
      Math.random = lehmer(9090 + got.runs); // @math a repeatable stand-in for the browser's random source, one seed a run
      const sc = make(), s = sc.state, track = s.world.name, fade = sc.name.startsWith('demo'), pick = createRandom(707 + got.runs); // @math the checks' seed
      if (sc.split && geo.view === 'wide') continue; // the split screen is never wide
      // An RGBA picture cannot take the palette cycle: on a beach track the RGBA identity pack leaves out the groups of pictures that use the
      // cycle's entries (the water's dust and puffs of EFFECTS.SP), which only an indexed pack can copy (reported below).
      const cycled = s.world.beach && color === 'rgba' ? cycledEntries(members, s.world.gam) : null, usesCycle = e => { const d = members.get(e.member); for (let k = 0; k < e.count; k++) for (let i = 0; i < e.width * e.height; i++) if (cycled.has(d[e.offset + k * e.stride + i])) return true; return false; };
      const provider = createArtProvider(() => dat).set(packArts({ scale: p, color, track }, null, cycled ? e => { if (e.kind !== 'frames' || !usesCycle(e)) return true; leftOut.add(`${e.member} at ${e.offset}`); return false; } : null)), lookup = provider.frame;
      provider.frame = bytes => { const hit = lookup(bytes); if (hit) { offsets.add(bytes.byteOffset); const m = [...members.values()].find(d => d.buffer === bytes.buffer && bytes.byteOffset >= d.byteOffset && bytes.byteOffset < d.byteOffset + d.length); if (m && (bytes.byteOffset - m.byteOffset) % bytes.length !== 0) nonAligned++; if (effectsMembers.includes(m) || (m === genef && bytes.length !== 1064)) afterBlits++; } return hit; }; // @math a frame of 38 x 28
      const plain = createEnhancer({ storage: memory(dark) }), packed = createEnhancer({ storage: memory(dark), art: provider }), cfg = { ...PRESETS.enhanced, art: true, scale: geo.scale, view: geo.view };
      plain.configure(cfg); packed.configure(cfg);
      if (s.world.beach) got.beach.add(track);
      if (s.world.beach && color === 'rgba' && !cycledInFrames.has(track)) { const cycled = cycledEntries(members, s.world.gam), regs = worldRegions(members, packWorld); let n = 0; for (const g of regs.groups) { const d = members.get(g.member); for (let k = 0; k < g.count; k++) for (let i = 0; i < g.width * g.height; i++) if (cycled.has(d[g.offset + k * g.stride + i])) n++; } cycledInFrames.set(track, n); }
      const buf = [0, 1].map(() => ({ index: new Uint8Array(SIZE), out: new Uint8ClampedArray(SIZE * 4) })); // @math the two enhancers; four bytes a colour
      let found = null;
      for (let t = 0; t < Math.min(frames, 160) && !found; t++) { // @math the fly-in, the start and some racing
        const input = sc.input(); if (input === null) break;
        stepRace(s, input); plain.afterTick(s); packed.afterTick(s);
        if (t % 2) continue; // @math every other tick
        // In the duck game the ducks' explosions (GENEF.SP from 7641) are forced on the drawn state now and then (none of the scenario's
        // ducks is shot down in these ticks); put back before the next tick, so the race runs as it would.
        const ducks = sc.name.startsWith('duck') && t % 8 === 4 ? s.ai.racers.slice(1) : [], kept = ducks.map(r => [r.crashed, r.crashPic]); // @math every fourth drawn tick
        ducks.forEach((r, n) => { r.crashed = true; r.crashPic = (n + (t >> 3)) % duckPictures().explosion.frames; });
        const alpha = t % 14 === 6 ? 1 : pick(), { palette, cap } = paletteOf(s, t, fade), P = [plain, packed].map((e, n) => draw7(e, sc, alpha, buf[n].index, buf[n].out, palette, cap, null)); // @math every fourteenth tick at the tick itself
        ducks.forEach((r, n) => { [r.crashed, r.crashPic] = kept[n]; });
        if (!s.minimap && P[0].minimap) s.minimap = P[0].minimap;
        const la = plain.layers(), lb = packed.layers(), wa = la.world.data, wb = lb.world.data;
        if (!packed.inspect().art) found = `tick ${t}: the packs were not drawn`;
        else if (la.world.w !== lb.world.w || la.world.h !== lb.world.h) found = `tick ${t}: worlds of ${la.world.w} x ${la.world.h} and ${lb.world.w} x ${lb.world.h}`;
        else {
          const parts = [['out', buf[0].out, buf[1].out], ['index', buf[0].index, buf[1].index], ['world', wa, wb]], bad = parts.find(([, x, y]) => differs(x, y));
          if (bad) { const [k, x, y] = bad, i = x.findIndex((v, j) => v !== y[j]), per = k === 'index' ? 1 : 4, w = k === 'world' ? la.world.w : WIDTH; found = `tick ${t} (${geo.scale}x ${geo.view}, ${color} p = ${p}): ${k} differs at ${Math.floor(i / per) % w},${Math.floor(Math.floor(i / per) / w)}`; } // @math four bytes a colour
        }
        if (fade && t < 16) got.fade++; // @math the demos' fade-in ticks (paletteOf)
        if (sc.split) got.split++;
        if (geo.scale > 1) got.hd++;
        if (geo.view === 'wide' && la.world.w > geo.scale * WIDTH) got.wide++;
        got.pictures++;
      }
      for (const k of ['tiles', 'sky', 'strip', 'frames']) got[k] += provider.hits[k];
      got.runs++;
      if (found) { wrong7++; fail(`pack identity, ${sc.name}: ${found}`); }
    }
    Math.random = keepRandom;
    // A tinted pack changes the picture (the identity above is not the packs doing nothing).
    { const sc = demo(1), s = sc.state, a = createEnhancer({ storage: memory() }), b = createEnhancer({ storage: memory(), art: tinted() }), ia = new Uint8Array(SIZE), ib = new Uint8Array(SIZE), oa = new Uint8ClampedArray(SIZE * 4), ob = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
      a.configure({ ...PRESETS.enhanced, art: true }); b.configure({ ...PRESETS.enhanced, art: true });
      let changed = 0;
      for (let t = 0; t < 60; t++) { const input = sc.input(); if (input === null) break; stepRace(s, input); a.afterTick(s); b.afterTick(s); if (t % 10) continue; drawEnhanced(a, sc, 1, ia, oa); drawEnhanced(b, sc, 1, ib, ob); for (let i = 0; i < oa.length; i++) if (oa[i] !== ob[i]) changed++; } // @math the fly-in's first ticks, a picture every tenth
      if (!changed) fail('pack identity: a tinted pack changed nothing'); else console.log(`ok   pack identity: a tinted pack (red and blue swapped) changes ${changed} bytes of demo 1's pictures`);
    }
    const need = [['tile', got.tiles], ['sky', got.sky], ['strip', got.strip], ['picture', got.frames], ['starter lion (GENEF.SP 4449)', offsets.has(lionAt)], ['explosion (GENEF.SP 7641)', explosions.some(o => offsets.has(o))], ['picture at a byte offset of no frame grid', nonAligned], ['effect drawn after the own car', afterBlits], ['beach track', got.beach.size], ['demo fade-in picture', got.fade], ['split screen picture', got.split], ['2x picture', got.hd], ['wide picture', got.wide]].filter(([, v]) => !v).map(([k]) => k);
    if (need.length) fail(`pack identity: no ${need.join(', no ')} was drawn with the packs`);
    const cycledNote = [...cycledInFrames].map(([t, n]) => `track ${t} ${n}`).join(', ');
    if (!wrong7 && !need.length) console.log(`ok   pack identity: ${got.runs} runs (${PACKS.map(([c, p]) => `${c} at p = ${p}`).join(' and ')}), ${got.pictures} pictures each the no-pack picture byte for byte (the canvas, the index, the world), Enhanced with the dark full atmosphere; ${got.hd} at 2x, ${got.wide} wide, ${got.split} of the split screen, ${got.fade} of a demo's fade-in, beach tracks ${[...got.beach].join(', ')}; lookups: tiles ${got.tiles}, skies ${got.sky}, strips ${got.strip}, pictures ${got.frames} (the lion, the explosions, ${nonAligned} at offsets of no frame grid, ${afterBlits} effects after the own car); the registry's pictures in the palette cycle's entries: ${cycledNote || 'no beach track'}, their groups left out of the RGBA packs of those tracks: ${[...leftOut].join(', ') || 'none'} (${((performance.now() - seventh) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  }

  // ---- 8. the kart angle sets (M4): the convention check of every track, N = 8 identity sets giving the no-pack picture, the remapped records'
  // bytes the game's direction frames, and N = 32 sets moving the karts within half an octant of the game's frame in locked mode.
  if (want('8')) {
    const eighth = performance.now(), M = angleMapping(), cars = members.get('CARS.SP'), carSize = packWorld.carShape[0].w * packWorld.carShape[0].h;
    // The convention check on every track of the archive (a track that fails faces its racers to their compass words' octant centres).
    const conventions = raceTracks.map(t => ({ t, ...routeDirections(loadTrack(dat, String(t))) })), refused = conventions.filter(c => !c.ok), worst = conventions.filter(c => c.long).reduce((w, c) => Math.min(w, c.agree / c.long), 1);
    console.log(`${refused.length ? 'note' : 'ok  '} kart angles: the convention check of ${conventions.length} tracks: ${conventions.length - refused.length} keep it (their chords' octants are their compass words in at least ${(worst * 100).toFixed(1)}% of their long entries, ${ANGLES.agreement * 100}% asked)${refused.length ? `; refused, facing the octant centres: ${refused.map(c => `track ${c.t} (${c.agree} of ${c.long})`).join(', ')}` : ''}`); // @math percent; one decimal
    // The direction frame the game's rule chose for a logged record, worked out here from the drawn state: the seat's tick heading (sceneCamera),
    // the racer's compass word and slot (the computer racers of the state or the two player list of the seat, the intro's human), carFrame.
    const expectedAt = (s, entry) => {
      const swap = Boolean(s.versus) && s.versus.viewer !== entry.seat;
      if (swap) swapSeat(s);
      try {
        const heading = sceneCamera(s).heading, intro = s.intro && entry.racer === 0;
        const racer = intro ? { compass: 0, hit: 0 } : s.versus ? viewRacers(s)[entry.racer] : s.ai?.racers[entry.racer]; // the intro's human: compass word 0 (render/scene.js introHuman)
        const slot = intro ? s.slots[0] : s.versus ? viewSlots(s)[entry.racer] : s.slots[entry.racer];
        if (!racer || racer.hit === 1) return null;
        return cars.byteOffset + carFrame(slot, racerFrame(heading, racer.compass)) * carSize;
      } finally { if (swap) swapSeat(s); }
    };
    const draw8 = (enh, sc, alpha, index, out, palette, cap) => { // the page's draw where its display shows a world of any size (2x, wide), as section 7's
      const st = sc.state;
      if (sc.split) return enh.drawSplit(st, alpha, { index, out, palette, cap, mode: st.menu.settings.detail.split, overlays: versusOverlays, worldReady: true });
      return enh.drawSingle(st, alpha, { index, out, palette, cap, mode: st.detail, sky: sceneSky(st), seat: sc.seat ?? 0, worldReady: true, aspect: ASPECT, wideAllowed: !sc.link && !sceneSky(st), overlays: (p, fb) => drawRaceOverlays(p, fb) });
    };
    const plan8 = [...SCENARIOS.map((make, n) => ({ make, looks: n < 2 || n === SCENARIOS.length - 4 ? [{ scale: 1, view: 'standard', sizes: 'classes' }, { scale: 2, view: 'standard', sizes: 'classes' }, { scale: 1, view: 'wide', sizes: 'classes' }, { scale: 1, view: 'standard', sizes: 'smooth' }] : [{ scale: 1, view: 'standard', sizes: 'classes' }] })), { make: linkSecond, looks: [{ scale: 1, view: 'standard', sizes: 'classes' }] }, { make: slides, looks: [{ scale: 1, view: 'standard', sizes: 'classes' }] }]; // @math every scenario at 1x; the first demos and the split screen at 2x, wide and in smooth sizes too
    const got = { runs: 0, pictures: 0, direct: 0, own: 0, fixed: 0, hits: 0, wrongBytes: 0, missed: 0, moved: { locked: 0, free: 0 }, far: 0, looks: new Set() };
    let wrong8 = 0;
    for (const { make, looks } of plan8) for (const look of looks) {
      Math.random = lehmer(8080 + got.runs); // @math a repeatable stand-in for the browser's random source, one seed a run
      const sc = make(), s = sc.state, fade = sc.name.startsWith('demo') || sc.name.startsWith('slides'), pick = createRandom(808 + got.runs); // @math the checks' seed
      if (sc.split && look.view === 'wide') continue; // the split screen is never wide
      const log = [], provider = createArtProvider(() => dat).set(packArts({ select: 'ANGLES:ALL', directions: 8, scale: 1, color: 'indexed', track: s.world.name })); // @math N = 8: the identity
      const plain = createEnhancer({ storage: memory() }), sets = createEnhancer({ storage: memory(), art: provider, angleLog: entry => log.push(entry) }), cfg = { ...PRESETS.enhanced, art: true, angles: 'locked', ...look };
      plain.configure(cfg); sets.configure(cfg);
      const buf = [0, 1].map(() => ({ index: new Uint8Array(SIZE), out: new Uint8ClampedArray(SIZE * 4) })); // @math the two enhancers; four bytes a colour
      let found = null;
      for (let t = 0; t < Math.min(frames, 160) && !found; t++) { // @math the fly-in, the start and some racing
        const input = sc.input(); if (input === null) break;
        stepRace(s, input); plain.afterTick(s); sets.afterTick(s);
        if (t % 2) continue; // @math every other tick
        const alpha = t % 14 === 6 ? 1 : pick(), { palette, cap } = paletteOf(s, t, fade); // @math every fourteenth tick at the tick itself
        log.length = 0;
        const P = [plain, sets].map((e, n) => draw8(e, sc, alpha, buf[n].index, buf[n].out, palette, cap));
        if (!s.minimap && P[0].minimap) s.minimap = P[0].minimap;
        for (const entry of log) {
          if (entry.direct) { got.direct++; const want = expectedAt(s, entry); if (want !== entry.bytes.byteOffset) { got.wrongBytes++; found ??= `tick ${t}: racer ${entry.racer} (seat ${entry.seat}) remapped with the bytes at ${entry.bytes.byteOffset}, the game's direction frame at ${want}`; } if (entry.index !== entry.f) found ??= `tick ${t}: racer ${entry.racer} at index ${entry.index}, the game's frame ${entry.f}`; }
          else if (entry.type === 0) { got.own++; found ??= `tick ${t}: the own car drawn from a set (the bytes at ${entry.bytes.byteOffset})`; } // never: its other pictures are the driver files'
          else { got.fixed++; if (expectedAt(s, entry) === entry.bytes.byteOffset) { got.missed++; found ??= `tick ${t}: racer ${entry.racer} (seat ${entry.seat}) shows the game's direction frame but was not remapped`; } } // a direction frame the remap missed (another heading, slot or racer read)
        }
        const la = plain.layers(), lb = sets.layers(), parts = [['out', buf[0].out, buf[1].out], ['index', buf[0].index, buf[1].index], ['world', la.world.data, lb.world.data]], bad = parts.find(([, x, y]) => differs(x, y));
        if (!found && la.world.w !== lb.world.w) found = `tick ${t}: worlds of ${la.world.w} and ${lb.world.w} columns`;
        else if (!found && bad) { const [k, x, y] = bad, i = x.findIndex((v, j) => v !== y[j]), per = k === 'index' ? 1 : 4, w = k === 'world' ? la.world.w : WIDTH; found = `tick ${t} (${look.scale}x ${look.view} ${look.sizes}): ${k} differs at ${Math.floor(i / per) % w},${Math.floor(Math.floor(i / per) / w)}`; } // @math four bytes a colour
        got.pictures++;
      }
      got.hits += provider.hits.angles; got.runs++; got.looks.add(`${look.scale}x ${look.view} ${look.sizes}`);
      if (found) { wrong8++; fail(`kart angles, the N = 8 identity sets, ${sc.name}: ${found}`); }
    }
    // N = 32 sets (every direction drawn: the in-between cells the nearer original's) in locked and free mode: the karts move between the game's
    // frames, locked never more than half an octant (two directions) from the game's frame q f, and the remapped records' bytes are the game's.
    for (const mode of ['locked', 'free']) for (const make of SCENARIOS.filter((_, n) => n % 4 === 0)) { // @math every fourth scenario
      const sc = make(), s = sc.state, log = [], provider = createArtProvider(() => dat).set(packArts({ select: 'ANGLES:ALL', directions: 32, scale: 1, color: 'rgba', track: s.world.name }, fillSet)), q = 32 / M.octants; // @math N = 32
      const enh = createEnhancer({ storage: memory(), art: provider, angleLog: entry => log.push(entry) }), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math four bytes a colour
      enh.configure({ ...PRESETS.enhanced, art: true, angles: mode });
      for (let t = 0; t < Math.min(frames, 160); t++) { // @math the fly-in, the start and some racing
        const input = sc.input(); if (input === null) break;
        stepRace(s, input); enh.afterTick(s);
        if (t % 2) continue; // @math every other tick
        log.length = 0; drawEnhanced(enh, sc, (t % 10) / 10, index, out); // @math blends between the ticks
        for (const entry of log) {
          if (entry.type === 0) { got.own++; fail(`kart angles N = 32 ${mode}, ${sc.name}, tick ${t}: the own car drawn from a set`); continue; } // never: its other pictures are the driver files'
          if (!entry.direct) { if (entry.type === 1 && expectedAt(s, entry) === entry.bytes.byteOffset) { got.missed++; fail(`kart angles N = 32 ${mode}, ${sc.name}, tick ${t}: racer ${entry.racer} shows the game's direction frame but was not remapped`); } continue; }
          got.direct++;
          if (expectedAt(s, entry) !== entry.bytes.byteOffset) { got.wrongBytes++; fail(`kart angles N = 32 ${mode}, ${sc.name}, tick ${t}: racer ${entry.racer} remapped with bytes that are not the game's direction frame`); }
          const off = Math.abs(((entry.index - q * entry.f + 48) % 32) - 16); // @math the distance from q f in the set's 32 directions
          if (entry.index !== q * entry.f) got.moved[mode]++;
          if (mode === 'locked' && off > Math.floor(q / 2)) { got.far++; fail(`kart angles N = 32 locked, ${sc.name}, tick ${t}: index ${entry.index}, ${off} from the game's ${q * entry.f}`); }
        }
      }
      got.hits += provider.hits.angles;
    }
    Math.random = keepRandom;
    const need = [['record remapped by its direction', got.direct], ['spin frame drawn from a set at its own entry', got.fixed],['set lookup in the draw', got.hits], ['kart moved off the game\'s frame in locked mode', got.moved.locked], ['kart moved off the game\'s frame in free mode', got.moved.free]].filter(([, v]) => !v).map(([k]) => k);
    if (need.length) fail(`kart angles: no ${need.join(', no ')}: nothing was checked`);
    if (!wrong8 && !need.length && !got.wrongBytes && !got.far && !got.missed && !got.own) console.log(`ok   kart angles: ${got.runs} runs of the N = 8 identity sets (indexed, p = 1, every slot) in locked mode (${[...got.looks].join(', ')}), ${got.pictures} pictures each the no-pack picture byte for byte (the canvas, the index, the world); with them and the N = 32 sets ${got.direct} records remapped by their directions, each with the bytes of the game's direction frame (the tick's heading, the racer's compass word and slot), and no record of a direction frame left out; ${got.fixed} other frames of a slot with a set (the hit racers' spins) drawn at their own entries, the own car never; N = 32 sets: ${got.moved.locked} karts moved off the game's frame in locked mode, never more than two directions, ${got.moved.free} in free mode; ${got.hits} pictures drawn from the sets (${((performance.now() - eighth) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  }
}

// ---- 4. the draw time of each effect
if (timing) {
  const device = (() => { try { return process.platform === 'darwin' ? execSync('sysctl -n hw.model', { encoding: 'utf8' }).trim() : os.hostname(); } catch { return os.hostname(); } })();
  console.log(`\ndraw time per frame on ${device}, ${os.cpus()[0].model}, node ${process.version}, about 5 pictures a tick (60 Hz over the 11.3 Hz ticks):`);
  const configs = [['reference renderer', null], ['smooth motion', { ...PRESETS.original, smooth: true }], ['+ shadows', { ...PRESETS.original, smooth: true, shadows: true, sceneryShadows: true }], ['+ sun shadows', { ...PRESETS.original, smooth: true, sunShadows: true }], ['+ particles', { ...PRESETS.original, smooth: true, particles: true }], ['+ skid marks', { ...PRESETS.original, smooth: true, skidMarks: true }], ['+ fog', { ...PRESETS.original, smooth: true, fog: true }], ['+ sky layers', { ...PRESETS.original, smooth: true, clouds: true }], ['+ sky, mountains', { ...PRESETS.original, smooth: true, clouds: true }, { range: 1, rangeShape: 'mountains' }], ['+ water', { ...PRESETS.original, smooth: true, water: true }], ['+ lighting (sunset)', { ...PRESETS.original, smooth: true, lighting: true }, { grade: 'sunset' }], ['Enhanced (all)', PRESETS.enhanced], ['Enhanced, sunset', PRESETS.enhanced, { grade: 'sunset' }], ['general paths 1x', PRESETS.enhanced, null, { caster: true, blit: true, composite: true }], // the last: Enhanced through Stage 4's general paths at the reference geometry (6)
    ['smooth only 2x', { ...PRESETS.original, smooth: true, scale: 2 }], ['Enhanced 2x', { ...PRESETS.enhanced, scale: 2 }], ['Enhanced 2x sunset', { ...PRESETS.enhanced, scale: 2 }, { grade: 'sunset' }], // Stage 4's 2x, the soft layers on the reference grid (HD.look 'reference')
    ['Enhanced 2x full', { ...PRESETS.enhanced, scale: 2 }, null, null, 'full'], ['Enhanced 2x sunset full', { ...PRESETS.enhanced, scale: 2 }, { grade: 'sunset' }, null, 'full'], // and with every soft layer at the output resolution ('full'), for comparison
    ['Enhanced 1x wide', { ...PRESETS.enhanced, view: 'wide' }], ['Enhanced 2x wide', { ...PRESETS.enhanced, scale: 2, view: 'wide' }], // Stage 4's wide view on the display's default shape (4 BY 3: 426 and 852 columns)
    ['Enhanced 1x smooth sizes', { ...PRESETS.enhanced, sizes: 'smooth' }], ['Enhanced 2x smooth sizes', { ...PRESETS.enhanced, scale: 2, sizes: 'smooth' }], // Stage 4's smooth sprite sizes (M7)
    ['Enhanced 1x + pack', { ...PRESETS.enhanced, art: true }, null, null, undefined, world => createArtProvider(() => dat).set(['CARS.SP', ...templateParts(members, packWorld).tracks.find(t => t.stem === world.name).tiles].flatMap(select => packArts({ select, scale: 2, color: 'rgba', track: world.name })))], // Stage 4's artwork packs: an RGBA pack of CARS.SP and the track's tile sheets at p = 2 (the plan's budget: +0.5 ms)
    ['+ angles N = 32', { ...PRESETS.enhanced, art: true, angles: 'locked' }, null, null, undefined, world => createArtProvider(() => dat).set([...['CARS.SP', ...templateParts(members, packWorld).tracks.find(t => t.stem === world.name).tiles].flatMap(select => packArts({ select, scale: 2, color: 'rgba', track: world.name })), ...packArts({ select: 'ANGLES:ALL', directions: 32, scale: 2, color: 'rgba', track: world.name }, fillSet)])]]; // M4's kart angle sets: the row above with RGBA sets of 32 directions of every slot at p = 2, locked (the plan's budget: +0.1 ms over the row above)
  console.log(`  (load average ${os.loadavg().map(v => v.toFixed(1)).join(' ')}: compare the rows against each other, a busy machine slows them all)`);
  for (const [label, cfg, atmosphere, force = null, look = undefined, packsOf = null] of configs) {
    const times = [];
    let sized = null;
    for (const race of [1, 2, 3, 4]) { // @math the four attract races
      const sc = demo(race), s = sc.state, enh = createEnhancer({ storage: memory(atmosphere ? Object.fromEntries(raceTracks.map(t => [String(t), atmosphere])) : null), force, look, art: packsOf ? packsOf(s.world) : null }), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), palette = rgbaPalette(s.world.palette); // @math four bytes a colour
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
