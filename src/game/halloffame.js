// The race hall of fame (race.hall-of-fame, STATIC): the 144 records of the WACKY1.HI / WACKY2.HI tables, the name a cup winner types, the insertion of his total and the layout of the
// FAMOUS DRIVERS board. Text fields are plain strings here (the file's NUL padded 20 byte fields).
import { K } from '../evidence/k.js';
import { bytes, view } from '../binary.js';

const HOF = () => K({ entry: 0xce14, dialog: 0xcb44, board: 0xd704, member: ['WAC1.HTT', 'WAC2.HTT'], recordBytes: 0x2e, classRecords: 8, cupRecords: 24, records: 144, fields: { cup: 0, slot: 2, points: 4, date: 6, name: 0x1a }, textBytes: 20, rows: 4, name: { chars: 12, prompt: 'PLEASE ENTER NAME..', promptAt: [10, 96], typedAt: [170, 96], advance: 8, cup: { offset: 4254, size: [15, 13], dy: -5 }, last: 266 }, months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], picture: 'LEAD.PCX', classes: ['AMATEUR CLASS', 'PRO CLASS', 'CHAMP CLASS'], horsepower: [' 12 HP', ' 6 HP'], banner: { y: 50, border: 0x26, fill: 0x2c, height: 16, margin: 4 }, row: { firstName: 83, step: 26, nameX: 10, carX: 122, carDy: -12, dateX: 170, dateY: 80, wheelDx: 8, wheelDy: -7, pointsDx: 34, labelY: 63, label: 'POINTS' } }, 'race.hall-of-fame');

export const hallFiles = () => { const H = HOF(); return { member: H.member, picture: H.picture }; };
export const hallEntryGeometry = () => { const N = HOF().name; return { prompt: N.prompt, promptAt: N.promptAt, typedAt: N.typedAt, advance: N.advance, cup: N.cup, last: N.last, chars: N.chars }; };

const text = (b, at, n) => { let s = ''; for (let i = 0; i < n && b[at + i] !== 0; i++) s += String.fromCharCode(b[at + i]); return s; };

// The records of a table file.
export function parseHall(data) {
  const H = HOF(), b = bytes(data), dv = view(b), F = H.fields;
  if (b.length !== H.records * H.recordBytes) throw new Error(`hall of fame table is ${b.length} bytes, expected ${H.records * H.recordBytes}`);
  return Array.from({ length: H.records }, (_, i) => { const o = i * H.recordBytes; return { cup: dv.getInt16(o + F.cup, true), slot: dv.getInt16(o + F.slot, true), points: dv.getInt16(o + F.points, true), date: text(b, o + F.date, H.textBytes), name: text(b, o + F.name, H.textBytes) }; });
}

// The default table of an engine (1: 12 HP, 2: 6 HP) from the archive.
export const hallDefault = (members, engine) => parseHall(members.get(HOF().member[engine - 1])); // @math the engine counts from 1

const indexOf = (cb, cls, rank) => { const H = HOF(); return H.cupRecords * (cb - 1) + H.classRecords * (cls - 1) + rank; }; // @math the cup plus pack and the class count from 1

// The four records of a class and cup (the rows of the board).
export const hallRows = (table, cb, cls) => Array.from({ length: HOF().rows }, (_, r) => table[indexOf(cb, cls, r)]);

// The insertion (obj1+0xcf2f to +0xd0b6): the total enters at the first rank it is not below; when it is below all four the fourth's points are lowered to the total less one first.
export function insertScore(table0, { cb, cls, points, slot, date, name }) {
  const H = HOF(), table = table0.map(r => ({ ...r })), at = r => indexOf(cb, cls, r), rows = H.rows;
  if (Array.from({ length: rows }, (_, r) => table[at(r)].points).every(p => points < p)) table[at(rows - 1)].points = points - 1;
  let rank = 0;
  while (rank < rows && points < table[at(rank)].points) rank++;
  if (rank >= rows) return { table, rank: null };
  for (let r = rows - 1; r > rank; r--) table[at(r)] = { ...table[at(r - 1)] }; // the records below move down, the fourth is lost
  table[at(rank)] = { cup: cb, slot, points, date, name };
  return { table, rank };
}

// The date text (obj1+0xc994): the day (two digits), the month's letters and the year.
export function dateText(now = new Date()) {
  const months = HOF().months;
  return `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`; // @math the day is two digits
}

// ---- the name entry (obj1+0xcb44): the typed name is `chars` characters (12 for the race hall of fame, 16 for the time trial), spaces at the start, and the cup marks the next place.
export function startEntry(chars = HOF().name.chars) { const N = HOF().name; return { name: ' '.repeat(chars), length: 0, cursor: N.typedAt[0], chars, last: N.typedAt[0] + N.advance * chars }; }

// A key: 'Enter' and 'Escape' end the entry; 'Backspace' takes a character back; a letter, digit or space is taken while fewer than `chars` are typed. Returns { entry, done }.
export function typeKey(entry, key) {
  const N = HOF().name;
  if (key === 'Enter' || key === 'Escape') return { entry, done: true };
  let { name, length, cursor } = entry;
  if (key === 'Backspace') { if (length > 0) { length -= 1; cursor -= N.advance; name = name.slice(0, length) + ' ' + name.slice(length + 1); } return { entry: { ...entry, name, length, cursor }, done: false }; }
  if (key.length !== 1) return { entry, done: false };
  const ch = key.toUpperCase();
  if (!/[A-Z0-9 ]/.test(ch)) return { entry, done: false };
  if (length < entry.chars) { name = name.slice(0, length) + ch + name.slice(length + 1); length += 1; }
  if (cursor < entry.last) cursor += N.advance;
  return { entry: { ...entry, name, length, cursor }, done: false };
}

// ---- the board (obj1+0xd704): what the screen holds for a class (1 to 3), the cup plus pack, the engine and the pack word of the settings (0 or 3).
export function boardLayout(table, cb, cls, engine, pack) {
  const H = HOF(), R = H.row, title = `${H.classes[cls - 1]}${H.horsepower[engine - 1]}`; // @math the class and the engine count from 1
  const rows = hallRows(table, cb, cls).map((r, k) => {
    const dateEnd = R.dateX + H.name.advance * r.date.length, wheelX = dateEnd + R.wheelDx, y = R.firstName + R.step * k;
    return { slot: r.slot, name: r.name, nameX: R.nameX, nameY: y, carX: R.carX, carY: y + R.carDy, date: r.date, dateX: R.dateX, dateY: R.dateY + R.step * k, wheelX, wheelY: y + R.wheelDy, wheelPiece: (cb - (pack + 1)) * 2, points: String(r.points).padStart(2, '0'), pointsX: wheelX + R.pointsDx, pointsY: y }; // @math two digits at least; two wheel pieces to a cup
  });
  return { title, banner: H.banner, rows, label: { text: R.label, x: rows[0].wheelX, y: R.labelY } };
}
