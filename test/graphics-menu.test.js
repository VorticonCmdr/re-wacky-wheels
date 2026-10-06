// GAME OPTIONS > DISPLAY AND EFFECTS: the page's own menus of the Enhanced presentation (src/game/graphics-menu.js) and what their lines do to the graphics settings
// (src/enhance/settings.js). The game's records of the four-item GAME OPTIONS menu are untouched: the item is only in the page's menus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHICS_MENU, EFFECT_LISTS } from '../src/game/graphics-menu.js';
import { menuDef, defaultSettings } from '../src/game/menus.js';
import { enterMenu, stepFrame } from '../src/game/menu.js';
import { tileOf, layoutOf } from '../src/render/menu.js';
import { menuView, nextPreset, toggle, cycleLevel, defaultLevels, resetSettings, applyPreset, change } from '../src/enhance/settings.js';
import { EFFECTS, LEVELS } from '../src/enhance/config.js';

const settled = menu => { let m = menu; for (let i = 0; i < 8; i++) m = stepFrame(m, null).menu; return m; }; // the icons settle after a cursor move
const drawable = text => [...text].forEach(ch => tileOf(ch)); // throws on a character the menu font has no tile for

test('GAME OPTIONS has DISPLAY AND EFFECTS only in the page\'s menu, before LEAVE THIS MENU', () => {
  assert.ok(!menuDef('options', defaultSettings()).items.includes(GRAPHICS_MENU.item));
  const options = menuDef('options', defaultSettings(1, true)), at = options.items.indexOf(GRAPHICS_MENU.item);
  assert.equal(at, options.items.length - 2);
  assert.deepEqual(options.actions[at], { open: 'graphics' });
});

test('the lists show the preset, the switches in two lists and the levels, in the menu font and within the bars', () => {
  const settings = { ...defaultSettings(1, true), graphics: menuView(applyPreset(resetSettings(), 'enhanced')) };
  const def = menuDef('graphics', settings);
  assert.match(def.items[0], /^PRESET +ENHANCED$/);
  assert.deepEqual(def.items.slice(1), ['MOTION AND SHADOWS', 'PARTICLES AND FOG', GRAPHICS_MENU.levelsItem, 'DISPLAY OPTIONS', 'LEAVE THIS MENU']);
  assert.deepEqual(def.actions, [{ graphics: { preset: true } }, { open: 'gfxShadows' }, { open: 'gfxParticles' }, { open: 'gfxLevels' }, { open: 'display' }, { back: true }]);
  const lists = EFFECT_LISTS.map(id => menuDef(id, settings));
  assert.deepEqual(lists.flatMap(l => l.actions.slice(0, -1).map(a => a.graphics.toggle)), EFFECTS); // every effect once, in the order of the panel
  assert.equal(lists[0].items[0], 'SMOOTH MOTION'.padEnd(GRAPHICS_MENU.width - 3) + 'ON '); // @math the game's ON word has three characters
  for (const l of lists) assert.equal(l.items.at(-1), 'LEAVE THIS MENU');
  const levels = menuDef('gfxLevels', settings);
  assert.deepEqual(levels.items.slice(0, 4), ['SHADOWS'.padEnd(17) + '100', 'FOG'.padEnd(17) + '100', 'PARTICLES'.padEnd(17) + '100', 'SUN FROM'.padEnd(10) + 'NORTH EAST']); // @math the width less the words' lengths
  assert.deepEqual(levels.actions.slice(0, 4).map(a => a.graphics.cycle), Object.keys(LEVELS));
  for (const items of [def.items, ...lists.map(l => l.items), levels.items, ...EFFECT_LISTS.map(id => menuDef(id, defaultSettings(1, true)).items)]) { items.forEach(drawable); assert.ok(items.every(t => t.length <= GRAPHICS_MENU.width)); layoutOf('sub', items); }
});

test('Enter on a line hands its action to the page and stays in the list; the lists open from it and go back', () => {
  const settings = { ...defaultSettings(1, true), graphics: menuView(resetSettings()) };
  const top = enterMenu('graphics', [{ id: 'main', cursor: 6 }, { id: 'options', cursor: 5 }], settings); // @math the cursors of GAME OPTIONS and DISPLAY AND EFFECTS
  assert.deepEqual(stepFrame(top, 'enter').chosen, { graphics: { preset: true } });
  let menu = stepFrame(settled(stepFrame(top, 'down').menu), 'enter').menu; // MOTION AND SHADOWS
  assert.equal(menu.id, 'gfxShadows');
  for (let i = 0; i < 2; i++) menu = settled(stepFrame(menu, 'down').menu); // @math the third switch, SCENERY SHADOWS
  const out = stepFrame(menu, 'enter');
  assert.deepEqual(out.chosen, { graphics: { toggle: 'sceneryShadows' } });
  assert.equal(out.menu.id, 'gfxShadows');
  menu = stepFrame(settled(stepFrame(settled(stepFrame(top, 'down').menu), 'down').menu), 'enter').menu; // PARTICLES AND FOG
  assert.equal(menu.id, 'gfxParticles');
  assert.deepEqual(stepFrame(settled(stepFrame(settled(stepFrame(menu, 'down').menu), 'down').menu), 'enter').chosen, { graphics: { toggle: 'fog' } });
  menu = settled(stepFrame(settled(stepFrame(settled(stepFrame(top, 'down').menu), 'down').menu), 'down').menu); // EFFECT LEVELS
  const levels = stepFrame(menu, 'enter').menu;
  assert.equal(levels.id, 'gfxLevels');
  assert.equal(stepFrame(levels, 'escape').menu.id, 'graphics');
});

test('the lines change the settings: the preset, a switch, a strength by quarters, the sun by eighths, the default levels', () => {
  const s = resetSettings();
  assert.equal(nextPreset(s).preset, 'enhanced');
  assert.equal(nextPreset(nextPreset(s)).preset, 'original');
  assert.equal(nextPreset(change(applyPreset(s, 'enhanced'), 'fog', false)).preset, 'original'); // from Custom back to Original
  assert.equal(toggle(s, 'skidMarks').skidMarks, true);
  assert.equal(toggle(s, 'skidMarks').preset, 'custom');
  const seq = [s]; for (let i = 0; i < 5; i++) seq.push(cycleLevel(seq.at(-1), 'fogStrength')); // @math five presses
  assert.deepEqual(seq.map(x => x.fogStrength), [1, 0, 0.25, 0.5, 0.75, 1]);
  assert.equal(cycleLevel(change(s, 'shadowStrength', 0.6), 'shadowStrength').shadowStrength, 0.75);
  const suns = [s]; for (let i = 0; i < 8; i++) suns.push(cycleLevel(suns.at(-1), 'sunAngle')); // @math eight presses go round
  assert.deepEqual(suns.map(x => menuView(x).levels.sunAngle), ['NORTH EAST', 'EAST', 'SOUTH EAST', 'SOUTH', 'SOUTH WEST', 'WEST', 'NORTH WEST', 'NORTH', 'NORTH EAST']);
  assert.equal(menuView(change(s, 'particleAmount', 0)).levels.particleAmount, 'OFF');
  assert.deepEqual(defaultLevels({ ...s, fogStrength: 0.25, sunAngle: 0 }), resetSettings());
  assert.deepEqual(menuView(s).on, Object.fromEntries(EFFECTS.map(k => [k, false])));
  assert.equal(menuView(s).preset, 'ORIGINAL');
});
