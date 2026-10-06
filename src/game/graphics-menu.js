// The menus of the page's Enhanced presentation (docs/enhancements.md), which the game does not have: GAME OPTIONS gets the item ENHANCED GRAPHICS, which opens a
// list in the game's menu style with the preset (Enter goes between ORIGINAL and ENHANCED), EFFECTS (a switch for each effect) and EFFECT LEVELS (the strengths and
// the sun). The menus only show what the page hands them in `settings.graphics` (the words of src/enhance/settings.js menuView) and return what Enter chose; the page
// changes its graphics settings and hands the new words back. The lists stay short enough to stand below the logo, as the game's own submenus do.
export const GRAPHICS_MENU = {
  item: 'ENHANCED GRAPHICS',
  preset: 'PRESET',
  effects: [['smooth', 'SMOOTH MOTION'], ['shadows', 'CONTACT SHADOWS'], ['sceneryShadows', 'SCENERY SHADOWS'], ['sunShadows', 'SUN SHADOWS'], ['particles', 'PARTICLES'], ['skidMarks', 'SKID MARKS'], ['fog', 'DISTANCE FOG']],
  effectsItem: 'EFFECTS',
  levelsItem: 'EFFECT LEVELS',
  levels: [['shadowStrength', 'SHADOWS'], ['fogStrength', 'FOG'], ['particleAmount', 'PARTICLES'], ['sunAngle', 'SUN FROM']],
  defaults: 'DEFAULT LEVELS',
  width: 20, // @math a bar's text: the longest name, SCENERY SHADOWS or SUN FROM, a space and the longest word after it
};

// What the menus show before the page has handed them its words (a menu built without the page, as the tests and the checks do).
const BLANK = { preset: '-', on: {}, levels: {} };

// A line of the list: the name, then the word at the end of the bar (at least a space between them).
const line = (name, word) => (name.length + 1 + word.length > GRAPHICS_MENU.width ? `${name} ${word}` : name.padEnd(GRAPHICS_MENU.width - word.length) + word); // @math a space between

// The menu 'graphics', 'gfxEffects' or 'gfxLevels': { items, actions }. `on`/`off` are the game's words for a switch (the Race Screen Options' ON and OFF), `leave` its LEAVE THIS MENU.
export function graphicsMenu(id, view = BLANK, { on, off, leave }) {
  const G = GRAPHICS_MENU, v = view ?? BLANK, back = { back: true };
  if (id === 'graphics') return { items: [line(G.preset, v.preset ?? '-'), G.effectsItem, G.levelsItem, leave], actions: [{ graphics: { preset: true } }, { open: 'gfxEffects' }, { open: 'gfxLevels' }, back] };
  if (id === 'gfxEffects') return { items: [...G.effects.map(([key, name]) => line(name, v.on?.[key] ? on : off)), leave], actions: [...G.effects.map(([key]) => ({ graphics: { toggle: key } })), back] };
  const items = [...G.levels.map(([key, name]) => line(name, v.levels?.[key] ?? '-')), G.defaults, leave];
  return { items, actions: [...G.levels.map(([key]) => ({ graphics: { cycle: key } })), { graphics: { defaultLevels: true } }, back] };
}
