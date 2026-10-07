// Hashes of what the Enhanced presentation and the reference renderer draw on a local WACKY.DAT, for check:identity (scripts/compare-enhance.mjs):
// the same script runs against two source roots, this tree and a worktree of an earlier commit, and the two results must be equal frame for
// frame. A regression gate, not evidence about the game. Every module is imported from `--root`; the archive is always this repository's own
// (game/, or --archive), so both roots draw the same bytes. The hashes go only to `--out` (compare-enhance keeps them in a temporary directory).
// - enhanced: eight configurations over ten scenarios. A (Enhanced with the default atmosphere), B (Enhanced with a dark full atmosphere on every
//   track: the night grade, clouds 0.9, mountains at full range, water 1, relief 1), C (B with the HUD layers handed in) and D (smooth motion
//   only) always draw through the enhancer, with the frame context the page passes where its display can show a world of another size
//   (worldReady true, the display's default shape, wideAllowed but in a link race and a slides demo; an earlier commit ignores it). N (Enhanced
//   with RESOLUTION 2X stored) and W (Enhanced with VIEW WIDE stored) draw with worldReady false, as the page without WebGL 2: the world at 1x
//   in the standard view, so A's pictures (an earlier commit drops the unknown setting). O (the Original preset) and O2 (Original as stored before Stage 4, read from the storage) draw as
//   the page's draw decides: through the enhancer when enh.active(), else the reference renderer's path, a replica of the page's (play.js
//   cannot run in node); they guard the gate and that path, not an edit of play.js's draw itself. The scenarios: the attract demo of track 1
//   (with its fade-in), races on tracks 2, 3, 6 and 7, the split screen, the duck game, a slides demo (the ORDERING pages over track 7) and
//   both seats of a link race (through the enhancer the page's enhanced link draw, drawSingle with the seat, the enhancer swapping the seats
//   for the second; in O and O2 the page's drawLinkRace). In the split screen the first viewer is drawn upside down every fifth tick and the
//   second every seventh (the overlays' flip of a viewer's half and the enhancer's of the world and its layers, which the race alone does not
//   reach in these ticks). Each tick is drawn at a seeded blend, every seventh tick also at the tick itself;
//   per picture the CRC-32 of out (RGBA), index, the overlay mask and, in C, the world and HUD layers; the size of the world the display is
//   handed (`layers()`: 'canvas' for a 320 x 200 world, else its size and logical width, so a frame drawn at another geometry differs at once,
//   whatever its pixels; an earlier commit has no `layers()` and records 'canvas'); in O and O2 also the path taken, and on the reference path
//   only the index (the page's blit colours it with the palette) and 'canvas'.
// - reference: the reference renderer's drawRaceFrame pictures of every track of the archive, the camera's fly-in and the race, at detail
//   levels 1 and 3, and the two player split screen at split detail levels 1 and 3 (renderScene twice, composeSplit and the overlays).
// usage: node scripts/hash-enhance.js [--root <source root>] [--archive <WACKY.DAT>] [--out <file.json>] [--mode all|enhanced|reference] [--ticks N]
import { writeFile, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32 } from '../src/evidence/crc32.js';

const HERE = dirname(fileURLToPath(import.meta.url)), REPO = resolve(HERE, '..');
const args = process.argv.slice(2), opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const root = resolve(opt('--root', REPO)), archivePath = opt('--archive', null), outPath = opt('--out', null), mode = opt('--mode', 'all'), TICKS = Number(opt('--ticks', 300)); // @math a few hundred ticks: the fly-in, the start and some laps' worth of racing
if (!['all', 'enhanced', 'reference'].includes(mode) || !(TICKS > 0)) { console.error('usage: node scripts/hash-enhance.js [--root dir] [--archive WACKY.DAT] [--out file.json] [--mode all|enhanced|reference] [--ticks N]'); process.exit(2); } // @math the usage error's exit code
const from = path => import(pathToFileURL(join(root, 'src', path)).href);

const { openGameFolder } = await from('vfs/node.js');
const { archiveMembers, loadTrack, rgbaPalette } = await from('game/track-data.js');
const { lionBytes } = await from('game/start.js');
const { parseMov } = await from('game/figure.js');
const { startRace, stepRace, beginIntro, shownCycle } = await from('game/race.js');
const { demoSpec, parseBmc, bmcStart, bmcStep } = await from('game/demo.js');
const { duckTrack, duckRules } = await from('game/duck.js');
const { stripValues, raceValues, messageAt, carsBySeat, swapSeat } = await from('game/versus.js');
const { RACE: VERSUS_RACE } = await from('game/versus-rules.js');
const { defaultSettings } = await from('game/menus.js');
const { hudGates } = await from('game/hud.js');
const { drawRaceFrame, drawRaceOverlays, sceneSky } = await from('render/race-frame.js');
const { renderScene } = await from('render/scene.js');
const { loadHudArt } = await from('render/hud.js');
const { composeSplit, drawStrips, drawRaceHud, flipViewport } = await from('render/versus.js');
const { drawMessage } = await from('render/finish.js');
const { decodePcxMember } = await from('formats/pcx.js');
const { createEnhancer } = await from('enhance/index.js');
const { PRESETS, ATMOSPHERE, LEVELS, STORAGE_KEY } = await from('enhance/config.js');
const { normalizeDisplay } = await from('enhance/display-settings.js');
const { createRandom } = await from('enhance/particles.js');

const dat = archivePath ? new Uint8Array(await readFile(archivePath)) : await (await openGameFolder(join(REPO, 'game'))).open('WACKY.DAT');
const members = archiveMembers(dat), mov = parseMov(members.get('GIG.MOV')), hudArt = loadHudArt(members), SIZE = 64000, SCREEN = { w: 320, h: 200 }; // @math the 320 x 200 screen
const raceTracks = [...members.keys()].filter(n => /^\d+\.GAM$/.test(n)).map(n => Number(n.replace('.GAM', ''))).sort((a, b) => a - b);
const lcg = seed => () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // @math a repeatable stand-in for the browser's random source
const memory = (tracks = null, settings = null) => { const m = new Map(); if (tracks) m.set(ATMOSPHERE.storageKey, JSON.stringify({ version: 1, tracks })); if (settings) m.set(STORAGE_KEY, JSON.stringify(settings)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const bytes = a => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
const hash = a => crc32(bytes(a));

// ---- the scenarios (the setups of scripts/check-enhance.js): a state, the input of each tick and how the page draws it
const base = () => ({ mov, unproven: new Set(), hud: null, dat, hudArt, menu: { settings: defaultSettings(1, true) }, seed: 4242, detail: 1 }); // @math the checks' seed
const none = { accelerate: false, brake: false, left: false, right: false, spin: false, fire: false };
const FADE_TICKS = 16; // @math the first ticks of a demo are drawn fading in, as the page does (demo.fade-in): 6-bit levels up by 4 a tick
function demo(race) {
  const spec = demoSpec('attract', race), state = { ...base(), class: spec.class, engine: spec.engine, detail: spec.detail, humanSlot: race % 8, demo: { kind: 'attract', spec, mode: spec.mode, page: 1, pictures: null } }; // @math a driver for each race
  startRace(state, { ...loadTrack(dat, String(spec.track), spec.engine, state.humanSlot), lion: lionBytes(members) }, spec.laps); beginIntro(state);
  let bmc = bmcStart(parseBmc(members.get(`${spec.track}.BMC`)));
  return { name: `demo ${spec.track}`, state, fade: true, input: () => { if (state.intro) return {}; const s = bmcStep(bmc); bmc = s.state; return s.controls.end ? null : s.controls; } };
}
function slides() {
  const spec = demoSpec('ordering', null), state = { ...base(), class: spec.class, engine: spec.engine, detail: spec.detail, humanSlot: 0, demo: { kind: 'ordering', spec, mode: spec.mode, page: 1, pictures: spec.pages.map(n => decodePcxMember(members.get(n))) } };
  startRace(state, { ...loadTrack(dat, String(spec.track), spec.engine, 0), lion: lionBytes(members) }, spec.laps); beginIntro(state);
  let bmc = bmcStart(parseBmc(members.get(`${spec.track}.BMC`) ?? new Uint8Array(0)));
  return { name: `slides of track ${spec.track}`, state, fade: true, input: () => { if (state.intro) return {}; const s = bmcStep(bmc); bmc = s.state; return s.controls.end ? {} : s.controls; } };
}
function race(track) {
  const state = base(); startRace(state, { ...loadTrack(dat, String(track)), lion: lionBytes(members) }, 6); beginIntro(state); // @math six laps
  let f = 0;
  return { name: `race ${track}`, state, input: () => { const w = Math.floor(f / 40) % 3; f++; return { accelerate: true, brake: f % 300 > 280, left: w === 1, right: w === 2, spin: f % 200 > 190, fire: f % 90 < 30 }; } }; // @math the keys of check:race
}
function versus(track, split = true) {
  const state = { ...base(), class: 1, engine: 1, humanSlot: 7, versusMode: { kind: 'race', cars: 2, laps: 2, class: 1, engine: 1, slots: [7, 4] } }; // @math the setup of check:versus' race
  startRace(state, { ...loadTrack(dat, String(track), 1, 7, { split }), lion: lionBytes(members) }, 2); state.versusMode = null; // @math two laps
  let f = 0;
  return { name: `versus ${track}`, state, split, input: () => { const k = Math.floor(f / 30) % 3; f++; return { p1: { ...none, accelerate: true, left: k === 1, right: k === 2, fire: f % 60 < 20 }, p2: { ...none, accelerate: true, left: k === 2, right: k === 1, fire: f % 45 < 15 } }; } }; // @math the keys of check:versus
}
function link(seat) { const sc = versus(1, false); return { ...sc, name: `link race seat ${seat + 1}`, link: true, seat }; } // a link race draws one human's full screen with the track's sky
function duck(zone) {
  const R = duckRules(), random = createRandom(zone), state = { ...base(), class: R.level, engine: R.engine, humanSlot: 7, duckMode: { zone }, rng: random }; // the duck AI's own seeded source
  startRace(state, { ...loadTrack(dat, String(duckTrack(zone)), R.engine, 7), lion: lionBytes(members) }, 1); state.duckMode = null;
  let f = 0;
  return { name: `duck ${duckTrack(zone)}`, state, input: () => { const w = Math.floor(f / 40) % 3; f++; if (f === 50) state.player.car = { ...state.player.car, counter: 20 }; return { accelerate: true, left: w === 1, right: w === 2, fire: f % 90 < 30 }; } }; // @math some hogs at the 50th tick
}
const SCENARIOS = [() => demo(1), () => race(2), () => race(3), () => race(6), () => race(7), () => versus(1), () => duck(1), slides, () => link(0), () => link(1)]; // @math the Stage 3 hash run's six, race 6, a slides demo, the link race's two seats

function versusOverlays(s, fb) { // the page's overlays of the split screen without its menu
  const V = s.versus;
  drawStrips(fb, hudArt, stripValues(s), { shoot: V.kind === 'shootout' });
  if (V.kind === 'race') drawRaceHud(fb, hudArt, raceValues(s), hudGates(s.menu.settings));
  carsBySeat(s).forEach((c, n) => { if (c.inverted !== 0) flipViewport(fb, n); });
  if (V.message) drawMessage(fb, hudArt.ofont, messageAt(V.message.text));
}
// The page's raceRgba and fadeCap: the track's palette with the cycled entries shown, or the fade's level over the first ticks of a demo.
function paletteOf(s, t, fade) {
  const level = fade && t < FADE_TICKS ? Math.min(t * 4, 63) : null; // @math 6-bit levels up by four a tick, at most 63
  if (level !== null) return { palette: rgbaPalette(s.world.palette.map(v => Math.min(v, level))), cap: Math.min((level << 2) | (level >> 4), 255) }; // @math the 6-bit level widened to 8 bits
  const palette = rgbaPalette(s.world.palette), entries = shownCycle(s)?.entries;
  if (entries?.size) for (const [entry, c] of entries) c.forEach((v, k) => { palette[entry * 4 + k] = (v << 2) | (v >> 4); }); // @math four bytes an entry; 6 bits widened to 8
  return { palette, cap: 255 }; // @math the brightest 8-bit component
}

// The page's draw when the enhancer is not active (play.js draw: drawLinkRace, drawVersus, or drawRaceFrame's scene and overlays), without the
// pause menu and the HUD layer: a replica of the page's code (play.js cannot be imported in node), drawing the index the page's blit turns
// into colours with the palette.
const sceneA = new Uint8Array(SIZE), sceneB = new Uint8Array(SIZE);
function drawReference(s, sc, index) {
  if (sc.link) { // drawLinkRace: the own seat's view full screen, the other seat swapped in for the second, the map's dots of the other human and the computer racers
    const cars = carsBySeat(s); s.minimapOthers = [{ x: cars[1 - sc.seat].px, y: cars[1 - sc.seat].py }, ...(s.ai ? s.ai.racers.slice(VERSUS_RACE().firstComputer) : [])];
    if (sc.seat === 1) swapSeat(s);
    renderScene(s, index, s.detail, sceneSky(s)); drawRaceOverlays(s, index);
    if (sc.seat === 1) swapSeat(s);
  } else if (sc.split) { // drawVersus
    const mode = s.menu.settings.detail.split;
    renderScene(s, sceneA, mode); swapSeat(s); renderScene(s, sceneB, mode); swapSeat(s); composeSplit(sceneA, sceneB, index); versusOverlays(s, index);
  } else drawRaceFrame(s, index);
}

// ---- enhanced: the configurations over the scenarios
const dark = Object.fromEntries(raceTracks.map(t => [String(t), { grade: 'night', clouds: 0.9, range: 1, rangeShape: 'mountains', water: 1, relief: 1 }])); // @math every track night, cloudy, mountainous, its water and relief full
const STORED_ORIGINAL = { preset: 'original', ...PRESETS.original, ...LEVELS }; // the graphics settings a player of Original kept before Stage 4: the switches and the levels, no rendering choices
// A to D, N and W always draw through the enhancer (N and W without a world of another size: worldReady false). O (the Original preset, configured) and O2 (STORED_ORIGINAL in the browser's storage, read by the
// enhancer as the page's is) draw as the page decides: through the enhancer when it is active, else the reference renderer (drawReference),
// and record which (`path`) with the picture.
const CONFIGS = {
  A: { settings: PRESETS.enhanced, atmosphere: null, layers: false }, B: { settings: PRESETS.enhanced, atmosphere: dark, layers: false }, C: { settings: PRESETS.enhanced, atmosphere: dark, layers: true }, D: { settings: { ...PRESETS.original, smooth: true }, atmosphere: null, layers: false },
  N: { settings: { ...PRESETS.enhanced, scale: 2 }, atmosphere: null, layers: false, worldReady: false }, // @math RESOLUTION 2X
  W: { settings: { ...PRESETS.enhanced, view: 'wide' }, atmosphere: null, layers: false, worldReady: false }, // VIEW WIDE
  O: { settings: PRESETS.original, atmosphere: null, layers: false, page: true }, O2: { settings: null, stored: STORED_ORIGINAL, atmosphere: null, layers: false, page: true },
};
function runEnhanced(config, make, n) {
  const keep = Math.random; Math.random = lcg(777 + n); // @math the checks' seed, one per scenario
  try {
    const sc = make(), s = sc.state, enh = createEnhancer({ storage: memory(config.atmosphere, config.stored) }), pick = lcg(31 + n), index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4); // @math the checks' seed; four bytes a colour
    const layers = config.layers ? { world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) } : null, record = { ...(config.page ? { path: [] } : {}), out: [], index: [], mask: [], size: [], ...(layers ? { world: [], hud: [] } : {}) }; // @math four bytes a colour
    if (config.settings) enh.configure(config.settings);
    const worldReady = config.worldReady ?? true, aspect = normalizeDisplay().aspect; // the page's frame context (play.js drawEnhanced): its display's worldReady() and shape
    for (let t = 0; t < TICKS; t++) {
      const input = sc.input(); if (input === null) break;
      stepRace(s, input); enh.afterTick(s);
      // In the split screen a viewer is drawn upside down now and then, both at once some ticks (the drawn state only: the flags are put back
      // before the next tick, so the race runs as it would).
      const cars = sc.split ? carsBySeat(s) : [], kept = cars.map(c => c.inverted), flips = [t % 5 === 2, t % 7 === 3]; // @math the first viewer every fifth tick, the second every seventh
      cars.forEach((c, n) => { if (flips[n]) c.inverted = 1; });
      for (const alpha of t % 7 === 6 ? [pick(), 1] : [pick()]) { // @math every seventh tick also at the tick itself
        if (config.page && !enh.active()) { drawReference(s, sc, index); record.path.push('reference'); record.out.push(null); record.index.push(hash(index)); record.mask.push(null); record.size.push('canvas'); continue; }
        if (config.page) record.path.push('enhanced');
        const { palette, cap } = paletteOf(s, t, sc.fade);
        if (sc.split) enh.drawSplit(s, alpha, { index, out, palette, cap, mode: s.menu.settings.detail.split, overlays: versusOverlays, layers, worldReady });
        else {
          const P = enh.drawSingle(s, alpha, { index, out, palette, cap, mode: s.detail, sky: sceneSky(s), seat: sc.link ? sc.seat : 0, layers, worldReady, aspect, wideAllowed: !sc.link && !sceneSky(s), overlays: (p, fb) => {
            if (sc.link) { const cars = carsBySeat(p); p.minimapOthers = [{ x: cars[1 - sc.seat].px, y: cars[1 - sc.seat].py }, ...(p.ai ? p.ai.racers.slice(VERSUS_RACE().firstComputer) : [])]; } // the page's link race map: the other human, then the computer racers
            drawRaceOverlays(p, fb);
          } });
          if (!s.minimap && P.minimap) s.minimap = P.minimap; // what the page keeps of the overhead map
        }
        record.out.push(hash(out)); record.index.push(hash(index)); record.mask.push(hash(enh.inspect().mask));
        const l = enh.layers?.(); record.size.push(l && (l.world.w !== SCREEN.w || l.world.h !== SCREEN.h || l.logical.w !== SCREEN.w) ? `${l.world.w}x${l.world.h}/${l.logical.w}` : 'canvas'); // the world the display is handed
        if (layers) { record.world.push(hash(layers.world)); record.hud.push(hash(layers.hud)); }
      }
      cars.forEach((c, n) => { c.inverted = kept[n]; });
    }
    return { name: sc.name, record };
  } finally { Math.random = keep; }
}

// ---- reference: drawRaceFrame pictures of every track, single and split, at two detail levels
const REF_TICKS = Math.min(TICKS, 160), SPLIT_TICKS = Math.min(TICKS, 80), DETAILS = [1, 3]; // @math the fly-in and the start; detail levels 1 and 3
function runReference(track) {
  const keep = Math.random; Math.random = lcg(4242 + track); // @math one seed per track
  try {
    const out = { race: [], split: [] }, index = new Uint8Array(SIZE), A = new Uint8Array(SIZE), B = new Uint8Array(SIZE);
    const sc = race(track), s = sc.state;
    for (let t = 0; t < REF_TICKS; t++) {
      stepRace(s, sc.input());
      if (t % 2) continue; // @math every other tick
      const kept = s.detail;
      for (const d of DETAILS) { s.detail = d; drawRaceFrame(s, index); out.race.push(hash(index)); }
      s.detail = kept; // the detail level sets the steering rate: the race keeps its own
    }
    let v;
    try { v = versus(track); } catch (e) { out.split = [`no split screen: ${e.message}`]; return out; }
    for (let t = 0; t < SPLIT_TICKS; t++) {
      stepRace(v.state, v.input());
      if (t % 2) continue; // @math every other tick
      for (const d of DETAILS) { renderScene(v.state, A, d); swapSeat(v.state); renderScene(v.state, B, d); swapSeat(v.state); composeSplit(A, B, index); versusOverlays(v.state, index); out.split.push(hash(index)); }
    }
    return out;
  } finally { Math.random = keep; }
}

const result = { root, ticks: TICKS, enhanced: {}, reference: {} }, t0 = performance.now();
if (mode !== 'reference') {
  for (const [key, config] of Object.entries(CONFIGS)) {
    result.enhanced[key] = {};
    SCENARIOS.forEach((make, n) => { const { name, record } = runEnhanced(config, make, n); result.enhanced[key][name] = record; });
    console.log(`enhanced ${key}: ${Object.entries(result.enhanced[key]).map(([name, r]) => `${name} ${r.out.length}`).join(', ')} pictures (${((performance.now() - t0) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
  }
}
if (mode !== 'enhanced') {
  for (const track of raceTracks) result.reference[track] = runReference(track);
  console.log(`reference: ${raceTracks.length} tracks, ${Object.values(result.reference).reduce((n, r) => n + r.race.length + r.split.length, 0)} pictures (${((performance.now() - t0) / 1000).toFixed(0)} s)`); // @math milliseconds in a second
}
if (outPath) await writeFile(outPath, JSON.stringify(result));
else console.log(JSON.stringify(Object.fromEntries(Object.entries(result.enhanced).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([n, r]) => [n, crc32(bytes(Uint32Array.from(r.out)))]))]))));
