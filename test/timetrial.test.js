import test from 'node:test';
import assert from 'node:assert/strict';
import { timeText, recordIndex, titleOf, evaluate, insertTimes, messagesOf, layout, recordLap, totalOf } from '../src/game/timetrial.js';

const name = s => s.padEnd(16, ' ');
const rec = (laps, overall) => ({ laps: laps.map((t, i) => ({ name: name(`LAP${i}`), time: t })), overall: { name: name('OVERALL'), time: overall } });
const table = () => Array.from({ length: 30 }, () => rec([155, 215, 275, 335], 988));

test('a time is MM:SS:T in tenths of a second, a time above 36000 is zero', () => {
  assert.equal(timeText(155), '00:15:5'); assert.equal(timeText(988), '01:38:8'); assert.equal(timeText(0), '00:00:0'); assert.equal(timeText(36000), '60:00:0'); assert.equal(timeText(36001), '00:00:0');
});

test('five races to a group, and the title names the group, the race and the engine', () => {
  assert.deepEqual([recordIndex(1, 1), recordIndex(1, 5), recordIndex(2, 1), recordIndex(6, 5)], [0, 4, 5, 29]);
  assert.equal(titleOf(1, 3, 1), 'BRONZE WHEELS. TRACK 3. 12HP'); assert.equal(titleOf(5, 2, 2), 'BONUS SILVER. TRACK 2. 6HP');
});

test('the best lap enters the four lap records at the first one it is not above, a record overall time replaces the overall and stores no lap', () => {
  const t = table(), laps = [300, 180, 220, 400, 180, 500];
  let ev = evaluate(t, 0, laps, 2000); assert.deepEqual([ev.best, ev.rank, ev.overall, ev.needsName], [180, 1, false, true]); // 155 < 180 <= 215
  let out = insertTimes(t, 0, ev, name('PLETZER'), 2000);
  assert.deepEqual(out.table[0].laps.map(l => [l.name.trim(), l.time]), [['LAP0', 155], ['PLETZER', 180], ['LAP1', 215], ['LAP2', 275]]); assert.equal(out.lapRank, 1); assert.equal(out.overallMark, false);
  assert.equal(t[0].laps[1].time, 215); // the table is not changed
  ev = evaluate(t, 0, [200, 200, 200, 200, 200, 200], 900); assert.deepEqual([ev.rank, ev.overall], [1, true]); // a record overall time: the lap record is not stored
  out = insertTimes(t, 0, ev, name('FAST'), 900); assert.deepEqual([out.lapRank, out.overallMark, out.table[0].overall, out.table[0].laps[1].time], [-1, true, { name: name('FAST'), time: 900 }, 215]);
  ev = evaluate(t, 0, [400, 400, 400, 400, 400, 400], 3000); assert.deepEqual([ev.rank, ev.overall, ev.needsName], [-1, false, false]);
  ev = evaluate(t, 0, [335, 400, 400, 400, 400, 400], 3000); assert.equal(ev.rank, 3); // equal to the fourth: it takes the place
  out = insertTimes(t, 0, ev, name('X'), 3000); assert.deepEqual(out.table[0].laps.map(l => l.time), [155, 215, 275, 335]); assert.equal(out.table[0].laps[3].name.trim(), 'X');
  assert.equal(evaluate(t, 0, [100, 100, 100, 100, 100, 100], 988).overall, true); // equal to the overall: a record
  assert.equal(evaluate(t, 0, [400, 120, 120, 400, 400, 400], 1000).rank, 0); // the first of equal laps is the best; 120 < 155
});

test('the messages after a new record: the lap record first, then the race record', () => {
  assert.deepEqual(messagesOf(0, false), ['YOU HAVE THE BEST LAP TIME EVER!']); assert.deepEqual(messagesOf(0, true), ['YOU HAVE THE BEST LAP TIME EVER!', 'AND THE BEST RACE TIME EVER!']);
  assert.deepEqual(messagesOf(-1, true), ['YOU HAVE THE BEST RACE TIME EVER!']); assert.deepEqual(messagesOf(2, false), []); assert.deepEqual(messagesOf(1, true), ['YOU HAVE THE BEST RACE TIME EVER!']);
});

test('the plain view stacks the title, the heading, the four laps, the best race and the prompts at their rows', () => {
  const l = layout(table(), 1, 1, 1);
  assert.deepEqual(l.lines.map(x => [x.font, x.text, x.y]), [
    ['big', 'BRONZE WHEELS. TRACK 1. 12HP', 8], ['big', 'TIME TRIAL HALL OF FAME', 28], ['big', 'TOP FOUR LAP TIMES', 48],
    ['small', `${name('LAP0')} 00:15:5`, 68], ['small', `${name('LAP1')} 00:21:5`, 78], ['small', `${name('LAP2')} 00:27:5`, 88], ['small', `${name('LAP3')} 00:33:5`, 98],
    ['big', 'BEST TIME FOR ENTIRE RACE', 118], ['small', `${name('OVERALL')} 01:38:8`, 138], ['small', 'SEE IF YOU CAN BEAT THESE!', 158], ['small', 'PRESS FIRE', 180]]);
  assert.equal(l.lines[0].x, 6); // 28 characters of 11: (320 - 308) / 2
  assert.equal(l.lines[3].x, Math.floor((320 - 8 * 24) / 2)); assert.deepEqual(l.markers, []);
});

test('the screen after a race lists the laps and the race, then the records with the markers on the new lines', () => {
  const t = table(), laps = [300, 180, 220, 400, 180, 500], ev = evaluate(t, 0, laps, 2000), out = insertTimes(t, 0, ev, name('PLETZER'), 2000);
  const l = layout(out.table, 1, 1, 1, { laps, total: 2000, lapMark: ev.rank, lapRank: out.lapRank, overallMark: out.overallMark });
  assert.deepEqual(l.lines.map(x => [x.text.slice(0, 30), x.y]).slice(1, 8), [['LAP 1 - 00:30:0', 28], ['LAP 2 - 00:18:0', 38], ['LAP 3 - 00:22:0', 48], ['LAP 4 - 00:40:0', 58], ['LAP 5 - 00:18:0', 68], ['LAP 6 - 00:50:0', 78], ['RACE - 03:20:0', 94]]);
  assert.deepEqual(l.lines.slice(8).map(x => [x.text.slice(0, 7), x.y]), [['TIME TR', 110], ['LAP0   ', 130], ['PLETZER', 140], ['LAP1   ', 150], ['LAP2   ', 160], ['RACE - ', 180]]);
  assert.deepEqual(l.markers.map(m => [m.x - 2, m.y]), [[l.lines[2].x + 8 * l.lines[2].text.length, 28], [l.lines[10].x + 8 * l.lines[10].text.length, 130]]); // the lap list's marker on the line numbered like the rank (1: LAP 2), the record's on the stored rank (1)
});

test('the lap words: the timer for the first lap, the difference to the last stamp after it, six laps', () => {
  let s = { times: [0, 0, 0, 0, 0, 0], stamp: 0 };
  for (const [lap, ticks] of [[2, 155], [3, 330], [4, 470], [5, 640], [6, 800], [7, 990], [8, 1200]]) s = recordLap(s.times, s.stamp, lap, ticks);
  assert.deepEqual(s.times, [155, 175, 140, 170, 160, 190]); assert.equal(totalOf(s.times), 990);
  assert.deepEqual(recordLap([0, 0, 0, 0, 0, 0], 0, 1, 50), { times: [0, 0, 0, 0, 0, 0], stamp: 0 });
});
