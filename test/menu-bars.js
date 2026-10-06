// Where a menu's first bar stands, and the highest row the game's menus the port models put a first bar at: their lists are short enough that
// the first bar stands below the logo of the menu picture, and a list of the page's own (menus.js famousDef) keeps to the same row. (Not a rule
// shown for the whole game: the phone book of MAKE CALL, docs/leads/menus.md, is not modelled.)
import { menuDef, defaultSettings, menuIds, famousIds } from '../src/game/menus.js';
import { layoutOf } from '../src/render/menu.js';

export const firstBar = (id, settings) => { const def = menuDef(id, settings); return layoutOf(def.kind, def.items).y0; };

// The game's menus: the tree of menu.tree-observed (with the main menu) and the FAMOUS DRIVERS menus of menu.famous-menus.
export const gameTopBar = () => Math.min(...menuIds().map(id => firstBar(id, defaultSettings())), ...famousIds().filter(id => id !== 'restore').map(id => firstBar(id, defaultSettings(1, true))));

// Every menu the page's own menus reach from the main menu (settings.famous: the page's items and lists), by the lists' open and goto actions, with the menus the page
// opens itself (the saved game's, the two player and duck game lists).
export function pageMenus(settings) {
  const seen = new Set(), queue = ['main', 'comm', 'restore', 'zones', 'hits', 'duoMode', 'duoClass'];
  while (queue.length) {
    const id = queue.shift(); if (seen.has(id)) continue; seen.add(id);
    for (const a of menuDef(id, settings).actions) { const next = a.open ?? a.goto; if (next && !seen.has(next)) queue.push(next); }
  }
  return [...seen];
}
