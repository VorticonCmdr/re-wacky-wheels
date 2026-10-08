// Where the overlays go in a wide view (Stage 4, M8 and M9: docs/enhancements.md, Stage 4 as built). The overlays (the HUD, the overhead map, the
// labels, the messages, the menus) are drawn by the game's own code on the 320 x 200 grid; a wide view's HUD layer is refW x 200, and the world
// refW x 200 reference cells drawn at s x s output pixels each.
// - 'centred' (RENDER.hudPlaces' first, the default) moves every overlay pixel right by the margin m, onto the original columns in the middle of
//   the wide picture: exact (a pixel's neighbours stay its neighbours) and it cannot tear.
// - 'edges' (M9, VIEW WIDE EDGES) moves the HUD's groups toward the picture's sides (config.js HUD_PLACE): every pixel of the 320 x 200 grid has a
//   group (`hudGroups`, measured once per HUD art from where the game's own HUD functions can draw), left (dx 0, the picture's left edge), right
//   (dx 2m, its right edge) or centre (dx m). The frame's overlays are drawn again in two parts: the HUD without the overlays that must stay whole
//   over the original's picture (the caller's base: for a race frame `raceBase`), placed by its groups (`placeFrame`), and those forced overlays
//   (the in-race menu, the message box, the crack: `raceForced` and the page's menu) centred over it, as the game draws them last. So a forced
//   overlay covers what it covers at its own place, never a hole it would cut into an element that moved away. A frame whose groups would tear an
//   element apart or put two of its pixels on one place is centred whole (`placeFrame`'s guards, counted by the enhancer: none is expected).
// At m = 0 a pixel stays where it is. The minimap's pixels that only put back the sky (index.js overlaid: mask 0) are not overlay pixels, so the
// world shows through the map wherever it goes.
import { models } from './models.js';
import { HUD_PLACE } from './config.js';
import { SENTINEL } from './composite.js';
import { drawBanner, drawPlace, drawName, drawSpeedometer, drawLapText, drawHeld, drawTimer, drawFigure, drawDuckBanner, drawMinimap } from '../render/hud.js';
import { drawDemoLogo, drawDemoText } from '../render/demo.js';
import { drawLabels, drawMessage } from '../render/finish.js';
import { drawCrack } from '../render/crack.js';
import { driverName } from '../game/sounds.js';
import { driverCount } from '../game/drivers.js';
import { lapText, timerText } from '../game/hud.js';
import { lapsTotal } from '../game/laps.js';
import { labelCount } from '../game/finish.js';
import { minimapRect } from '../game/minimap.js';
import { drawRaceOverlays } from '../render/race-frame.js';
import { touch } from '../game/pickups.js';

// The groups of the group map, by their codes (0: the centre, every pixel no footprint holds), and how many margins each moves a pixel right.
export const GROUPS = ['centre', 'left', 'right'];
const SHIFTS = GROUPS.map(g => HUD_PLACE.shift[g]);

// hudPlaces(G, groups) gives, for every pixel i = y 320 + x of the overlays' grid, `hud[i]`: its index in the HUD layer (refW x 200), and
// `world[i]`: the output pixel of the top left of its s x s block in the world (G.W x G.H), where 'picture' (the HUD in the picture) stamps it;
// every pixel moved by the margin (centred) without `groups`, else by its group's shift. Kept per geometry and group map; read, never written.
const places = new Map(), grouped = new WeakMap();
export function hudPlaces(G, groups = null) {
  const kept = groups ? (grouped.get(groups) ?? grouped.set(groups, new Map()).get(groups)) : places, known = kept.get(G.key);
  if (known) return known;
  const F = models().floor, { s, m, refW, W } = G, hud = new Int32Array(F.width * F.height), world = new Int32Array(F.width * F.height);
  for (let y = 0, i = 0; y < F.height; y++) for (let x = 0; x < F.width; x++, i++) { const dx = groups ? SHIFTS[groups[i]] * m : m; hud[i] = y * refW + x + dx; world[i] = s * y * W + s * (x + dx); }
  const out = { hud, world };
  kept.set(G.key, out);
  return out;
}

// The footprints of the HUD's elements (config.js HUD_PLACE's names): each draws, through the game's own exported functions at their reference
// places, every value it can show, with `a.art` the HUD art made opaque (every picture fills its box) and `a.world` a world whose cars are too.
// An element whose place does not depend on what it shows (the banner, the place digit, the speedometer, the timer's seven places, the duck's
// banner, the logo, DEMO MODE, the map's rectangle) is drawn once; the others with every value: every driver's name, the lap texts of every
// laps choice, the held item of every kind a car takes as its held item (pickups.js touch, over the archive's sprite catalogue), the reaction
// figure at every entry of GIG.MOV and the labels of every place.
const ELEMENTS = {
  banner: (fb, a) => drawBanner(fb, a.art, [0, 0]),
  place: (fb, a) => drawPlace(fb, a.art, 1),
  name: (fb, a) => { for (let slot = 0; slot < driverCount(); slot++) drawName(fb, a.art, driverName(slot)); },
  speedometer: (fb, a) => drawSpeedometer(fb, a.art, [0, 0]),
  lapText: (fb, a) => { for (let choice = 1; lapsTotal(choice) !== undefined; choice++) { const total = lapsTotal(choice); for (let lap = 0; lap <= total; lap++) for (const finished of [false, true]) drawLapText(fb, a.art, lapText(lap, total, finished)); } },
  minimap: fb => { const [, , w, h] = minimapRect(); drawMinimap(fb, { picture: new Uint8Array(w * h).fill(1), saved: null }, []); },
  demoLogo: (fb, a) => drawDemoLogo(fb, a.art.ofont),
  duckBanner: (fb, a) => drawDuckBanner(fb, a.art, [0, 0], [0, 0]),
  timer: (fb, a) => drawTimer(fb, a.art, timerText(0)),
  held: (fb, a) => { for (const kind of a.held) drawHeld(fb, a.art, kind); },
  figure: (fb, a) => { for (const entry of a.mov.entries) drawFigure(fb, a.art, { picture: 0 }, entry); },
  demoText: (fb, a) => drawDemoText(fb, a.art.ofont),
  labels: (fb, a) => { for (let place = 1; place <= labelCount(); place++) drawLabels(fb, a.art.ofont, a.world, [{ place, slot: 0 }]); },
};
for (const name of [...HUD_PLACE.left, ...HUD_PLACE.right]) if (!ELEMENTS[name]) throw new Error(`HUD_PLACE names '${name}', which hud-place.js cannot measure`);

const opaque = data => new Uint8Array(data.length).fill(1); // a member's copy with no transparent byte: a picture drawn from it fills its box
// The kinds a car takes as its held item (the game's own rule, pickups.js touch, asked with a car that holds nothing): the catalogue's, and the
// first such kind whatever the catalogue holds (the icon's place does not depend on the kind, so the footprint is never empty).
const nobody = { held: 0, counter: 0, throttle: 0, crashed: false, tyreState: 1 }, holds = kind => Number.isInteger(kind) && kind > 0 && touch(nobody, {}, kind).car.held === kind;
const firstHeld = () => { for (let kind = 1; kind <= 0xffff; kind++) if (holds(kind)) return [kind]; return []; }; // @math a catalogue word
const heldKinds = world => [...new Set([...firstHeld(), ...(world.sprites ?? []).map(sp => sp.kind).filter(holds)])];

// The footprint of one element (HUD_PLACE's names) as a 320 x 200 mask (1 where it can draw), for the checks and the tests; `inputs` as hudGroups'.
export function hudFootprint(name, { art, mov, world }) {
  const F = models().floor, scratch = new Uint16Array(F.width * F.height).fill(SENTINEL), a = solidInputs(art, mov, world);
  ELEMENTS[name](scratch, a);
  return Uint8Array.from(scratch, v => (v !== SENTINEL ? 1 : 0));
}
function solidInputs(art, mov, world) {
  return { art: { lap: opaque(art.lap), icons: opaque(art.icons), genef: opaque(art.genef), ofont: opaque(art.ofont), giggles: opaque(art.giggles) }, mov, world: { ...world, carFrames: { ...world.carFrames, cars: opaque(world.carFrames.cars) } }, held: heldKinds(world) };
}

// The group map of a HUD art set (render/hud.js loadHudArt), the reaction figure's GIG.MOV entries (figure.js parseMov) and a world of the archive
// (its cars' frames and shape for the labels, its sprite catalogue for the held items; every track of an archive shares them): a Uint8Array of
// 320 x 200 group codes (GROUPS). Measured on the first call, kept with the art while the entries and the cars are the same.
const measured = new WeakMap();
export function hudGroups({ art, mov, world }) {
  const cars = world.carFrames.cars, known = measured.get(art);
  if (known && known.mov === mov && known.buffer === cars.buffer && known.offset === cars.byteOffset && known.length === cars.length) return known.groups;
  const F = models().floor, size = F.width * F.height, scratch = new Uint16Array(size), groups = new Uint8Array(size), a = solidInputs(art, mov, world);
  for (const [code, names] of [[GROUPS.indexOf('left'), HUD_PLACE.left], [GROUPS.indexOf('right'), HUD_PLACE.right]]) for (const name of names) { // the right group after the left: a pixel both claim is the right's
    scratch.fill(SENTINEL); ELEMENTS[name](scratch, a);
    for (let i = 0; i < size; i++) if (scratch[i] !== SENTINEL) groups[i] = code;
  }
  measured.set(art, { mov, buffer: cars.buffer, offset: cars.byteOffset, length: cars.length, groups });
  return groups;
}

// The overlays of a race frame (render/race-frame.js drawRaceOverlays) that stay centred in the 'edges' placement, drawn as that function draws
// them, last: the finish's message box and the crash's crack. The page adds its own (the in-race menu).
export function raceForced(state, fb) {
  if (state.message) drawMessage(fb, state.hudArt.ofont, state.message);
  if (state.fx?.cracked) drawCrack(fb, state.world);
}
// The rest of a race frame's overlays (the 'edges' placement's base): drawRaceOverlays of a copy of the state without the message and the crack.
// The enhancer calls it after the frame's own overlays, so the overhead map's rectangle, kept from the race's first frame, is already there.
export const raceBase = (state, fb) => drawRaceOverlays({ ...state, message: null, fx: state.fx ? { ...state.fx, cracked: false } : state.fx }, fb);

// A scratch for placeFrame (one an enhancer): the base pixels' places and the HUD layer's places taken, stamped per frame.
export function createPlaceScratch() {
  const F = models().floor, size = F.width * F.height;
  return { hud: new Int32Array(size), world: new Int32Array(size), used: new Uint32Array(0), stamp: 0 };
}

// The places of one frame's base overlay pixels (`base`: a 320 x 200 mask) in the 'edges' placement at G by the group map `groups`. Returns
// { hud, world, guard }: the places (as hudPlaces gives them; only the base pixels' entries are the frame's), and null, or the guard that
// centres the whole frame:
// - 'tear': two base pixels side by side or one above the other of different groups (an element drawn where its footprint does not reach, or
//   two elements of different groups touching), which the placement would pull apart;
// - 'collision': two base pixels on one place of the HUD layer (a pixel of no footprint moved by m onto a group's).
// The forced overlays are placed by the caller, centred and over the base (they cover what they cover).
export function placeFrame(G, groups, base, scratch) {
  const centred = hudPlaces(G);
  if (G.m === 0) return { ...centred, guard: null };
  const F = models().floor, W = F.width, size = W * F.height, shifted = hudPlaces(G, groups);
  for (let i = 0; i < size; i++) {
    if (!base[i]) continue;
    if (((i % W) + 1 < W && base[i + 1] && groups[i + 1] !== groups[i]) || (i + W < size && base[i + W] && groups[i + W] !== groups[i])) return { ...centred, guard: 'tear' };
  }
  const places = G.refW * F.height;
  if (scratch.used.length < places) scratch.used = new Uint32Array(places);
  if (scratch.stamp >= 0xffffffff) { scratch.used.fill(0); scratch.stamp = 0; } // @math the largest 32-bit stamp: every place free again
  const stamp = ++scratch.stamp;
  for (let i = 0; i < size; i++) {
    if (!base[i]) continue;
    const h = shifted.hud[i];
    if (scratch.used[h] === stamp) return { ...centred, guard: 'collision' };
    scratch.used[h] = stamp; scratch.hud[i] = h; scratch.world[i] = shifted.world[i];
  }
  return { hud: scratch.hud, world: scratch.world, guard: null };
}
