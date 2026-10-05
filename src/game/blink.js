// The object pass of the draw (racer.blink): once a frame, with the draw records of the frame, the computer racers that the player follows closely glance back (their frames 8 to 11)
// and the player's car glances at a racer that is level with it or behind it (the bump pictures and the sound PASS). The state machine of a racer is the words +0x28 (phase), +0x2c (kind),
// +0x30 (flag) and +0x34 (index) with the frame counter kept at the end of the second phase.
import { K } from '../evidence/k.js';
import { frameTable, racerFrame } from './racers.js';
import { sortDrawList } from '../render/draw-list.js';
import { startBump } from './control.js';
import { GLANCE } from './duck-rules.js';
import { sideMode } from './start.js';

const BLINK = () => K({ pass: 0x12bf4, zoneNear: 2, zoneSame: 3, zoneFar: 1, columnSlack: 4, columnRight: 5, columnLeft: 4, columnCentre: 3, bottomFrame: 4, sizeClass: 2, frames: { first: 8, kinds: { 4: [0, 1], 5: [2, 3] } }, starts: { leftColumn: [5, 2], other: [4, 0] }, hold: 3, glance: { sound: 8, near: [6, 1], far: [7, 3], zones: [3, 2], nearColumns: [3, 4] } }, 'racer.blink');

const PHASE = { up: 1, hold: 2, down: 3 }; // @math the phase word's values: the index going up, the hold and the index going down (racer.blink)

export const blinkStart = () => ({ phase: 0, kind: 0, flag: 0, index: 0, stamp: 0, shown: null });

// The side of the waiting pictures of a racer (grabs of the running game, five races): the racers whose picture stands left of the player's car at the start look with the pictures 10 and 11
// (the kind 5 of the glance words), the others with 8 and 9 (the kind 4). A racer out of view at the start keeps the kind it had (in the grabs it is 5 for a racer whose mode word is 4, which is
// what the port gives it: the words of the race before are not known). Returns whether the racer waits with the left pictures.
export function waitsLeft(record, centre, mode) {
  const B = BLINK();
  if (!record) return mode === sideMode();
  const column = record.left + (record.width >> 1) - 1;
  return Math.abs(column - centre) > B.columnSlack && column < centre;
}

// The glance words of a racer before the first pass of a race (grabs of the running game, the last frames of the intro): not glancing, flagged, the index one below the first frame of its kind. The kind is the
// side the racer's picture stands on at the start (5 left of the player's car, 4 otherwise) and, for a racer out of view, the one its mode word gives; a glance restarts with the kind of the side it stands on then.
export function blinkAtStart(record, centre, mode) {
  const B = BLINK(), kind = waitsLeft(record, centre, mode) ? 5 : 4; // @math the kinds 5 and 4 of the words +0x2c
  return { phase: 0, kind, flag: 1, index: B.frames.kinds[kind][0] - 1, stamp: 0, shown: null }; // @math the index one below the first frame
}

// The scene pass's flag (obj1+0x1893c): a racer seen exactly from behind whose phase is 0 is marked.
export function markFlags(racers, heading, duck = false) {
  const B = BLINK(), table = frameTable(), marked = frame => (duck ? GLANCE().flagFrames.includes(frame) : frame === B.bottomFrame); // in the duck game a racer seen at an even frame is marked (duck.glance)
  return racers.map((r, n) => (n === 0 || !r.blink || r.blink.phase !== 0 ? r : { ...r, blink: { ...r.blink, flag: marked(racerFrame(heading, r.compass, table)) ? 1 : 0 } }));
}

// The pass over the racer records. ctx: { player (the player's draw record), records (the racers' records of the frame), tick, racing, slots, finished, duck }. Returns the racers (their blink words and
// the frame each shows this call: blink.shown, or null), the car after a glance and the sounds.
export function objectPass(racers, car, ctx) {
  const B = BLINK(), sounds = [], out = racers.map(r => (r.blink ? { ...r, blink: { ...r.blink, shown: null } } : r));
  if (car.crashed || ctx.finished) return { racers: out, car, sounds };
  const bottom = ctx.player.top + ctx.player.height - 1, centre = ctx.player.left + (ctx.player.width >> 1) - 1;
  let current = car;
  for (const rec of sortDrawList(ctx.records)) {
    const n = rec.racer, racer = out[n];
    if (!n || !racer?.blink) continue;
    const rowBottom = rec.top + rec.height - 1, column = rec.left + (rec.width >> 1) - 1;
    const near = rowBottom > bottom ? B.zoneNear : rowBottom === bottom ? B.zoneSame : B.zoneFar;
    const side = Math.abs(column - centre) <= B.columnSlack ? B.columnCentre : column > centre ? B.columnRight : B.columnLeft;
    const b = racer.blink;
    if (b.flag !== 0 && rec.sizeClass <= B.sizeClass && racer.hit === 0 && !racer.crashed && (near === B.zoneSame || near === B.zoneFar)) { // the racer glances back
      if (ctx.racing) sounds.push({ id: ctx.slots[n], guard: true, ...(ctx.duck ? { quack: true } : {}) }); // the duck game plays the quack for the racer's slot (duck.glance)
      b.flag = 0;
      if (!ctx.duck) { b.phase = PHASE.up; [b.kind, b.index] = side === B.columnLeft ? B.starts.leftColumn : B.starts.other; } // no glance animation in the duck game
    }
    if (ctx.playerGlance !== false && current.glance === 0 && current.special === 0 && B.glance.zones.includes(near)) { // the player glances at a racer level with or behind the car
      if (ctx.racing) sounds.push({ id: B.glance.sound, guard: true });
      if (current.jump === 0) { const [anim, row] = B.glance.nearColumns.includes(side) ? B.glance.near : B.glance.far; current = startBump(current, anim, row, ctx.tick); }
    }
    if (b.phase !== 0) {
      const [first, last] = B.frames.kinds[b.kind];
      b.shown = B.frames.first + b.index;
      if (b.phase === PHASE.up) { b.index += 1; if (b.index === last) { b.phase = PHASE.hold; b.stamp = ctx.tick; } }
      else if (b.phase === PHASE.hold) { if (ctx.tick - b.stamp >= B.hold) b.phase = PHASE.down; }
      else { b.index -= 1; if (b.index < first) b.phase = 0; }
    }
  }
  return { racers: out, car: current, sounds };
}
