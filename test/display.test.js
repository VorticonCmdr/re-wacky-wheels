// The display (docs/enhancements.md, Stage 1): where the picture goes on the screen for each shape and scaling, the CRT pass's numbers, the settings and the
// page's GAME OPTIONS > DISPLAY OPTIONS menus. The WebGL pass itself runs only in a browser (checked there, see the docs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pictureRect, windowSpace, scanlineFade, beamMean, crtUniforms, createDisplay, overlayLayers, scale2x, layerParts, textureSizes } from '../src/enhance/display.js';
import { normalizeDisplay, isPlain, resetDisplay, changeDisplay, loadDisplay, saveDisplay, displayView, nextAspect, nextScaling, nextHud, toggleCrt, cycleCrtLevel, CRT_LEVELS } from '../src/enhance/display-settings.js';
import { DISPLAY, CRT, EFFECTS, RENDER_MENU } from '../src/enhance/config.js';
import { normalize as normalizeGraphics, presetOf, menuView, resetSettings, change as changeGraphics, cycleRender, isRenderChoice } from '../src/enhance/settings.js';
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
  assert.deepEqual(def.items, ['SCALING'.padEnd(17) + 'FIT', 'ASPECT'.padEnd(14) + '4 BY 3', 'FULL SCREEN'.padEnd(17) + 'ON ', 'CRT AND HUD', 'RENDERING', 'LEAVE THIS MENU']); // @math the width less the words' lengths
  assert.deepEqual(def.actions.slice(0, 5), [{ display: { scaling: true } }, { display: { aspect: true } }, { display: { fullscreen: true } }, { open: 'crtLevels' }, { open: 'rendering' }]);
  const levels = menuDef('crtLevels', settings);
  assert.deepEqual(levels.items.slice(0, 4), ['CRT LOOK'.padEnd(17) + 'ON ', 'SCANLINES'.padEnd(18) + '50', 'GLOW'.padEnd(18) + '25', 'CURVATURE'.padEnd(17) + 'OFF']); // @math the CRT look (moved here in Stage 4), the defaults in percent, the curvature off
  assert.deepEqual(levels.items.slice(4), ['HUD'.padEnd(13) + 'PICTURE', 'LEAVE THIS MENU']); // @math the width less the word's length; DEFAULT LEVELS left the list in Stage 4
  assert.deepEqual(levels.actions.slice(0, 5), [{ display: { crt: true } }, ...CRT_LEVELS.map(k => ({ display: { level: k } })), { display: { hud: true } }]);
  assert.equal(levels.items.length, 6); assert.equal(def.items.length, 6); // @math CRT AND HUD and DISPLAY OPTIONS full at six lines (Stage 4's RENDERING took DISPLAY OPTIONS' free line)
  assert.equal(menuDef('crtLevels', { ...settings, display: displayView({ ...resetDisplay(), hud: 'smooth' }, { crtReady: false }) }).items[4], 'HUD'.padEnd(13) + 'PICTURE'); // @math no WebGL 2: the HUD stays in the picture
  const none = menuDef('crtLevels', { ...settings, display: displayView({ ...resetDisplay(), crt: true }, { crtReady: false }) });
  assert.equal(none.items[0], 'CRT LOOK'.padEnd(16) + 'NONE'); // @math no WebGL 2: no CRT look
  assert.deepEqual(none.actions[0], { display: { crt: true } }); // the page does nothing with it without WebGL 2 (play.js chooseItem)
  for (const items of [def.items, levels.items, none.items, menuDef('display', defaultSettings(1, true)).items, menuDef('crtLevels', defaultSettings(1, true)).items]) { items.forEach(drawable); assert.ok(items.every(t => t.length <= DISPLAY_MENU.width)); assert.ok(layoutOf('sub', items).y0 >= gameTopBar()); }
  let menu = settled(enterMenu('display', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 5 }, { id: 'graphics', cursor: 5 }], settings)); // @math the cursors of GAME OPTIONS, DISPLAY AND EFFECTS and DISPLAY OPTIONS
  for (let k = 0; k < 2; k++) menu = settled(stepFrame(menu, 'down').menu); // @math the third line, FULL SCREEN
  assert.deepEqual(actionAt(menu), { display: { fullscreen: true } }); // what the page's key handler asks before the menu's pass reads Enter
  assert.deepEqual(stepFrame(menu, 'enter').chosen, { display: { fullscreen: true } });
  menu = settled(stepFrame(menu, 'down').menu); // the fourth line, CRT AND HUD
  const opened = settled(stepFrame(menu, 'enter').menu);
  assert.equal(opened.id, 'crtLevels');
  assert.deepEqual(stepFrame(opened, 'enter').chosen, { display: { crt: true } }); // CRT LOOK, its first line, switches the look as it did from DISPLAY OPTIONS
});

test('the lines change the settings: the scaling and the shape go round, the CRT look flips, a level goes up a quarter and so reaches its default', () => {
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
  const glow = [changeDisplay(s, 'glow', 1)]; for (let k = 0; k < 2; k++) glow.push(cycleCrtLevel(glow.at(-1), 'glow')); // @math two presses from full
  assert.deepEqual(glow.map(x => x.glow), [1, 0, DISPLAY.defaults.glow]); // the quarter steps reach every default level (DEFAULT LEVELS left the menu; the panel keeps Reset display)
  assert.deepEqual(toggleCrt(toggleCrt(s)), s);
});

// A WebGL 2 context that draws nothing and logs every call ([name, ...arguments]): shaders compile, programs link, a uniform's location is its
// name and a created object is a fresh { id }.
function recordingGl(log, fault = {}) {
  let made = 0;
  return new Proxy({}, { get(_, k) {
    if (typeof k !== 'string') return undefined;
    if (/^[A-Z0-9_]+$/.test(k)) return k; // a constant
    if (k === 'getShaderParameter' || k === 'getProgramParameter') return () => true;
    if (k === 'getUniformLocation') return (p, name) => name;
    if (k.startsWith('create')) return () => ({ id: ++made });
    return (...args) => { if (fault.method === k) throw new Error(fault.message); log.push([k, ...args]); };
  } });
}
// The sizes the log's texImage2D calls gave each texture ([texture id, w, h], in order) and the values of a uniform.
const defined = log => { let bound = null; const out = []; for (const [k, ...a] of log) { if (k === 'bindTexture') bound = a[1]; if (k === 'texImage2D') out.push([bound.id, a[3], a[4]]); } return out; }; // @math texImage2D's width and height
const uniform = (log, name) => log.filter(([k, at]) => k.startsWith('uniform') && at === name).map(([, , ...v]) => (v.length === 1 ? v[0] : v));

// A page made of stubs, enough for createDisplay's choice of how the picture is shown: `webgl` is 'none' (no WebGL 2 in the browser), 'fails'
// (WebGL 2 is there, but no context can be made) or 'works' (a context that logs its calls into `gl`). Returns the display, the source canvas, how
// many contexts were asked for, how often onChange was called and the context's log.
function stubPage({ webgl, fault = {} }) {
  const saved = {}, set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  let asked = 0, changes = 0;
  const gl = [], element = extra => ({ style: {}, hidden: false, width: 300, height: 150, classList: { toggle() {} }, setAttribute() {}, getAttribute: () => null, addEventListener() {}, getBoundingClientRect: () => ({ top: 66, width: 960, height: 600 }), ...extra }); // @math a canvas's default size and a plausible box
  const canvas = element({ getContext: () => { asked += 1; return webgl === 'works' ? recordingGl(gl, fault) : null; } }); // with 'none' and 'fails' no context is ever made: whether the browser has WebGL 2 at all is WebGL2RenderingContext
  set('document', { createElement: () => canvas, fullscreenElement: null, fullscreenEnabled: true, addEventListener() {} });
  set('addEventListener', () => {}); set('innerHeight', 900); set('scrollY', 0); set('devicePixelRatio', 2); set('ResizeObserver', undefined); // @math a window
  set('WebGL2RenderingContext', webgl === 'none' ? undefined : function WebGL2RenderingContext() {});
  const source = element({ width: 320, height: 200 }), host = element({ append() {}, parentElement: { clientWidth: 1068 } }); // @math the page's canvas and slot
  const errors = [];
  const display = createDisplay({ source, host, onChange: () => { changes += 1; }, onError: message => errors.push(message) });
  return { display, source, gl, errors, asked: () => asked, changes: () => changes, restore: () => { for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } } };
}

test('failed upload, lazy 3D shader or draw falls back once and allows subsequent frames and settings changes', () => {
  for (const method of ['texSubImage2D', 'shaderSource', 'drawArrays']) {
    const fault = {}, page = stubPage({ webgl: 'works', fault });
    try {
      page.display.setRendering({ voxels: true });
      assert.equal(page.display.worldReady(), true);
      fault.method = method; fault.message = `Forced ${method} failure`;
      const layers = { world: new Uint8ClampedArray(320 * 200 * 4), voxelFrame: { scene: {} } };
      assert.doesNotThrow(() => page.display.present(true, method === 'shaderSource' ? layers : null));
      assert.equal(page.display.worldReady(), false);
      assert.equal(page.display.hudLayer(), false);
      assert.equal(page.source.hidden, false);
      assert.equal(page.display.canvas.hidden, true);
      assert.equal(page.display.stats().failure, fault.message);
      assert.deepEqual(page.errors, [fault.message]);
      const calls = page.gl.length;
      assert.doesNotThrow(() => {
        page.display.present(true, layers);
        page.display.configure(resetDisplay());
        page.display.setRendering({ voxels: false });
        page.display.present();
        page.display.fail(new Error('secondary failure'));
      });
      assert.equal(page.gl.length, calls, 'never retries the broken GPU');
      assert.equal(page.asked(), 1);
      assert.deepEqual(page.errors, [fault.message], 'keeps the first actionable error');
    } finally { page.restore(); }
  }
});

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

test('the display takes a race screen\'s layers as two arrays or as objects with their sizes (Stage 4), still at the canvas\'s size only', () => {
  const size = { w: 4, h: 2 }, world = new Uint8ClampedArray(32).fill(7), hud = new Uint8ClampedArray(32).fill(9); // @math four by two pixels of four bytes
  const bare = layerParts({ world, hud }, size), framed = layerParts({ world: { data: world, w: 4, h: 2 }, hud: { data: hud, w: 4, h: 2 }, logical: { w: 4, h: 2 } }, size); // @math the same size
  for (const p of [bare, framed]) { assert.deepEqual([p.w, p.h], [4, 2]); assert.ok(p.world instanceof Uint8Array && p.world.buffer === world.buffer); assert.ok(p.hud.buffer === hud.buffer); assert.deepEqual(p.logical, { w: 4, h: 2 }); } // @math the canvas's size; the bytes themselves, not a copy
  assert.equal(layerParts({ world: { data: world, w: 4, h: 2 }, hud: null, logical: { w: 4, h: 2 } }, size).hud, null); // @math no HUD layer: the world alone
  const twice = layerParts({ world: { data: new Uint8ClampedArray(128), w: 8, h: 4 }, hud: { data: hud, w: 4, h: 2 }, logical: { w: 4, h: 2 } }, size); // @math a world of twice the size (Stage 4: RESOLUTION 2X), the HUD at the picture's
  assert.deepEqual([twice.w, twice.h, twice.hw, twice.hh, twice.logical], [8, 4, 4, 2, { w: 4, h: 2 }]); // @math the world's size, the HUD's, the logical picture's
  assert.throws(() => layerParts({ world: { data: new Uint8ClampedArray(96), w: 6, h: 4 }, hud: null, logical: { w: 4, h: 2 } }, size), /not a whole multiple/); // @math one and a half times the width, twice the height
  assert.throws(() => layerParts({ world: { data: new Uint8ClampedArray(16), w: 4, h: 2 }, hud: null }, size), /16 bytes/); // @math too few bytes for its size
  assert.deepEqual(textureSizes(640, 400, 320, 200), { src: [640, 400], glow: [[640, 400], [640, 400]], hud: [[320, 200], [640, 400], [1280, 800]] }); // @math the world's textures at its size, the HUD's at its own, twice and four times it
});

test('Stage 4: the picture\'s place from its logical size; whole screen pixels on the s x 200 grid while the world is drawn at s times the samples', () => {
  for (const [w, h] of [[1920, 1080], [1600, 1200], [1366, 768]]) for (const aspect of ['wide', 'dos']) for (const scaling of ['fit', 'integer']) assert.deepEqual(pictureRect(w, h, at(aspect, scaling), SRC, 200), place(w, h, at(aspect, scaling)), 'the 320 x 200 picture: the ratio and the rows as before'); // @math a few screens; the reference rows
  const wide = pictureRect(1920, 1080, at('dos', 'fit'), { w: 426, h: 200 }); // @math a picture with 53 columns of margin a side
  assert.ok(Math.abs(wide.w / wide.h - (4 / 3) * (426 / 320)) < 0.01, 'a wider picture keeps the shape\'s height'); // @math 4:3 times the extra columns; within a hundredth
  const one = place(1920, 1080, at('dos', 'integer')), two = pictureRect(1920, 1080, at('dos', 'integer'), SRC, 400); // @math a 1080-row screen; 2x counts 400 rows whole
  assert.deepEqual([one.h, two.h], [1000, 800]); // @math five reference rows a row at 1x; two 2x rows of two screen rows each, so the picture is smaller there
  assert.equal(two.h % 400, 0); assert.ok(two.integer); // @math whole multiples of 400 screen rows
  assert.deepEqual(pictureRect(1600, 1200, at('dos', 'integer'), SRC, 400), place(1600, 1200, at('dos', 'integer'))); // @math 1200 rows are three 2x rows as they are six reference rows
  assert.equal(crtUniforms({ ...resetDisplay(), crt: true }, { h: 1200 }, SRC).scan, crtUniforms({ ...resetDisplay(), crt: true }, { h: 1200 }, { w: 320, h: 200 }).scan, 'the scanlines fade by the logical rows, whatever the world\'s'); // @math the same 200 lines
});

test('Stage 4: setRendering starts the graphics card from plain display settings (no deadlock), the page as it was never shows 2x, and without WebGL 2 the page stays as it was', () => {
  const plain = { ...resetDisplay(), ...DISPLAY.plain }, page = stubPage({ webgl: 'works' });
  try {
    page.display.configure(plain);
    assert.equal(page.display.stats().mode, 'plain'); assert.equal(page.asked(), 0); assert.equal(page.display.worldReady(), false); // 1x: the page as it was, no context
    page.display.setRendering({ scale: 2 }); // @math the stored RESOLUTION 2X
    assert.equal(page.display.stats().mode, 'gl', 'from plain settings the graphics card starts'); assert.equal(page.asked(), 1); assert.equal(page.display.worldReady(), true);
    for (const s of [plain, { ...plain, scaling: 'integer' }, resetDisplay()]) { page.display.configure(s); assert.equal(page.display.stats().mode, 'gl', 'never the page as it was at 2x'); }
    page.display.configure(plain); page.display.setRendering({ scale: 1 });
    assert.equal(page.display.stats().mode, 'plain'); assert.equal(page.display.worldReady(), false); // back at 1x: the page as it was again
  } finally { page.restore(); }
  const none = stubPage({ webgl: 'none' });
  try {
    none.display.configure(plain); none.display.setRendering({ scale: 2 }); // @math 2x stored, no WebGL 2
    assert.equal(none.display.stats().mode, 'plain', 'no WebGL 2: the page as it was (the world drawn at 1x)'); assert.equal(none.display.worldReady(), false);
    none.display.configure(resetDisplay()); assert.equal(none.display.stats().mode, 'css'); assert.equal(none.display.worldReady(), false);
    assert.equal(menuView(changeGraphics(resetSettings(), 'scale', 2), { worldReady: none.display.crtReady() }).render.scale, RENDER_MENU.none); // @math RESOLUTION says NONE
  } finally { none.restore(); }
});

test('Stage 4: the textures follow the layers\' sizes (made again on a change, replaced in place otherwise), one scanline a logical row, the glow at the world\'s scale, whole rows of 400', () => {
  const page = stubPage({ webgl: 'works' });
  try {
    page.display.setRendering({ scale: 2 }); page.display.configure({ ...resetDisplay(), crt: true, hud: 'crisp', scaling: 'integer' }); // @math 2x, the CRT look with its glow, a crisp HUD layer
    const log = page.gl, world = { data: new Uint8ClampedArray(640 * 400 * 4), w: 640, h: 400 }, hud = { data: new Uint8ClampedArray(320 * 200 * 4), w: 320, h: 200 }, logical = { w: 320, h: 200 }; // @math the 2x world, the HUD at the picture's size
    const made = defined(log).length; // the textures made with the context, at the canvas's size
    assert.deepEqual(defined(log).map(([, w, h]) => [w, h]), [[320, 200], [320, 200], [320, 200], [320, 200], [640, 400], [1280, 800]]); // @math the picture, the glow's two, the HUD at its size, twice and four times it
    log.length = 0; page.display.present(true, { world, hud, logical });
    assert.deepEqual(defined(log).map(([, w, h]) => [w, h]), [[640, 400], [640, 400], [640, 400]], 'the picture and the glow made again at the world\'s size, the HUD kept'); // @math 2x
    assert.deepEqual(uniform(log, 'uLines'), [200]); assert.deepEqual(uniform(log, 'uSrcSize'), [[640, 400]]); // @math one beam a game line; the world's size
    assert.deepEqual(uniform(log, 'uSigma'), [CRT.glow.radius * 2]); assert.deepEqual(uniform(log, 'uTaps'), [CRT.glow.taps * 2]); // @math the glow's radius and taps in the world's pixels
    assert.ok(log.some(([k, , , , , w, h]) => k === 'texSubImage2D' && w === 640 && h === 400), 'the world uploaded at its size'); // @math texSubImage2D's width and height
    log.length = 0; page.display.present(true, { world, hud, logical });
    assert.deepEqual(defined(log), [], 'the same size: replaced in place');
    const st = page.display.stats();
    assert.deepEqual([st.world, st.hud, st.logical], [{ w: 640, h: 400 }, { w: 320, h: 200 }, logical]); // @math the sizes the display shows
    assert.ok(st.rect.integer && st.rect.h % 400 === 0, `whole multiples of 400 rows: ${st.rect.h}`); // @math s x 200
    log.length = 0; page.display.present(true, null);
    assert.deepEqual(defined(log).map(([, w, h]) => [w, h]), [[320, 200], [320, 200], [320, 200]], 'the canvas: back to its size'); // @math the menus and cards, 320 x 200
    assert.ok(made >= 6); // @math the six textures
    page.display.configure({ ...resetDisplay(), hud: 'picture' }); log.length = 0;
    page.display.present(true, { world, hud: null, logical }); // the HUD stamped into the world ('picture')
    assert.ok(log.some(([k, , , , , w]) => k === 'texSubImage2D' && w === 640), 'with the HUD in the picture the world layer is shown'); // @math texSubImage2D's width
  } finally { page.restore(); }
});

test('Stage 4: the wide view stored lays the element out for the widest picture (426 x 200 on 4:3, 356 on 16:10), a wide frame fills it, a 320-wide screen is pillarboxed in it at the same height, no deadlock from plain settings', () => {
  const page = stubPage({ webgl: 'works' });
  try {
    page.display.configure({ ...resetDisplay(), ...DISPLAY.plain }); assert.equal(page.display.stats().mode, 'plain');
    page.display.setRendering({ scale: 1, wide: true }); // the stored VIEW WIDE at 1x
    assert.equal(page.display.stats().mode, 'gl', 'the graphics card starts from plain settings'); assert.equal(page.display.worldReady(), true);
    for (const [aspect, w] of [['dos', 426], ['wide', 356]]) for (const scaling of ['fit', 'integer']) { // @math 53 and 18 columns a side
      page.display.configure({ ...resetDisplay(), aspect, scaling });
      assert.deepEqual(page.display.stats().element, { w, h: 200 }, `the element for ${aspect}`); // @math the logical rows
      const canvas = { w: page.display.stats().width, h: page.display.stats().height };
      page.display.present(true, { world: { data: new Uint8ClampedArray(w * 200 * 4), w, h: 200 }, hud: null, logical: { w, h: 200 } }); // @math a wide frame; four bytes a colour
      const wide = page.display.stats().rect;
      assert.ok(Math.abs(wide.w - canvas.w) <= 1 && Math.abs(wide.h - canvas.h) <= 1, `${aspect} ${scaling}: the wide frame fills the element (${wide.w} x ${wide.h} in ${canvas.w} x ${canvas.h})`); // @math a pixel of rounding
      page.display.present(true, null); // a menu, a card, the split screen: the 320 x 200 canvas
      const narrow = page.display.stats().rect;
      assert.equal(narrow.h, wide.h, `${aspect} ${scaling}: the same height`); assert.ok(narrow.w < wide.w && narrow.x > 0, `${aspect} ${scaling}: pillarboxed (${narrow.w} at ${narrow.x})`);
      assert.ok(Math.abs(narrow.w / narrow.h - DISPLAY.aspects[aspect]) < 0.01 && Math.abs(wide.w / wide.h - DISPLAY.aspects[aspect] * (w / 320)) < 0.01, 'each its own shape'); // @math within a hundredth; the canvas's columns
    }
    page.display.setRendering({ scale: 1, wide: false }); page.display.configure(resetDisplay());
    assert.deepEqual(page.display.stats().element, { w: 320, h: 200 }, 'the standard view: the canvas\'s size again'); // @math the canvas
  } finally { page.restore(); }
});

test('Stage 4: the RENDERING list (DISPLAY OPTIONS > RENDERING): RESOLUTION, VIEW, SPRITE SIZES, KART ANGLES, ARTWORK and LEAVE THIS MENU, the graphics settings\' words, Enter asking for the next scale, view, sizes or angles or the artwork switch', () => {
  assert.equal(DISPLAY_MENU.rendering, RENDER_MENU.item); assert.equal(DISPLAY_MENU.resolution, RENDER_MENU.scale); assert.equal(DISPLAY_MENU.view, RENDER_MENU.view); assert.equal(DISPLAY_MENU.sizes, RENDER_MENU.sizes); assert.equal(DISPLAY_MENU.angles, RENDER_MENU.angles); assert.equal(DISPLAY_MENU.art, RENDER_MENU.art); // the menu's names are the config's
  const base = defaultSettings(1, true), line = (name, word) => name.padEnd(DISPLAY_MENU.width - word.length) + word;
  for (const [s, ready, word, view, sizes, packs = 0, art = 'NONE', angleSets = 0, angles = 'NONE'] of [[resetSettings(), true, '1X', 'STANDARD', 'STEPPED'], [changeGraphics(resetSettings(), 'scale', 2), true, '2X', 'STANDARD', 'STEPPED'], [changeGraphics(resetSettings(), 'view', 'wide'), true, '1X', 'WIDE', 'STEPPED'], [changeGraphics(changeGraphics(resetSettings(), 'view', 'wide'), 'hudPlace', 'edges'), true, '1X', 'WIDE EDGES', 'STEPPED'], [changeGraphics(changeGraphics(resetSettings(), 'view', 'wide'), 'hudPlace', 'edges'), false, 'NONE', 'NONE', 'STEPPED'], [changeGraphics(resetSettings(), 'hudPlace', 'edges'), true, '1X', 'STANDARD', 'STEPPED'], [changeGraphics(changeGraphics(resetSettings(), 'scale', 2), 'view', 'wide'), false, 'NONE', 'NONE', 'STEPPED'], [changeGraphics(resetSettings(), 'sizes', 'smooth'), true, '1X', 'STANDARD', 'SMOOTH'], [changeGraphics(resetSettings(), 'sizes', 'smooth'), false, 'NONE', 'NONE', 'SMOOTH'], [changeGraphics(resetSettings(), 'art', true), true, '1X', 'STANDARD', 'STEPPED', 2, 'ON '], [resetSettings(), false, 'NONE', 'NONE', 'STEPPED', 1, 'OFF'], [changeGraphics(resetSettings(), 'art', true), true, '1X', 'STANDARD', 'STEPPED', 0, 'NONE'], [changeGraphics(resetSettings(), 'art', true), true, '1X', 'STANDARD', 'STEPPED', 1, 'ON ', 1, 'LOCKED'], [changeGraphics(resetSettings(), 'angles', 'free'), false, 'NONE', 'NONE', 'STEPPED', 1, 'OFF', 2, 'FREE'], [changeGraphics(resetSettings(), 'angles', 'off'), true, '1X', 'STANDARD', 'STEPPED', 1, 'OFF', 1, 'OFF'], [changeGraphics(resetSettings(), 'angles', 'free'), true, '1X', 'STANDARD', 'STEPPED', 1, 'OFF', 0, 'NONE']]) { // @math the second scale; the wide view; neither without WebGL 2; smooth sizes, with and without it; the artwork on and off with packs stored (without WebGL 2 too), and NONE with no pack; the kart angles with an angle set stored (without WebGL 2 too), NONE without one
    const def = menuDef('rendering', { ...base, graphics: menuView(s, { worldReady: ready, packs, angleSets }) });
    assert.deepEqual(def.items, [line('RESOLUTION', word), line('VIEW', view), line('SPRITE SIZES', sizes), line('KART ANGLES', angles), line('ARTWORK', art), 'LEAVE THIS MENU']);
    assert.deepEqual(def.actions, [{ graphics: { cycle: 'scale' } }, { graphics: { cycle: 'view' } }, { graphics: { cycle: 'sizes' } }, { graphics: { cycle: 'angles' } }, { graphics: { toggle: 'art' } }, { back: true }]);
    def.items.forEach(drawable); assert.ok(def.items.every(t => t.length <= DISPLAY_MENU.width)); assert.ok(layoutOf('sub', def.items).y0 >= gameTopBar());
  }
  assert.equal(line('SPRITE SIZES', 'STEPPED'), 'SPRITE SIZES STEPPED', 'the longest line, exactly the bar'); // @math 20 characters
  assert.equal(line('KART ANGLES', 'LOCKED'), 'KART ANGLES   LOCKED'); // @math 20 characters
  assert.deepEqual(menuDef('rendering', base).items.slice(0, 5), ['RESOLUTION'.padEnd(19) + '-', 'VIEW'.padEnd(19) + '-', 'SPRITE SIZES'.padEnd(19) + '-', 'KART ANGLES'.padEnd(19) + '-', 'ARTWORK'.padEnd(19) + '-']); // @math before the page has handed in its words
  assert.ok(isRenderChoice('scale') && isRenderChoice('view') && isRenderChoice('sizes') && isRenderChoice('angles') && !isRenderChoice('shadowStrength') && !isRenderChoice('art'));
  const s = resetSettings();
  assert.deepEqual([cycleRender(s, 'scale').scale, cycleRender(cycleRender(s, 'scale'), 'scale').scale], [2, 1]); // @math 1X to 2X and back
  assert.deepEqual([1, 2, 3].map(n => { let t = s; for (let k = 0; k < n; k++) t = cycleRender(t, 'view'); return [t.view, t.hudPlace, menuView(t).render.view]; }), [['wide', 'centred', 'WIDE'], ['wide', 'edges', 'WIDE EDGES'], ['standard', 'centred', 'STANDARD']]); // @math STANDARD to WIDE, WIDE EDGES (M9: the view and the HUD's place together) and back
  assert.deepEqual(['view', 'hudPlace'].map(k => cycleRender(changeGraphics(s, 'hudPlace', 'edges'), 'view')[k]), ['wide', 'centred'], 'a place stored in the standard view: STANDARD goes to WIDE');
  assert.equal(changeGraphics(changeGraphics(s, 'view', 'wide'), 'hudPlace', 'edges').preset, 'custom'); assert.equal(changeGraphics(s, 'hudPlace', 'edges').preset, 'original', 'the HUD\'s place alone keeps Original');
  assert.deepEqual([cycleRender(s, 'sizes').sizes, cycleRender(cycleRender(s, 'sizes'), 'sizes').sizes], ['smooth', 'classes']); // STEPPED to SMOOTH and back
  assert.deepEqual([1, 2, 3].map(n => { let t = s; for (let k = 0; k < n; k++) t = cycleRender(t, 'angles'); return t.angles; }), ['free', 'off', 'locked']); // @math LOCKED to FREE, OFF and back
  assert.equal(cycleRender(s, 'angles').preset, 'original', 'the kart angles alone keep Original: they only refine the artwork');
  assert.equal(cycleRender(s, 'sizes').preset, 'custom', 'Original with smooth sizes is custom'); assert.equal(cycleRender(normalizeGraphics({ preset: 'enhanced' }), 'sizes').preset, 'enhanced');
  assert.equal(cycleRender(s, 'view').preset, 'custom', 'Original in the wide view is custom'); assert.equal(cycleRender(normalizeGraphics({ preset: 'enhanced' }), 'view').preset, 'enhanced');
  assert.equal(cycleRender(s, 'scale').preset, 'custom', 'Original at 2x is custom'); assert.equal(cycleRender(normalizeGraphics({ preset: 'enhanced' }), 'scale').preset, 'enhanced');
  let menu = settled(enterMenu('display', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 5 }, { id: 'graphics', cursor: 5 }], { ...base, graphics: menuView(s), display: displayView(resetDisplay()) })); // @math the cursors of GAME OPTIONS, DISPLAY AND EFFECTS and DISPLAY OPTIONS
  for (let k = 0; k < 4; k++) menu = settled(stepFrame(menu, 'down').menu); // @math the fifth line, RENDERING
  const opened = settled(stepFrame(menu, 'enter').menu);
  assert.equal(opened.id, 'rendering');
  assert.deepEqual(stepFrame(opened, 'enter').chosen, { graphics: { cycle: 'scale' } });
  assert.deepEqual(stepFrame(settled(stepFrame(opened, 'down').menu), 'enter').chosen, { graphics: { cycle: 'view' } }); // the second line, VIEW
  assert.deepEqual(stepFrame(settled(stepFrame(settled(stepFrame(opened, 'down').menu), 'down').menu), 'enter').chosen, { graphics: { cycle: 'sizes' } }); // the third line, SPRITE SIZES
  let fourth = opened; for (let k = 0; k < 3; k++) fourth = settled(stepFrame(fourth, 'down').menu); // @math the fourth line, KART ANGLES
  assert.deepEqual(stepFrame(fourth, 'enter').chosen, { graphics: { cycle: 'angles' } });
  const fifth = settled(stepFrame(fourth, 'down').menu); // the fifth line, ARTWORK
  assert.deepEqual(stepFrame(fifth, 'enter').chosen, { graphics: { toggle: 'art' } });
});
