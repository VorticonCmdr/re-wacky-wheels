// The main menu's state: the cursor (menu.cursor-observed), the selection icons' animation and the corner cars' animation (menu.animation-observed).
import { K } from '../evidence/k.js';

const CURSOR = () => K({ items: 9, base: 1, wrap: true, cursorWord: 0x32f8c }, 'menu.cursor-observed');
const ANIM = () => K({ period: 8, lengths: [9, 31, 10], firstCount: 1, first: [9, 8, 7, 6, 5, 4, 3, 2, 1], last: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], hold: 0, turn: 9, pairStep: 2, pairs: 8, frameDiv: 2, frames: 8, lion: { frames: 4, busyDown: 1, busyUp: 2, settled: 0 } }, 'menu.animation-observed');
const KEYS = () => K({ selectKeys: ['KBD_space', 'KBD_enter'], escapeKey: 'KBD_esc', escapeTo: 9, openedCursor: 1 }, 'menu.keys-observed');
const SCREEN = () => K({ background: 'CHECK.PCX', items: { lead: 1, trail: 1, width: 20 }, lions: { member: 'HANDLE.SP', size: [20, 23], frameBytes: 460, frames: [0, 4], x: [21, 284], top: 69, step: 12 }, cars: { member: 'CARS.SP', inf: '38X28.INF', frameBytes: 1064, slots: 8, slotFrames: 12, cycle: 8, pairSlots: [6, 7], centres: [27, 294], tops: [2, 3, 4, 6, 7, 8, 9, 10, 11, 12] } }, 'menu.screen-model');

// The menu's step in counts of the 136 Hz clock (the page turns it into milliseconds with frameMs).
export const menuPeriod = () => ANIM().period;

// The row the selection icons rest at for a cursor.
export const lionTopOf = cursor => SCREEN().lions.top + SCREEN().lions.step * (cursor - CURSOR().base);

// The animation starts at the first step of the first phase with the first pair (the state the game starts in is not observed).
export function createMenu() {
  const cursor = CURSOR().base;
  return { cursor, lionTop: lionTopOf(cursor), lionFrame: 0, busy: ANIM().lion.settled, phase: 1, count: ANIM().firstCount, pair: 1 };
}

// The cursor after a key: it wraps at both ends.
export function moveCursor(cursor, key) {
  const C = CURSOR(), at = cursor - C.base, next = (at + (key === 'down' ? 1 : C.items - 1)) % C.items;
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

// One step of the cars' animation (one step of the idle counter).
export function advanceAnimation(s) {
  const A = ANIM();
  if (s.phase === 1) return s.count < A.lengths[0] ? { ...s, count: s.count + 1 } : { ...s, phase: 2, count: 0 }; // @math the phase words as the game stores them
  if (s.phase === 2) return s.count < A.lengths[1] - 1 ? { ...s, count: s.count + 1 } : { ...s, phase: 3, count: 0 }; // @math the count runs 0 to length - 1
  if (s.phase === 3) return s.count < A.lengths[2] - 1 ? { ...s, count: s.count + 1 } : { ...s, phase: 4, count: 0 }; // @math the count runs 0 to length - 1
  return { ...s, phase: 1, count: A.firstCount, pair: (s.pair + A.pairStep) % A.pairs };
}

// One step of the selection icons: while busy the frame counts up, and after the last frame they settle at the cursor's row.
export function advanceLions(s) {
  const A = ANIM();
  if (s.busy === A.lion.settled) return s;
  if (s.lionFrame < A.lion.frames - 1) return { ...s, lionFrame: s.lionFrame + 1 }; // @math the frames run 0 to count - 1
  return { ...s, busy: A.lion.settled, lionFrame: 0, lionTop: lionTopOf(s.cursor) };
}

// One step of the whole menu (one step of the menu's frame, 8 counts of the 136 Hz counter): both animations advance.
export const advanceMenu = s => advanceLions(advanceAnimation(s));

// One step of the menu's frame (8 counts of the 136 Hz counter) with the key the game reads in it ('up', 'down', 'enter', 'escape' or none).
// Esc moves the cursor to the last item (menu.keys-observed). A cursor key, when the icons are not busy, moves the cursor at once and starts their animation in this step (the cars advance as always, the icons
// stay at frame 0 at their old row); a key while they are busy is dropped. Returns the new menu and the chosen item number (or 0).
export function stepFrame(menu, key) {
  const A = ANIM();
  if ((key === 'up' || key === 'down') && menu.busy === A.lion.settled) {
    return { menu: { ...advanceAnimation(menu), cursor: moveCursor(menu.cursor, key), busy: key === 'down' ? A.lion.busyDown : A.lion.busyUp, lionFrame: 0 }, chosen: 0 };
  }
  if (key === 'escape') { // Esc in the main menu puts the cursor on the last item at once, the icons already at its row
    const last = KEYS().escapeTo;
    return { menu: { ...advanceAnimation(menu), cursor: last, lionTop: lionTopOf(last), lionFrame: 0, busy: A.lion.settled }, chosen: 0 };
  }
  return { menu: advanceMenu(menu), chosen: key === 'enter' ? menu.cursor : 0 };
}

// The cars' frame in their cycle (menu.animation-observed): half the position in the 51-step cycle, modulo 8.
export function frameOf(phase, count) {
  const A = ANIM();
  const L = A.lengths, starts = [-A.firstCount, L[0], L[0] + L[1], L[0] + L[1] + L[2]]; // @math the positions of the phases' first steps: each starts where the one before ended
  return Math.floor((starts[phase - 1] + count) / A.frameDiv) % A.frames; // @math phases are numbered from 1
}

// The state the renderer takes.
export const viewOf = menu => ({ lionTop: menu.lionTop, lionFrame: menu.lionFrame, pair: menu.pair, size: sizeOf(menu.phase, menu.count), frame: frameOf(menu.phase, menu.count) });
