// The menus of the page's display (docs/enhancements.md, Stage 1), which the game does not have: GAME OPTIONS > DISPLAY AND EFFECTS gets the line DISPLAY OPTIONS,
// which opens a list in the game's menu style with the scaling, the shape of the picture, full screen, CRT AND HUD (the CRT look, scanlines, glow, curvature,
// the HUD layer; Stage 4 moved the CRT look there and dropped DEFAULT LEVELS, the panel's Reset display puts the levels back) and RENDERING (Stage 4: how the
// race world is rendered: RESOLUTION, VIEW, SPRITE SIZES, KART ANGLES and ARTWORK). As in graphics-menu.js the menus only show what the page hands them, in `settings.display` (the words of
// src/enhance/display-settings.js displayView) and for RENDERING in `settings.graphics.render` (the rendering choices are graphics settings: the words of
// src/enhance/settings.js menuView, NONE where a choice cannot be shown), and return what Enter chose.
export const DISPLAY_MENU = {
  item: 'DISPLAY OPTIONS',
  scaling: 'SCALING',
  aspect: 'ASPECT',
  fullscreen: 'FULL SCREEN',
  crt: 'CRT LOOK',
  levelsItem: 'CRT AND HUD',
  levels: [['scanlines', 'SCANLINES'], ['glow', 'GLOW'], ['curvature', 'CURVATURE']],
  hud: 'HUD',
  none: 'NONE', // the CRT look where the browser has no WebGL 2
  rendering: 'RENDERING', // the list of the rendering choices (src/enhance/config.js RENDER_MENU has the same names: test/display.test.js)
  resolution: 'RESOLUTION', // the scale of the race world: 1X, 2X, or NONE without WebGL 2
  view: 'VIEW', // the race world's view: STANDARD, WIDE, or NONE without WebGL 2
  sizes: 'SPRITE SIZES', // the pictures' sizes: STEPPED (the game's size classes) or SMOOTH (between them), at any resolution, WebGL 2 or not
  angles: 'KART ANGLES', // how the karts of an artwork pack's angle sets turn: LOCKED (to the game's frame), FREE or OFF (the game's eight), NONE without an enabled set
  art: 'ARTWORK', // the player's artwork packs in the race world: ON, OFF, or NONE with no pack stored
  width: 20, // @math a bar's text, as the graphics menus have it: the longest name, FULL SCREEN, a space and the longest word after it
};

// What the menus show before the page has handed them its words.
const BLANK = { aspect: '-', scaling: '-', hud: '-', on: {}, levels: {}, crtReady: true };

const line = (name, word) => (name.length + 1 + word.length > DISPLAY_MENU.width ? `${name} ${word}` : name.padEnd(DISPLAY_MENU.width - word.length) + word); // @math a space between

// The menu 'display', 'crtLevels' or 'rendering': { items, actions }. `on`/`off` are the game's words for a switch, `leave` its LEAVE THIS MENU; `render` the
// words of the rendering choices (menuView's `render`, or null before the page has handed them in). Enter on RESOLUTION asks the page to take the next scale
// ({ graphics: { cycle: 'scale' } }), on VIEW the next view ({ graphics: { cycle: 'view' } }), on SPRITE SIZES the next sizes ({ graphics: { cycle: 'sizes' } }),
// on KART ANGLES the next way the angle sets turn ({ graphics: { cycle: 'angles' } }: NONE while no enabled pack has an angle set), on ARTWORK the artwork
// switch ({ graphics: { toggle: 'art' } }: ON or OFF, NONE while no pack is stored); the page does nothing while a line says NONE.
export function displayMenu(id, view = BLANK, { on, off, leave }, render = null) {
  const M = DISPLAY_MENU, v = view ?? BLANK, back = { back: true };
  if (id === 'display') {
    return {
      items: [line(M.scaling, v.scaling ?? '-'), line(M.aspect, v.aspect ?? '-'), line(M.fullscreen, v.on?.fullscreen ? on : off), M.levelsItem, M.rendering, leave],
      actions: [{ display: { scaling: true } }, { display: { aspect: true } }, { display: { fullscreen: true } }, { open: 'crtLevels' }, { open: 'rendering' }, back],
    };
  }
  if (id === 'rendering') {
    const art = !render ? '-' : !render.artReady ? M.none : render.art ? on : off;
    return { items: [line(M.resolution, render?.scale ?? '-'), line(M.view, render?.view ?? '-'), line(M.sizes, render?.sizes ?? '-'), line(M.angles, render?.angles ?? '-'), line(M.art, art), leave], actions: [{ graphics: { cycle: 'scale' } }, { graphics: { cycle: 'view' } }, { graphics: { cycle: 'sizes' } }, { graphics: { cycle: 'angles' } }, { graphics: { toggle: 'art' } }, back] };
  }
  const crt = v.crtReady === false ? M.none : v.on?.crt ? on : off;
  const items = [line(M.crt, crt), ...M.levels.map(([key, name]) => line(name, v.levels?.[key] ?? '-')), line(M.hud, v.hud ?? '-'), leave];
  return { items, actions: [{ display: { crt: true } }, ...M.levels.map(([key]) => ({ display: { level: key } })), { display: { hud: true } }, back] };
}
