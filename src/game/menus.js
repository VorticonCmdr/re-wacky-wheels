// The menus of the game as a tree (menu.tree-observed): each menu has a layout variant ('main' or 'sub', menu.screen-model), the texts of its items and, for
// each item, what choosing it does. A menu enters this table only when a recording of the running game shows its page, and a link between menus only when a
// recorded path of key taps opens it. The menu of switches has items that follow the settings.
import { K } from '../evidence/k.js';
import { menuItems } from '../render/menu.js';

const TREE = () => K({ menus: { options: { items: ['GRAPHIC DETAIL LEVELS', 'VOLUME LEVELS', 'RACE SCREEN OPTIONS', 'LEAVE THIS MENU'] }, comm: { items: ['MODEM', 'SERIAL CABLE', 'LEAVE THIS MENU'] }, detail: { items: ['SINGLE SCREEN DETAIL', 'SPLIT SCREEN DETAIL', 'LEAVE THIS MENU'] }, toggles: { items: ['OVERHEAD MAP', 'CLOCK DISPLAY', 'SPEEDOMETER', 'LEAVE THIS MENU'], width: 17, on: 'ON ', off: 'OFF', words: [0x175d0, 0x175d2, 0x175d4] }, single: { items: ['HIGH   DETAIL', 'MEDIUM DETAIL', 'LOW    DETAIL'], word: 0x1ee58 }, split: { items: ['HIGH   DETAIL', 'MEDIUM DETAIL', 'LOW    DETAIL'], word: 0x174de }, info: { items: ['ORDERING', 'INSTRUCTIONS', 'FAMOUS DRIVERS', 'CREDITS', 'LEAVE THIS MENU'] }, class: { items: ['AMATEUR  CLASS', 'PRO      CLASS', 'CHAMPION CLASS', 'TIME TRIAL', 'KID MODE'] }, laps: { items: ['SIX LAP RACE', 'EIGHT LAP RACE', 'TEN LAP RACE'] }, engine: { items: ['FAST 12 HP ENGINES', 'SLOW 6 HP ENGINES'] }, races: { items: ['REGULAR RACES', 'BONUS PACK RACES'] } }, flow: ['class', 'laps', 'engine', 'races'], opens: [['main', 7, 'info'], ['main', 6, 'options'], ['main', 5, 'comm'], ['options', 1, 'detail'], ['options', 3, 'toggles'], ['detail', 1, 'single'], ['detail', 2, 'split']], shifts: { main: 0, options: 0, comm: 0, toggles: 0, info: 0, detail: -28, single: -52, split: -52, class: -432, laps: -432, engine: -444, races: -432 }, leave: 'LEAVE THIS MENU' }, 'menu.tree-observed');

export const menuIds = () => ['main', ...Object.keys(TREE().menus)];

// Where the state words of a menu lie, in bytes below the block of the main menu (menu.tree-observed): what a recorder has to read.
export const shiftOf = id => TREE().shifts[id];

// The place of a Race Screen Options switch in the settings, by the game word it sets (obj2+0x175d0, +0x175d2, +0x175d4): -1 when no switch sets it.
export const switchOf = word => TREE().menus.toggles.words.indexOf(word);

// The settings the menus change: the switches of the race screen (1 on, 0 off) and the detail levels of the single and split screen (1 high, 2 medium, 3 low). Where
// they start is not established (UNKNOWN_MENU_DEFAULT_SETTINGS): every switch on and both levels at the first item until the page says otherwise.
export const defaultSettings = (detail = 1) => ({ switches: TREE().menus.toggles.words.map(() => 1), detail: { single: detail, split: detail }, flow: Object.fromEntries(TREE().flow.map(id => [id, 1])) }); // @math one switch for each word; the first level and the first item of every setup menu

// The text of a switch: its name, then ON or OFF at the end of a bar of fixed width.
const switchText = (T, name, on) => name.padEnd(T.menus.toggles.width - T.menus.toggles.on.length) + (on ? T.menus.toggles.on : T.menus.toggles.off);

// The definition of a menu: { kind, items, actions }. An action is { open: id }, { goto: id } for the next menu of a sequence, { back: true }, { switch: n } to flip a switch of the race screen, { race: item }
// for the single player race the page starts, or { pending: what } for an item whose screen was not recorded yet. In the main menu SINGLE PLAYER RACING is the first item.
export function menuDef(id, settings = defaultSettings()) {
  const T = TREE(), main = id === 'main', def = main ? { items: menuItems() } : T.menus[id];
  if (!def) throw new Error(`no menu ${id}`);
  const items = id === 'toggles' ? def.items.map((name, i) => (name === T.leave ? name : switchText(T, name, settings.switches[i]))) : def.items;
  const actions = def.items.map((text, i) => {
    const link = T.opens.find(([from, item]) => from === id && item === i + 1); // @math items count from 1
    if (link) return { open: link[2] }; // @math the target menu is the third word of a link
    if (!main && text === T.leave) return { back: true };
    const step = T.flow.indexOf(id); // the menus of the single player race setup follow one another
    if (step >= 0) return T.flow[step + 1] ? { goto: T.flow[step + 1] } : { race: 1 }; // @math the next menu of the sequence; the last one starts the race (the cup board and the track preview are not ported)
    if (id === 'toggles') return { switch: i };
    if (def.word !== undefined) return { choose: id }; // the item number is the level
    if (main && i === 0) return { goto: T.flow[0] }; // @math the first item of the main menu, SINGLE PLAYER RACING: the vehicle screen (not ported) and then the first menu of the setup
    return { pending: text };
  });
  return { id, kind: main ? 'main' : 'sub', items, actions, flowStep: T.flow.includes(id) };
}
