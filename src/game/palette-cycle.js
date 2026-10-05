// The palette cycling of the tracks whose .GAM has the flag 1 (palette.cycle-rules, STATIC; the replay against the recorded DAC is palette.cycle-replay): once a drawn frame the cycler rewrites
// 13 DAC entries from the palette of BEACH.PCX, 5 of them (group B, 148 and 161 to 164) in a cycle of 9 states and 8 of them (group A, 168 to 175) in a cycle of 4 positions.
import { K } from '../evidence/k.js';

const CYCLE = () => K({ routine: 0x18668, flagWord: 0x28b60, groupACountWord: 0x28b50, groupAPositionWord: 0x28b38, groupBStateWord: 0x28b3a, delayWords: [0x28b5a, 0x28b4e, 0x28b4c], paletteBuffer: 0x1d758, paletteName: 'BEACH.PCX', startCount: 1, groupA: { source: 0x87, step: 12, positions: 4, firstEntries: [173, 172, 174, 175], secondEntries: [168, 169, 170, 171], secondSource: 0x30 }, groupB: { entries: [161, 162, 163, 164, 148], step: 15, states: 9, hold: 3, resume: 4, resumeSource: 0x3c } }, 'palette.cycle-rules');

export const cycleName = () => CYCLE().paletteName;

// The state after the race set-up: the words of the cycler as the set-up leaves them, nothing rewritten yet. `delays` are the lines 26, 27 and 28 of the .GAM (the steps of group B, the wait in its state 3,
// the steps of group A) and `palette` the 768 6-bit bytes of BEACH.PCX. A track without the flag has no cycle (null).
export function createCycle(flag, delays, palette) {
  const C = CYCLE();
  return flag === 0 ? null : { count: C.startCount, groupA: 0, position: 0, state: 0, delays, palette, entries: new Map() };
}

const colour = (palette, at, i) => [palette[at + i * 3], palette[at + i * 3 + 1], palette[at + i * 3 + 2]]; // @math three bytes a colour

// One call of the cycler. Returns the next state; `entries` maps the DAC entries it has rewritten so far to their 6-bit colours.
export function stepCycle(cycle) {
  if (!cycle || cycle.count === 0) return cycle;
  const C = CYCLE(), [delayB, wait, delayA] = cycle.delays, entries = new Map(cycle.entries);
  let { count, groupA, position, state } = cycle;
  const uploadA = at => { C.groupA.firstEntries.forEach((e, i) => entries.set(e, colour(cycle.palette, at, i))); C.groupA.secondEntries.forEach((e, i) => entries.set(e, colour(cycle.palette, at + C.groupA.secondSource, i))); };
  const uploadB = at => C.groupB.entries.forEach((e, i) => entries.set(e, colour(cycle.palette, at, i)));
  if (groupA >= delayA) { position = position + 1 > C.groupA.positions - 1 ? 0 : position + 1; uploadA(C.groupA.source + C.groupA.step * position); groupA = 0; }
  if (state === C.groupB.hold && count >= wait) { state = C.groupB.resume; uploadB(C.groupB.resumeSource); count = 0; }
  else if (count >= delayB && state !== C.groupB.hold) { state = state + 1 > C.groupB.states - 1 ? 0 : state + 1; uploadB(C.groupB.step * state); count = 0; }
  return { ...cycle, count: count + 1, groupA: groupA + 1, position, state, entries };
}
