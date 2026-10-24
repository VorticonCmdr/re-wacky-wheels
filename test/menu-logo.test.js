// The menu picture's logo ends on row 75 and every list of the game's menus the port models starts its first bar at row 76 or below. The page's own lists keep to the
// same row (docs/enhancements.md, "The menus and the logo"): every list the page's menus reach, with the page's words handed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, menuDef } from '../src/game/menus.js';
import { enterMenu, stepFrame } from '../src/game/menu.js';
import { menuView, resetSettings, normalize as normalizeGraphics } from '../src/enhance/settings.js';
import { displayView, resetDisplay } from '../src/enhance/display-settings.js';
import { firstBar, gameTopBar, pageMenus } from './menu-bars.js';

test('no list of the page\'s menus starts its first bar higher than the game\'s own lists do', () => {
  const settings = { ...defaultSettings(1, true), graphics: menuView(resetSettings()), display: displayView(resetDisplay()) }, top = gameTopBar(), ids = pageMenus(settings);
  assert.equal(top, 76); // @math the main menu and the six-line FAMOUS DRIVERS lists: the logo ends on row 75
  for (const id of ['options', 'keysSound', 'keys', 'keysOne', 'keysTwo', 'sound', 'soundEffects', 'soundMusic', 'peer', 'graphics', 'gfxShadows', 'gfxParticles', 'gfxLevels', 'display', 'crtLevels', 'rendering']) assert.ok(ids.includes(id), `${id} is reached`);
  const high = ids.filter(id => firstBar(id, settings) < top).map(id => `${id} (row ${firstBar(id, settings)})`);
  assert.deepEqual(high, []);
});

test('the page\'s display lists in Stage 4: CRT LOOK leads CRT AND HUD, DEFAULT LEVELS is gone from it, RENDERING takes DISPLAY OPTIONS\' last free line, and every page list keeps to six lines', () => {
  const settings = { ...defaultSettings(1, true), graphics: menuView(resetSettings()), display: displayView(resetDisplay()) }, levels = menuDef('crtLevels', settings), display = menuDef('display', settings);
  assert.ok(levels.items[0].startsWith('CRT LOOK') && !levels.items.includes('DEFAULT LEVELS') && levels.items.length === 6); // @math CRT LOOK, three levels, HUD, LEAVE THIS MENU
  assert.ok(!display.items.some(t => t.startsWith('CRT LOOK')) && display.items.length === 6 && display.items[4] === 'RENDERING'); // @math SCALING, ASPECT, FULL SCREEN, CRT AND HUD, RENDERING, LEAVE THIS MENU
  assert.deepEqual(menuDef('rendering', settings).items.length, 6); // @math RESOLUTION, VIEW (M8), SPRITE SIZES (M7), KART ANGLES (M4), ARTWORK (the packs) and LEAVE THIS MENU: the six-line limit
  const edges = { ...settings, graphics: menuView(normalizeGraphics({ view: 'wide', hudPlace: 'edges' })) }, rendering = menuDef('rendering', edges);
  assert.ok(rendering.items.length === 6 && rendering.items[1] === 'VIEW      WIDE EDGES' && firstBar('rendering', edges) >= gameTopBar(), 'M9: VIEW WIDE EDGES needs no line of its own, and fits its bar'); // @math the six lines; the second, VIEW, with WIDE EDGES in 20 characters
  assert.ok(menuDef('gfxLevels', settings).items.some(t => t.startsWith('TIME OF DAY')), 'LIGHTING AND TIME contains the time setting');
  const long = ['options', 'keysSound', 'keys', 'sound', 'graphics', 'gfxShadows', 'gfxParticles', 'gfxLevels', 'display', 'crtLevels', 'rendering'].filter(id => menuDef(id, settings).items.length > 6); // @math the page's own lists: six lines at most
  assert.deepEqual(long, []);
});

test('a player\'s key list has its six keys and no LEAVE THIS MENU: Esc goes back, as from the game\'s setup lists', () => {
  const settings = defaultSettings(1, true);
  for (const id of ['keysOne', 'keysTwo']) {
    const def = menuDef(id, settings);
    assert.equal(def.items.length, 6); // @math the six keys of the table
    assert.ok(def.actions.every(a => a.rebind));
    assert.equal(stepFrame(enterMenu(id, [{ id: 'keys', cursor: 1 }], settings), 'escape').menu.id, 'keys');
  }
});
