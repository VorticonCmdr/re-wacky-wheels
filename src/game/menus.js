// The menus of the game as a tree (menu.tree-observed): each menu has a layout variant ('main' or 'sub', menu.screen-model), the texts of its items and, for
// each item, what choosing it does. A menu enters this table only when a recording of the running game shows its page, and a link between menus only when a
// recorded path of key taps opens it. The menu of switches has items that follow the settings.
import { K } from '../evidence/k.js';
import { menuItems, layoutOf } from '../render/menu.js';
import { forcedOf, noticeOf } from './classes.js';
import { restoreItems } from './save.js';
import { zonesMenuItems } from './duckflow.js';
import { FLOW as VERSUS_FLOW, RACE as VERSUS_RACE } from './versus-rules.js';
import { defaultKeys, namesOf, SLOT_LABELS } from './keys.js';
import { SOUND_MENU, defaultDevices, deviceList } from './sound-devices.js';

const TREE = () => K({ menus: { options: { items: ['GRAPHIC DETAIL LEVELS', 'VOLUME LEVELS', 'RACE SCREEN OPTIONS', 'LEAVE THIS MENU'] }, comm: { items: ['MODEM', 'SERIAL CABLE', 'LEAVE THIS MENU'] }, detail: { items: ['SINGLE SCREEN DETAIL', 'SPLIT SCREEN DETAIL', 'LEAVE THIS MENU'] }, toggles: { items: ['OVERHEAD MAP', 'CLOCK DISPLAY', 'SPEEDOMETER', 'LEAVE THIS MENU'], width: 17, on: 'ON ', off: 'OFF', words: [0x175d0, 0x175d2, 0x175d4] }, single: { items: ['HIGH   DETAIL', 'MEDIUM DETAIL', 'LOW    DETAIL'], word: 0x1ee58 }, split: { items: ['HIGH   DETAIL', 'MEDIUM DETAIL', 'LOW    DETAIL'], word: 0x174de }, info: { items: ['ORDERING', 'INSTRUCTIONS', 'FAMOUS DRIVERS', 'CREDITS', 'LEAVE THIS MENU'] }, class: { items: ['AMATEUR  CLASS', 'PRO      CLASS', 'CHAMPION CLASS', 'TIME TRIAL', 'KID MODE'] }, laps: { items: ['SIX LAP RACE', 'EIGHT LAP RACE', 'TEN LAP RACE'] }, engine: { items: ['FAST 12 HP ENGINES', 'SLOW 6 HP ENGINES'] }, races: { items: ['REGULAR RACES', 'BONUS PACK RACES'] } }, flow: ['class', 'laps', 'engine', 'races'], opens: [['main', 7, 'info'], ['main', 6, 'options'], ['main', 5, 'comm'], ['options', 1, 'detail'], ['options', 3, 'toggles'], ['detail', 1, 'single'], ['detail', 2, 'split']], shifts: { main: 0, options: 0, comm: 0, toggles: 0, info: 0, detail: -28, single: -52, split: -52, class: -432, laps: -432, engine: -444, races: -432 }, leave: 'LEAVE THIS MENU' }, 'menu.tree-observed');

// The FAMOUS DRIVERS menus of the Info menu (menu.famous-menus): the classes, the cups and the time trial's cups and tracks, built for the bonus pack of the settings.
const FAM = () => K({ drivers: { items: ['AMATEUR CLASS DRIVERS', 'PRO CLASS DRIVERS', 'CHAMP CLASS DRIVERS', 'TIME TRIAL DRIVERS', 'LEAVE THIS MENU'] }, cups: { items: ['BRONZE RACE', 'SILVER RACE', 'GOLD RACE', 'LEAVE THIS MENU'], bonus: 'BONUS' }, trials: { items: ['BRONZE TRIALS', 'SILVER TRIALS', 'GOLD TRIALS', 'LEAVE THIS MENU'], bonus: 'BONUS' }, tracks: { names: ['BRONZE', 'SILVER', 'GOLD'], track: 'TRACK', count: 5, leave: 'LEAVE THIS MENU' }, opens: { info: 3, drivers: [1, 2, 3], trial: 4 } }, 'menu.famous-menus');
const FAM_ID = /^(drivers|trials|cups[123]|tracks[123]|restore|zones|hits|duoMode|duoClass|keys|keysOne|keysTwo|sound|soundEffects|soundMusic)$/;
// The keyboard layout menus, which the game does not have (SETUP.EXE sets its keys): GAME OPTIONS gets the item KEYBOARD CONTROLS, which opens the list of the two players and the defaults; a player's list
// shows each of the six keys with the name SETUP.EXE gives it (setup.key-table) and Enter on a line asks for the key. The wording is SETUP.EXE's ("Player 1 keyboard controls", "Redefine keyboard controls").
const KEY_MENU = { item: 'KEYBOARD CONTROLS', items: ['PLAYER ONE KEYS', 'PLAYER TWO KEYS', 'DEFAULT KEYS', 'LEAVE THIS MENU'], titles: ['PLAYER 1 KEYBOARD CONTROLS', 'PLAYER 2 KEYBOARD CONTROLS'], labelWidth: 12 }; // @math the label column: the longest label, STEER RIGHT, and a space (the bars then end inside the screen with the icons)
function famousDef(id, settings) {
  const F = FAM(), pack = settings.flow.races === 2, prefixed = (list, bonus) => list.map((t, k) => (pack && k < list.length - 1 ? `${bonus} ${t}` : t)); // @math the bonus pack is the second race type; the last item is LEAVE THIS MENU
  const back = { back: true }, last = n => n - 1; // @math the last item
  if (id === 'keys') return { items: KEY_MENU.items, actions: [{ open: 'keysOne' }, { open: 'keysTwo' }, { keysDefault: true }, back] }; // the keyboard layout menus (the page's own, not the game's)
  if (id === 'sound') return { items: [...SOUND_MENU.items, TREE().leave], actions: [{ open: 'soundEffects' }, { open: 'soundMusic' }, back] }; // the sound device menus (the page's own, not the game's)
  if (id === 'soundEffects' || id === 'soundMusic') { const { key, items } = deviceList(id); return { items, actions: items.map(() => ({ pick: { group: 'sound', key } })) }; } // a list of devices opens on the current one and the item picked is the choice
  if (id === 'keysOne' || id === 'keysTwo') { const player = id === 'keysOne' ? 0 : 1, names = namesOf(settings.keys, player), items = [...SLOT_LABELS.map((label, k) => label.padEnd(KEY_MENU.labelWidth) + names[k]), TREE().leave]; return { items, actions: items.map((_, k) => (k === last(items.length) ? back : { rebind: { player, slot: k } })) }; }
  if (id === 'restore') return { items: restoreItems(), actions: [{ restore: true }, { newGame: true }] }; // the saved game's menu (race.save-game)
  if (id === 'duoMode') return { items: VERSUS_RACE().menu, actions: VERSUS_RACE().menu.map((_, i) => ({ duo: i + 1 })) }; // RACE HEAD TO HEAD and RACE WITH ALL CARS: the two player race word // @math items count from 1
  if (id === 'duoClass') return { items: ['AMATEUR  CLASS', 'PRO      CLASS', 'CHAMPION CLASS'], actions: [0, 1, 2].map(() => ({ goto: 'laps' })) }; // the class menu of the two player race with all cars: three of the single player's five (obj1+0xa0a2) // @math the first three items
  if (id === 'hits') return { items: VERSUS_FLOW().hits.items, actions: VERSUS_FLOW().hits.items.map((_, i) => ({ hits: i + 1 })) }; // PLAY FOR n HITS of the shoot-out (versus.flow): the item number times the step is the hits word // @math items count from 1
  if (id === 'zones') return { items: zonesMenuItems(), actions: [{ duckZones: false }, { duckZones: true }] }; // REGULAR ZONES / BONUS PACK ZONES of the duck game (duck.flow)
  if (id === 'drivers') return { items: F.drivers.items, actions: F.drivers.items.map((_, i) => (i === last(F.drivers.items.length) ? back : i === F.opens.trial - 1 ? { open: 'trials' } : { open: `cups${i + 1}` })) }; // @math items count from 1
  if (id.startsWith('cups')) { const cls = Number(id.slice(-1)); return { items: prefixed(F.cups.items, F.cups.bonus), actions: F.cups.items.map((_, i) => (i === last(F.cups.items.length) ? back : { famous: { cls, cup: i + 1 } })) }; } // @math the cup counts from 1
  if (id === 'trials') return { items: prefixed(F.trials.items, F.trials.bonus), actions: F.trials.items.map((_, i) => (i === last(F.trials.items.length) ? back : { open: `tracks${i + 1}` })) }; // @math items count from 1
  const cup = Number(id.slice(-1)), T = F.tracks, items = [...Array.from({ length: T.count }, (_, j) => `${T.names[cup - 1]} ${T.track} ${j + 1}`), T.leave]; // @math the cup counts from 1, the tracks too
  return { items, actions: items.map((_, j) => (j === T.count ? back : { hall: { cup, race: j + 1 } })) }; // @math the tracks count from 1
}

export const famousIds = () => ['restore', 'drivers', 'trials', 'cups1', 'cups2', 'cups3', 'tracks1', 'tracks2', 'tracks3']; // the menus of menu.famous-menus
// The boxed title some menus show above their bars (menu.engine-banner): the engine menu's, as { text, row }, else null.
const BANNER = () => K({ routine: 0x1a414, caller: 0x68cd, menu: 'engine', row: 0x4e, text: 'LEE & JACKSON LAWNMOWERS' }, 'menu.engine-banner');
export function bannerOfMenu(id, settings = null) {
  const B = BANNER();
  if (id === B.menu) return { text: B.text, row: B.row };
  if ((id === 'keysOne' || id === 'keysTwo') && settings) { // the keyboard menus show SETUP.EXE's title in the same box and at the same distance above the first bar as the engine menu's
    const gap = layoutOf('sub', TREE().menus.engine.items).y0 - B.row, player = id === 'keysOne' ? 0 : 1; // @math the first player is 0
    return { text: KEY_MENU.titles[player], row: layoutOf('sub', menuDef(id, settings).items).y0 - gap };
  }
  return null;
}
export const menuIds = () => ['main', ...Object.keys(TREE().menus)];

// Where the state words of a menu lie, in bytes below the block of the main menu (menu.tree-observed): what a recorder has to read.
export const shiftOf = id => TREE().shifts[id];

// The place of a Race Screen Options switch in the settings, by the game word it sets (obj2+0x175d0, +0x175d2, +0x175d4): -1 when no switch sets it.
export const switchOf = word => TREE().menus.toggles.words.indexOf(word);

// The settings the menus change: the switches of the race screen (1 on, 0 off) and the detail levels of the single and split screen (1 high, 2 medium, 3 low). Where
// they start are the words of WACKY.CFG (menu.default-settings): every switch on and both levels HIGH in the installed files; the page may pass the level the player chose.
// `famous` turns on the menus that no recording shows (menu.famous-menus): the page's menu has them, the records' replays do not.
const DEFAULTS = () => K({ files: 3, words: 5, switch: 1, level: 1, fileOffsets: [0x952, 0x954, 0x956, 0x3c, 0x860] }, 'menu.default-settings');
export const defaultSettings = (detail = DEFAULTS().level, famous = false) => ({ famous, switches: TREE().menus.toggles.words.map(() => DEFAULTS().switch), detail: { single: detail, split: detail }, flow: Object.fromEntries(TREE().flow.map(id => [id, 1])), keys: defaultKeys(), sound: defaultDevices() }); // @math one switch for each word; the first level and the first item of every setup menu

// The text of a switch: its name, then ON or OFF at the end of a bar of fixed width.
const switchText = (T, name, on) => name.padEnd(T.menus.toggles.width - T.menus.toggles.on.length) + (on ? T.menus.toggles.on : T.menus.toggles.off);

// The definition of a menu: { kind, items, actions }. An action is { open: id }, { goto: id } for the next menu of a sequence, { back: true }, { switch: n } to flip a switch of the race screen, { race: item }
// for the single player race the page starts, or { pending: what } for an item whose screen was not recorded yet. In the main menu SINGLE PLAYER RACING is the first item.
export function menuDef(id, settings = defaultSettings()) {
  const T = TREE(), main = id === 'main', famous = FAM_ID.test(id), def = main ? { items: menuItems() } : famous ? famousDef(id, settings) : T.menus[id];
  if (!def) throw new Error(`no menu ${id}`);
  if (famous) return { id, kind: 'sub', items: def.items, actions: def.actions, flowStep: id === 'duoClass' };
  if (id === 'options' && settings.famous) def.items = [...def.items.slice(0, -1), KEY_MENU.item, SOUND_MENU.item, def.items.at(-1)]; // the page's own items before LEAVE THIS MENU (the records of the game's menu have four items)
  const items = id === 'toggles' ? def.items.map((name, i) => (name === T.leave ? name : switchText(T, name, settings.switches[i]))) : def.items;
  const actions = def.items.map((text, i) => {
    const link = T.opens.find(([from, item]) => from === id && item === i + 1); // @math items count from 1
    if (!link && settings.famous && id === 'info' && i + 1 === FAM().opens.info) return { open: 'drivers' }; // @math items count from 1: FAMOUS DRIVERS
    if (link) return { open: link[2] }; // @math the target menu is the third word of a link
    if (!main && text === T.leave) return { back: true };
    const step = T.flow.indexOf(id); // the menus of the single player race setup follow one another
    if (step >= 0) {
      const skip = id === T.flow[0] ? forcedOf(i + 1).skip : [], next = T.flow.slice(step + 1).find(m => !skip.includes(m)); // @math the class menu's item skips the menus its class forces; items count from 1
      const notice = id === T.flow[0] ? noticeOf(i + 1) : null; // @math items count from 1
      return next ? { goto: next, ...(notice ? { notice } : {}) } : { race: 1 };
    }
    if (id === 'toggles') return { switch: i };
    if (def.word !== undefined) return { choose: id }; // the item number is the level
    if (settings.famous && (text === 'ORDERING INFO' || (id === 'info' && text === 'ORDERING'))) return { slides: 'ordering' }; // the pages OR1 to OR11 (menu.slides)
    if (settings.famous && id === 'info' && text === 'INSTRUCTIONS') return { slides: 'instructions' }; // the pages INT1 to INT8
    if (id === 'options' && text === 'VOLUME LEVELS') return { volume: true }; // the volume screen (menu.volume-screen)
    if (id === 'options' && text === KEY_MENU.item) return { open: 'keys' };
    if (id === 'options' && text === SOUND_MENU.item) return { open: 'sound' };
    if (id === 'info' && text === 'CREDITS') return { credits: true }; // the credits pages (menu.credits)
    if (main && i === def.items.length - 1) return { leave: true }; // LEAVE GAME, the last item: the game ends on its text screen (exit.screen-select)
    if (main && i === 1) return { duoMenu: true }; // @math the second item of the main menu, TWO PLAYER RACE: head to head or with all cars first (versus.race-rules)
    if (main && i === 2) return { shoot: true }; // @math the third item of the main menu, TWO PLAYER SHOOT OUT: the vehicle screen for each player, the hits menu and the zones (versus.flow)
    if (main && i === 3) return { duck: true }; // @math the fourth item of the main menu, WACKY DUCK SHOOT: the vehicle screen, then the zones (duck.flow)
    if (main && i === 0) return { vehicle: T.flow[0] }; // @math the first item of the main menu, SINGLE PLAYER RACING: the vehicle screen and then the first menu of the setup (menu.vehicle-screen)
    return { pending: text };
  });
  return { id, kind: main ? 'main' : 'sub', items, actions, flowStep: T.flow.includes(id) };
}
