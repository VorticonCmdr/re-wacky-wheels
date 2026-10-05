// The keys of the two players of a split screen game and of the vehicle screens. The layout is the game's key table (cfg.default-keys, PROVEN for the installed files: player one the arrows, Alt, Ctrl and
// Space, player two D, F, A, S, G and H) or the one the player set in the page's keyboard menu (keys.js); the page maps each scancode to the browser's key code of the same key.
import { defaultKeys, inputOf, codesOf, SLOTS } from './keys.js';

// The input of both players from `has(code)`, the page's test of a held browser key.
export function versusKeys(has, keys = defaultKeys()) {
  return { p1: inputOf(has, keys, 0), p2: inputOf(has, keys, 1) }; // @math the two players
}

// The keys that end the controls screen of a player (menu.controls-help): Enter and Space and the player's four buttons, the entries 2 to 5 of the key table.
export const buttonCodes = (player, keys = defaultKeys()) => ['Enter', ...SLOTS.flatMap((_, slot) => (slot >= 2 ? codesOf(keys, player, slot) : []))]; // @math the buttons are the entries 2 to 5 (obj1+0x277ae); Space is one of them
