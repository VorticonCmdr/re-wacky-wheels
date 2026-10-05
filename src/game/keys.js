// The keyboard layout (cfg.default-keys, PROVEN; setup.key-table, PROVEN): the six keys of each of the two players as the PC scancodes the game keeps in WACKY.CFG, the names SETUP.EXE gives them, and
// the page's side of it: which browser keys a scancode is, what a player's keys do, and the rules for changing them. The game itself has no such menu (SETUP.EXE sets the keys), the page adds one under
// GAME OPTIONS and keeps the layout in this browser.
import { K } from '../evidence/k.js';

const DEFAULTS = () => K({ files: 3, piece: 1, tableAt: 0x1b6d8, players: [[0x4b, 0x4d, 0x38, 0x1d, 0x50, 0x39], [0x20, 0x21, 0x1e, 0x1f, 0x22, 0x23]], words: 6, wordBytes: 2 }, 'cfg.default-keys');
const NAMES = () => K({ keys: [[0x02, '1'], [0x03, '2'], [0x04, '3'], [0x05, '4'], [0x06, '5'], [0x07, '6'], [0x08, '7'], [0x09, '8'], [0x0a, '9'], [0x0b, '0'], [0x0c, 'MINUS'], [0x0d, 'EQUALS'], [0x0e, 'BACKSPACE'], [0x0f, 'TAB'], [0x10, 'Q'], [0x11, 'W'], [0x12, 'E'], [0x13, 'R'], [0x14, 'T'], [0x15, 'Y'], [0x16, 'U'], [0x17, 'I'], [0x18, 'O'], [0x19, 'P'], [0x1a, 'LT BRACKET'], [0x1b, 'RT BRACKET'], [0x1c, 'ENTER'], [0x1d, 'CTRL'], [0x1e, 'A'], [0x1f, 'S'], [0x20, 'D'], [0x21, 'F'], [0x22, 'G'], [0x23, 'H'], [0x24, 'J'], [0x25, 'K'], [0x26, 'L'], [0x27, 'SEMI COLON'], [0x28, 'APOSTROPHE'], [0x29, 'SINGLE QUOTE'], [0x2a, 'LEFT SHIFT'], [0x2b, 'BACKSLASH'], [0x2c, 'Z'], [0x2d, 'X'], [0x2e, 'C'], [0x2f, 'V'], [0x30, 'B'], [0x31, 'N'], [0x32, 'M'], [0x33, 'COMMA'], [0x34, 'PERIOD'], [0x35, 'SLASH'], [0x36, 'RIGHT SHIFT'], [0x37, 'ASTERISK'], [0x38, 'ALT'], [0x39, 'SPACE'], [0x47, 'HOME'], [0x48, 'UP CURSOR'], [0x49, 'PGUP'], [0x4a, 'MINUS'], [0x4b, 'LEFT CURSOR'], [0x4c, '5'], [0x4d, 'RIGHT CURSOR'], [0x4e, 'PLUS'], [0x4f, 'END'], [0x50, 'DOWN CURSOR'], [0x51, 'PGDN'], [0x52, 'INS'], [0x53, 'DEL'], [0x56, 'BACKSLASH']] }, 'setup.key-table');

// The slots of a player's keys in the table's order (cfg.default-keys): steer left, steer right, button 1 accelerate, button 2 fire, button 3 brake, button 4 hand brake turn.
export const SLOTS = ['left', 'right', 'accelerate', 'fire', 'brake', 'spin'];
// What the page calls the slots in its list.
export const SLOT_LABELS = ['STEER LEFT', 'STEER RIGHT', 'ACCELERATE', 'FIRE', 'BRAKE', 'HAND BRAKE'];

// The browser's key codes of each scancode, as "scancode in hex, the codes" (the keypad's digits and the cursor keys are one scancode, both left and right Alt, Ctrl and Shift are the game's one key).
const BROWSER = '02 Digit1|03 Digit2|04 Digit3|05 Digit4|06 Digit5|07 Digit6|08 Digit7|09 Digit8|0a Digit9|0b Digit0|0c Minus|0d Equal|0e Backspace|0f Tab|10 KeyQ|11 KeyW|12 KeyE|13 KeyR|14 KeyT|15 KeyY|16 KeyU|17 KeyI|18 KeyO|19 KeyP|1a BracketLeft|1b BracketRight|1c Enter NumpadEnter|1d ControlLeft ControlRight|1e KeyA|1f KeyS|20 KeyD|21 KeyF|22 KeyG|23 KeyH|24 KeyJ|25 KeyK|26 KeyL|27 Semicolon|28 Quote|29 Backquote|2a ShiftLeft|2b Backslash|2c KeyZ|2d KeyX|2e KeyC|2f KeyV|30 KeyB|31 KeyN|32 KeyM|33 Comma|34 Period|35 Slash NumpadDivide|36 ShiftRight|37 NumpadMultiply|38 AltLeft AltRight|39 Space|47 Home Numpad7|48 ArrowUp Numpad8|49 PageUp Numpad9|4a NumpadSubtract|4b ArrowLeft Numpad4|4c Numpad5|4d ArrowRight Numpad6|4e NumpadAdd|4f End Numpad1|50 ArrowDown Numpad2|51 PageDown Numpad3|52 Insert Numpad0|53 Delete NumpadDecimal|56 IntlBackslash'; // @math the PC scancodes in hex (radix 16)
const CODES = new Map(BROWSER.split('|').map(entry => { const [scan, ...codes] = entry.split(' '); return [parseInt(scan, 16), codes]; })); // @math hex scancodes
// The page's conveniences on the game's own default keys: Up accelerates like Alt and Z brakes like Down (the manual's keys are Alt and Down).
const ALIASES = { 2: { 0x38: ['ArrowUp'] }, 4: { 0x50: ['KeyZ'] } }; // @math the slot 2 (accelerate) and 4 (brake) of the first player

export const defaultKeys = () => DEFAULTS().players.map(p => [...p]);

// The name SETUP.EXE gives a scancode, or null.
export const keyName = scancode => NAMES().keys.find(([c]) => c === scancode)?.[1] ?? null;
// The scancode of a browser key code when SETUP.EXE offers that key, else null.
export const scancodeOf = code => { for (const [scan, codes] of CODES) if (codes.includes(code) && keyName(scan) !== null) return scan; return null; };

// The browser codes that hold slot `slot` of player `player`: the key's own, and on the first player's default accelerate and brake keys the page's alternatives.
export const codesOf = (keys, player, slot) => {
  const scan = keys[player][slot], own = CODES.get(scan) ?? [], extra = player === 0 && scan === DEFAULTS().players[0][slot] ? ALIASES[slot]?.[scan] ?? [] : []; // @math the first player
  return [...own, ...extra];
};

// The input of a player from `has(code)`, the page's test of a held browser key: { left, right, accelerate, fire, brake, spin }.
export const inputOf = (has, keys, player) => Object.fromEntries(SLOTS.map((name, slot) => [name, codesOf(keys, player, slot).some(has)]));

// The names of a player's six keys, as the lists show them.
export const namesOf = (keys, player) => keys[player].map(scan => keyName(scan) ?? '?');

// A chosen key for a slot: the new table, or the conflict SETUP.EXE reports ('you' for a key the player has already, 'other' for one of the other player's, SETUP.EXE's KEY CONFLICT messages), or
// null for the key the slot has already.
export function rebind(keys, player, slot, scancode) {
  if (keys[player][slot] === scancode) return { keys };
  if (keys[player].includes(scancode)) return { conflict: 'you' };
  if (keys[1 - player].includes(scancode)) return { conflict: 'other' }; // @math the other player
  return { keys: keys.map((p, n) => (n === player ? p.map((s, k) => (k === slot ? scancode : s)) : [...p])) };
}

// Whether a stored layout is usable: two players of six scancodes SETUP.EXE offers, none twice.
export function validKeys(keys) {
  if (!Array.isArray(keys) || keys.length !== DEFAULTS().players.length) return false;
  const all = keys.flat();
  return keys.every(p => Array.isArray(p) && p.length === SLOTS.length) && all.every(s => keyName(s) !== null) && new Set(all).size === all.length;
}

// The layout kept in this browser (localStorage may be missing or throw): the default one when nothing usable is stored.
const STORE = 'wackywheels.keys';
export function loadKeys(storage = globalThis.localStorage) {
  try { const keys = JSON.parse(storage.getItem(STORE)); if (validKeys(keys)) return keys; } catch { /* no storage or nothing stored */ }
  return defaultKeys();
}
export function saveKeys(keys, storage = globalThis.localStorage) {
  try { storage.setItem(STORE, JSON.stringify(keys)); } catch { /* storage is not available: the layout lasts until the page closes */ }
}

// The lines of the controls help (menu.controls-help) call for the names of the keys of the layout.
export const isDefault = keys => JSON.stringify(keys) === JSON.stringify(defaultKeys());
