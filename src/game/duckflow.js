// The screens around the duck game (duck.flow, STATIC): the zone chooser with its blinking label bar, the intro and end screens' layouts, the table of the top shooters and its insertion.
// The race itself is duck.js; the page (src/play.js) runs the screens in the order of the flow.
import { FLOW } from './duck-rules.js';

export const zonesMenuItems = () => FLOW().menu.items;
export const chooserPictures = () => FLOW().chooser.pictures;
export const pauseItems = () => FLOW().pause;
export const loadingText = () => FLOW().loading.text;
export const entryInfo = () => FLOW().entry;
export const duckSong = zone => FLOW().songs[zone - 1]; // @math the zones count from 1

// The chooser: the zone (1 to 6; the game keeps the word 6 to 11), its bar visible at first, the passes since the bar last toggled.
export const createChooser = (zone = 1, bonus = false) => ({ zone, bonus, passes: 0, visible: true });

// One pass of the chooser's loop (obj1+0x93a8: 8 counts of the 136 Hz counter, 0x14 more after an action). `key` is 'up' (the zone before), 'down' (the zone after), 'fire', 'escape' or null.
// Returns the chooser, the zone chosen (1 to 6) or null, whether it was left, the counts the pass takes and the sound.
export function stepChooser(c, key) {
  const F = FLOW().chooser, zones = F.last - F.first + 1;
  if (key === 'escape') return { chooser: c, chosen: null, escape: true, wait: F.pass, sound: null };
  if (key === 'fire') return { chooser: c, chosen: c.zone, escape: false, wait: F.pass + F.pause, sound: F.sound };
  if (key === 'up' || key === 'down') {
    const zone = ((c.zone - 1 + (key === 'down' ? 1 : zones - 1)) % zones) + 1; // @math the zones count from 1 and wrap
    return { chooser: { ...c, zone, passes: 0, visible: true }, chosen: null, escape: false, wait: F.pass + F.pause, sound: null }; // a move shows the new bar at once
  }
  const passes = c.passes + 1;
  return { chooser: passes >= F.blink ? { ...c, passes: 0, visible: !c.visible } : { ...c, passes }, chosen: null, escape: false, wait: F.pass, sound: null };
}

// The picture's palette with the label bars blacked out but the selected one while it is shown (obj1+0x9563 to +0x95a7): the bars are the entries 5 to 10.
export function chooserPalette(vga, c) {
  const F = FLOW().chooser, out = vga.slice(), width = 3; // @math three components an entry
  for (let k = F.indices[0]; k <= F.indices[1]; k++) {
    const shown = c.visible && k === F.indices[0] + c.zone - 1; // @math the zones count from 1
    if (!shown) for (let j = 0; j < width; j++) out[k * width + j] = 0;
  }
  return out;
}

// The table of the top shooters: the names and scores the game builds without WACKY.DTT.
export const defaultTable = () => { const T = FLOW().table; return T.names.map((name, i) => ({ name, score: T.scores[i] })); };

// A table from the bytes of WACKY.DTT (parseDuckTable's entries): names trimmed of their padding.
export const tableOf = entries => entries.map(e => ({ name: e.name.replace(/[\s\0]+$/, ''), score: e.score }));

// Whether a score enters the table: it is not below the last entry (obj1+0x1b65b to +0x1b68a).
export const qualifies = (table, score) => score >= table.at(-1).score;

// The table with a new entry: it goes above the first entry it is not below, the entries under it move down and the last is lost (obj1+0x1b723 to +0x1b7e7).
export function insertScore(table, name, score) {
  const at = table.findIndex(e => score >= e.score);
  if (at < 0) return table;
  return [...table.slice(0, at), { name, score }, ...table.slice(at, -1)];
}

// A line of the table as the screens print it: the name padded to 16 characters, a space and the score in two digits.
export const shooterRow = e => `${e.name.padEnd(FLOW().table.padded)} ${String(e.score).padStart(2, '0')}`; // @math two digits

// The lines the intro and end screens draw: { font ('big' or 'small'), text, x, y }, the two ducks ({ x, y, helmeted, frame }) and, for the end screen, the digits of the score.
function shooters(table) {
  const S = FLOW().intro.shooters;
  return [{ font: 'big', text: S.text, x: S.x, y: S.y }, ...table.map((e, k) => ({ font: 'small', text: shooterRow(e), x: S.x2, y: S.rowsAt + S.rowStep * k }))];
}
export function introLayout(table) {
  const I = FLOW().intro;
  return { lines: [{ font: 'big', ...I.title }, ...I.lines.map(l => ({ font: 'small', ...l })), ...shooters(table)], ducks: I.ducks, digits: null };
}
export function endLayout(score, table) {
  const E = FLOW().end, I = FLOW().intro;
  return { lines: [{ font: 'big', ...E.title }, ...shooters(table), { font: 'small', ...E.prompt }], ducks: I.ducks, digits: { text: String(score).padStart(2, '0'), ...E.score } }; // @math two digits
}
