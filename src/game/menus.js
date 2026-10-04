// The menus of the game as a tree (menu.tree-observed): each menu has a layout variant ('main' or 'sub', menu.screen-model), the texts of its items and, for
// each item, what choosing it does. A menu enters this table only when a recording of the running game shows its page, and a link between menus only when a
// recorded path of key taps opens it. The menu of switches has items that follow the settings.
import { K } from '../evidence/k.js';
import { menuItems } from '../render/menu.js';

const TREE = () => K({ menus: { options: { items: ['GRAPHIC DETAIL LEVELS', 'VOLUME LEVELS', 'RACE SCREEN OPTIONS', 'LEAVE THIS MENU'] }, comm: { items: ['MODEM', 'SERIAL CABLE', 'LEAVE THIS MENU'] }, detail: { items: ['SINGLE SCREEN DETAIL', 'SPLIT SCREEN DETAIL', 'LEAVE THIS MENU'] }, toggles: { items: ['OVERHEAD MAP', 'CLOCK DISPLAY', 'SPEEDOMETER', 'LEAVE THIS MENU'], width: 17, on: 'ON ', off: 'OFF', words: [0x175d0, 0x175d2, 0x175d4] } }, opens: [['main', 6, 'options'], ['main', 5, 'comm'], ['options', 1, 'detail'], ['options', 3, 'toggles']], leave: 'LEAVE THIS MENU' }, 'menu.tree-observed');

export const menuIds = () => ['main', ...Object.keys(TREE().menus)];

// The settings the menus change: the switches of the race screen (1 on, 0 off), all on in the records.
export const defaultSettings = () => ({ switches: TREE().menus.toggles.words.map(() => 1) }); // @math one switch for each word

// The text of a switch: its name, then ON or OFF at the end of a bar of fixed width.
const switchText = (T, name, on) => name.padEnd(T.menus.toggles.width - T.menus.toggles.on.length) + (on ? T.menus.toggles.on : T.menus.toggles.off);

// The definition of a menu: { kind, items, actions }. An action is { open: id }, { back: true }, { switch: n } to flip a switch of the race screen, { race: item }
// for the single player race the page starts, or { pending: what } for an item whose screen was not recorded yet. In the main menu SINGLE PLAYER RACING is the first item.
export function menuDef(id, settings = defaultSettings()) {
  const T = TREE(), main = id === 'main', def = main ? { items: menuItems() } : T.menus[id];
  if (!def) throw new Error(`no menu ${id}`);
  const items = id === 'toggles' ? def.items.map((name, i) => (name === T.leave ? name : switchText(T, name, settings.switches[i]))) : def.items;
  const actions = def.items.map((text, i) => {
    const link = T.opens.find(([from, item]) => from === id && item === i + 1); // @math items count from 1
    if (link) return { open: link[2] }; // @math the target menu is the third word of a link
    if (!main && text === T.leave) return { back: true };
    if (id === 'toggles') return { switch: i };
    if (main && i === 0) return { race: 1 }; // @math the first item of the main menu, SINGLE PLAYER RACING
    return { pending: text };
  });
  return { id, kind: main ? 'main' : 'sub', items, actions };
}
