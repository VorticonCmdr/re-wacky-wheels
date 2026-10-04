// The main menu's state and keys. The item list and positions are menu.main-observed; what the game does when the cursor passes the first or last
// item, and how it highlights the selection, is not observed (the cursor stops at the ends here).
import { menuItems } from '../render/menu.js';

export const createMenu = () => ({ selected: 0 });

// `key` is 'up', 'down', 'enter' or 'escape'. Returns the new menu and the chosen item index (or -1).
export function stepMenu(menu, key) {
  const last = menuItems().length - 1;
  if (key === 'up') return { menu: { selected: Math.max(menu.selected - 1, 0) }, chosen: -1 };
  if (key === 'down') return { menu: { selected: Math.min(menu.selected + 1, last) }, chosen: -1 };
  if (key === 'enter') return { menu, chosen: menu.selected };
  return { menu, chosen: -1 };
}
