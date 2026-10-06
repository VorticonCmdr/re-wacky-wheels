// The menu picture's logo ends on row 75 and every list of the game's menus the port models starts its first bar at row 76 or below. The page's own lists keep to the
// same row (docs/enhancements.md, "The menus and the logo"): every list the page's menus reach, with the page's words handed in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings, menuDef } from '../src/game/menus.js';
import { enterMenu, stepFrame } from '../src/game/menu.js';
import { menuView, resetSettings } from '../src/enhance/settings.js';
import { displayView, resetDisplay } from '../src/enhance/display-settings.js';
import { firstBar, gameTopBar, pageMenus } from './menu-bars.js';

test('no list of the page\'s menus starts its first bar higher than the game\'s own lists do', () => {
  const settings = { ...defaultSettings(1, true), graphics: menuView(resetSettings()), display: displayView(resetDisplay()) }, top = gameTopBar(), ids = pageMenus(settings);
  assert.equal(top, 76); // @math the main menu and the six-line FAMOUS DRIVERS lists: the logo ends on row 75
  for (const id of ['options', 'keysSound', 'keys', 'keysOne', 'keysTwo', 'sound', 'soundEffects', 'soundMusic', 'peer', 'graphics', 'gfxShadows', 'gfxParticles', 'gfxLevels', 'display', 'crtLevels']) assert.ok(ids.includes(id), `${id} is reached`);
  const high = ids.filter(id => firstBar(id, settings) < top).map(id => `${id} (row ${firstBar(id, settings)})`);
  assert.deepEqual(high, []);
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
