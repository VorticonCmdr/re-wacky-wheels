// The display (docs/enhancements.md, Stage 1): where the picture goes on the screen for each shape and scaling, the CRT pass's numbers, the settings and the
// page's GAME OPTIONS > DISPLAY OPTIONS menus. The WebGL pass itself runs only in a browser (checked there, see the docs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictureRect, windowSpace, scanlineFade, beamMean, crtUniforms, createDisplay, overlayLayers, scale2x } from '../src/enhance/display.js';
import { normalizeDisplay, isPlain, resetDisplay, changeDisplay, loadDisplay, saveDisplay, displayView, nextAspect, nextScaling, nextHud, toggleCrt, cycleCrtLevel, defaultCrtLevels, CRT_LEVELS } from '../src/enhance/display-settings.js';
import { DISPLAY, CRT, EFFECTS } from '../src/enhance/config.js';
import { normalize as normalizeGraphics, presetOf } from '../src/enhance/settings.js';
import { DISPLAY_MENU } from '../src/game/display-menu.js';
import { GRAPHICS_MENU } from '../src/game/graphics-menu.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';
import { enterMenu, stepFrame, actionAt } from '../src/game/menu.js';
import { tileOf, layoutOf } from '../src/render/menu.js';
import { firstBar, gameTopBar } from './menu-bars.js';

const settled = menu => { let m = menu; for (let i = 0; i < 8; i++) m = stepFrame(m, null).menu; return m; }; // the icons settle after a cursor move
const drawable = text => [...text].forEach(ch => tileOf(ch)); // throws on a character the menu font has no tile for
const at = (aspect, scaling) => ({ ...resetDisplay(), aspect, scaling });
const SRC = { w: 320, h: 200 }; // @math the page's canvas
const place = (w, h, settings) => pictureRect(w, h, settings, SRC);

test('whole screen pixels: square pixels use whole multiples on both axes, 4:3 whole rows, exact 5 by 6 at 1600 by 1200', () => {
  assert.deepEqual(place(1920, 1200, at('wide', 'integer')), { x: 0, y: 0, w: 1920, h: 1200, integer: true }); // @math six times 320 by 200
  assert.deepEqual(place(1919, 1200, at('wide', 'integer')), { x: 0, y: 0, w: 1919, h: 1200, integer: true }); // @math a screen pixel short (the browser's rounding of the element): still six rows
  assert.deepEqual(place(1918, 1200, at('wide', 'integer')), { x: 159, y: 100, w: 1600, h: 1000, integer: true }); // @math two pixels short: five times, centred
  assert.deepEqual(place(1600, 1200, at('dos', 'integer')), { x: 0, y: 0, w: 1600, h: 1200, integer: true }); // @math 4:3 with every pixel 5 by 6 screen pixels
  const r = place(2560, 1600, at('dos', 'integer')); // @math eight rows a picture row, the width by the shape
  assert.deepEqual(r, { x: 213, y: 0, w: 2133, h: 1600, integer: true }); // @math 1600 x 4 / 3, centred
  assert.equal(place(150, 100, at('wide', 'integer')).integer, false); // @math not even one row a picture row: fit
  assert.deepEqual(place(2561, 1599, at('wide', 'integer')), { x: 0, y: 0, w: 2560, h: 1599, integer: true }); // @math a screen row short of eight rows a picture row (a rounded full screen): still eight
  assert.deepEqual(place(2560, 1598, at('dos', 'integer')), { x: 346, y: 99, w: 1867, h: 1400, integer: true }); // @math two rows short: seven
  assert.deepEqual(place(1333, 1000, at('dos', 'integer')), { x: 0, y: 0, w: 1333, h: 1000, integer: true }); // @math five rows: the rounded width of the shape fits its own element
  assert.deepEqual(place(1332, 1000, at('dos', 'integer')), { x: 0, y: 0, w: 1332, h: 1000, integer: true }); // @math a screen pixel short (the browser's rounding): still five rows
});

test('fit fills the space with the shape, centred', () => {
  assert.deepEqual(place(1920, 1080, at('dos', 'fit')), { x: 240, y: 0, w: 1440, h: 1080, integer: false }); // @math 4:3 in 16:9
  assert.deepEqual(place(1000, 1000, at('wide', 'fit')), { x: 0, y: 187, w: 1000, h: 625, integer: false }); // @math 16:10 in a square
  for (const [w, h] of [[640, 480], [1366, 768], [333, 911]]) for (const aspect of ['wide', 'dos']) for (const scaling of ['fit', 'integer']) { // @math a few odd sizes
    const p = place(w, h, at(aspect, scaling));
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= w && p.y + p.h <= h, `${w}x${h} ${aspect} ${scaling}`);
    assert.ok(Math.abs(p.w / p.h - DISPLAY.aspects[aspect]) < 0.01, `${w}x${h} ${aspect} ${scaling}: the shape`); // @math within a hundredth
  }
});

test('the space beside the panel: the slot up to 960 pixels, the window below the picture, in screen pixels', () => {
  assert.deepEqual(windowSpace({ slotWidth: 1068, viewportHeight: 900, top: 66, dpr: 2 }, SRC), { width: 1920, height: 1636 }); // @math (900 - 66 - 16) x 2
  assert.deepEqual(windowSpace({ slotWidth: 500, viewportHeight: 120, top: 66, dpr: 1 }, SRC), { width: 500, height: 200 }); // @math at least a screen row a picture row
});

test('the CRT pass: off is a plain picture, scanlines fade out where a picture row has too few screen rows, the boost makes up the light', () => {
  assert.equal(scanlineFade(CRT.scanlines.fadeRows), 0);
  assert.equal(scanlineFade(CRT.scanlines.fullRows), 1);
  assert.ok(scanlineFade(2.75) > 0 && scanlineFade(2.75) < 1); // @math between the two
  const mean = beamMean(); assert.ok(mean > 0.6 && mean < 0.75, String(mean)); // @math a beam of 0.3 rows lights about two thirds of its row
  assert.ok(beamMean(0.5) > mean); // @math a wider beam lights more
  assert.deepEqual(crtUniforms(resetDisplay(), { h: 1200 }, SRC), { crt: 0, scan: 0, scanGain: 1, glow: 0, bulge: 0, vignette: 0, corner: 0 }); // @math a tall picture
  const on = crtUniforms({ ...resetDisplay(), crt: true }, { h: 1200 }, SRC); // @math six screen rows a picture row
  assert.equal(on.scan, DISPLAY.defaults.scanlines * CRT.scanlines.depth);
  assert.ok(on.scanGain > 1);
  assert.equal(on.glow, DISPLAY.defaults.glow * CRT.glow.gain);
  assert.equal(crtUniforms({ ...resetDisplay(), crt: true }, { h: 300 }, SRC).scan, 0); // @math a row and a half a picture row: no scanlines
});

test('the settings: 4:3 and no curvature by default, square pixels with fit and no CRT look the page as it was, the levels in twentieths, the store survives a broken entry, and they stay apart from the graphics', () => {
  assert.deepEqual(resetDisplay(), DISPLAY.defaults);
  assert.equal(resetDisplay().aspect, 'dos'); assert.equal(resetDisplay().curvature, 0); assert.equal(resetDisplay().crt, false);
  assert.ok(!isPlain(resetDisplay())); // the default 4:3 is drawn by the graphics card
  const plain = { ...resetDisplay(), ...DISPLAY.plain };
  assert.ok(isPlain(plain));
  assert.ok(!isPlain(changeDisplay(plain, 'aspect', 'dos')));
  assert.ok(!isPlain(changeDisplay(plain, 'crt', true)));
  assert.deepEqual(normalizeDisplay({ aspect: 'tv', scaling: 'zoom', crt: 'yes', glow: 7, scanlines: 0.33, extra: 1 }), { ...DISPLAY.defaults, glow: 1, scanlines: 0.35 }); // @math clamped to 1; 0.33 to the nearest twentieth
  const kept = new Map(), storage = { getItem: k => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, v) };
  saveDisplay({ ...resetDisplay(), aspect: 'dos', crt: true }, storage);
  assert.deepEqual(loadDisplay(storage), { ...DISPLAY.defaults, aspect: 'dos', crt: true });
  kept.set(DISPLAY.storageKey, '{broken'); assert.deepEqual(loadDisplay(storage), DISPLAY.defaults);
  kept.set(DISPLAY.storageKey, JSON.stringify({ aspect: ['dos'], scaling: ['integer'] })); assert.deepEqual(loadDisplay(storage), DISPLAY.defaults); // values of another type are dropped
  for (const aspect of ['__proto__', 'constructor', 'toString']) assert.equal(normalizeDisplay({ aspect }).aspect, DISPLAY.defaults.aspect);
  assert.ok(isPlain(changeDisplay(plain, 'scaling', 'fit')) && !isPlain(changeDisplay(plain, 'scaling', 'integer')));
  assert.ok(!EFFECTS.includes('crt'));
  const graphics = normalizeGraphics({ crt: true, aspect: 'dos', scaling: 'integer' });
  assert.equal(presetOf(graphics), 'original'); // the CRT look is no effect of a preset: Original with the CRT look is still Original
  assert.ok(!('crt' in graphics));
});

test('DISPLAY OPTIONS is a line of DISPLAY AND EFFECTS, before LEAVE THIS MENU, and not of GAME OPTIONS; the display lists stand below the logo', () => {
  const settings = defaultSettings(1, true), graphics = menuDef('graphics', settings), i = graphics.items.indexOf(DISPLAY_MENU.item);
  assert.equal(i, graphics.items.length - 2);
  assert.deepEqual(graphics.actions[i], { open: 'display' });
  assert.ok(!menuDef('options', settings).items.includes(DISPLAY_MENU.item));
  assert.equal(menuDef('options', settings).items.at(-2), GRAPHICS_MENU.item);
  assert.equal(gameTopBar(), 76); // @math the main menu and the six-line FAMOUS DRIVERS lists: the logo ends on row 75
  for (const id of ['graphics', 'display', 'crtLevels']) assert.ok(firstBar(id, { ...settings, display: displayView(resetDisplay()) }) >= gameTopBar(), `${id}: the first bar stands no higher than the game's own lists put theirs`);
});

test('the display lists show the page\'s words in the menu font and hand Enter\'s choice to the page', () => {
  const settings = { ...defaultSettings(1, true), display: displayView({ ...resetDisplay(), aspect: 'dos', crt: true }, { fullscreen: true }) };
  const def = menuDef('display', settings);
  assert.deepEqual(def.items, ['SCALING'.padEnd(17) + 'FIT', 'ASPECT'.padEnd(14) + '4 BY 3', 'FULL SCREEN'.padEnd(17) + 'ON ', 'CRT LOOK'.padEnd(17) + 'ON ', 'CRT AND HUD', 'LEAVE THIS MENU']); // @math the width less the words' lengths
  assert.deepEqual(def.actions.slice(0, 4), [{ display: { scaling: true } }, { display: { aspect: true } }, { display: { fullscreen: true } }, { display: { crt: true } }]);
  const levels = menuDef('crtLevels', settings);
  assert.deepEqual(levels.items.slice(0, 3), ['SCANLINES'.padEnd(18) + '50', 'GLOW'.padEnd(18) + '25', 'CURVATURE'.padEnd(17) + 'OFF']); // @math the defaults in percent, the curvature off
  assert.deepEqual(levels.items.slice(3), ['HUD'.padEnd(13) + 'PICTURE', 'DEFAULT LEVELS', 'LEAVE THIS MENU']); // @math the width less the word's length
  assert.deepEqual(levels.actions.slice(0, 5), [...CRT_LEVELS.map(k => ({ display: { level: k } })), { display: { hud: true } }, { display: { defaultLevels: true } }]);
  assert.equal(menuDef('crtLevels', { ...settings, display: displayView({ ...resetDisplay(), hud: 'smooth' }, { crtReady: false }) }).items[3], 'HUD'.padEnd(13) + 'PICTURE'); // @math no WebGL 2: the HUD stays in the picture
  const none = menuDef('display', { ...settings, display: displayView({ ...resetDisplay(), crt: true }, { crtReady: false }) });
  assert.equal(none.items[3], 'CRT LOOK'.padEnd(16) + 'NONE'); // @math no WebGL 2: no CRT look
  for (const items of [def.items, levels.items, none.items, menuDef('display', defaultSettings(1, true)).items]) { items.forEach(drawable); assert.ok(items.every(t => t.length <= DISPLAY_MENU.width)); assert.ok(layoutOf('sub', items).y0 >= gameTopBar()); }
  let menu = settled(enterMenu('display', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 5 }, { id: 'graphics', cursor: 5 }], settings)); // @math the cursors of GAME OPTIONS, DISPLAY AND EFFECTS and DISPLAY OPTIONS
  for (let k = 0; k < 2; k++) menu = settled(stepFrame(menu, 'down').menu); // @math the third line, FULL SCREEN
  assert.deepEqual(actionAt(menu), { display: { fullscreen: true } }); // what the page's key handler asks before the menu's pass reads Enter
  assert.deepEqual(stepFrame(menu, 'enter').chosen, { display: { fullscreen: true } });
});

test('the lines change the settings: the scaling and the shape go round, the CRT look flips, a level goes up a quarter, the default levels', () => {
  const s = resetDisplay();
  assert.equal(nextScaling(s).scaling, 'integer'); assert.equal(nextScaling(nextScaling(s)).scaling, 'fit');
  assert.equal(nextAspect(s).aspect, 'wide'); assert.equal(nextAspect(nextAspect(s)).aspect, 'dos');
  assert.equal(toggleCrt(s).crt, true);
  assert.deepEqual([nextHud(s).hud, nextHud(nextHud(s)).hud, nextHud(nextHud(nextHud(s))).hud], ['crisp', 'smooth', 'picture']);
  assert.equal(normalizeDisplay({ hud: 'toString' }).hud, 'picture');
  assert.ok(isPlain({ aspect: 'wide', scaling: 'fit', crt: false }) && !isPlain({ aspect: 'wide', scaling: 'fit', crt: false, hud: 'crisp' }), 'a HUD layer needs the graphics card');
  const seq = [s]; for (let k = 0; k < 4; k++) seq.push(cycleCrtLevel(seq.at(-1), 'scanlines')); // @math four presses
  assert.deepEqual(seq.map(x => x.scanlines), [0.5, 0.75, 1, 0, 0.25]);
  assert.equal(displayView(changeDisplay(s, 'glow', 0)).levels.glow, 'OFF');
  assert.deepEqual(defaultCrtLevels({ ...s, glow: 1, curvature: 1, crt: true }), { ...s, crt: true }); // the curvature back to off
});

// A page made of stubs, enough for createDisplay's choice of how the picture is shown (no drawing): `webgl` is 'none' (no WebGL 2 in the browser)
// or 'fails' (WebGL 2 is there, but no context can be made). Returns the display, the source canvas, how many contexts were asked for and how often onChange was called.
function stubPage({ webgl }) {
  const saved = {}, set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  let asked = 0, changes = 0;
  const element = extra => ({ style: {}, hidden: false, width: 300, height: 150, classList: { toggle() {} }, setAttribute() {}, getAttribute: () => null, addEventListener() {}, getBoundingClientRect: () => ({ top: 66, width: 960, height: 600 }), ...extra }); // @math a canvas's default size and a plausible box
  const canvas = element({ getContext: () => { asked += 1; return null; } }); // no context is ever made here: whether the browser has WebGL 2 at all is WebGL2RenderingContext
  set('document', { createElement: () => canvas, fullscreenElement: null, fullscreenEnabled: true, addEventListener() {} });
  set('addEventListener', () => {}); set('innerHeight', 900); set('scrollY', 0); set('devicePixelRatio', 2); set('ResizeObserver', undefined); // @math a window
  set('WebGL2RenderingContext', webgl === 'none' ? undefined : function WebGL2RenderingContext() {});
  const source = element({ width: 320, height: 200 }), host = element({ append() {}, parentElement: { clientWidth: 1068 } }); // @math the page's canvas and slot
  const display = createDisplay({ source, host, onChange: () => { changes += 1; } });
  return { display, source, asked: () => asked, changes: () => changes, restore: () => { for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } } };
}

test('the display: the page as it was never asks for a WebGL context; the default 4:3 or another setting that needs one asks once; a CRT look the browser cannot show leaves the page as it was', () => {
  const plain = { ...resetDisplay(), ...DISPLAY.plain }, page = stubPage({ webgl: 'none' });
  try {
    page.display.configure(plain);
    assert.equal(page.display.stats().mode, 'plain'); assert.equal(page.asked(), 0); assert.equal(page.display.stats().started, false);
    assert.equal(page.display.crtReady(), false); // no WebGL 2 at all: the menu says NONE before anything is tried
    page.display.configure({ ...plain, crt: true });
    assert.equal(page.display.stats().mode, 'plain', 'the CRT look cannot be shown: the page keeps its layout'); assert.equal(page.asked(), 0);
    assert.equal(page.source.style.width, '');
    page.display.configure({ ...plain, hud: 'smooth' });
    assert.equal(page.display.stats().mode, 'plain', 'a HUD layer that cannot be shown: the page keeps its layout'); assert.equal(page.asked(), 0); assert.equal(page.display.hudLayer(), false);
    page.display.configure(resetDisplay()); // the default, 4:3
    assert.equal(page.display.stats().mode, 'css'); assert.equal(page.asked(), 1); assert.equal(page.changes(), 1); // tried once, the page told
    assert.ok(page.source.style.width.endsWith('px'));
    page.display.configure({ ...resetDisplay(), aspect: 'dos', scaling: 'integer' });
    assert.equal(page.asked(), 1); // not asked again
  } finally { page.restore(); }
  const has = stubPage({ webgl: 'fails' }); // the browser has WebGL 2, but no context can be made (a blocked graphics card)
  try {
    has.display.configure(plain);
    assert.equal(has.display.crtReady(), true); assert.equal(has.asked(), 0); // before it is needed, the CRT look counts as available
    has.display.configure({ ...plain, crt: true });
    assert.equal(has.asked(), 1); assert.equal(has.display.crtReady(), false); assert.equal(has.display.stats().mode, 'plain'); // tried, failed, back to the page as it was
    assert.match(has.display.stats().failure, /WebGL 2/);
    has.display.configure({ ...plain, hud: 'crisp' });
    assert.equal(has.display.stats().mode, 'plain', 'nor a HUD layer'); assert.equal(has.display.hudLayer(), false);
  } finally { has.restore(); }
});

test('the HUD layer: the world under the overlays and the overlays alone, from indexed pictures; Scale2x keeps straight edges and smooths diagonals', () => {
  const palette = new Uint8ClampedArray(1024); palette.set([10, 20, 30, 255], 4); palette.set([200, 100, 50, 255], 8); // @math 256 colours of four bytes; colour 1 the world, colour 2 an overlay
  const under = new Uint8Array(4).fill(1), index = Uint8Array.from([1, 2, 1, 2]), sentinel = Uint16Array.from([0x100, 2, 0x100, 0x100]); // @math four pixels: the second and fourth carry colour 2, only the second drawn by the overlays
  const layers = overlayLayers({ world: new Uint8ClampedArray(16), hud: new Uint8ClampedArray(16) }, { under, index, sentinel, blank: 0x100, palette }); // @math four pixels of four bytes
  assert.deepEqual([...layers.world], [10, 20, 30, 255, 10, 20, 30, 255, 10, 20, 30, 255, 200, 100, 50, 255]); // @math the world under the overlay; the fourth pixel is the world's own colour 2
  assert.deepEqual([...layers.hud], [0, 0, 0, 0, 200, 100, 50, 255, 0, 0, 0, 0, 0, 0, 0, 0]); // @math the overlay alone, nothing (premultiplied) elsewhere
  const O = [255, 255, 255, 255], _ = [0, 0, 0, 0], img = (rows) => Uint8ClampedArray.from(rows.flat(2)); // @math an opaque and a transparent pixel
  const line = scale2x(img([[O, O, O], [O, O, O], [_, _, _]]), 3, 3); // @math a straight edge
  assert.deepEqual([...line.subarray(4 * 6 * 3, 4 * 6 * 4)], [...img([[O, O, O, O, O, O]])]); // @math the edge's last row stays whole
  assert.deepEqual([...line.subarray(4 * 6 * 4, 4 * 6 * 5)], [...img([[_, _, _, _, _, _]])]); // @math and the row below it empty
  const diagonal = scale2x(img([[O, _], [O, O]]), 2, 2); // @math a step
  assert.deepEqual([...diagonal.subarray(4 * 4 * 1 + 4 * 2, 4 * 4 * 1 + 4 * 3)], O); // @math the corner of the step is filled in, as EPX does
  assert.deepEqual([...diagonal.subarray(4 * 2, 4 * 4)], [..._, ..._]); // @math the top right pixel's top half stays empty
});
