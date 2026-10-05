// A list menu drawn over a frozen picture, with the bars and selection icons of the list menus (menu.cursor-observed, menu.animation-observed): the in-race menu and the menu after a lost
// race. The cursor and the icons move as in the main menu's lists.
import { moveCursor, advanceLions } from './menu.js';
import { lionTopFor } from '../render/menu.js';

const BUSY = { down: 1, up: 2, settled: 0 }; // @math the busy words of the selection icons (menu.animation-observed)

export const createChoice = (items, centre) => ({ items, centre, cursor: 1, lionTop: lionTopFor(null, items, 1, centre), lionFrame: 0, busy: BUSY.settled }); // @math the cursor starts on the first item

// One step (8 counts of the 136 Hz clock) with the key the game reads ('up', 'down', 'enter', 'escape' or none). `chosen` is the item (from 1) after Enter, or 'escape'.
export function stepChoice(c, key) {
  const settled = c.busy === BUSY.settled;
  if ((key === 'up' || key === 'down') && settled) return { choice: { ...c, cursor: moveCursor(c.cursor, key, c.items.length), busy: key === 'down' ? BUSY.down : BUSY.up, lionFrame: 0 }, chosen: null };
  if (key === 'enter' && settled) return { choice: c, chosen: c.cursor };
  if (key === 'escape') return { choice: c, chosen: 'escape' };
  return { choice: advanceLions(c, { items: c.items, centre: c.centre, kind: null }), chosen: null };
}

export const choiceView = c => ({ items: c.items, centre: c.centre, lionTop: c.lionTop, lionFrame: c.lionFrame });
