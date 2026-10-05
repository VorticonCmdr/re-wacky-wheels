// The time trial's records (race.time-trial, STATIC): the lap times of a race, the check against the track's record of the four best laps and the best race, the insertion with the name,
// and the lines of the hall of fame screen. A table is the 30 records of WACKY1.TIM / WACKY2.TIM as formats/scores.js reads them.
import { K } from '../evidence/k.js';
import { parseTimeTable } from '../formats/scores.js';

const TT = () => K({ hall: 0x1e4b8, member: ['WAC1.OTT', 'WAC2.OTT'], recordBytes: 120, record: { laps: 0, overall: 0x60, lapTimes: 0x50, overallTime: 0x74, nameBytes: 20 }, perGroup: 5, groups: ['BRONZE WHEELS. TRACK ', 'SILVER WHEELS. TRACK ', 'GOLD WHEELS. TRACK ', 'BONUS BRONZE . TRACK ', 'BONUS SILVER. TRACK ', 'BONUS GOLD. TRACK '], horsepower: ['. 12HP', '. 6HP'], laps: 6, ranks: 4, cap: 36000, background: 'ORDER.PCX', big: { advance: 11 }, small: { advance: 8 }, step: 10, titleY: 8, view: { hall: 28, top: 48, lines: 68, best: 118, overall: 138, beat: 158, fire: 180 }, fresh: { laps: 28, race: 94, hall: 110, lines: 130, overall: 180 }, texts: { lap: 'LAP ', dash: ' - ', race: 'RACE - ', hall: 'TIME TRIAL HALL OF FAME', top: 'TOP FOUR LAP TIMES', best: 'BEST TIME FOR ENTIRE RACE', beat: 'SEE IF YOU CAN BEAT THESE!', fire: 'PRESS FIRE', bestLap: 'YOU HAVE THE BEST LAP TIME EVER!', andRace: 'AND THE BEST RACE TIME EVER!', bestRace: 'YOU HAVE THE BEST RACE TIME EVER!' }, marker: { offset: 13577, size: [12, 13], gap: 2, above: 10, wiggle: 2, counts: 0x22 }, message: { counts: 0x12c }, entry: { title: 'TIME TRIAL - HALL OF FAME!', limit: 0xf, titleY: 10 }, track: { labelBase: 4, races: 5, keyPause: 0x14, sound: 0x12 }, trialClass: 4 }, 'race.time-trial');

export const trialClass = () => TT().trialClass;
export const trialFiles = () => ({ member: TT().member, background: TT().background });
export const trialEntry = () => { const E = TT().entry; return { title: E.title, chars: E.limit + 1, titleY: E.titleY }; }; // @math the limit is the last index of the buffer
export const trialMarker = () => TT().marker;
export const trialMessageCounts = () => TT().message.counts;
export const trialTrack = () => TT().track;

// The default table of an engine (1: 12 HP, 2: 6 HP) from the archive.
export const trialDefault = (members, engine) => parseTimeTable(members.get(TT().member[engine - 1])); // @math the engine counts from 1

// The record of a cup plus pack (1 to 6) and race (1 to 5): five races to a group.
export const recordIndex = (cb, race) => (cb - 1) * TT().perGroup + race - 1; // @math the group and the race count from 1

// The title of the screen: the group's name, the race and the engine.
export const titleOf = (cb, race, engine) => `${TT().groups[cb - 1]}${race}${TT().horsepower[engine - 1]}`; // @math the group and the engine count from 1

// A time as the text MM:SS:T (obj1+0x1a618): tenths of a second, a time above 36000 is 0.
export function timeText(time) {
  const T = TT(), t = time > T.cap ? 0 : time, tenths = t % 10, seconds = Math.floor(t / 10), pad = n => String(n).padStart(2, '0'); // @math tenths of a second; two digits
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}:${tenths}`; // @math sixty seconds to the minute
}

// What a finished race brings (obj1+0x1e68f to +0x1e724): the best of the laps (the first of equal ones), the rank it would take among the four lap records (the first one it is not above, or -1)
// and whether the overall time is a record (not above the stored one).
export function evaluate(table, index, laps, total) {
  const rec = table[index], best = Math.min(...laps);
  let rank = rec.laps.findIndex(l => best <= l.time);
  const overall = total <= rec.overall.time;
  return { best, rank, overall, needsName: rank !== -1 || overall };
}

// The insertion with a name (obj1+0x1e7c8 to +0x1e95e): a record overall takes the overall entry and no lap record is stored then; otherwise the best lap enters its rank and the later laps move down.
export function insertTimes(table, index, ev, name, total) {
  const rec = { laps: table[index].laps.map(l => ({ ...l })), overall: { ...table[index].overall } };
  let lapRank = -1;
  if (ev.overall) rec.overall = { name, time: total };
  else if (ev.rank !== -1) {
    for (let k = rec.laps.length - 1; k > ev.rank; k--) rec.laps[k] = { ...rec.laps[k - 1] };
    rec.laps[ev.rank] = { name, time: ev.best }; lapRank = ev.rank;
  }
  return { table: table.map((r, i) => (i === index ? rec : r)), lapRank, overallMark: ev.overall };
}

// The boxes shown after the first draw (obj1+0x1f193 to +0x1f2d0), each for 300 counts.
export function messagesOf(lapRank, overallMark) {
  const X = TT().texts;
  if (lapRank === 0) return overallMark ? [X.bestLap, X.andRace] : [X.bestLap];
  return overallMark ? [X.bestRace] : [];
}

// The screen (obj1+0x1e973 to +0x1f001): its text lines (font 'big' or 'small', the text, the column of the first character and the row) and the markers' places. `fresh` is
// { laps, total, lapMark (the rank the lap would take, -1 for none), lapRank (stored rank or -1), overallMark } for the screen after a race, or null for the plain view.
export function layout(table, cb, race, engine, fresh = null) {
  const T = TT(), X = T.texts, rec = table[recordIndex(cb, race)], lines = [], markers = [];
  const centred = (font, text, y) => { const advance = T[font].advance, x = Math.floor(Math.abs(320 - advance * text.length) / 2); lines.push({ font, text, x, y }); return { x, y, end: x + advance * text.length }; }; // @math centred on the 320 columns, the difference halved
  const mark = (at, y) => markers.push({ x: at.end + T.marker.gap, y: y - T.marker.above });
  const record = (r, prefix = '') => `${prefix}${r.name} ${timeText(r.time)}`;
  centred('big', titleOf(cb, race, engine), T.titleY);
  let y;
  if (fresh) {
    fresh.laps.forEach((t, i) => { const at = centred('small', `${X.lap}${i + 1}${X.dash}${timeText(t)}`, T.fresh.laps + T.step * i); if (i === fresh.lapMark) mark(at, T.fresh.laps + T.step * i); });
    centred('small', `${X.race}${timeText(fresh.total)}`, T.fresh.race);
    centred('big', X.hall, T.fresh.hall); y = T.fresh.lines;
  } else { centred('big', X.hall, T.view.hall); centred('big', X.top, T.view.top); y = T.view.lines; }
  rec.laps.forEach((r, k) => { const at = centred('small', record(r), y + T.step * k); if (fresh && k === fresh.lapRank) mark(at, y + T.step * k); });
  if (fresh) { const at = centred('small', record(rec.overall, X.race), T.fresh.overall); if (fresh.overallMark) mark(at, T.fresh.overall); }
  else { centred('big', X.best, T.view.best); centred('small', record(rec.overall), T.view.overall); centred('small', X.beat, T.view.beat); centred('small', X.fire, T.view.fire); }
  return { lines, markers };
}

// The lap timing of the race loop (obj1+0x2bf2 to +0x2c3b): at the new lap of the 2nd to 7th the lap's time is the timer less the timer at the last lap (the timer itself for the first lap).
export function recordLap(times, stamp, lap, ticks) {
  const first = lap === 2; // @math the lap word 2 is the first crossing
  if (lap < 2 || lap > times.length + 1) return { times, stamp }; // @math laps 2 to 7: six words
  const next = times.slice(); next[lap - 2] = first ? ticks : ticks - stamp; // @math the word of the lap n is the (n - 2)th
  return { times: next, stamp: ticks };
}
export const lapWords = () => Array.from({ length: TT().laps }, () => 0); // the six lap words, 0 at the race start (obj1+0x200b5)
export const totalOf = times => times.reduce((a, b) => a + b, 0);
