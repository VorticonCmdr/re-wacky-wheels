import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHall, hallRows, insertScore, dateText, startEntry, typeKey, boardLayout } from '../src/game/halloffame.js';

// A table of 144 records, the rank r of the group g (0 to 17: 6 cups x 3 classes) holds the points 100 - 10 r in its first four.
function table() {
  const b = new Uint8Array(144 * 0x2e), dv = new DataView(b.buffer);
  for (let i = 0; i < 144; i++) { const o = i * 0x2e; dv.setInt16(o, Math.floor(i / 24) + 1, true); dv.setInt16(o + 2, i % 8, true); dv.setInt16(o + 4, 100 - 10 * (i % 8), true); b.set(Buffer.from('01 SEP 1994'), o + 6); b.set(Buffer.from('KNOCK ME OFF!'), o + 26); }
  return parseHall(b);
}

test('a table is 144 records of 0x2e bytes; the group of a class and cup is 8 records at 24 (b - 1) + 8 (c - 1)', () => {
  const t = table();
  assert.equal(t.length, 144); assert.deepEqual(t[0], { cup: 1, slot: 0, points: 100, date: '01 SEP 1994', name: 'KNOCK ME OFF!' });
  assert.deepEqual(hallRows(t, 2, 3).map(r => r.cup), [2, 2, 2, 2]); assert.equal(hallRows(t, 2, 3)[0], t[24 + 16]);
  assert.throws(() => parseHall(new Uint8Array(100)), /hall of fame table/);
});

test('a total enters at the first rank it is not below, the fourth is lost; below all four it replaces the fourth', () => {
  const t = table(), at = (cb, cls, r) => t[24 * (cb - 1) + 8 * (cls - 1) + r];
  const mk = (points, o = {}) => ({ cb: 1, cls: 1, points, slot: 7, date: '04 OCT 2026', name: 'TIGI        ', ...o });
  let out = insertScore(t, mk(95)); // between the first (100) and the second (90)
  assert.equal(out.rank, 1); assert.deepEqual(hallRows(out.table, 1, 1).map(r => r.points), [100, 95, 90, 80]);
  assert.deepEqual(hallRows(out.table, 1, 1)[1], { cup: 1, slot: 7, points: 95, date: '04 OCT 2026', name: 'TIGI        ' });
  out = insertScore(t, mk(120)); assert.equal(out.rank, 0); assert.deepEqual(hallRows(out.table, 1, 1).map(r => r.points), [120, 100, 90, 80]);
  out = insertScore(t, mk(80)); assert.equal(out.rank, 2); assert.deepEqual(hallRows(out.table, 1, 1).map(r => r.points), [100, 90, 80, 80]); // equal to the third: it takes the place and the old record moves down
  out = insertScore(t, mk(5)); assert.equal(out.rank, 3); assert.deepEqual(hallRows(out.table, 1, 1).map(r => r.points), [100, 90, 80, 5]); // below all: the fourth's points go to 4 first, then it enters
  assert.equal(at(1, 1, 3).points, 70); // the input table is not changed
  assert.deepEqual(hallRows(insertScore(t, mk(95, { cb: 2, cls: 2 })).table, 1, 1), hallRows(t, 1, 1)); // another group is untouched
});

test('the date text is the day with two digits, the month and the year', () => {
  assert.equal(dateText(new Date(2026, 9, 4)), '04 OCT 2026'); assert.equal(dateText(new Date(1994, 8, 1)), '01 SEP 1994'); assert.equal(dateText(new Date(1999, 11, 31)), '31 DEC 1999');
});

test('the name entry takes 12 letters, digits and spaces, Backspace takes one back, Enter and Esc end it; the cup moves with the typing up to the column 266', () => {
  let e = startEntry(); assert.deepEqual(e, { name: '            ', length: 0, cursor: 170, chars: 12, last: 266 });
  for (const k of 'Tigi 7') e = typeKey(e, k).entry;
  assert.deepEqual(e, { name: 'TIGI 7      ', length: 6, cursor: 218, chars: 12, last: 266 });
  e = typeKey(e, 'Backspace').entry; assert.deepEqual(e, { name: 'TIGI        ', length: 5, cursor: 210, chars: 12, last: 266 });
  e = typeKey(e, '!').entry; e = typeKey(e, 'Shift').entry; assert.equal(e.length, 5); // other keys do nothing
  for (const k of 'abcdefghijklmnop') e = typeKey(e, k).entry;
  assert.equal(e.name, 'TIGI ABCDEFG'); assert.equal(e.length, 12); assert.equal(e.cursor, 266);
  assert.equal(typeKey(startEntry(), 'Backspace').entry.cursor, 170);
  assert.equal(typeKey(e, 'Enter').done, true); assert.equal(typeKey(e, 'Escape').done, true); assert.equal(typeKey(e, 'a').done, false);
});

test('the board lays four rows out from the group: the name, the car, the date, the wheel and the points', () => {
  const t = table(), layout = boardLayout(t, 1, 2, 1, 0);
  assert.equal(layout.title, 'PRO CLASS 12 HP'); assert.equal(boardLayout(t, 1, 3, 2, 0).title, 'CHAMP CLASS 6 HP');
  const r = layout.rows;
  assert.deepEqual(r.map(x => x.nameY), [83, 109, 135, 161]); assert.deepEqual(r.map(x => x.carY), [71, 97, 123, 149]); assert.deepEqual(r.map(x => x.dateY), [80, 106, 132, 158]);
  assert.deepEqual([r[0].nameX, r[0].carX, r[0].dateX, r[0].wheelX, r[0].wheelY, r[0].pointsX, r[0].pointsY], [10, 122, 170, 266, 76, 300, 83]); // an 11 character date ends at 258
  assert.deepEqual(layout.label, { text: 'POINTS', x: 266, y: 63 }); assert.equal(r[0].points, '100'); assert.equal(boardLayout(table().map(x => ({ ...x, points: 7 })), 1, 1, 1, 0).rows[0].points, '07');
  assert.equal(boardLayout(t, 3, 1, 1, 0).rows[0].wheelPiece, 4); // the gold cup's pieces are 4 and 5
});
