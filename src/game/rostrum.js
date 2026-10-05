// THE ROSTRUM after the final leaderboard (race.rostrum, STATIC): the podium groups of the sorted standings, then one pass every 6 counts of the 136 Hz counter: puffs of smoke on every
// stack, the racers' portraits (the human in its finish pose), a wheel that rolls in and three cups that fall onto the groups. A pass returns what it draws and the next state.
import { K } from '../evidence/k.js';
import { pictureOf, entryOf, sourceOf, carFrame, slotCounts } from './control.js';

const ROSTRUM = () => K({ routine: 0x1c614, groups: 3, spots: [[0x8e, 0x96], [0x55, 0x92], [0xc5, 0x8f]], outside: [0xa, 0x9e], step: 0x1c, text: { string: 'THE ROSTRUM', y: 0x3c, ticks: 0x190, glyph: 8, screen: 0x140 }, picture: 'WIN.PCX', background: 'ORDER.PCX', passTicks: 6, start: { sound: 0x12 }, songs: ['LEADRBRD', 'MAINMENU'], puffs: { member: 'PUF.SP', frames: 4, frameBytes: 0x428, passesAbove: 2 }, size: [0x26, 0x1c], poseFirst: 5, poseAbove: 2, wheel: { start: 0x20, left: 0, top: 0xaa, step: 0x10, past: 6, size: [0x1c, 0x17], pieceBytes: 0x284, flipAbove: 1, frames: 2 }, cups: { first: 3864, bytes: 195, size: [0xf, 0xd], dx: 0xb, dy: 0xb, drop: 0xe, order: [2, 1, 0], sound: 0x17 }, twoPlayer: { fewRacers: 2, fewGroups: 2, outside: [0x110, 0x9e], beats: 8 } }, 'race.rostrum');

const STATE = { puffs: 1, portraits: 2 }, WHEEL = { rolling: 1, stopped: 2 }; // @math the screen's state words and the wheel's (race.rostrum)

export const rostrumText = () => ROSTRUM().text;
export const rostrumFiles = () => { const R = ROSTRUM(); return { picture: R.picture, background: R.background, puffs: R.puffs.member }; };
// The sizes and byte counts the renderer cuts the pictures with.
export const rostrumGeometry = () => { const R = ROSTRUM(); return { size: R.size, puffBytes: R.puffs.frameBytes, wheel: R.wheel.size, wheelBytes: R.wheel.pieceBytes, cup: R.cups.size, cupBytes: R.cups.bytes, cupFirst: R.cups.first }; };
export const rostrumTicks = () => ROSTRUM().text.ticks;
export const rostrumPassTicks = () => ROSTRUM().passTicks;
export const rostrumStartSound = () => ROSTRUM().start.sound;
export const rostrumSongs = () => ROSTRUM().songs;

// The groups of the podium (obj1+0x1c622 to +0x1c6d2): runs of equal points in the sorted rows, at most three (two when only two racers are ranked, obj1+0x1c03f); a human outside them
// stands alone in a fourth group, and in the two player race the second human in a fifth. `humans` are the human slots (one, or two for the two player race).
// Returns { groups: [{ x, y, slots }], playerGroup } (the group number of the first human, 0 when none).
export function podiumGroups(rows, humans) {
  const R = ROSTRUM(), T = R.twoPlayer, humanList = [humans].flat(), groups = [], limit = rows.length === T.fewRacers ? T.fewGroups : R.groups;
  let i = 0;
  while (groups.length < limit && i < rows.length) {
    const points = rows[i].points, slots = [];
    for (let j = i; j < rows.length && rows[j].points === points; j++) slots.push(rows[j].slot);
    const [x, y] = R.spots[groups.length];
    groups.push({ x, y, slots });
    i += slots.length;
  }
  while (groups.length < limit) { const [x, y] = R.spots[groups.length]; groups.push({ x, y, slots: [] }); } // the empty groups keep their places (the cups still fall there)
  const playerGroup = groups.findIndex(g => g.slots.includes(humanList[0])) + 1; // @math the group numbers count from 1; 0 when the human is in none
  if (playerGroup === 0) groups.push({ x: R.outside[0], y: R.outside[1], slots: [humanList[0]], outside: 1 }); // @math the first human outside the groups
  if (humanList.length > 1 && !groups.some(g => g.slots.includes(humanList[1]))) groups.push({ x: T.outside[0], y: T.outside[1], slots: [humanList[1]], outside: 2 }); // @math the second human outside the groups
  return { groups, playerGroup };
}

// A new screen: state 1, the puffs at their first frame; `cup` (1 to 3) picks the wheel; the cups wait above the screen.
export function startRostrum(rows, humanSlot, cup) {
  const R = ROSTRUM(), humans = [humanSlot].flat(), { groups, playerGroup } = podiumGroups(rows, humans), podium = groups.filter(g => !g.outside);
  const cups = podium.map((_, k) => { const picture = R.cups.order[k], g = groups[k]; return { picture, x: g.x + R.cups.dx, y: 0, stop: g.y - R.step * (g.slots.length - 1) - R.cups.dy, landed: false }; }); // @math the first racer stands at the group's row itself
  return { state: STATE.puffs, si: 0, di: 0, since: 0, flip: 0, wheel: { on: 0, x: R.wheel.left, frame: 0 }, base: (cup - 1) * R.wheel.frames, groups, playerGroup, humanSlot: humans[0], twoPlayer: humans.length > 1, beat: 0, cups, poseEnd: slotCounts(humans[0])[1] + R.poseFirst }; // @math the wheel pieces of a cup are two a cup
}

// The picture of a racer of a group: its slot's CARS.SP frame 0, or for the human the finish pose row. In the two player race no human is the pose figure (obj1+0x1cd42), and the humans of the
// fourth and fifth group show the rows of the wobble table, one a pass (obj1+0x1cd84, +0x1ce48).
function portrait(s, slot, group) {
  if (s.twoPlayer && group.outside) { const source = sourceOf(entryOf('wobble', s.beat), slot); return { file: source.file, index: source.index }; }
  if (!s.twoPlayer && slot === s.humanSlot) { const source = pictureOf({ pic: { table: 'pose', row: s.si } }, slot); return source && { file: source.file, index: source.index }; }
  return { file: 'cars', index: carFrame(slot, 0) };
}

// One pass (obj1+0x1cb84 to +0x1d1e9): what it draws (in the order drawn) and the state after it. `sounds` are the cups that landed.
export function rostrumPass(s0) {
  const R = ROSTRUM(), s = { ...s0, wheel: { ...s0.wheel }, cups: s0.cups.map(c => ({ ...c })) }, draws = [], sounds = [];
  if (s.state === STATE.puffs) {
    for (const g of s.groups) g.slots.forEach((_, j) => draws.push({ kind: 'puff', frame: s.si, x: g.x, y: g.y - R.step * j }));
    if (s.di > R.puffs.passesAbove) { s.si += 1; s.di = 0; }
    if (s.si === R.puffs.frames) { s.since = 0; s.si = R.poseFirst; s.state = STATE.portraits; s.di = 0; }
  } else {
    if (s.di >= R.wheel.start && s.wheel.on === 0) { s.wheel = { on: WHEEL.rolling, x: R.wheel.left, frame: 0 }; s.di = 0; s.flip = 0; }
    for (const g of s.groups) g.slots.forEach((slot, j) => draws.push({ kind: 'car', picture: portrait(s, slot, g), x: g.x, y: g.y - R.step * j }));
    if (s.since > R.poseAbove) { s.since = 0; s.si += 1; }
    if (s.si === s.poseEnd) s.si = R.poseFirst;
    if (s.wheel.on !== 0) {
      draws.push({ kind: 'wheel', piece: s.base + s.wheel.frame, x: s.wheel.x, y: R.wheel.top });
      if (s.flip > R.wheel.flipAbove) { s.flip = 0; s.wheel.frame += 1; }
      if (s.wheel.frame === R.wheel.frames) s.wheel.frame = 0;
      if (s.wheel.on === WHEEL.rolling) { s.wheel.x += R.wheel.step; const stop = s.groups[0].x + R.wheel.past; if (s.wheel.x >= stop) { s.wheel.on = WHEEL.stopped; s.di = 0; s.wheel.x = stop; } }
    }
  }
  if (s.state > STATE.puffs) for (const c of s.cups) {
    draws.push({ kind: 'cup', picture: c.picture, x: c.x, y: c.y });
    c.y += R.cups.drop;
    if (c.y >= c.stop) { c.y = c.stop; if (!c.landed) sounds.push(R.cups.sound); c.landed = true; }
  }
  if (s0.state > STATE.puffs) s.beat = (s.beat + 1) % R.twoPlayer.beats; // the wobble row counter of the portrait passes (obj1+0x1ce48)
  s.flip += 1; s.since += 1; s.di += 1;
  return { draws, sounds, next: s };
}
