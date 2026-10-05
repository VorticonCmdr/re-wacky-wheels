// The demo race behind ORDERING, INSTRUCTIONS and the attract mode (demo.flow): a single player race whose controls come from the track's .BMC file.
import { K } from '../evidence/k.js';
import { bytes, view, need } from '../binary.js';

const D = () => K({ routine: 0xe2e4, modes: { slides: 2, attract: 3 }, kinds: { ordering: { arg: 1, prefix: 'OR', pages: 11, cup: 2, race: 2 }, instructions: { arg: 2, prefix: 'INT', pages: 8, cup: 1, race: 1 }, attract: { arg: 3, prefix: 'OR', pages: 1, cup: 1, race: 2 } }, laps: 10, class: 1, engine: 1, detail: 2, drivers: 8, picture: { rows: 130, page: 0x7d00 }, logo: { member: 'OFONT.SP', offset: 3904, width: 0x5c, height: 0x29, x: 4, y: 0x9b }, text: { text: 'DEMO MODE ', x: 0xe8, y: 6 }, bmc: { suffix: '.BMC', recordBytes: 3, durationBytes: 2, left: 0x01, right: 0x02, accelerate: 0x04, fire: 0x08, brake: 0x10, handbrake: 0x20, end: 0x40 }, idle: { steps: 0x1f4 }, cardText: ' LOADING DEMO ', trackOf: { cupSize: 5 }, lastRace: 5, stepCancel: 0x1939c }, 'demo.flow');

export const demoModel = () => D();
export const demoKinds = () => Object.keys(D().kinds);

// What a kind plays: its mode word, the page picture members, the track and the laps.
export function demoSpec(kind, race = null) {
  const d = D(), k = d.kinds[kind], at = race ?? k.race;
  if (!k) throw new Error(`no demo ${kind}`);
  return { kind, cup: k.cup, mode: kind === 'attract' ? d.modes.attract : d.modes.slides, pages: Array.from({ length: k.pages }, (_, n) => `${k.prefix}${n + 1}.PCX`), track: (k.cup - 1) * d.trackOf.cupSize + at, race: at, laps: d.laps, class: d.class, engine: d.engine, detail: d.detail }; // @math the pages and the cups count from 1
}

// The race after this one in the attract mode's loop (obj1+0xe61a to +0xe69f: the race word goes up while it is not past 5), or null when the loop ends.
export const nextRace = spec => (spec.kind === 'attract' && spec.race + 1 <= D().lastRace ? spec.race + 1 : null); // @math the next race

// The track's .BMC file: a count word, then records of an int16 duration and an action byte.
export function parseBmc(data) {
  const b = bytes(data), dv = view(b), B = D().bmc;
  need(b, 0, B.durationBytes, 'BMC count');
  const count = dv.getUint16(0, true);
  need(b, B.durationBytes, count * B.recordBytes, 'BMC records');
  return Array.from({ length: count }, (_, i) => ({ duration: dv.getInt16(B.durationBytes + i * B.recordBytes, true), action: b[B.durationBytes + i * B.recordBytes + B.durationBytes] }));
}

export const bmcStart = records => ({ records, index: 0, counter: records[0]?.duration ?? 0 });

// The controls of the current frame (the action byte's bits) and the state after it: the duration counts down, and the next record starts when it is 0 or less.
export function bmcStep(s) {
  const B = D().bmc, action = s.records[s.index]?.action ?? 0, over = s.index >= s.records.length;
  const controls = { left: Boolean(action & B.left), right: Boolean(action & B.right), accelerate: Boolean(action & B.accelerate), fire: Boolean(action & B.fire), brake: Boolean(action & B.brake), spin: Boolean(action & B.handbrake), end: Boolean(action & B.end) };
  if (over) return { controls: { ...controls, end: true }, state: s };
  const counter = s.counter - 1; // @math one frame passes
  if (counter > 0) return { controls, state: { ...s, counter } };
  const index = s.index + 1; // @math the next record
  return { controls, state: { ...s, index, counter: s.records[index]?.duration ?? 0 } };
}

// The page turns of the slides (obj1+0x21ecb to +0x21f55): Down, Enter, the accelerate key or Right go on while the page is not the last, Up or Left go back while it is not the first.
export function turnPage(page, count, keys) {
  let p = page;
  if (keys.next && p < count) p += 1; // @math the next page
  if (keys.previous && p > 1) p -= 1; // @math the previous page, the first page is 1
  return p;
}
