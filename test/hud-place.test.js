// Stage 4's HUD at the edges of the wide view (M9: docs/enhancements.md, Stage 4 as built; src/enhance/hud-place.js) on synthetic art, groups and
// states, no game files: the footprints the game's HUD functions can draw (their pictures made opaque) and the group map built from them; each
// group's pixels moved by its shift of the margin (left 0, centre m, right 2m) in the HUD layer and in the world's blocks; the guards (a tear, two
// pixels on one place) centring the frame; and through the enhancer at 1x and 2x on both display shapes, with the HUD layer and in the picture:
// the base by its groups, the forced overlays centred over it (no hole where they covered a moved element), the canvas the centred frame's, the
// standard view untouched, drawOver's overlay centred over a kept edges frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hudPlaces, hudGroups, hudFootprint, placeFrame, createPlaceScratch, GROUPS, raceBase, raceForced } from '../src/enhance/hud-place.js';
import { geometryOf } from '../src/enhance/geometry.js';
import { createEnhancer } from '../src/enhance/index.js';
import { HUD_PLACE, PRESETS } from '../src/enhance/config.js';
import { models } from '../src/enhance/models.js';
import { placeBox, speedBox, timerBox, bannerPictures } from '../src/render/hud.js';
import { minimapRect } from '../src/game/minimap.js';
import { raceOf, memory } from './wide-world.js';
import { drawRaceOverlays } from '../src/render/race-frame.js';
import { defaultSettings } from '../src/game/menus.js';

const F = models().floor, SIZE = F.width * F.height, LEFT = GROUPS.indexOf('left'), RIGHT = GROUPS.indexOf('right'), CENTRE = GROUPS.indexOf('centre');
const at = (x, y) => y * F.width + x;
// HUD art of zeros (render/hud.js loadHudArt's members, long enough for every picture the HUD reads): the footprints are measured with every
// picture made opaque, so the art's own pixels do not matter.
const art = () => Object.fromEntries(['lap', 'icons', 'genef', 'ofont', 'giggles'].map(k => [k, new Uint8Array(0x10000)])); // @math more than any HUD member the functions read
const movOf = entries => ({ count: entries.length - 1, entries });
const worldOf = (sprites = []) => ({ carShape: [{ w: 38, h: 28 }], carFrames: { cars: new Uint8Array(8 * 12 * 38 * 28) }, sprites }); // @math the cars' class 0 size; 8 slots of 12 frames
const rect = ([x0, y0, w, h]) => { const m = new Uint8Array(SIZE); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && x < F.width && y >= 0 && y < F.height) m[at(x, y)] = 1; return m; };
const columns = mask => { let lo = F.width, hi = -1; mask.forEach((v, i) => { if (v) { lo = Math.min(lo, i % F.width); hi = Math.max(hi, i % F.width); } }); return [lo, hi]; };

test('the footprints: each element where the game\'s HUD functions can draw it, with every value, its pictures opaque; the group map the right group\'s over the left\'s over the centre\'s', () => {
  const a = art(), mov = movOf([{ x: -8, y: -10 }, { x: 18, y: 2 }]), world = worldOf(), inputs = { art: a, mov, world }; // @math two GIG.MOV entries far apart
  const fp = Object.fromEntries([...HUD_PLACE.left, ...HUD_PLACE.right].map(n => [n, hudFootprint(n, inputs)]));
  for (const [n, m] of Object.entries(fp)) assert.ok(m.some(Boolean), `${n} has a footprint`);
  assert.deepEqual(fp.speedometer, rect(speedBox()), 'the speedometer\'s panel'); assert.deepEqual(fp.place, rect(placeBox()), 'the place digit'); assert.deepEqual(fp.timer, rect(timerBox()), 'the timer\'s seven places'); assert.deepEqual(fp.minimap, rect(minimapRect()), 'the map\'s rectangle');
  const banner = new Uint8Array(SIZE); for (const p of bannerPictures()) rect([...p.where, ...p.size]).forEach((v, i) => { if (v) banner[i] = 1; });
  assert.deepEqual(fp.banner, banner, 'the banner\'s three pictures');
  assert.ok(fp.held.some(Boolean), 'the held item without a held kind in the catalogue: the icon\'s place does not depend on its kind');
  const moved = hudFootprint('figure', { ...inputs, mov: movOf([{ x: -8, y: -10 }]) }), other = hudFootprint('figure', { ...inputs, mov: movOf([{ x: -6, y: -10 }]) }); // @math one entry, and the same two columns on
  assert.deepEqual(columns(other), columns(moved).map(c => c + 2), 'the figure stands where its GIG.MOV entry puts it'); // @math the two columns
  for (const n of HUD_PLACE.left) assert.ok(columns(fp[n])[1] < 210, `${n} is on the left`); for (const n of HUD_PLACE.right) assert.ok(columns(fp[n])[0] > 230, `${n} is on the right`); // @math the original's HUD: the banner ends at 206, DEMO MODE starts at 232
  const groups = hudGroups(inputs);
  for (let i = 0; i < SIZE; i++) { const want = HUD_PLACE.right.some(n => fp[n][i]) ? RIGHT : HUD_PLACE.left.some(n => fp[n][i]) ? LEFT : CENTRE; if (groups[i] !== want) assert.fail(`the group of ${i % F.width},${Math.floor(i / F.width)} is ${groups[i]}, not ${want}`); }
  assert.equal(hudGroups(inputs), groups, 'kept with the art'); assert.notEqual(hudGroups({ ...inputs, mov: movOf([{ x: 0, y: 0 }]) }), groups, 'measured again for other GIG.MOV entries');
});

// A group map of three bands: the left below column 100, the right from 220, the centre between.
const bands = () => Uint8Array.from({ length: SIZE }, (_, i) => (i % F.width < 100 ? LEFT : i % F.width >= 220 ? RIGHT : CENTRE)); // @math the bands' columns

test('the places of the edges: each group\'s pixels moved by its shift of the margin, in the HUD layer and in the world\'s blocks; kept per geometry and map', () => {
  const groups = bands();
  for (const [s, m] of [[1, 53], [2, 53], [2, 18]]) { // @math the scales and margins of 4 BY 3 and 16 BY 10
    const G = geometryOf({ s, m }), P = hudPlaces(G, groups);
    assert.equal(P, hudPlaces(G, groups), 'kept'); assert.notEqual(P, hudPlaces(G), 'not the centred places');
    for (const [x, y, dx] of [[7, 5, 0], [99, 9, 0], [100, 9, m], [219, 150, m], [220, 150, 2 * m], [319, 199, 2 * m]]) { const i = at(x, y); assert.equal(P.hud[i], y * G.refW + x + dx, `${x},${y}`); assert.equal(P.world[i], s * y * G.W + s * (x + dx)); } // @math a pixel of each band and its edges; the right's two margins
  }
  const id = hudPlaces(geometryOf({ s: 1, m: 0 }), groups); assert.ok(id.hud.every((o, i) => o === i), 'no margin: every pixel where it is');
});

test('placeFrame: the base by its groups; a tear (two neighbours of different groups) or two pixels on one place centre the frame', () => {
  const groups = bands(), scratch = createPlaceScratch(), G = geometryOf({ s: 2, m: 53 }), centred = hudPlaces(G); // @math 2x on 4 BY 3
  const base = new Uint8Array(SIZE); [at(7, 5), at(150, 190), at(250, 40), at(99, 60)].forEach(i => { base[i] = 1; }); // @math a pixel of each band, one at the left band's edge
  const r = placeFrame(G, groups, base, scratch);
  assert.equal(r.guard, null);
  for (const [x, y, dx] of [[7, 5, 0], [150, 190, 53], [250, 40, 106], [99, 60, 0]]) assert.equal(r.hud[at(x, y)], y * G.refW + x + dx); // @math 0, m and 2m
  const diagonal = Uint8Array.from(base); diagonal[at(100, 61)] = 1; assert.equal(placeFrame(G, groups, diagonal, scratch).guard, null, 'a diagonal neighbour does not tear'); // @math below and right of 99,60
  for (const [x, y] of [[100, 60], [99, 61]]) { const torn = Uint8Array.from(base); torn[at(x, y)] = 1; torn[at(99, y)] = 1; if (y === 61) torn[at(100, 61)] = 1; const t = placeFrame(G, groups, torn, scratch); assert.equal(t.guard, 'tear', `${x},${y}`); assert.equal(t.hud, centred.hud, 'the frame centred'); } // @math side by side across the band's edge; one above the other there
  const one = new Uint8Array(SIZE); one[at(160, 20)] = 1; one[at(160 + 53, 20)] = 1; // @math a centre pixel and a left one m further right, with a left band there
  const wideLeft = Uint8Array.from({ length: SIZE }, (_, i) => (i % F.width >= 200 ? LEFT : CENTRE)); // @math the left band from column 200: a centre pixel at 160 moved by m lands on 213's place
  const c = placeFrame(G, wideLeft, one, scratch); assert.equal(c.guard, 'collision'); assert.equal(c.hud, centred.hud);
  assert.equal(placeFrame(geometryOf({ s: 1, m: 0 }), groups, base, scratch).guard, null, 'no margin: no guard');
});

// An enhancer's wide frame of the synthetic race (wide-world.js raceOf) with the HUD place and the frame context given; `base` and `forced` draw the
// overlays' two parts, the frame's own overlays both, the forced last.
const PALETTE = (() => { const p = new Uint8ClampedArray(1024).fill(255); for (let k = 9; k <= 14; k++) p.set([k * 10, 255 - k * 10, k], k * 4); return p; })(); // @math 256 colours, the overlays' indices 9 to 14 their own colours
const BASE = [[7, 5, 9], [30, 50, 10], [250, 40, 11], [150, 190, 13]], FORCED = [[30, 50, 12], [200, 100, 12]]; // @math a left, a right and a centre pixel and one the forced overlay covers; the forced overlay's two pixels
const put = list => (P, fb) => { for (const [x, y, v] of list) fb[at(x, y)] = v; };
function frame({ s = 1, aspect = 'dos', hudPlace = 'edges', layered = true, edges = 'given', base = BASE, view = 'wide' } = {}) {
  const enh = createEnhancer({ storage: memory() }); enh.configure({ ...PRESETS.original, smooth: true, view, hudPlace, scale: s });
  const index = new Uint8Array(SIZE), out = new Uint8ClampedArray(SIZE * 4), layers = layered ? { world: new Uint8ClampedArray(SIZE * 4), hud: new Uint8ClampedArray(SIZE * 4) } : null; // @math four bytes a colour
  const ctx = edges === 'given' ? { groups: bands(), base: put(base), forced: put(FORCED) } : null;
  enh.drawSingle(raceOf(), 1, { index, out, palette: PALETTE, mode: 1, overlays: (P, fb) => { put(base)(P, fb); put(FORCED)(P, fb); }, layers, worldReady: true, aspect, edges: ctx });
  return { enh, index, out, l: enh.layers() };
}
const colour = v => [...PALETTE.subarray(v * 4, v * 4 + 3)]; // @math three components
const hudAt = (l, X, y) => [...l.hud.data.subarray((y * l.hud.w + X) * 4, (y * l.hud.w + X) * 4 + 4)]; // @math four bytes a colour
const opaqueCount = l => { let n = 0; for (let i = 3; i < l.hud.data.length; i += 4) if (l.hud.data[i] !== 0) n++; return n; }; // @math the alpha bytes

test('through the enhancer: the base by its groups, the forced overlays centred over it with no hole, at 1x and 2x on both shapes, with the HUD layer and in the picture; the canvas the centred frame\'s', () => {
  for (const [s, aspect, m] of [[1, 'dos', 53], [2, 'dos', 53], [1, 'wide', 18], [2, 'wide', 18]]) { // @math 4 BY 3 and 16 BY 10 at 1x and 2x
    const label = `${s}x ${aspect}`, f = frame({ s, aspect }), c = frame({ s, aspect, hudPlace: 'centred' }), i = f.enh.inspect();
    assert.deepEqual([f.l.world.w, f.l.hud.w, i.hud.place, i.hud.guard], [s * (F.width + 2 * m), F.width + 2 * m, 'edges', null], label); // @math a margin either side
    const want = [[7, 5, 0, 9], [30, 50, 0, 10], [250, 40, 2 * m, 11], [150, 190, m, 13], [30, 50, m, 12], [200, 100, m, 12]]; // @math left, the covered left pixel at its own place, right, centre, the forced pixels centred
    for (const [x, y, dx, v] of want) assert.deepEqual(hudAt(f.l, x + dx, y), [...colour(v), 255], `${label}: ${x},${y} at dx ${dx}`);
    assert.equal(opaqueCount(f.l), want.length, `${label}: nothing else in the HUD layer`);
    assert.deepEqual(f.out, c.out, `${label}: the canvas (the reference view) does not move`); assert.deepEqual(f.index, c.index); assert.deepEqual(f.l.world.data, c.l.world.data, `${label}: the world under the HUD layer`);
    // The HUD in the picture: the same places as s x s blocks of the world, the canvas taken before them.
    const p = frame({ s, aspect, layered: false }), stamped = Uint8ClampedArray.from(c.l.world.data);
    for (const [x, y, dx, v] of want) for (let q = 0; q < s; q++) for (let r = 0; r < s; r++) stamped.set([...colour(v), 255], ((s * y + q) * f.l.world.w + s * (x + dx) + r) * 4); // @math four bytes a colour
    assert.deepEqual(p.l.world.data, stamped, `${label}: the picture's blocks at the edges' places, over the world`); assert.deepEqual(p.out, c.out, `${label}: the canvas in the picture`); assert.equal(p.l.hud, null);
    // drawOver (the menu of a lost race) over the kept edges frame: its overlay centred, the frame's HUD kept at its places.
    const kept = f.enh.keepLayers(), index = Uint8Array.from(f.index); index[at(60, 60)] = 14; // @math a new overlay pixel at 60,60
    const o = f.enh.drawOver({ out: new Uint8ClampedArray(SIZE * 4), base: f.out, index, palette: PALETTE, overlay: fb => put([[60, 60, 14]])(null, fb), kept, hudLayer: true }); // @math the same pixel
    assert.deepEqual(hudAt(o, 60 + m, 60), [...colour(14), 255], `${label}: drawOver's overlay centred`); for (const [x, y, dx, v] of want) assert.deepEqual(hudAt(o, x + dx, y), [...colour(v), 255], `${label}: the kept HUD`); // @math the new pixel
  }
});

test('through the enhancer: a tear centres the frame whole and is counted; no edges without a margin, without the groups or with the HUD centred', () => {
  const torn = frame({ base: [...BASE, [100, 5, 13], [99, 5, 9]] }), i = torn.enh.inspect(), m = 53; // @math a centre pixel beside a left one; 4 BY 3
  assert.deepEqual([i.hud.place, i.hud.guard, i.guards.tear], ['centred', 'tear', 1]);
  for (const [x, y] of [[7, 5], [30, 50], [250, 40], [150, 190], [200, 100]]) assert.notEqual(hudAt(torn.l, x + m, y)[3], 0, `${x},${y} centred`); // @math the alpha byte
  assert.deepEqual(hudAt(torn.l, m + 30, 50).slice(0, 3), colour(12), 'centred whole: the frame\'s own overlays, the forced pixel over the covered one'); // @math the forced colour
  const centred = frame({ hudPlace: 'centred' });
  for (const other of [frame({ edges: null }), frame({ hudPlace: 'centred', edges: 'given' })]) { assert.deepEqual(other.l.hud.data, centred.l.hud.data); assert.equal(other.enh.inspect().hud.place, 'centred'); }
  const standard = frame({ view: 'standard' }), plain = frame({ view: 'standard', edges: null }); // the standard view: the reference geometry's own path
  assert.deepEqual([standard.l.world.w, standard.l.hud.w], [F.width, F.width]); assert.deepEqual(standard.out, plain.out); assert.deepEqual(standard.l.hud.data, plain.l.hud.data);
});

test('the race frame\'s two parts: raceBase is drawRaceOverlays without the message and the crack, raceForced those two, and the base then the forced is the frame\'s overlays', () => {
  const state = { duck: { score: 12 }, hud: { counter: 3, ticks: 0 }, car: { held: 0 }, humanSlot: 7, menu: { settings: defaultSettings(1, true) }, hudArt: art(), laps: { shown: false }, figure: null, unproven: new Set(), message: { text: 'XX', x: 140, y: 100 }, fx: { cracked: true }, world: { crack: new Uint8Array(84 * 62) } }; // @math a duck game frame (no overhead map); a short message in the middle; CRACK.SP's size
  const draw = fn => { const fb = new Uint16Array(SIZE).fill(0x100); fn(fb); return fb; }; // @math the sentinel
  const all = draw(fb => drawRaceOverlays(state, fb)), base = draw(fb => raceBase(state, fb)), forced = draw(fb => raceForced(state, fb)), both = draw(fb => { raceBase(state, fb); raceForced(state, fb); });
  assert.deepEqual(both, all, 'the base, then the forced overlays: the frame\'s overlays');
  assert.ok(forced.some(v => v !== 0x100) && base.some(v => v !== 0x100), 'both parts draw'); // @math the sentinel
  assert.ok(base.every((v, i) => v === 0x100 || forced[i] === 0x100 || (i % F.width < 136 || i % F.width > 159)), 'the base draws no message box'); // @math the box's columns
  assert.equal(base[at(140, 100)], 0x100, 'nothing of the message in the base'); assert.notEqual(forced[at(140, 100)], 0x100, 'the message box in the forced part'); // @math the box's middle; the sentinel
  assert.deepEqual([state.message.text, state.fx.cracked], ['XX', true], 'the state is not changed');
});
