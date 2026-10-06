// The menus of the page's display (docs/enhancements.md, Stage 1), which the game does not have: GAME OPTIONS > DISPLAY AND EFFECTS gets the line DISPLAY OPTIONS,
// which opens a list in the game's menu style with the scaling, the shape of the picture, full screen, the CRT look and CRT LEVELS (scanlines, glow, curvature). As in graphics-menu.js
// the menus only show what the page hands them in `settings.display` (the words of src/enhance/display-settings.js displayView) and return what Enter chose.
export const DISPLAY_MENU = {
  item: 'DISPLAY OPTIONS',
  scaling: 'SCALING',
  aspect: 'ASPECT',
  fullscreen: 'FULL SCREEN',
  crt: 'CRT LOOK',
  levelsItem: 'CRT LEVELS',
  levels: [['scanlines', 'SCANLINES'], ['glow', 'GLOW'], ['curvature', 'CURVATURE']],
  defaults: 'DEFAULT LEVELS',
  none: 'NONE', // the CRT look where the browser has no WebGL 2
  width: 20, // @math a bar's text, as the graphics menus have it: the longest name, FULL SCREEN, a space and the longest word after it
};

// What the menus show before the page has handed them its words.
const BLANK = { aspect: '-', scaling: '-', on: {}, levels: {}, crtReady: true };

const line = (name, word) => (name.length + 1 + word.length > DISPLAY_MENU.width ? `${name} ${word}` : name.padEnd(DISPLAY_MENU.width - word.length) + word); // @math a space between

// The menu 'display' or 'crtLevels': { items, actions }. `on`/`off` are the game's words for a switch, `leave` its LEAVE THIS MENU.
export function displayMenu(id, view = BLANK, { on, off, leave }) {
  const M = DISPLAY_MENU, v = view ?? BLANK, back = { back: true };
  if (id === 'display') {
    const crt = v.crtReady === false ? M.none : v.on?.crt ? on : off;
    return {
      items: [line(M.scaling, v.scaling ?? '-'), line(M.aspect, v.aspect ?? '-'), line(M.fullscreen, v.on?.fullscreen ? on : off), line(M.crt, crt), M.levelsItem, leave],
      actions: [{ display: { scaling: true } }, { display: { aspect: true } }, { display: { fullscreen: true } }, { display: { crt: true } }, { open: 'crtLevels' }, back],
    };
  }
  const items = [...M.levels.map(([key, name]) => line(name, v.levels?.[key] ?? '-')), M.defaults, leave];
  return { items, actions: [...M.levels.map(([key]) => ({ display: { level: key } })), { display: { defaultLevels: true } }, back] };
}
