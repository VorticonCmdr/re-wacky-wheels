// The menus of the page's display and Enhanced presentation (docs/enhancements.md), which the game does not have: GAME OPTIONS gets the item DISPLAY AND EFFECTS, which
// opens a list in the game's menu style with the preset (Enter goes between ORIGINAL and ENHANCED), the effect switches in two lists (MOTION AND SHADOWS, SURFACE AND
// SKY), EFFECT LEVELS (the strengths and the sun) and DISPLAY OPTIONS (display-menu.js: the scaling, the shape, full screen and the CRT look, for the Original preset
// too). The menus only show what the page hands them in `settings.graphics` (the words of src/enhance/settings.js menuView) and return what Enter chose; the page
// changes its graphics settings and hands the new words back. Every list keeps to six lines, so that its first bar stands below the menu picture's logo as the lists
// of the game's menus the port models do (test/menu-bars.js).
import { DISPLAY_MENU } from './display-menu.js';

export const GRAPHICS_MENU = {
  item: 'DISPLAY AND EFFECTS',
  preset: 'PRESET',
  groups: [
    { id: 'gfxShadows', name: 'MOTION AND SHADOWS', effects: [['smooth', 'SMOOTH MOTION'], ['shadows', 'CONTACT SHADOWS'], ['sceneryShadows', 'SCENERY SHADOWS'], ['sunShadows', 'SUN SHADOWS'], ['skidMarks', 'SKID MARKS']] },
    { id: 'gfxParticles', name: 'SURFACE AND SKY', effects: [['particles', 'PARTICLES'], ['water', 'MOVING WATER'], ['fog', 'DISTANCE FOG'], ['clouds', 'SKY LAYERS'], ['lighting', 'TRACK LIGHTING']] }, // SKY LAYERS: the clouds and the far range; the track's own atmosphere (its fog, sky, water and lighting) is set in the track editor
  ],
  levelsItem: 'EFFECT LEVELS',
  levels: [['shadowStrength', 'SHADOWS'], ['fogStrength', 'FOG'], ['particleAmount', 'PARTICLES'], ['sunAngle', 'SUN FROM']],
  defaults: 'DEFAULT LEVELS',
  width: 20, // @math a bar's text: the longest name, SCENERY SHADOWS or SUN FROM, a space and the longest word after it
};

// The ids of the lists of effect switches.
export const EFFECT_LISTS = GRAPHICS_MENU.groups.map(g => g.id);

// What the menus show before the page has handed them its words (a menu built without the page, as the tests and the checks do).
const BLANK = { preset: '-', on: {}, levels: {} };

// A line of the list: the name, then the word at the end of the bar (at least a space between them).
const line = (name, word) => (name.length + 1 + word.length > GRAPHICS_MENU.width ? `${name} ${word}` : name.padEnd(GRAPHICS_MENU.width - word.length) + word); // @math a space between

// The menu 'graphics', a list of switches ('gfxShadows', 'gfxParticles') or 'gfxLevels': { items, actions }. `on`/`off` are the game's words for a switch (the Race
// Screen Options' ON and OFF), `leave` its LEAVE THIS MENU.
export function graphicsMenu(id, view = BLANK, { on, off, leave }) {
  const G = GRAPHICS_MENU, v = view ?? BLANK, back = { back: true };
  if (id === 'graphics') {
    return {
      items: [line(G.preset, v.preset ?? '-'), ...G.groups.map(g => g.name), G.levelsItem, DISPLAY_MENU.item, leave],
      actions: [{ graphics: { preset: true } }, ...G.groups.map(g => ({ open: g.id })), { open: 'gfxLevels' }, { open: 'display' }, back],
    };
  }
  const group = G.groups.find(g => g.id === id);
  if (group) return { items: [...group.effects.map(([key, name]) => line(name, v.on?.[key] ? on : off)), leave], actions: [...group.effects.map(([key]) => ({ graphics: { toggle: key } })), back] };
  const items = [...G.levels.map(([key, name]) => line(name, v.levels?.[key] ?? '-')), G.defaults, leave];
  return { items, actions: [...G.levels.map(([key]) => ({ graphics: { cycle: key } })), { graphics: { defaultLevels: true } }, back] };
}
