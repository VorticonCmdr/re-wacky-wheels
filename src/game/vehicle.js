// The vehicle screen in front of the single player setup (menu.vehicle-screen, STATIC): the ring of the eight drivers that turns round to bring one to the selected place, and the
// animation of the chosen one. Each step is one pass of the game's loop; `wait` says how many counts of the 136 Hz counter the next pass takes.
import { K } from '../evidence/k.js';

const VEHICLE = () => K({ routine: 0xa380, title: { text: 'CHOOSE VEHICLE', y: 96, glyph: 8, screen: 320 }, controller: { text: 'KEYBOARD', x: 46, y: 175 }, help: { text: 'PRESS F1 TO VIEW YOUR CONTROLS', x: 46, y: 188 }, ring: { columns: [46, 110, 174, 238], topY: 58, bottomY: 114, topFrame: 2, bottomFrame: 6, perRow: 4 }, selectedAt: [238, 114], marker: { member: 'AJ.SP', x: 236, y: 142, toggleEvery: 5 }, names: { x: 45, y: [146, 158], advance: 11 }, strings: ['       UNO       ', '  CUTE AND FAST  ', '      SULTAN     ', ' ONE HUMP OR TWO ', '      MORRIS     ', '   OLD RELIABLE  ', '     PEGGLES     ', '  TURBO SQUAWK!  ', '      RAZER      ', '  KILLER WHEELS  ', '      RINGO      ', '   RAPID RASCAL  ', '     BLOMBO      ', '  NEVER FORGETS  ', '      TIGI       ', '  VROOM! GROWL!  '], passes: { idle: 4, rotate: 4, turn: 10, rest: 26, chosen: 10, intro: 8 }, rotation: { passes: 8, vertical: 7, pixels: 8 }, turnFrames: { low: 2, high: 6 }, chosen: { states: [2, 10, 5], frames: 8 }, puff: { member: 'PUF.SP', frames: 4 } }, 'menu.vehicle-screen');

export const vehicleLayout = () => { const V = VEHICLE(); return { title: V.title, controller: V.controller, help: V.help, marker: V.marker, names: V.names, puff: V.puff, ringColumns: V.ring.columns }; };
export const driverTexts = slot => { const S = VEHICLE().strings; return [S[2 * slot], S[2 * slot + 1]]; }; // @math a name and a tagline for each driver

// A new screen: the eight cars in their places (the top row the slots 0 to 3, the bottom row 4 to 7), the puffs of the intro first. The ring starts as if the last turn were to the right.
export function createVehicle({ player = null, taken = null } = {}) { // `player` 0 or 1 in a two player game (the title and the marker's pair), `taken` the slot the first player chose (crossed out for the second)
  const R = VEHICLE().ring;
  return {
    player, taken, phase: 'intro', pass: 0, lastDir: 'right', marker: 0, markerCount: 0, turn: null, rot: null, chosen: null,
    entries: Array.from({ length: R.perRow * 2 }, (_, slot) => ({ slot, x: R.columns[slot % R.perRow], y: slot < R.perRow ? R.topY : R.bottomY, frame: slot < R.perRow ? R.topFrame : R.bottomFrame, facing: 0 })), // @math two rows
  };
}

// The driver of the car at the selected place, or null while it is in between.
export function selectedSlot(v) { const [x, y] = VEHICLE().selectedAt, e = v.entries.find(c => c.x === x && c.y === y); return e ? e.slot : null; }

const frameFor = (V, row, lastDir) => (row === 'top' ? (lastDir === 'right' ? V.ring.topFrame : V.ring.bottomFrame) : (lastDir === 'right' ? V.ring.bottomFrame : V.ring.topFrame));

// The code of a car's move for a turn of the ring (obj1+0xb6d0 to +0xb77b): clockwise for Left, counter-clockwise for Right.
function codeOf(V, e, dir) {
  const top = e.y === V.ring.topY, [rightEnd] = [V.ring.columns.at(-1)], leftEnd = V.ring.columns[0];
  if (dir === 'left') return top ? (e.x === rightEnd ? 'down' : 'right') : (e.x === leftEnd ? 'up' : 'left');
  return top ? (e.x === leftEnd ? 'down' : 'left') : (e.x === rightEnd ? 'up' : 'right');
}

// One pass. `key` is 'left', 'right', 'fire', 'escape', 'help' or null. Returns the screen, the counts the pass waits and what it leaves with ('menu', or { slot } for the chosen driver).
export function stepVehicle(v0, key) {
  const V = VEHICLE(), P = V.passes, v = { ...v0, entries: v0.entries.map(e => ({ ...e })) };
  if (v.phase === 'intro') { v.pass += 1; if (v.pass >= V.puff.frames) { v.phase = 'idle'; v.pass = 0; } return { vehicle: v, wait: P.intro, leave: null }; }
  if (v.phase === 'idle') {
    v.markerCount += 1; // the marker's picture switches every fifth pass while the ring rests
    if (v.markerCount >= V.marker.toggleEvery) { v.marker = 1 - v.marker; v.markerCount = 0; }
    if (key === 'escape') return { vehicle: v, wait: P.idle, leave: 'menu' };
    if (key === 'help') return { vehicle: v, wait: P.idle, leave: null, help: true }; // F1 shows the controls (menu.controls-help, obj1+0xb3fa)
    if (key === 'fire' && v.taken !== null && selectedSlot(v) === v.taken) return { vehicle: v, wait: P.idle, leave: null }; // the car the first player took cannot be chosen (obj1+0xb4e1)
    if (key === 'fire') { // the chosen car's driver speaks and the animation starts (obj1+0xb939)
      for (const e of v.entries) if (e.frame === V.turnFrames.low || e.frame === V.turnFrames.high) e.facing = e.frame;
      v.phase = 'chosen'; v.chosen = { slot: selectedSlot(v), state: 0, passes: 0 }; return { vehicle: v, wait: P.chosen, leave: null, sound: v.chosen.slot };
    }
    if (key === 'left' || key === 'right') {
      const turning = key === 'left' ? v.lastDir === 'right' : v.lastDir === 'left'; // the cars turn round when the ring goes the other way than it last did
      v.rot = { dir: key, left: V.rotation.passes }; v.markerCount = 0;
      if (turning) { v.phase = 'turn'; v.turn = { dir: key, done: false }; return { vehicle: v, wait: P.turn, leave: null }; }
      v.phase = 'rotate';
    }
    return { vehicle: v, wait: P.idle, leave: null };
  }
  if (v.phase === 'turn') { // the frame words walk to the other facing, one step a pass
    const up = v.turn.dir === 'left'; // Left: the top row counts up from 2 to 6 and the bottom row down from 6 to 2
    let done = false;
    for (const e of v.entries) {
      const top = e.y === V.ring.topY, rising = top === up;
      e.frame += rising ? 1 : -1;
      if (e.frame === (rising ? V.turnFrames.high : V.turnFrames.low)) done = true;
    }
    if (done) { v.phase = 'rest'; return { vehicle: v, wait: P.rest, leave: null }; }
    return { vehicle: v, wait: P.turn, leave: null };
  }
  if (v.phase === 'rest') { v.phase = 'rotate'; return { vehicle: v, wait: P.rotate, leave: null }; }
  if (v.phase === 'rotate') { // the ring moves one place in 8 passes, every car 8 pixels a pass
    const r = v.rot;
    if (r.left === V.rotation.passes) for (const e of v.entries) { e.code = codeOf(V, e, r.dir); if (e.code === 'left') e.frame = V.turnFrames.low; else if (e.code === 'right') e.frame = V.turnFrames.high; }
    const step = V.rotation.pixels, passIndex = V.rotation.passes - r.left;
    for (const e of v.entries) {
      if (e.code === 'left') e.x -= step; else if (e.code === 'right') e.x += step;
      else if (passIndex < V.rotation.vertical) e.y += e.code === 'down' ? step : -step;
    }
    r.left -= 1;
    if (r.left === 0) { // the vertical movers turn on the last pass to the facing of their new row
      v.lastDir = r.dir;
      for (const e of v.entries) { if (e.code === 'down' || e.code === 'up') e.frame = frameFor(V, e.y === V.ring.topY ? 'top' : 'bottom', v.lastDir); delete e.code; }
      v.rot = null; v.phase = 'idle';
    }
    return { vehicle: v, wait: P.rotate, leave: null };
  }
  // the chosen driver's animation: its car steps through the frames, the others turn about their facing in the first state; the states last 2, 10 and 5 passes
  const c = v.chosen, S = V.chosen.states;
  c.passes += 1;
  const mine = v.entries.find(e => e.slot === c.slot); mine.frame = (mine.frame + 1) % V.chosen.frames;
  if (c.state === 0) for (const e of v.entries) if (e !== mine) e.frame += e.facing === V.turnFrames.low ? 1 : -1; // @math the frame word goes up for the facing 2 and down for 6
  const limit = S.slice(0, c.state + 1).reduce((a, b) => a + b, 0);
  if (c.passes >= limit) c.state += 1;
  if (c.state >= S.length) return { vehicle: v, wait: P.chosen, leave: { slot: c.slot } };
  return { vehicle: v, wait: P.chosen, leave: null };
}
