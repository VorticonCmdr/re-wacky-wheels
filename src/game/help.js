// The controls screen of the vehicle screens (menu.controls-help, STATIC): F1 shows the keys of the player whose turn it is, any key goes back. The text and the places of the lines are
// the game's; the names of the keys are the ones of the configuration's key table (cfg.key-names), which the page may replace with the names of its own keys.
import { K } from '../evidence/k.js';

const HELP = () => K({ routine: 0xc0f4, callSites: [0xb2df, 0xb415], key: 0x3b, box: { x: 0, y: 0, width: 320, height: 200, border: 38, fill: 44 }, header: { prefix: 'PLAYER ', suffix: ' CONTROLS', y: 8 }, lines: [{ text: 'USE LEFT AND RIGHT CONTROLS TO CHOOSE', y: 20 }, { text: 'THEN PRESS FIRE TO SELECT THE CAR', y: 30 }], controller: { x: 16, y: 60 }, keys: { x: 16, y: 76, step: 10, labels: ['STEER LEFT      - ', 'STEER RIGHT     - ', 'ACCELERATE      - ', 'FIRE WEAPONS    - ', 'BRAKES          - ', 'HAND BRAKE TURN - '], names: [['LEFT CURSOR', 'RIGHT CURSOR', 'ALT', 'CTRL', 'DOWN CURSOR', 'SPACE'], ['D', 'F', 'A', 'S', 'G', 'H']], tableAt: 0x17432, playerBytes: 0x54 }, giggle: { y: 146, texts: ['F1 - F6 ARE YOUR GIGGLE KEYS!', '1  - 6  ARE YOUR GIGGLE KEYS!'] }, leave: { text: 'PRESS FIRE TO LEAVE HELP', y: 186 }, glyph: 8, screen: 320 }, 'menu.controls-help');

// The key that opens the screen, as the browser names it (the scancode 0x3b of F1).
export const HELP_KEY = 'F1'; // @math the browser's name of the scancode HELP().key (0x3b)

// The lines of the screen for the player `player` (0 or 1): [{ text, x, y }], in the order the routine draws them. `versus` is a two player mode (the giggle keys line), `controller` the
// controller's name, `names` the names of the player's six keys (default: the configuration's).
export function helpLines({ player = 0, versus = false, controller = 'KEYBOARD', names = null } = {}) {
  const H = HELP(), G = H.glyph, centred = text => Math.floor((H.screen - G * text.length) / 2); // @math the routine centres a line by half the width left over
  const title = `${H.header.prefix}${player + 1}${H.header.suffix}`, own = names ?? H.keys.names[player];
  const lines = [{ text: title, x: centred(title), y: H.header.y }, ...H.lines.map(l => ({ text: l.text, x: centred(l.text), y: l.y })), { text: controller, x: H.controller.x, y: H.controller.y }];
  H.keys.labels.forEach((label, k) => lines.push({ text: label + own[k], x: H.keys.x, y: H.keys.y + H.keys.step * k }));
  if (versus) lines.push({ text: H.giggle.texts[player === 0 ? 0 : 1], x: H.keys.x, y: H.giggle.y });
  lines.push({ text: H.leave.text, x: centred(H.leave.text), y: H.leave.y });
  return lines;
}

export const helpBox = () => HELP().box;
