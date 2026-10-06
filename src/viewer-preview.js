// The asset garage's previews of the Enhanced presentation (docs/enhancements.md): a race on a track seen from the race camera, drawn by the
// reference renderer and by the enhancer side by side, and a sprite's ground anchor with its shadows. A preview runs its own race on the
// visitor's archive (the track's .BMC demo controls when it has one, else a simple pilot that follows the computer cars); nothing of it
// reaches the game, except the graphics settings when the visitor saves them for the game.
import { archiveMembers, loadTrack, rgbaPalette } from './game/track-data.js';
import { lionBytes } from './game/start.js';
import { parseMov } from './game/figure.js';
import { startRace, stepRace, beginIntro, shownCycle } from './game/race.js';
import { routeEntries } from './game/ai.js';
import { demoSpec, demoKinds, nextRace, parseBmc, bmcStart, bmcStep } from './game/demo.js';
import { defaultSettings } from './game/menus.js';
import { frameMs } from './game/clock.js';
import { buildRowTable } from './game/view.js';
import { renderScene } from './render/scene.js';
import { drawRaceOverlays, sceneSky } from './render/race-frame.js';
import { loadHudArt } from './render/hud.js';
import { createEnhancer } from './enhance/index.js';
import { normalize, anyEffect } from './enhance/settings.js';
import { EFFECTS, LOOK_EFFECTS, SHADOW } from './enhance/config.js';
import { turnDelta } from './enhance/motion.js';
import { createLayers } from './enhance/scene.js';
import { stampShadow, castShadow, sunDirection, blurCast } from './enhance/shadows.js';
import { composite } from './enhance/composite.js';
import { KIND } from './enhance/project.js';

const WIDTH = 320, HEIGHT = 200, SIZE = WIDTH * HEIGHT; // @math the VGA mode 13h screen
const TURN = 1920; // @math compass units in a turn (view.model)
const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

// The reference picture's palette: the track's, with the DAC entries the palette cycler has rewritten (as the playtest page does).
function framePalette(state) {
  const base = rgbaPalette(state.world.palette), entries = shownCycle(state)?.entries;
  if (!entries?.size) return base;
  for (const [entry, c] of entries) c.forEach((v, k) => { base[entry * 4 + k] = (v << 2) | (v >> 4); }); // @math four bytes an entry; 6 bits widened to 8
  return base;
}

// A simple pilot for tracks without demo controls: full throttle after a point some way ahead on the computer cars' route (ai.js
// routeEntries, in race order), the hand brake on a sharp turn. `memo` keeps where on the route the car was.
const LOOKAHEAD = 110, WINDOW = 400; // @math route points (about world units) ahead, and how far along the route the nearest point is looked for
function pilot(state, memo) {
  const car = state.car, points = memo.points ??= routeEntries(state.world.route).flatMap(e => e.points), n = points.length;
  if (!n) return { accelerate: true };
  const near = i => { const [x, y] = points[((i % n) + n) % n]; return Math.hypot(x - car.px, y - car.py); };
  let best = memo.at ?? 0, bestD = Infinity;
  const from = memo.at === undefined ? 0 : memo.at - WINDOW / 4, to = memo.at === undefined ? n : memo.at + WINDOW; // @math a little back, more ahead
  for (let i = from; i < to; i++) { const d = near(i); if (d < bestD) { bestD = d; best = i; } }
  memo.at = ((best % n) + n) % n;
  const [tx, ty] = points[(memo.at + LOOKAHEAD) % n], turn = turnDelta(car.heading, ((Math.atan2(ty - car.py, tx - car.px) / (2 * Math.PI)) * TURN + TURN) % TURN); // @math the compass angle of the direction
  return { accelerate: true, left: turn < -24, right: turn > 24, spin: Math.abs(turn) > TURN / 6 }; // @math a dead band of 24 compass units; a sixth of a turn calls for the hand brake
}

// The demo a track's .BMC controls belong to and the driver it was recorded with: the attract mode's races take the drivers one after the
// other from the first (the driver counter obj1+0xe5e0 from a fresh start), the slide shows the first.
function demoOf(track) {
  for (const kind of demoKinds()) {
    let spec = demoSpec(kind), driver = 0;
    while (spec) {
      if (spec.track === Number(track)) return { spec, driver };
      const n = nextRace(spec); spec = n ? demoSpec(kind, n) : null; driver++;
    }
  }
  return null;
}

// The race preview of a track: `seek(tick)` runs it to a tick (from the start again when going back or when an effect that keeps a scene
// changes), `step()` runs one more, `draw(...)` draws the reference and the enhanced picture of the moment. `atmosphere(name)` gives the
// track's atmosphere (createEnhancer's); `demoControls` false drives with the pilot even where the track has a demo recording (the track
// editor's preview of an edited track, whose layout the recording does not fit).
export function createRacePreview(dat, track, { atmosphere = null, demoControls = true } = {}) {
  const members = archiveMembers(dat), bmc = demoControls ? members.get(`${track}.BMC`) : null, hudArt = loadHudArt(members), mov = parseMov(members.get('GIG.MOV'));
  const recorded = bmc ? demoOf(track) : null, demo = recorded?.spec ?? null; // the demo's class, engine, laps and detail level (the detail sets the steering rate)
  const sceneSwitches = s => `${EFFECTS.filter(k => !LOOK_EFFECTS.includes(k)).map(k => s[k]).join()}|${anyEffect(s)}`; // the sky's layers, the lighting and the water only colour the picture (but with every effect off the enhancer takes no snapshot)
  let state = null, enh = null, inputs = null, switches = null, controls = null;
  const index = new Uint8Array(SIZE), ref = new Uint8Array(SIZE);

  function fresh(settings) {
    state = { mov, unproven: new Set(), hud: null, dat, hudArt, menu: { settings: defaultSettings(1, true) }, seed: 1234, class: demo?.class ?? 1, engine: demo?.engine ?? 1, detail: demo?.detail ?? 1, humanSlot: recorded?.driver ?? 7, ...(demo ? { demo: { kind: demo.kind, spec: demo, mode: demo.mode, page: 1, pictures: null } } : {}) }; // @math a fixed seed for the computer cars; the demo's driver, else Tigi
    startRace(state, { ...loadTrack(dat, String(track), state.engine, state.humanSlot), lion: lionBytes(members) }, demo?.laps ?? 6); // @math six laps
    beginIntro(state);
    controls = demo ? bmcStart(parseBmc(bmc)) : null;
    const memo = {};
    inputs = () => {
      if (state.intro) return {};
      if (!controls) return pilot(state, memo);
      const s = bmcStep(controls); controls = s.state;
      if (s.controls.end) { controls = null; return pilot(state, memo); } // the recording is over: the pilot takes the wheel
      return s.controls;
    };
    enh = createEnhancer({ storage: memoryStorage(), atmosphere });
    enh.configure(settings);
    switches = sceneSwitches(settings);
  }

  const api = {
    driver: demo ? 'the controls of the track\'s demo race (the pilot after their end)' : 'a pilot that follows the computer cars\' route',
    get tick() { return state?.tick ?? 0; },
    get race() { return state; }, // the preview's own race state and enhancer (for the checks)
    get enhancer() { return enh; },
    get passes() { return api.count; },
    count: 0,
    // Runs the race to `target` passes (the intro's passes included) with the effects of `settings`.
    seek(target, settings) {
      const s = normalize(settings);
      if (!state || api.count > target || sceneSwitches(s) !== switches) { fresh(s); api.count = 0; }
      else enh.configure(s); // the levels only: nothing to run again
      while (api.count < target) api.step();
    },
    step() { stepRace(state, inputs()); enh.afterTick(state); api.count++; },
    // Draws the moment: `alpha` how far toward the next pass (smooth motion), `hud` whether the overlays are drawn, `detail` the detail
    // level. Fills `original` and `enhanced` (RGBA, 320 x 200).
    draw({ alpha = 1, hud = true, detail = 1 }, original, enhanced) { // `detail` is the drawing's; the race keeps its own (it sets the steering rate)
      const palette = framePalette(state), overlays = (s, fb) => { if (!hud) return; const v = { ...s, demo: null }; drawRaceOverlays(v, fb); if (!state.minimap && v.minimap) state.minimap = v.minimap; }; // the race's own HUD, also over a demo's controls
      renderScene(state, ref, detail, sceneSky(state)); overlays(state, ref);
      for (let i = 0, o = 0; i < SIZE; i++, o += 4) { const p = ref[i] * 4; original[o] = palette[p]; original[o + 1] = palette[p + 1]; original[o + 2] = palette[p + 2]; original[o + 3] = 255; } // @math four bytes a colour
      if (anyEffect(enh.settings)) enh.drawSingle(state, alpha, { index, out: enhanced, palette, mode: detail, sky: sceneSky(state), overlays });
      else enhanced.set(original);
      return enh.stats();
    },
    tickMs: frameMs(),
  };
  return api;
}

// The ground anchor of a sprite frame (w x h, column-major, index 0 transparent): the lowest opaque row, the footprint of the contact
// shadow (the opaque columns of the lowest quarter up from that row) and each column's highest and lowest opaque row.
export function spriteAnchor(frame, w, h) {
  const top = new Int16Array(w).fill(-1), bottom = new Int16Array(w).fill(-1);
  let low = -1;
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (frame[x * h + y] !== 0) { if (top[x] < 0) top[x] = y; bottom[x] = y; if (y > low) low = y; }
  if (low < 0) return null;
  const band = Math.max(Math.round(h * SHADOW.bottomBand), 1);
  let minX = w, maxX = -1;
  for (let x = 0; x < w; x++) if (bottom[x] >= 0 && bottom[x] > low - band) { if (x < minX) minX = x; if (x > maxX) maxX = x; } // the columns reaching into the band
  return { low, lift: h - 1 - low, band, minX, maxX, cols: { top, bottom } };
}

// A sprite frame stood where the race draws the player's car (the middle of the screen, at the own car's distance) on a plain ground, with
// its contact shadow and its sun shadow for a sun at `sunAngle` seen from a camera heading 0. `tables` are the bytes of TRIG.DAT and VIEW;
// `palette` 768 bytes of 8-bit RGB. Returns { rgba (320 x 200), anchor, left, top, row }.
export function anchorStage(tables, frame, w, h, palette, { sunAngle = 0.35, contact = true, sun = true, rule = 'scenery', ground = [118, 128, 112] } = {}) { // `rule` 'racer' sizes the contact shadow as the race sizes a car's (casterOf) // @math a neutral grey-green ground
  const asView = b => new DataView(b.buffer, b.byteOffset, b.byteLength), world = { trig: asView(tables.trig), view: asView(tables.view), rows: buildRowTable() };
  const distance = 0x7c, row = world.rows[distance], left = (WIDTH >> 1) - (w >> 1), top = row - h, a = spriteAnchor(frame, w, h); // @math the own car's distance (view.player-car-draw); the middle column
  const L = createLayers(SIZE), index = new Uint8Array(SIZE), rgba = new Uint8ClampedArray(SIZE * 4), pal = new Uint8ClampedArray(256 * 4); // @math 256 colours of four bytes
  L.kind.fill(KIND.floor); L.depth.fill(distance);
  for (let i = 0; i < 256; i++) { pal.set([palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], 255], i * 4); } // @math the palette as RGBA
  pal.set([...ground, 255], 0); // the transparent index shows the ground
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) { const v = frame[x * h + y], X = left + x, Y = top + y; if (v !== 0 && X >= 0 && X < WIDTH && Y >= 0 && Y < HEIGHT) { index[Y * WIDTH + X] = v; L.kind[Y * WIDTH + X] = KIND.sprite; } }
  if (a && contact) {
    const keep = 1 - Math.min(a.lift / SHADOW.liftFade, 1) / 2; // @math a lifted frame down to half
    stampShadow(L, rule === 'racer' ? { x: left + (w >> 1), y: row, rx: (w * SHADOW.widthOfPicture * keep) / 2, strength: keep } : { x: left + (a.minX + a.maxX + 1) / 2, y: row, rx: ((a.maxX - a.minX + 1) * SHADOW.objectWidth * keep) / 2, strength: keep }, WIDTH, HEIGHT); // @math the middle column, half the width; the footprint's middle and half its width
  }
  if (a && sun) {
    const box = { x0: WIDTH, x1: -1, y0: HEIGHT, y1: -1 };
    castShadow(L, { r: { left, top, distance, picture: { w, h } }, cols: a.cols, ground: row, anchor: left + (w >> 1) }, world, sunDirection(world, sunAngle, 0), WIDTH, HEIGHT, box); // @math the middle column
    blurCast(L, box, WIDTH, HEIGHT, L.scratch);
  }
  composite(rgba, { index, mask: new Uint8Array(SIZE), L, palette: pal, width: WIDTH, effects: { shadow: 1, fog: null }, splats: [] });
  return { rgba, anchor: a, left, top, row };
}

