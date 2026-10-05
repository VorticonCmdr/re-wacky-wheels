// The state of the menus: the cursor (menu.cursor-observed), the selection icons' animation and the corner cars' animation (menu.animation-observed),
// the keys (menu.keys-observed) and the way from menu to menu (menu.tree-observed). The state the animations start in when a menu is entered is read from the
// code (menu.start-state: the first phase, the icons settled); the keys are sampled once a pass with the icons settled (menu.input-sampling).
import { K } from '../evidence/k.js';
import { menuDef, defaultSettings } from './menus.js';
import { lionTopFor, carCount } from '../render/menu.js';

const CURSOR = () => K({ base: 1, wrap: true, cursorWord: 0x32f8c }, 'menu.cursor-observed');
const ANIM = () => K({ period: 8, lengths: [9, 31, 10], firstCount: 1, first: [9, 8, 7, 6, 5, 4, 3, 2, 1], last: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], hold: 0, turn: 9, pairs: 8, frameDiv: 2, frames: 8, lion: { frames: 4, busyDown: 1, busyUp: 2, settled: 0 } }, 'menu.animation-observed');
const KEYS = () => K({ selectKeys: ['KBD_space', 'KBD_enter'], escapeKey: 'KBD_esc', escapeTo: 9, openedCursor: 1 }, 'menu.keys-observed');

// The menu's step in counts of the 136 Hz clock (the page turns it into milliseconds with frameMs).
export const menuPeriod = () => ANIM().period;

// The state of a menu just entered: the cursor on its first item, the icons settled there, the cars at the start of their cycle.
// `stack` holds the menus above it, each with the cursor it was left on; `settings` are what the menus change.
export function enterMenu(id, stack = [], settings = defaultSettings()) {
  const def = menuDef(id, settings), cursor = def.actions[0].choose ? settings.detail[def.actions[0].choose] : KEYS().openedCursor; // a list of levels opens on the current one
  return { id, stack, settings, cursor, lionTop: lionTopFor(def.kind, def.items, cursor), lionFrame: 0, busy: ANIM().lion.settled, phase: 1, count: ANIM().firstCount, pair: carCount(def.kind) - 1 }; // @math the pair starts at the number of cars less one: 1 in the main menu, 3 in a submenu
}

export const createMenu = settings => enterMenu('main', [], settings);

// The cursor after a key: it wraps at both ends of the `items` of the menu.
export function moveCursor(cursor, key, items) {
  const C = CURSOR(), at = cursor - C.base, next = (at + (key === 'down' ? 1 : items - 1)) % items;
  return next + C.base;
}

// The size class of the cars for a phase and a count.
export function sizeOf(phase, count) {
  const A = ANIM();
  if (phase === 1) return A.first[count - 1];
  if (phase === 2) return A.hold; // @math the phase words as the game stores them
  if (phase === 3) return A.last[count]; // @math the phase words as the game stores them
  return A.turn;
}

// One step of the cars' animation (one step of the idle counter); at the end of a cycle the pair moves on by the number of cars of the menu (`cars`).
export function advanceAnimation(s, cars) {
  const A = ANIM();
  if (s.phase === 1) return s.count < A.lengths[0] ? { ...s, count: s.count + 1 } : { ...s, phase: 2, count: 0 }; // @math the phase words as the game stores them
  if (s.phase === 2) return s.count < A.lengths[1] - 1 ? { ...s, count: s.count + 1 } : { ...s, phase: 3, count: 0 }; // @math the count runs 0 to length - 1
  if (s.phase === 3) return s.count < A.lengths[2] - 1 ? { ...s, count: s.count + 1 } : { ...s, phase: 4, count: 0 }; // @math the count runs 0 to length - 1
  return { ...s, phase: 1, count: A.firstCount, pair: (s.pair + cars) % A.pairs };
}

// One step of the selection icons: while busy the frame counts up, and after the last frame they settle at the cursor's row.
export function advanceLions(s, def) {
  const A = ANIM();
  if (s.busy === A.lion.settled) return s;
  if (s.lionFrame < A.lion.frames - 1) return { ...s, lionFrame: s.lionFrame + 1 }; // @math the frames run 0 to count - 1
  return { ...s, busy: A.lion.settled, lionFrame: 0, lionTop: lionTopFor(def.kind, def.items, s.cursor, def.centre) };
}

// The cars' frame in their cycle (menu.animation-observed): half the position in the 51-step cycle, modulo 8.
export function frameOf(phase, count) {
  const A = ANIM(), L = A.lengths, starts = [-A.firstCount, L[0], L[0] + L[1], L[0] + L[1] + L[2]]; // @math the positions of the phases' first steps: each starts where the one before ended
  return Math.floor((starts[phase - 1] + count) / A.frameDiv) % A.frames; // @math phases are numbered from 1
}

// One step of the whole menu (8 counts of the 136 Hz clock): both animations advance.
export function advanceMenu(s) {
  const def = menuDef(s.id, s.settings);
  return advanceLions(advanceAnimation(s, carCount(def.kind)), def);
}

// Back to the parent: its cursor where it was left, the icons settled at its row.
function leave(menu) {
  const parent = menu.stack.at(-1), back = enterMenu(parent.id, menu.stack.slice(0, -1), menu.settings), def = menuDef(parent.id, menu.settings);
  return { ...back, cursor: parent.cursor, lionTop: lionTopFor(def.kind, def.items, parent.cursor) };
}

// One step of the menu's frame (8 counts of the 136 Hz clock) with the key the game reads in it ('up', 'down', 'enter', 'escape' or none).
// A cursor key, when the icons are not busy, moves the cursor at once and starts their animation in this step (the cars advance as always, the icons stay
// at frame 0 at their old row); a key while they are busy is dropped. Enter chooses the item: a menu it opens is entered, a back leaves, anything else is
// returned as `chosen` for the page. Esc goes back (menu.keys-observed) and, like the other keys, is read only with the icons settled; in the main menu it puts the cursor on the last item.
// Returns the new menu and the action chosen (or null).
// Whether the icons have settled, so that the next step reads the keys (menu.input-sampling).
export const isSettled = menu => menu.busy === ANIM().lion.settled;

export function stepFrame(menu, key) {
  const A = ANIM(), def = menuDef(menu.id, menu.settings), cars = carCount(def.kind), settled = menu.busy === A.lion.settled;
  if ((key === 'up' || key === 'down') && settled) {
    return { menu: { ...advanceAnimation(menu, cars), cursor: moveCursor(menu.cursor, key, def.items.length), busy: key === 'down' ? A.lion.busyDown : A.lion.busyUp, lionFrame: 0 }, chosen: null };
  }
  if (key === 'enter' && settled) {
    const action = def.actions[menu.cursor - CURSOR().base];
    if (action.open) return { menu: enterMenu(action.open, [...menu.stack, { id: menu.id, cursor: menu.cursor }], menu.settings), chosen: null };
    if (action.choose) return { menu: leave({ ...menu, settings: { ...menu.settings, detail: { ...menu.settings.detail, [action.choose]: menu.cursor } } }), chosen: null };
    if ('switch' in action) return { menu: { ...advanceMenu(menu), settings: { ...menu.settings, switches: menu.settings.switches.map((v, i) => (i === action.switch ? 1 - v : v)) } }, chosen: null }; // @math a switch is 1 or 0
    if (action.back) return { menu: leave(menu), chosen: null };
    if (action.goto) return { notice: action.notice ?? null, menu: enterMenu(action.goto, [{ id: 'main', cursor: KEYS().openedCursor }], { ...menu.settings, flow: menuDef(menu.id, menu.settings).flowStep ? { ...menu.settings.flow, [menu.id]: menu.cursor } : menu.settings.flow }), chosen: null };
    return { menu: advanceMenu(menu), chosen: action.race ? { ...action, settings: { ...menu.settings, flow: { ...menu.settings.flow, [menu.id]: menu.cursor } } } : action };
  }
  if (key === 'escape' && settled) { // the routine reads Esc only in a pass with the icons settled (menu.input-sampling)
    if (menu.stack.length) return { menu: leave(menu), chosen: null };
    const last = KEYS().escapeTo; // the last item of the main menu
    return { menu: { ...advanceAnimation(menu, cars), cursor: last, lionTop: lionTopFor(def.kind, def.items, last), lionFrame: 0, busy: A.lion.settled }, chosen: null };
  }
  return { menu: advanceMenu(menu), chosen: null };
}

// After the vehicle screen: the first menu of the single player setup, with the main menu as its parent (the cursor where it was opened).
export const enterSetup = (menu, first) => enterMenu(first, [{ id: 'main', cursor: KEYS().openedCursor }], menu.settings);

// The state the renderer takes.
export function viewOf(menu) {
  const def = menuDef(menu.id, menu.settings);
  return { kind: def.kind, items: def.items, lionTop: menu.lionTop, lionFrame: menu.lionFrame, pair: menu.pair, size: sizeOf(menu.phase, menu.count), frame: frameOf(menu.phase, menu.count) };
}
